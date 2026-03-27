import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const lineasFacturacionRoutes = new Hono<{ Bindings: Env }>();

// GET /lineas-facturacion
lineasFacturacionRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const tipo_iva = c.req.query('tipo_iva');
  const compania_id = c.req.query('compania_id');
  const search = c.req.query('search');

  let query = supabase.from('lineas_facturacion').select('*');
  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  if (tipo_iva) query = query.eq('tipo_iva', tipo_iva);
  if (compania_id) query = query.or(`compania_id.eq.${compania_id},compania_id.is.null`);
  if (search) query = query.or(`descripcion.ilike.%${search}%,codigo.ilike.%${search}%`);
  query = query.order('orden').order('descripcion');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// POST /lineas-facturacion
lineasFacturacionRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    descripcion: string; codigo?: string; unidad?: string; precio?: number;
    tipo_iva?: string; porcentaje_iva?: number; activa?: boolean; orden?: number; compania_id?: string;
  }>();

  if (!body.descripcion?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'La descripción es obligatoria' } }, 422);

  const { data, error } = await supabase
    .from('lineas_facturacion')
    .insert({
      descripcion:    body.descripcion.trim(),
      codigo:         body.codigo?.trim() ?? null,
      unidad:         body.unidad?.trim() ?? 'ud',
      precio:         body.precio ?? 0,
      tipo_iva:       body.tipo_iva ?? 'general',
      porcentaje_iva: body.porcentaje_iva ?? 21,
      activa:         body.activa ?? true,
      orden:          body.orden ?? 0,
      compania_id:    body.compania_id ?? null,
    })
    .select().single();

  if (error) {
    if (error.code === '23505') return c.json({ data: null, error: { code: 'DUPLICATE', message: 'Ya existe una línea con ese código' } }, 409);
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  await insertAudit(supabase, { tabla: 'lineas_facturacion', operacion: 'INSERT', registro_id: data.id, actor_id: user.id, datos_nuevos: data });
  return c.json({ data, error: null }, 201);
});

// PUT /lineas-facturacion/:id
lineasFacturacionRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    descripcion: string; codigo: string | null; unidad: string; precio: number;
    tipo_iva: string; porcentaje_iva: number; activa: boolean; orden: number; compania_id: string | null;
  }>>();

  const ALLOWED = ['descripcion', 'codigo', 'unidad', 'precio', 'tipo_iva', 'porcentaje_iva', 'activa', 'orden', 'compania_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (body[k] !== undefined) patch[k] = body[k];
  }

  const { data, error } = await supabase.from('lineas_facturacion').update(patch).eq('id', id).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'lineas_facturacion', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /lineas-facturacion/:id
lineasFacturacionRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('lineas_facturacion').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'lineas_facturacion', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
