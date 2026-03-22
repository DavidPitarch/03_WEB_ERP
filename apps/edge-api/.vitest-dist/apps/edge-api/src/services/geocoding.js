/**
 * Servicio de geocodificación
 *
 * Prioridad de resolución:
 *  1. geo_cache (DB) — sin coste, instantáneo
 *  2. Nominatim OSM  — gratuito, 1 req/s, ~80% precisión España
 *
 * La clave de Mapbox (opcional) puede añadirse como env.MAPBOX_TOKEN
 * como fallback de mayor precisión si se desea en producción.
 */
/** Construye la dirección normalizada para búsqueda */
function buildSearchAddress(parts) {
    return [parts.direccion, parts.codigo_postal, parts.localidad, parts.provincia, 'España']
        .filter(Boolean)
        .join(', ');
}
/** Busca en la cache de geocodificación */
async function lookupCache(supabase, raw) {
    const { data } = await supabase
        .from('geo_cache')
        .select('lat, lng, confidence, source')
        .eq('direccion_raw', raw)
        .maybeSingle();
    if (!data)
        return null;
    return { lat: data.lat, lng: data.lng, confidence: data.confidence ?? 0.8, source: 'cache' };
}
/** Persiste un resultado en la cache */
async function saveCache(supabase, raw, point) {
    await supabase.from('geo_cache').upsert({ direccion_raw: raw, lat: point.lat, lng: point.lng, confidence: point.confidence, source: 'nominatim' }, { onConflict: 'direccion_raw' });
}
/** Llama a Nominatim OSM */
async function nominatimGeocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=es`;
    try {
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'ERP-Siniestros/1.0 (planning-geo-module)',
                'Accept-Language': 'es',
            },
        });
        if (!resp.ok)
            return null;
        const results = await resp.json();
        if (!results.length)
            return null;
        const r = results[0];
        return {
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            confidence: r.importance ?? 0.5,
            source: 'nominatim',
        };
    }
    catch {
        return null;
    }
}
/** Geocodifica un expediente y actualiza la BD */
export async function geocodeExpediente(supabase, expediente) {
    const raw = buildSearchAddress({
        direccion: expediente.direccion_siniestro,
        codigo_postal: expediente.codigo_postal,
        localidad: expediente.localidad,
        provincia: expediente.provincia,
    });
    // 1. Cache hit
    const cached = await lookupCache(supabase, raw);
    if (cached) {
        await supabase
            .from('expedientes')
            .update({ geo_lat: cached.lat, geo_lng: cached.lng, geo_status: 'ok' })
            .eq('id', expediente.id);
        return cached;
    }
    // 2. Nominatim
    const result = await nominatimGeocode(raw);
    if (!result) {
        await supabase
            .from('expedientes')
            .update({ geo_status: 'failed' })
            .eq('id', expediente.id);
        return null;
    }
    // Umbral mínimo de confianza
    if (result.confidence < 0.3) {
        await supabase
            .from('expedientes')
            .update({ geo_status: 'failed' })
            .eq('id', expediente.id);
        return null;
    }
    await Promise.all([
        supabase.from('expedientes').update({
            geo_lat: result.lat,
            geo_lng: result.lng,
            geo_status: 'ok',
        }).eq('id', expediente.id),
        saveCache(supabase, raw, result),
    ]);
    return result;
}
/** Procesa la cola de expedientes pendientes de geocodificar (máx. batch por ejecución) */
export async function processGeocodingQueue(supabase, maxBatch = 20) {
    const { data: pending } = await supabase
        .from('expedientes')
        .select('id, direccion_siniestro, codigo_postal, localidad, provincia')
        .eq('geo_status', 'pending')
        .not('direccion_siniestro', 'is', null)
        .limit(maxBatch);
    if (!pending?.length)
        return { processed: 0, failed: 0 };
    let processed = 0;
    let failed = 0;
    for (const exp of pending) {
        // Nominatim: máximo 1 req/s (política de uso)
        await new Promise((r) => setTimeout(r, 1100));
        const result = await geocodeExpediente(supabase, exp);
        if (result)
            processed++;
        else
            failed++;
    }
    return { processed, failed };
}
