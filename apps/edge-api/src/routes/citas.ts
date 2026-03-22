import { Hono } from 'hono';
import { getRequestIp } from '../http/request-metadata';
import {
  createCitaCommand,
  normalizeCommandError,
} from '../services/core-commands';
import { checkDisponibilidad, assertDisponibilidadOk } from '../services/calendario';
import type { Env } from '../types';

export const citasRoutes = new Hono<{ Bindings: Env }>();

// POST /citas - Crear cita
citasRoutes.post('/', async (c) => {
  const supabase = c.get('adminSupabase');
  const user = c.get('user');
  const body = await c.req.json<{
    expediente_id?: string;
    operario_id?: string;
    fecha?: string;
    franja_inicio?: string;
    franja_fin?: string;
    notas?: string | null;
    omitir_disponibilidad?: boolean;
  }>();

  const required = ['expediente_id', 'operario_id', 'fecha', 'franja_inicio', 'franja_fin'];
  const missing = required.filter((field) => !body[field as keyof typeof body]);
  if (missing.length > 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: `Campos requeridos: ${missing.join(', ')}` } }, 422);
  }

  // ── Comprobación de disponibilidad del operario ──────────────────────────
  // omitir_disponibilidad sólo para roles con excepción justificada (admin/supervisor)
  const omitir = body.omitir_disponibilidad === true && ['admin','supervisor'].some((r) => user.roles?.includes(r));
  if (!omitir) {
    try {
      const disponibilidad = await checkDisponibilidad(
        c.get('supabase'),
        body.operario_id!,
        body.fecha!,
        body.franja_inicio!,
        body.franja_fin!,
      );
      assertDisponibilidadOk(disponibilidad);
    } catch (dispError: any) {
      if (dispError.code === 'OPERARIO_NO_DISPONIBLE') {
        return c.json({
          data: null,
          error: {
            code:    'OPERARIO_NO_DISPONIBLE',
            message: dispError.message,
            details: dispError.details,
          },
        }, 422);
      }
      // Si falla la comprobación por error de BD, continuar (no bloquear operaciones)
    }
  }
  // ── Fin comprobación ─────────────────────────────────────────────────────

  try {
    const data = await createCitaCommand(
      supabase,
      {
        expediente_id: body.expediente_id!,
        operario_id: body.operario_id!,
        fecha: body.fecha!,
        franja_inicio: body.franja_inicio!,
        franja_fin: body.franja_fin!,
        notas: body.notas ?? null,
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

// GET /citas?expediente_id=xxx - Citas de un expediente
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
