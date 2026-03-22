/**
 * Servicio de Calendario Operativo
 *
 * Responsabilidades:
 * - Comprobar disponibilidad de operarios antes de crear/mover citas
 * - Gestionar la integración con SLA (pausas por ausencia)
 * - Emitir eventos de dominio cuando se aprueban/rechazan ausencias
 * - Reasignación de citas afectadas por ausencias aprobadas
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalAusencia, DisponibilidadCheck } from '@erp/types';

// ─── Tipos locales ───────────────────────────────────────────────────────────

export interface DisponibilidadResult {
  disponible: boolean;
  motivos_bloqueo: Array<{
    tipo: string;
    descripcion: string;
    referencia_id: string | null;
  }>;
  tiene_guardia: boolean;
}

export interface CitaAfectada {
  id: string;
  expediente_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
}

export interface AusenciaAprobadaResult {
  ausencia_id: string;
  estado: 'aprobada';
  citas_afectadas: number;
  citas_reasignacion_requerida: CitaAfectada[];
  expedientes_sla_pausados: string[];
}

// ─── Disponibilidad ──────────────────────────────────────────────────────────

/**
 * Comprueba si un operario está disponible para una franja concreta.
 * Delega la lógica en la función PL/pgSQL cal_check_operario_disponible.
 */
export async function checkDisponibilidad(
  supabase: SupabaseClient,
  operarioId: string,
  fecha: string,
  franjaInicio: string,
  franjaFin: string,
  opts: {
    empresaId?: string;
    provincia?: string;
    comunidad?: string;
    excepcionId?: string;
  } = {},
): Promise<DisponibilidadResult> {
  const { data, error } = await supabase.rpc('cal_check_operario_disponible', {
    p_operario_id:  operarioId,
    p_fecha:        fecha,
    p_franja_ini:   franjaInicio,
    p_franja_fin:   franjaFin,
    p_empresa_id:   opts.empresaId   ?? null,
    p_provincia:    opts.provincia   ?? null,
    p_comunidad:    opts.comunidad   ?? null,
    p_excepcion_id: opts.excepcionId ?? null,
  });

  if (error) throw new Error(`Error comprobando disponibilidad: ${error.message}`);
  return data as DisponibilidadResult;
}

/**
 * Obtiene los festivos aplicables para una fecha y contexto.
 */
export async function getFestivosAplicables(
  supabase: SupabaseClient,
  fecha: string,
  opts: {
    empresaId?: string;
    provincia?: string;
    comunidad?: string;
  } = {},
): Promise<Array<{ id: string; nombre: string; ambito: string }>> {
  const { data, error } = await supabase.rpc('cal_get_festivos_fecha', {
    p_fecha:       fecha,
    p_empresa_id:  opts.empresaId ?? null,
    p_provincia:   opts.provincia ?? null,
    p_comunidad:   opts.comunidad ?? null,
  });

  if (error) throw new Error(`Error consultando festivos: ${error.message}`);
  return data ?? [];
}

/**
 * Devuelve todos los festivos no-laborables para el motor de SLA.
 * Incluye `cal_festivos` (nacionales + ámbito específico) más `calendario_laboral`.
 */
export async function getFestivosParaSla(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
  opts: { empresaId?: string; provincia?: string; comunidad?: string } = {},
): Promise<string[]> {
  // Festivos heredados de calendario_laboral (ya existente)
  const { data: laboral } = await supabase
    .from('calendario_laboral')
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .neq('tipo', 'laborable');

  // Festivos del nuevo módulo
  const { data: calFestivos } = await supabase
    .from('cal_festivos')
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .eq('activo', true)
    .or(
      [
        'ambito.eq.nacional',
        opts.comunidad  ? `and(ambito.eq.autonomico,comunidad_autonoma.eq.${opts.comunidad})` : null,
        opts.provincia  ? `and(ambito.eq.provincial,provincia.eq.${opts.provincia})` : null,
        opts.empresaId  ? `and(ambito.eq.empresa,empresa_id.eq.${opts.empresaId})` : null,
        'ambito.eq.local',
      ]
        .filter(Boolean)
        .join(','),
    );

  const set = new Set<string>();
  (laboral  ?? []).forEach((r: any) => set.add(r.fecha));
  (calFestivos ?? []).forEach((r: any) => set.add(r.fecha));
  return [...set];
}

// ─── Aprobación / rechazo de ausencias ──────────────────────────────────────

/**
 * Aprueba una ausencia e inicia los efectos colaterales:
 * 1. Pausa el SLA de expedientes cuyo operario asignado queda bloqueado
 * 2. Devuelve las citas futuras afectadas (para que el backend las reasigne)
 */
