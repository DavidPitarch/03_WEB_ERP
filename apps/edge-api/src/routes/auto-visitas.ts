import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const autoVisitasRoutes = new Hono<{ Bindings: Env }>();

// GET /auto-visitas/:empresa_id
autoVisitasRoutes.get('/:empresa_id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('auto_visitas_config')
    .select('*')
    .eq('empresa_id', c.req.param('empresa_id'))
    .single();

  if (error && error.code !== 'PGRST116') {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }
  // Si no existe, devolver config por defecto
  const defaults = {
    empresa_id: c.req.param('empresa_id'),
    activo: false,
    horas_aviso_previo: 24,
    max_cambios_cita: 2,
    permitir_cancelacion: true,
    horas_min_cancelacion: 2,
    config_operarios: {},
    config_companias: {},
  };
  return c.json({ data: data ?? defaults, error: null });
});

// PUT /auto-visitas/:empresa_id  (upsert)
autoVisitasRoutes.put('/:empresa_id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const empresa_id = c.req.param('empresa_id');
  const body = await c.req.json<Partial<{
    activo: boolean;
    horas_aviso_previo: number;
    max_cambios_cita: number;
    permitir_cancelacion: boolean;
    horas_min_cancelacion: number;
    config_operarios: Record<string, unknown>;
    config_companias: Record<string, unknown>;
  }>>();

  const ALLOWED = ['activo', 'horas_aviso_previo', 'max_cambios_cita', 'permitir_cancelacion', 'horas_min_cancelacion', 'config_operarios', 'config_companias'] as const;
  const record: Record<string, unknown> = { empresa_id, updated_at: new Date().toISOString() };
  for (const k of ALLOWED) {
    if (body[k] !== undefined) record[k] = body[k];
  }

  const { data, error } = await supabase
    .from('auto_visitas_config')
    .upsert(record, { onConflict: 'empresa_id' })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'auto_visitas_config', accion: 'UPDATE', registro_id: empresa_id, actor_id: user.id, cambios: record });
  return c.json({ data, error: null });
});
