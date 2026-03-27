import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const mensajesPredefinidosRoutes = new Hono<{ Bindings: Env }>();

// GET /mensajes-predefinidos
mensajesPredefinidosRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activo = c.req.query('activo');
  const tipo = c.req.query('tipo');
  const compania_id = c.req.query('compania_id');

  let query = supabase.from('mensajes_predefinidos').select('*');
  if (activo !== undefined && activo !== '') query = query.eq('activo', activo === 'true');
  if (tipo) query = query.eq('tipo', tipo);
  if (compania_id) query = query.or(`compania_id.eq.${compania_id},compania_id.is.null`);
  query = query.order('nombre', { ascending: true });

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /mensajes-predefinidos/:id
mensajesPredefinidosRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('mensajes_predefinidos')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Mensaje no encontrado' } }, 404);
  return c.json({ data, error: null });
});

// POST /mensajes-predefinidos
mensajesPredefinidosRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    nombre: string;
    tipo: 'sms' | 'email' | 'ambos';
    asunto?: string;
    contenido: string;
    variables?: string[];
    activo?: boolean;
    compania_id?: string;
  }>();

  if (!body.nombre?.trim())    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  if (!body.contenido?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El contenido es obligatorio' } }, 422);

  const { data, error } = await supabase
    .from('mensajes_predefinidos')
    .insert({
      nombre:      body.nombre.trim(),
      tipo:        body.tipo ?? 'ambos',
      asunto:      body.asunto?.trim() ?? null,
      contenido:   body.contenido.trim(),
      variables:   body.variables ?? [],
      activo:      body.activo ?? true,
      compania_id: body.compania_id ?? null,
    })
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'mensajes_predefinidos', operacion: 'INSERT', registro_id: data.id, actor_id: user.id, datos_nuevos: data });
  return c.json({ data, error: null }, 201);
});

// PUT /mensajes-predefinidos/:id
mensajesPredefinidosRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    nombre: string;
    tipo: 'sms' | 'email' | 'ambos';
    asunto: string | null;
    contenido: string;
    variables: string[];
    activo: boolean;
    compania_id: string | null;
  }>>();

  const patch: Record<string, unknown> = {};
  if (body.nombre     !== undefined) patch.nombre    = body.nombre.trim();
  if (body.tipo       !== undefined) patch.tipo      = body.tipo;
  if (body.asunto     !== undefined) patch.asunto    = body.asunto?.trim() ?? null;
  if (body.contenido  !== undefined) patch.contenido = body.contenido.trim();
  if (body.variables  !== undefined) patch.variables = body.variables;
  if (body.activo     !== undefined) patch.activo    = body.activo;
  if (body.compania_id !== undefined) patch.compania_id = body.compania_id;

  const { data, error } = await supabase
    .from('mensajes_predefinidos')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'mensajes_predefinidos', operacion: 'UPDATE', registro_id: id, actor_id: user.id, datos_nuevos: patch });
  return c.json({ data, error: null });
});

// DELETE /mensajes-predefinidos/:id
mensajesPredefinidosRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('mensajes_predefinidos').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'mensajes_predefinidos', operacion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
