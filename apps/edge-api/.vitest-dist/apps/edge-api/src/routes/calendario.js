/**
 * Rutas: Calendario Operativo
 *
 * Permisos:
 *   - Lectura:          OFFICE_ROLES + OPERATOR_ROLES
 *   - Escritura/admin:  ['admin', 'supervisor']
 *   - Aprobación:       ['admin', 'supervisor']
 */
import { Hono } from 'hono';
import { validate, validationError } from '../validation/schema';
import { checkDisponibilidad, aprobarAusencia, rechazarAusencia, getPlanningRange, } from '../services/calendario';
export const calendarioRoutes = new Hono();
// ─── Helpers ─────────────────────────────────────────────────────────────────
function dbError(c, err) {
    const msg = err instanceof Error ? err.message : String(err);
    const e = err;
    if (e?.status === 404)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: e.message } }, 404);
    if (e?.status === 422)
        return c.json({ data: null, error: { code: e.code ?? 'VALIDATION', message: e.message, details: e.details } }, 422);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: msg } }, 500);
}
const WRITE_ROLES = ['admin', 'supervisor'];
function requireWriteRole(user) {
    return WRITE_ROLES.some((r) => user.roles?.includes(r));
}
// ═══════════════════════════════════════════════════════
//  FESTIVOS
// ═══════════════════════════════════════════════════════
/** GET /calendario/festivos?ambito=&fecha_desde=&fecha_hasta=&empresa_id= */
calendarioRoutes.get('/festivos', async (c) => {
    const supabase = c.get('supabase');
    const { ambito, fecha_desde, fecha_hasta, empresa_id, comunidad_autonoma, provincia } = c.req.query();
    let q = supabase
        .from('cal_festivos')
        .select('*')
        .eq('activo', true)
        .order('fecha', { ascending: true });
    if (ambito)
        q = q.eq('ambito', ambito);
    if (fecha_desde)
        q = q.gte('fecha', fecha_desde);
    if (fecha_hasta)
        q = q.lte('fecha', fecha_hasta);
    if (empresa_id)
        q = q.eq('empresa_id', empresa_id);
    if (comunidad_autonoma)
        q = q.eq('comunidad_autonoma', comunidad_autonoma);
    if (provincia)
        q = q.eq('provincia', provincia);
    const { data, error } = await q;
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
/** POST /calendario/festivos */
calendarioRoutes.post('/festivos', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    const check = validate(body, {
        fecha: { required: true },
        nombre: { required: true, minLength: 2, maxLength: 120 },
        ambito: { required: true, isEnum: ['nacional', 'autonomico', 'provincial', 'local', 'empresa'] },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('cal_festivos')
        .insert({ ...body, created_by: user.id })
        .select()
        .single();
    if (error) {
        if (error.code === '23505')
            return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe ese festivo para ese ámbito y fecha' } }, 409);
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
/** DELETE /calendario/festivos/:id */
calendarioRoutes.delete('/festivos/:id', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const id = c.req.param('id');
    const { error } = await supabase
        .from('cal_festivos')
        .update({ activo: false })
        .eq('id', id);
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data: { deleted: true }, error: null });
});
// ═══════════════════════════════════════════════════════
//  AUSENCIAS
// ═══════════════════════════════════════════════════════
/** GET /calendario/ausencias?operario_id=&estado=&fecha_desde=&fecha_hasta= */
calendarioRoutes.get('/ausencias', async (c) => {
    const supabase = c.get('supabase');
    const { operario_id, estado, fecha_desde, fecha_hasta } = c.req.query();
    let q = supabase
        .from('cal_ausencias')
        .select('*, operarios(nombre, apellidos)')
        .order('fecha_inicio', { ascending: true });
    if (operario_id)
        q = q.eq('operario_id', operario_id);
    if (estado)
        q = q.eq('estado', estado);
    if (fecha_desde)
        q = q.gte('fecha_inicio', fecha_desde);
    if (fecha_hasta)
        q = q.lte('fecha_fin', fecha_hasta);
    const { data, error } = await q;
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
/** GET /calendario/ausencias/:id */
calendarioRoutes.get('/ausencias/:id', async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase
        .from('cal_ausencias')
        .select('*, operarios(nombre, apellidos)')
        .eq('id', c.req.param('id'))
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ausencia no encontrada' } }, 404);
    return c.json({ data, error: null });
});
/** POST /calendario/ausencias */
calendarioRoutes.post('/ausencias', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const body = await c.req.json();
    const check = validate(body, {
        operario_id: { required: true, isUuid: true },
        tipo: { required: true, isEnum: ['vacacion', 'baja_medica', 'baja_laboral', 'asunto_personal', 'permiso_retribuido', 'bloqueo'] },
        fecha_inicio: { required: true },
        fecha_fin: { required: true },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (body.fecha_fin < body.fecha_inicio) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'fecha_fin debe ser >= fecha_inicio' } }, 422);
    }
    const { data, error } = await supabase
        .from('cal_ausencias')
        .insert({
        operario_id: body.operario_id,
        tipo: body.tipo,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        motivo: body.motivo ?? null,
        created_by: user.id,
    })
        .select('*, operarios(nombre, apellidos)')
        .single();
    if (error) {
        if (error.code === 'P0001' && error.message.includes('exclusion')) {
            return c.json({ data: null, error: { code: 'SOLAPAMIENTO', message: 'Ya existe una ausencia activa que se solapa con esas fechas para este operario' } }, 409);
        }
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null }, 201);
});
/** PUT /calendario/ausencias/:id */
calendarioRoutes.put('/ausencias/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    // Solo se puede editar ausencias en estado solicitada
    const { data: current, error: fetchErr } = await supabase
        .from('cal_ausencias')
        .select('estado, created_by')
        .eq('id', id)
        .single();
    if (fetchErr || !current)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ausencia no encontrada' } }, 404);
    if (current.estado !== 'solicitada') {
        return c.json({ data: null, error: { code: 'ESTADO_INVALIDO', message: 'Solo se pueden modificar ausencias en estado solicitada' } }, 422);
    }
    // Solo el creador o admin/supervisor puede editar
    const isOwner = current.created_by === user.id;
    const isPrivileged = requireWriteRole(user);
    if (!isOwner && !isPrivileged) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No tienes permiso para editar esta ausencia' } }, 403);
    }
    const allowed = ['fecha_inicio', 'fecha_fin', 'motivo'];
    const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    if (updates.fecha_fin && updates.fecha_inicio && updates.fecha_fin < updates.fecha_inicio) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'fecha_fin debe ser >= fecha_inicio' } }, 422);
    }
    const { data, error } = await supabase
        .from('cal_ausencias')
        .update(updates)
        .eq('id', id)
        .select('*, operarios(nombre, apellidos)')
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
/** DELETE /calendario/ausencias/:id — cancela la ausencia */
calendarioRoutes.delete('/ausencias/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { data: current } = await supabase
        .from('cal_ausencias')
        .select('estado, created_by, sla_pausado, operario_id')
        .eq('id', id)
        .single();
    if (!current)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Ausencia no encontrada' } }, 404);
    if (!['solicitada', 'aprobada'].includes(current.estado)) {
        return c.json({ data: null, error: { code: 'ESTADO_INVALIDO', message: 'No se puede cancelar una ausencia rechazada o ya cancelada' } }, 422);
    }
    const isOwner = current.created_by === user.id;
    const isPrivileged = requireWriteRole(user);
    if (!isOwner && !isPrivileged) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No tienes permiso para cancelar esta ausencia' } }, 403);
    }
    await supabase.from('cal_ausencias').update({ estado: 'cancelada' }).eq('id', id);
    // Si había pausas SLA por esta ausencia, cerrarlas
    if (current.sla_pausado) {
        await supabase
            .from('sla_pausas')
            .update({ fin: new Date().toISOString() })
            .eq('estado_pausa', 'AUSENCIA_OPERARIO')
            .is('fin', null)
            .like('motivo', `%${id}%`);
    }
    return c.json({ data: { cancelled: true }, error: null });
});
/** PUT /calendario/ausencias/:id/aprobar */
calendarioRoutes.put('/ausencias/:id/aprobar', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    try {
        const result = await aprobarAusencia(supabase, c.req.param('id'), user.id);
        return c.json({ data: result, error: null });
    }
    catch (err) {
        return dbError(c, err);
    }
});
/** PUT /calendario/ausencias/:id/rechazar */
calendarioRoutes.put('/ausencias/:id/rechazar', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    if (!body.motivo_rechazo?.trim()) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'motivo_rechazo es requerido' } }, 422);
    }
    try {
        const result = await rechazarAusencia(supabase, c.req.param('id'), user.id, body.motivo_rechazo);
        return c.json({ data: result, error: null });
    }
    catch (err) {
        return dbError(c, err);
    }
});
// ═══════════════════════════════════════════════════════
//  GUARDIAS
// ═══════════════════════════════════════════════════════
/** GET /calendario/guardias?operario_id=&fecha_desde=&fecha_hasta=&activa= */
calendarioRoutes.get('/guardias', async (c) => {
    const supabase = c.get('supabase');
    const { operario_id, fecha_desde, fecha_hasta, activa } = c.req.query();
    let q = supabase
        .from('cal_guardias')
        .select('*, operarios(nombre, apellidos)')
        .order('fecha_inicio', { ascending: true });
    if (operario_id)
        q = q.eq('operario_id', operario_id);
    if (activa !== undefined)
        q = q.eq('activa', activa === 'true');
    if (fecha_desde)
        q = q.gte('fecha_inicio', fecha_desde);
    if (fecha_hasta)
        q = q.lte('fecha_fin', fecha_hasta);
    const { data, error } = await q;
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
/** POST /calendario/guardias */
calendarioRoutes.post('/guardias', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    const check = validate(body, {
        operario_id: { required: true, isUuid: true },
        tipo: { required: true, isEnum: ['guardia', 'reten', 'turno_especial', 'disponibilidad_ampliada'] },
        fecha_inicio: { required: true },
        fecha_fin: { required: true },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (body.fecha_fin <= body.fecha_inicio) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'fecha_fin debe ser posterior a fecha_inicio' } }, 422);
    }
    const { data, error } = await supabase
        .from('cal_guardias')
        .insert({ ...body, created_by: user.id })
        .select('*, operarios(nombre, apellidos)')
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null }, 201);
});
/** PUT /calendario/guardias/:id */
calendarioRoutes.put('/guardias/:id', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    const allowed = ['fecha_inicio', 'fecha_fin', 'zona_cp', 'especialidades', 'observaciones', 'activa'];
    const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
        .from('cal_guardias')
        .update(updates)
        .eq('id', c.req.param('id'))
        .select('*, operarios(nombre, apellidos)')
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
/** DELETE /calendario/guardias/:id — desactiva la guardia */
calendarioRoutes.delete('/guardias/:id', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const { error } = await supabase
        .from('cal_guardias')
        .update({ activa: false })
        .eq('id', c.req.param('id'));
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data: { deleted: true }, error: null });
});
// ═══════════════════════════════════════════════════════
//  REGLAS DE DISPONIBILIDAD
// ═══════════════════════════════════════════════════════
/** GET /calendario/reglas?empresa_id=&especialidad=&activa= */
calendarioRoutes.get('/reglas', async (c) => {
    const supabase = c.get('supabase');
    const { empresa_id, especialidad, activa } = c.req.query();
    let q = supabase
        .from('cal_reglas_disponibilidad')
        .select('*')
        .order('vigente_desde', { ascending: false });
    if (empresa_id)
        q = q.eq('empresa_id', empresa_id);
    if (especialidad)
        q = q.eq('especialidad', especialidad);
    if (activa !== undefined)
        q = q.eq('activa', activa === 'true');
    const { data, error } = await q;
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
/** POST /calendario/reglas */
calendarioRoutes.post('/reglas', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    const check = validate(body, {
        hora_inicio: { required: true },
        hora_fin: { required: true },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('cal_reglas_disponibilidad')
        .insert({ ...body, created_by: user.id })
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null }, 201);
});
/** PUT /calendario/reglas/:id */
calendarioRoutes.put('/reglas/:id', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    const allowed = ['dias_semana', 'hora_inicio', 'hora_fin', 'vigente_hasta', 'activa', 'descripcion', 'zona_cp', 'especialidad'];
    const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase
        .from('cal_reglas_disponibilidad')
        .update(updates)
        .eq('id', c.req.param('id'))
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
// ═══════════════════════════════════════════════════════
//  DISPONIBILIDAD (consulta antes de crear cita)
// ═══════════════════════════════════════════════════════
/**
 * GET /calendario/disponibilidad/:operario_id
 *   ?fecha=YYYY-MM-DD&franja_inicio=HH:MM&franja_fin=HH:MM
 *   &empresa_id=&provincia=&comunidad=
 */
calendarioRoutes.get('/disponibilidad/:operario_id', async (c) => {
    const supabase = c.get('supabase');
    const operarioId = c.req.param('operario_id');
    const { fecha, franja_inicio, franja_fin, empresa_id, provincia, comunidad } = c.req.query();
    if (!fecha || !franja_inicio || !franja_fin) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'Requeridos: fecha, franja_inicio, franja_fin' } }, 422);
    }
    try {
        const result = await checkDisponibilidad(supabase, operarioId, fecha, franja_inicio, franja_fin, {
            empresaId: empresa_id,
            provincia,
            comunidad,
        });
        return c.json({ data: result, error: null });
    }
    catch (err) {
        return dbError(c, err);
    }
});
// ═══════════════════════════════════════════════════════
//  PLANNING (vista unificada del calendario)
// ═══════════════════════════════════════════════════════
/**
 * GET /calendario/planning
 *   ?fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD
 *   &operario_id=&empresa_id=
 */
