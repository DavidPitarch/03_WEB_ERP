import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const rgpdRoutes = new Hono<{ Bindings: Env }>();

// GET /rgpd/config/:empresa_id
rgpdRoutes.get('/config/:empresa_id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('rgpd_config')
    .select('*')
    .eq('empresa_id', c.req.param('empresa_id'))
    .single();

  if (error && error.code !== 'PGRST116') {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }
  return c.json({ data: data ?? null, error: null });
});

// PUT /rgpd/config/:empresa_id  (upsert)
rgpdRoutes.put('/config/:empresa_id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const empresa_id = c.req.param('empresa_id');
  const body = await c.req.json<Partial<{
    dias_conservacion_expedientes: number;
    dias_conservacion_comunicaciones: number;
    dias_conservacion_evidencias: number;
    dias_conservacion_facturas: number;
    texto_politica: string | null;
  }>>();

  const record: Record<string, unknown> = { empresa_id, updated_at: new Date().toISOString() };
  if (body.dias_conservacion_expedientes    !== undefined) record.dias_conservacion_expedientes    = body.dias_conservacion_expedientes;
  if (body.dias_conservacion_comunicaciones !== undefined) record.dias_conservacion_comunicaciones = body.dias_conservacion_comunicaciones;
  if (body.dias_conservacion_evidencias     !== undefined) record.dias_conservacion_evidencias     = body.dias_conservacion_evidencias;
  if (body.dias_conservacion_facturas       !== undefined) record.dias_conservacion_facturas       = body.dias_conservacion_facturas;
  if (body.texto_politica !== undefined) record.texto_politica = body.texto_politica;

  const { data, error } = await supabase
    .from('rgpd_config')
    .upsert(record, { onConflict: 'empresa_id' })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'rgpd_config', accion: 'UPDATE', registro_id: empresa_id, actor_id: user.id, cambios: record });
  return c.json({ data, error: null });
});

// GET /rgpd/eliminaciones — lista paginada
rgpdRoutes.get('/eliminaciones', async (c) => {
  const supabase = c.get('supabase');
  const page = parseInt(c.req.query('page') ?? '1');
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('rgpd_eliminaciones')
    .select('*, actor:actor_id(email)', { count: 'exact' })
    .order('eliminado_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, total: count, page, pageSize, error: null });
});

// POST /rgpd/eliminaciones — registrar eliminación
rgpdRoutes.post('/eliminaciones', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ entidad: string; entidad_id: string; motivo?: string }>();

  if (!body.entidad?.trim())    return c.json({ data: null, error: { code: 'VALIDATION', message: 'La entidad es obligatoria' } }, 422);
  if (!body.entidad_id?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El ID de la entidad es obligatorio' } }, 422);

  const { data, error } = await supabase
    .from('rgpd_eliminaciones')
    .insert({ entidad: body.entidad.trim(), entidad_id: body.entidad_id.trim(), motivo: body.motivo?.trim() ?? null, actor_id: user.id })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'rgpd_eliminaciones', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});
