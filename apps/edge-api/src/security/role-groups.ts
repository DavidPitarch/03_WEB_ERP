import type { Rol } from '@erp/types';

export const OFFICE_ROLES: Rol[] = ['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'];

export const OPERATOR_ROLES: Rol[] = ['operario'];

export const PERITO_ROUTE_ROLES: Rol[] = ['admin', 'supervisor', 'tramitador', 'direccion', 'perito'];

export const PERITO_ADMIN_ROLES: Rol[] = ['admin', 'supervisor', 'tramitador', 'direccion'];

export const VIDEOPERITACION_ROLES: Rol[] = ['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'];

export function hasAnyRole(userRoles: string[], allowedRoles: Rol[]): boolean {
  return userRoles.some((role) => allowedRoles.includes(role as Rol));
}
