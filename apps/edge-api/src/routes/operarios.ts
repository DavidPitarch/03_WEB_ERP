import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const operariosRoutes = new Hono<{ Bindings: Env }>();

// ─── Campos permitidos en create/update ───────────────────────────────────────

const ALLOWED_FIELDS = [
  'nombre', 'apellidos', 'telefono', 'email',
  'razon_social', 'direccion', 'poblacion', 'ciudad', 'codigo_postal', 'provincia',
  'telf2', 'fax', 'tipo_identificacion', 'nif', 'persona_contacto',
  'iban_1', 'iban_2', 'iban_3', 'iban_4', 'iban_5', 'iban_6',
  'numero_entidad', 'numero_oficina', 'numero_control', 'numero_cuenta', 'cuenta_bancaria',
  'subcuenta_operario', 'prefijo_autofactura', 'tipo_operario', 'nomina', 'precio_hora',
  'irpf', 'tipo_descuento', 'descuento_negociado', 'permitir_incrementos',
  'automatico_sms', 'automatico_email', 'opcion_finaliza_visita', 'supervisor', 'bloquear_fotos',
  'usa_app_movil', 'ocultar_baremo_app', 'ocultar_precio_baremo', 'fichaje_activo',
  'horas_convenio_dia', 'jornada_laboral', 'plataforma_pas', 'app_pwgs',
  'preferente', 'establecer_iva', 'iva_operario', 'puede_segunda_visita',
  'genera_presupuestos', 'autoaprobado', 'mostrar_datos_perito', 'observaciones',
  'usuario_intranet', 'contrasena_intranet', 'email_aplicacion', 'contrasena_email_app',
  'foto_path', 'tipos_servicio', 'gremios', 'zonas_cp',
  'activo', 'bloqueado', 'es_subcontratado',
];

// ─── GET /operarios ────────────────────────────────────────────────────────────

operariosRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const search       = c.req.query('search');
  const cp           = c.req.query('cp');
  const especialidad = c.req.query('especialidad_id');
  const estado       = c.req.query('estado');   // 'activos' | 'eliminados' | undefined = todos
  const gremio       = c.req.query('gremio');
  const page         = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const perPage      = Math.min(parseInt(c.req.query('per_page') ?? '10'), 100);

  let query = supabase.from('operarios').select('*', { count: 'exact' });

  if (estado === 'activos' || estado === undefined)  query = query.eq('activo', true);
  if (estado === 'eliminados') query = query.eq('activo', false);
  if (search) query = query.or(`nombre.ilike.%${search}%,apellidos.ilike.%${search}%`);
  if (cp)     query = query.eq('codigo_postal', cp);
  if (gremio) query = query.contains('gremios', [gremio]);

  // Filtro por especialidad via join
  if (especialidad) {
    const { data: relIds } = await supabase
      .from('operarios_especialidades')
      .select('operario_id')
      .eq('especialidad_id', especialidad);
    const ids = (relIds ?? []).map((r: any) => r.operario_id);
    if (ids.length === 0) {
      return c.json({ data: { items: [], total: 0, page, per_page: perPage, total_pages: 0 }, error: null });
    }
    query = query.in('id', ids);
  }

  const from = (page - 1) * perPage;
  query = query.order('nombre').range(from, from + perPage - 1);

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

// ─── GET /operarios/:id ────────────────────────────────────────────────────────

operariosRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase.from('operarios').select('*').eq('id', id).single();
  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Operario no encontrado' } }, 404);
  }
  return c.json({ data, error: null });
});

// ─── POST /operarios ───────────────────────────────────────────────────────────

operariosRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<any>();

  if (!body.nombre?.trim() || !body.apellidos?.trim() || !body.telefono?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'nombre, apellidos y telefono son obligatorios' } }, 422);
  }

  const insert: Record<string, any> = { activo: true, app_pwgs: true };
  for (const key of ALLOWED_FIELDS) {
    if (key in body && key !== 'activo') insert[key] = body[key];
  }
  insert.activo = body.activo ?? true;

  const { data, error } = await supabase.from('operarios').insert(insert).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'operarios', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: insert });
  return c.json({ data, error: null }, 201);
});

// ─── PUT /operarios/:id ────────────────────────────────────────────────────────

operariosRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<any>();

  const patch: Record<string, any> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'Sin campos a actualizar' } }, 422);
  }

  const { data, error } = await supabase.from('operarios').update(patch).eq('id', id).select().single();
  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Operario no encontrado' } }, 404);
  }

  await insertAudit(supabase, { tabla: 'operarios', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: patch });
  return c.json({ data, error: null });
});

