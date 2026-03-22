import { createClient } from '@supabase/supabase-js';
import { processGeocodingQueue } from './services/geocoding';
import { checkWorkloadAlerts } from './services/workload-alerts';
export async function runScheduledTasks(env) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const results = {};
    try {
        const { data: alertRes } = await supabase.rpc('generate_alerts_batch');
        results.alertas = alertRes ?? 'rpc executed';
    }
    catch {
        results.alertas = await generateAlertsManual(supabase);
    }
    results.pedidos_caducados = await detectPedidosCaducados(supabase);
    results.facturas_vencidas = await detectFacturasVencidas(supabase);
    results.informes_caducados = await detectInformesCaducados(supabase);
    results.geocoding_queue = await processGeocodingQueue(supabase, 15);
    results.geo_overload = await detectGeoOverloads(supabase);
    results.workload_alerts = await checkWorkloadAlerts(supabase);
    results.autocita_expirados = await detectAutocitaTokensExpirados(supabase);
    return results;
}
export async function scheduled(_event, env, _ctx) {
    const correlation_id = crypto.randomUUID();
    const ts = new Date().toISOString();
    console.log(JSON.stringify({ level: 'info', job: 'scheduled', phase: 'start', correlation_id, ts }));
    try {
        const results = await runScheduledTasks(env);
        console.log(JSON.stringify({ level: 'info', job: 'scheduled', phase: 'complete', correlation_id, results, ts: new Date().toISOString() }));
    }
    catch (err) {
        console.error(JSON.stringify({
            level: 'error',
            job: 'scheduled',
            phase: 'failed',
            correlation_id,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            ts: new Date().toISOString(),
        }));
    }
}
async function generateAlertsManual(supabase) {
    const now = new Date().toISOString();
    let count = 0;
    const { data: tareasVencidas } = await supabase
        .from('tareas_internas')
        .select('id, expediente_id, titulo, asignado_a')
        .in('estado', ['pendiente', 'en_progreso'])
        .lt('fecha_limite', now);
    for (const t of tareasVencidas ?? []) {
        const { error } = await supabase.from('alertas').upsert({
            tipo: 'tarea_vencida',
            titulo: `Tarea vencida: ${t.titulo}`,
            expediente_id: t.expediente_id,
            tarea_id: t.id,
            prioridad: 'alta',
            estado: 'activa',
            destinatario_id: t.asignado_a,
        }, { onConflict: 'tipo,tarea_id' });
        if (!error)
            count++;
    }
    await supabase
        .from('expedientes')
        .select('id, numero_expediente')
        .not('fecha_limite_sla', 'is', null)
        .not('estado', 'in', '(FINALIZADO,FACTURADO,COBRADO,CERRADO,CANCELADO)');
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: partesPendientes } = await supabase
        .from('partes_operario')
        .select('id, expediente_id')
        .eq('validado', false)
        .lt('created_at', threeDaysAgo);
    for (const p of partesPendientes ?? []) {
        await supabase.from('alertas').upsert({
            tipo: 'parte_pendiente_antiguo',
            titulo: 'Parte pendiente de validacion >3 dias',
            expediente_id: p.expediente_id,
            prioridad: 'media',
            estado: 'activa',
        }, { onConflict: 'tipo,expediente_id' });
        count++;
    }
    return { generated: count };
}
async function detectPedidosCaducados(supabase) {
    const now = new Date().toISOString();
    // Select 'estado' so historial reflects the actual pre-caducado state
    const { data } = await supabase
        .from('pedidos_material')
        .select('id, estado')
        .in('estado', ['pendiente', 'enviado'])
        .lt('fecha_limite', now);
    let count = 0;
    for (const p of data ?? []) {
        await supabase.from('pedidos_material').update({
            estado: 'caducado',
            caducado_at: now,
        }).eq('id', p.id);
        await supabase.from('historial_pedido').insert({
            pedido_id: p.id,
            estado_anterior: p.estado, // use actual state, not hardcoded 'enviado'
            estado_nuevo: 'caducado',
            motivo: 'Fecha limite superada (cron)',
        });
        count++;
    }
    return { marked: count };
}
async function detectFacturasVencidas(supabase) {
    const now = new Date().toISOString();
    const { data } = await supabase
        .from('facturas')
        .select('id')
        .in('estado', ['emitida', 'enviada'])
        .eq('estado_cobro', 'pendiente')
        .lt('fecha_vencimiento', now);
    let count = 0;
    for (const f of data ?? []) {
        await supabase.from('facturas').update({
            estado_cobro: 'vencida',
        }).eq('id', f.id);
        count++;
    }
    return { marked: count };
}
async function detectInformesCaducados(supabase) {
    const { count } = await supabase
        .from('v_informes_caducados')
        .select('*', { count: 'exact', head: true });
    return { count: count ?? 0 };
}
/** Detecta operarios con sobrecarga (>6 citas el mismo día) y genera alertas */
async function detectGeoOverloads(supabase) {
    const { data: sobrecargados } = await supabase
        .from('v_operario_carga')
        .select('id, nombre, apellidos, citas_hoy')
        .gt('citas_hoy', 6);
    let count = 0;
    for (const op of sobrecargados ?? []) {
        await supabase.from('alertas').upsert({
            tipo: 'geo_operario_sobrecarga',
            titulo: `Operario sobrecargado: ${op.nombre} ${op.apellidos} (${op.citas_hoy} citas hoy)`,
            prioridad: 'alta',
            estado: 'activa',
        }, { onConflict: 'tipo,titulo' });
        count++;
    }
    return { overloaded: count };
}
/**
 * Detecta tokens de autocita que han expirado sin acción del cliente y genera
 * una alerta para la oficina por cada uno. Marca los tokens como 'expirado'.
 */
async function detectAutocitaTokensExpirados(supabase) {
    const now = new Date().toISOString();
    // Tokens pendientes cuya fecha de expiración ya pasó
    const { data: tokensCaducados } = await supabase
        .from('autocita_tokens')
        .select('id, expediente_id, created_by')
        .eq('estado', 'pendiente')
        .lt('expires_at', now)
        .is('revoked_at', null);
    let count = 0;
    for (const tok of tokensCaducados ?? []) {
        // Check if client took any action (any seleccion with non-view accion)
        const { data: selecciones } = await supabase
            .from('autocita_selecciones')
            .select('id')
            .eq('token_id', tok.id)
            .not('accion', 'eq', 'confirmacion_propuesta')
            .limit(1);
        const sinAccion = !selecciones || selecciones.length === 0;
        // Mark as expired
        await supabase
            .from('autocita_tokens')
            .update({ estado: 'expirado' })
            .eq('id', tok.id);
        if (sinAccion) {
            // Alert for office
            await supabase.from('alertas').upsert({
                tipo: 'custom',
                titulo: 'Enlace de autocita expirado sin respuesta',
                mensaje: 'El cliente no respondió al enlace de autocita antes de que caducara.',
                expediente_id: tok.expediente_id,
                prioridad: 'baja',
                estado: 'activa',
                destinatario_id: null,
            }, { onConflict: 'tipo,expediente_id' });
            // Domain event
            await supabase.from('eventos_dominio').insert({
                aggregate_id: tok.expediente_id,
                aggregate_type: 'expediente',
                event_type: 'AutocitaTokenExpirado',
                payload: { token_id: tok.id, expediente_id: tok.expediente_id },
                actor_id: tok.created_by,
                correlation_id: crypto.randomUUID(),
                causation_id: null,
            });
            count++;
        }
    }
    return { expirados_sin_accion: count };
}
