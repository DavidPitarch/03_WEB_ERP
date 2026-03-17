import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import { sendPedidoEmail } from '../services/email-sender';
export const pedidosRoutes = new Hono();
function err(code, message) {
    return { data: null, error: { code, message } };
}
// Helper: insert historial_pedido
async function insertHistorialPedido(supabase, params) {
    await supabase.from('historial_pedido').insert({
        pedido_id: params.pedido_id,
        estado_anterior: params.estado_anterior,
        estado_nuevo: params.estado_nuevo,
        motivo: params.motivo ?? null,
        actor_id: params.actor_id,
    });
}
// ═══════════════════════════════════════════════════════════════════════════
// Static routes FIRST (before /:id)
// ═══════════════════════════════════════════════════════════════════════════
// ─── GET /pedidos/a-recoger — Bandeja pedidos a recoger ─────────────────────
pedidosRoutes.get('/a-recoger', async (c) => {
    const supabase = c.get('supabase');
    const proveedor_id = c.req.query('proveedor_id');
    const expediente_id = c.req.query('expediente_id');
    let query = supabase.from('v_pedidos_a_recoger').select('*');
    if (proveedor_id)
        query = query.eq('proveedor_id', proveedor_id);
    if (expediente_id)
        query = query.eq('expediente_id', expediente_id);
    const { data, error } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// ─── GET /pedidos/caducados — Bandeja pedidos caducados ─────────────────────
pedidosRoutes.get('/caducados', async (c) => {
    const supabase = c.get('supabase');
    const proveedor_id = c.req.query('proveedor_id');
    const compania_id = c.req.query('compania_id');
    const dias_min = c.req.query('dias_min');
    let query = supabase.from('v_pedidos_caducados').select('*');
    if (proveedor_id)
        query = query.eq('proveedor_id', proveedor_id);
    if (compania_id)
        query = query.eq('compania_id', compania_id);
    if (dias_min)
        query = query.gte('dias_caducado', Number(dias_min));
    const { data, error } = await query;
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    return c.json({ data, error: null });
});
// ─── POST /pedidos/detectar-caducados — Watchdog ────────────────────────────
pedidosRoutes.post('/detectar-caducados', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const now = new Date().toISOString();
    const { data: caducados, error } = await supabase
        .from('pedidos_material')
        .select('id, estado')
        .in('estado', ['pendiente', 'enviado'])
        .lt('fecha_limite', now);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    for (const pedido of caducados ?? []) {
        await supabase
            .from('pedidos_material')
            .update({ estado: 'caducado', caducado_at: now })
            .eq('id', pedido.id);
        await insertHistorialPedido(supabase, {
            pedido_id: pedido.id,
            estado_anterior: pedido.estado,
            estado_nuevo: 'caducado',
            actor_id: user.id,
        });
        await insertDomainEvent(supabase, {
            aggregate_id: pedido.id,
            aggregate_type: 'pedido',
            event_type: 'PedidoCaducado',
            payload: { estado_anterior: pedido.estado },
            actor_id: user.id,
        });
    }
    return c.json({ data: { count: (caducados ?? []).length }, error: null });
});
// ═══════════════════════════════════════════════════════════════════════════
// Dynamic routes
// ═══════════════════════════════════════════════════════════════════════════
// ─── GET /pedidos — Listado paginado ────────────────────────────────────────
pedidosRoutes.get('/', async (c) => {
    const supabase = c.get('supabase');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
    const expediente_id = c.req.query('expediente_id');
    const proveedor_id = c.req.query('proveedor_id');
    const estado = c.req.query('estado');
    let query = supabase
        .from('pedidos_material')
        .select('*, proveedores(nombre), expedientes(numero_expediente)', { count: 'exact' });
    if (expediente_id)
        query = query.eq('expediente_id', expediente_id);
    if (proveedor_id)
        query = query.eq('proveedor_id', proveedor_id);
    if (estado)
        query = query.eq('estado', estado);
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
// ─── GET /pedidos/:id — Detalle ─────────────────────────────────────────────
pedidosRoutes.get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('pedidos_material')
        .select('*, proveedores(*), expedientes(numero_expediente, estado), lineas:lineas_pedido(*), historial:historial_pedido(*)')
        .eq('id', id)
        .single();
    if (error || !data)
        return c.json(err('NOT_FOUND', 'Pedido no encontrado'), 404);
    return c.json({ data, error: null });
});
// ─── POST /pedidos — Crear pedido ───────────────────────────────────────────
pedidosRoutes.post('/', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    // Validaciones
    if (!body.expediente_id)
        return c.json(err('VALIDATION', 'expediente_id es requerido'), 422);
    if (!body.proveedor_id)
        return c.json(err('VALIDATION', 'proveedor_id es requerido'), 422);
    if (!body.lineas || body.lineas.length === 0) {
        return c.json(err('VALIDATION', 'Se requiere al menos una línea'), 422);
    }
    // Generar numero_pedido: PED-{year}-{seq 5 digits}
    const year = new Date().getFullYear();
    const { count } = await supabase
        .from('pedidos_material')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${year}-01-01`);
    const seq = String((count ?? 0) + 1).padStart(5, '0');
    const numero_pedido = `PED-${year}-${seq}`;
    // Insert pedido
    const { lineas, ...pedidoData } = body;
    const { data: pedido, error: pedidoErr } = await supabase
        .from('pedidos_material')
        .insert({
        ...pedidoData,
        numero_pedido,
        estado: 'pendiente',
    })
        .select()
        .single();
    if (pedidoErr)
        return c.json(err('DB_ERROR', pedidoErr.message), 500);
    // Insert lineas
    const lineasInsert = lineas.map((l) => ({
        ...l,
        pedido_id: pedido.id,
    }));
    const { error: lineasErr } = await supabase.from('lineas_pedido').insert(lineasInsert);
    if (lineasErr)
        return c.json(err('DB_ERROR', lineasErr.message), 500);
    // Historial + audit + domain event
    await Promise.all([
        insertHistorialPedido(supabase, {
            pedido_id: pedido.id,
            estado_anterior: null,
            estado_nuevo: 'pendiente',
            actor_id: user.id,
        }),
        insertAudit(supabase, {
            tabla: 'pedidos_material',
            registro_id: pedido.id,
            accion: 'INSERT',
            actor_id: user.id,
            cambios: { numero_pedido, expediente_id: body.expediente_id, proveedor_id: body.proveedor_id },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: pedido.id,
            aggregate_type: 'pedido',
            event_type: 'PedidoCreado',
            payload: { numero_pedido, expediente_id: body.expediente_id, proveedor_id: body.proveedor_id, lineas_count: lineas.length },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: pedido, error: null }, 201);
});
// ─── POST /pedidos/:id/enviar — Enviar a proveedor ─────────────────────────
pedidosRoutes.post('/:id/enviar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const now = new Date().toISOString();
    const { data: pedido } = await supabase
        .from('pedidos_material')
        .select('id, estado, numero_pedido')
        .eq('id', id)
        .single();
    if (!pedido)
        return c.json(err('NOT_FOUND', 'Pedido no encontrado'), 404);
    const token_confirmacion = crypto.randomUUID();
    const token_expira_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
        .from('pedidos_material')
        .update({
        estado: 'enviado',
        enviado_at: now,
        enviado_por: user.id,
        token_confirmacion,
        token_expira_at,
    })
        .eq('id', id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await Promise.all([
        insertHistorialPedido(supabase, {
            pedido_id: id,
            estado_anterior: pedido.estado,
            estado_nuevo: 'enviado',
            actor_id: user.id,
        }),
        insertAudit(supabase, {
            tabla: 'pedidos_material',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { estado: 'enviado', enviado_at: now },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'pedido',
            event_type: 'PedidoEnviado',
            payload: { token_confirmacion },
            actor_id: user.id,
        }),
    ]);
    const baseUrl = c.env.CONFIRM_BASE_URL ?? 'https://erp.example.com';
    const magic_link = `${baseUrl}/api/v1/public/pedidos/${id}/confirmar?token=${token_confirmacion}`;
    const { data: pedidoDetail } = await supabase
        .from('pedidos_material')
        .select('numero_pedido, proveedores(nombre, email), expedientes(numero_expediente), lineas:lineas_pedido(descripcion, cantidad, unidad)')
        .eq('id', id)
        .single();
    let email_result = null;
    const proveedor = pedidoDetail?.proveedores;
    const expediente = pedidoDetail?.expedientes;
    const lineas = (pedidoDetail?.lineas ?? []);
    if (proveedor?.email) {
        email_result = await sendPedidoEmail(supabase, c.env.RESEND_API_KEY, {
            id,
            numero_pedido: pedidoDetail?.numero_pedido ?? pedido.numero_pedido,
            proveedor_email: proveedor.email,
            proveedor_nombre: proveedor.nombre ?? 'Proveedor',
            expediente_numero: expediente?.numero_expediente ?? 'N/A',
            lineas,
            magic_link,
        }, user.id);
    }
    return c.json({ data: { token_confirmacion, magic_link, email_result }, error: null });
});
// ─── POST /pedidos/:id/confirmar — Confirmación pública del proveedor ───────
// NOTE: This endpoint should be mounted WITHOUT auth middleware in production.
// It is a public magic-link endpoint accessed by suppliers. When wiring routes
// in the main app, mount this route on a public router (no auth middleware).
pedidosRoutes.post('/:id/confirmar', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { token } = await c.req.json();
    if (!token)
        return c.json(err('VALIDATION', 'token es requerido'), 422);
    const { data: pedido } = await supabase
        .from('pedidos_material')
        .select('id, estado, token_confirmacion, token_expira_at, proveedor_id, numero_pedido')
        .eq('id', id)
        .single();
    if (!pedido)
        return c.json(err('NOT_FOUND', 'Pedido no encontrado'), 404);
    // Validate token
    if (pedido.token_confirmacion !== token) {
        return c.json(err('TOKEN_INVALIDO', 'El token de confirmación no es válido'), 422);
    }
    if (new Date(pedido.token_expira_at) < new Date()) {
        return c.json(err('TOKEN_EXPIRADO', 'El token de confirmación ha expirado'), 422);
    }
    if (pedido.estado !== 'enviado') {
        return c.json(err('ESTADO_INVALIDO', 'El pedido ya ha sido confirmado o no está en estado enviado'), 422);
    }
    const now = new Date().toISOString();
    // Update pedido
    const { error } = await supabase
        .from('pedidos_material')
        .update({ estado: 'confirmado', confirmado_at: now })
        .eq('id', id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    // Insert confirmacion_proveedor record
    await supabase.from('confirmaciones_proveedor').insert({
        pedido_id: id,
        proveedor_id: pedido.proveedor_id,
        confirmado_at: now,
        token_usado: token,
    });
    // Use a system actor for public endpoints
    const systemActorId = '00000000-0000-0000-0000-000000000000';
    await Promise.all([
        insertHistorialPedido(supabase, {
            pedido_id: id,
            estado_anterior: 'enviado',
            estado_nuevo: 'confirmado',
            actor_id: systemActorId,
        }),
        insertAudit(supabase, {
            tabla: 'pedidos_material',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: systemActorId,
            cambios: { estado: 'confirmado', confirmado_at: now },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'pedido',
            event_type: 'PedidoConfirmado',
            payload: { numero_pedido: pedido.numero_pedido, proveedor_id: pedido.proveedor_id },
            actor_id: systemActorId,
        }),
    ]);
    return c.json({ data: { message: 'Pedido confirmado correctamente' }, error: null });
});
// ─── POST /pedidos/:id/listo — Marcar listo para recoger ────────────────────
pedidosRoutes.post('/:id/listo', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { data: pedido } = await supabase
        .from('pedidos_material')
        .select('id, estado')
        .eq('id', id)
        .single();
    if (!pedido)
        return c.json(err('NOT_FOUND', 'Pedido no encontrado'), 404);
    const { error } = await supabase
        .from('pedidos_material')
        .update({ estado: 'listo_para_recoger' })
        .eq('id', id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await Promise.all([
        insertHistorialPedido(supabase, {
            pedido_id: id,
            estado_anterior: pedido.estado,
            estado_nuevo: 'listo_para_recoger',
            actor_id: user.id,
        }),
        insertAudit(supabase, {
            tabla: 'pedidos_material',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { estado: 'listo_para_recoger' },
        }),
    ]);
    return c.json({ data: { id, estado: 'listo_para_recoger' }, error: null });
});
// ─── POST /pedidos/:id/recoger — Marcar como recogido ──────────────────────
pedidosRoutes.post('/:id/recoger', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const now = new Date().toISOString();
    const { data: pedido } = await supabase
        .from('pedidos_material')
        .select('id, estado, numero_pedido')
        .eq('id', id)
        .single();
    if (!pedido)
        return c.json(err('NOT_FOUND', 'Pedido no encontrado'), 404);
    const { error } = await supabase
        .from('pedidos_material')
        .update({ estado: 'recogido', recogido_at: now, recogido_por: user.id })
        .eq('id', id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await Promise.all([
        insertHistorialPedido(supabase, {
            pedido_id: id,
            estado_anterior: pedido.estado,
            estado_nuevo: 'recogido',
            actor_id: user.id,
        }),
        insertAudit(supabase, {
            tabla: 'pedidos_material',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { estado: 'recogido', recogido_at: now, recogido_por: user.id },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'pedido',
            event_type: 'PedidoRecogido',
            payload: { numero_pedido: pedido.numero_pedido, recogido_por: user.id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { id, estado: 'recogido' }, error: null });
});
// ─── POST /pedidos/:id/cancelar — Cancelar pedido ──────────────────────────
pedidosRoutes.post('/:id/cancelar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { motivo } = await c.req.json();
    if (!motivo)
        return c.json(err('VALIDATION', 'motivo es requerido'), 422);
    const { data: pedido } = await supabase
        .from('pedidos_material')
        .select('id, estado, numero_pedido')
        .eq('id', id)
        .single();
    if (!pedido)
        return c.json(err('NOT_FOUND', 'Pedido no encontrado'), 404);
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('pedidos_material')
        .update({ estado: 'cancelado', cancelado_at: now, cancelado_motivo: motivo })
        .eq('id', id);
    if (error)
        return c.json(err('DB_ERROR', error.message), 500);
    await Promise.all([
        insertHistorialPedido(supabase, {
            pedido_id: id,
            estado_anterior: pedido.estado,
            estado_nuevo: 'cancelado',
            motivo,
            actor_id: user.id,
        }),
        insertAudit(supabase, {
            tabla: 'pedidos_material',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { estado: 'cancelado', cancelado_at: now, cancelado_motivo: motivo },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: id,
            aggregate_type: 'pedido',
            event_type: 'PedidoCancelado',
            payload: { numero_pedido: pedido.numero_pedido, motivo },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data: { id, estado: 'cancelado' }, error: null });
});
