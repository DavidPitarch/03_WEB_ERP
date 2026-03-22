/**
 * Rutas: Planning Geográfico
 *
 * GET  /planning/geo/expedientes   → pines de expedientes para el mapa
 * GET  /planning/geo/operarios     → operarios con carga y posición base
 * GET  /planning/geo/heatmap       → agregados por CP para mapa de calor
 * POST /planning/dispatch/suggest  → smart dispatch (dry-run por defecto)
 * POST /planning/dispatch/accept   → acepta sugerencias → crea citas
 * POST /planning/geo/geocode       → geocodifica una dirección ad-hoc
 */

import { Hono } from 'hono';
import { geocodeExpediente } from '../services/geocoding';
import { createCitaCommand, normalizeCommandError } from '../services/core-commands';
import { getRequestIp } from '../http/request-metadata';
import type { Env } from '../types';

export const planningGeoRoutes = new Hono<{ Bindings: Env }>();

const MAX_CITAS_DIA = 7; // Umbral de sobrecarga

// ─── GET /planning/geo/expedientes ────────────────────────────
planningGeoRoutes.get('/geo/expedientes', async (c) => {
  const supabase = c.get('supabase');

  const estadoParam = c.req.query('estado');
  const operarioId  = c.req.query('operario_id');
  const companiaId  = c.req.query('compania_id');
  const prioridad   = c.req.query('prioridad');
  const gremio      = c.req.query('gremio');
  const fechaIni    = c.req.query('fecha_ini');
  const fechaFin    = c.req.query('fecha_fin');
  // bbox=minLng,minLat,maxLng,maxLat  (frustum culling en zoom alto)
  const bbox        = c.req.query('bbox');

  let query = supabase
    .from('v_geo_expedientes')
    .select('*');

  if (estadoParam) {
    const estados = estadoParam.split(',');
    query = query.in('estado', estados);
  }
  if (operarioId) query = query.eq('operario_id', operarioId);
  if (companiaId) query = query.eq('compania_id', companiaId);
  if (prioridad)  query = query.in('prioridad', prioridad.split(','));

  if (fechaIni || fechaFin) {
    if (fechaIni) query = query.gte('fecha_encargo', fechaIni);
    if (fechaFin) query = query.lte('fecha_encargo', fechaFin);
  }

  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    if (!isNaN(minLng) && !isNaN(minLat) && !isNaN(maxLng) && !isNaN(maxLat)) {
      query = query
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng);
    }
  }

  const { data, error } = await query.order('fecha_encargo', { ascending: false }).limit(500);

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  // Si hay filtro por gremio, filtrar expedientes cuyos operarios tengan ese gremio
  let items = data ?? [];
  if (gremio) {
    // Obtener operarios con ese gremio
    const { data: ops } = await supabase
      .from('operarios')
      .select('id')
      .contains('gremios', [gremio]);
    const opIds = new Set((ops ?? []).map((o: any) => o.id));
    items = items.filter((e: any) => e.operario_id && opIds.has(e.operario_id));
  }

  // Contadores resumen
  const unassigned = items.filter((e: any) =>
    ['NUEVO', 'NO_ASIGNADO'].includes(e.estado)
  ).length;
  const alerts = items.filter((e: any) =>
    e.sla_status === 'vencido' || e.sla_status === 'urgente'
  ).length;

  return c.json({
    data: items,
    meta: {
      total: items.length,
      unassigned_count: unassigned,
      alert_count: alerts,
    },
    error: null,
  });
});

// ─── GET /planning/geo/operarios ──────────────────────────────
planningGeoRoutes.get('/geo/operarios', async (c) => {
  const supabase  = c.get('supabase');
  const gremio    = c.req.query('gremio');
  const soloActivos = c.req.query('activo') !== 'false';

  let query = supabase.from('v_operario_carga').select('*');
  if (soloActivos) query = query.eq('activo', true);
  if (gremio)      query = query.contains('gremios', [gremio]);

  const { data, error } = await query.order('nombre');
  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  const items = (data ?? []).map((op: any) => ({
    ...op,
    overloaded: op.citas_hoy > MAX_CITAS_DIA,
    carga_pct: Math.min(100, Math.round((op.citas_hoy / MAX_CITAS_DIA) * 100)),
  }));

  return c.json({ data: items, error: null });
});

