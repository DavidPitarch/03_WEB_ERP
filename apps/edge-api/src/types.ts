export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  CONFIRM_BASE_URL?: string;
  ALLOWED_ORIGINS?: string; // comma-separated origins for CORS
  VP_WEBHOOK_SECRET?: string;
  CUSTOMER_PORTAL_URL?: string;
  /** KV namespace para rate limiting distribuido. Opcional: sin binding usa fallback in-memory. */
  RATE_LIMIT_KV?: KVNamespace;
  /** Cloudflare Queue para procesamiento asíncrono de documentos y notificaciones. */
  DOMAIN_EVENTS_QUEUE?: Queue;
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
