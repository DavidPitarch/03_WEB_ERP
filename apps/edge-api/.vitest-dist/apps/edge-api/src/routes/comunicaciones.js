import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
export const comunicacionesRoutes = new Hono();
// POST /comunicaciones — Crear nota interna u otra comunicación
comunicacionesRoutes.post('/', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    if (!body.expediente_id || !body.contenido) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'expediente_id y contenido requeridos' } }, 422);
    }
    const tiposPermitidos = ['nota_interna', 'email_saliente', 'llamada', 'sms'];
    const tipo = body.tipo || 'nota_interna';
    if (!tiposPermitidos.includes(tipo)) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: `Tipo '${tipo}' no permitido` } }, 422);
    }
    // Verificar expediente existe
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id')
        .eq('id', body.expediente_id)
        .single();
    if (!exp) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
    }
    // Obtener nombre del actor
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('nombre, apellidos')
        .eq('id', user.id)
        .single();
    const actorNombre = profile ? `${profile.nombre} ${profile.apellidos ?? ''}`.trim() : user.email;
    const comunicacion = {
        expediente_id: body.expediente_id,
        tipo,
        asunto: body.asunto ?? null,
        contenido: body.contenido,
        actor_id: user.id,
        actor_nombre: actorNombre,
        metadata: null,
    };
    const { data, error } = await supabase.from('comunicaciones').insert(comunicacion).select().single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'comunicaciones',
            registro_id: data.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: comunicacion,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: body.expediente_id,
            aggregate_type: 'expediente',
            event_type: 'ExpedienteActualizado',
            payload: { comunicacion_id: data.id, tipo, asunto: body.asunto },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data, error: null }, 201);
});
// GET /comunicaciones?expediente_id=xxx
comunicacionesRoutes.get('/', async (c) => {
    const supabase = c.get('supabase');
    const expedienteId = c.req.query('expediente_id');
    if (!expedienteId) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'expediente_id requerido' } }, 400);
    }
    const { data, error } = await supabase
        .from('comunicaciones')
        .select('*')
        .eq('expediente_id', expedienteId)
        .order('created_at', { ascending: false });
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    return c.json({ data, error: null });
});
