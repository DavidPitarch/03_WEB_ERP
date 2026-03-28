import { createClient } from '@supabase/supabase-js';
import { insertDomainEvent } from './services/audit';
import { processGeocodingQueue } from './services/geocoding';
import { checkWorkloadAlerts } from './services/workload-alerts';
import type { Env } from './types';

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

export async function runScheduledTasks(env: Env): Promise<Record<string, any>> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const results: Record<string, any> = {};

  try {
    const { data: alertRes } = await supabase.rpc('generate_alerts_batch');
    results.alertas = alertRes ?? 'rpc executed';
  } catch {
    results.alertas = await generateAlertsManual(supabase);
  }

  results.pedidos_caducados        = await detectPedidosCaducados(supabase);
  results.facturas_vencidas        = await detectFacturasVencidas(supabase);
  results.informes_caducados       = await detectInformesCaducados(supabase);
  results.geocoding_queue          = await processGeocodingQueue(supabase, 15);
  results.geo_overload             = await detectGeoOverloads(supabase);
  results.workload_alerts          = await checkWorkloadAlerts(supabase);
  results.autocita_expirados       = await detectAutocitaTokensExpirados(supabase);
  // ─── Watchdogs nuevos ────────────────────────────────────────
  results.citas_sin_parte          = await detectCitasSinParte(supabase);         // W01
  results.finalizados_sin_factura  = await detectFinalizadosSinFactura(supabase); // W02
  results.tareas_escaladas         = await escalarTareasVencidas(supabase);        // W05
  results.pendientes_atascados     = await detectPendientesAtascados(supabase);    // W06
  results.nuevos_sin_contacto      = await detectNuevosSinContacto(supabase);      // W07
  results.eventos_dead_letter      = await detectEventosDeadLetter(supabase);      // W08
  results.partes_antiguas          = await detectPartesAntiguas(supabase);         // W09

  return results;
}

export async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const correlation_id = crypto.randomUUID();
  const ts = new Date().toISOString();

  console.log(JSON.stringify({ level: 'info', job: 'scheduled', phase: 'start', correlation_id, ts }));

  try {
    const results = await runScheduledTasks(env);
    console.log(JSON.stringify({ level: 'info', job: 'scheduled', phase: 'complete', correlation_id, results, ts: new Date().toISOString() }));
  } catch (err) {
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

async function generateAlertsManual(supabase: any) {
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
    if (!error) count++;
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

async function detectPedidosCaducados(supabase: any) {
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
      estado_anterior: p.estado,   // use actual state, not hardcoded 'enviado'
      estado_nuevo: 'caducado',
      motivo: 'Fecha limite superada (cron)',
    });
    count++;
  }
  return { marked: count };
}

