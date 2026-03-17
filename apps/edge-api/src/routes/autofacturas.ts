import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import type { Env } from '../types';

export const autofacturasRoutes = new Hono<{ Bindings: Env }>();

// ─── Helper ────────────────────────────────────────────────────────────────
function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

// ═══════════════════════════════════════════════════════════════════════════
// Static routes FIRST (before /:id)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /autofacturas/liquidables — Operarios liquidables ────────────────
autofacturasRoutes.get('/liquidables', async (c) => {
  const supabase = c.get('supabase');
  const operario_id = c.req.query('operario_id');
  const periodo_desde = c.req.query('periodo_desde');
  const periodo_hasta = c.req.query('periodo_hasta');

  // Try view first, fallback to inline query
  let query = supabase.from('v_operarios_liquidables').select('*');
  if (operario_id) query = query.eq('operario_id', operario_id);
  if (periodo_desde) query = query.gte('periodo_desde', periodo_desde);
  if (periodo_hasta) query = query.lte('periodo_hasta', periodo_hasta);

  const { data, error } = await query;

  if (error) {
    // Fallback: inline query
    let opQuery = supabase
      .from('operarios')
      .select('id, nombre, apellidos, nif')
      .eq('es_subcontratado', true);

    if (operario_id) opQuery = opQuery.eq('id', operario_id);

    const { data: operarios, error: opErr } = await opQuery;
    if (opErr) return c.json(err('DB_ERROR', opErr.message), 500);

    const results: any[] = [];
    for (const op of operarios ?? []) {
      let partesQuery = supabase
        .from('partes_operario')
        .select('id')
        .eq('operario_id', op.id)
        .eq('validacion_estado', 'validado');

      if (periodo_desde) partesQuery = partesQuery.gte('fecha', periodo_desde);
      if (periodo_hasta) partesQuery = partesQuery.lte('fecha', periodo_hasta);

      // Exclude partes already in autofactura lineas
      const { data: partes } = await partesQuery;
      if (partes && partes.length > 0) {
        const parteIds = partes.map((p: any) => p.id);
        const { data: usados } = await supabase
          .from('lineas_autofactura')
          .select('parte_id')
          .in('parte_id', parteIds);

        const usadoIds = new Set((usados ?? []).map((u: any) => u.parte_id));
        const pendientes = parteIds.filter((id: string) => !usadoIds.has(id));

        if (pendientes.length > 0) {
          results.push({
            operario_id: op.id,
            nombre: op.nombre,
            apellidos: op.apellidos,
            nif: op.nif,
            partes_pendientes: pendientes.length,
            importe_estimado: null, // Would need lineas_presupuesto join
          });
        }
      }
    }

    return c.json({ data: results, error: null });
  }

  return c.json({ data, error: null });
});

// ─── POST /autofacturas/generar — Generate autofactura proposal ──────────
autofacturasRoutes.post('/generar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    operario_id: string;
    periodo_desde: string;
    periodo_hasta: string;
  }>();

  if (!body.operario_id || !body.periodo_desde || !body.periodo_hasta) {
    return c.json(err('VALIDATION', 'operario_id, periodo_desde y periodo_hasta requeridos'), 422);
  }

  // 1. Validate operario is subcontratado
  const { data: operario } = await supabase
    .from('operarios')
    .select('id, nombre, apellidos, nif, es_subcontratado')
    .eq('id', body.operario_id)
    .single();

  if (!operario) return c.json(err('NOT_FOUND', 'Operario no encontrado'), 404);
  if (!operario.es_subcontratado) {
    return c.json(err('NO_SUBCONTRATADO', 'El operario no es subcontratado'), 422);
  }

  // 2. Find partes validados in period not already in lineas_autofactura
  const { data: partes, error: partesErr } = await supabase
    .from('partes_operario')
    .select('id, expediente_id, fecha')
    .eq('operario_id', body.operario_id)
    .eq('validacion_estado', 'validado')
    .gte('fecha', body.periodo_desde)
    .lte('fecha', body.periodo_hasta);

  if (partesErr) return c.json(err('DB_ERROR', partesErr.message), 500);

  if (!partes || partes.length === 0) {
    return c.json(err('SIN_PARTES', 'No hay partes validados en el periodo indicado'), 422);
  }

  const parteIds = partes.map((p: any) => p.id);

  // Exclude partes already included in another autofactura
  const { data: usados } = await supabase
    .from('lineas_autofactura')
    .select('parte_id')
    .in('parte_id', parteIds);

  const usadoIds = new Set((usados ?? []).map((u: any) => u.parte_id));
  const partesNuevos = partes.filter((p: any) => !usadoIds.has(p.id));

  if (partesNuevos.length === 0) {
    return c.json(err('SIN_PARTES', 'Todos los partes del periodo ya están incluidos en otra autofactura'), 422);
  }

  // 3. Calculate amounts from lineas_presupuesto (precio_operario * cantidad)
  const parteNuevoIds = partesNuevos.map((p: any) => p.id);
  const { data: lineasPres } = await supabase
    .from('lineas_presupuesto')
    .select('parte_id, precio_operario, cantidad, descripcion')
    .in('parte_id', parteNuevoIds);

  const lineas: Array<{ parte_id: string; descripcion: string; importe: number }> = [];
  let totalImporte = 0;

  for (const lp of (lineasPres ?? []) as any[]) {
    const importe = (lp.precio_operario ?? 0) * (lp.cantidad ?? 1);
    lineas.push({
      parte_id: lp.parte_id,
      descripcion: lp.descripcion ?? '',
      importe: Math.round(importe * 100) / 100,
    });
    totalImporte += importe;
  }

  totalImporte = Math.round(totalImporte * 100) / 100;

  // 4. Generate numero: AF-{year}-{seq 5 digits}
  const year = new Date().getFullYear();
  const { count: existingCount } = await supabase
    .from('autofacturas')
    .select('id', { count: 'exact', head: true })
    .like('numero', `AF-${year}-%`);

  const seq = (existingCount ?? 0) + 1;
  const numero = `AF-${year}-${String(seq).padStart(5, '0')}`;

  // 5. Create autofactura in 'borrador' + lineas
  const { data: autofactura, error: afErr } = await supabase
    .from('autofacturas')
    .insert({
      numero,
      operario_id: body.operario_id,
      periodo_desde: body.periodo_desde,
      periodo_hasta: body.periodo_hasta,
      importe_total: totalImporte,
      estado: 'borrador',
      creada_por: user.id,
    })
    .select()
    .single();

  if (afErr) return c.json(err('DB_ERROR', afErr.message), 500);

  // Insert lineas
  if (lineas.length > 0) {
    const lineasInsert = lineas.map((l) => ({
      autofactura_id: autofactura.id,
      parte_id: l.parte_id,
      descripcion: l.descripcion,
      importe: l.importe,
    }));

    await supabase.from('lineas_autofactura').insert(lineasInsert);
  }

  // 6. Audit + domain event
  await Promise.all([
    insertAudit(supabase, {
      tabla: 'autofacturas',
      registro_id: autofactura.id,
      accion: 'INSERT',
      actor_id: user.id,
      cambios: { numero, operario_id: body.operario_id, importe_total: totalImporte },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: autofactura.id,
      aggregate_type: 'autofactura',
      event_type: 'AutofacturaGenerada',
      payload: {
        numero,
        operario_id: body.operario_id,
        operario_nombre: `${operario.nombre} ${operario.apellidos}`,
        importe_total: totalImporte,
        num_partes: partesNuevos.length,
      },
      actor_id: user.id,
    }),
  ]);

  return c.json({ data: autofactura, error: null }, 201);
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /autofacturas — List autofacturas
// ═══════════════════════════════════════════════════════════════════════════
autofacturasRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const operario_id = c.req.query('operario_id');
  const estado = c.req.query('estado');
  const periodo_desde = c.req.query('periodo_desde');
  const periodo_hasta = c.req.query('periodo_hasta');

  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const per_page = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 50));
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;

  let query = supabase
    .from('autofacturas')
    .select('*, operarios(nombre, apellidos)', { count: 'exact' });

  if (operario_id) query = query.eq('operario_id', operario_id);
  if (estado) query = query.eq('estado', estado);
  if (periodo_desde) query = query.gte('periodo_desde', periodo_desde);
  if (periodo_hasta) query = query.lte('periodo_hasta', periodo_hasta);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data, error: null, pagination: { page, per_page, total: count ?? 0 } });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /autofacturas/:id — Detail
