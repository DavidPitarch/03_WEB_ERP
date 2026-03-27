import { Hono } from 'hono';
import type { Env } from '../types';

export const tramitadoresRoutes = new Hono<{ Bindings: Env }>();

// GET /tramitadores — lista con carga actual + roles (Permisos)
tramitadoresRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const empresaId = c.req.query('empresa_facturadora_id');
  const activo = c.req.query('activo');

  let query = supabase
    .from('v_carga_tramitadores')
    .select('*')
    .order('nombre_completo', { ascending: true });

  if (empresaId) query = query.eq('empresa_facturadora_id', empresaId);
  if (activo !== undefined) query = query.eq('activo', activo === 'true');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  const lista = data ?? [];

  // Batch-fetch roles de todos los tramitadores
  const userIds = lista.map((t: any) => t.user_id).filter(Boolean);
  let rolesPorUser: Record<string, string[]> = {};
  if (userIds.length > 0) {
    const { data: urData } = await supabase
      .from('user_roles')
      .select('user_id, roles(nombre)')
      .in('user_id', userIds);
    for (const ur of urData ?? []) {
      if (!rolesPorUser[ur.user_id]) rolesPorUser[ur.user_id] = [];
      const nombre = (ur.roles as any)?.nombre;
      if (nombre) rolesPorUser[ur.user_id].push(nombre);
    }
  }

  const result = lista.map((t: any) => ({
    ...t,
    permisos: rolesPorUser[t.user_id] ?? [],
  }));

  return c.json({ data: result, error: null });
});

// GET /tramitadores/dashboard — KPIs agregados
tramitadoresRoutes.get('/dashboard', async (c) => {
  const supabase = c.get('supabase');
  const empresaId = c.req.query('empresa_facturadora_id');

  let query = supabase
    .from('v_carga_tramitadores')
    .select('*')
    .eq('activo', true);

  if (empresaId) query = query.eq('empresa_facturadora_id', empresaId);

  const { data: cargas, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  const lista = cargas ?? [];

  // Expedientes sin tramitador asignado
  let sinAsignarQuery = supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .is('tramitador_id', null)
    .not('estado', 'in', '(CERRADO,CANCELADO,COBRADO,FACTURADO)');
  if (empresaId) sinAsignarQuery = sinAsignarQuery.eq('empresa_facturadora_id', empresaId);
  const { count: sinAsignar } = await sinAsignarQuery;

  const kpis = {
    total_tramitadores_activos:  lista.length,
    total_activos:               lista.reduce((s: number, t: any) => s + (t.total_activos ?? 0), 0),
    tramitadores_sobrecargados:  lista.filter((t: any) => t.semaforo === 'rojo').length,
    tramitadores_en_alerta:      lista.filter((t: any) => t.semaforo === 'amarillo').length,
    total_sla_vencidos:          lista.reduce((s: number, t: any) => s + (t.total_sla_vencidos ?? 0), 0),
    total_sin_cita:              lista.reduce((s: number, t: any) => s + (t.total_sin_cita ?? 0), 0),
    total_bloqueados:            lista.reduce((s: number, t: any) => s + (t.total_bloqueados ?? 0), 0),
    expedientes_sin_tramitador:  sinAsignar ?? 0,
    carga_promedio_pct:          lista.length > 0
      ? Math.round(lista.reduce((s: number, t: any) => s + (t.porcentaje_carga ?? 0), 0) / lista.length)
      : 0,
    tramitadores: lista,
  };

  return c.json({ data: kpis, error: null });
});

// GET /tramitadores/:id — detalle
tramitadoresRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const [{ data: tramitador, error: e1 }, { data: carga, error: e2 }] = await Promise.all([
    supabase.from('tramitadores').select('*, empresas_facturadoras(nombre)').eq('id', id).single(),
    supabase.from('v_carga_tramitadores').select('*').eq('tramitador_id', id).single(),
  ]);

  if (e1 || !tramitador) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);
  }

  return c.json({ data: { ...tramitador, carga: carga ?? null }, error: null });
});

