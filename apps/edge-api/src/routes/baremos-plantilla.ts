import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const baremosPlantillaRoutes = new Hono<{ Bindings: Env }>();

function err(code: string, message: string) {
  return { data: null, error: { code, message } };
}

const TIPOS_VALIDOS = ['Cliente', 'Operario', 'Proveedor'] as const;

// ─── GET /baremos-plantilla ────────────────────────────────────────────────────
// Query params: tipo, temporal (actual|futuros|anteriores), search
baremosPlantillaRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const tipo     = c.req.query('tipo');
  const temporal = c.req.query('temporal'); // actual | futuros | anteriores
  const search   = c.req.query('search');
  const today    = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('baremos_plantilla')
    .select('*', { count: 'exact' });

  if (tipo && TIPOS_VALIDOS.includes(tipo as any)) query = query.eq('tipo', tipo);
  if (search) query = query.ilike('nombre', `%${search}%`);

  if (temporal === 'actual') {
    query = query.lte('fecha_inicio', today).gte('fecha_fin', today);
  } else if (temporal === 'futuros') {
    query = query.gt('fecha_inicio', today);
  } else if (temporal === 'anteriores') {
    query = query.lt('fecha_fin', today);
  }

  query = query.order('nombre', { ascending: true });

  const { data, error, count } = await query;
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  return c.json({ data: data ?? [], total: count ?? 0, error: null });
});

// ─── POST /baremos-plantilla ──────────────────────────────────────────────────
baremosPlantillaRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const body     = await c.req.json<any>();

  if (!body.nombre?.trim()) return c.json(err('VALIDATION', 'nombre es requerido'), 422);
  if (!TIPOS_VALIDOS.includes(body.tipo)) {
    return c.json(err('VALIDATION', 'tipo debe ser Cliente, Operario o Proveedor'), 422);
  }
  if (!body.fecha_inicio || !body.fecha_fin) {
    return c.json(err('VALIDATION', 'fecha_inicio y fecha_fin son requeridos'), 422);
  }

  const { data, error } = await supabase
    .from('baremos_plantilla')
    .insert({
      nombre:       body.nombre.trim(),
      tipo:         body.tipo,
      fecha_inicio: body.fecha_inicio,
      fecha_fin:    body.fecha_fin,
    })
    .select()
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla', registro_id: data.id, accion: 'INSERT',
    actor_id: user.id, cambios: { nombre: data.nombre, tipo: data.tipo },
  });
  return c.json({ data, error: null }, 201);
});

// ─── GET /baremos-plantilla/:id ────────────────────────────────────────────────
baremosPlantillaRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data, error } = await supabase
    .from('baremos_plantilla')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Baremo no encontrado'), 404);
  return c.json({ data, error: null });
});

// ─── PUT /baremos-plantilla/:id ────────────────────────────────────────────────
baremosPlantillaRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');
  const body     = await c.req.json<any>();

  const patch: Record<string, unknown> = {};
  if (body.nombre?.trim()) patch.nombre = body.nombre.trim();
  if (body.fecha_inicio)   patch.fecha_inicio = body.fecha_inicio;
  if (body.fecha_fin)      patch.fecha_fin = body.fecha_fin;
  // tipo no es editable tras creación

  if (Object.keys(patch).length === 0) return c.json(err('VALIDATION', 'Sin campos a actualizar'), 422);

  const { data, error } = await supabase
    .from('baremos_plantilla')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Baremo no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla', registro_id: id, accion: 'UPDATE',
    actor_id: user.id, cambios: patch,
  });
  return c.json({ data, error: null });
});

// ─── DELETE /baremos-plantilla/:id ────────────────────────────────────────────
baremosPlantillaRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user     = c.get('user');
  const id       = c.req.param('id');

  const { error } = await supabase.from('baremos_plantilla').delete().eq('id', id);
  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla', registro_id: id, accion: 'DELETE',
    actor_id: user.id, cambios: {},
  });
  return c.json({ data: { deleted: true }, error: null });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUB-RECURSO: TRABAJOS
