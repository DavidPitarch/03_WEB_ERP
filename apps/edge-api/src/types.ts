export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  CONFIRM_BASE_URL?: string;
  ALLOWED_ORIGINS?: string; // comma-separated origins for CORS
  VP_WEBHOOK_SECRET?: string;
  // DOMAIN_EVENTS_QUEUE: Queue; // descomentar al activar queues
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

// Extiende el contexto de Hono
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    supabase: import('@supabase/supabase-js').SupabaseClient;
    adminSupabase: import('@supabase/supabase-js').SupabaseClient;
    userSupabase: import('@supabase/supabase-js').SupabaseClient;
    /** UUID generado (o propagado) por requestLoggerMiddleware. Presente en todos los requests. */
    correlationId: string;
  }
}