// POST /tramitadores — crear tramitador (el user_id se genera automáticamente mediante invitación)
tramitadoresRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const adminSupabase = c.get('adminSupabase');
  const user = c.get('user');
  const body = await c.req.json<any>();

  const required = ['nombre', 'apellidos', 'email'];
  for (const field of required) {
    if (!body[field]) {
      return c.json({ data: null, error: { code: 'VALIDATION', message: `${field} es requerido` } }, 422);
    }
  }

  // Crear usuario en Supabase Auth y enviar email de invitación
  const { data: authData, error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(
    body.email,
    {
      data: { nombre: body.nombre, apellidos: body.apellidos },
      ...(c.env.CONFIRM_BASE_URL
        ? { redirectTo: `${c.env.CONFIRM_BASE_URL}/auth/set-password` }
        : {}),
    },
  );

  if (authError) {
    // Si el usuario ya existe en auth, intentar obtener su UUID
    if (authError.message?.toLowerCase().includes('already registered') || authError.status === 422) {
      return c.json({ data: null, error: { code: 'AUTH_DUPLICATE', message: 'Ya existe un usuario de autenticación con ese email. Comprueba si ya está dado de alta como tramitador.' } }, 409);
    }
    return c.json({ data: null, error: { code: 'AUTH_ERROR', message: authError.message } }, 500);
  }

  const user_id = authData.user.id;

  const { data, error } = await supabase
    .from('tramitadores')
    .insert({
      user_id,
      empresa_facturadora_id:  body.empresa_facturadora_id ?? null,
      nombre:                  body.nombre,
      apellidos:               body.apellidos,
      email:                   body.email,
      telefono:                body.telefono ?? null,
      nivel:                   body.nivel ?? 'tramitador',
      max_expedientes_activos: body.max_expedientes_activos ?? 30,
      max_urgentes:            body.max_urgentes ?? 5,
      umbral_alerta_pct:       body.umbral_alerta_pct ?? 90,
      especialidades_siniestro: body.especialidades_siniestro ?? [],
      companias_preferentes:   body.companias_preferentes ?? [],
      zonas_cp:                body.zonas_cp ?? [],
    })
    .select()
    .single();

  if (error) {
    // Revertir la creación del usuario en Auth si el insert falla
    await adminSupabase.auth.admin.deleteUser(user_id);
    if (error.code === '23505') {
      return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe un tramitador con ese usuario' } }, 409);
    }
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await supabase.from('auditoria').insert({
    tabla: 'tramitadores', registro_id: data.id, accion: 'INSERT', actor_id: user.id,
    cambios: jsonBody({ ...body, user_id }),
  });

  return c.json({ data, error: null }, 201);
});

// PATCH /tramitadores/:id/ausente — marcar/desmarcar ausencia
tramitadoresRoutes.patch('/:id/ausente', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const { ausente } = await c.req.json<{ ausente: boolean }>();

  if (typeof ausente !== 'boolean') {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'ausente debe ser boolean' } }, 422);
  }

  const { data, error } = await supabase
    .from('tramitadores')
    .update({ ausente })
    .eq('id', id)
    .select('id, nombre, apellidos, ausente')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);
  }

  await supabase.from('auditoria').insert({
    tabla: 'tramitadores', registro_id: id, accion: 'UPDATE', actor_id: user.id,
    cambios: jsonBody({ ausente }),
  });

  return c.json({ data, error: null });
});

// PUT /tramitadores/:id — actualizar perfil
tramitadoresRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  const allowed = [
    'nombre', 'apellidos', 'email', 'telefono', 'nivel',
    'empresa_facturadora_id', 'especialidades_siniestro',
    'companias_preferentes', 'zonas_cp',
  ];
  const patch: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'No hay campos a actualizar' } }, 422);
  }

  const { data, error } = await supabase
    .from('tramitadores')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);
  }

  await supabase.from('auditoria').insert({
    tabla: 'tramitadores', registro_id: id, accion: 'UPDATE', actor_id: user.id,
    cambios: jsonBody(patch),
  });

  return c.json({ data, error: null });
});

// PUT /tramitadores/:id/capacidad — actualizar límites de capacidad
tramitadoresRoutes.put('/:id/capacidad', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  const patch: Record<string, any> = {};
  if (body.max_expedientes_activos !== undefined) patch.max_expedientes_activos = body.max_expedientes_activos;
  if (body.max_urgentes !== undefined)            patch.max_urgentes = body.max_urgentes;
  if (body.max_por_compania !== undefined)        patch.max_por_compania = body.max_por_compania;
  if (body.umbral_alerta_pct !== undefined)       patch.umbral_alerta_pct = body.umbral_alerta_pct;

  if (Object.keys(patch).length === 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'No hay campos de capacidad a actualizar' } }, 422);
  }

  const { data, error } = await supabase
    .from('tramitadores')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);
  }

  // Refrescar vista materializada
  void supabase.rpc('refresh_carga_tramitadores_sync');

  await supabase.from('auditoria').insert({
    tabla: 'tramitadores', registro_id: id, accion: 'UPDATE', actor_id: user.id,
    cambios: jsonBody({ capacidad: patch }),
  });

  return c.json({ data, error: null });
});

// POST /tramitadores/:id/activate — activar tramitador
tramitadoresRoutes.post('/:id/activate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('tramitadores')
    .update({ activo: true, fecha_baja: null })
    .eq('id', id)
    .select('id, nombre, apellidos, activo')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);
  }

  await supabase.from('auditoria').insert({
    tabla: 'tramitadores', registro_id: id, accion: 'UPDATE', actor_id: user.id,
    cambios: jsonBody({ activo: true }),
  });

  return c.json({ data, error: null });
});

