import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const docRequeridaRoutes = new Hono<{ Bindings: Env }>();

// GET /doc-requerida
docRequeridaRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activo = c.req.query('activo');

  let query = supabase.from('doc_requerida_tipos').select('*');
  if (activo !== undefined && activo !== '') query = query.eq('activo', activo === 'true');
  query = query.order('orden').order('nombre');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /doc-requerida
docRequeridaRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ nombre: string; descripcion?: string; dias_vigencia?: number; obligatorio?: boolean; orden?: number }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('doc_requerida_tipos')
    .insert({
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      dias_vigencia: body.dias_vigencia ?? null,
      obligatorio: body.obligatorio ?? true,
      orden: body.orden ?? 0,
      activo: true,
    })
    .select('*')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'doc_requerida_tipos', operacion: 'INSERT', registro_id: data.id, actor_id: user.id, datos_nuevos: data });
  return c.json({ data, error: null }, 201);
});

// PUT /doc-requerida/:id
docRequeridaRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ nombre?: string; descripcion?: string; dias_vigencia?: number | null; obligatorio?: boolean; activo?: boolean; orden?: number }>();

  const patch: Record<string, unknown> = {};
  if (body.nombre !== undefined) patch.nombre = body.nombre.trim();
  if (body.descripcion !== undefined) patch.descripcion = body.descripcion?.trim() || null;
  if ('dias_vigencia' in body) patch.dias_vigencia = body.dias_vigencia ?? null;
  if (body.obligatorio !== undefined) patch.obligatorio = body.obligatorio;
  if (body.activo !== undefined) patch.activo = body.activo;
  if (body.orden !== undefined) patch.orden = body.orden;

  const { data, error } = await supabase.from('doc_requerida_tipos').update(patch).eq('id', id).select('*').single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'doc_requerida_tipos', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /doc-requerida/:id
docRequeridaRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('doc_requerida_tipos').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'doc_requerida_tipos', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { deleted: true }, error: null });
});
