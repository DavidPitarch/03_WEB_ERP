import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const tareasRoutes = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /tareas/metricas — Metricas agregadas (must be before /:id routes)
// ---------------------------------------------------------------------------
tareasRoutes.get('/metricas', async (c) => {
  const supabase = c.get('supabase');
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: todas, error } = await supabase
    .from('tareas_internas')
    .select('id, estado, fecha_limite, created_at, resuelta_at');

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  const total = todas.length;
  const pendientes = todas.filter((t: any) => t.estado === 'pendiente').length;
  const en_progreso = todas.filter((t: any) => t.estado === 'en_progreso').length;
  const pospuestas = todas.filter((t: any) => t.estado === 'pospuesta').length;
  const resueltas = todas.filter((t: any) => t.estado === 'resuelta').length;
  const vencidas = todas.filter(
    (t: any) => t.fecha_limite && t.fecha_limite < now && !['resuelta', 'cancelada'].includes(t.estado)
  ).length;

  // Tiempo medio de resolucion en las ultimas 30 dias
  const resueltasRecientes = todas.filter(
    (t: any) => t.estado === 'resuelta' && t.resuelta_at && t.resuelta_at >= thirtyDaysAgo
  );
  let tiempo_medio_resolucion_horas: number | null = null;
  if (resueltasRecientes.length > 0) {
    const totalMs = resueltasRecientes.reduce((sum: number, t: any) => {
      return sum + (new Date(t.resuelta_at).getTime() - new Date(t.created_at).getTime());
    }, 0);
    tiempo_medio_resolucion_horas = Math.round((totalMs / resueltasRecientes.length / 3_600_000) * 100) / 100;
  }

  return c.json({
    data: { total, pendientes, en_progreso, pospuestas, resueltas, vencidas, tiempo_medio_resolucion_horas },
    error: null,
  });
});

// ---------------------------------------------------------------------------
// GET /tareas — Listar tareas con filtros
// ---------------------------------------------------------------------------
tareasRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const expedienteId = c.req.query('expediente_id');
  const estado = c.req.query('estado');
  const asignadoA = c.req.query('asignado_a');
  const prioridad = c.req.query('prioridad');
  const completada = c.req.query('completada'); // legacy compat
  const vencidasOnly = c.req.query('vencidas_only');

  let query = supabase
    .from('tareas_internas')
    .select('*')
    .order('prioridad', { ascending: false })
    .order('fecha_limite', { ascending: true })
    .limit(200);

  if (expedienteId) query = query.eq('expediente_id', expedienteId);
  if (estado) query = query.eq('estado', estado);
  if (asignadoA) query = query.eq('asignado_a', asignadoA);
  if (prioridad) query = query.eq('prioridad', prioridad);

  // Legacy compat
  if (completada === 'true') query = query.eq('completada', true);
  if (completada === 'false') query = query.eq('completada', false);

  // Solo vencidas: fecha_limite < now AND estado NOT IN ('resuelta', 'cancelada')
  if (vencidasOnly === 'true') {
    const now = new Date().toISOString();
    query = query.lt('fecha_limite', now).not('estado', 'in', '("resuelta","cancelada")');
  }

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// ---------------------------------------------------------------------------
// POST /tareas — Crear tarea
// ---------------------------------------------------------------------------
tareasRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    titulo: string;
    descripcion?: string;
    expediente_id?: string;
    asignado_a?: string;
    fecha_limite?: string;
    prioridad?: string;
    estado?: string;
  }>();

  if (!body.titulo?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'titulo requerido' } }, 422);
  }

  const { data, error } = await supabase
    .from('tareas_internas')
    .insert({
      titulo: body.titulo,
      descripcion: body.descripcion ?? null,
      expediente_id: body.expediente_id ?? null,
      asignado_a: body.asignado_a ?? null,
      creado_por: user.id,
      fecha_limite: body.fecha_limite ?? null,
      prioridad: body.prioridad ?? 'media',
      estado: body.estado ?? 'pendiente',
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'tareas_internas', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: body });
  return c.json({ data, error: null }, 201);
});

