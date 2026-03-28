import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const proveedoresRoutes = new Hono<{ Bindings: Env }>();

function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

const ALLOWED_FIELDS = [
  'nombre', 'tipo_identificacion', 'cif', 'telefono', 'fax', 'email',
  'direccion', 'codigo_postal', 'localidad', 'provincia',
  'iban_1', 'iban_2', 'iban_3', 'iban_4', 'iban_5', 'iban_6',
  'limite_dias', 'utiliza_panel', 'autofactura', 'id_operario',
  'canal_preferido', 'especialidades', 'notas', 'activo',
  'usuario', 'contrasena', 'email_app', 'contrasena_email_app',
];

// GET /proveedores — Listado paginado con filtros
proveedoresRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 10));
  const activo = c.req.query('activo');
  const search = c.req.query('search');

  let query = supabase
    .from('proveedores')
    .select('*', { count: 'exact' });

  if (activo !== undefined && activo !== '') query = query.eq('activo', activo === 'true');
  if (search) query = query.ilike('nombre', `%${search}%`);

  const from = (page - 1) * perPage;
  query = query.order('nombre', { ascending: true }).range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({
    data: {
      items: data ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    },
    error: null,
  });
});

// GET /proveedores/:id — Detalle de proveedor
proveedoresRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Proveedor no encontrado'), 404);

  return c.json({ data, error: null });
});

// POST /proveedores — Crear proveedor
proveedoresRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>();

  if (!body.nombre || String(body.nombre).trim() === '') {
    return c.json(err('VALIDATION', 'nombre es requerido'), 422);
  }

  const insert: Record<string, unknown> = { activo: true, autofactura: true, utiliza_panel: false };
  for (const key of ALLOWED_FIELDS) {
    if (key in body && key !== 'activo') insert[key] = body[key];
  }
  insert.activo = body.activo ?? true;

  const { data, error } = await supabase
    .from('proveedores')
    .insert(insert)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'proveedores',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: insert,
  });

  return c.json({ data, error: null }, 201);
});

// PUT /proveedores/:id — Actualizar proveedor
proveedoresRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return c.json(err('VALIDATION', 'Sin campos a actualizar'), 422);
  }

  const { data, error } = await supabase
    .from('proveedores')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Proveedor no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'proveedores',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: patch,
  });

  return c.json({ data, error: null });
});

// DELETE /proveedores/:id — Baja lógica (activo = false)
proveedoresRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('proveedores')
    .update({ activo: false })
    .eq('id', id)
    .select('id, nombre, activo')
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Proveedor no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'proveedores',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { activo: false },
  });

  return c.json({ data: { deleted: true }, error: null });
});

// GET /proveedores/:id/baremos — Baremos (tipo Proveedor) asignados a este proveedor
proveedoresRoutes.get('/:id/baremos', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('baremos_plantilla_proveedores')
    .select('baremo_id, baremos_plantilla(id, nombre, tipo, fecha_inicio, fecha_fin)')
    .eq('proveedor_id', id)
    .order('created_at', { ascending: true });

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  const baremos = (data ?? []).map((r: any) => r.baremos_plantilla).filter(Boolean);
  return c.json({ data: baremos, error: null });
});

// POST /proveedores/:id/activate — Reactivar proveedor
proveedoresRoutes.post('/:id/activate', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('proveedores')
    .update({ activo: true })
    .eq('id', id)
    .select('id, nombre, activo')
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Proveedor no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'proveedores',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { activo: true },
  });

  return c.json({ data, error: null });
});
