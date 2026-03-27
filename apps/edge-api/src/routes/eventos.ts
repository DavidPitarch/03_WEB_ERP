import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const eventosRoutes = new Hono<{ Bindings: Env }>();

// GET /eventos — reglas de automatización
eventosRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const compania_id = c.req.query('compania_id');

  let query = supabase.from('reglas_automatizacion').select('*');
  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  if (compania_id) query = query.or(`compania_id.eq.${compania_id},compania_id.is.null`);
  query = query.order('orden').order('nombre');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /eventos
eventosRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    nombre: string; descripcion?: string;
    trigger_tipo: string; trigger_config: Record<string, unknown>;
    accion_tipo: string; accion_config: Record<string, unknown>;
    activa?: boolean; orden?: number; compania_id?: string;
  }>();

  if (!body.nombre?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);

  const { data, error } = await supabase
    .from('reglas_automatizacion')
    .insert({
      nombre:         body.nombre.trim(),
      descripcion:    body.descripcion?.trim() ?? null,
      trigger_tipo:   body.trigger_tipo,
      trigger_config: body.trigger_config ?? {},
      accion_tipo:    body.accion_tipo,
      accion_config:  body.accion_config ?? {},
      activa:         body.activa ?? true,
      orden:          body.orden ?? 0,
      compania_id:    body.compania_id ?? null,
    })
    .select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'reglas_automatizacion', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});

// PUT /eventos/:id
eventosRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    nombre: string; descripcion: string | null;
    trigger_tipo: string; trigger_config: Record<string, unknown>;
    accion_tipo: string; accion_config: Record<string, unknown>;
    activa: boolean; orden: number; compania_id: string | null;
  }>>();

  const ALLOWED = ['nombre', 'descripcion', 'trigger_tipo', 'trigger_config', 'accion_tipo', 'accion_config', 'activa', 'orden', 'compania_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) { if (body[k] !== undefined) patch[k] = body[k]; }

  const { data, error } = await supabase.from('reglas_automatizacion').update(patch).eq('id', id).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'reglas_automatizacion', accion: 'UPDATE', registro_id: id, actor_id: user.id, cambios: patch });
  return c.json({ data, error: null });
});

// DELETE /eventos/:id
eventosRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('reglas_automatizacion').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'reglas_automatizacion', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
