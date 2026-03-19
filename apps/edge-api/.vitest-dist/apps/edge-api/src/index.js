import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createClient } from '@supabase/supabase-js';
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
import { authMiddleware } from './middleware/auth';
import { requireRoles } from './middleware/roles';
import { OFFICE_ROLES, OPERATOR_ROLES, PERITO_ROUTE_ROLES, VIDEOPERITACION_ROLES } from './security/role-groups';
import { scheduled } from './scheduled';
const app = new Hono();
function getAllowedOrigins(envValue) {
    const defaults = ['http://localhost:5173', 'http://localhost:5174'];
    const extra = envValue?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
    return [...new Set([...defaults, ...extra])];
}
// Global middleware
app.use('*', logger());
app.use('*', (c, next) => {
    const origins = getAllowedOrigins(c.env.ALLOWED_ORIGINS);
    return cors({ origin: origins, credentials: true })(c, next);
});
// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
// ─── Rate limiter for public endpoints ───
const rateLimitMap = new Map();
function rateLimit(limit, windowMs) {
    return async (c, next) => {
        const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
        const now = Date.now();
        const entry = rateLimitMap.get(ip);
        if (!entry || now > entry.reset) {
            rateLimitMap.set(ip, { count: 1, reset: now + windowMs });
        }
        else {
            entry.count++;
            if (entry.count > limit) {
                return c.json({ data: null, error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes' } }, 429);
            }
        }
        await next();
    };
}
// ─── Public routes (no auth) ───
// Pedido confirmation via magic link — rate limited
app.post('/api/v1/public/pedidos/:id/confirmar', rateLimit(20, 60_000), async (c) => {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
    const id = c.req.param('id');
    const { token } = await c.req.json();
    if (!token)
        return c.json({ data: null, error: { code: 'VALIDATION', message: 'token es requerido' } }, 422);
    const { data: pedido } = await supabase
        .from('pedidos_material')
        .select('id, estado, token_confirmacion, token_expira_at, proveedor_id, numero_pedido')
        .eq('id', id)
        .single();
    if (!pedido)
        return c.json({ data: null, error: { code: 'NOT_FOUND', message: 'Pedido no encontrado' } }, 404);
    if (pedido.token_confirmacion !== token)
        return c.json({ data: null, error: { code: 'TOKEN_INVALIDO', message: 'Token no válido' } }, 422);
    if (new Date(pedido.token_expira_at) < new Date())
        return c.json({ data: null, error: { code: 'TOKEN_EXPIRADO', message: 'Token expirado' } }, 422);
    if (pedido.estado !== 'enviado')
        return c.json({ data: null, error: { code: 'ESTADO_INVALIDO', message: 'Pedido ya confirmado o no enviado' } }, 422);
    const now = new Date().toISOString();
    await supabase.from('pedidos_material').update({ estado: 'confirmado', confirmado_at: now }).eq('id', id);
    await supabase.from('confirmaciones_proveedor').insert({ pedido_id: id, proveedor_id: pedido.proveedor_id, confirmado_at: now, token_usado: token });
    await supabase.from('historial_pedido').insert({ pedido_id: id, estado_anterior: 'enviado', estado_nuevo: 'confirmado', actor_id: '00000000-0000-0000-0000-000000000000' });
    return c.json({ data: { message: 'Pedido confirmado correctamente' }, error: null });
});
// Public VP webhook endpoint — rate limited, no auth
app.route('/api/v1/public/videoperitacion/webhooks', vpWebhooksRoutes);
app.use('/api/v1/public/customer-tracking', rateLimit(30, 60_000));
app.use('/api/v1/public/customer-tracking/*', rateLimit(30, 60_000));
app.route('/api/v1/public/customer-tracking', customerTrackingPublicRoutes);
// Protected routes
const api = new Hono();
api.use('*', authMiddleware);
function protectRouteGroup(path, middleware) {
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
protectRouteGroup('/customer-tracking-links', requireRoles(OFFICE_ROLES));
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
app.route('/api/v1', api);
export default app;
export { scheduled };
