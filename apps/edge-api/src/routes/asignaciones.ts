import { Hono } from 'hono';
import type { Env } from '../types';
import { suggestTramitador } from '../services/assignment-engine';

export const asignacionesRoutes = new Hono<{ Bindings: Env }>();

// POST /asignaciones/asignar — asignar/reasignar un expediente
asignacionesRoutes.post('/asignar', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    expediente_id: string;
    tramitador_id: string;
    motivo?: string;
    motivo_codigo?: string;
    force?: boolean;
  }>();

  if (!body.expediente_id || !body.tramitador_id) {
    return c.json({
      data: null,
      error: { code: 'VALIDATION', message: 'expediente_id y tramitador_id son requeridos' },
    }, 422);
  }

  const { data, error } = await supabase.rpc('erp_asignar_tramitador', {
    p_expediente_id: body.expediente_id,
    p_tramitador_id: body.tramitador_id,
    p_motivo:        body.motivo        ?? null,
    p_motivo_codigo: body.motivo_codigo ?? null,
    p_actor_id:      user.id,
    p_force:         body.force         ?? false,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('expediente_not_found'))
      return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
    if (msg.includes('expediente_terminal_state'))
      return c.json({ data: null, error: { code: 'TERMINAL_STATE', message: 'No se puede asignar un expediente cerrado o cancelado' } }, 422);
    if (msg.includes('tramitador_not_found_or_inactive'))
      return c.json({ data: null, error: { code: 'TRAMITADOR_INACTIVO', message: 'Tramitador no encontrado o inactivo' } }, 422);
    if (msg.includes('tramitador_at_capacity'))
      return c.json({ data: null, error: { code: 'CAPACITY_EXCEEDED', message: msg } }, 422);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  // Refrescar vista materializada de forma no-bloqueante
  void supabase.rpc('refresh_carga_tramitadores_sync');

  return c.json({ data, error: null });
});

// POST /asignaciones/reasignar-masivo — reasignación masiva
asignacionesRoutes.post('/reasignar-masivo', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    tramitador_origen_id: string;
    tramitador_destino_id: string;
    expediente_ids: string[];
    motivo: string;
    motivo_codigo?: string;
  }>();

  if (!body.tramitador_destino_id || !body.expediente_ids?.length || !body.motivo?.trim()) {
    return c.json({
      data: null,
      error: { code: 'VALIDATION', message: 'tramitador_destino_id, expediente_ids y motivo son requeridos' },
    }, 422);
  }

  if (body.expediente_ids.length > 200) {
    return c.json({
      data: null,
      error: { code: 'VALIDATION', message: 'Máximo 200 expedientes por lote' },
    }, 422);
  }

  const { data, error } = await supabase.rpc('erp_reasignacion_masiva', {
    p_tramitador_origen_id:  body.tramitador_origen_id  ?? null,
    p_tramitador_destino_id: body.tramitador_destino_id,
    p_expediente_ids:        body.expediente_ids,
    p_motivo:                body.motivo,
    p_motivo_codigo:         body.motivo_codigo ?? null,
    p_actor_id:              user.id,
  });

  if (error) {
    if (error.message?.includes('tramitador_destino_not_found'))
      return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador destino no encontrado o inactivo' } }, 404);
    if (error.message?.includes('motivo_requerido'))
      return c.json({ data: null, error: { code: 'VALIDATION', message: 'El motivo es obligatorio en reasignación masiva' } }, 422);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  void supabase.rpc('refresh_carga_tramitadores_sync');

  return c.json({ data, error: null });
});

// GET /asignaciones/cola — expedientes sin tramitador asignado
asignacionesRoutes.get('/cola', async (c) => {
  const supabase = c.get('supabase');
  const empresaId = c.req.query('empresa_facturadora_id');
  const page = parseInt(c.req.query('page') ?? '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') ?? '20'), 100);
  const from = (page - 1) * perPage;

  let query = supabase
    .from('expedientes')
    .select(
      '*, companias(nombre, codigo), asegurados(nombre, apellidos, telefono)',
      { count: 'exact' }
    )
    .in('estado', ['NUEVO', 'NO_ASIGNADO']);

  if (empresaId) query = query.eq('empresa_facturadora_id', empresaId);

  query = query
    .order('prioridad', { ascending: false })
    .order('fecha_limite_sla', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .range(from, from + perPage - 1);

  const { data, error, count } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  return c.json({
    data: {
      items: data ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    },
    error: null,
  });
});

// GET /asignaciones/historial — historial completo con filtros
asignacionesRoutes.get('/historial', async (c) => {
  const supabase = c.get('supabase');
  const tramitadorId = c.req.query('tramitador_id');
  const expedienteId = c.req.query('expediente_id');
  const tipo = c.req.query('tipo');
  const batchId = c.req.query('batch_id');
  const page = parseInt(c.req.query('page') ?? '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') ?? '30'), 100);
  const from = (page - 1) * perPage;

  let query = supabase
    .from('historial_asignaciones')
    .select(
      `*, expedientes(numero_expediente, estado, compania_id, companias(nombre)),
       tramitador_anterior:tramitadores!tramitador_anterior_id(nombre, apellidos),
       tramitador_nuevo:tramitadores!tramitador_nuevo_id(nombre, apellidos)`,
      { count: 'exact' }
    );

  if (tramitadorId) {
    query = query.or(`tramitador_nuevo_id.eq.${tramitadorId},tramitador_anterior_id.eq.${tramitadorId}`);
  }
  if (expedienteId) query = query.eq('expediente_id', expedienteId);
  if (tipo)         query = query.eq('tipo', tipo);
  if (batchId)      query = query.eq('batch_id', batchId);

  query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);

  const { data, error, count } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  return c.json({
    data: { items: data ?? [], total: count ?? 0, page, per_page: perPage },
    error: null,
  });
});

