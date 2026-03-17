import { Hono } from 'hono';
import { canTransition, validateTransitionPreconditions } from '@erp/domain';
import { insertAudit, insertHistorialEstado, insertDomainEvent } from '../services/audit';
import { registerSlaPause, closeSlaPause } from '../services/sla-engine';
export const expedientesRoutes = new Hono();
// GET /expedientes — Listado paginado con filtros
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
// GET /expedientes/:id — Detalle
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
// POST /expedientes — Crear expediente
expedientesRoutes.post('/', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    // Validación de campos obligatorios
    const required = ['compania_id', 'empresa_facturadora_id', 'tipo_siniestro', 'descripcion', 'direccion_siniestro', 'codigo_postal', 'localidad', 'provincia'];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: `Campos requeridos: ${missing.join(', ')}` } }, 422);
    }
    if (!body.asegurado_id && !body.asegurado_nuevo) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'Debe indicar asegurado_id o asegurado_nuevo' } }, 422);
    }
    // Resolver asegurado
    let aseguradoId = body.asegurado_id;
    if (!aseguradoId && body.asegurado_nuevo) {
        const an = body.asegurado_nuevo;
        if (!an.nombre || !an.apellidos || !an.telefono || !an.direccion || !an.codigo_postal || !an.localidad || !an.provincia) {
            return c.json({ data: null, error: { code: 'VALIDATION', message: 'Datos del asegurado incompletos' } }, 422);
        }
        const { data: newAseg, error: asegErr } = await supabase.from('asegurados').insert({
            nombre: an.nombre, apellidos: an.apellidos, telefono: an.telefono,
            telefono2: an.telefono2 ?? null, email: an.email ?? null, nif: an.nif ?? null,
            direccion: an.direccion, codigo_postal: an.codigo_postal, localidad: an.localidad, provincia: an.provincia,
        }).select('id').single();
        if (asegErr || !newAseg) {
            return c.json({ data: null, error: { code: 'DB_ERROR', message: 'Error al crear asegurado' } }, 500);
        }
        aseguradoId = newAseg.id;
    }
    // Generar número de expediente
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from('expedientes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`);
    const seq = String((count ?? 0) + 1).padStart(5, '0');
    const numero = `EXP-${year}-${seq}`;
    const expediente = {
        numero_expediente: numero,
        estado: 'NUEVO',
        compania_id: body.compania_id,
        empresa_facturadora_id: body.empresa_facturadora_id,
        asegurado_id: aseguradoId,
        tipo_siniestro: body.tipo_siniestro,
        descripcion: body.descripcion,
        direccion_siniestro: body.direccion_siniestro,
        codigo_postal: body.codigo_postal,
        localidad: body.localidad,
        provincia: body.provincia,
        numero_poliza: body.numero_poliza ?? null,
        numero_siniestro_cia: body.numero_siniestro_cia ?? null,
        prioridad: body.prioridad ?? 'media',
        fecha_encargo: new Date().toISOString(),
        fecha_limite_sla: body.fecha_limite_sla ?? null,
        origen: body.origen ?? 'manual',
        referencia_externa: body.referencia_externa ?? null,
    };
    const { data, error } = await supabase.from('expedientes').insert(expediente).select().single();
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    // Auditoría + historial + evento
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'expedientes',
            registro_id: data.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: expediente,
        }),
        insertHistorialEstado(supabase, {
            expediente_id: data.id,
            estado_anterior: null,
            estado_nuevo: 'NUEVO',
            actor_id: user.id,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: data.id,
            aggregate_type: 'expediente',
            event_type: 'ExpedienteCreado',
            payload: { numero_expediente: numero, tipo_siniestro: expediente.tipo_siniestro, origen: expediente.origen },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data, error: null }, 201);
});
// POST /expedientes/:id/transicion — Transición de estado
expedientesRoutes.post('/:id/transicion', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { estado_nuevo, motivo, causa_pendiente, causa_pendiente_detalle } = await c.req.json();
    // Obtener estado actual
    const { data: exp } = await supabase
        .from('expedientes')
        .select('id, estado')
        .eq('id', id)
        .single();
    if (!exp) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
    }
    const estadoActual = exp.estado;
    // Validar transición
    if (!canTransition(estadoActual, estado_nuevo)) {
        return c.json({
            data: null,
            error: { code: 'INVALID_TRANSITION', message: `Transición no permitida: ${estadoActual} → ${estado_nuevo}` },
        }, 422);
    }
    // Precondiciones
    if (['FINALIZADO', 'FACTURADO', 'COBRADO'].includes(estado_nuevo)) {
        const [partesRes, facturasRes, pagosRes] = await Promise.all([
            supabase.from('partes_operario').select('id', { count: 'exact', head: true }).eq('expediente_id', id).eq('validado', true),
            supabase.from('facturas').select('id', { count: 'exact', head: true }).eq('expediente_id', id).neq('estado', 'anulada'),
            supabase.from('pagos').select('pagos.id, facturas!inner(expediente_id)', { count: 'exact', head: true }).eq('facturas.expediente_id', id),
        ]);
        const result = validateTransitionPreconditions(estadoActual, estado_nuevo, {
            tiene_parte_validado: (partesRes.count ?? 0) > 0,
            tiene_factura: (facturasRes.count ?? 0) > 0,
            tiene_cobro: (pagosRes.count ?? 0) > 0,
        });
        if (!result.valid) {
            return c.json({ data: null, error: { code: 'PRECONDITION_FAILED', message: result.error } }, 422);
        }
    }
    // Ejecutar transición
    const updateData = { estado: estado_nuevo };
    if (causa_pendiente)
        updateData.causa_pendiente = causa_pendiente;
    if (causa_pendiente_detalle)
        updateData.causa_pendiente_detalle = causa_pendiente_detalle;
    // Clear causa_pendiente when leaving a PENDIENTE state
    if (!estado_nuevo.startsWith('PENDIENTE')) {
        updateData.causa_pendiente = null;
        updateData.causa_pendiente_detalle = null;
    }
    const { error } = await supabase
        .from('expedientes')
        .update(updateData)
        .eq('id', id);
    if (error) {
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }
    // SLA pause/resume: entering PENDIENTE* pauses SLA, leaving resumes
    if (estado_nuevo.startsWith('PENDIENTE') && !estadoActual.startsWith('PENDIENTE')) {
        await registerSlaPause(supabase, id, estado_nuevo, causa_pendiente_detalle ?? motivo);
    }
    else if (!estado_nuevo.startsWith('PENDIENTE') && estadoActual.startsWith('PENDIENTE')) {
        await closeSlaPause(supabase, id);
    }
    await Promise.all([
        insertHistorialEstado(supabase, {
            expediente_id: id,
            estado_anterior: estadoActual,
            estado_nuevo,
            motivo,
            actor_id: user.id,
        }),
        insertAudit(supabase, {
            tabla: 'expedientes',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { estado: { from: estadoActual, to: estado_nuevo } },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'expediente',
            event_type: estado_nuevo === 'FINALIZADO' ? 'ExpedienteFinalizado' : 'ExpedienteActualizado',
            payload: { estado_anterior: estadoActual, estado_nuevo, motivo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { id, estado: estado_nuevo }, error: null });
});
// GET /expedientes/:id/timeline — Timeline unificada
expedientesRoutes.get('/:id/timeline', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const [comunicaciones, historial, citas] = await Promise.all([
        supabase.from('comunicaciones').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
        supabase.from('historial_estados').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
        supabase.from('citas').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
    ]);
    // Unificar en timeline
    const timeline = [
        ...(comunicaciones.data ?? []).map((c) => ({ ...c, timeline_type: 'comunicacion' })),
        ...(historial.data ?? []).map((h) => ({ ...h, timeline_type: 'estado' })),
        ...(citas.data ?? []).map((ci) => ({ ...ci, timeline_type: 'cita' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return c.json({ data: timeline, error: null });
});
// GET /expedientes/:id/partes — Partes de operario del expediente
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
// GET /expedientes/:id/sla — Estado SLA del expediente
expedientesRoutes.get('/:id/sla', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { calculateSlaStatus } = await import('../services/sla-engine');
    const sla = await calculateSlaStatus(supabase, id);
    return c.json({ data: sla, error: null });
});
// GET /expedientes/:id/historial — Historial de estados
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
