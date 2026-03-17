import { describe, expect, it } from 'vitest';
import { normalizeExpedienteTimelineType, resolveActorName, } from './expediente-timeline';
describe('expediente timeline helpers', () => {
    it('maps llamada variants to the ERP enum', () => {
        expect(normalizeExpedienteTimelineType('llamada_saliente', 'oficina')).toBe('llamada');
    });
    it('keeps supported timeline types unchanged', () => {
        expect(normalizeExpedienteTimelineType('email_entrante', 'cliente')).toBe('email_entrante');
    });
    it('falls back to sistema for unknown system events', () => {
        expect(normalizeExpedienteTimelineType('vp_aprobada', 'sistema')).toBe('sistema');
    });
    it('falls back to nota_interna for unknown office events', () => {
        expect(normalizeExpedienteTimelineType('vp_aprobada', 'perito')).toBe('nota_interna');
    });
    it('prefers explicit actor name over email or role', () => {
        expect(resolveActorName({ email: 'usuario@erp.test', roles: ['tramitador'] }, 'Ana Oficina')).toBe('Ana Oficina');
    });
    it('uses user email when explicit actor name is missing', () => {
        expect(resolveActorName({ email: 'usuario@erp.test', roles: ['tramitador'] })).toBe('usuario@erp.test');
    });
});