export async function aprobarAusencia(
  supabase: SupabaseClient,
  ausenciaId: string,
  actorId: string,
): Promise<AusenciaAprobadaResult> {
  // Llamada a la función SQL que aprueba y emite evento de dominio
  const { data: rpcData, error: rpcError } = await supabase.rpc('cal_aprobar_ausencia', {
    p_ausencia_id: ausenciaId,
    p_actor_id:    actorId,
  });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    if (msg.includes('AUSENCIA_NOT_FOUND')) throw Object.assign(new Error('Ausencia no encontrada'), { code: 'NOT_FOUND', status: 404 });
    if (msg.includes('AUSENCIA_ESTADO_INVALIDO')) throw Object.assign(new Error(msg.split(':')[1]?.trim() ?? msg), { code: 'ESTADO_INVALIDO', status: 422 });
    throw new Error(`Error aprobando ausencia: ${msg}`);
  }

  // Obtener la ausencia ya aprobada para saber el rango
  const { data: ausencia } = await supabase
    .from('cal_ausencias')
    .select('operario_id, fecha_inicio, fecha_fin')
    .eq('id', ausenciaId)
    .single();

  if (!ausencia) {
    return { ausencia_id: ausenciaId, estado: 'aprobada', citas_afectadas: rpcData.citas_afectadas, citas_reasignacion_requerida: [], expedientes_sla_pausados: [] };
  }

  // Citas futuras afectadas que aún están en estado activo
  const { data: citasAfectadas } = await supabase
    .from('citas')
    .select('id, expediente_id, fecha, franja_inicio, franja_fin')
    .eq('operario_id', ausencia.operario_id)
    .gte('fecha', ausencia.fecha_inicio)
    .lte('fecha', ausencia.fecha_fin)
    .in('estado', ['programada', 'confirmada']);

  const citas: CitaAfectada[] = (citasAfectadas ?? []).map((c: any) => ({
    id: c.id,
    expediente_id: c.expediente_id,
    fecha: c.fecha,
    franja_inicio: c.franja_inicio,
    franja_fin: c.franja_fin,
  }));

  // Expedientes en curso con ese operario en el rango → pausar SLA
  const expedienteIds = [...new Set(citas.map((c) => c.expediente_id))];
  const pausados: string[] = [];

  if (expedienteIds.length > 0) {
    const { data: exps } = await supabase
      .from('expedientes')
      .select('id, estado')
      .in('id', expedienteIds)
      .in('estado', ['EN_PLANIFICACION', 'EN_CURSO', 'PENDIENTE']);

    for (const exp of exps ?? []) {
      // Registrar pausa SLA por ausencia de operario
      const { error: pausaError } = await supabase.from('sla_pausas').insert({
        expediente_id: exp.id,
        estado_pausa:  'AUSENCIA_OPERARIO',
        inicio:        new Date().toISOString(),
        fin:           null,
        motivo:        `Ausencia aprobada del operario (cal_ausencia: ${ausenciaId})`,
      });

      if (!pausaError) {
        pausados.push(exp.id);

        // Marcar en cal_ausencias que el SLA fue pausado
        await supabase
          .from('cal_ausencias')
          .update({ sla_pausado: true })
          .eq('id', ausenciaId);
      }
    }
  }

  return {
    ausencia_id:                  ausenciaId,
    estado:                       'aprobada',
    citas_afectadas:              rpcData.citas_afectadas,
    citas_reasignacion_requerida: citas,
    expedientes_sla_pausados:     pausados,
  };
}

/**
 * Rechaza una ausencia. Cierra cualquier pausa SLA abierta por motivo de
 * ausencia si la ausencia pasó por 'aprobada' antes del rechazo.
 */
export async function rechazarAusencia(
  supabase: SupabaseClient,
  ausenciaId: string,
  actorId: string,
  motivoRechazo: string,
): Promise<{ ausencia_id: string; estado: 'rechazada' }> {
  const { error } = await supabase.rpc('cal_rechazar_ausencia', {
    p_ausencia_id:    ausenciaId,
    p_actor_id:       actorId,
    p_motivo_rechazo: motivoRechazo,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('NOT_FOUND') || msg.includes('INVALID')) {
      throw Object.assign(new Error('Ausencia no encontrada o en estado no rechazable'), { code: 'NOT_FOUND', status: 404 });
    }
    throw new Error(`Error rechazando ausencia: ${msg}`);
  }

  return { ausencia_id: ausenciaId, estado: 'rechazada' };
}

// ─── Planning ─────────────────────────────────────────────────────────────────

/**
 * Devuelve todos los eventos del calendario en un rango de fechas,
 * opcionalmente filtrados por operario o empresa.
 */
export async function getPlanningRange(
  supabase: SupabaseClient,
  fechaDesde: string,
  fechaHasta: string,
  opts: { operarioId?: string; empresaId?: string } = {},
): Promise<unknown[]> {
  let query = supabase
    .from('v_calendario_operativo')
    .select('*')
    .gte('fecha_inicio', fechaDesde)
    .lte('fecha_inicio', fechaHasta + 'T23:59:59Z')
    .order('fecha_inicio', { ascending: true });

  if (opts.operarioId) {
    // festivos no tienen operario_id, incluirlos siempre
    query = query.or(`operario_id.eq.${opts.operarioId},tipo_evento.eq.festivo`);
  }
  if (opts.empresaId) {
    query = query.or(`empresa_id.eq.${opts.empresaId},empresa_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Error obteniendo planning: ${error.message}`);
  return data ?? [];
}

// ─── Helpers de validación de negocio ────────────────────────────────────────

/**
 * Lanza un error con estructura estándar si la disponibilidad está bloqueada
 * y no hay excepción justificada.
 * Usar antes de confirmar la creación de una cita.
 */
export function assertDisponibilidadOk(
  check: DisponibilidadResult,
  omitirBloqueos = false,
): void {
  if (omitirBloqueos) return;
  if (!check.disponible) {
    const primero = check.motivos_bloqueo[0];
    const err: any = new Error(
      primero?.descripcion ?? 'El operario no está disponible en la franja indicada',
    );
    err.code    = 'OPERARIO_NO_DISPONIBLE';
    err.status  = 422;
    err.details = { motivos: check.motivos_bloqueo };
    throw err;
  }
}
