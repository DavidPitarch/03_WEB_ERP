import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const plantillasDocumentoRoutes = new Hono<{ Bindings: Env }>();

// GET /plantillas-documento
plantillasDocumentoRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const compania_id = c.req.query('compania_id');
  const seccion = c.req.query('seccion');

  let query = supabase.from('plantillas_documento').select('*');
  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  if (compania_id) query = query.or(`compania_id.eq.${compania_id},compania_id.is.null`);
  if (seccion) query = query.eq('seccion', seccion);
  query = query.order('nombre');

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /plantillas-documento/:id
plantillasDocumentoRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('plantillas_documento')
    .select('*')
    .eq('id', c.req.param('id'))
    .single();

  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Plantilla no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// POST /plantillas-documento
plantillasDocumentoRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    nombre: string; seccion?: string; fichero_url?: string;
    palabras_clave?: string[];
    requiere_firma_operario?: boolean; requiere_firma_asegurado?: boolean;
    activa?: boolean; compania_id?: string;
  }>();

  if (!body.nombre?.trim()) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  }

  const { data, error } = await supabase
    .from('plantillas_documento')
    .insert({
      nombre:                   body.nombre.trim(),
      seccion:                  body.seccion?.trim() ?? null,
      fichero_url:              body.fichero_url ?? null,
      palabras_clave:           body.palabras_clave ?? [],
      requiere_firma_operario:  body.requiere_firma_operario ?? false,
      requiere_firma_asegurado: body.requiere_firma_asegurado ?? false,
      activa:                   body.activa ?? true,
      compania_id:              body.compania_id ?? null,
    })
    .select().single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'plantillas_documento', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: data });
  return c.json({ data, error: null }, 201);
});

// PUT /plantillas-documento/:id
plantillasDocumentoRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    nombre: string; seccion: string | null; fichero_url: string | null;
    palabras_clave: string[];
    requiere_firma_operario: boolean; requiere_firma_asegurado: boolean;
    activa: boolean; compania_id: string | null;
  }>>();

  const ALLOWED = ['nombre', 'seccion', 'fichero_url', 'palabras_clave', 'requiere_firma_operario', 'requiere_firma_asegurado', 'activa', 'compania_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) { if (body[k] !== undefined) patch[k] = body[k]; }

  const { data, error } = await supabase.from('plantillas_documento').update(patch).eq('id', id).select().single();
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'plantillas_documento', accion: 'UPDATE', registro_id: id, actor_id: user.id, cambios: patch });
  return c.json({ data, error: null });
});

// DELETE /plantillas-documento/:id
plantillasDocumentoRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('plantillas_documento').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'plantillas_documento', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
