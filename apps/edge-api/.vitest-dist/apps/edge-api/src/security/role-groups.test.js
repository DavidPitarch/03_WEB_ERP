import { describe, expect, it } from 'vitest';
import { hasAnyRole, OFFICE_ROLES, PERITO_ADMIN_ROLES, PERITO_ROUTE_ROLES, VIDEOPERITACION_ROLES } from './role-groups';
describe('role groups', () => {
    it('detects access when at least one allowed role matches', () => {
        expect(hasAnyRole(['tramitador'], OFFICE_ROLES)).toBe(true);
        expect(hasAnyRole(['perito'], PERITO_ROUTE_ROLES)).toBe(true);
    });
    it('rejects roles outside the allowed group', () => {
        expect(hasAnyRole(['cliente_final'], OFFICE_ROLES)).toBe(false);
        expect(hasAnyRole(['perito'], PERITO_ADMIN_ROLES)).toBe(false);
    });
    it('keeps videoperitation routes limited to internal office roles', () => {
        expect(hasAnyRole(['financiero'], VIDEOPERITACION_ROLES)).toBe(true);
        expect(hasAnyRole(['perito'], VIDEOPERITACION_ROLES)).toBe(false);
    });
});