// DELETE /tramitadores/:id/activate — desactivar tramitador (baja lógica)
tramitadoresRoutes.delete('/:id/activate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  // Comprobar si tiene expedientes activos
  const { count } = await supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .eq('tramitador_id', id)
    .not('estado', 'in', '(CERRADO,CANCELADO,COBRADO,FACTURADO)');

  const { data, error } = await supabase
    .from('tramitadores')
    .update({ activo: false, fecha_baja: new Date().toISOString() })
    .eq('id', id)
    .select('id, nombre, apellidos, activo')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);
  }

  await supabase.from('auditoria').insert({
    tabla: 'tramitadores', registro_id: id, accion: 'UPDATE', actor_id: user.id,
    cambios: jsonBody({ activo: false }),
  });

  return c.json({
    data: { ...data, expedientes_activos_pendientes: count ?? 0 },
    error: null,
  });
});

// GET /tramitadores/:id/expedientes — expedientes activos del tramitador
tramitadoresRoutes.get('/:id/expedientes', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const estado = c.req.query('estado');
  const page = parseInt(c.req.query('page') ?? '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') ?? '20'), 100);

  let query = supabase
    .from('expedientes')
    .select(
      '*, companias(nombre, codigo), asegurados(nombre, apellidos)',
      { count: 'exact' }
    )
    .eq('tramitador_id', id)
    .not('estado', 'in', '(CERRADO,CANCELADO)');

  if (estado) query = query.eq('estado', estado);

  const from = (page - 1) * perPage;
  query = query.order('fecha_limite_sla', { ascending: true, nullsFirst: false })
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

// GET /tramitadores/:id/historial — historial de asignaciones
tramitadoresRoutes.get('/:id/historial', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const page = parseInt(c.req.query('page') ?? '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') ?? '30'), 100);
  const from = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('historial_asignaciones')
    .select(
      `*, expedientes(numero_expediente),
       tramitador_anterior:tramitadores!tramitador_anterior_id(nombre, apellidos),
       tramitador_nuevo:tramitadores!tramitador_nuevo_id(nombre, apellidos),
       actor:user_profiles!actor_id(nombre, apellidos)`,
      { count: 'exact' }
    )
    .or(`tramitador_nuevo_id.eq.${id},tramitador_anterior_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  return c.json({
    data: { items: data ?? [], total: count ?? 0, page, per_page: perPage },
    error: null,
  });
});

// GET /tramitadores/:id/preasignaciones — reglas del tramitador
tramitadoresRoutes.get('/:id/preasignaciones', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('tramitador_reglas_preasignacion')
    .select('*, companias(nombre), empresas_facturadoras(nombre)')
    .eq('tramitador_id', id)
    .order('peso', { ascending: false });

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: data ?? [], error: null });
});

// POST /tramitadores/:id/preasignaciones — crear regla
tramitadoresRoutes.post('/:id/preasignaciones', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  const { data, error } = await supabase
    .from('tramitador_reglas_preasignacion')
    .insert({
      tramitador_id:          id,
      empresa_facturadora_id: body.empresa_facturadora_id ?? null,
      compania_id:            body.compania_id ?? null,
      tipo_siniestro:         body.tipo_siniestro ?? null,
      zona_cp_patron:         body.zona_cp_patron ?? null,
      prioridad:              body.prioridad ?? null,
      peso:                   body.peso ?? 100,
      activa:                 body.activa ?? true,
      descripcion:            body.descripcion ?? null,
      created_by:             user.id,
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null }, 201);
});

// PUT /tramitadores/:tramitadorId/preasignaciones/:ruleId — actualizar regla
tramitadoresRoutes.put('/:tramitadorId/preasignaciones/:ruleId', async (c) => {
  const supabase = c.get('supabase');
  const ruleId = c.req.param('ruleId');
  const tramitadorId = c.req.param('tramitadorId');
  const body = await c.req.json<any>();

  const patch: Record<string, any> = {};
  const fields = ['compania_id', 'tipo_siniestro', 'zona_cp_patron', 'prioridad', 'peso', 'activa', 'descripcion', 'empresa_facturadora_id'];
  for (const f of fields) { if (f in body) patch[f] = body[f]; }

  const { data, error } = await supabase
    .from('tramitador_reglas_preasignacion')
    .update(patch)
    .eq('id', ruleId)
    .eq('tramitador_id', tramitadorId)
    .select()
    .single();

  if (error || !data) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Regla no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// DELETE /tramitadores/:tramitadorId/preasignaciones/:ruleId
tramitadoresRoutes.delete('/:tramitadorId/preasignaciones/:ruleId', async (c) => {
  const supabase = c.get('supabase');
  const ruleId = c.req.param('ruleId');
  const tramitadorId = c.req.param('tramitadorId');

  const { error } = await supabase
    .from('tramitador_reglas_preasignacion')
    .delete()
    .eq('id', ruleId)
    .eq('tramitador_id', tramitadorId);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: { deleted: true }, error: null });
});

function jsonBody(v: any) {
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return v; }
}
