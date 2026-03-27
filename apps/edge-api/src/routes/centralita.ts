import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const centralitaRoutes = new Hono<{ Bindings: Env }>();

// GET /centralita/config/:empresa_id
centralitaRoutes.get('/config/:empresa_id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('centralita_config')
    .select('*')
    .eq('empresa_id', c.req.param('empresa_id'))
    .single();

  if (error && error.code !== 'PGRST116') {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  }
  return c.json({ data: data ?? null, error: null });
});

// PUT /centralita/config/:empresa_id  (upsert)
centralitaRoutes.put('/config/:empresa_id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const empresa_id = c.req.param('empresa_id');
  const body = await c.req.json<Partial<{ proveedor: string; config: Record<string, unknown>; activa: boolean }>>();

  const record: Record<string, unknown> = { empresa_id, updated_at: new Date().toISOString() };
  if (body.proveedor !== undefined) record.proveedor = body.proveedor;
  if (body.config    !== undefined) record.config    = body.config;
  if (body.activa    !== undefined) record.activa    = body.activa;

  const { data, error } = await supabase
    .from('centralita_config')
    .upsert(record, { onConflict: 'empresa_id' })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'centralita_config', operacion: 'UPDATE', registro_id: empresa_id, actor_id: user.id, datos_nuevos: record });
  return c.json({ data, error: null });
});

// GET /centralita/llamadas — listado filtrable
centralitaRoutes.get('/llamadas', async (c) => {
  const supabase = c.get('supabase');
  const tipo        = c.req.query('tipo');
  const desde       = c.req.query('desde');
  const hasta       = c.req.query('hasta');
  const compania_id = c.req.query('compania_id');
  const search      = c.req.query('search');
  const page        = parseInt(c.req.query('page') ?? '1');
  const pageSize    = 50;
  const from        = (page - 1) * pageSize;

  let query = supabase
    .from('centralita_llamadas')
    .select('*, usuario:usuario_id(email)', { count: 'exact' });

  if (tipo)        query = query.eq('tipo', tipo);
  if (desde)       query = query.gte('iniciada_at', desde);
  if (hasta)       query = query.lte('iniciada_at', hasta);
  if (compania_id) query = query.eq('compania_id', compania_id);
  if (search)      query = query.or(`origen.ilike.%${search}%,destino.ilike.%${search}%`);

  query = query.order('iniciada_at', { ascending: false }).range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, total: count, page, pageSize, error: null });
});

// POST /centralita/llamadas — registrar llamada (para integración)
centralitaRoutes.post('/llamadas', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    origen?: string;
    destino?: string;
    tipo: 'entrante' | 'saliente' | 'perdida';
    duracion_segundos?: number;
    expediente_id?: string;
    compania_id?: string;
    iniciada_at?: string;
  }>();

  const { data, error } = await supabase
    .from('centralita_llamadas')
    .insert({
      origen:            body.origen ?? null,
      destino:           body.destino ?? null,
      tipo:              body.tipo,
      duracion_segundos: body.duracion_segundos ?? null,
      expediente_id:     body.expediente_id ?? null,
      compania_id:       body.compania_id ?? null,
      usuario_id:        user.id,
      iniciada_at:       body.iniciada_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null }, 201);
});
