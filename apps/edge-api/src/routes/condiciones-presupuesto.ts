import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const condicionesPresupuestoRoutes = new Hono<{ Bindings: Env }>();

// GET /condiciones-presupuesto
condicionesPresupuestoRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const compania_id = c.req.query('compania_id');

  let query = supabase.from('condiciones_presupuesto').select('*');
  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  if (compania_id) query = query.eq('compania_id', compania_id);
  query = query.order('orden').order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /condiciones-presupuesto/:id
condicionesPresupuestoRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('condiciones_presupuesto')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Condición no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// POST /condiciones-presupuesto
condicionesPresupuestoRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ titulo: string; contenido: string; activa?: boolean; orden?: number; compania_id?: string }>();

  if (!body.titulo?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El título es obligatorio' } }, 422);
  if (!body.contenido?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El contenido es obligatorio' } }, 422);

  const { data, error } = await supabase
    .from('condiciones_presupuesto')
    .insert({ titulo: body.titulo.trim(), contenido: body.contenido.trim(), activa: body.activa ?? true, orden: body.orden ?? 0, compania_id: body.compania_id ?? null })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'condiciones_presupuesto', operacion: 'INSERT', registro_id: data.id, actor_id: user.id, datos_nuevos: data });
  return c.json({ data, error: null }, 201);
});

// PUT /condiciones-presupuesto/:id
condicionesPresupuestoRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{ titulo: string; contenido: string; activa: boolean; orden: number; compania_id: string | null }>>();

  const patch: Record<string, unknown> = {};
  if (body.titulo     !== undefined) patch.titulo     = body.titulo.trim();
  if (body.contenido  !== undefined) patch.contenido  = body.contenido.trim();
  if (body.activa     !== undefined) patch.activa     = body.activa;
  if (body.orden      !== undefined) patch.orden      = body.orden;
  if (body.compania_id !== undefined) patch.compania_id = body.compania_id;

  const { data, error } = await supabase
    .from('condiciones_presupuesto')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'condiciones_presupuesto', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /condiciones-presupuesto/:id
condicionesPresupuestoRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('condiciones_presupuesto').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'condiciones_presupuesto', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