// ─── GET /planning/geo/heatmap ────────────────────────────────
planningGeoRoutes.get('/geo/heatmap', async (c) => {
  const supabase = c.get('supabase');

  // Agrega expedientes activos por código postal y devuelve centroide + count
  const { data, error } = await supabase
    .from('expedientes')
    .select('codigo_postal, geo_lat, geo_lng, estado, prioridad')
    .not('geo_lat', 'is', null)
    .not('estado', 'in', '(CERRADO,CANCELADO,COBRADO,FACTURADO)');

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  // Agrupar por CP
  const byCP: Record<string, { lat: number; lng: number; count: number; urgentes: number }> = {};
  for (const e of data ?? []) {
    const cp = e.codigo_postal ?? 'unknown';
    if (!byCP[cp]) {
      byCP[cp] = { lat: e.geo_lat, lng: e.geo_lng, count: 0, urgentes: 0 };
    }
    byCP[cp].count++;
    if (e.prioridad === 'urgente') byCP[cp].urgentes++;
  }

  const points = Object.entries(byCP).map(([cp, v]) => ({
    cp,
    lat: v.lat,
    lng: v.lng,
    count: v.count,
    urgentes: v.urgentes,
    // Intensidad 0-1 para el heat layer
    intensity: Math.min(1, v.count / 10),
  }));

  return c.json({ data: points, error: null });
});

// ─── POST /planning/dispatch/suggest ─────────────────────────
planningGeoRoutes.post('/dispatch/suggest', async (c) => {
  const supabase  = c.get('adminSupabase');
  const user      = c.get('user');

  // Solo admin y supervisor pueden ejecutar smart dispatch
  if (!user.roles.some((r) => ['admin', 'supervisor'].includes(r))) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
  }

  const body = await c.req.json<{ fecha?: string; dry_run?: boolean }>().catch(() => ({} as { fecha?: string; dry_run?: boolean }));
  const fecha = body.fecha ?? new Date().toISOString().substring(0, 10);

  // 1. Expedientes sin asignar con coordenadas
  const { data: expedientes } = await supabase
    .from('v_geo_expedientes')
    .select('*')
    .in('estado', ['NUEVO', 'NO_ASIGNADO'])
    .not('lat', 'is', null);

  if (!expedientes?.length) {
    return c.json({ data: { suggestions: [], message: 'No hay expedientes sin asignar con geolocalización' }, error: null });
  }

  // 2. Operarios activos con su carga y posición
  const { data: operarios } = await supabase
    .from('v_operario_carga')
    .select('*')
    .eq('activo', true)
    .not('base_lat', 'is', null);

  if (!operarios?.length) {
    return c.json({ data: { suggestions: [], message: 'No hay operarios con posición base configurada' }, error: null });
  }

  const suggestions = [];

  for (const exp of expedientes) {
    // Obtener el gremio requerido del tipo de siniestro (si existe en masters)
    const { data: expFull } = await supabase
      .from('expedientes')
      .select('tipo_siniestro, codigo_postal')
      .eq('id', exp.id)
      .single();

    const candidates = operarios
      .map((op: any) => {
        const conflicts: string[] = [];

        // Filtro CP: si el operario tiene zonas_cp definidas, el CP del expediente debe estar
        if (op.zonas_cp?.length && expFull?.codigo_postal) {
          if (!op.zonas_cp.includes(expFull.codigo_postal)) {
            conflicts.push('Fuera de zona preferente');
          }
        }

        // Carga
        if (op.citas_hoy >= MAX_CITAS_DIA) {
          conflicts.push('Carga máxima alcanzada');
        }

        // Distancia Haversine en km
        const dist = haversineKm(exp.lat, exp.lng, op.base_lat, op.base_lng);

        // Score: mayor = mejor. Penalizar distancia y carga.
        const score = (1 / (dist + 0.1)) * (1 - op.citas_hoy / MAX_CITAS_DIA);

        return { op, dist, score, conflicts };
      })
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) continue;
    const best = candidates[0];

    suggestions.push({
      expediente_id:    exp.id,
      expediente_num:   exp.numero_expediente,
      expediente_dir:   exp.direccion_siniestro,
      operario_id:      best.op.id,
      operario_nombre:  `${best.op.nombre} ${best.op.apellidos}`,
      distance_km:      Math.round(best.dist * 10) / 10,
      score:            Math.round(best.score * 1000) / 1000,
      citas_hoy:        best.op.citas_hoy,
      conflicts:        best.conflicts,
      reason: best.conflicts.length === 0
        ? 'Operario más cercano con disponibilidad'
        : `Mejor opción disponible (${best.conflicts.join(', ')})`,
    });
  }

  return c.json({ data: { suggestions, total: suggestions.length }, error: null });
});

