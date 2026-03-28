import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { expedientesRoutes } from './routes/expedientes';
import { citasRoutes } from './routes/citas';
import { intakeRoutes } from './routes/intake';
import { comunicacionesRoutes } from './routes/comunicaciones';
import { mastersRoutes } from './routes/masters';
import { bandejasRoutes } from './routes/bandejas';
import { searchRoutes } from './routes/search';
import { operatorRoutes } from './routes/operator';
import { partesRoutes } from './routes/partes';
import { tareasRoutes } from './routes/tareas';
import { alertasRoutes } from './routes/alertas';
import { baremosRoutes } from './routes/baremos';
import { presupuestosRoutes } from './routes/presupuestos';
import { facturasRoutes } from './routes/facturas';
import { proveedoresRoutes } from './routes/proveedores';
import { pedidosRoutes } from './routes/pedidos';
import { dashboardRoutes } from './routes/dashboard';
import { autofacturasRoutes } from './routes/autofacturas';
import { peritosRoutes } from './routes/peritos';
import { videoperitacionesRoutes } from './routes/videoperitaciones';
import { vpWebhooksRoutes } from './routes/vp-webhooks';
import { internalRoutes } from './routes/internal';
import { customerTrackingAdminRoutes, customerTrackingPublicRoutes } from './routes/customer-tracking';
import { bancosRoutes } from './routes/bancos';
import { autocitaAdminRoutes, autocitaPublicRoutes } from './routes/autocita';
import { partiesRoutes } from './routes/parties';
import { planningGeoRoutes } from './routes/planning-geo';
import { calendarioRoutes } from './routes/calendario';
import { tramitadoresRoutes } from './routes/tramitadores';
import { asignacionesRoutes } from './routes/asignaciones';
import { usersRoutes } from './routes/users';
import { configEmisionRoutes } from './routes/config-emision';
import { cockpitRoutes } from './routes/cockpit';
import { especialidadesRoutes } from './routes/especialidades';
import { festivosRoutes } from './routes/festivos';
import { comercialesRoutes } from './routes/comerciales';
import { tiposSiniestroRoutes } from './routes/tipos-siniestro';
import { docRequeridaRoutes } from './routes/doc-requerida';
import { condicionesPresupuestoRoutes } from './routes/condiciones-presupuesto';
import { mensajesPredefinidosRoutes } from './routes/mensajes-predefinidos';
import { correosRoutes } from './routes/correos';
import { rgpdRoutes } from './routes/rgpd';
import { autoVisitasRoutes } from './routes/auto-visitas';
import { centralitaRoutes } from './routes/centralita';
import { lineasFacturacionRoutes } from './routes/lineas-facturacion';
import { encuestasRoutes } from './routes/encuestas';
import { eventosRoutes } from './routes/eventos';
import { plantillasDocumentoRoutes } from './routes/plantillas-documento';
import { gruposCamposRoutes } from './routes/grupos-campos';
import { operariosRoutes } from './routes/operarios';
import { baremosPlantillaRoutes } from './routes/baremos-plantilla';
import { siniestrosRoutes } from './routes/siniestros';
import { authMiddleware } from './middleware/auth';
import { requireRoles } from './middleware/roles';
import { checkRateLimit } from './services/rate-limiter';
import { OFFICE_ROLES, OPERATOR_ROLES, PERITO_ROUTE_ROLES, VIDEOPERITACION_ROLES } from './security/role-groups';
import { scheduled } from './scheduled';
import { queue } from './queue';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// ─── Global error handler ─────────────────────────────────────────────────────
// Convierte cualquier excepción no capturada en JSON con formato ApiResult,
// evitando que Hono devuelva text/plain y el frontend muestre el mensaje genérico.
app.onError((err, c) => {
  console.error(JSON.stringify({
    level: 'error',
    source: 'global_error_handler',
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    ts: new Date().toISOString(),
  }));
  return c.json(
    { data: null, error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Error interno del servidor' } },
    500,
  );
});

function getAllowedOrigins(envValue?: string): string[] {
  const defaults = ['http://localhost:5173', 'http://localhost:5174'];
  const extra = envValue?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  return [...new Set([...defaults, ...extra])];
}

// Global middleware
app.use('*', requestLoggerMiddleware());
app.use('*', (c, next) => {
  const origins = getAllowedOrigins(c.env.ALLOWED_ORIGINS);
  return cors({ origin: origins, credentials: true })(c, next);
});

// Health check — reports degraded when optional-but-critical secrets are absent
app.get('/health', (c) => {
  const warnings: string[] = [];

  if (!c.env.RESEND_API_KEY) {
    warnings.push('RESEND_API_KEY not configured — email dispatch in dry-run mode');
  }
  if (!c.env.VP_WEBHOOK_SECRET) {
    warnings.push('VP_WEBHOOK_SECRET not configured — VP webhooks will not be verified');
  }
  if (!c.env.CONFIRM_BASE_URL) {
    warnings.push('CONFIRM_BASE_URL not configured — customer tracking links will be malformed');
  }

  const degraded = warnings.length > 0;

  return c.json({
    status: degraded ? 'degraded' : 'ok',
    // Expose warnings in non-production to aid local dev; hide in production to avoid info leakage
    ...(c.env.ENVIRONMENT !== 'production' && degraded ? { warnings } : {}),
    timestamp: new Date().toISOString(),
  }, degraded ? 207 : 200);
});

// ─── Rate limiter para endpoints públicos (KV distribuido + fallback in-memory) ───
function rateLimit(limit: number, windowMs: number, endpointKey?: string) {
  return async (c: any, next: any) => {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const endpoint = endpointKey ?? c.req.path;
    const allowed = await checkRateLimit(
      c.env?.RATE_LIMIT_KV,
      ip,
      endpoint,
      limit,
      Math.ceil(windowMs / 1000),
    );
    if (!allowed) {
      return c.json({ data: null, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Inténtalo más tarde.' } }, 429);
    }
    await next();
  };
}

// ─── Public routes (no auth) ───
// Pedido confirmation via magic link — rate limited
app.post('/api/v1/public/pedidos/:id/confirmar', rateLimit(20, 60_000, 'pedidos-confirmar'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const id = c.req.param('id');
  const { token } = await c.req.json<{ token: string }>();

  if (!token) return c.json({ data: null, error: { code: 'VALIDATION', message: 'token es requerido' } }, 422);

  const { data: pedido } = await supabase
    .from('pedidos_material')
    .select('id, estado, token_confirmacion, token_expira_at, proveedor_id, numero_pedido')
    .eq('id', id)
    .single();

  if (!pedido) return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } }, 404);
  if (pedido.token_confirmacion !== token) return c.json({ data: null, error: { code: 'TOKEN_INVALIDO', message: 'Token no válido' } }, 422);
  if (new Date(pedido.token_expira_at) < new Date()) return c.json({ data: null, error: { code: 'TOKEN_EXPIRADO', message: 'Token expirado' } }, 422);
  if (pedido.estado !== 'enviado') return c.json({ data: null, error: { code: 'ESTADO_INVALIDO', message: 'Pedido ya confirmado o no enviado' } }, 422);

  const now = new Date().toISOString();
  await supabase.from('pedidos_material').update({ estado: 'confirmado', confirmado_at: now }).eq('id', id);
  await supabase.from('confirmaciones_proveedor').insert({ pedido_id: id, proveedor_id: pedido.proveedor_id, confirmado_at: now, token_usado: token });
  await supabase.from('historial_pedido').insert({ pedido_id: id, estado_anterior: 'enviado', estado_nuevo: 'confirmado', actor_id: '00000000-0000-0000-0000-000000000000' });

  return c.json({ data: { message: 'Pedido confirmado correctamente' }, error: null });
});

