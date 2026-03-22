import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Detecta tramitadores con sobrecarga de trabajo y genera alertas en alertas_carga.
 * Se llama desde el cron scheduled cada 15 minutos.
 */
export async function checkWorkloadAlerts(supabase: SupabaseClient): Promise<{
  generadas: number;
  resueltas: number;
}> {
  let generadas = 0;
  let resueltas = 0;

  // Obtener carga actual de todos los tramitadores activos
  const { data: cargas } = await supabase
    .from('v_carga_tramitadores')
    .select('*')
    .eq('activo', true);

  for (const t of cargas ?? []) {
    // Alerta de umbral / carga máxima
    if (t.semaforo === 'amarillo' || t.semaforo === 'rojo') {
      const tipo = t.semaforo === 'rojo' ? 'carga_maxima' : 'umbral_carga';
      const severidad = t.semaforo === 'rojo' ? 'critical' : 'warning';
      const mensaje = `${t.nombre_completo}: ${t.total_activos}/${t.max_expedientes_activos} expedientes activos (${t.porcentaje_carga}%)`;

      await upsertAlerta(supabase, {
        tramitador_id: t.tramitador_id,
        tipo,
        severidad,
        mensaje,
        valor_umbral: t.umbral_alerta_pct,
        valor_actual: t.porcentaje_carga,
      });
      generadas++;
    } else {
      // Resolver alertas de carga si ya bajó
      const { data: resueltas_alerts } = await supabase
        .from('alertas_carga')
        .update({ resuelta: true, resuelta_at: new Date().toISOString() })
        .eq('tramitador_id', t.tramitador_id)
        .in('tipo', ['umbral_carga', 'carga_maxima'])
        .eq('resuelta', false)
        .select('id');
      resueltas += resueltas_alerts?.length ?? 0;
    }

    // Alerta de SLA vencidos
    if ((t.total_sla_vencidos ?? 0) > 0) {
      const severidad = (t.total_sla_vencidos ?? 0) >= 3 ? 'critical' : 'warning';
      await upsertAlerta(supabase, {
        tramitador_id: t.tramitador_id,
        tipo: 'sla_vencidos',
        severidad,
        mensaje: `${t.nombre_completo}: ${t.total_sla_vencidos} expediente(s) con SLA vencido`,
        valor_actual: t.total_sla_vencidos,
      });
      generadas++;
    } else {
      const { data: res } = await supabase
        .from('alertas_carga')
        .update({ resuelta: true, resuelta_at: new Date().toISOString() })
        .eq('tramitador_id', t.tramitador_id)
        .eq('tipo', 'sla_vencidos')
        .eq('resuelta', false)
        .select('id');
      resueltas += res?.length ?? 0;
    }
  }

  // Alerta global: expedientes sin tramitador
  const { count: sinAsignar } = await supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .is('tramitador_id', null)
    .not('estado', 'in', '(CERRADO,CANCELADO,COBRADO,FACTURADO)');

  if ((sinAsignar ?? 0) > 0) {
    const severidad = (sinAsignar ?? 0) >= 5 ? 'critical' : 'warning';
    await upsertAlerta(supabase, {
      tramitador_id: null,
      tipo: 'sin_tramitador',
      severidad,
      mensaje: `${sinAsignar} expediente(s) sin tramitador asignado`,
      valor_actual: sinAsignar,
    });
    generadas++;
  } else {
    const { data: res } = await supabase
      .from('alertas_carga')
      .update({ resuelta: true, resuelta_at: new Date().toISOString() })
      .is('tramitador_id', null)
      .eq('tipo', 'sin_tramitador')
      .eq('resuelta', false)
      .select('id');
    resueltas += res?.length ?? 0;
  }

  // Refrescar vista materializada
  void supabase.rpc('refresh_carga_tramitadores_sync');

  return { generadas, resueltas };
}

interface AlertaInput {
  tramitador_id: string | null;
  tipo: string;
  severidad: 'info' | 'warning' | 'critical';
  mensaje: string;
  valor_umbral?: number | null;
  valor_actual?: number | null;
}

async function upsertAlerta(supabase: SupabaseClient, input: AlertaInput): Promise<void> {
  // Buscar si ya existe una alerta activa del mismo tipo para el mismo tramitador
  let existingQuery = supabase
    .from('alertas_carga')
    .select('id')
    .eq('tipo', input.tipo)
    .eq('resuelta', false);

  if (input.tramitador_id) {
    existingQuery = existingQuery.eq('tramitador_id', input.tramitador_id);
  } else {
    existingQuery = existingQuery.is('tramitador_id', null);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    // Actualizar la alerta existente (puede haber cambiado la severidad o valor)
    await supabase
      .from('alertas_carga')
      .update({
        severidad:    input.severidad,
        mensaje:      input.mensaje,
        valor_umbral: input.valor_umbral ?? null,
        valor_actual: input.valor_actual ?? null,
      })
      .eq('id', existing.id);
  } else {
    // Insertar nueva alerta
    await supabase.from('alertas_carga').insert({
      tramitador_id: input.tramitador_id,
      tipo:          input.tipo,
      severidad:     input.severidad,
      mensaje:       input.mensaje,
      valor_umbral:  input.valor_umbral ?? null,
      valor_actual:  input.valor_actual ?? null,
    });
  }
}