async function detectFacturasVencidas(supabase: any) {
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

async function detectInformesCaducados(supabase: any) {
  const { count } = await supabase
    .from('v_informes_caducados')
    .select('*', { count: 'exact', head: true });
  return { count: count ?? 0 };
}

/** Detecta operarios con sobrecarga (>6 citas el mismo día) y genera alertas */
async function detectGeoOverloads(supabase: any) {
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
async function detectAutocitaTokensExpirados(supabase: any) {
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

// ─── W01: Citas realizadas >2h sin parte ─────────────────────────────────────
async function detectCitasSinParte(supabase: any) {
  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();

  const { data: citas } = await supabase
    .from('citas')
    .select('id, expediente_id, expedientes(tramitador_id, numero_expediente)')
    .eq('estado', 'realizada')
    .lt('updated_at', twoHoursAgo);

  let count = 0;
  for (const c of citas ?? []) {
    const { count: parteCount } = await supabase
      .from('partes_operario')
      .select('id', { count: 'exact', head: true })
      .eq('cita_id', c.id);

    if (parteCount && parteCount > 0) continue;

    const titulo = '[W01] Parte de trabajo pendiente tras visita';
    const { count: tareaCount } = await supabase
      .from('tareas_internas')
      .select('id', { count: 'exact', head: true })
      .eq('expediente_id', c.expediente_id)
      .eq('titulo', titulo)
      .in('estado', ['pendiente', 'en_progreso']);

    if (tareaCount && tareaCount > 0) continue;

    const tramitadorId = c.expedientes?.tramitador_id ?? null;

    await supabase.from('tareas_internas').insert({
      expediente_id: c.expediente_id,
      titulo,
      descripcion: `Cita ${c.id} marcada como realizada hace más de 2 horas sin parte adjunto.`,
      asignado_a: tramitadorId,
      creado_por: SYSTEM_ACTOR_ID,
      prioridad: 'urgente',
      estado: 'pendiente',
    });

    await supabase.from('alertas').upsert({
      tipo: 'cita_sin_parte',
      titulo: `Visita sin parte: ${c.expedientes?.numero_expediente ?? c.expediente_id}`,
      expediente_id: c.expediente_id,
      prioridad: 'alta',
      estado: 'activa',
      destinatario_id: tramitadorId,
    }, { onConflict: 'tipo,expediente_id' });

    count++;
  }

  return { sin_parte: count };
}

// ─── W02: Expedientes FINALIZADO >24h sin factura ────────────────────────────
async function detectFinalizadosSinFactura(supabase: any) {
  const oneDayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, tramitador_id')
    .eq('estado', 'FINALIZADO')
    .lt('updated_at', oneDayAgo);

  let count = 0;
  for (const exp of expedientes ?? []) {
    const { count: facturaCount } = await supabase
      .from('facturas')
      .select('id', { count: 'exact', head: true })
      .eq('expediente_id', exp.id)
      .not('estado', 'eq', 'anulada');

    if (facturaCount && facturaCount > 0) continue;

    const titulo = '[W02] Expediente finalizado sin factura emitida';
    const { count: tareaCount } = await supabase
      .from('tareas_internas')
      .select('id', { count: 'exact', head: true })
      .eq('expediente_id', exp.id)
      .eq('titulo', titulo)
      .in('estado', ['pendiente', 'en_progreso']);

    if (tareaCount && tareaCount > 0) continue;

    await supabase.from('tareas_internas').insert({
      expediente_id: exp.id,
      titulo,
      descripcion: `El expediente ${exp.numero_expediente} lleva más de 24 h en estado FINALIZADO sin factura emitida.`,
      asignado_a: null,
      creado_por: SYSTEM_ACTOR_ID,
      prioridad: 'alta',
      estado: 'pendiente',
    });

    await supabase.from('alertas').upsert({
      tipo: 'finalizado_sin_factura',
      titulo: `Sin factura >24 h: ${exp.numero_expediente}`,
      expediente_id: exp.id,
      prioridad: 'alta',
      estado: 'activa',
    }, { onConflict: 'tipo,expediente_id' });

    await insertDomainEvent(supabase, {
      aggregate_id: exp.id,
      aggregate_type: 'expediente',
      event_type: 'TareaDisparada',
      payload: { watchdog: 'W02', motivo: 'FINALIZADO >24h sin factura' },
      actor_id: SYSTEM_ACTOR_ID,
    });

    count++;
  }

  return { sin_factura: count };
}

// ─── W05: Tareas pendientes > fecha_limite → escalar a supervisor ─────────────
async function escalarTareasVencidas(supabase: any) {
  const now = new Date().toISOString();

  const { data: tareas } = await supabase
    .from('tareas_internas')
    .select('id, expediente_id, titulo')
    .in('estado', ['pendiente', 'en_progreso'])
    .lt('fecha_limite', now)
    .not('fecha_limite', 'is', null);

  let count = 0;
  for (const t of tareas ?? []) {
    const { count: alertaCount } = await supabase
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'tarea_escalada_supervisor')
      .eq('tarea_id', t.id);

    if (alertaCount && alertaCount > 0) continue;

    await supabase.from('alertas').insert({
      tipo: 'tarea_escalada_supervisor',
      titulo: `[Escalada] Tarea vencida sin resolver: ${t.titulo}`,
      expediente_id: t.expediente_id,
      tarea_id: t.id,
      prioridad: 'alta',
      estado: 'activa',
      destinatario_id: null,
    });

    count++;
  }

  return { escaladas: count };
}

// ─── W06: Expedientes PENDIENTE_* >48h sin cambio ────────────────────────────
async function detectPendientesAtascados(supabase: any) {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, estado, tramitador_id')
    .in('estado', ['PENDIENTE', 'PENDIENTE_MATERIAL', 'PENDIENTE_PERITO', 'PENDIENTE_CLIENTE'])
    .lt('updated_at', fortyEightHoursAgo);

  let count = 0;
  for (const exp of expedientes ?? []) {
    const titulo = '[W06] Expediente bloqueado >48h sin cambio';
    const { count: tareaCount } = await supabase
      .from('tareas_internas')
      .select('id', { count: 'exact', head: true })
      .eq('expediente_id', exp.id)
      .eq('titulo', titulo)
      .in('estado', ['pendiente', 'en_progreso']);

    if (tareaCount && tareaCount > 0) continue;

    await supabase.from('tareas_internas').insert({
      expediente_id: exp.id,
      titulo,
      descripcion: `El expediente ${exp.numero_expediente} lleva más de 48 h en estado ${exp.estado} sin cambios. Requiere revisión de supervisor.`,
      asignado_a: null,
      creado_por: SYSTEM_ACTOR_ID,
      prioridad: 'urgente',
      estado: 'pendiente',
    });

    await supabase.from('alertas').upsert({
      tipo: 'pendiente_atascado',
      titulo: `Bloqueado >48 h: ${exp.numero_expediente} (${exp.estado})`,
      expediente_id: exp.id,
      prioridad: 'urgente',
      estado: 'activa',
    }, { onConflict: 'tipo,expediente_id' });

    await insertDomainEvent(supabase, {
      aggregate_id: exp.id,
      aggregate_type: 'expediente',
      event_type: 'TareaDisparada',
      payload: { watchdog: 'W06', estado: exp.estado, motivo: 'PENDIENTE_* >48h sin cambio' },
      actor_id: SYSTEM_ACTOR_ID,
    });

    count++;
  }

  return { atascados: count };
}

// ─── W07: Expedientes NUEVO con SLA vencido sin asignar ──────────────────────
async function detectNuevosSinContacto(supabase: any) {
  const now = new Date().toISOString();

  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, tramitador_id')
    .eq('estado', 'NUEVO')
    .lt('fecha_limite_sla', now)
    .not('fecha_limite_sla', 'is', null);

  let count = 0;
  for (const exp of expedientes ?? []) {
    await supabase.from('alertas').upsert({
      tipo: 'nuevo_sla_vencido',
      titulo: `SLA vencido sin asignar: ${exp.numero_expediente}`,
      expediente_id: exp.id,
      prioridad: 'urgente',
      estado: 'activa',
      destinatario_id: exp.tramitador_id ?? null,
    }, { onConflict: 'tipo,expediente_id' });

    count++;
  }

  return { sla_vencidos: count };
}

// ─── W08: eventos_dominio con retry >= 3 (dead letter) ───────────────────────
async function detectEventosDeadLetter(supabase: any) {
  const { data: eventos } = await supabase
    .from('eventos_dominio')
    .select('id, event_type, aggregate_id, error, retry_count')
    .eq('processed', false)
    .gte('retry_count', 3);

  let count = 0;
  for (const ev of eventos ?? []) {
    // Check if alerta already exists for this event
    const { count: alertaCount } = await supabase
      .from('alertas')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'evento_dead_letter')
      .eq('expediente_id', ev.aggregate_id);

    if (alertaCount && alertaCount > 0) continue;

    await supabase.from('alertas').insert({
      tipo: 'evento_dead_letter',
      titulo: `[DLQ] ${ev.event_type} — ${ev.retry_count} reintentos fallidos`,
      mensaje: ev.error ?? 'Sin detalle de error registrado',
      expediente_id: ev.aggregate_id ?? null,
      prioridad: 'alta',
      estado: 'activa',
      destinatario_id: null,
    });

    count++;
  }

  return { dead_letters: count };
}

// ─── W09: Partes pendientes de validación >48h ───────────────────────────────
async function detectPartesAntiguas(supabase: any) {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const { data: partes } = await supabase
    .from('partes_operario')
    .select('id, expediente_id, expedientes(tramitador_id, numero_expediente)')
    .eq('validado', false)
    .lt('created_at', fortyEightHoursAgo);

  let count = 0;
  for (const p of partes ?? []) {
    const titulo = '[W09] Parte sin validar >48h';
    const { count: tareaCount } = await supabase
      .from('tareas_internas')
      .select('id', { count: 'exact', head: true })
      .eq('expediente_id', p.expediente_id)
      .eq('titulo', titulo)
      .in('estado', ['pendiente', 'en_progreso']);

    if (tareaCount && tareaCount > 0) continue;

    const tramitadorId = p.expedientes?.tramitador_id ?? null;

    await supabase.from('tareas_internas').insert({
      expediente_id: p.expediente_id,
      titulo,
      descripcion: `El parte ${p.id} del expediente ${p.expedientes?.numero_expediente ?? p.expediente_id} lleva más de 48 h pendiente de validación.`,
      asignado_a: tramitadorId,
      creado_por: SYSTEM_ACTOR_ID,
      prioridad: 'media',
      estado: 'pendiente',
    });

    await supabase.from('alertas').upsert({
      tipo: 'parte_sin_validar',
      titulo: `Parte sin validar >48h: ${p.expedientes?.numero_expediente ?? p.expediente_id}`,
      expediente_id: p.expediente_id,
      prioridad: 'media',
      estado: 'activa',
      destinatario_id: tramitadorId,
    }, { onConflict: 'tipo,expediente_id' });

    count++;
  }

  return { partes_antiguas: count };
}
