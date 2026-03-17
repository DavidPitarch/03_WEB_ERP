import { Hono } from 'hono';
import { insertAudit, insertDomainEvent } from '../services/audit';
import type { Env } from '../types';

export const citasRoutes = new Hono<{ Bindings: Env }>();

// POST /citas — Crear cita
citasRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json();

  // Validar expediente existe
  const { data: exp } = await supabase
    .from('expedientes')
    .select('id, estado')
    .eq('id', body.expediente_id)
    .single();

  if (!exp) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Expediente no encontrado' } }, 404);
  }

  // Solo se puede agendar cita si el expediente está en planificación o en curso
  const estadosPermitidos = ['EN_PLANIFICACION', 'EN_CURSO', 'PENDIENTE_CLIENTE'];
  if (!estadosPermitidos.includes(exp.estado)) {
    return c.json({
      data: null,
      error: { code: 'INVALID_STATE', message: `No se puede crear cita en estado ${exp.estado}` },
    }, 422);
  }

  // Validar operario existe
  const { data: operario } = await supabase
    .from('operarios')
    .select('id')
    .eq('id', body.operario_id)
    .eq('activo', true)
    .single();

  if (!operario) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Operario no encontrado o inactivo' } }, 404);
  }

  // Validar franja horaria
  if (body.franja_inicio >= body.franja_fin) {
    return c.json({
      data: null,
      error: { code: 'VALIDATION', message: 'La franja de inicio debe ser anterior a la de fin' },
    }, 422);
  }

  const cita = {
    expediente_id: body.expediente_id,
    operario_id: body.operario_id,
    fecha: body.fecha,
    franja_inicio: body.franja_inicio,
    franja_fin: body.franja_fin,
    notas: body.notas ?? null,
  };

  const { data, error } = await supabase.from('citas').insert(cita).select().single();

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  // Actualizar operario del expediente si no tiene
  await supabase
    .from('expedientes')
    .update({ operario_id: body.operario_id })
    .eq('id', body.expediente_id)
    .is('operario_id', null);

  await Promise.all([
    insertAudit(supabase, {
      tabla: 'citas',
      registro_id: data.id,
      accion: 'INSERT',
      actor_id: user.id,
      cambios: cita,
    }),
    insertDomainEvent(supabase, {
      aggregate_id: body.expediente_id,
      aggregate_type: 'expediente',
      event_type: 'CitaAgendada',
      payload: { cita_id: data.id, operario_id: body.operario_id, fecha: body.fecha },
      actor_id: user.id,
    }),
  ]);

  return c.json({ data, error: null }, 201);
});

// GET /citas?expediente_id=xxx — Citas de un expediente
citasRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const expedienteId = c.req.query('expediente_id');

  if (!expedienteId) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'expediente_id requerido' } }, 400);
  }

  const { data, error } = await supabase
    .from('citas')
    .select('*, operarios(nombre, apellidos)')
    .eq('expediente_id', expedienteId)
    .order('fecha', { ascending: false });

  if (error) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }

  return c.json({ data, error: null });
});
