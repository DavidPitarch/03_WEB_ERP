import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const especialidadesRoutes = new Hono<{ Bindings: Env }>();

// GET /especialidades — Listar
especialidadesRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');

  let query = supabase.from('especialidades').select('*');
  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  query = query.order('orden').order('nombre');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /especialidades/:id
especialidadesRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('especialidades')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();
  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Especialidad no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// POST /especialidades — Crear
especialidadesRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ nombre: string; codigo?: string; descripcion?: string; orden?: number }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('especialidades')
    .insert({ nombre: body.nombre.trim(), codigo: body.codigo?.trim() || null, descripcion: body.descripcion?.trim() || null, orden: body.orden ?? 0, activa: true })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe una especialidad con ese código' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await insertAudit(supabase, { tabla: 'especialidades', operacion: 'INSERT', registro_id: data.id, actor_id: user.id, datos_nuevos: data });
  return c.json({ data, error: null }, 201);
});

// PUT /especialidades/:id — Actualizar
especialidadesRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ nombre?: string; codigo?: string; descripcion?: string; activa?: boolean; orden?: number }>();

  const patch: Record<string, unknown> = {};
  if (body.nombre !== undefined) patch.nombre = body.nombre.trim();
  if (body.codigo !== undefined) patch.codigo = body.codigo?.trim() || null;
  if (body.descripcion !== undefined) patch.descripcion = body.descripcion?.trim() || null;
  if (body.activa !== undefined) patch.activa = body.activa;
  if (body.orden !== undefined) patch.orden = body.orden;

  const { data, error } = await supabase
    .from('especialidades')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'especialidades', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /especialidades/:id
especialidadesRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('especialidades').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'especialidades', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { deleted: true }, error: null });
});
