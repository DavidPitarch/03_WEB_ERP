import { Hono } from 'hono';
import type { Env } from '../types';

export const usersRoutes = new Hono<{ Bindings: Env }>();

// GET /users/me — perfil del usuario autenticado
usersRoutes.get('/me', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('nombre, apellidos, nif, extension, telefono, avatar_url')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Perfil no encontrado' } }, 404);
  }

  return c.json({
    data: {
      nombre_completo: [profile.nombre, profile.apellidos].filter(Boolean).join(' '),
      nombre:          profile.nombre,
      apellidos:       profile.apellidos ?? '',
      nif:             profile.nif ?? '',
      email:           user.email,
      extension:       profile.extension ?? '',
      username:        user.email.split('@')[0],
      telefono:        profile.telefono ?? '',
      avatar_url:      profile.avatar_url ?? null,
      roles:           user.roles,
    },
    error: null,
  });
});

// PUT /users/me — actualizar datos del perfil del usuario autenticado
usersRoutes.put('/me', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<any>();

  const allowed = ['nombre', 'apellidos', 'nif', 'extension', 'telefono'];
  const patch: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ data: null, error: { code: 'VALIDATION', message: 'No hay campos a actualizar' } }, 422);
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(patch)
    .eq('id', user.id)
    .select('nombre, apellidos, nif, extension, telefono')
    .single();

  if (error || !data) {
    return c.json({ data: null, error: { code: 'DB_ERROR', message: error?.message ?? 'Error al actualizar' } }, 500);
  }

  await supabase.from('auditoria').insert({
    tabla:       'user_profiles',
    registro_id: user.id,
    accion:      'UPDATE',
    actor_id:    user.id,
    cambios:     patch,
  });

  return c.json({ data, error: null });
});
