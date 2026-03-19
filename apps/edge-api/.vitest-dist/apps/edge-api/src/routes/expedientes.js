import { Hono } from 'hono';
import { getRequestIp } from '../http/request-metadata';
import { createExpedienteCommand, normalizeCommandError, transitionExpedienteCommand, } from '../services/core-commands';
import { validate, validationError } from '../validation/schema';
export const expedientesRoutes = new Hono();
// GET /expedientes - Listado paginado con filtros
expedientesRoutes.get('/', async (c) => {
    const supabase = c.get('supabase');
    const page = parseInt(c.req.query('page') ?? '1');
    const perPage = Math.min(parseInt(c.req.query('per_page') ?? '20'), 100);
    const estado = c.req.query('estado');
    const companiaId = c.req.query('compania_id');
    const operarioId = c.req.query('operario_id');
    const search = c.req.query('search');
    const prioridad = c.req.query('prioridad');
    let query = supabase
        .from('expedientes')
        .select('*, companias(nombre, codigo), asegurados(nombre, apellidos, telefono), operarios(nombre, apellidos)', { count: 'exact' });
    if (estado)
        query = query.eq('estado', estado);
    if (companiaId)
        query = query.eq('compania_id', companiaId);
    if (operarioId)
        query = query.eq('operario_id', operarioId);
    if (prioridad)
        query = query.eq('prioridad', prioridad);
    if (search) {
        query = query.or(`numero_expediente.ilike.%${search}%,descripcion.ilike.%${search}%,numero_siniestro_cia.ilike.%${search}%`);
    }
    const from = (page - 1) * perPage;
    query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);
    const { data, error, count } = await query;
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({
        data: {
            items: data,
            total: count ?? 0,
            page,
            per_page: perPage,
            total_pages: Math.ceil((count ?? 0) / perPage),
        },
        error: null,
    });
});
// GET /expedientes/:id - Detalle
expedientesRoutes.get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('expedientes')
        .select('*, companias(*), asegurados(*), operarios(*), peritos(*), empresas_facturadoras(*)')
        .eq('id', id)
        .single();
    if (error || !data) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
    }
    return c.json({ data, error: null });
});
// POST /expedientes - Crear expediente
expedientesRoutes.post('/', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const body = await c.req.json();
    const check = validate(body, {
        compania_id: { required: true, isUuid: true },
        empresa_facturadora_id: { required: true, isUuid: true },
        tipo_siniestro: { required: true, minLength: 1, maxLength: 60 },
        descripcion: { required: true, minLength: 1, maxLength: 2000 },
        direccion_siniestro: { required: true, minLength: 1, maxLength: 300 },
        codigo_postal: { required: true, minLength: 5, maxLength: 10 },
        localidad: { required: true, minLength: 1, maxLength: 100 },
        provincia: { required: true, minLength: 1, maxLength: 100 },
        asegurado_id: { isUuid: true },
    });
    if (!check.ok)
        return validationError(c, check.errors);
    if (!body.asegurado_id && !body.asegurado_nuevo) {
        return validationError(c, { asegurado: ['Debe indicar asegurado_id o asegurado_nuevo'] });
    }
    if (body.asegurado_nuevo) {
        const aCheck = validate(body.asegurado_nuevo, {
            nombre: { required: true, minLength: 1, maxLength: 200 },
            apellidos: { required: true, minLength: 1, maxLength: 200 },
            telefono: { required: true, minLength: 9, maxLength: 20 },
            direccion: { required: true, minLength: 1, maxLength: 300 },
            codigo_postal: { required: true, minLength: 5, maxLength: 10 },
            localidad: { required: true, minLength: 1, maxLength: 100 },
            provincia: { required: true, minLength: 1, maxLength: 100 },
        });
        if (!aCheck.ok) {
            const prefixed = {};
            for (const [k, v] of Object.entries(aCheck.errors))
                prefixed[`asegurado_nuevo.${k}`] = v;
            return validationError(c, prefixed);
        }
    }
    try {
        const data = await createExpedienteCommand(supabase, {
            ...body,
            origen: body.origen ?? 'manual',
        }, user.id, getRequestIp(c));
        return c.json({ data, error: null }, 201);
    }
    catch (error) {
        const commandError = normalizeCommandError(error);
        return c.json({
            data: null,
            error: {
                code: commandError.code,
                message: commandError.message,
                details: commandError.details,
            },
        }, commandError.status);
    }
});
// POST /expedientes/:id/transicion - Transicion de estado
expedientesRoutes.post('/:id/transicion', async (c) => {
    const supabase = c.get('adminSupabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { estado_nuevo, motivo, causa_pendiente, causa_pendiente_detalle } = await c.req.json();
    const tCheck = validate({ estado_nuevo, motivo, causa_pendiente, causa_pendiente_detalle }, {
        estado_nuevo: { required: true, minLength: 1 },
        motivo: { maxLength: 500 },
        causa_pendiente: { maxLength: 100 },
        causa_pendiente_detalle: { maxLength: 1000 },
    });
    if (!tCheck.ok)
        return validationError(c, tCheck.errors);
    try {
        const data = await transitionExpedienteCommand(supabase, {
            expediente_id: id,
            estado_nuevo,
            motivo,
            causa_pendiente,
            causa_pendiente_detalle,
        }, user.id, getRequestIp(c));
        return c.json({ data, error: null });
    }
    catch (error) {
        const commandError = normalizeCommandError(error);
        return c.json({
            data: null,
            error: {
                code: commandError.code,
                message: commandError.message,
                details: commandError.details,
            },
        }, commandError.status);
    }
});
// GET /expedientes/:id/timeline - Timeline unificada
expedientesRoutes.get('/:id/timeline', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const [comunicaciones, historial, citas] = await Promise.all([
        supabase.from('comunicaciones').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
        supabase.from('historial_estados').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
        supabase.from('citas').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
    ]);
    const timeline = [
        ...(comunicaciones.data ?? []).map((item) => ({ ...item, timeline_type: 'comunicacion' })),
        ...(historial.data ?? []).map((item) => ({ ...item, timeline_type: 'estado' })),
        ...(citas.data ?? []).map((item) => ({ ...item, timeline_type: 'cita' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return c.json({ data: timeline, error: null });
});
// GET /expedientes/:id/partes - Partes de operario del expediente
expedientesRoutes.get('/:id/partes', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('partes_operario')
        .select('*, operarios(nombre, apellidos, telefono), evidencias:evidencias(id, tipo, clasificacion, nombre_original, storage_path)')
        .eq('expediente_id', id)
        .order('created_at', { ascending: false });
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
// GET /expedientes/:id/sla - Estado SLA del expediente
expedientesRoutes.get('/:id/sla', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { calculateSlaStatus } = await import('../services/sla-engine');
    const sla = await calculateSlaStatus(supabase, id);
    return c.json({ data: sla, error: null });
});
// GET /expedientes/:id/historial - Historial de estados
expedientesRoutes.get('/:id/historial', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('expediente_id', id)
        .order('created_at', { ascending: false });
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
