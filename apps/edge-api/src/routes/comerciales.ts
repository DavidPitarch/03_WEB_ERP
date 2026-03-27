import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const comercialesRoutes = new Hono<{ Bindings: Env }>();

// GET /comerciales
comercialesRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activo = c.req.query('activo');
  const search = c.req.query('search');

  let query = supabase.from('comerciales').select('*');
  if (activo !== undefined && activo !== '') query = query.eq('activo', activo === 'true');
  if (search) query = query.ilike('nombre', `%${search}%`);
  query = query.order('nombre');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /comerciales/:id
comercialesRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase.from('comerciales').select('*').eq('id', c.req.param('id')).single();
  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Comercial no encontrado' } }, 404);
  return c.json({ data, error: null });
});

// POST /comerciales
comercialesRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    nombre: string;
    apellidos?: string;
    tipo_identificacion?: string;
    nif?: string;
    telefono?: string;
    fax?: string;
    email?: string;
    direccion?: string;
    codigo_postal?: string;
    ciudad?: string;
    provincia?: string;
    usuario_intranet?: string;
    email_app?: string;
    observaciones?: string;
  }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('comerciales')
    .insert({
      nombre: body.nombre.trim(),
      apellidos: body.apellidos?.trim() || null,
      tipo_identificacion: body.tipo_identificacion ?? 'NIF',
      nif: body.nif?.trim() || null,
      telefono: body.telefono?.trim() || null,
      fax: body.fax?.trim() || null,
      email: body.email?.trim() || null,
      direccion: body.direccion?.trim() || null,
      codigo_postal: body.codigo_postal?.trim() || null,
      ciudad: body.ciudad?.trim() || null,
      provincia: body.provincia?.trim() || null,
      usuario_intranet: body.usuario_intranet?.trim() || null,
      email_app: body.email_app?.trim() || null,
      observaciones: body.observaciones?.trim() || null,
      activo: true,
    })
    .select('*')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'comerciales', operacion: 'INSERT', registro_id: data.id, actor_id: user.id, datos_nuevos: data });
  return c.json({ data, error: null }, 201);
});

// PUT /comerciales/:id
comercialesRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const allowed = ['nombre','apellidos','tipo_identificacion','nif','telefono','fax','email','direccion','codigo_postal','ciudad','provincia','usuario_intranet','email_app','observaciones','activo'];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k];
  }

  const { data, error } = await supabase.from('comerciales').update(patch).eq('id', id).select('*').single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'comerciales', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /comerciales/:id
comercialesRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('comerciales').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'comerciales', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { deleted: true }, error: null });
});