calendarioRoutes.get('/planning', async (c) => {
    const supabase = c.get('supabase');
    const { fecha_desde, fecha_hasta, operario_id, empresa_id } = c.req.query();
    if (!fecha_desde || !fecha_hasta) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'Requeridos: fecha_desde y fecha_hasta' } }, 422);
    }
    // Máximo 92 días por petición
    const d1 = new Date(fecha_desde);
    const d2 = new Date(fecha_hasta);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || (d2.getTime() - d1.getTime()) > 92 * 86400000) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'Rango máximo 92 días' } }, 422);
    }
    try {
        const data = await getPlanningRange(supabase, fecha_desde, fecha_hasta, { operarioId: operario_id, empresaId: empresa_id });
        return c.json({ data, error: null });
    }
    catch (err) {
        return dbError(c, err);
    }
});
// ═══════════════════════════════════════════════════════
//  EXCEPCIONES JUSTIFICADAS
// ═══════════════════════════════════════════════════════
/** POST /calendario/excepciones */
calendarioRoutes.post('/excepciones', async (c) => {
    const user = c.get('user');
    if (!requireWriteRole(user)) {
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Se requiere rol admin o supervisor' } }, 403);
    }
    const supabase = c.get('adminSupabase');
    const body = await c.req.json();
    const check = validate(body, {
        tipo_excepcion: { required: true, isEnum: ['cita_en_festivo', 'cita_en_ausencia', 'fuera_horario', 'cita_en_bloqueo'] },
        justificacion: { required: true, minLength: 10, maxLength: 500 },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    const { data, error } = await supabase
        .from('cal_excepciones')
        .insert({
        tipo_excepcion: body.tipo_excepcion,
        referencia_id: body.referencia_id ?? null,
        referencia_tabla: body.referencia_tabla ?? null,
        justificacion: body.justificacion,
        aprobada_por: user.id,
        aprobada_at: new Date().toISOString(),
        created_by: user.id,
    })
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null }, 201);
});
