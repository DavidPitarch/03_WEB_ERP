export const OFFICE_ROLES = ['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'];
export const OPERATOR_ROLES = ['operario'];
export const PERITO_ROUTE_ROLES = ['admin', 'supervisor', 'tramitador', 'direccion', 'perito'];
export const PERITO_ADMIN_ROLES = ['admin', 'supervisor', 'tramitador', 'direccion'];
export const VIDEOPERITACION_ROLES = ['admin', 'supervisor', 'tramitador', 'financiero', 'direccion'];
export function hasAnyRole(userRoles, allowedRoles) {
    return userRoles.some((role) => allowedRoles.includes(role));
}