// Public VP webhook endpoint — rate limited, no auth
app.route('/api/v1/public/videoperitacion/webhooks', vpWebhooksRoutes);
app.use('/api/v1/public/customer-tracking', rateLimit(30, 60_000, 'customer-tracking'));
app.use('/api/v1/public/customer-tracking/*', rateLimit(30, 60_000, 'customer-tracking'));
app.route('/api/v1/public/customer-tracking', customerTrackingPublicRoutes);

// Autocita public routes — stricter rate limit (10 req/min per IP)
app.use('/api/v1/public/autocita', rateLimit(10, 60_000, 'autocita'));
app.use('/api/v1/public/autocita/*', rateLimit(10, 60_000, 'autocita'));
app.route('/api/v1/public/autocita', autocitaPublicRoutes);

// Protected routes
const api = new Hono<{ Bindings: Env }>();
api.use('*', authMiddleware);

function protectRouteGroup(path: string, middleware: any) {
  api.use(path, middleware);
  api.use(`${path}/*`, middleware);
}

protectRouteGroup('/expedientes', requireRoles(OFFICE_ROLES));
protectRouteGroup('/citas', requireRoles(OFFICE_ROLES));
protectRouteGroup('/intake', requireRoles(OFFICE_ROLES));
protectRouteGroup('/comunicaciones', requireRoles(OFFICE_ROLES));
protectRouteGroup('/masters', requireRoles(OFFICE_ROLES));
protectRouteGroup('/bandejas', requireRoles(OFFICE_ROLES));
protectRouteGroup('/search', requireRoles(OFFICE_ROLES));
protectRouteGroup('/partes', requireRoles(OFFICE_ROLES));
protectRouteGroup('/tareas', requireRoles(OFFICE_ROLES));
protectRouteGroup('/alertas', requireRoles(OFFICE_ROLES));
protectRouteGroup('/baremos', requireRoles(OFFICE_ROLES));
protectRouteGroup('/presupuestos', requireRoles(OFFICE_ROLES));
protectRouteGroup('/dashboard', requireRoles(['admin', 'supervisor', 'financiero']));
protectRouteGroup('/autofacturas', requireRoles(['admin', 'financiero']));
protectRouteGroup('/pedidos', requireRoles(['admin', 'supervisor', 'tramitador', 'financiero']));
protectRouteGroup('/proveedores', requireRoles(['admin', 'supervisor', 'tramitador', 'financiero']));
protectRouteGroup('/facturas', requireRoles(['admin', 'supervisor', 'tramitador', 'financiero']));
protectRouteGroup('/operator', requireRoles(OPERATOR_ROLES));
protectRouteGroup('/peritos', requireRoles(PERITO_ROUTE_ROLES));
protectRouteGroup('/videoperitaciones', requireRoles(VIDEOPERITACION_ROLES));
protectRouteGroup('/internal', requireRoles(['admin']));
protectRouteGroup('/planning', requireRoles(OFFICE_ROLES));
protectRouteGroup('/customer-tracking-links', requireRoles(OFFICE_ROLES));
protectRouteGroup('/autocita-links', requireRoles(OFFICE_ROLES));
protectRouteGroup('/parties', requireRoles(OFFICE_ROLES));
protectRouteGroup('/calendario', requireRoles([...OFFICE_ROLES, ...OPERATOR_ROLES]));
protectRouteGroup('/bancos', requireRoles(['admin', 'financiero', 'supervisor', 'direccion']));
protectRouteGroup('/tramitadores', requireRoles(['admin', 'supervisor', 'direccion']));
protectRouteGroup('/asignaciones', requireRoles(['admin', 'supervisor', 'direccion']));
// /users/me accesible para cualquier usuario autenticado (sin restricción de rol)
protectRouteGroup('/config-emision', requireRoles(['admin', 'financiero', 'supervisor', 'tramitador']));
protectRouteGroup('/especialidades', requireRoles(OFFICE_ROLES));
protectRouteGroup('/festivos', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/comerciales', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/tipos-siniestro', requireRoles(OFFICE_ROLES));
protectRouteGroup('/doc-requerida', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/condiciones-presupuesto', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/mensajes-predefinidos', requireRoles(OFFICE_ROLES));
protectRouteGroup('/correos', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/rgpd', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/auto-visitas', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/centralita', requireRoles(['admin', 'supervisor', 'tramitador']));
protectRouteGroup('/lineas-facturacion', requireRoles(['admin', 'supervisor', 'tramitador', 'financiero']));
protectRouteGroup('/encuestas', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/eventos', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/plantillas-documento', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/grupos-campos', requireRoles(['admin', 'supervisor']));
protectRouteGroup('/operarios-mgmt', requireRoles(['admin', 'supervisor', 'tramitador']));
protectRouteGroup('/baremos-plantilla', requireRoles(['admin', 'supervisor', 'tramitador', 'financiero']));
protectRouteGroup('/siniestros', requireRoles(OFFICE_ROLES));
api.use('/facturas/:id/registrar-cobro', requireRoles(['admin', 'financiero']));
api.use('/facturas/:id/registrar-cobro/*', requireRoles(['admin', 'financiero']));
api.route('/expedientes', expedientesRoutes);
api.route('/citas', citasRoutes);
api.route('/intake', intakeRoutes);
api.route('/comunicaciones', comunicacionesRoutes);
api.route('/masters', mastersRoutes);
api.route('/bandejas', bandejasRoutes);
api.route('/search', searchRoutes);
api.route('/operator', operatorRoutes);
api.route('/partes', partesRoutes);
api.route('/tareas', tareasRoutes);
api.route('/alertas', alertasRoutes);
api.route('/baremos', baremosRoutes);
api.route('/presupuestos', presupuestosRoutes);
api.route('/facturas', facturasRoutes);
api.route('/proveedores', proveedoresRoutes);
api.route('/pedidos', pedidosRoutes);
api.route('/dashboard', dashboardRoutes);
api.route('/autofacturas', autofacturasRoutes);
api.route('/peritos', peritosRoutes);
api.route('/videoperitaciones', videoperitacionesRoutes);
api.route('/internal', internalRoutes);
api.route('/customer-tracking-links', customerTrackingAdminRoutes);
api.route('/autocita-links', autocitaAdminRoutes);
api.route('/parties', partiesRoutes);
api.route('/planning', planningGeoRoutes);
api.route('/calendario', calendarioRoutes);
api.route('/bancos', bancosRoutes);
api.route('/tramitadores', tramitadoresRoutes);
api.route('/asignaciones', asignacionesRoutes);
api.route('/users', usersRoutes);
protectRouteGroup('/cockpit', requireRoles(OFFICE_ROLES));
api.route('/cockpit', cockpitRoutes);
api.route('/config-emision', configEmisionRoutes);
api.route('/especialidades', especialidadesRoutes);
api.route('/festivos', festivosRoutes);
api.route('/comerciales', comercialesRoutes);
api.route('/tipos-siniestro', tiposSiniestroRoutes);
api.route('/doc-requerida', docRequeridaRoutes);
api.route('/condiciones-presupuesto', condicionesPresupuestoRoutes);
api.route('/mensajes-predefinidos', mensajesPredefinidosRoutes);
api.route('/correos', correosRoutes);
api.route('/rgpd', rgpdRoutes);
api.route('/auto-visitas', autoVisitasRoutes);
api.route('/centralita', centralitaRoutes);
api.route('/lineas-facturacion', lineasFacturacionRoutes);
api.route('/encuestas', encuestasRoutes);
api.route('/eventos', eventosRoutes);
api.route('/plantillas-documento', plantillasDocumentoRoutes);
api.route('/grupos-campos', gruposCamposRoutes);
api.route('/operarios-mgmt', operariosRoutes);
api.route('/baremos-plantilla', baremosPlantillaRoutes);
api.route('/siniestros', siniestrosRoutes);

app.route('/api/v1', api);

// Module worker export — Cloudflare Workers resolves fetch, scheduled, and queue
// from the default export when it is a plain object.
export default {
  fetch: app.fetch.bind(app),
  scheduled,
  queue,
};