// ═══════════════════════════════════════════════════════════════════════════
autofacturasRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('autofacturas')
    .select('*, lineas_autofactura(*), operarios(nombre, apellidos, nif)')
    .eq('id', id)
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Autofactura no encontrada'), 404);
  return c.json({ data, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /autofacturas/:id/revisar — Mark as reviewed
// ═══════════════════════════════════════════════════════════════════════════
autofacturasRoutes.post('/:id/revisar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data: af } = await supabase
    .from('autofacturas')
    .select('id, estado')
    .eq('id', id)
    .single();

  if (!af) return c.json(err('NOT_FOUND', 'Autofactura no encontrada'), 404);

  const { data: updated, error } = await supabase
    .from('autofacturas')
    .update({ estado: 'revisada' })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'autofacturas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado: 'revisada', estado_anterior: af.estado },
  });

  return c.json({ data: updated, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /autofacturas/:id/emitir — Emit
// ═══════════════════════════════════════════════════════════════════════════
autofacturasRoutes.post('/:id/emitir', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data: af } = await supabase
    .from('autofacturas')
    .select('id, estado, numero, operario_id, importe_total')
    .eq('id', id)
    .single();

  if (!af) return c.json(err('NOT_FOUND', 'Autofactura no encontrada'), 404);
  if (af.estado !== 'revisada') {
    return c.json(err('ESTADO_INVALIDO', 'La autofactura debe estar en estado revisada para poder emitirla'), 422);
  }

  const now = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('autofacturas')
    .update({
      estado: 'emitida',
      emitida_at: now,
      emitida_por: user.id,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'autofacturas',
      registro_id: id,
      accion: 'UPDATE',
      actor_id: user.id,
      cambios: { estado: 'emitida', emitida_at: now },
    }),
    insertDomainEvent(supabase, {
      aggregate_id: id,
      aggregate_type: 'autofactura',
      event_type: 'AutofacturaEmitida',
      payload: { numero: af.numero, operario_id: af.operario_id, importe_total: af.importe_total },
      actor_id: user.id,
    }),
  ]);

  return c.json({ data: updated, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /autofacturas/:id/anular — Cancel
// ═══════════════════════════════════════════════════════════════════════════
autofacturasRoutes.post('/:id/anular', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ motivo: string }>();

  if (!body.motivo) return c.json(err('VALIDATION', 'motivo es requerido'), 422);

  const { data: af } = await supabase
    .from('autofacturas')
    .select('id, estado, numero')
    .eq('id', id)
    .single();

  if (!af) return c.json(err('NOT_FOUND', 'Autofactura no encontrada'), 404);

  const { data: updated, error } = await supabase
    .from('autofacturas')
    .update({
      estado: 'anulada',
      anulada_motivo: body.motivo,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'autofacturas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { estado: 'anulada', anulada_motivo: body.motivo },
  });

  return c.json({ data: updated, error: null });
});
