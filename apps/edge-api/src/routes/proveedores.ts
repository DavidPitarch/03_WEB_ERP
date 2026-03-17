import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const proveedoresRoutes = new Hono<{ Bindings: Env }>();

function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

// GET /proveedores — Listado paginado con filtros
proveedoresRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('per_page')) || 20));
  const activo = c.req.query('activo');
  const search = c.req.query('search');

  let query = supabase
    .from('proveedores')
    .select('*', { count: 'exact' });

  if (activo !== undefined) query = query.eq('activo', activo === 'true');
  if (search) {
    query = query.or(`nombre.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const from = (page - 1) * perPage;
  query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({
    data: {
      items: data,
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    },
    error: null,
  });
});

// POST /proveedores — Crear proveedor
proveedoresRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<import('@erp/types').CreateProveedorRequest>();

  if (!body.nombre) {
    return c.json(err('VALIDATION', 'nombre es requerido'), 422);
  }

  const { data, error } = await supabase
    .from('proveedores')
    .insert(body)
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'proveedores',
    registro_id: data.id,
    accion: 'INSERT',
    actor_id: user.id,
    cambios: { ...body } as Record<string, unknown>,
  });

  return c.json({ data, error: null }, 201);
});

// PUT /proveedores/:id — Actualizar proveedor
proveedoresRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const { data, error } = await supabase
    .from('proveedores')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Proveedor no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'proveedores',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: body,
  });

  return c.json({ data, error: null });
});
