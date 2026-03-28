import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const mastersRoutes = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════
// COMPAÑÍAS
// ═══════════════════════════════════════

mastersRoutes.get('/companias', async (c) => {
  const supabase = c.get('supabase');
  const activa  = c.req.query('activa');
  const search  = c.req.query('search');
  const tipo    = c.req.query('tipo');
  const sistema = c.req.query('sistema_integracion');

  let query = supabase.from('companias').select('*').order('nombre');
  if (activa === 'true') query = query.eq('activa', true);
  if (search)  query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`);
  if (tipo)    query = query.eq('tipo', tipo);
  if (sistema) query = query.eq('sistema_integracion', sistema);

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

mastersRoutes.get('/companias/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const { data, error } = await supabase.from('companias').select('*').eq('id', id).single();
  if (error || !data) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Compañía no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// ── Tramitadores vinculados a una compañía ──────────────────────────────────

mastersRoutes.get('/companias/:id/tramitadores', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('tramitadores')
    .select('id, nombre, apellidos, email, activo, companias_preferentes')
    .contains('companias_preferentes', [id])
    .order('nombre');

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: data ?? [], error: null });
});

mastersRoutes.post('/companias/:id/tramitadores', async (c) => {
  const supabase = c.get('supabase');
  const companiaId = c.req.param('id');
  const body = await c.req.json();
  const tramitadorId = body.tramitador_id;

  if (!tramitadorId) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'tramitador_id requerido' } }, 422);
  }

  const { data: tram, error: e1 } = await supabase
    .from('tramitadores')
    .select('id, companias_preferentes')
    .eq('id', tramitadorId)
    .single();

  if (e1 || !tram) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);

  const current: string[] = tram.companias_preferentes ?? [];
  if (current.includes(companiaId)) return c.json({ data: tram, error: null });

  const { data, error } = await supabase
    .from('tramitadores')
    .update({ companias_preferentes: [...current, companiaId] })
    .eq('id', tramitadorId)
    .select('id, nombre, apellidos, email, activo')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null }, 201);
});

mastersRoutes.delete('/companias/:id/tramitadores/:tramitadorId', async (c) => {
  const supabase = c.get('supabase');
  const companiaId = c.req.param('id');
  const tramitadorId = c.req.param('tramitadorId');

  const { data: tram, error: e1 } = await supabase
    .from('tramitadores')
    .select('id, companias_preferentes')
    .eq('id', tramitadorId)
    .single();

  if (e1 || !tram) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Tramitador no encontrado' } }, 404);

  const nuevas = (tram.companias_preferentes ?? []).filter((cid: string) => cid !== companiaId);

  const { error } = await supabase
    .from('tramitadores')
    .update({ companias_preferentes: nuevas })
    .eq('id', tramitadorId);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: { deleted: true }, error: null });
});

mastersRoutes.post('/companias', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ data: null, error: { code: 'BAD_REQUEST', message: 'El cuerpo de la petición no es JSON válido' } }, 400);
  }

  if (!body.nombre || !body.codigo) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'nombre y codigo requeridos' } }, 422);
  }

  const { data, error } = await supabase.from('companias').insert({
    nombre:              body.nombre,
    codigo:              body.codigo,
    cif:                 body.cif ?? null,
    activa:              body.activa ?? true,
    tipo:                body.tipo ?? 'compania',
    sistema_integracion: body.sistema_integracion ?? null,
    config:              body.config ?? {},
  }).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  if (!data) return c.json({ data: null, error: { code: 'DB_ERROR', message: 'La inserción no devolvió datos' } }, 500);

  await insertAudit(supabase, { tabla: 'companias', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

mastersRoutes.put('/companias/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const { data, error } = await supabase.from('companias').update({
    nombre:              body.nombre,
    codigo:              body.codigo,
    cif:                 body.cif,
    activa:              body.activa,
    tipo:                body.tipo,
    sistema_integracion: body.sistema_integracion,
    config:              body.config,
  }).eq('id', id).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'companias', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: body });
  return c.json({ data, error: null });
});

// ── Especialidades de una compañía ─────────────────────────────────────────

mastersRoutes.get('/companias/:id/especialidades', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('compania_especialidades')
    .select(`
      id,
      compania_id,
      especialidad_id,
      dias_caducidad,
      dias_caducidad_confirmar,
      created_at,
      updated_at,
      especialidades ( id, nombre, codigo, activa, orden )
    `)
    .eq('compania_id', id)
    .order('especialidades(orden)')
    .order('especialidades(nombre)');

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data: data ?? [], error: null });
});

mastersRoutes.post('/companias/:id/especialidades', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const companiaId = c.req.param('id');
  const body = await c.req.json<{ especialidad_id: string; dias_caducidad?: number; dias_caducidad_confirmar?: number }>();

  if (!body.especialidad_id) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'especialidad_id requerido' } }, 422);
  }

  const { data, error } = await supabase
    .from('compania_especialidades')
    .insert({
      compania_id:              companiaId,
      especialidad_id:          body.especialidad_id,
      dias_caducidad:           body.dias_caducidad ?? 0,
      dias_caducidad_confirmar: body.dias_caducidad_confirmar ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Especialidad ya asignada a esta compañía' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await insertAudit(supabase, { tabla: 'compania_especialidades', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

mastersRoutes.put('/companias/:id/especialidades/:espId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const companiaId = c.req.param('id');
  const espId      = c.req.param('espId');
  const body = await c.req.json<{ dias_caducidad?: number; dias_caducidad_confirmar?: number }>();

  const { data, error } = await supabase
    .from('compania_especialidades')
    .update({
      dias_caducidad:           body.dias_caducidad,
      dias_caducidad_confirmar: body.dias_caducidad_confirmar,
    })
    .eq('id', espId)
    .eq('compania_id', companiaId)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'compania_especialidades', registro_id: espId, accion: 'UPDATE', actor_id: user.id, cambios: body });
  return c.json({ data, error: null });
});

mastersRoutes.delete('/companias/:id/especialidades/:espId', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const companiaId = c.req.param('id');
  const espId      = c.req.param('espId');

  const { error } = await supabase
    .from('compania_especialidades')
    .delete()
    .eq('id', espId)
    .eq('compania_id', companiaId);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'compania_especialidades', registro_id: espId, accion: 'DELETE', actor_id: user.id, cambios: {} });
  return c.json({ data: { deleted: true }, error: null });
});

// ═══════════════════════════════════════
// OPERARIOS
// ═══════════════════════════════════════

mastersRoutes.get('/operarios', async (c) => {
  const supabase = c.get('supabase');
  const activo = c.req.query('activo');
  const gremio = c.req.query('gremio');

  let query = supabase.from('operarios').select('*').order('nombre');
  if (activo === 'true') query = query.eq('activo', true);
  if (gremio) query = query.contains('gremios', [gremio]);

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

mastersRoutes.post('/operarios', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.nombre || !body.apellidos || !body.telefono) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'nombre, apellidos y telefono requeridos' } }, 422);
  }

  const { data, error } = await supabase.from('operarios').insert({
    user_id: body.user_id ?? null,
    nombre: body.nombre,
    apellidos: body.apellidos,
    telefono: body.telefono,
    email: body.email ?? null,
    gremios: body.gremios ?? [],
    zonas_cp: body.zonas_cp ?? [],
    activo: body.activo ?? true,
  }).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'operarios', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

mastersRoutes.put('/operarios/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const { data, error } = await supabase.from('operarios').update({
    nombre: body.nombre,
    apellidos: body.apellidos,
    telefono: body.telefono,
    email: body.email,
    gremios: body.gremios,
    zonas_cp: body.zonas_cp,
    activo: body.activo,
  }).eq('id', id).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'operarios', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: body });
  return c.json({ data, error: null });
});

// ═══════════════════════════════════════
// EMPRESAS FACTURADORAS
// ═══════════════════════════════════════

mastersRoutes.get('/empresas-facturadoras', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  let query = supabase.from('empresas_facturadoras').select('*').order('nombre');
  if (activa === 'true')  query = query.eq('activa', true);
  if (activa === 'false') query = query.eq('activa', false);
  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

mastersRoutes.get('/empresas-facturadoras/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const { data, error } = await supabase.from('empresas_facturadoras').select('*').eq('id', id).single();
  if (error || !data) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } }, 404);
  return c.json({ data, error: null });
});

mastersRoutes.post('/empresas-facturadoras', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ data: null, error: { code: 'BAD_REQUEST', message: 'JSON inválido' } }, 400);
  }

  if (!body.nombre || !body.cif) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'nombre y cif son obligatorios' } }, 422);
  }

  const { data, error } = await supabase.from('empresas_facturadoras').insert({
    nombre:           body.nombre,
    nombre_comercial: body.nombre_comercial ?? null,
    cif:              body.cif,
    direccion:        body.direccion ?? null,
    localidad:        body.localidad ?? null,
    provincia:        body.provincia ?? null,
    codigo_postal:    body.codigo_postal ?? null,
    telefono:         body.telefono ?? null,
    email:            body.email ?? null,
    prefijo_facturas: body.prefijo_facturas ?? null,
    prefijo_abonos:   body.prefijo_abonos ?? null,
    activa:           body.activa ?? true,
  }).select().single();

  if (error) {
    if (error.code === '23505') return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe una empresa con ese CIF' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await insertAudit(supabase, { tabla: 'empresas_facturadoras', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

mastersRoutes.put('/empresas-facturadoras/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const { data, error } = await supabase.from('empresas_facturadoras').update({
    nombre:           body.nombre,
    nombre_comercial: body.nombre_comercial ?? null,
    cif:              body.cif,
    direccion:        body.direccion ?? null,
    localidad:        body.localidad ?? null,
    provincia:        body.provincia ?? null,
    codigo_postal:    body.codigo_postal ?? null,
    telefono:         body.telefono ?? null,
    email:            body.email ?? null,
    prefijo_facturas: body.prefijo_facturas ?? null,
    prefijo_abonos:   body.prefijo_abonos ?? null,
    activa:           body.activa,
  }).eq('id', id).select().single();

  if (error) {
    if (error.code === '23505') return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe una empresa con ese CIF' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }
  if (!data) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } }, 404);

  await insertAudit(supabase, { tabla: 'empresas_facturadoras', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: body });
  return c.json({ data, error: null });
});

mastersRoutes.delete('/empresas-facturadoras/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  // Verificar si tiene expedientes asociados antes de eliminar
  const { count } = await supabase
    .from('expedientes')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_facturadora_id', id);

  if (count && count > 0) {
    return c.json({
      data: null,
      error: { code: 'CONSTRAINT', message: `Esta empresa tiene ${count} expediente(s) asociados. Desactívela en lugar de eliminarla.` },
    }, 409);
  }

  const { error } = await supabase.from('empresas_facturadoras').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'empresas_facturadoras', registro_id: id, accion: 'DELETE', actor_id: user.id, cambios: {} });
  return c.json({ data: { deleted: true }, error: null });
});

// ═══════════════════════════════════════
// ASEGURADOS
// ═══════════════════════════════════════

mastersRoutes.get('/asegurados', async (c) => {
  const supabase = c.get('supabase');
  const search = c.req.query('search');

  let query = supabase.from('asegurados').select('*').order('apellidos').limit(50);
  if (search) {
    query = query.or(`nombre.ilike.%${search}%,apellidos.ilike.%${search}%,telefono.ilike.%${search}%,nif.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

mastersRoutes.post('/asegurados', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.nombre || !body.apellidos || !body.telefono || !body.direccion || !body.codigo_postal || !body.localidad || !body.provincia) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'Campos obligatorios: nombre, apellidos, telefono, direccion, codigo_postal, localidad, provincia' } }, 422);
  }

  const { data, error } = await supabase.from('asegurados').insert({
    nombre: body.nombre,
    apellidos: body.apellidos,
    telefono: body.telefono,
    telefono2: body.telefono2 ?? null,
    email: body.email ?? null,
    nif: body.nif ?? null,
    direccion: body.direccion,
    codigo_postal: body.codigo_postal,
    localidad: body.localidad,
    provincia: body.provincia,
  }).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'asegurados', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

// ═══════════════════════════════════════
// CATÁLOGOS
// ═══════════════════════════════════════

mastersRoutes.get('/catalogos', async (c) => {
  const supabase = c.get('supabase');
  const tipo = c.req.query('tipo');

  let query = supabase.from('catalogos').select('*').eq('activo', true).order('orden');
  if (tipo) query = query.eq('tipo', tipo);

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});
