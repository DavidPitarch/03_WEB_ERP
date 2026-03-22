/**
 * Motor de disponibilidad para Autocita.
 *
 * Genera huecos candidatos para un expediente dado, aplicando:
 *   - Zona CP del operario vs CP del siniestro
 *   - Especialidad (gremio) del operario vs tipo_siniestro
 *   - Festivos (cal_festivos) via cal_check_operario_disponible
 *   - Ausencias de operario (cal_ausencias)
 *   - Capacidad: no más de MAX_CITAS_POR_FRANJA citas en ese hueco
 *   - Ventana SLA: slots antes de (fecha_limite_sla - buffer_sla_h)
 *   - Margen mínimo de aviso: slot.fecha >= hoy + margen_aviso_h
 */
const MAX_CITAS_POR_FRANJA = 1; // 1 cita por operario por franja (MVP)
// Franjas horarias estándar generadas por defecto (se respetan las reglas del calendario)
const FRANJAS_DEFAULT = [
    { inicio: '09:00', fin: '11:00' },
    { inicio: '11:00', fin: '13:00' },
    { inicio: '15:00', fin: '17:00' },
    { inicio: '17:00', fin: '19:00' },
];
function addDays(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}
function toDateString(date) {
    return date.toISOString().slice(0, 10);
}
function isDayOfWeek(date, allowedDays) {
    // getUTCDay(): 0=Sunday … 6=Saturday
    return allowedDays.includes(date.getUTCDay());
}
/** Checks if a given operario+date+franja is available using the existing DB function. */
async function checkOperarioDisponible(supabase, params) {
    const { data, error } = await supabase.rpc('cal_check_operario_disponible', {
        p_operario_id: params.operarioId,
        p_fecha: params.fecha,
        p_franja_ini: params.franjaInicio,
        p_franja_fin: params.franjaFin,
        p_empresa_id: params.empresaId ?? null,
        p_provincia: params.provincia ?? null,
        p_comunidad: params.comunidad ?? null,
    });
    if (error || !data)
        return false;
    return Boolean(data.disponible);
}
/** Returns the count of non-cancelled citas for an operario on a given date+franja. */
async function countCitasEnFranja(supabase, operarioId, fecha, franjaInicio, franjaFin) {
    const { count } = await supabase
        .from('citas')
        .select('id', { count: 'exact', head: true })
        .eq('operario_id', operarioId)
        .eq('fecha', fecha)
        .eq('franja_inicio', franjaInicio)
        .eq('franja_fin', franjaFin)
        .not('estado', 'in', '(cancelada,no_show)');
    return count ?? 0;
}
export async function computeAvailableSlots(params) {
    const { supabase, operarioId, operarioZonasCp, operarioGremios, expedienteCodigoPostal, expedienteTipoSiniestro, slaFechaLimite, maxSlots, diasMaxSeleccion, margenAvisoH, bufferSlaH, expedienteEmpresaId, expedienteProvincia, expedienteComunidad, } = params;
    // Verify CP zone match (prefix match — operario CP may be a prefix like '08' or '28')
    const cpMatch = operarioZonasCp.length === 0 || operarioZonasCp.some((zona) => {
        return expedienteCodigoPostal.startsWith(zona) || zona.startsWith(expedienteCodigoPostal.slice(0, 2));
    });
    if (!cpMatch)
        return [];
    // Verify specialty match
    const gremioMatch = operarioGremios.length === 0 || operarioGremios.some((g) => expedienteTipoSiniestro.toLowerCase().includes(g.toLowerCase()) ||
        g.toLowerCase().includes(expedienteTipoSiniestro.toLowerCase()));
    if (!gremioMatch)
        return [];
    const now = new Date();
    const minStart = new Date(now.getTime() + margenAvisoH * 60 * 60 * 1000);
    const maxEnd = slaFechaLimite
        ? new Date(new Date(slaFechaLimite).getTime() - bufferSlaH * 60 * 60 * 1000)
        : addDays(now, diasMaxSeleccion);
    const windowEnd = new Date(Math.min(addDays(now, diasMaxSeleccion).getTime(), maxEnd.getTime()));
    const slots = [];
    let cursor = new Date(minStart);
    cursor.setUTCHours(0, 0, 0, 0);
    // Allowed days: L-V (1–5), no weekends
    const allowedDays = [1, 2, 3, 4, 5];
    while (cursor <= windowEnd && slots.length < maxSlots) {
        const dateStr = toDateString(cursor);
        if (!isDayOfWeek(cursor, allowedDays)) {
            cursor = addDays(cursor, 1);
            continue;
        }
        for (const franja of FRANJAS_DEFAULT) {
            if (slots.length >= maxSlots)
                break;
            // Skip if franja start is before the minimum notice window
            const franjaDateTime = new Date(`${dateStr}T${franja.inicio}:00Z`);
            if (franjaDateTime < minStart)
                continue;
            // Skip if franja start is after the SLA window
            if (franjaDateTime > windowEnd)
                continue;
            // Check calendar availability (festivos, ausencias, horario)
            const disponible = await checkOperarioDisponible(supabase, {
                operarioId,
                fecha: dateStr,
                franjaInicio: franja.inicio,
                franjaFin: franja.fin,
                empresaId: expedienteEmpresaId,
                provincia: expedienteProvincia,
                comunidad: expedienteComunidad,
            });
            if (!disponible)
                continue;
            // Check capacity
            const citasCount = await countCitasEnFranja(supabase, operarioId, dateStr, franja.inicio, franja.fin);
            if (citasCount >= MAX_CITAS_POR_FRANJA)
                continue;
            // Determine if this slot triggers an SLA alert (within 48h of limit)
            const alertaSla = slaFechaLimite
                ? franjaDateTime.getTime() > new Date(slaFechaLimite).getTime() - 2 * 24 * 60 * 60 * 1000
                : false;
            slots.push({
                id: `${operarioId}-${dateStr}-${franja.inicio}`,
                operario_id: operarioId,
                fecha: dateStr,
                franja_inicio: franja.inicio,
                franja_fin: franja.fin,
                alerta_sla: alertaSla,
            });
        }
        cursor = addDays(cursor, 1);
    }
    return slots;
}
/** Validates that a given slot (by operario+fecha+franja) is still available at the moment of selection. */
export async function validateSlotStillAvailable(supabase, params) {
    const disponible = await checkOperarioDisponible(supabase, {
        operarioId: params.operarioId,
        fecha: params.fecha,
        franjaInicio: params.franjaInicio,
        franjaFin: params.franjaFin,
        empresaId: params.empresaId,
        provincia: params.provincia,
        comunidad: params.comunidad,
    });
    if (!disponible)
        return { ok: false, reason: 'OPERARIO_NO_DISPONIBLE' };
    const count = await countCitasEnFranja(supabase, params.operarioId, params.fecha, params.franjaInicio, params.franjaFin);
    if (count >= MAX_CITAS_POR_FRANJA)
        return { ok: false, reason: 'SLOT_LLENO' };
    return { ok: true };
}
/**
 * Parses a composite slot ID (operario_id-fecha-franja_inicio) back into its parts.
 * Returns null if the format is invalid.
 */
export function parseSlotId(slotId) {
    // Format: {uuid}-{YYYY-MM-DD}-{HH:MM}
    // UUID is 36 chars, then '-', then date (10 chars), then '-', then time (5 chars)
    const uuidLen = 36;
    if (slotId.length < uuidLen + 1 + 10 + 1 + 5)
        return null;
    const operarioId = slotId.slice(0, uuidLen);
    const rest = slotId.slice(uuidLen + 1); // skip '-'
    const fecha = rest.slice(0, 10);
    const franjaInicio = rest.slice(11); // skip '-'
    if (!operarioId || !fecha || !franjaInicio)
        return null;
    return { operarioId, fecha, franjaInicio };
}
/** Resolves the end time for a franja given the start time using the default catalog. */
export function resolveFranjaFin(franjaInicio) {
    const found = FRANJAS_DEFAULT.find((f) => f.inicio === franjaInicio);
    return found?.fin ?? null;
}