// ══════════════════════════════════════════════════════════════════════════════

// GET /baremos-plantilla/:id/trabajos
baremosPlantillaRoutes.get('/:id/trabajos', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');
  const search   = c.req.query('search');
  const page     = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const perPage  = Math.min(parseInt(c.req.query('per_page') ?? '100'), 500);
  const from     = (page - 1) * perPage;

  let query = supabase
    .from('baremos_plantilla_trabajos')
    .select('*, especialidades(id, nombre)', { count: 'exact' })
    .eq('baremo_id', id);

  if (search) query = query.or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`);
  query = query
    .order('codigo', { ascending: true, nullsFirst: false })
    .range(from, from + perPage - 1);

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

// POST /baremos-plantilla/:id/trabajos
baremosPlantillaRoutes.post('/:id/trabajos', async (c) => {
  const supabase  = c.get('supabase');
  const user      = c.get('user');
  const baremoid  = c.req.param('id');
  const body      = await c.req.json<any>();

  if (!body.nombre?.trim()) return c.json(err('VALIDATION', 'nombre es requerido'), 422);

  const insert: Record<string, unknown> = {
    baremo_id:       baremoid,
    nombre:          body.nombre.trim(),
    codigo:          body.codigo || null,
    codigo_relacion: body.codigo_relacion || null,
    precio_cliente:  body.precio_cliente != null ? Number(body.precio_cliente) : null,
    precio_operario: body.precio_operario != null ? Number(body.precio_operario) : 0,
    precio_libre:    !!body.precio_libre,
    solo_operario:   !!body.solo_operario,
    cantidad_fija:   body.cantidad_fija != null ? Number(body.cantidad_fija) : 0,
    especialidad_id: body.especialidad_id || null,
  };

  const { data, error } = await supabase
    .from('baremos_plantilla_trabajos')
    .insert(insert)
    .select('*, especialidades(id, nombre)')
    .single();

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla_trabajos', registro_id: data.id, accion: 'INSERT',
    actor_id: user.id, cambios: { baremo_id: baremoid, nombre: data.nombre },
  });
  return c.json({ data, error: null }, 201);
});

// PUT /baremos-plantilla/:id/trabajos/:trabajoId
baremosPlantillaRoutes.put('/:id/trabajos/:trabajoId', async (c) => {
  const supabase  = c.get('supabase');
  const user      = c.get('user');
  const baremoid  = c.req.param('id');
  const trabajoId = c.req.param('trabajoId');
  const body      = await c.req.json<any>();

  const patch: Record<string, unknown> = {};
  if ('nombre' in body)          patch.nombre          = body.nombre;
  if ('codigo' in body)          patch.codigo          = body.codigo || null;
  if ('codigo_relacion' in body) patch.codigo_relacion = body.codigo_relacion || null;
  if ('precio_cliente' in body)  patch.precio_cliente  = body.precio_cliente != null ? Number(body.precio_cliente) : null;
  if ('precio_operario' in body) patch.precio_operario = Number(body.precio_operario ?? 0);
  if ('precio_libre' in body)    patch.precio_libre    = !!body.precio_libre;
  if ('solo_operario' in body)   patch.solo_operario   = !!body.solo_operario;
  if ('cantidad_fija' in body)   patch.cantidad_fija   = Number(body.cantidad_fija ?? 0);
  if ('especialidad_id' in body) patch.especialidad_id = body.especialidad_id || null;

  if (Object.keys(patch).length === 0) return c.json(err('VALIDATION', 'Sin campos a actualizar'), 422);

  const { data, error } = await supabase
    .from('baremos_plantilla_trabajos')
    .update(patch)
    .eq('id', trabajoId)
    .eq('baremo_id', baremoid)
    .select('*, especialidades(id, nombre)')
    .single();

  if (error || !data) return c.json(err('NOT_FOUND', 'Trabajo no encontrado'), 404);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla_trabajos', registro_id: trabajoId, accion: 'UPDATE',
    actor_id: user.id, cambios: patch,
  });
  return c.json({ data, error: null });
});

// DELETE /baremos-plantilla/:id/trabajos/:trabajoId
baremosPlantillaRoutes.delete('/:id/trabajos/:trabajoId', async (c) => {
  const supabase  = c.get('supabase');
  const user      = c.get('user');
  const baremoid  = c.req.param('id');
  const trabajoId = c.req.param('trabajoId');

  const { error } = await supabase
    .from('baremos_plantilla_trabajos')
    .delete()
    .eq('id', trabajoId)
    .eq('baremo_id', baremoid);

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla_trabajos', registro_id: trabajoId, accion: 'DELETE',
    actor_id: user.id, cambios: { baremo_id: baremoid },
  });
  return c.json({ data: { deleted: true }, error: null });
});

// ══════════════════════════════════════════════════════════════════════════════
// SUB-RECURSO: PROVEEDORES (asignación a baremos tipo Proveedor)
// ══════════════════════════════════════════════════════════════════════════════

// GET /baremos-plantilla/:id/proveedores
baremosPlantillaRoutes.get('/:id/proveedores', async (c) => {
  const supabase = c.get('supabase');
  const id       = c.req.param('id');

  const { data, error } = await supabase
    .from('baremos_plantilla_proveedores')
    .select('*, proveedores(id, nombre)')
    .eq('baremo_id', id)
    .order('created_at', { ascending: true });

  if (error) return c.json(err('DB_ERROR', error.message), 500);
  return c.json({ data: data ?? [], error: null });
});

// POST /baremos-plantilla/:id/proveedores
baremosPlantillaRoutes.post('/:id/proveedores', async (c) => {
  const supabase  = c.get('supabase');
  const user      = c.get('user');
  const baremoid  = c.req.param('id');
  const body      = await c.req.json<{ proveedor_id: string }>();

  if (!body.proveedor_id) return c.json(err('VALIDATION', 'proveedor_id es requerido'), 422);

  const { data: baremo } = await supabase
    .from('baremos_plantilla')
    .select('tipo')
    .eq('id', baremoid)
    .single();

  if (!baremo) return c.json(err('NOT_FOUND', 'Baremo no encontrado'), 404);
  if (baremo.tipo !== 'Proveedor') {
    return c.json(err('VALIDATION', 'Solo se pueden asignar proveedores a baremos de tipo Proveedor'), 422);
  }

  const { data, error } = await supabase
    .from('baremos_plantilla_proveedores')
    .insert({ baremo_id: baremoid, proveedor_id: body.proveedor_id })
    .select('*, proveedores(id, nombre)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return c.json(err('DUPLICATE', 'El proveedor ya está asignado a este baremo'), 409);
    }
    return c.json(err('DB_ERROR', error.message), 500);
  }

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla_proveedores', registro_id: data.id, accion: 'INSERT',
    actor_id: user.id, cambios: { baremo_id: baremoid, proveedor_id: body.proveedor_id },
  });
  return c.json({ data, error: null }, 201);
});

// DELETE /baremos-plantilla/:id/proveedores/:proveedorId
baremosPlantillaRoutes.delete('/:id/proveedores/:proveedorId', async (c) => {
  const supabase    = c.get('supabase');
  const user        = c.get('user');
  const baremoid    = c.req.param('id');
  const proveedorId = c.req.param('proveedorId');

  const { error } = await supabase
    .from('baremos_plantilla_proveedores')
    .delete()
    .eq('baremo_id', baremoid)
    .eq('proveedor_id', proveedorId);

  if (error) return c.json(err('DB_ERROR', error.message), 500);

  await insertAudit(supabase, {
    tabla: 'baremos_plantilla_proveedores', registro_id: baremoid, accion: 'DELETE',
    actor_id: user.id, cambios: { proveedor_id: proveedorId },
  });
  return c.json({ data: { deleted: true }, error: null });
});