// ---------------------------------------------------------------------------
// PUT /tareas/:id — Actualizar campos de tarea
// ---------------------------------------------------------------------------
tareasRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{
    titulo?: string;
    descripcion?: string;
    asignado_a?: string;
    fecha_limite?: string;
    prioridad?: string;
    estado?: string;
  }>();

  const allowedFields = ['titulo', 'descripcion', 'asignado_a', 'fecha_limite', 'prioridad', 'estado'];
  const updates: Record<string, any> = {};

  for (const field of allowedFields) {
    if ((body as any)[field] !== undefined) {
      updates[field] = (body as any)[field];
    }
  }

  // Handle estado transitions
  if (body.estado === 'resuelta') {
    const now = new Date().toISOString();
    updates.resuelta_at = now;
    updates.resuelta_por = user.id;
    updates.completada = true;
    updates.completada_at = now;
  } else if (body.estado !== undefined && body.estado !== 'resuelta') {
    // If moving away from resuelta, clear resolution fields
    // First check current state
    const { data: current } = await supabase
      .from('tareas_internas')
      .select('estado')
      .eq('id', id)
      .single();

    if (current?.estado === 'resuelta') {
      updates.resuelta_at = null;
      updates.resuelta_por = null;
      updates.completada = false;
      updates.completada_at = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'No hay campos para actualizar' } }, 422);
  }

  const { data, error } = await supabase
    .from('tareas_internas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'tareas_internas', registro_id: id, accion: 'UPDATE', actor_id: user.id, cambios: updates });
  return c.json({ data, error: null });
});

// ---------------------------------------------------------------------------
// POST /tareas/:id/posponer — Posponer tarea
// ---------------------------------------------------------------------------
tareasRoutes.post('/:id/posponer', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ fecha_pospuesta: string; motivo: string }>();

  if (!body.fecha_pospuesta || !body.motivo?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'fecha_pospuesta y motivo requeridos' } }, 422);
  }

  const updates = {
    estado: 'pospuesta',
    fecha_pospuesta: body.fecha_pospuesta,
    motivo_posposicion: body.motivo,
  };

  const { data, error } = await supabase
    .from('tareas_internas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'tareas_internas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { ...updates, workflow_action: 'POSPONER' },
  });
  return c.json({ data, error: null });
});

// ---------------------------------------------------------------------------
// POST /tareas/:id/resolver — Resolver tarea
// ---------------------------------------------------------------------------
tareasRoutes.post('/:id/resolver', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ resolucion?: string }>();

  const now = new Date().toISOString();
  const updates = {
    estado: 'resuelta',
    resolucion: body.resolucion ?? null,
    resuelta_por: user.id,
    resuelta_at: now,
    completada: true,
    completada_at: now,
  };

  const { data, error } = await supabase
    .from('tareas_internas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, {
    tabla: 'tareas_internas',
    registro_id: id,
    accion: 'UPDATE',
    actor_id: user.id,
    cambios: { ...updates, workflow_action: 'RESOLVER' },
  });
  return c.json({ data, error: null });
});

// ---------------------------------------------------------------------------
// GET /tareas/:id/comentarios — Listar comentarios de una tarea
// ---------------------------------------------------------------------------
tareasRoutes.get('/:id/comentarios', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('comentarios_tarea')
    .select('*')
    .eq('tarea_id', id)
    .order('created_at', { ascending: true });

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// ---------------------------------------------------------------------------
// POST /tareas/:id/comentarios — Crear comentario en una tarea
// ---------------------------------------------------------------------------
tareasRoutes.post('/:id/comentarios', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ contenido: string }>();

  if (!body.contenido?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'contenido requerido' } }, 422);
  }

  const { data, error } = await supabase
    .from('comentarios_tarea')
    .insert({
      tarea_id: id,
      autor_id: user.id,
      contenido: body.contenido,
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'comentarios_tarea', registro_id: data.id, accion: 'INSERT', actor_id: user.id, cambios: { tarea_id: id, contenido: body.contenido } });
  return c.json({ data, error: null }, 201);
});