// ─── POST /operarios/:id/activate — reactivar ─────────────────────────────────

operariosRoutes.post('/:id/activate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('operarios')
    .update({ activo: true })
    .eq('id', id)
    .select('id, nombre, apellidos, activo')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Operario no encontrado' } }, 404);
  }

  await insertAudit(supabase, { tabla: 'operarios', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: { activo: true } });
  return c.json({ data, error: null });
});

// ─── DELETE /operarios/:id/activate — dar de baja (baja lógica) ───────────────

operariosRoutes.delete('/:id/activate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('operarios')
    .update({ activo: false })
    .eq('id', id)
    .select('id, nombre, apellidos, activo')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Operario no encontrado' } }, 404);
  }

  await insertAudit(supabase, { tabla: 'operarios', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: { activo: false } });
  return c.json({ data, error: null });
});

// ─── DELETE /operarios/:id — baja lógica directa ──────────────────────────────

operariosRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('operarios')
    .update({ activo: false })
    .eq('id', id)
    .select('id, nombre, apellidos, activo')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Operario no encontrado' } }, 404);
  }

  await insertAudit(supabase, { tabla: 'operarios', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: { activo: false } });
  return c.json({ data: { deleted: true }, error: null });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUB-RECURSO: ESPECIALIDADES DEL OPERARIO
// ══════════════════════════════════════════════════════════════════════════════

// GET /operarios/:id/especialidades
operariosRoutes.get('/:id/especialidades', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const page    = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const perPage = Math.min(parseInt(c.req.query('per_page') ?? '50'), 100);
  const from    = (page - 1) * perPage;

  const { data, error, count } = await supabase
    .from('operarios_especialidades')
    .select('*, especialidades(id, nombre, codigo, activa)', { count: 'exact' })
    .eq('operario_id', id)
    .order('created_at')
    .range(from, from + perPage - 1);

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

// POST /operarios/:id/especialidades — añadir especialidad
operariosRoutes.post('/:id/especialidades', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const operarioId = c.req.param('id');
  const body = await c.req.json<{ especialidad_id: string; es_principal?: boolean }>();

  if (!body.especialidad_id) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'especialidad_id requerido' } }, 422);
  }

  const { data, error } = await supabase
    .from('operarios_especialidades')
    .insert({
      operario_id:     operarioId,
      especialidad_id: body.especialidad_id,
      es_principal:    body.es_principal ?? false,
    })
    .select('*, especialidades(id, nombre, codigo, activa)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json({ data: null, error: { code: 'DUPLICATE', message: 'El operario ya tiene esta especialidad' } }, 409);
    }
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await insertAudit(supabase, { tabla: 'operarios_especialidades', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: { operario_id: operarioId, especialidad_id: body.especialidad_id } });
  return c.json({ data, error: null }, 201);
});

// PATCH /operarios/:id/especialidades/:espRelId — actualizar es_principal
operariosRoutes.patch('/:id/especialidades/:espRelId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const operarioId = c.req.param('id');
  const espRelId   = c.req.param('espRelId');
  const body = await c.req.json<{ es_principal: boolean }>();

  if (typeof body.es_principal !== 'boolean') {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'es_principal debe ser boolean' } }, 422);
  }

  const { data, error } = await supabase
    .from('operarios_especialidades')
    .update({ es_principal: body.es_principal })
    .eq('id', espRelId)
    .eq('operario_id', operarioId)
    .select('*, especialidades(id, nombre, codigo, activa)')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Relación no encontrada' } }, 404);
  }

  await insertAudit(supabase, { tabla: 'operarios_especialidades', registro_id: espRelId, accion: 'UPDATE', actor_id: user.id, cambios: { es_principal: body.es_principal } });
  return c.json({ data, error: null });
});

// DELETE /operarios/:id/especialidades/:espRelId — quitar especialidad
operariosRoutes.delete('/:id/especialidades/:espRelId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const operarioId = c.req.param('id');
  const espRelId   = c.req.param('espRelId');

  const { error } = await supabase
    .from('operarios_especialidades')
    .delete()
    .eq('id', espRelId)
    .eq('operario_id', operarioId);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'operarios_especialidades', registro_id: espRelId, accion: 'DELETE', actor_id: user.id, cambios: {} });
  return c.json({ data: { deleted: true }, error: null });
});
