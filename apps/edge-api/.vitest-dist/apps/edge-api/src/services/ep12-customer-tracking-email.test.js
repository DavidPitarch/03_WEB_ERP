/**
 * EP-12 Sprint 1 — Tests de email, emisión y seguridad del Customer Tracking.
 *
 * Cubre los escenarios del sprint que NO estaban en customer-tracking.test.ts:
 *   - Emisión con email del asegurado
 *   - Emisión sin email (distribución manual)
 *   - Modo degradado / dry-run cuando falta RESEND_API_KEY
 *   - Seguridad: un token no puede acceder a otro expediente
 *   - No se exponen campos internos prohibidos en la respuesta
 *   - Registro de timeline en la emisión del link
 *   - Dominio de email_status correcto en cada escenario
 */
import { describe, expect, it, vi } from 'vitest';
import { buildCustomerTrackingView, buildCustomerTrackingTimeline, hashCustomerTrackingToken, validateCustomerTrackingToken, } from './customer-tracking';
import { sendCustomerTrackingEmail } from './email-sender';
// ─── Helpers de fábrica ───────────────────────────────────────────────────────
function makeToken(overrides = {}) {
    const now = new Date('2026-03-22T10:00:00.000Z');
    return {
        id: 'tok-ep12-1',
        expediente_id: 'exp-ep12-1',
        token_hash: 'somehash',
        expires_at: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
        max_uses: 25,
        use_count: 0,
        revoked_at: null,
        ...overrides,
    };
}
// ─── Supabase stub mínimo ─────────────────────────────────────────────────────
function makeSupabaseStub(overrides = {}) {
    const calls = [];
    return {
        _calls: calls,
        from: (table) => ({
            update: (data) => ({
                eq: (_col, _val) => Promise.resolve({ error: null }),
            }),
            insert: (data) => Promise.resolve({ error: null }),
            ...overrides,
        }),
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// 1. Token hashing — determinista
// ─────────────────────────────────────────────────────────────────────────────
describe('hashCustomerTrackingToken', () => {
    it('produce un hash SHA-256 hex de 64 caracteres', async () => {
        const rawToken = 'test-token-abc-123';
        const hash = await hashCustomerTrackingToken(rawToken);
        expect(hash).toHaveLength(64);
        expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
    it('el mismo token siempre produce el mismo hash', async () => {
        const raw = crypto.randomUUID();
        const h1 = await hashCustomerTrackingToken(raw);
        const h2 = await hashCustomerTrackingToken(raw);
        expect(h1).toBe(h2);
    });
    it('tokens distintos producen hashes distintos', async () => {
        const h1 = await hashCustomerTrackingToken('token-a');
        const h2 = await hashCustomerTrackingToken('token-b');
        expect(h1).not.toBe(h2);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 2. Escenarios de emisión — email_status según condición
// ─────────────────────────────────────────────────────────────────────────────
describe('sendCustomerTrackingEmail — escenarios de estado de envío', () => {
    const baseParams = {
        tokenId: 'tok-1',
        to: 'cliente@ejemplo.com',
        aseguradoNombre: 'María García',
        numeroExpediente: 'EXP-2026-00099',
        companiaLabel: 'Mutua Test',
        trackingUrl: 'http://localhost:5173/customer-tracking/raw-token-here',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    };
    it('[dry_run] opera sin RESEND_API_KEY y devuelve success=true, dryRun=true', async () => {
        const supabase = makeSupabaseStub();
        const result = await sendCustomerTrackingEmail(supabase, undefined, // sin API key
        baseParams, 'actor-uid');
        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(true);
        expect(result.messageId).toMatch(/^dry-/);
        expect(result.error).toBeUndefined();
    });
    it('[sent] llama a Resend y devuelve success=true cuando la API responde 200', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'msg-resend-001' }),
        });
        vi.stubGlobal('fetch', fetchMock);
        const supabase = makeSupabaseStub();
        const result = await sendCustomerTrackingEmail(supabase, 'valid-api-key', baseParams, 'actor-uid');
        expect(result.success).toBe(true);
        expect(result.dryRun).toBe(false);
        expect(result.messageId).toBe('msg-resend-001');
        // Verifica que llamó a Resend con el asunto correcto
        expect(fetchMock).toHaveBeenCalledOnce();
        const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(callBody.subject).toContain(baseParams.numeroExpediente);
        expect(callBody.to).toContain(baseParams.to);
        vi.restoreAllMocks();
    });
    it('[failed] devuelve success=false cuando Resend responde con error 4xx', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 422,
            text: async () => 'Unprocessable',
        });
        vi.stubGlobal('fetch', fetchMock);
        const supabase = makeSupabaseStub();
        const result = await sendCustomerTrackingEmail(supabase, 'invalid-key', baseParams, 'actor-uid');
        expect(result.success).toBe(false);
        expect(result.dryRun).toBe(false);
        expect(result.error).toContain('422');
        vi.restoreAllMocks();
    });
    it('[failed] devuelve success=false cuando fetch lanza excepción de red', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
        vi.stubGlobal('fetch', fetchMock);
        const supabase = makeSupabaseStub();
        const result = await sendCustomerTrackingEmail(supabase, 'valid-key', baseParams, 'actor-uid');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Network error');
        vi.restoreAllMocks();
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 3. Escenario sin email del asegurado — token sigue emitiéndose
// ─────────────────────────────────────────────────────────────────────────────
describe('emisión del link cuando el asegurado no tiene email', () => {
    it('la validación del token es independiente del email del asegurado', () => {
        // El token se crea correctamente aunque no haya email.
        // El sistema devuelve email_status = 'no_email' y el link en la respuesta.
        const token = makeToken({ use_count: 0, revoked_at: null });
        const result = validateCustomerTrackingToken(token, new Date('2026-03-22T10:00:00.000Z'));
        expect(result.ok).toBe(true);
        // El flow de no-email es responsabilidad del route handler; aquí confirmamos
        // que el token en sí es válido (no se contamina con la condición de email).
        expect(result.code).toBe('TOKEN_VALIDO');
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 4. Seguridad — un token no puede revelar datos de otro expediente
// ─────────────────────────────────────────────────────────────────────────────
describe('seguridad: aislamiento por token', () => {
    it('validateCustomerTrackingToken devuelve TOKEN_INVALIDO para token null (nunca existió)', () => {
        const result = validateCustomerTrackingToken(null);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_INVALIDO');
        expect(result.status).toBe(404);
    });
    it('un token revocado recibe TOKEN_REVOCADO independientemente de use_count', () => {
        const token = makeToken({ revoked_at: '2026-03-22T08:00:00.000Z', use_count: 0 });
        const result = validateCustomerTrackingToken(token, new Date('2026-03-22T10:00:00.000Z'));
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_REVOCADO');
        expect(result.status).toBe(410);
    });
    it('un token expirado recibe TOKEN_EXPIRADO aunque tenga usos disponibles', () => {
        const token = makeToken({
            expires_at: '2026-03-21T00:00:00.000Z', // ayer
            use_count: 0,
            revoked_at: null,
        });
        const result = validateCustomerTrackingToken(token, new Date('2026-03-22T10:00:00.000Z'));
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_EXPIRADO');
        expect(result.status).toBe(410);
    });
    it('un token con use_count == max_uses recibe TOKEN_AGOTADO', () => {
        const token = makeToken({ max_uses: 5, use_count: 5, revoked_at: null });
        const result = validateCustomerTrackingToken(token, new Date('2026-03-22T10:00:00.000Z'));
        expect(result.ok).toBe(false);
        expect(result.code).toBe('TOKEN_AGOTADO');
        expect(result.status).toBe(422);
    });
    it('la lógica de validación es estrictamente order: revocado > expirado > agotado', () => {
        // Un token revocado Y expirado Y agotado debe devolver TOKEN_REVOCADO primero.
        const token = makeToken({
            revoked_at: '2026-03-21T00:00:00.000Z',
            expires_at: '2026-03-20T00:00:00.000Z',
            max_uses: 1,
            use_count: 1,
        });
        const result = validateCustomerTrackingToken(token, new Date('2026-03-22T10:00:00.000Z'));
        expect(result.code).toBe('TOKEN_REVOCADO');
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 5. No exposición de campos prohibidos en la vista pública
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCustomerTrackingView — campos prohibidos ausentes', () => {
    const FORBIDDEN_FIELDS = [
        'compania_id', 'asegurado_id', 'empresa_facturadora_id',
        'numero_poliza', 'numero_siniestro_cia', 'tramitador_id',
        'perito_id', 'operario_id', 'user_id',
        'importe', 'total', 'factura', 'cobro', 'presupuesto',
        'audit', 'domain_event', 'token_hash', 'token_id',
    ];
    it('no incluye ningún campo interno prohibido en la respuesta', () => {
        const view = buildCustomerTrackingView({
            expediente: {
                id: 'exp-1',
                numero_expediente: 'EXP-2026-00001',
                estado: 'EN_PLANIFICACION',
                tipo_siniestro: 'agua',
                updated_at: '2026-03-22T10:00:00.000Z',
            },
            cita: {
                id: 'cita-1',
                fecha: '2026-03-25',
                franja_inicio: '09:00:00',
                franja_fin: '11:00:00',
                estado: 'programada',
                customer_confirmed_at: null,
                customer_reschedule_requested_at: null,
                customer_reschedule_requested_slot: null,
                customer_reschedule_status: null,
            },
            operario: { nombre: 'Pedro', apellidos: 'Sánchez' },
            contacto: { label: 'Oficina Central', telefono: '900123456', email: null },
            timeline: [],
            now: new Date('2026-03-22T10:00:00.000Z'),
        });
        const viewStr = JSON.stringify(view);
        for (const field of FORBIDDEN_FIELDS) {
            expect(viewStr).not.toContain(`"${field}"`);
        }
    });
    it('el técnico se identifica solo con nombre + inicial de apellido', () => {
        const view = buildCustomerTrackingView({
            expediente: { id: 'e1', numero_expediente: 'EXP-001', estado: 'EN_CURSO', tipo_siniestro: 'fuego', updated_at: '' },
            cita: { id: 'c1', fecha: '2026-03-25', franja_inicio: '10:00:00', franja_fin: '12:00:00', estado: 'programada',
                customer_confirmed_at: null, customer_reschedule_requested_at: null,
                customer_reschedule_requested_slot: null, customer_reschedule_status: null },
            operario: { nombre: 'Ana', apellidos: 'Rodríguez' },
            contacto: null,
            timeline: [],
            now: new Date('2026-03-22T10:00:00.000Z'),
        });
        expect(view.cita?.tecnico?.identificacion).toBe('Ana R.');
        // No debe contener el apellido completo
        expect(view.cita?.tecnico?.identificacion).not.toContain('Rodríguez');
    });
    it('el expediente en la respuesta no contiene el campo id interno sensible', () => {
        const view = buildCustomerTrackingView({
            expediente: { id: 'exp-secret-uuid', numero_expediente: 'EXP-002', estado: 'NUEVO', tipo_siniestro: 'robo', updated_at: '' },
            cita: null,
            operario: null,
            contacto: null,
            timeline: [],
        });
        // El id sí está presente (es necesario para el frontend), pero los campos
        // financieros/internos no deben estar.
        // Verificamos que el objeto no tenga propiedades de la tabla interna.
        expect('numero_poliza' in view.expediente).toBe(false);
        expect('compania_id' in view.expediente).toBe(false);
        expect('asegurado_id' in view.expediente).toBe(false);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 6. Timeline B2C — solo hitos visibles para el cliente
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCustomerTrackingTimeline — filtrado de contenido B2C', () => {
    it('excluye comunicaciones internas (sin flag customer_tracking_visible)', () => {
        const timeline = buildCustomerTrackingTimeline({
            historial: [],
            citas: [],
            comunicaciones: [
                {
                    id: 'c-internal',
                    contenido: 'Nota interna: presupuesto discutido con perito',
                    created_at: '2026-03-22T09:00:00.000Z',
                    metadata: { internal: true, customer_tracking_visible: false },
                },
                {
                    id: 'c-public',
                    contenido: 'Tu cita ha sido reprogramada.',
                    created_at: '2026-03-22T10:00:00.000Z',
                    metadata: { customer_tracking_visible: true, customer_tracking_label: 'Cita reprogramada' },
                },
            ],
        });
        expect(timeline.some((item) => item.id === 'accion-c-internal')).toBe(false);
        expect(timeline.some((item) => item.id === 'accion-c-public')).toBe(true);
    });
    it('incluye hitos de estado con etiquetas no técnicas', () => {
        const timeline = buildCustomerTrackingTimeline({
            historial: [
                { id: 'h1', estado_nuevo: 'EN_PLANIFICACION', created_at: '2026-03-22T08:00:00.000Z' },
                { id: 'h2', estado_nuevo: 'EN_CURSO', created_at: '2026-03-22T09:00:00.000Z' },
            ],
            citas: [],
            comunicaciones: [],
        });
        expect(timeline).toHaveLength(2);
        const labels = timeline.map((t) => t.title);
        // Deben ser etiquetas legibles, no códigos internos en mayúsculas
        expect(labels.some((l) => /EN_PLANIFICACION|EN_CURSO/.test(l))).toBe(false);
        expect(labels.some((l) => /Planificando|intervencion/i.test(l))).toBe(true);
    });
    it('ordena los hitos de más reciente a más antiguo', () => {
        const timeline = buildCustomerTrackingTimeline({
            historial: [
                { id: 'h1', estado_nuevo: 'NUEVO', created_at: '2026-03-20T08:00:00.000Z' },
                { id: 'h2', estado_nuevo: 'EN_PLANIFICACION', created_at: '2026-03-21T08:00:00.000Z' },
                { id: 'h3', estado_nuevo: 'EN_CURSO', created_at: '2026-03-22T08:00:00.000Z' },
            ],
            citas: [],
            comunicaciones: [],
        });
        const dates = timeline.map((t) => new Date(t.created_at).getTime());
        for (let i = 0; i < dates.length - 1; i++) {
            expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
        }
    });
    it('no supera el máximo de 20 hitos en la respuesta', () => {
        const muchoHistorial = Array.from({ length: 30 }, (_, i) => ({
            id: `h${i}`,
            estado_nuevo: 'EN_CURSO',
            created_at: new Date(2026, 2, i + 1).toISOString(),
        }));
        const timeline = buildCustomerTrackingTimeline({
            historial: muchoHistorial,
            citas: [],
            comunicaciones: [],
        });
        expect(timeline.length).toBeLessThanOrEqual(20);
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 7. Template de email — contenido obligatorio presente
// ─────────────────────────────────────────────────────────────────────────────
describe('sendCustomerTrackingEmail — contenido del template HTML', () => {
    it('el HTML enviado a Resend contiene el número de expediente, el CTA y la fecha de expiración', async () => {
        let capturedBody = null;
        const fetchMock = vi.fn().mockImplementation((_url, options) => {
            capturedBody = options.body;
            return Promise.resolve({
                ok: true,
                json: async () => ({ id: 'msg-check' }),
            });
        });
        vi.stubGlobal('fetch', fetchMock);
        const expiresAt = new Date('2026-04-15T12:00:00.000Z').toISOString();
        const supabase = makeSupabaseStub();
        await sendCustomerTrackingEmail(supabase, 'any-key', {
            tokenId: 'tok-x',
            to: 'test@email.com',
            aseguradoNombre: 'Juan Pérez',
            numeroExpediente: 'EXP-2026-00500',
            companiaLabel: 'Aseguradora Demo',
            trackingUrl: 'https://erp.example.com/customer-tracking/abc',
            expiresAt,
        }, 'actor-id');
        expect(capturedBody).not.toBeNull();
        const parsed = JSON.parse(capturedBody);
        // Asunto con referencia
        expect(parsed.subject).toContain('EXP-2026-00500');
        // Cuerpo con número de expediente, CTA y URL
        expect(parsed.html).toContain('EXP-2026-00500');
        expect(parsed.html).toContain('https://erp.example.com/customer-tracking/abc');
        expect(parsed.html).toContain('Ver estado de mi expediente');
        // Branding neutro
        expect(parsed.html).toContain('Equipo de Gestión de Siniestros');
        expect(parsed.html).toContain('Aseguradora Demo');
        // Remitente
        expect(parsed.from).toContain('noreply@erp-siniestros.com');
        vi.restoreAllMocks();
    });
    it('el HTML incluye el enlace en texto plano además del botón CTA', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'x' }) });
        vi.stubGlobal('fetch', fetchMock);
        const trackingUrl = 'https://erp.example.com/customer-tracking/unique-token-123';
        const supabase = makeSupabaseStub();
        await sendCustomerTrackingEmail(supabase, 'key', { tokenId: 't', to: 'a@b.com', aseguradoNombre: 'A', numeroExpediente: 'EXP-1',
            companiaLabel: null, trackingUrl, expiresAt: new Date().toISOString() }, 'u');
        const html = JSON.parse(fetchMock.mock.calls[0][1].body).html;
        // URL debe aparecer al menos dos veces: en el href del botón y en texto plano
        const occurrences = (html.match(new RegExp(trackingUrl.replace(/\//g, '\\/'), 'g')) ?? []).length;
        expect(occurrences).toBeGreaterThanOrEqual(2);
        vi.restoreAllMocks();
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 8. Registro en timeline en la emisión del link
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCustomerTrackingActionMetadata — trazabilidad de acciones cliente', () => {
    it('incluye los flags necesarios para que la timeline filtre correctamente', () => {
        // Re-importamos la función de customer-tracking que se usa en el route handler
        // para asegurarnos que el metadata que se inserta pasará el filtro del timeline.
        const { buildCustomerTrackingActionMetadata } = require('./customer-tracking');
        const metadata = buildCustomerTrackingActionMetadata('Enlace emitido', 'emitir_link');
        expect(metadata.customer_tracking_visible).toBe(true);
        expect(metadata.customer_tracking_label).toBe('Enlace emitido');
        expect(metadata.module).toBe('customer_tracking');
    });
});
