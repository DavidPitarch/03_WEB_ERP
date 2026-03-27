import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const encuestasRoutes = new Hono<{ Bindings: Env }>();

// GET /encuestas
encuestasRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const compania_id = c.req.query('compania_id');

  let query = supabase
    .from('encuestas')
    .select('*, preguntas:preguntas_encuesta(count)', { count: 'estimated' });

  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  if (compania_id) query = query.or(`compania_id.eq.${compania_id},compania_id.is.null`);
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /encuestas/:id  (con preguntas)
encuestasRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('encuestas')
    .select('*, preguntas:preguntas_encuesta(*)')
    .eq('id', c.req.param('id'))
    .single();

  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Encuesta no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// POST /encuestas
encuestasRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    titulo: string; descripcion?: string; tipo?: string;
    activa?: boolean; envio_auto?: boolean; dias_espera?: number; compania_id?: string;
    preguntas?: Array<{ texto: string; tipo: string; opciones?: string[]; obligatoria?: boolean; orden?: number }>;
  }>();

  if (!body.titulo?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El título es obligatorio' } }, 422);

  const { data: encuesta, error: errEnc } = await supabase
    .from('encuestas')
    .insert({
      titulo:      body.titulo.trim(),
      descripcion: body.descripcion?.trim() ?? null,
      tipo:        body.tipo ?? 'satisfaccion',
      activa:      body.activa ?? true,
      envio_auto:  body.envio_auto ?? false,
      dias_espera: body.dias_espera ?? 0,
      compania_id: body.compania_id ?? null,
    })
    .select().single();

  if (errEnc) return c.json({ data: null, error: { code: 'DB_ERROR', message: errEnc.message } }, 500);

  // Insertar preguntas si se proporcionan
  if (body.preguntas?.length) {
    const pregs = body.preguntas.map((p, idx) => ({
      encuesta_id: encuesta.id, texto: p.texto, tipo: p.tipo,
      opciones: p.opciones ?? [], obligatoria: p.obligatoria ?? true, orden: p.orden ?? idx,
    }));
    await supabase.from('preguntas_encuesta').insert(pregs);
  }

  await insertAudit(supabase, { tabla: 'encuestas', operacion: 'INSERT', registro_id: encuesta.id, actor_id: user.id, datos_nuevos: encuesta });
  return c.json({ data: encuesta, error: null }, 201);
});

// PUT /encuestas/:id
encuestasRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    titulo: string; descripcion: string | null; tipo: string;
    activa: boolean; envio_auto: boolean; dias_espera: number; compania_id: string | null;
  }>>();

  const ALLOWED = ['titulo', 'descripcion', 'tipo', 'activa', 'envio_auto', 'dias_espera', 'compania_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) { if (body[k] !== undefined) patch[k] = body[k]; }

  const { data, error } = await supabase.from('encuestas').update(patch).eq('id', id).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'encuestas', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /encuestas/:id
encuestasRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('encuestas').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'encuestas', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});

// GET /encuestas/:id/respuestas
encuestasRoutes.get('/:id/respuestas', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('respuestas_encuesta')
    .select('*')
    .eq('encuesta_id', c.req.param('id'))
    .order('created_at', { ascending: false });

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});
