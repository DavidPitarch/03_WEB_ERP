import { createMiddleware } from 'hono/factory';
import { hasAnyRole } from '../security/role-groups';
export function requireRoles(allowedRoles) {
    return createMiddleware(async (c, next) => {
        const user = c.get('user');
        const hasRole = hasAnyRole(user.roles, allowedRoles);
        if (!hasRole) {
            return c.json({
                data: null,
                error: {
                    code: 'FORBIDDEN',
                    message: `Acceso restringido. Roles permitidos: ${allowedRoles.join(', ')}`,
                },
            }, 403);
        }
        await next();
    });
}
