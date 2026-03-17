import { describe, expect, it } from 'vitest';
import { VP_SIGNED_URL_TTL_SECONDS, canAccessVpArtefactScope, hasVpOfficeAccess, } from './vp-access';
describe('vp access helpers', () => {
    it('keeps signed URL TTL aligned with the ADR security limit', () => {
        expect(VP_SIGNED_URL_TTL_SECONDS).toBe(900);
    });
    it('recognizes office roles for VP artifact access', () => {
        expect(hasVpOfficeAccess(['tramitador'])).toBe(true);
        expect(hasVpOfficeAccess(['perito'])).toBe(false);
    });
    it('blocks perito access when not assigned', () => {
        expect(canAccessVpArtefactScope(['perito'], 'perito', false)).toBe(false);
    });
    it('allows assigned perito access only for perito or all scopes', () => {
        expect(canAccessVpArtefactScope(['perito'], 'perito', true)).toBe(true);
        expect(canAccessVpArtefactScope(['perito'], 'all', true)).toBe(true);
        expect(canAccessVpArtefactScope(['perito'], 'office', true)).toBe(false);
    });
});
