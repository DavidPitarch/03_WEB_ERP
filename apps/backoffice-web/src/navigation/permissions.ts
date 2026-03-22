// ─── PERMISSIONS — Role Groups ──────────────────────────────────────────────
// Constantes de agrupación de roles para navegación y visibilidad.
// Fuente de verdad funcional del backoffice. El enforcement real es en backend.

import type { UserRole } from './types';

/** Todos los roles con acceso al backoffice */
export const ALL_BACKOFFICE: UserRole[] = [
  'admin', 'supervisor', 'tramitador', 'financiero', 'direccion',
];

/** Solo administrador del sistema */
export const ADMIN_ONLY: UserRole[] = ['admin'];

/** Admin + supervisor */
export const ADMIN_SUPERVISOR: UserRole[] = ['admin', 'supervisor'];

/** Admin + supervisor + tramitador (operaciones día a día) */
export const OPS_ROLES: UserRole[] = ['admin', 'supervisor', 'tramitador'];

/** Acceso a módulos financieros */
export const FINANCE_ROLES: UserRole[] = ['admin', 'supervisor', 'financiero', 'direccion'];

/** Solo dirección y admin */
export const DIRECCION_ROLES: UserRole[] = ['admin', 'direccion'];

/** Acceso a informes y reporting */
export const REPORTING_ROLES: UserRole[] = ['admin', 'supervisor', 'direccion', 'financiero'];

/** Acceso al módulo de peritos */
export const PERITO_ACCESS: UserRole[] = ['admin', 'supervisor', 'tramitador', 'direccion', 'perito'];

/** Acceso a gestión de operarios */
export const OPERARIO_ACCESS: UserRole[] = ['admin', 'supervisor', 'tramitador'];

/** Visible a todo el que puede entrar al backoffice */
export const ANY_ROLE: UserRole[] = [];

/**
 * Comprueba si el usuario tiene al menos uno de los roles requeridos.
 * Si allowedRoles está vacío, la respuesta siempre es true.
 */
export function hasAnyRole(userRoles: string[], allowedRoles: UserRole[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.some((r) => userRoles.includes(r));
}
