import { describe, expect, it } from 'vitest';
import { buildAuthorizedTechnicianLabel, buildCustomerTrackingActionMetadata, buildCustomerTrackingTimeline, buildCustomerTrackingView, canConfirmCustomerAppointment, canRequestCustomerReschedule, validateCustomerTrackingToken, } from './customer-tracking';
describe('customer tracking token validation', () => {
    const now = new Date('2026-03-18T12:00:00.000Z');
    it('accepts a valid token', () => {
        const result = validateCustomerTrackingToken({
            id: 'tok-1',
            expediente_id: 'exp-1',
            token_hash: 'hash',
            expires_at: '2026-03-19T12:00:00.000Z',
            max_uses: 5,
            use_count: 1,
            revoked_at: null,
        }, now);
        expect(result.ok).toBe(true);
        expect(result.code).toBe('TOKEN_VALIDO');
    });
    it('rejects an expired token', () => {
        const result = validateCustomerTrackingToken({
            id: 'tok-1',
            expediente_id: 'exp-1',
            token_hash: 'hash',
            expires_at: '2026-03-17T12:00:00.000Z',
            max_uses: 5,
            use_count: 1,
            revoked_at: null,
        }, now);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_EXPIRADO');
    });
    it('rejects an invalid token record', () => {
        const result = validateCustomerTrackingToken(null, now);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_INVALIDO');
    });
    it('rejects a revoked token', () => {
        const result = validateCustomerTrackingToken({
            id: 'tok-1',
            expediente_id: 'exp-1',
            token_hash: 'hash',
            expires_at: '2026-03-19T12:00:00.000Z',
            max_uses: 5,
            use_count: 1,
            revoked_at: '2026-03-18T09:00:00.000Z',
        }, now);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_REVOCADO');
        expect(result.status).toBe(410);
    });
    it('rejects an exhausted token', () => {
        const result = validateCustomerTrackingToken({
            id: 'tok-1',
            expediente_id: 'exp-1',
            token_hash: 'hash',
            expires_at: '2026-03-19T12:00:00.000Z',
            max_uses: 5,
            use_count: 5,
            revoked_at: null,
        }, now);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_AGOTADO');
        expect(result.status).toBe(422);
    });
});
describe('customer tracking cita actions', () => {
    const now = new Date('2026-03-18T12:00:00.000Z');
    it('allows confirming a future appointment only once', () => {
        expect(canConfirmCustomerAppointment({
            estado: 'programada',
            fecha: '2026-03-19',
            franja_fin: '11:00:00',
            customer_confirmed_at: null,
        }, now)).toBe(true);
        expect(canConfirmCustomerAppointment({
            estado: 'confirmada',
            fecha: '2026-03-19',
            franja_fin: '11:00:00',
            customer_confirmed_at: '2026-03-18T10:00:00.000Z',
        }, now)).toBe(false);
    });
    it('blocks reschedule requests near the appointment or when already pending', () => {
        expect(canRequestCustomerReschedule({
            estado: 'programada',
            fecha: '2026-03-18',
            franja_inicio: '14:00:00',
            customer_reschedule_status: null,
        }, now, 4)).toBe(false);
        expect(canRequestCustomerReschedule({
            estado: 'programada',
            fecha: '2026-03-19',
            franja_inicio: '14:00:00',
            customer_reschedule_status: 'pendiente',
        }, now, 4)).toBe(false);
    });
});
describe('customer tracking timeline', () => {
    it('includes only customer-visible communications', () => {
        const timeline = buildCustomerTrackingTimeline({
            historial: [{ id: 'h-1', estado_nuevo: 'EN_PLANIFICACION', created_at: '2026-03-18T10:00:00.000Z' }],
            citas: [{ id: 'c-1', fecha: '2026-03-19', franja_inicio: '09:00:00', franja_fin: '11:00:00', estado: 'programada', created_at: '2026-03-18T11:00:00.000Z' }],
            comunicaciones: [
                {
                    id: 'com-visible',
                    contenido: 'Has solicitado una nueva franja.',
                    created_at: '2026-03-18T12:00:00.000Z',
                    metadata: buildCustomerTrackingActionMetadata('Solicitud de cambio recibida', 'solicitar_cambio'),
                },
                {
                    id: 'com-hidden',
                    contenido: 'Nota interna no visible',
                    created_at: '2026-03-18T12:30:00.000Z',
                    metadata: { internal: true },
                },
            ],
        });
        expect(timeline).toHaveLength(3);
        expect(timeline.some((item) => item.id === 'accion-com-visible')).toBe(true);
        expect(timeline.some((item) => item.id === 'accion-com-hidden')).toBe(false);
    });
});
describe('customer tracking payload sanitization', () => {
    it('does not expose forbidden internal fields', () => {
        const view = buildCustomerTrackingView({
            expediente: {
                id: 'exp-1',
                numero_expediente: 'EXP-2026-00008',
                estado: 'EN_PLANIFICACION',
                tipo_siniestro: 'agua',
                updated_at: '2026-03-18T12:00:00.000Z',
            },
            cita: {
                id: 'c-1',
                fecha: '2026-03-19',
                franja_inicio: '09:00:00',
                franja_fin: '11:00:00',
                estado: 'programada',
                customer_confirmed_at: null,
                customer_reschedule_requested_at: null,
                customer_reschedule_requested_slot: null,
                customer_reschedule_status: null,
            },
            operario: { nombre: 'Carlos', apellidos: 'Garcia' },
            contacto: { label: 'Oficina', telefono: '910000000', email: 'oficina@erp.local' },
            timeline: [],
            now: new Date('2026-03-18T12:00:00.000Z'),
        });
        expect(view.expediente.numero_expediente).toBe('EXP-2026-00008');
        expect('compania_id' in view.expediente).toBe(false);
        expect('numero_poliza' in view.expediente).toBe(false);
        expect(view.cita?.tecnico?.identificacion).toBe('Carlos G.');
    });
    it('labels the technician with authorized identification', () => {
        expect(buildAuthorizedTechnicianLabel({ nombre: 'Marta', apellidos: 'Lopez' })).toBe('Marta L.');
    });
});
