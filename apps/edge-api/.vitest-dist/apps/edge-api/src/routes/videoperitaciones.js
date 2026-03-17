import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { sendEmail } from '../services/email-sender';
export const videoperitacionesRoutes = new Hono();
function err(code, message) {
    return { data: null, error: { code, message } };
}
// ═══════════════════════════════════════════════════════════════════════════
// Static routes FIRST (before /:id)
// ═══════════════════════════════════════════════════════════════════════════
// ─── GET /videoperitaciones/pendientes-contacto — Bandeja pendientes de contactar ───
videoperitacionesRoutes.get('/pendientes-contacto', async (c) => {
    const supabase = c.get('supabase');
    const prioridad = c.req.query('prioridad');
    const perito_id = c.req.query('perito_id');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    let query = supabase.from('v_vp_pendientes_contacto').select('*', { count: 'exact' });
    if (prioridad)
        query = query.eq('prioridad', prioridad);
    if (perito_id)
        query = query.eq('perito_id', perito_id);
    const from = (page - 1) * perPage;
    query = query.range(from, from + perPage - 1);
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
// ─── GET /videoperitaciones/agenda — Agenda VP ──────────────────────────────
videoperitacionesRoutes.get('/agenda', async (c) => {
    const supabase = c.get('supabase');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    const perito_id = c.req.query('perito_id');
    let query = supabase.from('v_vp_agenda').select('*');
    if (fecha_desde)
        query = query.gte('fecha', fecha_desde);
    if (fecha_hasta)
        query = query.lte('fecha', fecha_hasta);
    if (perito_id)
        query = query.eq('perito_id', perito_id);
    query = query.order('fecha', { ascending: true });
    const { data, error } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// ═══════════════════════════════════════════════════════════════════════════
// Dynamic routes
// ═══════════════════════════════════════════════════════════════════════════
// ─── GET /videoperitaciones — Listado paginado ──────────────────────────────
videoperitacionesRoutes.get('/', async (c) => {
    const supabase = c.get('supabase');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    const estado = c.req.query('estado');
    const perito_id = c.req.query('perito_id');
    const expediente_id = c.req.query('expediente_id');
    const prioridad = c.req.query('prioridad');
    const fecha_desde = c.req.query('fecha_desde');
    const fecha_hasta = c.req.query('fecha_hasta');
    let query = supabase
        .from('videoperitaciones')
        .select('*, expedientes(numero_expediente), peritos(nombre, apellidos)', { count: 'exact' });
    if (estado)
        query = query.eq('estado', estado);
    if (perito_id)
        query = query.eq('perito_id', perito_id);
    if (expediente_id)
        query = query.eq('expediente_id', expediente_id);
    if (prioridad)
        query = query.eq('prioridad', prioridad);
    if (fecha_desde)
        query = query.gte('created_at', fecha_desde);
    if (fecha_hasta)
        query = query.lte('created_at', fecha_hasta);
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
// ─── GET /videoperitaciones/:id — Detalle ───────────────────────────────────
videoperitacionesRoutes.get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data: vp, error } = await supabase
        .from('videoperitaciones')
        .select('*, expedientes(*), peritos(*)')
        .eq('id', id)
        .single();
    if (error || !vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    // Fetch related data in parallel
    const [encargos, comunicaciones, agenda, sesiones, consentimientos, artefactos] = await Promise.all([
        supabase.from('vp_encargos').select('*').eq('videoperitacion_id', id).order('created_at', { ascending: false }),
        supabase.from('vp_comunicaciones').select('*').eq('videoperitacion_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('vp_agenda').select('*').eq('videoperitacion_id', id).order('fecha', { ascending: true }),
        supabase.from('vp_sesiones').select('*').eq('videoperitacion_id', id).order('created_at', { ascending: false }),
        supabase.from('vp_consentimientos').select('*').eq('videoperitacion_id', id).order('created_at', { ascending: false }),
        supabase.from('vp_artefactos').select('*').eq('videoperitacion_id', id).order('created_at', { ascending: false }),
    ]);
    return c.json({
        data: {
            ...vp,
            encargos: encargos.data ?? [],
            comunicaciones: comunicaciones.data ?? [],
            agenda: agenda.data ?? [],
            sesiones: sesiones.data ?? [],
            consentimientos: consentimientos.data ?? [],
            artefactos: artefactos.data ?? [],
        },
        error: null,
    });
});
// ─── POST /videoperitaciones — Crear caso VP ────────────────────────────────
videoperitacionesRoutes.post('/', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    if (!body.expediente_id)
        return c.json(err('VALIDATION', 'expediente_id es requerido'), 422);
    // Generar numero_caso: VP-{year}-{seq 5 digits}
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from('videoperitaciones')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`);
    const seq = String((count ?? 0) + 1).padStart(5, '0');
    const numero_caso = `VP-${year}-${seq}`;
    const { data: vp, error: vpErr } = await supabase
        .from('videoperitaciones')
        .insert({
        expediente_id: body.expediente_id,
        perito_id: body.perito_id ?? null,
        motivo_tecnico: body.motivo_tecnico ?? null,
        prioridad: body.prioridad ?? null,
        origen: body.origen ?? null,
        referencia_externa: body.referencia_externa ?? null,
        deadline: body.deadline ?? null,
        numero_caso,
        estado: 'encargo_recibido',
    })
        .select()
        .single();
    if (vpErr)
        return c.json(err('DB_ERROR', vpErr.message), 500);
    // Insert timeline comunicacion to expediente
    await supabase.from('comunicaciones').insert({
        expediente_id: body.expediente_id,
        tipo: 'nota_interna',
        asunto: `Videoperitación ${numero_caso} creada`,
        contenido: `Se ha creado el caso de videoperitación ${numero_caso}.`,
        emisor_tipo: 'sistema',
        actor_id: user.id,
    });
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'videoperitaciones',
            registro_id: vp.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { numero_caso, expediente_id: body.expediente_id, perito_id: body.perito_id },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: vp.id,
            aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionCreada',
            payload: { numero_caso, expediente_id: body.expediente_id, perito_id: body.perito_id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: vp, error: null }, 201);
});
// ─── GET /videoperitaciones/:id/comunicaciones — Listar comunicaciones ──────
videoperitacionesRoutes.get('/:id/comunicaciones', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    const from = (page - 1) * perPage;
    const { data, error, count } = await supabase
        .from('vp_comunicaciones')
        .select('*', { count: 'exact' })
        .eq('videoperitacion_id', id)
        .order('created_at', { ascending: false })
        .range(from, from + perPage - 1);
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
// ─── POST /videoperitaciones/:id/registrar-encargo — Registrar encargo ──────
videoperitacionesRoutes.post('/:id/registrar-encargo', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.tipo || !body.contenido)
        return c.json(err('VALIDATION', 'tipo y contenido son requeridos'), 422);
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, estado')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    const { data: encargo, error: encargoErr } = await supabase
        .from('vp_encargos')
        .insert({
        videoperitacion_id: id,
        tipo: body.tipo,
        contenido: body.contenido,
        datos_estructurados: body.datos_estructurados ?? null,
        adjuntos_refs: body.adjuntos_refs ?? null,
    })
        .select()
        .single();
    if (encargoErr)
        return c.json(err('DB_ERROR', encargoErr.message), 500);
    // Update estado to 'pendiente_contacto' if still 'encargo_recibido'
    if (vp.estado === 'encargo_recibido') {
        await supabase
            .from('videoperitaciones')
            .update({ estado: 'pendiente_contacto' })
            .eq('id', id);
    }
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'vp_encargos',
            registro_id: encargo.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { tipo: body.tipo, videoperitacion_id: id },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionEncargoRecibido',
            payload: { encargo_id: encargo.id, tipo: body.tipo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: encargo, error: null }, 201);
});
// ─── POST /videoperitaciones/:id/registrar-comunicacion — Añadir comunicación ─
videoperitacionesRoutes.post('/:id/registrar-comunicacion', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.tipo || !body.contenido)
        return c.json(err('VALIDATION', 'tipo y contenido son requeridos'), 422);
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, expediente_id')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    const { data: com, error: comErr } = await supabase
        .from('vp_comunicaciones')
        .insert({
        videoperitacion_id: id,
        tipo: body.tipo,
        emisor_tipo: body.emisor_tipo ?? null,
        resultado: body.resultado ?? null,
        asunto: body.asunto ?? null,
        contenido: body.contenido,
        adjuntos_refs: body.adjuntos_refs ?? null,
    })
        .select()
        .single();
    if (comErr)
        return c.json(err('DB_ERROR', comErr.message), 500);
    // Also insert into expediente comunicaciones table for timeline
    await supabase.from('comunicaciones').insert({
        expediente_id: vp.expediente_id,
        tipo: body.tipo,
        emisor_tipo: body.emisor_tipo ?? null,
        asunto: body.asunto ?? null,
        contenido: body.contenido,
        actor_id: user.id,
    });
    await insertAudit(supabase, {
        tabla: 'vp_comunicaciones',
        registro_id: com.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: { tipo: body.tipo, videoperitacion_id: id },
    });
    return c.json({ data: com, error: null }, 201);
});
// ─── POST /videoperitaciones/:id/comunicaciones — Alias registrar-comunicacion ─
videoperitacionesRoutes.post('/:id/comunicaciones', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.tipo || !body.contenido)
        return c.json(err('VALIDATION', 'tipo y contenido son requeridos'), 422);
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, expediente_id')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    const { data: com, error: comErr } = await supabase
        .from('vp_comunicaciones')
        .insert({
        videoperitacion_id: id,
        tipo: body.tipo,
        emisor_tipo: body.emisor_tipo ?? null,
        resultado: body.resultado ?? null,
        asunto: body.asunto ?? null,
        contenido: body.contenido,
        adjuntos_refs: body.adjuntos_refs ?? null,
    })
        .select()
        .single();
    if (comErr)
        return c.json(err('DB_ERROR', comErr.message), 500);
    await supabase.from('comunicaciones').insert({
        expediente_id: vp.expediente_id,
        tipo: body.tipo,
        emisor_tipo: body.emisor_tipo ?? null,
        asunto: body.asunto ?? null,
        contenido: body.contenido,
        actor_id: user.id,
    });
    await insertAudit(supabase, {
        tabla: 'vp_comunicaciones',
        registro_id: com.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: { tipo: body.tipo, videoperitacion_id: id },
    });
    return c.json({ data: com, error: null }, 201);
});
// ─── POST /videoperitaciones/:id/registrar-intento-contacto — Intento contacto ─
videoperitacionesRoutes.post('/:id/registrar-intento-contacto', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.canal || !body.resultado)
        return c.json(err('VALIDATION', 'canal y resultado son requeridos'), 422);
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, estado')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    // Auto-increment intento_numero
    const { count } = await supabase
        .from('vp_intentos_contacto')
        .select('id', { count: 'exact', head: true })
        .eq('videoperitacion_id', id);
    const intento_numero = (count ?? 0) + 1;
    const { data: intento, error: intentoErr } = await supabase
        .from('vp_intentos_contacto')
        .insert({
        videoperitacion_id: id,
        intento_numero,
        canal: body.canal,
        resultado: body.resultado,
        notas: body.notas ?? null,
    })
        .select()
        .single();
    if (intentoErr)
        return c.json(err('DB_ERROR', intentoErr.message), 500);
    // Update VP estado to 'contactado' if resultado='contactado'
    if (body.resultado === 'contactado') {
        await supabase
            .from('videoperitaciones')
            .update({ estado: 'contactado' })
            .eq('id', id);
    }
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'vp_intentos_contacto',
            registro_id: intento.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { canal: body.canal, resultado: body.resultado, intento_numero },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionContactoIntentado',
            payload: { intento_id: intento.id, canal: body.canal, resultado: body.resultado, intento_numero },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: intento, error: null }, 201);
});
// ─── POST /videoperitaciones/:id/agendar — Agendar cita VP ─────────────────
videoperitacionesRoutes.post('/:id/agendar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.fecha || !body.hora_inicio || !body.hora_fin) {
        return c.json(err('VALIDATION', 'fecha, hora_inicio y hora_fin son requeridos'), 422);
    }
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, estado')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    const { data: agenda, error: agendaErr } = await supabase
        .from('vp_agenda')
        .insert({
        videoperitacion_id: id,
        fecha: body.fecha,
        hora_inicio: body.hora_inicio,
        hora_fin: body.hora_fin,
        notas: body.notas ?? null,
    })
        .select()
        .single();
    if (agendaErr)
        return c.json(err('DB_ERROR', agendaErr.message), 500);
    await supabase
        .from('videoperitaciones')
        .update({ estado: 'agendado' })
        .eq('id', id);
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'vp_agenda',
            registro_id: agenda.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { fecha: body.fecha, hora_inicio: body.hora_inicio, hora_fin: body.hora_fin },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionAgendada',
            payload: { agenda_id: agenda.id, fecha: body.fecha, hora_inicio: body.hora_inicio, hora_fin: body.hora_fin },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: agenda, error: null }, 201);
});
// ─── POST /videoperitaciones/:id/reprogramar — Reprogramar cita VP ──────────
videoperitacionesRoutes.post('/:id/reprogramar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.agenda_id || !body.fecha || !body.hora_inicio || !body.hora_fin) {
        return c.json(err('VALIDATION', 'agenda_id, fecha, hora_inicio y hora_fin son requeridos'), 422);
    }
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, estado')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    // Mark existing agenda as reprogramada
    const { error: updateErr } = await supabase
        .from('vp_agenda')
        .update({ estado: 'reprogramada' })
        .eq('id', body.agenda_id)
        .eq('videoperitacion_id', id);
    if (updateErr)
        return c.json(err('DB_ERROR', updateErr.message), 500);
    // Insert new agenda
    const { data: newAgenda, error: agendaErr } = await supabase
        .from('vp_agenda')
        .insert({
        videoperitacion_id: id,
        fecha: body.fecha,
        hora_inicio: body.hora_inicio,
        hora_fin: body.hora_fin,
        notas: body.motivo ? `Reprogramada: ${body.motivo}` : null,
    })
        .select()
        .single();
    if (agendaErr)
        return c.json(err('DB_ERROR', agendaErr.message), 500);
    await supabase
        .from('videoperitaciones')
        .update({ estado: 'agendado' })
        .eq('id', id);
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'vp_agenda',
            registro_id: newAgenda.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { fecha: body.fecha, hora_inicio: body.hora_inicio, hora_fin: body.hora_fin, agenda_anterior: body.agenda_id },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionReprogramada',
            payload: { agenda_anterior_id: body.agenda_id, nueva_agenda_id: newAgenda.id, fecha: body.fecha, motivo: body.motivo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: newAgenda, error: null }, 201);
});
// ─── POST /videoperitaciones/:id/cancelar — Cancelar VP ────────────────────
videoperitacionesRoutes.post('/:id/cancelar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { motivo } = await c.req.json();
    if (!motivo)
        return c.json(err('VALIDATION', 'motivo es requerido'), 422);
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, estado, numero_caso')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('videoperitaciones')
        .update({ estado: 'cancelado', cancelado_at: now, cancelado_motivo: motivo })
        .eq('id', id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    // Cancel any pending agenda entries
    await supabase
        .from('vp_agenda')
        .update({ estado: 'cancelada' })
        .eq('videoperitacion_id', id)
        .is('estado', null);
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'videoperitaciones',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { estado: 'cancelado', cancelado_at: now, cancelado_motivo: motivo },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionCancelada',
            payload: { numero_caso: vp.numero_caso, motivo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { id, estado: 'cancelado' }, error: null });
});
// ─── POST /videoperitaciones/:id/enviar-link — Enviar link externo ──────────
videoperitacionesRoutes.post('/:id/enviar-link', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.link_externo)
        return c.json(err('VALIDATION', 'link_externo es requerido'), 422);
    const { data: vp } = await supabase
        .from('videoperitaciones')
        .select('id, estado, numero_caso, expediente_id')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    // Find active agenda for this VP
    const { data: agenda } = await supabase
        .from('vp_agenda')
        .select('*')
        .eq('videoperitacion_id', id)
        .is('estado', null)
        .order('fecha', { ascending: true })
        .limit(1)
        .single();
    if (!agenda)
        return c.json(err('NO_AGENDA', 'No hay cita activa para esta videoperitación'), 422);
    const now = new Date().toISOString();
    const link_token = crypto.randomUUID();
    // Default expiration: 24h before session
    const defaultExpira = new Date(new Date(`${agenda.fecha}T${agenda.hora_inicio}`).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const link_expira_at = body.link_expira_at ?? defaultExpira;
    const { error: agendaErr } = await supabase
        .from('vp_agenda')
        .update({
        link_externo: body.link_externo,
        link_token,
        link_expira_at,
        link_enviado_at: now,
        link_reenvios: (agenda.link_reenvios ?? 0) + 1,
    })
        .eq('id', agenda.id);
    if (agendaErr)
        return c.json(err('DB_ERROR', agendaErr.message), 500);
    // Update VP estado
    await supabase
        .from('videoperitaciones')
        .update({ estado: 'link_enviado' })
        .eq('id', id);
    // Get asegurado email via expediente
    const { data: expediente } = await supabase
        .from('expedientes')
        .select('*, asegurados(email, nombre)')
        .eq('id', vp.expediente_id)
        .single();
    const aseguradoEmail = expediente?.asegurados?.email;
    const aseguradoNombre = expediente?.asegurados?.nombre ?? 'Asegurado/a';
    if (aseguradoEmail) {
        await sendEmail(c.env.RESEND_API_KEY, {
            to: aseguradoEmail,
            subject: `Enlace para su videoperitación ${vp.numero_caso}`,
            html: `
        <h2>Videoperitación ${vp.numero_caso}</h2>
        <p>Estimado/a ${aseguradoNombre},</p>
        <p>Le enviamos el enlace para conectarse a su videoperitación programada para el <strong>${agenda.fecha}</strong> a las <strong>${agenda.hora_inicio}</strong>.</p>
        <p><a href="${body.link_externo}">Acceder a la videoperitación</a></p>
        <p><em>Este enlace expira el ${new Date(link_expira_at).toLocaleString('es-ES')}.</em></p>
      `,
        });
    }
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'vp_agenda',
            registro_id: agenda.id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { link_externo: body.link_externo, link_token, link_enviado_at: now },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'videoperitacion',
            event_type: 'LinkVideoperitacionEnviado',
            payload: { agenda_id: agenda.id, link_externo: body.link_externo, asegurado_email: aseguradoEmail },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { link_token, link_expira_at, agenda_id: agenda.id }, error: null });
});
// ═══════════════════════════════════════════════════════════════
// SPRINT 2: Sessions, Artifacts, Transcripts
// ═══════════════════════════════════════════════════════════════
// GET /:id/sesiones — list sessions for a VP
videoperitacionesRoutes.get('/:id/sesiones', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_sesiones')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('created_at', { ascending: false });
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// GET /:id/artefactos — list artifacts for a VP
videoperitacionesRoutes.get('/:id/artefactos', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const tipo = c.req.query('tipo');
    let query = supabase
        .from('vp_artefactos')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('created_at', { ascending: false });
    if (tipo)
        query = query.eq('tipo', tipo);
    const { data, error } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// GET /:id/transcripciones — list transcripts for a VP
videoperitacionesRoutes.get('/:id/transcripciones', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_transcripciones')
        .select('id, videoperitacion_id, sesion_id, idioma, resumen, highlights, proveedor, created_at')
        .eq('videoperitacion_id', id)
        .order('created_at', { ascending: false });
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// POST /:id/artefactos — manual artifact upload
videoperitacionesRoutes.post('/:id/artefactos', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.tipo || !body.nombre_original) {
        return c.json(err('VALIDATION', 'tipo y nombre_original son requeridos'), 422);
    }
    const { data: vp } = await supabase.from('vp_videoperitaciones').select('id, expediente_id').eq('id', id).single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    const { data, error } = await supabase
        .from('vp_artefactos')
        .insert({
        videoperitacion_id: id,
        expediente_id: vp.expediente_id,
        sesion_id: body.sesion_id ?? null,
        tipo: body.tipo,
        nombre_original: body.nombre_original,
        mime_type: body.mime_type ?? null,
        tamano_bytes: body.tamano_bytes ?? null,
        storage_path: body.storage_path ?? null,
        notas: body.notas ?? null,
        origen: 'manual',
        visibility_scope: body.visibility_scope ?? 'office',
        estado_disponibilidad: 'disponible',
        created_by: user.id,
        subido_por: user.id,
    })
        .select()
        .single();
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await Promise.all([
        supabase.from('auditoria').insert({
            tabla: 'vp_artefactos', registro_id: data.id, accion: 'INSERT', actor_id: user.id,
            cambios: { tipo: body.tipo, nombre_original: body.nombre_original },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'ArtefactoVideoperitacionSubido',
            payload: { artefacto_id: data.id, tipo: body.tipo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data, error: null }, 201);
});
// GET /artefactos/:artefactoId/signed-url — generate signed URL and log access
videoperitacionesRoutes.get('/artefactos/:artefactoId/signed-url', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const artefactoId = c.req.param('artefactoId');
    const { data: art } = await supabase
        .from('vp_artefactos')
        .select('id, storage_path, provider_url, visibility_scope, videoperitacion_id')
        .eq('id', artefactoId)
        .single();
    if (!art)
        return c.json(err('NOT_FOUND', 'Artefacto no encontrado'), 404);
    // Check visibility scope
    const userRoles = user.roles ?? [];
    const primaryRole = userRoles[0] ?? 'unknown';
    if (art.visibility_scope === 'office' && !userRoles.some((role) => ['admin', 'supervisor', 'tramitador'].includes(role))) {
        return c.json(err('FORBIDDEN', 'No tiene permiso para acceder a este artefacto'), 403);
    }
    if (art.visibility_scope === 'perito' && !userRoles.some((role) => ['admin', 'supervisor', 'tramitador', 'perito'].includes(role))) {
        return c.json(err('FORBIDDEN', 'No tiene permiso para acceder a este artefacto'), 403);
    }
    // Record access
    await supabase.from('vp_accesos_artefacto').insert({
        artefacto_id: artefactoId,
        user_id: user.id,
        user_role: primaryRole,
        access_type: 'view',
        ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
        user_agent: c.req.header('user-agent') ?? null,
    });
    // Return signed URL or provider URL
    let url = art.provider_url;
    if (!url && art.storage_path) {
        const { data: signed } = await supabase.storage
            .from('vp-artefactos')
            .createSignedUrl(art.storage_path, 3600);
        url = signed?.signedUrl ?? null;
    }
    return c.json({ data: { url, expires_in: 3600 }, error: null });
});
// GET /:id/transcripciones/:transcripcionId — single transcript detail
videoperitacionesRoutes.get('/:id/transcripciones/:transcripcionId', async (c) => {
    const supabase = c.get('supabase');
    const transcripcionId = c.req.param('transcripcionId');
    const { data, error } = await supabase
        .from('vp_transcripciones')
        .select('*')
        .eq('id', transcripcionId)
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Transcripción no encontrada'), 404);
    return c.json({ data, error: null });
});
// GET /buscar-transcripcion — full-text search on transcripts
videoperitacionesRoutes.get('/buscar-transcripcion', async (c) => {
    const supabase = c.get('supabase');
    const q = c.req.query('q');
    const vpId = c.req.query('vp_id');
    if (!q || q.length < 3) {
        return c.json(err('VALIDATION', 'El parámetro q debe tener al menos 3 caracteres'), 422);
    }
    let query = supabase
        .from('vp_transcripciones')
        .select('id, videoperitacion_id, sesion_id, idioma, resumen, created_at')
        .textSearch('texto_completo', q, { type: 'websearch', config: 'spanish' })
        .limit(20);
    if (vpId)
        query = query.eq('videoperitacion_id', vpId);
    const { data, error } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// ═══════════════════════════════════════════════════════════════
// SPRINT 3: Cockpit Pericial — Dictámenes, Instrucciones, Acciones
// ═══════════════════════════════════════════════════════════════
// GET /:id/dictamenes — list dictámenes for a VP
videoperitacionesRoutes.get('/:id/dictamenes', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_dictamenes')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('version', { ascending: false });
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// GET /:id/dictamenes/:did — single dictamen detail with versions
videoperitacionesRoutes.get('/:id/dictamenes/:did', async (c) => {
    const supabase = c.get('supabase');
    const did = c.req.param('did');
    const { data, error } = await supabase
        .from('vp_dictamenes')
        .select('*, versiones:vp_dictamen_versiones(*)')
        .eq('id', did)
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    return c.json({ data, error: null });
});
// POST /:id/dictamenes — create dictamen (borrador)
videoperitacionesRoutes.post('/:id/dictamenes', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data: vp } = await supabase
        .from('vp_videoperitaciones')
        .select('id, expediente_id, perito_id')
        .eq('id', id)
        .single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'Videoperitación no encontrada'), 404);
    // Get current version count
    const { count } = await supabase
        .from('vp_dictamenes')
        .select('id', { count: 'exact', head: true })
        .eq('videoperitacion_id', id);
    const { data: dictamen, error: dErr } = await supabase
        .from('vp_dictamenes')
        .insert({
        videoperitacion_id: id,
        expediente_id: vp.expediente_id,
        perito_id: vp.perito_id ?? user.id,
        sesion_id: body.sesion_id ?? null,
        version: (count ?? 0) + 1,
        estado: 'borrador',
        conclusiones: body.conclusiones ?? null,
        observaciones: body.observaciones ?? null,
        hallazgos: body.hallazgos ?? null,
        recomendaciones: body.recomendaciones ?? null,
        artefactos_revisados: body.artefactos_revisados ?? [],
        sesiones_revisadas: body.sesiones_revisadas ?? [],
        created_by: user.id,
    })
        .select()
        .single();
    if (dErr)
        return c.json(err('DB_ERROR', dErr.message), 500);
    // Update VP estado to revision_pericial
    await supabase.from('vp_videoperitaciones')
        .update({ estado: 'revision_pericial', updated_at: new Date().toISOString() })
        .eq('id', id);
    await Promise.all([
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamen.id, accion: 'INSERT',
            actor_id: user.id, cambios: { estado: 'borrador', version: dictamen.version },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'DictamenVpCreado',
            payload: { dictamen_id: dictamen.id, version: dictamen.version },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: dictamen, error: null }, 201);
});
// POST /:id/emitir-dictamen — emit dictamen (borrador -> emitido)
videoperitacionesRoutes.post('/:id/emitir-dictamen', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.dictamen_id)
        return c.json(err('VALIDATION', 'dictamen_id es requerido'), 422);
    if (!body.tipo_resolucion)
        return c.json(err('VALIDATION', 'tipo_resolucion es requerido'), 422);
    if (!body.conclusiones)
        return c.json(err('VALIDATION', 'conclusiones son requeridas'), 422);
    const { data: dictamen } = await supabase
        .from('vp_dictamenes')
        .select('*')
        .eq('id', body.dictamen_id)
        .eq('videoperitacion_id', id)
        .single();
    if (!dictamen)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    if (dictamen.estado !== 'borrador' && dictamen.estado !== 'requiere_mas_informacion') {
        return c.json(err('ESTADO_INVALIDO', `No se puede emitir un dictamen en estado ${dictamen.estado}`), 422);
    }
    // Snapshot current version
    await supabase.from('vp_dictamen_versiones').insert({
        dictamen_id: dictamen.id,
        version: dictamen.version,
        estado: dictamen.estado,
        conclusiones: dictamen.conclusiones,
        observaciones: dictamen.observaciones,
        hallazgos: dictamen.hallazgos,
        recomendaciones: dictamen.recomendaciones,
        motivo_rechazo: dictamen.motivo_rechazo,
        informacion_solicitada: dictamen.informacion_solicitada,
        instruccion_tecnica: dictamen.instruccion_tecnica,
        snapshot_by: user.id,
    });
    // Determine impact on expediente
    let impactoExpediente = body.impacto_expediente ?? 'sin_impacto';
    let vpEstadoNuevo = 'pendiente_informe';
    if (body.tipo_resolucion === 'solicitud_informacion') {
        vpEstadoNuevo = 'pendiente_perito'; // stays pending until info arrives
        impactoExpediente = 'mantener_pendiente';
    }
    else if (body.tipo_resolucion === 'rechazo') {
        vpEstadoNuevo = 'pendiente_perito';
    }
    const now = new Date().toISOString();
    const { error: uErr } = await supabase
        .from('vp_dictamenes')
        .update({
        estado: 'emitido',
        tipo_resolucion: body.tipo_resolucion,
        conclusiones: body.conclusiones,
        observaciones: body.observaciones ?? dictamen.observaciones,
        hallazgos: body.hallazgos ?? dictamen.hallazgos,
        recomendaciones: body.recomendaciones ?? dictamen.recomendaciones,
        motivo_rechazo: body.motivo_rechazo ?? null,
        informacion_solicitada: body.informacion_solicitada ?? null,
        instruccion_tecnica: body.instruccion_tecnica ?? null,
        impacto_expediente: impactoExpediente,
        artefactos_revisados: body.artefactos_revisados ?? dictamen.artefactos_revisados,
        sesiones_revisadas: body.sesiones_revisadas ?? dictamen.sesiones_revisadas,
        emitido_at: now,
        version: dictamen.version + 1,
        updated_at: now,
    })
        .eq('id', dictamen.id);
    if (uErr)
        return c.json(err('DB_ERROR', uErr.message), 500);
    // Update VP estado
    await supabase.from('vp_videoperitaciones')
        .update({ estado: vpEstadoNuevo, updated_at: now })
        .eq('id', id);
    // Apply expediente impact if applicable
    const { data: vp } = await supabase.from('vp_videoperitaciones')
        .select('expediente_id').eq('id', id).single();
    if (vp && impactoExpediente === 'reactivar') {
        const { data: exp } = await supabase.from('expedientes')
            .select('estado').eq('id', vp.expediente_id).single();
        if (exp) {
            await supabase.from('vp_dictamenes')
                .update({ expediente_estado_previo: exp.estado, expediente_estado_nuevo: 'en_curso' })
                .eq('id', dictamen.id);
            await supabase.from('expedientes')
                .update({ estado: 'en_curso', updated_at: now })
                .eq('id', vp.expediente_id);
        }
    }
    // Timeline + audit + domain event + alert to office
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp?.expediente_id ?? dictamen.expediente_id,
            tipo: 'nota_interna', emisor_tipo: 'perito',
            asunto: `Dictamen VP emitido: ${body.tipo_resolucion}`,
            contenido: `El perito ha emitido dictamen de tipo "${body.tipo_resolucion}". Conclusiones: ${body.conclusiones.substring(0, 300)}`,
            actor_id: user.id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamen.id, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado: 'emitido', tipo_resolucion: body.tipo_resolucion, impacto_expediente: impactoExpediente },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'DictamenVpEmitido',
            payload: { dictamen_id: dictamen.id, tipo_resolucion: body.tipo_resolucion, impacto_expediente: impactoExpediente },
            actor_id: user.id,
        }),
        supabase.from('alertas').insert({
            tipo: 'dictamen_emitido',
            titulo: `Dictamen VP emitido: ${body.tipo_resolucion}`,
            descripcion: body.conclusiones?.substring(0, 200) ?? '',
            prioridad: body.tipo_resolucion === 'rechazo' ? 'alta' : 'media',
            referencia_tipo: 'videoperitacion',
            referencia_id: id,
        }),
    ]);
    return c.json({ data: { dictamen_id: dictamen.id, estado: 'emitido', vp_estado: vpEstadoNuevo, impacto_expediente: impactoExpediente }, error: null });
});
// POST /:id/solicitar-mas-informacion
videoperitacionesRoutes.post('/:id/solicitar-mas-informacion', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.informacion_solicitada)
        return c.json(err('VALIDATION', 'informacion_solicitada es requerida'), 422);
    const { data: vp } = await supabase.from('vp_videoperitaciones')
        .select('id, expediente_id, perito_id').eq('id', id).single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'VP no encontrada'), 404);
    // Get or create dictamen
    let dictamenId = body.dictamen_id;
    if (!dictamenId) {
        const { count } = await supabase.from('vp_dictamenes')
            .select('id', { count: 'exact', head: true }).eq('videoperitacion_id', id);
        const { data: d } = await supabase.from('vp_dictamenes').insert({
            videoperitacion_id: id, expediente_id: vp.expediente_id,
            perito_id: vp.perito_id ?? user.id,
            version: (count ?? 0) + 1, estado: 'requiere_mas_informacion',
            tipo_resolucion: 'solicitud_informacion',
            informacion_solicitada: body.informacion_solicitada,
            impacto_expediente: 'mantener_pendiente',
            emitido_at: new Date().toISOString(),
            created_by: user.id,
        }).select().single();
        dictamenId = d?.id;
    }
    else {
        await supabase.from('vp_dictamenes').update({
            estado: 'requiere_mas_informacion',
            tipo_resolucion: 'solicitud_informacion',
            informacion_solicitada: body.informacion_solicitada,
            impacto_expediente: 'mantener_pendiente',
            updated_at: new Date().toISOString(),
        }).eq('id', dictamenId);
    }
    await supabase.from('vp_videoperitaciones')
        .update({ estado: 'pendiente_perito', updated_at: new Date().toISOString() }).eq('id', id);
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', emisor_tipo: 'perito',
            asunto: 'Solicitud de más información (VP)',
            contenido: `El perito solicita información adicional: ${body.informacion_solicitada}`,
            actor_id: user.id,
        }),
        supabase.from('alertas').insert({
            tipo: 'solicitud_informacion_vp', titulo: 'Perito solicita más información',
            descripcion: body.informacion_solicitada.substring(0, 200),
            prioridad: 'alta', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'InformacionAdicionalSolicitada',
            payload: { dictamen_id: dictamenId, informacion_solicitada: body.informacion_solicitada },
            actor_id: user.id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamenId, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado: 'requiere_mas_informacion' },
        }),
    ]);
    return c.json({ data: { dictamen_id: dictamenId, estado: 'requiere_mas_informacion', vp_estado: 'pendiente_perito' }, error: null });
});
// POST /:id/aprobar — shortcut to emit approval dictamen
videoperitacionesRoutes.post('/:id/aprobar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.conclusiones)
        return c.json(err('VALIDATION', 'conclusiones son requeridas'), 422);
    const { data: vp } = await supabase.from('vp_videoperitaciones')
        .select('id, expediente_id, perito_id, estado').eq('id', id).single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'VP no encontrada'), 404);
    const { count } = await supabase.from('vp_dictamenes')
        .select('id', { count: 'exact', head: true }).eq('videoperitacion_id', id);
    const now = new Date().toISOString();
    const { data: dictamen, error: dErr } = await supabase.from('vp_dictamenes').insert({
        videoperitacion_id: id, expediente_id: vp.expediente_id,
        perito_id: vp.perito_id ?? user.id,
        version: (count ?? 0) + 1, estado: 'emitido',
        tipo_resolucion: 'aprobacion',
        conclusiones: body.conclusiones,
        observaciones: body.observaciones ?? null,
        hallazgos: body.hallazgos ?? null,
        recomendaciones: body.recomendaciones ?? null,
        impacto_expediente: body.impacto_expediente ?? 'reactivar',
        artefactos_revisados: body.artefactos_revisados ?? [],
        sesiones_revisadas: body.sesiones_revisadas ?? [],
        emitido_at: now, created_by: user.id,
    }).select().single();
    if (dErr)
        return c.json(err('DB_ERROR', dErr.message), 500);
    const impacto = body.impacto_expediente ?? 'reactivar';
    await supabase.from('vp_videoperitaciones')
        .update({ estado: 'pendiente_informe', updated_at: now }).eq('id', id);
    // Apply expediente impact
    if (impacto === 'reactivar') {
        const { data: exp } = await supabase.from('expedientes')
            .select('estado').eq('id', vp.expediente_id).single();
        if (exp) {
            await supabase.from('vp_dictamenes').update({
                expediente_estado_previo: exp.estado, expediente_estado_nuevo: 'en_curso',
            }).eq('id', dictamen.id);
            await supabase.from('expedientes')
                .update({ estado: 'en_curso', updated_at: now }).eq('id', vp.expediente_id);
        }
    }
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', emisor_tipo: 'perito',
            asunto: 'Videoperitación aprobada',
            contenido: `El perito ha aprobado la videoperitación. ${body.conclusiones.substring(0, 300)}`,
            actor_id: user.id,
        }),
        supabase.from('alertas').insert({
            tipo: 'vp_aprobada', titulo: 'Videoperitación aprobada por perito',
            descripcion: body.conclusiones.substring(0, 200),
            prioridad: 'media', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionAprobada',
            payload: { dictamen_id: dictamen.id, impacto_expediente: impacto },
            actor_id: user.id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamen.id, accion: 'INSERT',
            actor_id: user.id, cambios: { estado: 'emitido', tipo_resolucion: 'aprobacion' },
        }),
    ]);
    return c.json({ data: { dictamen_id: dictamen.id, estado: 'emitido', vp_estado: 'pendiente_informe', impacto_expediente: impacto }, error: null });
});
// POST /:id/rechazar — shortcut to emit rejection dictamen
videoperitacionesRoutes.post('/:id/rechazar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.motivo_rechazo)
        return c.json(err('VALIDATION', 'motivo_rechazo es requerido'), 422);
    const { data: vp } = await supabase.from('vp_videoperitaciones')
        .select('id, expediente_id, perito_id').eq('id', id).single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'VP no encontrada'), 404);
    const { count } = await supabase.from('vp_dictamenes')
        .select('id', { count: 'exact', head: true }).eq('videoperitacion_id', id);
    const now = new Date().toISOString();
    const { data: dictamen, error: dErr } = await supabase.from('vp_dictamenes').insert({
        videoperitacion_id: id, expediente_id: vp.expediente_id,
        perito_id: vp.perito_id ?? user.id,
        version: (count ?? 0) + 1, estado: 'emitido',
        tipo_resolucion: 'rechazo',
        conclusiones: body.conclusiones ?? `Rechazado: ${body.motivo_rechazo}`,
        motivo_rechazo: body.motivo_rechazo,
        impacto_expediente: 'mantener_pendiente',
        emitido_at: now, created_by: user.id,
    }).select().single();
    if (dErr)
        return c.json(err('DB_ERROR', dErr.message), 500);
    await supabase.from('vp_videoperitaciones')
        .update({ estado: 'pendiente_perito', updated_at: now }).eq('id', id);
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', emisor_tipo: 'perito',
            asunto: 'Videoperitación rechazada',
            contenido: `El perito ha rechazado la videoperitación. Motivo: ${body.motivo_rechazo}`,
            actor_id: user.id,
        }),
        supabase.from('alertas').insert({
            tipo: 'vp_rechazada', titulo: 'Videoperitación rechazada por perito',
            descripcion: body.motivo_rechazo.substring(0, 200),
            prioridad: 'alta', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'VideoperitacionRechazada',
            payload: { dictamen_id: dictamen.id, motivo_rechazo: body.motivo_rechazo },
            actor_id: user.id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamen.id, accion: 'INSERT',
            actor_id: user.id, cambios: { estado: 'emitido', tipo_resolucion: 'rechazo' },
        }),
    ]);
    return c.json({ data: { dictamen_id: dictamen.id, estado: 'emitido', vp_estado: 'pendiente_perito' }, error: null });
});
// POST /:id/instruccion — perito emits technical instruction
videoperitacionesRoutes.post('/:id/instruccion', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.tipo || !body.descripcion)
        return c.json(err('VALIDATION', 'tipo y descripcion son requeridos'), 422);
    const { data: vp } = await supabase.from('vp_videoperitaciones')
        .select('id, expediente_id, perito_id').eq('id', id).single();
    if (!vp)
        return c.json(err('NOT_FOUND', 'VP no encontrada'), 404);
    const { data: instruccion, error: iErr } = await supabase.from('vp_instrucciones').insert({
        videoperitacion_id: id, expediente_id: vp.expediente_id,
        perito_id: vp.perito_id ?? user.id,
        dictamen_id: body.dictamen_id ?? null,
        tipo: body.tipo, descripcion: body.descripcion,
        prioridad: body.prioridad ?? 'media',
        created_by: user.id,
    }).select().single();
    if (iErr)
        return c.json(err('DB_ERROR', iErr.message), 500);
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', emisor_tipo: 'perito',
            asunto: `Instrucción pericial: ${body.tipo}`,
            contenido: body.descripcion,
            actor_id: user.id,
        }),
        supabase.from('alertas').insert({
            tipo: 'instruccion_pericial', titulo: `Instrucción pericial: ${body.tipo}`,
            descripcion: body.descripcion.substring(0, 200),
            prioridad: body.prioridad ?? 'media',
            referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'InstruccionPericialEmitida',
            payload: { instruccion_id: instruccion.id, tipo: body.tipo },
            actor_id: user.id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_instrucciones', registro_id: instruccion.id, accion: 'INSERT',
            actor_id: user.id, cambios: { tipo: body.tipo, prioridad: body.prioridad ?? 'media' },
        }),
    ]);
    return c.json({ data: instruccion, error: null }, 201);
});
// GET /:id/instrucciones — list instructions for a VP
videoperitacionesRoutes.get('/:id/instrucciones', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_instrucciones')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('created_at', { ascending: false });
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// POST /:id/validar-dictamen — office validates dictamen
videoperitacionesRoutes.post('/:id/validar-dictamen', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.dictamen_id)
        return c.json(err('VALIDATION', 'dictamen_id es requerido'), 422);
    if (!user.roles.some((role) => ['admin', 'supervisor'].includes(role))) {
        return c.json(err('FORBIDDEN', 'Solo admin/supervisor pueden validar dictámenes'), 403);
    }
    const { data: dictamen } = await supabase.from('vp_dictamenes')
        .select('*').eq('id', body.dictamen_id).eq('videoperitacion_id', id).single();
    if (!dictamen)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    if (dictamen.estado !== 'emitido') {
        return c.json(err('ESTADO_INVALIDO', `Solo se puede validar un dictamen emitido, actual: ${dictamen.estado}`), 422);
    }
    const now = new Date().toISOString();
    await supabase.from('vp_dictamenes').update({
        estado: 'validado', validado_at: now, validado_por: user.id, updated_at: now,
    }).eq('id', dictamen.id);
    await Promise.all([
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamen.id, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado: 'validado' },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'DictamenVpValidado',
            payload: { dictamen_id: dictamen.id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { dictamen_id: dictamen.id, estado: 'validado' }, error: null });
});
// POST /:id/rechazar-dictamen — office rejects dictamen back to perito
videoperitacionesRoutes.post('/:id/rechazar-dictamen', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.dictamen_id || !body.motivo)
        return c.json(err('VALIDATION', 'dictamen_id y motivo son requeridos'), 422);
    if (!user.roles.some((role) => ['admin', 'supervisor'].includes(role))) {
        return c.json(err('FORBIDDEN', 'Solo admin/supervisor pueden rechazar dictámenes'), 403);
    }
    const { data: dictamen } = await supabase.from('vp_dictamenes')
        .select('*').eq('id', body.dictamen_id).eq('videoperitacion_id', id).single();
    if (!dictamen)
        return c.json(err('NOT_FOUND', 'Dictamen no encontrado'), 404);
    if (dictamen.estado !== 'emitido') {
        return c.json(err('ESTADO_INVALIDO', `Solo se puede rechazar un dictamen emitido`), 422);
    }
    const now = new Date().toISOString();
    await supabase.from('vp_dictamenes').update({
        estado: 'rechazado', motivo_rechazo: body.motivo,
        rechazado_at: now, rechazado_por: user.id, updated_at: now,
    }).eq('id', dictamen.id);
    // VP back to revision_pericial
    await supabase.from('vp_videoperitaciones')
        .update({ estado: 'revision_pericial', updated_at: now }).eq('id', id);
    await Promise.all([
        supabase.from('alertas').insert({
            tipo: 'dictamen_rechazado', titulo: 'Dictamen rechazado por oficina',
            descripcion: body.motivo.substring(0, 200),
            prioridad: 'alta', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_dictamenes', registro_id: dictamen.id, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado: 'rechazado', motivo: body.motivo },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'DictamenVpRechazado',
            payload: { dictamen_id: dictamen.id, motivo: body.motivo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { dictamen_id: dictamen.id, estado: 'rechazado', vp_estado: 'revision_pericial' }, error: null });
});
// ═══════════════════════════════════════════════════════════════════════════
// EP-11B Sprint 4: Informe Técnico + Valoración Económica
// ═══════════════════════════════════════════════════════════════════════════
// ─── GET /:id/informes ──────────────────────────────────────────────
videoperitacionesRoutes.get('/:id/informes', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_informes')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('version', { ascending: false });
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
// ─── GET /:id/informes/:iid ────────────────────────────────────────
videoperitacionesRoutes.get('/:id/informes/:iid', async (c) => {
    const supabase = c.get('supabase');
    const iid = c.req.param('iid');
    const { data: informe, error } = await supabase
        .from('vp_informes')
        .select('*')
        .eq('id', iid)
        .single();
    if (error || !informe)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Informe no encontrado' } }, 404);
    const { data: versiones } = await supabase
        .from('vp_informe_versiones')
        .select('*')
        .eq('informe_id', iid)
        .order('version', { ascending: false });
    return c.json({ data: { ...informe, versiones: versiones ?? [] }, error: null });
});
// ─── POST /:id/informes — Create informe borrador ──────────────────
videoperitacionesRoutes.post('/:id/informes', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const isPerito = user.roles?.some((r) => ['perito', 'admin', 'supervisor'].includes(r));
    if (!isPerito)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Solo perito/admin/supervisor pueden crear informes' } }, 403);
    // Get VP
    const { data: vp, error: vpErr } = await supabase
        .from('vp_videoperitaciones')
        .select('*, expedientes!inner(id, numero_expediente, tipo_siniestro, descripcion, estado, compania_id)')
        .eq('id', id)
        .single();
    if (vpErr || !vp)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'VP no encontrada' } }, 404);
    // Auto-populate sections
    const datos_expediente = {
        numero_expediente: vp.expedientes?.numero_expediente,
        tipo_siniestro: vp.expedientes?.tipo_siniestro,
        descripcion: vp.expedientes?.descripcion,
        estado: vp.expedientes?.estado,
    };
    const datos_encargo = {
        tipo_servicio: vp.tipo_servicio,
        descripcion_encargo: vp.descripcion_encargo,
        fecha_encargo: vp.created_at,
    };
    // Session stats
    const { count: sesionCount } = await supabase
        .from('vp_sesiones').select('id', { count: 'exact', head: true }).eq('videoperitacion_id', id);
    const { count: artefactoCount } = await supabase
        .from('vp_artefactos').select('id', { count: 'exact', head: true }).eq('videoperitacion_id', id);
    const datos_videoperitacion = {
        estado: vp.estado,
        total_sesiones: sesionCount ?? 0,
        total_artefactos: artefactoCount ?? 0,
    };
    // Try to get latest dictamen
    let hallazgos = [];
    let resolucion_pericial = {};
    let dictamen_id = null;
    const { data: dictamen } = await supabase
        .from('vp_dictamenes')
        .select('*')
        .eq('videoperitacion_id', id)
        .in('estado', ['emitido', 'validado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (dictamen) {
        dictamen_id = dictamen.id;
        hallazgos = dictamen.hallazgos ?? [];
        resolucion_pericial = {
            tipo_resolucion: dictamen.tipo_resolucion,
            conclusiones: dictamen.conclusiones,
            impacto_expediente: dictamen.impacto_expediente,
        };
    }
    const { data: informe, error: insertErr } = await supabase
        .from('vp_informes')
        .insert({
        videoperitacion_id: id,
        expediente_id: vp.expediente_id,
        estado: 'borrador',
        version: 1,
        datos_expediente,
        datos_encargo,
        datos_videoperitacion,
        resumen_sesion: {},
        hallazgos,
        resolucion_pericial,
        dictamen_id,
        creado_por: user.id,
    })
        .select()
        .single();
    if (insertErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: insertErr.message } }, 500);
    // Update VP estado
    await supabase.from('vp_videoperitaciones').update({ estado: 'informe_borrador' }).eq('id', id);
    // Timeline + audit + domain event
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Informe técnico VP creado (borrador v1)`,
            prioridad: 'media', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_informes', registro_id: informe.id, accion: 'INSERT',
            actor_id: user.id, cambios: { estado: 'borrador', version: 1 },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'InformeVpCreado',
            payload: { informe_id: informe.id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: informe, error: null }, 201);
});
// ─── POST /:id/informes/:iid/guardar-borrador ─────────────────────
videoperitacionesRoutes.post('/:id/informes/:iid/guardar-borrador', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const iid = c.req.param('iid');
    const body = await c.req.json();
    const { data: informe, error: fetchErr } = await supabase
        .from('vp_informes').select('*').eq('id', iid).single();
    if (fetchErr || !informe)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Informe no encontrado' } }, 404);
    if (!['borrador', 'rectificado'].includes(informe.estado)) {
        return c.json({ data: null, error: { code: 'INVALID_STATE', message: `No se puede editar informe en estado ${informe.estado}` } }, 422);
    }
    const isOwnerOrAdmin = informe.creado_por === user.id || user.roles?.some((r) => ['admin', 'supervisor'].includes(r));
    if (!isOwnerOrAdmin)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
    // Snapshot current version
    const snapshot = {
        datos_expediente: informe.datos_expediente,
        datos_encargo: informe.datos_encargo,
        datos_videoperitacion: informe.datos_videoperitacion,
        resumen_sesion: informe.resumen_sesion,
        evidencias_principales: informe.evidencias_principales,
        hallazgos: informe.hallazgos,
        conclusiones: informe.conclusiones,
        extractos_transcripcion: informe.extractos_transcripcion,
        resolucion_pericial: informe.resolucion_pericial,
        observaciones_finales: informe.observaciones_finales,
    };
    await supabase.from('vp_informe_versiones').insert({
        informe_id: iid,
        version: informe.version,
        estado_anterior: informe.estado,
        estado_nuevo: informe.estado,
        contenido_snapshot: snapshot,
        creado_por: user.id,
        motivo: 'guardar_borrador',
    });
    // Update content
    const updates = { version: informe.version + 1 };
    if (body.conclusiones !== undefined)
        updates.conclusiones = body.conclusiones;
    if (body.hallazgos !== undefined)
        updates.hallazgos = body.hallazgos;
    if (body.observaciones_finales !== undefined)
        updates.observaciones_finales = body.observaciones_finales;
    if (body.evidencias_principales !== undefined)
        updates.evidencias_principales = body.evidencias_principales;
    if (body.extractos_transcripcion !== undefined)
        updates.extractos_transcripcion = body.extractos_transcripcion;
    if (body.resumen_sesion !== undefined)
        updates.resumen_sesion = body.resumen_sesion;
    const { data: updated, error: updateErr } = await supabase
        .from('vp_informes').update(updates).eq('id', iid).select().single();
    if (updateErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: updateErr.message } }, 500);
    await supabase.from('auditoria').insert({
        tabla: 'vp_informes', registro_id: iid, accion: 'UPDATE',
        actor_id: user.id, cambios: { action: 'guardar_borrador', version: updates.version },
    });
    return c.json({ data: updated, error: null });
});
// ─── POST /:id/informes/:iid/enviar-revision ──────────────────────
videoperitacionesRoutes.post('/:id/informes/:iid/enviar-revision', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const iid = c.req.param('iid');
    const { data: informe, error: fetchErr } = await supabase
        .from('vp_informes').select('*').eq('id', iid).single();
    if (fetchErr || !informe)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Informe no encontrado' } }, 404);
    if (!['borrador', 'rectificado'].includes(informe.estado)) {
        return c.json({ data: null, error: { code: 'INVALID_STATE', message: `No se puede enviar a revisión desde estado ${informe.estado}` } }, 422);
    }
    // Snapshot
    await supabase.from('vp_informe_versiones').insert({
        informe_id: iid, version: informe.version,
        estado_anterior: informe.estado, estado_nuevo: 'en_revision',
        contenido_snapshot: {
            datos_expediente: informe.datos_expediente, datos_encargo: informe.datos_encargo,
            datos_videoperitacion: informe.datos_videoperitacion, resumen_sesion: informe.resumen_sesion,
            evidencias_principales: informe.evidencias_principales, hallazgos: informe.hallazgos,
            conclusiones: informe.conclusiones, extractos_transcripcion: informe.extractos_transcripcion,
            resolucion_pericial: informe.resolucion_pericial, observaciones_finales: informe.observaciones_finales,
        },
        creado_por: user.id, motivo: 'enviar_revision',
    });
    const { data: updated, error: updateErr } = await supabase
        .from('vp_informes').update({ estado: 'en_revision' }).eq('id', iid).select().single();
    if (updateErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: updateErr.message } }, 500);
    const { data: vp } = await supabase.from('vp_videoperitaciones').select('expediente_id').eq('id', id).single();
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp?.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Informe VP enviado a revisión (v${informe.version})`,
            prioridad: 'media', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_informes', registro_id: iid, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado_anterior: informe.estado, estado_nuevo: 'en_revision' },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'InformeVpEnviadoRevision',
            payload: { informe_id: iid, version: informe.version },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: updated, error: null });
});
// ─── POST /:id/informes/:iid/validar ──────────────────────────────
videoperitacionesRoutes.post('/:id/informes/:iid/validar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const iid = c.req.param('iid');
    const isAdminSup = user.roles?.some((r) => ['admin', 'supervisor'].includes(r));
    if (!isAdminSup)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Solo admin/supervisor pueden validar informes' } }, 403);
    const { data: informe, error: fetchErr } = await supabase
        .from('vp_informes').select('*').eq('id', iid).single();
    if (fetchErr || !informe)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Informe no encontrado' } }, 404);
    if (informe.estado !== 'en_revision') {
        return c.json({ data: null, error: { code: 'INVALID_STATE', message: `Solo se puede validar desde en_revision, estado actual: ${informe.estado}` } }, 422);
    }
    // Precondition: dictamen emitido/validado
    const { count: dictamenCount } = await supabase
        .from('vp_dictamenes').select('id', { count: 'exact', head: true })
        .eq('videoperitacion_id', id).in('estado', ['emitido', 'validado']);
    if (!dictamenCount || dictamenCount === 0) {
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Debe existir un dictamen emitido o validado' } }, 422);
    }
    // Precondition: required sections non-empty
    if (!informe.conclusiones?.trim()) {
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Las conclusiones son obligatorias' } }, 422);
    }
    if (!informe.hallazgos || (Array.isArray(informe.hallazgos) && informe.hallazgos.length === 0)) {
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Los hallazgos son obligatorios' } }, 422);
    }
    // Precondition: valoracion exists and not borrador
    const { data: valoracion } = await supabase
        .from('vp_valoraciones').select('id, estado')
        .eq('videoperitacion_id', id).maybeSingle();
    if (!valoracion || valoracion.estado === 'borrador') {
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Debe existir una valoración calculada' } }, 422);
    }
    // Snapshot
    await supabase.from('vp_informe_versiones').insert({
        informe_id: iid, version: informe.version,
        estado_anterior: 'en_revision', estado_nuevo: 'validado',
        contenido_snapshot: {
            datos_expediente: informe.datos_expediente, datos_encargo: informe.datos_encargo,
            datos_videoperitacion: informe.datos_videoperitacion, resumen_sesion: informe.resumen_sesion,
            evidencias_principales: informe.evidencias_principales, hallazgos: informe.hallazgos,
            conclusiones: informe.conclusiones, extractos_transcripcion: informe.extractos_transcripcion,
            resolucion_pericial: informe.resolucion_pericial, observaciones_finales: informe.observaciones_finales,
        },
        creado_por: user.id, motivo: 'validacion',
    });
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
        .from('vp_informes')
        .update({ estado: 'validado', validado_por: user.id, validado_at: now })
        .eq('id', iid).select().single();
    if (updateErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: updateErr.message } }, 500);
    // Update VP estado
    let vpEstado = 'informe_validado';
    if (valoracion.estado === 'calculada' || valoracion.estado === 'validada') {
        vpEstado = 'valoracion_calculada';
    }
    await supabase.from('vp_videoperitaciones').update({ estado: vpEstado }).eq('id', id);
    // Reactivate expediente if pending
    const { data: vp } = await supabase.from('vp_videoperitaciones').select('expediente_id').eq('id', id).single();
    if (vp?.expediente_id) {
        const { data: exp } = await supabase.from('expedientes').select('estado').eq('id', vp.expediente_id).single();
        if (exp && String(exp.estado).startsWith('PENDIENTE')) {
            await supabase.from('expedientes').update({ estado: 'EN_CURSO' }).eq('id', vp.expediente_id);
        }
    }
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp?.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Informe VP validado (v${informe.version})`,
            prioridad: 'alta', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_informes', registro_id: iid, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado_anterior: 'en_revision', estado_nuevo: 'validado' },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'InformeVpValidado',
            payload: { informe_id: iid, vp_estado: vpEstado },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { ...updated, vp_estado: vpEstado }, error: null });
});
// ─── POST /:id/informes/:iid/rectificar ───────────────────────────
videoperitacionesRoutes.post('/:id/informes/:iid/rectificar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const iid = c.req.param('iid');
    const body = await c.req.json();
    if (!body.motivo?.trim())
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'motivo requerido' } }, 422);
    const { data: informe, error: fetchErr } = await supabase
        .from('vp_informes').select('*').eq('id', iid).single();
    if (fetchErr || !informe)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Informe no encontrado' } }, 404);
    if (informe.estado !== 'validado') {
        return c.json({ data: null, error: { code: 'INVALID_STATE', message: 'Solo se puede rectificar un informe validado' } }, 422);
    }
    const isOwnerOrAdmin = informe.creado_por === user.id || user.roles?.some((r) => ['admin', 'supervisor'].includes(r));
    if (!isOwnerOrAdmin)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
    // Snapshot
    await supabase.from('vp_informe_versiones').insert({
        informe_id: iid, version: informe.version,
        estado_anterior: 'validado', estado_nuevo: 'rectificado',
        contenido_snapshot: {
            datos_expediente: informe.datos_expediente, datos_encargo: informe.datos_encargo,
            datos_videoperitacion: informe.datos_videoperitacion, resumen_sesion: informe.resumen_sesion,
            evidencias_principales: informe.evidencias_principales, hallazgos: informe.hallazgos,
            conclusiones: informe.conclusiones, extractos_transcripcion: informe.extractos_transcripcion,
            resolucion_pericial: informe.resolucion_pericial, observaciones_finales: informe.observaciones_finales,
        },
        creado_por: user.id, motivo: body.motivo,
    });
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabase
        .from('vp_informes')
        .update({ estado: 'rectificado', rectificado_at: now, rectificado_motivo: body.motivo })
        .eq('id', iid).select().single();
    if (updateErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: updateErr.message } }, 500);
    await supabase.from('vp_videoperitaciones').update({ estado: 'informe_borrador' }).eq('id', id);
    const { data: vp } = await supabase.from('vp_videoperitaciones').select('expediente_id').eq('id', id).single();
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp?.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Informe VP rectificado: ${body.motivo}`,
            prioridad: 'alta', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_informes', registro_id: iid, accion: 'UPDATE',
            actor_id: user.id, cambios: { estado_anterior: 'validado', estado_nuevo: 'rectificado', motivo: body.motivo },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'InformeVpRectificado',
            payload: { informe_id: iid, motivo: body.motivo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: updated, error: null });
});
// ─── GET /:id/valoracion ──────────────────────────────────────────
videoperitacionesRoutes.get('/:id/valoracion', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data: valoracion } = await supabase
        .from('vp_valoraciones')
        .select('*')
        .eq('videoperitacion_id', id)
        .maybeSingle();
    if (!valoracion)
        return c.json({ data: null, error: null });
    const { data: lineas } = await supabase
        .from('vp_valoracion_lineas')
        .select('*')
        .eq('valoracion_id', valoracion.id)
        .order('orden');
    return c.json({ data: { ...valoracion, lineas: lineas ?? [] }, error: null });
});
// ─── POST /:id/calcular-valoracion ────────────────────────────────
videoperitacionesRoutes.post('/:id/calcular-valoracion', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.lineas?.length)
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'Se requiere al menos una línea' } }, 422);
    // Get VP + expediente + compania
    const { data: vp } = await supabase
        .from('vp_videoperitaciones')
        .select('*, expedientes!inner(id, compania_id)')
        .eq('id', id).single();
    if (!vp)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'VP no encontrada' } }, 404);
    const companiaId = vp.expedientes?.compania_id;
    if (!companiaId)
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'Expediente sin compañía asignada' } }, 422);
    // Find vigent baremo
    const today = new Date().toISOString().split('T')[0];
    const { data: baremo } = await supabase
        .from('baremos')
        .select('*')
        .eq('compania_id', companiaId)
        .eq('tipo', 'compania')
        .eq('activo', true)
        .lte('vigente_desde', today)
        .or(`vigente_hasta.is.null,vigente_hasta.gte.${today}`)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!baremo)
        return c.json({ data: null, error: { code: 'NO_BAREMO', message: 'No hay baremo vigente para esta compañía' } }, 422);
    // Resolve partidas
    const partidaIds = body.lineas.map(l => l.partida_baremo_id);
    const { data: partidas } = await supabase
        .from('partidas_baremo')
        .select('*')
        .in('id', partidaIds);
    const partidaMap = new Map((partidas ?? []).map((p) => [p.id, p]));
    // Build lines
    const lineas = [];
    let importe_total = 0;
    for (let i = 0; i < body.lineas.length; i++) {
        const l = body.lineas[i];
        const partida = partidaMap.get(l.partida_baremo_id);
        if (!partida)
            continue;
        const precio = partida.precio_unitario ?? 0;
        const importe = l.cantidad * precio;
        importe_total += importe;
        lineas.push({
            partida_baremo_id: partida.id,
            codigo: partida.codigo,
            descripcion: partida.descripcion,
            especialidad: partida.especialidad,
            unidad: partida.unidad,
            precio_unitario_baremo: precio,
            cantidad: l.cantidad,
            precio_unitario_aplicado: precio,
            importe: Math.round(importe * 100) / 100,
            es_ajuste_manual: false,
            fuera_de_baremo: false,
            observaciones: l.observaciones ?? null,
            orden: i,
        });
    }
    importe_total = Math.round(importe_total * 100) / 100;
    // Upsert valoracion
    const { data: existing } = await supabase
        .from('vp_valoraciones').select('id').eq('videoperitacion_id', id).maybeSingle();
    let valoracionId;
    const valoracionData = {
        videoperitacion_id: id,
        expediente_id: vp.expediente_id,
        estado: 'calculada',
        baremo_id: baremo.id,
        baremo_version: baremo.version,
        baremo_nombre: baremo.nombre,
        importe_total,
        importe_baremo: importe_total,
        importe_ajustado: importe_total,
        desviacion_total: 0,
        calculado_por: user.id,
        calculado_at: new Date().toISOString(),
    };
    if (existing) {
        valoracionId = existing.id;
        await supabase.from('vp_valoraciones').update(valoracionData).eq('id', existing.id);
        await supabase.from('vp_valoracion_lineas').delete().eq('valoracion_id', existing.id);
    }
    else {
        const { data: newVal } = await supabase
            .from('vp_valoraciones').insert(valoracionData).select('id').single();
        valoracionId = newVal.id;
    }
    // Insert lines
    if (lineas.length > 0) {
        await supabase.from('vp_valoracion_lineas').insert(lineas.map(l => ({ ...l, valoracion_id: valoracionId })));
    }
    // Update VP estado if informe is validated
    if (vp.estado === 'informe_validado') {
        await supabase.from('vp_videoperitaciones').update({ estado: 'valoracion_calculada' }).eq('id', id);
    }
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Valoración VP calculada: ${importe_total}€ (baremo: ${baremo.nombre} v${baremo.version})`,
            prioridad: 'media', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_valoraciones', registro_id: valoracionId, accion: existing ? 'UPDATE' : 'INSERT',
            actor_id: user.id, cambios: { baremo_id: baremo.id, importe_total, lineas_count: lineas.length },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'ValoracionVpCalculada',
            payload: { valoracion_id: valoracionId, importe_total, baremo_id: baremo.id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { valoracion_id: valoracionId, importe_total, lineas_count: lineas.length, baremo: { id: baremo.id, nombre: baremo.nombre, version: baremo.version } }, error: null });
});
// ─── POST /:id/valoracion/lineas — Add/update single line ─────────
videoperitacionesRoutes.post('/:id/valoracion/lineas', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    if (!body.descripcion?.trim() || body.cantidad == null || body.precio_unitario_aplicado == null) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'descripcion, cantidad y precio_unitario_aplicado requeridos' } }, 422);
    }
    const { data: valoracion } = await supabase
        .from('vp_valoraciones').select('id').eq('videoperitacion_id', id).maybeSingle();
    if (!valoracion)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'No existe valoración para esta VP' } }, 404);
    let precio_baremo = 0;
    let codigo = null;
    let especialidad = null;
    let unidad = null;
    let fuera_de_baremo = true;
    let es_ajuste_manual = false;
    if (body.partida_baremo_id) {
        const { data: partida } = await supabase
            .from('partidas_baremo').select('*').eq('id', body.partida_baremo_id).single();
        if (partida) {
            precio_baremo = partida.precio_unitario ?? 0;
            codigo = partida.codigo;
            especialidad = partida.especialidad;
            unidad = partida.unidad;
            fuera_de_baremo = false;
            es_ajuste_manual = body.precio_unitario_aplicado !== precio_baremo;
        }
    }
    // Manual adjustment requires admin/supervisor
    if (es_ajuste_manual) {
        const isAdminSup = user.roles?.some((r) => ['admin', 'supervisor'].includes(r));
        if (!isAdminSup)
            return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Ajuste manual solo para admin/supervisor' } }, 403);
        if (!body.motivo_ajuste?.trim())
            return c.json({ data: null, error: { code: 'VALIDATION', message: 'motivo_ajuste requerido para ajustes manuales' } }, 422);
    }
    const importe = Math.round(body.cantidad * body.precio_unitario_aplicado * 100) / 100;
    const { data: linea, error } = await supabase
        .from('vp_valoracion_lineas')
        .insert({
        valoracion_id: valoracion.id,
        partida_baremo_id: body.partida_baremo_id ?? null,
        codigo,
        descripcion: body.descripcion,
        especialidad,
        unidad,
        precio_unitario_baremo: precio_baremo,
        cantidad: body.cantidad,
        precio_unitario_aplicado: body.precio_unitario_aplicado,
        importe,
        es_ajuste_manual,
        ajustado_por: es_ajuste_manual ? user.id : null,
        motivo_ajuste: es_ajuste_manual ? body.motivo_ajuste : null,
        fuera_de_baremo,
        observaciones: body.observaciones ?? null,
        orden: body.orden ?? 0,
    })
        .select().single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await supabase.from('auditoria').insert({
        tabla: 'vp_valoracion_lineas', registro_id: linea.id, accion: 'INSERT',
        actor_id: user.id, cambios: { descripcion: body.descripcion, importe, es_ajuste_manual, fuera_de_baremo },
    });
    return c.json({ data: linea, error: null }, 201);
});
// ─── POST /:id/valoracion/recalcular ──────────────────────────────
videoperitacionesRoutes.post('/:id/valoracion/recalcular', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { data: valoracion } = await supabase
        .from('vp_valoraciones').select('id').eq('videoperitacion_id', id).maybeSingle();
    if (!valoracion)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'No existe valoración' } }, 404);
    const { data: lineas } = await supabase
        .from('vp_valoracion_lineas').select('*').eq('valoracion_id', valoracion.id);
    let importe_total = 0;
    let importe_baremo = 0;
    let importe_ajustado = 0;
    for (const l of (lineas ?? [])) {
        const imp = l.cantidad * l.precio_unitario_aplicado;
        const impBaremo = l.cantidad * l.precio_unitario_baremo;
        importe_ajustado += imp;
        importe_baremo += impBaremo;
        importe_total += imp;
    }
    importe_total = Math.round(importe_total * 100) / 100;
    importe_baremo = Math.round(importe_baremo * 100) / 100;
    importe_ajustado = Math.round(importe_ajustado * 100) / 100;
    const desviacion_total = Math.round((importe_ajustado - importe_baremo) * 100) / 100;
    const { data: updated, error } = await supabase
        .from('vp_valoraciones')
        .update({ importe_total, importe_baremo, importe_ajustado, desviacion_total })
        .eq('id', valoracion.id).select().single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await supabase.from('auditoria').insert({
        tabla: 'vp_valoraciones', registro_id: valoracion.id, accion: 'UPDATE',
        actor_id: user.id, cambios: { action: 'recalcular', importe_total, desviacion_total },
    });
    return c.json({ data: updated, error: null });
});
// ─── POST /:id/informes/:iid/preview ──────────────────────────────
videoperitacionesRoutes.post('/:id/informes/:iid/preview', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const iid = c.req.param('iid');
    const { data: informe } = await supabase
        .from('vp_informes').select('*').eq('id', iid).single();
    if (!informe)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Informe no encontrado' } }, 404);
    const { data: vp } = await supabase
        .from('vp_videoperitaciones')
        .select('*, expedientes!inner(*)')
        .eq('id', id).single();
    const { data: valoracion } = await supabase
        .from('vp_valoraciones').select('*, vp_valoracion_lineas(*)')
        .eq('videoperitacion_id', id).maybeSingle();
    return c.json({
        data: {
            informe,
            videoperitacion: vp,
            valoracion,
        },
        error: null,
    });
});
// ═══════════════════════════════════════════════════════════════════════════
// EP-11B Sprint 5: Facturación VP + Envío Informe + Documento Final
// ═══════════════════════════════════════════════════════════════════════════
// ─── GET /:id/documento-final ──────────────────────────────────────
videoperitacionesRoutes.get('/:id/documento-final', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_documento_final')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
// ─── POST /:id/documento-final/generar ─────────────────────────────
videoperitacionesRoutes.post('/:id/documento-final/generar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const isAllowed = user.roles?.some((r) => ['perito', 'admin', 'supervisor'].includes(r));
    if (!isAllowed)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
    // Get VP with relations
    const { data: vp } = await supabase
        .from('vp_videoperitaciones')
        .select('*, expedientes!inner(*, companias!inner(id, nombre, config), empresas_facturadoras!inner(id, nombre, cif))')
        .eq('id', id).single();
    if (!vp)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'VP no encontrada' } }, 404);
    // Get validated informe
    const { data: informe } = await supabase
        .from('vp_informes').select('*')
        .eq('videoperitacion_id', id).eq('estado', 'validado')
        .order('version', { ascending: false }).limit(1).maybeSingle();
    if (!informe)
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Se requiere informe validado' } }, 422);
    // Get valoracion
    const { data: valoracion } = await supabase
        .from('vp_valoraciones').select('*, vp_valoracion_lineas(*)')
        .eq('videoperitacion_id', id).maybeSingle();
    // Get branding from compania config
    const companiaConfig = vp.expedientes?.companias?.config ?? {};
    const branding = companiaConfig.informe_vp ?? {};
    // Build consolidated document
    const contenido_json = {
        meta: {
            version: 1,
            generado_at: new Date().toISOString(),
            formato: 'informe_vp_v1',
        },
        cabecera: {
            empresa_facturadora: {
                nombre: vp.expedientes?.empresas_facturadoras?.nombre,
                cif: vp.expedientes?.empresas_facturadoras?.cif,
            },
            compania: {
                nombre: vp.expedientes?.companias?.nombre,
            },
            expediente: {
                numero: vp.expedientes?.numero_expediente,
                tipo_siniestro: vp.expedientes?.tipo_siniestro,
            },
            fecha_generacion: new Date().toISOString().split('T')[0],
        },
        datos_encargo: informe.datos_encargo,
        datos_videoperitacion: informe.datos_videoperitacion,
        resumen_sesion: informe.resumen_sesion,
        evidencias_principales: informe.evidencias_principales,
        hallazgos: informe.hallazgos,
        conclusiones: informe.conclusiones,
        extractos_transcripcion: informe.extractos_transcripcion,
        resolucion_pericial: informe.resolucion_pericial,
        observaciones_finales: informe.observaciones_finales,
        valoracion: valoracion ? {
            baremo_nombre: valoracion.baremo_nombre,
            baremo_version: valoracion.baremo_version,
            importe_total: valoracion.importe_total,
            importe_baremo: valoracion.importe_baremo,
            importe_ajustado: valoracion.importe_ajustado,
            desviacion_total: valoracion.desviacion_total,
            lineas: (valoracion.vp_valoracion_lineas ?? []).map((l) => ({
                codigo: l.codigo,
                descripcion: l.descripcion,
                especialidad: l.especialidad,
                cantidad: l.cantidad,
                precio_unitario: l.precio_unitario_aplicado,
                importe: l.importe,
                es_ajuste: l.es_ajuste_manual,
                fuera_baremo: l.fuera_de_baremo,
            })),
        } : null,
        branding,
    };
    // Check existing version
    const { data: existing } = await supabase
        .from('vp_documento_final').select('version')
        .eq('videoperitacion_id', id).order('version', { ascending: false }).limit(1).maybeSingle();
    const newVersion = (existing?.version ?? 0) + 1;
    const nombreArchivo = `informe_vp_${vp.expedientes?.numero_expediente ?? id}_v${newVersion}.json`;
    const { data: doc, error: insertErr } = await supabase
        .from('vp_documento_final')
        .insert({
        videoperitacion_id: id,
        informe_id: informe.id,
        expediente_id: vp.expediente_id,
        version: newVersion,
        estado: 'generado',
        contenido_json,
        nombre_archivo: nombreArchivo,
        formato: 'json',
        config_branding: branding,
        generado_por: user.id,
    })
        .select().single();
    if (insertErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: insertErr.message } }, 500);
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Documento final VP generado (v${newVersion})`,
            prioridad: 'media', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_documento_final', registro_id: doc.id, accion: 'INSERT',
            actor_id: user.id, cambios: { version: newVersion, formato: 'json' },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'DocumentoFinalVpGenerado',
            payload: { documento_id: doc.id, version: newVersion },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: doc, error: null }, 201);
});
// ─── POST /:id/documento-final/regenerar ───────────────────────────
videoperitacionesRoutes.post('/:id/documento-final/regenerar', async (c) => {
    // Delegates to generar — same logic, bumps version
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const isAllowed = user.roles?.some((r) => ['admin', 'supervisor'].includes(r));
    if (!isAllowed)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Solo admin/supervisor pueden regenerar' } }, 403);
    // Mark previous as superseded (no state change, just audit)
    await supabase.from('auditoria').insert({
        tabla: 'vp_documento_final', registro_id: id, accion: 'UPDATE',
        actor_id: user.id, cambios: { action: 'regenerar_solicitado' },
    });
    // Forward to generar logic (simulated by re-calling the URL internally is not ideal,
    // so we duplicate the core logic inline)
    // ... In practice this endpoint just calls generar again. The version bump handles it.
    // For simplicity, return a message to call generar endpoint.
    return c.json({ data: null, error: { code: 'REDIRECT', message: 'Use POST /:id/documento-final/generar para regenerar (autoincrementa versión)' } }, 200);
});
// ─── GET /:id/facturacion ──────────────────────────────────────────
videoperitacionesRoutes.get('/:id/facturacion', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data: vpFactura } = await supabase
        .from('vp_facturas')
        .select('*, facturas!inner(*)')
        .eq('videoperitacion_id', id)
        .maybeSingle();
    return c.json({ data: vpFactura, error: null });
});
// ─── POST /:id/emitir-factura ──────────────────────────────────────
videoperitacionesRoutes.post('/:id/emitir-factura', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const isFinance = user.roles?.some((r) => ['admin', 'supervisor', 'financiero'].includes(r));
    if (!isFinance)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Solo admin/supervisor/financiero' } }, 403);
    const body = await c.req.json();
    if (!body.serie_id)
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'serie_id requerido' } }, 422);
    // Get VP with expediente
    const { data: vp } = await supabase
        .from('vp_videoperitaciones')
        .select('*, expedientes!inner(id, numero_expediente, estado, empresa_facturadora_id, compania_id)')
        .eq('id', id).single();
    if (!vp)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'VP no encontrada' } }, 404);
    // Precondition: informe validado
    const { count: informeCount } = await supabase
        .from('vp_informes').select('id', { count: 'exact', head: true })
        .eq('videoperitacion_id', id).eq('estado', 'validado');
    if (!informeCount)
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Requiere informe validado' } }, 422);
    // Precondition: valoracion calculada/validada
    const { data: valoracion } = await supabase
        .from('vp_valoraciones').select('*')
        .eq('videoperitacion_id', id).in('estado', ['calculada', 'validada']).maybeSingle();
    if (!valoracion)
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Requiere valoración calculada o validada' } }, 422);
    // Precondition: no existing VP factura
    const { count: existingCount } = await supabase
        .from('vp_facturas').select('id', { count: 'exact', head: true })
        .eq('videoperitacion_id', id);
    if (existingCount && existingCount > 0)
        return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe factura VP para esta videoperitación' } }, 409);
    // Get empresa facturadora
    const { data: empresa } = await supabase
        .from('empresas_facturadoras').select('id, nombre, cif')
        .eq('id', vp.expedientes?.empresa_facturadora_id).single();
    if (!empresa?.cif)
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Empresa facturadora sin CIF' } }, 422);
    // Get serie
    const { data: serie } = await supabase
        .from('series_facturacion').select('*')
        .eq('id', body.serie_id).eq('activa', true).single();
    if (!serie)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Serie no encontrada o inactiva' } }, 404);
    // Generate numero_factura
    const year = new Date().getFullYear();
    const newCounter = (serie.contador_actual ?? 0) + 1;
    const numero_factura = `${serie.prefijo}${year}-${String(newCounter).padStart(5, '0')}`;
    // Update serie counter with optimistic lock
    const { error: counterErr } = await supabase
        .from('series_facturacion')
        .update({ contador_actual: newCounter })
        .eq('id', serie.id)
        .eq('contador_actual', serie.contador_actual);
    if (counterErr)
        return c.json({ data: null, error: { code: 'CONFLICT', message: 'Error de concurrencia en numeración' } }, 409);
    // Calculate amounts from valoracion
    const base_imponible = valoracion.importe_total;
    const iva_porcentaje = body.iva_porcentaje ?? 21;
    const iva_importe = Math.round(base_imponible * iva_porcentaje) / 100;
    const total = Math.round((base_imponible + iva_importe) * 100) / 100;
    // Get dias vencimiento from compania config
    const { data: compania } = await supabase
        .from('companias').select('config').eq('id', vp.expedientes?.compania_id).maybeSingle();
    const diasVencimiento = compania?.config?.facturacion?.dias_vencimiento ?? 30;
    const fecha_emision = new Date().toISOString().split('T')[0];
    const vencDate = new Date();
    vencDate.setDate(vencDate.getDate() + diasVencimiento);
    const fecha_vencimiento = vencDate.toISOString().split('T')[0];
    // Create factura in ERP table
    const { data: factura, error: facturaErr } = await supabase
        .from('facturas')
        .insert({
        expediente_id: vp.expediente_id,
        numero_factura,
        empresa_facturadora_id: empresa.id,
        serie_id: serie.id,
        compania_id: vp.expedientes?.compania_id,
        fecha_emision,
        fecha_vencimiento,
        base_imponible,
        iva_porcentaje,
        iva_importe,
        total,
        estado: 'emitida',
        estado_cobro: 'pendiente',
        forma_pago: body.forma_pago ?? null,
        cuenta_bancaria: body.cuenta_bancaria ?? null,
        notas: body.notas ?? null,
        emitida_por: user.id,
        origen: 'videoperitacion',
    })
        .select().single();
    if (facturaErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: facturaErr.message } }, 500);
    // Copy valoracion lines to lineas_factura
    const { data: valLineas } = await supabase
        .from('vp_valoracion_lineas').select('*').eq('valoracion_id', valoracion.id).order('orden');
    if (valLineas && valLineas.length > 0) {
        await supabase.from('lineas_factura').insert(valLineas.map((l) => ({
            factura_id: factura.id,
            partida_baremo_id: l.partida_baremo_id,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario_aplicado,
            importe: l.importe,
        })));
    }
    // Create VP ↔ factura bridge
    const { data: vpFactura } = await supabase
        .from('vp_facturas')
        .insert({
        videoperitacion_id: id,
        factura_id: factura.id,
        expediente_id: vp.expediente_id,
        valoracion_id: valoracion.id,
        importe_valoracion: valoracion.importe_total,
        baremo_id: valoracion.baremo_id,
        baremo_version: valoracion.baremo_version,
        emitida_por: user.id,
        notas: body.notas ?? null,
    })
        .select().single();
    // Update VP estado
    await supabase.from('vp_videoperitaciones').update({ estado: 'facturado' }).eq('id', id);
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: `Factura VP emitida: ${numero_factura} (${total}€)`,
            prioridad: 'alta', referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_facturas', registro_id: vpFactura?.id ?? factura.id, accion: 'INSERT',
            actor_id: user.id, cambios: { numero_factura, total, base_imponible, serie_id: serie.id },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: 'FacturaVpEmitida',
            payload: { factura_id: factura.id, numero_factura, total, vp_factura_id: vpFactura?.id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { factura, vp_factura: vpFactura, numero_factura }, error: null }, 201);
});
// ─── POST /:id/enviar-informe ──────────────────────────────────────
videoperitacionesRoutes.post('/:id/enviar-informe', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const isAllowed = user.roles?.some((r) => ['admin', 'supervisor', 'financiero'].includes(r));
    if (!isAllowed)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
    const body = await c.req.json();
    // Get VP
    const { data: vp } = await supabase
        .from('vp_videoperitaciones')
        .select('*, expedientes!inner(id, compania_id, numero_expediente)')
        .eq('id', id).single();
    if (!vp)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'VP no encontrada' } }, 404);
    // Get latest document final
    const { data: doc } = await supabase
        .from('vp_documento_final').select('*')
        .eq('videoperitacion_id', id).eq('estado', 'generado')
        .order('version', { ascending: false }).limit(1).maybeSingle();
    if (!doc)
        return c.json({ data: null, error: { code: 'PRECONDITION', message: 'Se requiere documento final generado' } }, 422);
    // Get factura if exists
    const { data: vpFactura } = await supabase
        .from('vp_facturas').select('factura_id').eq('videoperitacion_id', id).maybeSingle();
    // Count previous attempts
    const { count: prevAttempts } = await supabase
        .from('vp_envios').select('id', { count: 'exact', head: true })
        .eq('videoperitacion_id', id);
    const canal = body.canal ?? 'email';
    const now = new Date().toISOString();
    // Create envio record
    const { data: envio, error: envioErr } = await supabase
        .from('vp_envios')
        .insert({
        videoperitacion_id: id,
        expediente_id: vp.expediente_id,
        documento_final_id: doc.id,
        factura_id: vpFactura?.factura_id ?? null,
        canal,
        destinatario_email: body.destinatario_email ?? null,
        destinatario_nombre: body.destinatario_nombre ?? null,
        estado: canal === 'manual' ? 'enviado' : 'enviando',
        intento_numero: (prevAttempts ?? 0) + 1,
        enviado_por: user.id,
    })
        .select().single();
    if (envioErr)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: envioErr.message } }, 500);
    // Attempt send (email or stub)
    let sendResult = { success: true, error: null, dryRun: false };
    if (canal === 'email' && body.destinatario_email) {
        try {
            // Use existing email service if available
            const apiKey = c.env.RESEND_API_KEY;
            if (apiKey) {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: 'noreply@erp.local',
                        to: body.destinatario_email,
                        subject: `Informe de videoperitación - ${vp.expedientes?.numero_expediente}`,
                        html: `<p>Adjunto informe de videoperitación para el expediente ${vp.expedientes?.numero_expediente}.</p><p>Documento: ${doc.nombre_archivo}</p>`,
                    }),
                });
                sendResult.success = res.ok;
                if (!res.ok)
                    sendResult.error = `HTTP ${res.status}`;
            }
            else {
                sendResult.dryRun = true;
            }
        }
        catch (err) {
            sendResult.success = false;
            sendResult.error = err.message ?? 'Error de envío';
        }
    }
    // Update envio with result
    const envioUpdate = {
        estado: sendResult.success ? 'enviado' : 'error',
        enviado_at: sendResult.success ? now : null,
        error_detalle: sendResult.error,
        metadata: { dry_run: sendResult.dryRun },
    };
    await supabase.from('vp_envios').update(envioUpdate).eq('id', envio.id);
    // Update VP estado if successful
    if (sendResult.success) {
        await supabase.from('vp_videoperitaciones').update({ estado: 'enviado' }).eq('id', id);
        // Update documento_final estado
        await supabase.from('vp_documento_final').update({ estado: 'enviado' }).eq('id', doc.id);
    }
    await Promise.all([
        supabase.from('comunicaciones').insert({
            expediente_id: vp.expediente_id, tipo: 'nota_interna', canal: 'sistema',
            descripcion: sendResult.success
                ? `Informe VP enviado por ${canal} a ${body.destinatario_email ?? 'destinatario'}`
                : `Error enviando informe VP: ${sendResult.error}`,
            prioridad: sendResult.success ? 'media' : 'alta',
            referencia_tipo: 'videoperitacion', referencia_id: id,
        }),
        supabase.from('auditoria').insert({
            tabla: 'vp_envios', registro_id: envio.id, accion: 'INSERT',
            actor_id: user.id, cambios: { canal, estado: envioUpdate.estado, intento: envio.intento_numero },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id, aggregate_type: 'videoperitacion',
            event_type: sendResult.success ? 'InformeVpEnviado' : 'InformeVpEnvioFallido',
            payload: { envio_id: envio.id, canal, error: sendResult.error },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { envio_id: envio.id, estado: envioUpdate.estado, dry_run: sendResult.dryRun }, error: null });
});
// ─── GET /:id/envios ──────────────────────────────────────────────
videoperitacionesRoutes.get('/:id/envios', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('vp_envios')
        .select('*')
        .eq('videoperitacion_id', id)
        .order('created_at', { ascending: false });
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
// ─── POST /:id/envios/:eid/reintentar ─────────────────────────────
videoperitacionesRoutes.post('/:id/envios/:eid/reintentar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const eid = c.req.param('eid');
    const isAllowed = user.roles?.some((r) => ['admin', 'supervisor', 'financiero'].includes(r));
    if (!isAllowed)
        return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'No autorizado' } }, 403);
    const { data: envio } = await supabase
        .from('vp_envios').select('*').eq('id', eid).single();
    if (!envio || envio.estado !== 'error') {
        return c.json({ data: null, error: { code: 'INVALID_STATE', message: 'Solo se pueden reintentar envíos con error' } }, 422);
    }
    // Reset to pending and increment attempt
    await supabase.from('vp_envios').update({
        estado: 'pendiente',
        intento_numero: envio.intento_numero + 1,
        error_detalle: null,
    }).eq('id', eid);
    await supabase.from('auditoria').insert({
        tabla: 'vp_envios', registro_id: eid, accion: 'UPDATE',
        actor_id: user.id, cambios: { action: 'reintentar', intento: envio.intento_numero + 1 },
    });
    return c.json({ data: { envio_id: eid, intento_numero: envio.intento_numero + 1, estado: 'pendiente' }, error: null });
});
