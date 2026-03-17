import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
export const presupuestosRoutes = new Hono();
// GET /presupuestos?expediente_id= — Listar presupuestos de un expediente
presupuestosRoutes.get('/', async (c) => {
    const supabase = c.get('supabase');
    const expediente_id = c.req.query('expediente_id');
    if (!expediente_id) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'expediente_id es requerido' } }, 422);
    }
    const { data, error } = await supabase
        .from('presupuestos')
        .select('*')
        .eq('expediente_id', expediente_id)
        .order('created_at', { ascending: false });
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json({ data, error: null });
});
// GET /presupuestos/:id — Detalle con líneas
presupuestosRoutes.get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { data, error } = await supabase
        .from('presupuestos')
        .select('*, lineas_presupuesto(*)')
        .eq('id', id)
        .single();
    if (error || !data) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } }, 404);
    }
    return c.json({ data, error: null });
});
// POST /presupuestos — Crear presupuesto
presupuestosRoutes.post('/', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const body = await c.req.json();
    if (!body.expediente_id) {
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'expediente_id es requerido' } }, 422);
    }
    // Auto-generate numero
    const year = new Date().getFullYear();
    const prefix = `PRES-${year}-`;
    const { data: last } = await supabase
        .from('presupuestos')
        .select('numero')
        .like('numero', `${prefix}%`)
        .order('numero', { ascending: false })
        .limit(1)
        .single();
    let seq = 1;
    if (last?.numero) {
        const lastSeq = parseInt(last.numero.replace(prefix, ''), 10);
        if (!isNaN(lastSeq))
            seq = lastSeq + 1;
    }
    const numero = `${prefix}${String(seq).padStart(5, '0')}`;
    const { data, error } = await supabase
        .from('presupuestos')
        .insert({
        expediente_id: body.expediente_id,
        parte_id: body.parte_id ?? null,
        numero,
        importe_total: 0,
        coste_estimado: 0,
        ingreso_estimado: 0,
        margen_previsto: 0,
        aprobado: false,
    })
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await insertAudit(supabase, {
        tabla: 'presupuestos',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: { numero, expediente_id: body.expediente_id, parte_id: body.parte_id ?? null },
    });
    return c.json({ data, error: null }, 201);
});
// POST /presupuestos/:id/lineas — Añadir línea
presupuestosRoutes.post('/:id/lineas', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const presupuesto_id = c.req.param('id');
    const body = await c.req.json();
    // Fetch parent presupuesto to get expediente_id
    const { data: presupuesto } = await supabase
        .from('presupuestos')
        .select('id, expediente_id')
        .eq('id', presupuesto_id)
        .single();
    if (!presupuesto) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } }, 404);
    }
    const cantidad = body.cantidad ?? 0;
    const precio_unitario = body.precio_unitario ?? 0;
    const descuento = body.descuento_porcentaje ?? 0;
    const iva = body.iva_porcentaje ?? 0;
    const importe = cantidad * precio_unitario * (1 - descuento / 100);
    const subtotal = importe * (1 + iva / 100);
    const { data, error } = await supabase
        .from('lineas_presupuesto')
        .insert({
        presupuesto_id,
        expediente_id: presupuesto.expediente_id,
        partida_baremo_id: body.partida_baremo_id ?? null,
        descripcion: body.descripcion,
        cantidad,
        precio_unitario,
        precio_operario: body.precio_operario ?? null,
        descuento_porcentaje: descuento,
        iva_porcentaje: iva,
        importe,
        subtotal,
    })
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await insertAudit(supabase, {
        tabla: 'lineas_presupuesto',
        registro_id: data.id,
        accion: 'INSERT',
        actor_id: user.id,
        cambios: { presupuesto_id, descripcion: body.descripcion, cantidad, precio_unitario, importe, subtotal },
    });
    return c.json({ data, error: null }, 201);
});
// PUT /presupuestos/:id/lineas/:lineaId — Actualizar línea
presupuestosRoutes.put('/:id/lineas/:lineaId', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const presupuesto_id = c.req.param('id');
    const lineaId = c.req.param('lineaId');
    const body = await c.req.json();
    // Fetch current linea to merge values
    const { data: current } = await supabase
        .from('lineas_presupuesto')
        .select('*')
        .eq('id', lineaId)
        .eq('presupuesto_id', presupuesto_id)
        .single();
    if (!current) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Línea no encontrada' } }, 404);
    }
    const cantidad = body.cantidad ?? current.cantidad;
    const precio_unitario = body.precio_unitario ?? current.precio_unitario;
    const descuento = body.descuento_porcentaje ?? current.descuento_porcentaje ?? 0;
    const iva = body.iva_porcentaje ?? current.iva_porcentaje ?? 0;
    const importe = cantidad * precio_unitario * (1 - descuento / 100);
    const subtotal = importe * (1 + iva / 100);
    const updatePayload = {
        ...body,
        cantidad,
        precio_unitario,
        descuento_porcentaje: descuento,
        iva_porcentaje: iva,
        importe,
        subtotal,
    };
    const { data, error } = await supabase
        .from('lineas_presupuesto')
        .update(updatePayload)
        .eq('id', lineaId)
        .eq('presupuesto_id', presupuesto_id)
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await insertAudit(supabase, {
        tabla: 'lineas_presupuesto',
        registro_id: lineaId,
        accion: 'UPDATE',
        actor_id: user.id,
        cambios: { ...body, importe, subtotal },
    });
    return c.json({ data, error: null });
});
// DELETE /presupuestos/:id/lineas/:lineaId — Eliminar línea
presupuestosRoutes.delete('/:id/lineas/:lineaId', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const presupuesto_id = c.req.param('id');
    const lineaId = c.req.param('lineaId');
    const { data: existing } = await supabase
        .from('lineas_presupuesto')
        .select('id')
        .eq('id', lineaId)
        .eq('presupuesto_id', presupuesto_id)
        .single();
    if (!existing) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Línea no encontrada' } }, 404);
    }
    const { error } = await supabase
        .from('lineas_presupuesto')
        .delete()
        .eq('id', lineaId)
        .eq('presupuesto_id', presupuesto_id);
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await insertAudit(supabase, {
        tabla: 'lineas_presupuesto',
        registro_id: lineaId,
        accion: 'DELETE',
        actor_id: user.id,
        cambios: { presupuesto_id },
    });
    return c.json({ data: { id: lineaId, deleted: true }, error: null });
});
// POST /presupuestos/:id/recalcular — Recalcular totales
presupuestosRoutes.post('/:id/recalcular', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { data: lineas, error: lineasError } = await supabase
        .from('lineas_presupuesto')
        .select('importe, subtotal, precio_operario, cantidad')
        .eq('presupuesto_id', id);
    if (lineasError)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: lineasError.message } }, 500);
    const importe_total = (lineas ?? []).reduce((sum, l) => sum + (l.subtotal ?? 0), 0);
    const coste_estimado = (lineas ?? []).reduce((sum, l) => sum + ((l.precio_operario ?? 0) * (l.cantidad ?? 0)), 0);
    const ingreso_estimado = importe_total;
    const margen_previsto = ingreso_estimado - coste_estimado;
    const { data, error } = await supabase
        .from('presupuestos')
        .update({ importe_total, coste_estimado, ingreso_estimado, margen_previsto })
        .eq('id', id)
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await insertAudit(supabase, {
        tabla: 'presupuestos',
        registro_id: id,
        accion: 'UPDATE',
        actor_id: user.id,
        cambios: { importe_total, coste_estimado, ingreso_estimado, margen_previsto, recalculado: true },
    });
    return c.json({ data, error: null });
});
// POST /presupuestos/:id/aprobar — Aprobar presupuesto
presupuestosRoutes.post('/:id/aprobar', async (c) => {
    const supabase = c.get('supabase');
    const user = c.get('user');
    const id = c.req.param('id');
    const { data: presupuesto } = await supabase
        .from('presupuestos')
        .select('id, expediente_id, aprobado')
        .eq('id', id)
        .single();
    if (!presupuesto) {
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Presupuesto no encontrado' } }, 404);
    }
    if (presupuesto.aprobado) {
        return c.json({ data: null, error: { code: 'INVALID_STATE', message: 'Presupuesto ya aprobado' } }, 422);
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('presupuestos')
        .update({
        aprobado: true,
        aprobado_por: user.id,
        aprobado_at: now,
    })
        .eq('id', id)
        .select()
        .single();
    if (error)
        return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    await Promise.all([
        insertAudit(supabase, {
            tabla: 'presupuestos',
            registro_id: id,
            accion: 'UPDATE',
            actor_id: user.id,
            cambios: { aprobado: true, aprobado_por: user.id, aprobado_at: now },
        }),
        insertDomainEvent(supabase, {
            aggregate_id: presupuesto.expediente_id,
            aggregate_type: 'expediente',
            event_type: 'PresupuestoAprobado',
            payload: { presupuesto_id: id },
            actor_id: user.id,
        }),
    ]);
    return c.json({ data, error: null });
});
