import type { SupabaseClient } from '@supabase/supabase-js';
import { getFestivosParaSla } from './calendario';

// ─── Types ──────────────────────────────────────────────────────────

export interface SlaPausa {
  estado: string;
  inicio: string;
  fin: string | null;
  duracion_ms: number;
}

export interface SlaStatus {
  fecha_limite: string | null;
  tiempo_total_ms: number;
  tiempo_suspendido_ms: number;
  tiempo_efectivo_ms: number;
  porcentaje_consumido: number;
  estado_sla: 'ok' | 'warning' | 'critical' | 'vencido' | 'sin_sla';
  pausas: SlaPausa[];
}

// ─── Constants ──────────────────────────────────────────────────────

const MS_PER_BUSINESS_HOUR = 60 * 60 * 1000;
const BUSINESS_HOURS_PER_DAY = 8;
const MS_PER_BUSINESS_DAY = BUSINESS_HOURS_PER_DAY * MS_PER_BUSINESS_HOUR;

// ─── Helpers ────────────────────────────────────────────────────────

/** Returns a date string YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Check if a given date falls on a weekend (Saturday=6, Sunday=0) */
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Count business days between two dates, excluding weekends and festivos.
 * Both `desde` and `hasta` are inclusive.
 */
function countBusinessDays(desde: Date, hasta: Date, festivoSet: Set<string>): number {
  let count = 0;
  const current = new Date(desde);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(hasta);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    if (!isWeekend(current) && !festivoSet.has(toDateStr(current))) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

/**
 * Convert calendar milliseconds to effective business milliseconds.
 * Takes a span of calendar time and scales it to only count business-day hours.
 */
function calendarMsToBusinessMs(
  startDate: Date,
  calendarMs: number,
  festivoSet: Set<string>,
): number {
  if (calendarMs <= 0) return 0;

  const endDate = new Date(startDate.getTime() + calendarMs);
  const totalCalendarDays = Math.ceil(calendarMs / (24 * 60 * 60 * 1000)) || 1;
  const businessDays = countBusinessDays(startDate, endDate, festivoSet);

  if (totalCalendarDays === 0) return 0;

  // Proportion of days that are business days, applied to actual ms
  const ratio = businessDays / totalCalendarDays;
  // Scale to 8h/day instead of 24h/day
  return Math.round(calendarMs * ratio * (BUSINESS_HOURS_PER_DAY / 24));
}

// ─── Main functions ─────────────────────────────────────────────────

/**
 * Calculate the full SLA status for an expediente.
 */
export async function calculateSlaStatus(
  supabase: SupabaseClient,
  expedienteId: string,
): Promise<SlaStatus> {
  const now = new Date();

  // 1. Fetch expediente
  const { data: exp, error: expError } = await supabase
    .from('expedientes')
    .select('fecha_encargo, fecha_limite_sla, estado')
    .eq('id', expedienteId)
    .single();

  if (expError || !exp) {
    throw new Error(`Expediente ${expedienteId} no encontrado`);
  }

  const fechaEncargo = new Date(exp.fecha_encargo);
  const fechaLimiteSla = exp.fecha_limite_sla ? new Date(exp.fecha_limite_sla) : null;
  let fechaFin = now;

  if (['FINALIZADO', 'FACTURADO', 'COBRADO', 'CERRADO', 'CANCELADO'].includes(exp.estado)) {
    const { data: cierre } = await supabase
      .from('historial_estados')
      .select('created_at')
      .eq('expediente_id', expedienteId)
      .in('estado_nuevo', ['FINALIZADO', 'FACTURADO', 'COBRADO', 'CERRADO', 'CANCELADO'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cierre?.created_at) {
      fechaFin = new Date(cierre.created_at);
    }
  }

  // 2. Fetch pausas
  const { data: pausasRaw } = await supabase
    .from('sla_pausas')
    .select('estado_pausa, inicio, fin')
    .eq('expediente_id', expedienteId)
    .order('inicio', { ascending: true });

  const pausas: SlaPausa[] = (pausasRaw ?? []).map((p: any) => {
    const inicio = new Date(p.inicio);
    const fin = p.fin ? new Date(p.fin) : now;
    return {
      estado: p.estado_pausa,
      inicio: p.inicio,
      fin: p.fin,
      duracion_ms: fin.getTime() - inicio.getTime(),
    };
  });

  // 3. Fetch festivos (calendario_laboral + cal_festivos multi-ámbito)
  const festivos = await getFestivosParaSla(
    supabase,
    toDateStr(fechaEncargo),
    toDateStr(fechaFin),
  );
  const festivoSet = new Set(festivos);

  // 4. Calculate times
  const tiempoTotalMs = fechaFin.getTime() - fechaEncargo.getTime();
  const tiempoSuspendidoMs = pausas.reduce((sum, p) => sum + p.duracion_ms, 0);
  const calendarEffectiveMs = tiempoTotalMs - tiempoSuspendidoMs;

  // Convert to business time (only working days, 8h/day)
  const tiempoEfectivoMs = calendarMsToBusinessMs(fechaEncargo, calendarEffectiveMs, festivoSet);

  // 5. Determine SLA percentage and status
  let porcentajeConsumido = 0;
  let estadoSla: SlaStatus['estado_sla'] = 'sin_sla';

  if (fechaLimiteSla) {
    const slaLimitMs = calendarMsToBusinessMs(
      fechaEncargo,
      fechaLimiteSla.getTime() - fechaEncargo.getTime(),
      festivoSet,
    );

    if (slaLimitMs > 0) {
      porcentajeConsumido = Math.round((tiempoEfectivoMs / slaLimitMs) * 10000) / 100;
    }

    if (porcentajeConsumido > 100) estadoSla = 'vencido';
    else if (porcentajeConsumido >= 90) estadoSla = 'critical';
    else if (porcentajeConsumido >= 75) estadoSla = 'warning';
    else estadoSla = 'ok';
  }

  return {
    fecha_limite: exp.fecha_limite_sla ?? null,
    tiempo_total_ms: tiempoTotalMs,
    tiempo_suspendido_ms: tiempoSuspendidoMs,
    tiempo_efectivo_ms: tiempoEfectivoMs,
    porcentaje_consumido: porcentajeConsumido,
    estado_sla: estadoSla,
    pausas,
  };
}

/**
 * Register an SLA pause for an expediente.
 */
export async function registerSlaPause(
  supabase: SupabaseClient,
  expedienteId: string,
  estadoPausa: string,
  motivo?: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('sla_pausas')
    .insert({
      expediente_id: expedienteId,
      estado_pausa: estadoPausa,
      inicio: new Date().toISOString(),
      fin: null,
      motivo: motivo ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Error registrando pausa SLA: ${error.message}`);
  return { id: data.id };
}

/**
 * Close any open SLA pause for an expediente (sets fin = NOW()).
 */
export async function closeSlaPause(
  supabase: SupabaseClient,
  expedienteId: string,
): Promise<{ closed: number }> {
  const { data, error } = await supabase
    .from('sla_pausas')
    .update({ fin: new Date().toISOString() })
    .eq('expediente_id', expedienteId)
    .is('fin', null)
    .select('id');

  if (error) throw new Error(`Error cerrando pausa SLA: ${error.message}`);
  return { closed: data?.length ?? 0 };
}

/**
 * Get festivo dates from calendario_laboral within a date range.
 * Returns an array of date strings (YYYY-MM-DD).
 */
export async function getCalendarioLaboral(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('calendario_laboral')
    .select('fecha')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .neq('tipo', 'laborable');

  if (error) throw new Error(`Error consultando calendario laboral: ${error.message}`);
  return (data ?? []).map((r: any) => r.fecha);
}
