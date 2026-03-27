import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const mastersRoutes = new Hono<{ Bindings: Env }>();

// ═══════════════════════════════════════
// COMPAÑÍAS
// ═══════════════════════════════════════

mastersRoutes.get('/companias', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const search = c.req.query('search');

  let query = supabase.from('companias').select('*').order('nombre');
  if (activa === 'true') query = query.eq('activa', true);
  if (search) query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`);

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
  const body = await c.req.json();

  if (!body.nombre || !body.codigo) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'nombre y codigo requeridos' } }, 422);
  }

  const { data, error } = await supabase.from('companias').insert({
    nombre: body.nombre,
    codigo: body.codigo,
    cif: body.cif ?? null,
    activa: body.activa ?? true,
    config: body.config ?? {},
  }).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'companias', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

mastersRoutes.put('/companias/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  const { data, error } = await supabase.from('companias').update({
    nombre: body.nombre,
    codigo: body.codigo,
    cif: body.cif,
    activa: body.activa,
    config: body.config,
  }).eq('id', id).select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'companias', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: body });
  return c.json({ data, error: null });
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
  const { data, error } = await supabase.from('empresas_facturadoras').select('*').eq('activa', true).order('nombre');
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
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
