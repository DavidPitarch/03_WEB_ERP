import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { hasAnyRole, PERITO_ADMIN_ROLES } from '../security/role-groups';
export const peritosRoutes = new Hono();
function err(code, message) {
    return { data: null, error: { code, message } };
}
function ensurePeritoAdmin(c) {
    const user = c.get('user');
    if (!hasAnyRole(user.roles, PERITO_ADMIN_ROLES)) {
        return c.json(err('FORBIDDEN', 'Acceso restringido a administracion de peritos'), 403);
    }
    return null;
}
/** Resolve perito row from current user */
async function getCurrentPerito(c) {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const { data } = await supabase
        .from('peritos')
        .select('*')
        .eq('user_id', user.id)
        .eq('activo', true)
        .single();
    return data;
}
// ─── GET /mis-expedientes ───
peritosRoutes.get('/mis-expedientes', async (c) => {
    const supabase = c.get('supabase');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    const estado = c.req.query('estado');
    const compania_id = c.req.query('compania_id');
    const tipo_siniestro = c.req.query('tipo_siniestro');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    let query = supabase
        .from('v_expedientes_perito')
        .select('*', { count: 'exact' })
        .eq('perito_id', perito.id);
    if (estado)
        query = query.eq('estado', estado);
    if (compania_id)
        query = query.eq('compania_id', compania_id);
    if (tipo_siniestro)
        query = query.eq('tipo_siniestro', tipo_siniestro);
    if (fecha_desde)
        query = query.gte('fecha_encargo', fecha_desde);
    if (fecha_hasta)
        query = query.lte('fecha_encargo', fecha_hasta);
    const from = (page - 1) * perPage;
    query = query.order('fecha_encargo', { ascending: false }).range(from, from + perPage - 1);
    const { data, error, count } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
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
// ─── GET /expedientes/:id ───
peritosRoutes.get('/expedientes/:id', async (c) => {
    const supabase = c.get('supabase');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('expedientes')
        .select('*, asegurados(*), companias(*), citas(*), partes_operario(*)')
        .eq('id', id)
        .eq('perito_id', perito.id)
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Expediente no encontrado o no asignado'), 404);
    return c.json({ data, error: null });
});
// ─── GET /dictamenes ───
peritosRoutes.get('/dictamenes', async (c) => {
    const supabase = c.get('supabase');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    const estado = c.req.query('estado');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    let query = supabase
        .from('dictamenes_periciales')
        .select('*, expedientes(numero_expediente)', { count: 'exact' })
        .eq('perito_id', perito.id);
    if (estado)
        query = query.eq('estado', estado);
    if (fecha_desde)
        query = query.gte('fecha_inspeccion', fecha_desde);
    if (fecha_hasta)
        query = query.lte('fecha_inspeccion', fecha_hasta);
    const from = (page - 1) * perPage;
    query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);
    const { data, error, count } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
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
// ─── GET /dictamenes/:id ───
peritosRoutes.get('/dictamenes/:id', async (c) => {
    const supabase = c.get('supabase');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('dictamenes_periciales')
        .select('*, evidencias_dictamen(*), expedientes(numero_expediente, estado, tipo_siniestro, descripcion)')
        .eq('id', id)
        .eq('perito_id', perito.id)
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    return c.json({ data, error: null });
});
// ─── POST /dictamenes ───
peritosRoutes.post('/dictamenes', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const body = await c.req.json();
    if (!body.expediente_id)
        return c.json(err('VALIDATION', 'expediente_id es requerido'), 422);
    // Validate perito is assigned to this expediente
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id, perito_id')
        .eq('id', body.expediente_id)
        .eq('perito_id', perito.id)
        .single();
    if (!exp)
        return c.json(err('NOT_ASSIGNED', 'Perito no asignado a este expediente'), 403);
    // Auto-generate numero_dictamen: DIC-YYYY-NNNNN
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from('dictamenes_periciales')
        .select('id', { count: 'exact', head: true })
        .like('numero_dictamen', `DIC-${year}-%`);
    const seq = ((count ?? 0) + 1).toString().padStart(5, '0');
    const numero_dictamen = `DIC-${year}-${seq}`;
    const { data, error } = await supabase
        .from('dictamenes_periciales')
        .insert({
        expediente_id: body.expediente_id,
        perito_id: perito.id,
        numero_dictamen,
        fecha_inspeccion: body.fecha_inspeccion ?? null,
        tipo_dano: body.tipo_dano ?? null,
        causa_dano: body.causa_dano ?? null,
        valoracion_danos: body.valoracion_danos ?? 0,
        valoracion_reparacion: body.valoracion_reparacion ?? 0,
        cobertura_aplicable: body.cobertura_aplicable ?? null,
        observaciones: body.observaciones ?? null,
        recomendaciones: body.recomendaciones ?? null,
        estado: 'borrador',
    })
        .select()
        .single();
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await insertAudit(supabase, {
        tabla: 'dictamenes_periciales',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: body,
    });
    return c.json({ data, error: null }, 201);
});
// ─── PUT /dictamenes/:id ───
peritosRoutes.put('/dictamenes/:id', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const id = c.req.param('id');
    const body = await c.req.json();
    // Check dictamen belongs to perito and is borrador
    const { data: existing } = await supabase
        .from('dictamenes_periciales')
        .select('id, estado, perito_id')
        .eq('id', id)
        .eq('perito_id', perito.id)
        .single();
    if (!existing)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    if (existing.estado !== 'borrador')
        return c.json(err('ESTADO_INVALIDO', 'Solo se pueden editar dictámenes en borrador'), 422);
    // Prevent updating protected fields
    delete body.id;
    delete body.perito_id;
    delete body.expediente_id;
    delete body.numero_dictamen;
    delete body.estado;
    delete body.emitido_at;
    const { data, error } = await supabase
        .from('dictamenes_periciales')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await insertAudit(supabase, {
        tabla: 'dictamenes_periciales',
        registro_id: id,
        accion: 'UPDATE',
        actor_id: user.id,
        cambios: body,
    });
    return c.json({ data, error: null });
});
// ─── POST /dictamenes/:id/emitir ───
peritosRoutes.post('/dictamenes/:id/emitir', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const id = c.req.param('id');
    const { data: dictamen } = await supabase
        .from('dictamenes_periciales')
        .select('id, estado, perito_id, expediente_id')
        .eq('id', id)
        .eq('perito_id', perito.id)
        .single();
    if (!dictamen)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    if (dictamen.estado !== 'borrador')
        return c.json(err('ESTADO_INVALIDO', 'Solo se pueden emitir dictámenes en borrador'), 422);
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('dictamenes_periciales')
        .update({ estado: 'emitido', emitido_at: now, updated_at: now })
        .eq('id', id)
        .select()
        .single();
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    // Insert domain event
    await insertDomainEvent(supabase, {
        aggregate_id: id,
        aggregate_type: 'dictamen',
        event_type: 'DictamenEmitido',
        payload: { dictamen_id: id, expediente_id: dictamen.expediente_id, perito_id: perito.id },
        actor_id: user.id,
    });
    await insertAudit(supabase, {
        tabla: 'dictamenes_periciales',
        registro_id: id,
        accion: 'UPDATE',
        actor_id: user.id,
        cambios: { estado: 'emitido', emitido_at: now },
    });
    // If expediente was PENDIENTE_PERITO, clear it
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id, estado')
        .eq('id', dictamen.expediente_id)
        .single();
    if (exp && exp.estado === 'PENDIENTE_PERITO') {
        await supabase
            .from('expedientes')
            .update({ estado: 'EN_CURSO', updated_at: now })
            .eq('id', dictamen.expediente_id);
    }
    return c.json({ data, error: null });
});
// ─── POST /dictamenes/:id/evidencias ───
peritosRoutes.post('/dictamenes/:id/evidencias', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const perito = await getCurrentPerito(c);
    if (!perito)
        return c.json(err('NOT_PERITO', 'Usuario no es perito activo'), 403);
    const dictamen_id = c.req.param('id');
    // Verify dictamen belongs to perito
    const { data: dictamen } = await supabase
        .from('dictamenes_periciales')
        .select('id, perito_id')
        .eq('id', dictamen_id)
        .eq('perito_id', perito.id)
        .single();
    if (!dictamen)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    const body = await c.req.json();
    if (!body.storage_path || !body.nombre_original) {
        return c.json(err('VALIDATION', 'storage_path y nombre_original son requeridos'), 422);
    }
    const { data, error } = await supabase
        .from('evidencias_dictamen')
        .insert({
        dictamen_id,
        storage_path: body.storage_path,
        nombre_original: body.nombre_original,
        clasificacion: body.clasificacion ?? 'contexto',
        notas: body.notas ?? null,
    })
        .select()
        .single();
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await insertAudit(supabase, {
        tabla: 'evidencias_dictamen',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: body,
    });
    return c.json({ data, error: null }, 201);
});
// ─── Admin: GET / — List all peritos ───
peritosRoutes.get('/', async (c) => {
    const guard = ensurePeritoAdmin(c);
    if (guard)
        return guard;
    const supabase = c.get('supabase');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    const search = c.req.query('search');
    const activo = c.req.query('activo');
    let query = supabase
        .from('peritos')
        .select('*', { count: 'exact' });
    if (activo !== undefined)
        query = query.eq('activo', activo === 'true');
    if (search) {
        query = query.or(`nombre.ilike.%${search}%,apellidos.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const from = (page - 1) * perPage;
    query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);
    const { data, error, count } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
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
// ─── Admin: POST / — Create perito ───
peritosRoutes.post('/', async (c) => {
    const guard = ensurePeritoAdmin(c);
    if (guard)
        return guard;
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    if (!body.nombre || !body.user_id) {
        return c.json(err('VALIDATION', 'nombre y user_id son requeridos'), 422);
    }
    const { data, error } = await supabase
        .from('peritos')
        .insert(body)
        .select()
        .single();
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await insertAudit(supabase, {
        tabla: 'peritos',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: body,
    });
    return c.json({ data, error: null }, 201);
});
// ─── Admin: PUT /:id — Update perito ───
peritosRoutes.put('/:id', async (c) => {
    const guard = ensurePeritoAdmin(c);
    if (guard)
        return guard;
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase
        .from('peritos')
        .update(body)
        .eq('id', id)
        .select()
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Perito no encontrado'), 404);
    await insertAudit(supabase, {
        tabla: 'peritos',
        registro_id: id,
        accion: 'UPDATE',
        actor_id: user.id,
        cambios: body,
    });
    return c.json({ data, error: null });
});
// ─── Admin: Assign perito to expediente ───
peritosRoutes.put('/asignar-expediente/:expedienteId', async (c) => {
    const guard = ensurePeritoAdmin(c);
    if (guard)
        return guard;
    const supabase = c.get('supabase');
    const user = c.get('user');
    const expedienteId = c.req.param('expedienteId');
    const { perito_id } = await c.req.json();
    const { data, error } = await supabase
        .from('expedientes')
        .update({ perito_id, updated_at: new Date().toISOString() })
        .eq('id', expedienteId)
        .select()
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Expediente no encontrado'), 404);
    await insertAudit(supabase, {
        tabla: 'expedientes',
        registro_id: expedienteId,
        accion: 'UPDATE',
        actor_id: user.id,
        cambios: { perito_id },
    });
    return c.json({ data, error: null });
});
