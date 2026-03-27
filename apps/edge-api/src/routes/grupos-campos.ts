import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const gruposCamposRoutes = new Hono<{ Bindings: Env }>();

// GET /grupos-campos  (incluye campos anidados)
gruposCamposRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const compania_id = c.req.query('compania_id');
  const entidad = c.req.query('entidad');

  let query = supabase
    .from('grupos_campos')
    .select('*, campos:campos_personalizados(*)')
    .order('orden');

  if (compania_id) query = query.or(`compania_id.eq.${compania_id},compania_id.is.null`);
  if (entidad) query = query.eq('entidad', entidad);

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /grupos-campos
gruposCamposRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    nombre: string; entidad?: string; orden?: number; compania_id?: string;
  }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('grupos_campos')
    .insert({
      nombre:      body.nombre.trim(),
      entidad:     body.entidad ?? 'expediente',
      orden:       body.orden ?? 0,
      compania_id: body.compania_id ?? null,
    })
    .select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'grupos_campos', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});

// PUT /grupos-campos/:id
gruposCamposRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{ nombre: string; entidad: string; orden: number; compania_id: string | null }>>();

  const ALLOWED = ['nombre', 'entidad', 'orden', 'compania_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) { if (body[k] !== undefined) patch[k] = body[k]; }

  const { data, error } = await supabase.from('grupos_campos').update(patch).eq('id', id).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'grupos_campos', accion: 'UPDATE', registro_id: id, actor_id: user.id, cambios: patch });
  return c.json({ data, error: null });
});

// DELETE /grupos-campos/:id  (cascade borra campos_personalizados)
gruposCamposRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('grupos_campos').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'grupos_campos', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});

// ── Campos personalizados dentro de un grupo ──────────────────────────────────

// POST /grupos-campos/:grupo_id/campos
gruposCamposRoutes.post('/:grupo_id/campos', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const grupo_id = c.req.param('grupo_id');
  const body = await c.req.json<{
    nombre: string; tipo?: string; opciones?: string[]; obligatorio?: boolean; orden?: number;
  }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre del campo es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('campos_personalizados')
    .insert({
      grupo_id,
      nombre:     body.nombre.trim(),
      tipo:       body.tipo ?? 'text',
      opciones:   body.opciones ?? [],
      obligatorio: body.obligatorio ?? false,
      orden:      body.orden ?? 0,
    })
    .select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'campos_personalizados', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});

// PUT /grupos-campos/:grupo_id/campos/:id
gruposCamposRoutes.put('/:grupo_id/campos/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{ nombre: string; tipo: string; opciones: string[]; obligatorio: boolean; orden: number }>>();

  const ALLOWED = ['nombre', 'tipo', 'opciones', 'obligatorio', 'orden'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) { if (body[k] !== undefined) patch[k] = body[k]; }

  const { data, error } = await supabase.from('campos_personalizados').update(patch).eq('id', id).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'campos_personalizados', accion: 'UPDATE', registro_id: id, actor_id: user.id, cambios: patch });
  return c.json({ data, error: null });
});

// DELETE /grupos-campos/:grupo_id/campos/:id
gruposCamposRoutes.delete('/:grupo_id/campos/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('campos_personalizados').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'campos_personalizados', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
