import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import type { Env } from '../types';

export const authMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Token requerido' } }, 401);
  }

  const token = authHeader.slice(7);

  const userSupabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: { user }, error } = await userSupabase.auth.getUser(token);
  if (error || !user) {
    return c.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Token invalido' } }, 401);
  }

  const adminSupabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Roles resueltos desde backend para no depender de RLS en user_roles.
  const { data: userRoles } = await adminSupabase
    .from('user_roles')
    .select('roles(nombre)')
    .eq('user_id', user.id);

  const roles = (userRoles ?? []).map((ur: any) => ur.roles?.nombre).filter(Boolean);

  c.set('user', { id: user.id, email: user.email!, roles });
  c.set('userSupabase', userSupabase);
  c.set('adminSupabase', adminSupabase);
  c.set('supabase', adminSupabase);

  await next();
});
