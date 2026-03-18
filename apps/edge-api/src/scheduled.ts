import { createClient } from '@supabase/supabase-js';
import type { Env } from './types';

export async function runScheduledTasks(env: Env): Promise<Record<string, any>> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const results: Record<string, any> = {};

  try {
    const { data: alertRes } = await supabase.rpc('generate_alerts_batch');
    results.alertas = alertRes ?? 'rpc executed';
  } catch {
    results.alertas = await generateAlertsManual(supabase);
  }

  results.pedidos_caducados = await detectPedidosCaducados(supabase);
  results.facturas_vencidas = await detectFacturasVencidas(supabase);
  results.informes_caducados = await detectInformesCaducados(supabase);

  return results;
}

export async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const results = await runScheduledTasks(env);
  console.log('[SCHEDULED]', new Date().toISOString(), results);
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
  const { data } = await supabase
    .from('pedidos_material')
    .select('id')
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
      estado_anterior: 'enviado',
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
