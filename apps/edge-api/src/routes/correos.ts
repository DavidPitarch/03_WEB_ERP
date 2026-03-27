import { Hono } from 'hono';
import { insertAudit } from '../services/audit';
import type { Env } from '../types';

export const correosRoutes = new Hono<{ Bindings: Env }>();

// GET /correos
correosRoutes.get('/', async (c) => {
  const supabase = c.get('supabase');
  const activa = c.req.query('activa');
  const compania_id = c.req.query('compania_id');

  let query = supabase
    .from('correos_cuentas')
    .select('id, compania_id, nombre, direccion, usuario, servidor_imap, puerto_imap, servidor_smtp, puerto_smtp, usa_tls, activa, es_remitente_defecto, created_at, updated_at');

  if (activa !== undefined && activa !== '') query = query.eq('activa', activa === 'true');
  if (compania_id) query = query.eq('compania_id', compania_id);
  query = query.order('nombre', { ascending: true });

  const { data, error } = await query;
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);
  return c.json({ data, error: null });
});

// GET /correos/:id
correosRoutes.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const { data, error } = await supabase
    .from('correos_cuentas')
    .select('id, compania_id, nombre, direccion, usuario, servidor_imap, puerto_imap, servidor_smtp, puerto_smtp, usa_tls, activa, es_remitente_defecto, created_at, updated_at')
    .eq('id', c.req.param('id'))
    .single();

  if (error) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Cuenta no encontrada' } }, 404);
  return c.json({ data, error: null });
});

// POST /correos
correosRoutes.post('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    nombre: string;
    direccion: string;
    usuario: string;
    password_encrypted?: string;
    servidor_imap?: string;
    puerto_imap?: number;
    servidor_smtp: string;
    puerto_smtp?: number;
    usa_tls?: boolean;
    activa?: boolean;
    es_remitente_defecto?: boolean;
    compania_id?: string;
  }>();

  if (!body.nombre?.trim())      return c.json({ data: null, error: { code: 'VALIDATION', message: 'El nombre es obligatorio' } }, 422);
  if (!body.direccion?.trim())   return c.json({ data: null, error: { code: 'VALIDATION', message: 'La dirección es obligatoria' } }, 422);
  if (!body.servidor_smtp?.trim()) return c.json({ data: null, error: { code: 'VALIDATION', message: 'El servidor SMTP es obligatorio' } }, 422);

  const { data, error } = await supabase
    .from('correos_cuentas')
    .insert({
      nombre:               body.nombre.trim(),
      direccion:            body.direccion.trim().toLowerCase(),
      usuario:              body.usuario.trim(),
      password_encrypted:   body.password_encrypted ?? null,
      servidor_imap:        body.servidor_imap?.trim() ?? null,
      puerto_imap:          body.puerto_imap ?? 993,
      servidor_smtp:        body.servidor_smtp.trim(),
      puerto_smtp:          body.puerto_smtp ?? 587,
      usa_tls:              body.usa_tls ?? true,
      activa:               body.activa ?? true,
      es_remitente_defecto: body.es_remitente_defecto ?? false,
      compania_id:          body.compania_id ?? null,
    })
    .select('id, compania_id, nombre, direccion, usuario, servidor_imap, puerto_imap, servidor_smtp, puerto_smtp, usa_tls, activa, es_remitente_defecto, created_at, updated_at')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'correos_cuentas', accion: 'INSERT', registro_id: data.id, actor_id: user.id, cambios: { ...data, password_encrypted: '[REDACTED]' } });
  return c.json({ data, error: null }, 201);
});

// PUT /correos/:id
correosRoutes.put('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<Partial<{
    nombre: string;
    direccion: string;
    usuario: string;
    password_encrypted: string | null;
    servidor_imap: string | null;
    puerto_imap: number;
    servidor_smtp: string;
    puerto_smtp: number;
    usa_tls: boolean;
    activa: boolean;
    es_remitente_defecto: boolean;
    compania_id: string | null;
  }>>();

  const ALLOWED = ['nombre', 'direccion', 'usuario', 'password_encrypted', 'servidor_imap', 'puerto_imap', 'servidor_smtp', 'puerto_smtp', 'usa_tls', 'activa', 'es_remitente_defecto', 'compania_id'] as const;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (body[k] !== undefined) patch[k] = body[k];
  }

  const { data, error } = await supabase
    .from('correos_cuentas')
    .update(patch)
    .eq('id', id)
    .select('id, compania_id, nombre, direccion, usuario, servidor_imap, puerto_imap, servidor_smtp, puerto_smtp, usa_tls, activa, es_remitente_defecto, created_at, updated_at')
    .single();

  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  const auditPatch = { ...patch };
  if (auditPatch.password_encrypted) auditPatch.password_encrypted = '[REDACTED]';
  await insertAudit(supabase, { tabla: 'correos_cuentas', accion: 'UPDATE', registro_id: id, actor_id: user.id, cambios: auditPatch });
  return c.json({ data, error: null });
});

// DELETE /correos/:id
correosRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { error } = await supabase.from('correos_cuentas').delete().eq('id', id);
  if (error) return c.json({ data: null, error: { code: 'DB_ERROR', message: error.message } }, 500);

  await insertAudit(supabase, { tabla: 'correos_cuentas', accion: 'DELETE', registro_id: id, actor_id: user.id });
  return c.json({ data: { id }, error: null });
});
