import { Hono } from 'hono';
import type { CreateExpedienteRequest, ExpedienteEstado } from '@erp/types';
import { getRequestIp } from '../http/request-metadata';
import {
  createExpedienteCommand,
  normalizeCommandError,
  transitionExpedienteCommand,
} from '../services/core-commands';
import type { Env } from '../types';

export const expedientesRoutes = new Hono<{ Bindings: Env }>();

// GET /expedientes - Listado paginado con filtros
expedientesRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const page = parseInt(c.req.query('page') ?? '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') ?? '20'), 100);
  const estado = c.req.query('estado') as ExpedienteEstado | undefined;
  const companiaId = c.req.query('compania_id');
  const operarioId = c.req.query('operario_id');
  const search = c.req.query('search');
  const prioridad = c.req.query('prioridad');

  let query = supabase
    .from('expedientes')
    .select('*, companias(nombre, codigo), asegurados(nombre, apellidos, telefono), operarios(nombre, apellidos)', { count: 'exact' });

  if (estado) query = query.eq('estado', estado);
  if (companiaId) query = query.eq('compania_id', companiaId);
  if (operarioId) query = query.eq('operario_id', operarioId);
  if (prioridad) query = query.eq('prioridad', prioridad);
  if (search) {
    query = query.or(`numero_expediente.ilike.%${search}%,descripcion.ilike.%${search}%,numero_siniestro_cia.ilike.%${search}%`);
  }

  const from = (page - 1) * perPage;
  query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);

  const { data, error, count } = await query;

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

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

// GET /expedientes/:id - Detalle
expedientesRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('expedientes')
    .select('*, companias(*), asegurados(*), operarios(*), peritos(*), empresas_facturadoras(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
  }

  return c.json({ data, error: null });
});

// POST /expedientes - Crear expediente
expedientesRoutes.post('/', async (c) => {
  const supabase = c.get('adminSupabase');
  const user = c.get('user');
  const body = await c.req.json<CreateExpedienteRequest>();

  const required = ['compania_id', 'empresa_facturadora_id', 'tipo_siniestro', 'descripcion', 'direccion_siniestro', 'codigo_postal', 'localidad', 'provincia'];
  const missing = required.filter((field) => !body[field as keyof typeof body]);
  if (missing.length > 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: `Campos requeridos: ${missing.join(', ')}` } }, 422);
  }

  if (!body.asegurado_id && !body.asegurado_nuevo) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'Debe indicar asegurado_id o asegurado_nuevo' } }, 422);
  }

  if (body.asegurado_nuevo) {
    const asegurado = body.asegurado_nuevo;
    if (!asegurado.nombre || !asegurado.apellidos || !asegurado.telefono || !asegurado.direccion || !asegurado.codigo_postal || !asegurado.localidad || !asegurado.provincia) {
      return c.json({ data: null, error: { code: 'VALIDATION', message: 'Datos del asegurado incompletos' } }, 422);
    }
  }

  try {
    const data = await createExpedienteCommand(
      supabase,
      {
        ...body,
        origen: body.origen ?? 'manual',
      },
      user.id,
      getRequestIp(c),
    );

    return c.json({ data, error: null }, 201);
  } catch (error) {
    const commandError = normalizeCommandError(error);
    return c.json({
      data: null,
      error: {
        code: commandError.code,
        message: commandError.message,
        details: commandError.details,
      },
    }, commandError.status);
  }
});

// POST /expedientes/:id/transicion - Transicion de estado
expedientesRoutes.post('/:id/transicion', async (c) => {
  const supabase = c.get('adminSupabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const { estado_nuevo, motivo, causa_pendiente, causa_pendiente_detalle } = await c.req.json<{
    estado_nuevo: ExpedienteEstado;
    motivo?: string;
    causa_pendiente?: string;
    causa_pendiente_detalle?: string;
  }>();

  if (!estado_nuevo) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'estado_nuevo es requerido' } }, 422);
  }

  try {
    const data = await transitionExpedienteCommand(
      supabase,
      {
        expediente_id: id,
        estado_nuevo,
        motivo,
        causa_pendiente,
        causa_pendiente_detalle,
      },
      user.id,
      getRequestIp(c),
    );

    return c.json({ data, error: null });
  } catch (error) {
    const commandError = normalizeCommandError(error);
    return c.json({
      data: null,
      error: {
        code: commandError.code,
        message: commandError.message,
        details: commandError.details,
      },
    }, commandError.status);
  }
});

// GET /expedientes/:id/timeline - Timeline unificada
expedientesRoutes.get('/:id/timeline', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const [comunicaciones, historial, citas] = await Promise.all([
    supabase.from('comunicaciones').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
    supabase.from('historial_estados').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
    supabase.from('citas').select('*').eq('expediente_id', id).order('created_at', { ascending: false }),
  ]);

  const timeline = [
    ...(comunicaciones.data ?? []).map((item) => ({ ...item, timeline_type: 'comunicacion' as const })),
    ...(historial.data ?? []).map((item) => ({ ...item, timeline_type: 'estado' as const })),
    ...(citas.data ?? []).map((item) => ({ ...item, timeline_type: 'cita' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return c.json({ data: timeline, error: null });
});

// GET /expedientes/:id/partes - Partes de operario del expediente
expedientesRoutes.get('/:id/partes', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('partes_operario')
    .select('*, operarios(nombre, apellidos, telefono), evidencias:evidencias(id, tipo, clasificacion, nombre_original, storage_path)')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  return c.json({ data, error: null });
});

// GET /expedientes/:id/sla - Estado SLA del expediente
expedientesRoutes.get('/:id/sla', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const { calculateSlaStatus } = await import('../services/sla-engine');
  const sla = await calculateSlaStatus(supabase, id);
  return c.json({ data: sla, error: null });
});

// GET /expedientes/:id/historial - Historial de estados
expedientesRoutes.get('/:id/historial', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('historial_estados')
    .select('*')
    .eq('expediente_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  return c.json({ data, error: null });
});