// GET /asignaciones/sugerencias/:expedienteId — top sugerencias del motor
asignacionesRoutes.get('/sugerencias/:expedienteId', async (c) => {
  const supabase = c.get('supabase');
  const expedienteId = c.req.param('expedienteId');

  // Obtener datos del expediente
  const { data: exp, error: expError } = await supabase
    .from('expedientes')
    .select('id, compania_id, tipo_siniestro, prioridad, codigo_postal, empresa_facturadora_id')
    .eq('id', expedienteId)
    .single();

  if (expError || !exp) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
  }

  const sugerencias = await suggestTramitador(exp, supabase, 3);
  return c.json({ data: sugerencias, error: null });
});

// ─── Reglas de reparto ────────────────────────────────────────

// GET /asignaciones/reglas-reparto
asignacionesRoutes.get('/reglas-reparto', async (c) => {
  const supabase = c.get('supabase');
  const empresaId = c.req.query('empresa_facturadora_id');

  let query = supabase
    .from('reglas_reparto')
    .select('*, empresas_facturadoras(nombre)')
    .order('prioridad_orden', { ascending: true });

  if (empresaId) query = query.or(`empresa_facturadora_id.eq.${empresaId},empresa_facturadora_id.is.null`);

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: data ?? [], error: null });
});

// POST /asignaciones/reglas-reparto
asignacionesRoutes.post('/reglas-reparto', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<any>();

  if (!body.nombre || !body.tipo) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'nombre y tipo son requeridos' } }, 422);
  }

  const { data, error } = await supabase
    .from('reglas_reparto')
    .insert({
      empresa_facturadora_id: body.empresa_facturadora_id ?? null,
      nombre:          body.nombre,
      descripcion:     body.descripcion ?? null,
      tipo:            body.tipo,
      activa:          body.activa ?? false,
      prioridad_orden: body.prioridad_orden ?? 0,
      config:          body.config ?? {},
      created_by:      user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505')
      return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe una regla activa para esta empresa' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  return c.json({ data, error: null }, 201);
});

// PUT /asignaciones/reglas-reparto/:id
asignacionesRoutes.put('/reglas-reparto/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  const patch: Record<string, any> = {};
  const fields = ['nombre', 'descripcion', 'tipo', 'prioridad_orden', 'config'];
  for (const f of fields) { if (f in body) patch[f] = body[f]; }

  const { data, error } = await supabase
    .from('reglas_reparto')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Regla no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// POST /asignaciones/reglas-reparto/:id/activar — activar regla (desactiva otras del mismo tenant)
asignacionesRoutes.post('/reglas-reparto/:id/activar', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data: regla } = await supabase
    .from('reglas_reparto')
    .select('id, empresa_facturadora_id')
    .eq('id', id)
    .single();

  if (!regla) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Regla no encontrada' } }, 404);

  // Desactivar otras reglas del mismo tenant
  let deactivateQuery = supabase
    .from('reglas_reparto')
    .update({ activa: false })
    .neq('id', id);

  if (regla.empresa_facturadora_id) {
    deactivateQuery = deactivateQuery.eq('empresa_facturadora_id', regla.empresa_facturadora_id);
  } else {
    deactivateQuery = deactivateQuery.is('empresa_facturadora_id', null);
  }
  await deactivateQuery;

  // Activar la seleccionada
  const { data, error } = await supabase
    .from('reglas_reparto')
    .update({ activa: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// DELETE /asignaciones/reglas-reparto/:id
asignacionesRoutes.delete('/reglas-reparto/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { error } = await supabase.from('reglas_reparto').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: { deleted: true }, error: null });
});

// POST /asignaciones/reglas-reparto/:id/test — dry-run en cola actual
asignacionesRoutes.post('/reglas-reparto/:id/test', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data: regla } = await supabase.from('reglas_reparto').select('*').eq('id', id).single();
  if (!regla) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Regla no encontrada' } }, 404);

  // Tomar hasta 10 expedientes de la cola sin tramitador
  const { data: cola } = await supabase
    .from('expedientes')
    .select('id, numero_expediente, compania_id, tipo_siniestro, prioridad, codigo_postal, empresa_facturadora_id')
    .is('tramitador_id', null)
    .not('estado', 'in', '(CERRADO,CANCELADO,COBRADO,FACTURADO)')
    .limit(10);

  const preview = await Promise.all(
    (cola ?? []).map(async (exp: any) => {
      const sugerencias = await suggestTramitador(exp, supabase, 1);
      return {
        expediente_id:    exp.id,
        numero:           exp.numero_expediente,
        sugerencia:       sugerencias[0] ?? null,
      };
    })
  );

  return c.json({ data: { regla: regla.nombre, tipo: regla.tipo, preview }, error: null });
});
