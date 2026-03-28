import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const tiposSiniestroRoutes = new Hono<{ Bindings: Env }>();

// GET /tipos-siniestro
// ?compania_id=uuid  → devuelve los tipos configurados para esa compañía
// ?activo=true|false → filtro opcional (solo aplica sin compania_id)
tiposSiniestroRoutes.get('/', async (c) => {
  const supabase    = c.get('supabase');
  const companiaId  = c.req.query('compania_id');
  const activo      = c.req.query('activo');

  if (companiaId) {
    const { data, error } = await supabase
      .from('compania_tipos_siniestro')
      .select('tipos_siniestro ( id, nombre, color, orden )')
      .eq('compania_id', companiaId)
      .eq('activo', true)
      .order('orden');

    if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
    const tipos = (data ?? []).map((row: any) => row.tipos_siniestro).filter(Boolean);
    return c.json({ data: tipos, error: null });
  }

  let query = supabase.from('tipos_siniestro').select('*');
  if (activo !== undefined && activo !== '') query = query.eq('activo', activo === 'true');
  query = query.order('orden').order('nombre');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /tipos-siniestro
tiposSiniestroRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ nombre: string; color?: string; orden?: number }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('tipos_siniestro')
    .insert({ nombre: body.nombre.trim(), color: body.color ?? '#6b7280', orden: body.orden ?? 0, activo: true })
    .select('*')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'tipos_siniestro', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});

// PUT /tipos-siniestro/:id
tiposSiniestroRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ nombre?: string; color?: string; activo?: boolean; orden?: number }>();

  const patch: Record<string, unknown> = {};
  if (body.nombre !== undefined) patch.nombre = body.nombre.trim();
  if (body.color !== undefined) patch.color = body.color;
  if (body.activo !== undefined) patch.activo = body.activo;
  if (body.orden !== undefined) patch.orden = body.orden;

  const { data, error } = await supabase.from('tipos_siniestro').update(patch).eq('id', id).select('*').single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'tipos_siniestro', accion: 'UPDATE', registro_id: id, actor_id: user.id, cambios: patch });
  return c.json({ data, error: null });
});

// DELETE /tipos-siniestro/:id
tiposSiniestroRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('tipos_siniestro').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  await insertAudit(supabase, { tabla: 'tipos_siniestro', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { deleted: true }, error: null });
});