// ─── POST /planning/dispatch/accept ──────────────────────────
planningGeoRoutes.post('/dispatch/accept', async (c) => {
  const supabase = c.get('adminSupabase');
  const user     = c.get('user');

  if (!user.roles.some((r) => ['admin', 'supervisor'].includes(r))) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
  }

  const body = await c.req.json<{
    assignments: Array<{
      expediente_id: string;
      operario_id: string;
      fecha: string;
      franja_inicio: string;
      franja_fin: string;
    }>;
  }>();

  if (!body.assignments?.length) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'assignments es requerido' } }, 422);
  }

  const results: Array<{ expediente_id: string; status: 'ok' | 'error'; message?: string }> = [];
  const ip = getRequestIp(c);

  for (const a of body.assignments) {
    try {
      await createCitaCommand(
        supabase,
        {
          expediente_id: a.expediente_id,
          operario_id:   a.operario_id,
          fecha:         a.fecha,
          franja_inicio: a.franja_inicio,
          franja_fin:    a.franja_fin,
          notas:         'Asignación automática vía Smart Dispatch',
        },
        user.id,
        ip
      );
      results.push({ expediente_id: a.expediente_id, status: 'ok' });
    } catch (err) {
      const ce = normalizeCommandError(err);
      results.push({ expediente_id: a.expediente_id, status: 'error', message: ce.message });
    }
  }

  const created = results.filter((r) => r.status === 'ok').length;
  const failed  = results.filter((r) => r.status === 'error').length;

  return c.json({
    data: { results, created, failed },
    error: null,
  }, created > 0 ? 201 : 422);
});

// ─── POST /planning/geo/geocode ───────────────────────────────
planningGeoRoutes.post('/geo/geocode', async (c) => {
  const supabase = c.get('adminSupabase');
  const user     = c.get('user');

  if (!user.roles.some((r) => ['admin', 'supervisor'].includes(r))) {
    return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
  }

  const body = await c.req.json<{
    expediente_id?: string;
    direccion?: string;
    codigo_postal?: string;
    localidad?: string;
    provincia?: string;
  }>();

  if (!body.expediente_id && !body.direccion) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'expediente_id o direccion requerido' } }, 422);
  }

  if (body.expediente_id) {
    const { data: exp } = await supabase
      .from('expedientes')
      .select('id, direccion_siniestro, codigo_postal, localidad, provincia')
      .eq('id', body.expediente_id)
      .single();

    if (!exp) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);

    const result = await geocodeExpediente(supabase, exp);
    if (!result) {
      return c.json({ data: null, error: { code: 'GEOCODING_FAILED', message: 'No se pudo geocodificar la dirección' } }, 422);
    }
    return c.json({ data: result, error: null });
  }

  // Geocodificar dirección libre
  const fakeExp = {
    id: 'adhoc',
    direccion_siniestro: body.direccion!,
    codigo_postal: body.codigo_postal ?? '',
    localidad: body.localidad ?? '',
    provincia: body.provincia ?? '',
  };

  // Para ad-hoc solo devolvemos el resultado sin guardar en expedientes
  const { geocodeExpediente: _gc, ...geoSvc } = await import('../services/geocoding');
  void geoSvc; // unused import guard

  // Llamamos directamente a Nominatim para ad-hoc sin persistir
  const raw = [fakeExp.direccion_siniestro, fakeExp.codigo_postal, fakeExp.localidad, fakeExp.provincia, 'España']
    .filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(raw)}&format=json&limit=1&countrycodes=es`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'ERP-Siniestros/1.0', 'Accept-Language': 'es' },
  });
  const results = await resp.json() as any[];
  if (!results?.length) {
    return c.json({ data: null, error: { code: 'GEOCODING_FAILED', message: 'Dirección no encontrada' } }, 422);
  }
  return c.json({
    data: {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      confidence: results[0].importance ?? 0.5,
      source: 'nominatim',
    },
    error: null,
  });
});

// ─── Helpers ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
