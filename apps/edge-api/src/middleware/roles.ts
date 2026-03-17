import { createMiddleware } from 'hono/factory';
import type { Rol } from '@erp/types';
import { hasAnyRole } from '../security/role-groups';
import type { Env } from '../types';

export function requireRoles(allowedRoles: Rol[]) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const user = c.get('user');
    const hasRole = hasAnyRole(user.roles, allowedRoles);

    if (!hasRole) {
      return c.json(
        {
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: `Acceso restringido. Roles permitidos: ${allowedRoles.join(', ')}`,
          },
        },
        403,
      );
    }

    await next();
  });
}
