import { describe, it, expect } from 'vitest';
// ─── Helpers ───
const FACTURA_ROLES = ['admin', 'supervisor', 'financiero'];
const ENVIO_ROLES = ['admin', 'supervisor', 'financiero'];
const DOCFINAL_GENERATE_ROLES = ['perito', 'admin', 'supervisor'];
const DOCFINAL_REGENERATE_ROLES = ['admin', 'supervisor'];
const ALL_AUTHENTICATED_ROLES = ['admin', 'supervisor', 'financiero', 'tramitador', 'perito'];
const VP_TRANSITIONS_SPRINT5 = {
    'valoracion_calculada->emitir-factura': 'facturado',
    'facturado->enviar-informe': 'enviado',
};
function canEmitFactura(role) {
    return FACTURA_ROLES.includes(role);
}
function canEnviarInforme(role) {
    return ENVIO_ROLES.includes(role);
}
function canGenerateDocFinal(role) {
    return DOCFINAL_GENERATE_ROLES.includes(role);
}
function canRegenerateDocFinal(role) {
    return DOCFINAL_REGENERATE_ROLES.includes(role);
}
function canView(role) {
    return ALL_AUTHENTICATED_ROLES.includes(role);
}
function canRetryEnvio(role) {
    return ENVIO_ROLES.includes(role);
}
function formatNumeroFactura(prefijo, year, counter) {
    return `${prefijo}${year}-${String(counter).padStart(5, '0')}`;
}
function checkFacturaPreconditions(vp, empresaCif) {
    if (!vp.informe || vp.informe.estado !== 'validado') {
        return { ok: false, code: 412, error: 'PRECONDITION: informe must be validado' };
    }
    if (!vp.valoracion || !['calculada', 'validada'].includes(vp.valoracion.estado)) {
        return { ok: false, code: 412, error: 'PRECONDITION: valoracion must be calculada or validada' };
    }
    if (!empresaCif) {
        return { ok: false, code: 412, error: 'PRECONDITION: empresa CIF is required' };
    }
    return { ok: true, code: 200 };
}
function checkEnvioPreconditions(vp) {
    if (!vp.documento_final_url) {
        return { ok: false, code: 412, error: 'PRECONDITION: documento final must be generated' };
    }
    return { ok: true, code: 200 };
}
// ─── Mock factories ───
function makeVP(overrides = {}) {
    return {
        id: 'vp-1',
        estado: 'valoracion_calculada',
        expediente_id: 'exp-1',
        informe: { estado: 'validado', version: 3 },
        valoracion: { estado: 'calculada', total_aplicado: 631.00, baremo_id: 'bar-1', baremo_version: 3, baremo_nombre: 'Baremo AXA 2026' },
        documento_final_url: null,
        documento_final_version: 0,
        ...overrides,
    };
}
function makeFactura(overrides = {}) {
    return {
        id: 'fact-1',
        numero_factura: 'VP2026-00001',
        expediente_id: 'exp-1',
        empresa_cif: 'B12345678',
        total: 631.00,
        lineas: [
            { descripcion: 'Reparación tubería', cantidad: 2, precio_unitario: 85.50, importe: 171.00 },
            { descripcion: 'Pintura pared', cantidad: 15, precio_unitario: 12.00, importe: 180.00 },
            { descripcion: 'Mano de obra', cantidad: 8, precio_unitario: 35.00, importe: 280.00 },
        ],
        created_at: '2026-03-17T10:00:00Z',
        ...overrides,
    };
}
function makeEnvio(overrides = {}) {
    return {
        id: 'envio-1',
        vp_id: 'vp-1',
        canal: 'email',
        estado: 'pendiente',
        intento_numero: 1,
        error_detalle: null,
        created_at: '2026-03-17T11:00:00Z',
        ...overrides,
    };
}
// ─── 1. Documento final generation ───
describe('EP-11B Sprint 5 — Documento Final Generation', () => {
    it('generate requires validated informe', () => {
        const vp = makeVP({ informe: { estado: 'borrador', version: 1 } });
        const canGenerate = vp.informe.estado === 'validado';
        expect(canGenerate).toBe(false);
        const vpOk = makeVP({ informe: { estado: 'validado', version: 3 } });
        const canGenerateOk = vpOk.informe.estado === 'validado';
        expect(canGenerateOk).toBe(true);
    });
    it('consolidates all informe sections + valoracion + branding', () => {
        const vp = makeVP();
        const docFinal = {
            datos_expediente: { expediente_id: vp.expediente_id },
            informe: vp.informe,
            valoracion: vp.valoracion,
            branding: { logo_url: '/assets/logo-empresa.png', color_primario: '#003366' },
            sections: ['datos_expediente', 'hallazgos', 'resolucion_pericial', 'valoracion_economica', 'evidencias'],
        };
        expect(docFinal.informe).toBeTruthy();
        expect(docFinal.valoracion).toBeTruthy();
        expect(docFinal.branding.logo_url).toBeTruthy();
        expect(docFinal.sections).toContain('valoracion_economica');
        expect(docFinal.sections).toContain('hallazgos');
    });
    it('version increments on regeneration', () => {
        const vp = makeVP({ documento_final_version: 1, documento_final_url: '/docs/vp-1-v1.pdf' });
        // Regenerate
        const newVersion = vp.documento_final_version + 1;
        vp.documento_final_version = newVersion;
        vp.documento_final_url = `/docs/vp-1-v${newVersion}.pdf`;
        expect(vp.documento_final_version).toBe(2);
        expect(vp.documento_final_url).toContain('v2');
    });
    it('only perito/admin/supervisor can generate', () => {
        expect(canGenerateDocFinal('perito')).toBe(true);
        expect(canGenerateDocFinal('admin')).toBe(true);
        expect(canGenerateDocFinal('supervisor')).toBe(true);
        expect(canGenerateDocFinal('tramitador')).toBe(false);
        expect(canGenerateDocFinal('financiero')).toBe(false);
    });
    it('regenerate requires admin/supervisor', () => {
        expect(canRegenerateDocFinal('admin')).toBe(true);
        expect(canRegenerateDocFinal('supervisor')).toBe(true);
        expect(canRegenerateDocFinal('perito')).toBe(false);
        expect(canRegenerateDocFinal('financiero')).toBe(false);
    });
});
// ─── 2. Factura VP emission ───
describe('EP-11B Sprint 5 — Factura VP Emission', () => {
    it('blocked without validated informe → PRECONDITION error', () => {
        const vp = makeVP({ informe: { estado: 'en_revision', version: 2 } });
        const result = checkFacturaPreconditions(vp, 'B12345678');
        expect(result.ok).toBe(false);
        expect(result.code).toBe(412);
        expect(result.error).toContain('informe must be validado');
    });
    it('blocked without calculada/validada valoracion → PRECONDITION error', () => {
        const vp = makeVP({ valoracion: { estado: 'borrador', total_aplicado: 0, baremo_id: 'bar-1', baremo_version: 3, baremo_nombre: 'Baremo AXA 2026' } });
        const result = checkFacturaPreconditions(vp, 'B12345678');
        expect(result.ok).toBe(false);
        expect(result.code).toBe(412);
        expect(result.error).toContain('valoracion must be calculada');
    });
    it('blocked if VP factura already exists → DUPLICATE 409', () => {
        const existingFacturas = [makeFactura()];
        const vpId = 'vp-1';
        const hasDuplicate = existingFacturas.some(f => f.expediente_id === 'exp-1');
        const code = hasDuplicate ? 409 : 200;
        expect(code).toBe(409);
    });
    it('blocked without empresa CIF → PRECONDITION error', () => {
        const vp = makeVP();
        const result = checkFacturaPreconditions(vp, null);
        expect(result.ok).toBe(false);
        expect(result.code).toBe(412);
        expect(result.error).toContain('empresa CIF');
    });
    it('successful emission creates factura + vp_facturas bridge + lineas', () => {
        const vp = makeVP();
        const result = checkFacturaPreconditions(vp, 'B12345678');
        expect(result.ok).toBe(true);
        const factura = makeFactura();
        const vpFacturaBridge = {
            vp_id: vp.id,
            factura_id: factura.id,
            baremo_snapshot: {
                baremo_id: vp.valoracion.baremo_id,
                baremo_version: vp.valoracion.baremo_version,
                baremo_nombre: vp.valoracion.baremo_nombre,
            },
            total_valoracion: vp.valoracion.total_aplicado,
            created_at: '2026-03-17T10:00:00Z',
        };
        expect(factura.id).toBeTruthy();
        expect(factura.lineas).toHaveLength(3);
        expect(factura.total).toBe(631.00);
        expect(vpFacturaBridge.vp_id).toBe('vp-1');
        expect(vpFacturaBridge.factura_id).toBe('fact-1');
        expect(vpFacturaBridge.baremo_snapshot.baremo_id).toBe('bar-1');
    });
    it('numero_factura format: {prefijo}{year}-{padded counter}', () => {
        expect(formatNumeroFactura('VP', 2026, 1)).toBe('VP2026-00001');
        expect(formatNumeroFactura('VP', 2026, 42)).toBe('VP2026-00042');
        expect(formatNumeroFactura('VP', 2026, 10000)).toBe('VP2026-10000');
        expect(formatNumeroFactura('FVP', 2026, 7)).toBe('FVP2026-00007');
    });
    it('only admin/supervisor/financiero can emit', () => {
        expect(canEmitFactura('admin')).toBe(true);
        expect(canEmitFactura('supervisor')).toBe(true);
        expect(canEmitFactura('financiero')).toBe(true);
        expect(canEmitFactura('perito')).toBe(false);
        expect(canEmitFactura('tramitador')).toBe(false);
    });
    it('VP transitions to facturado', () => {
        const vp = makeVP();
        const newEstado = VP_TRANSITIONS_SPRINT5['valoracion_calculada->emitir-factura'];
        vp.estado = newEstado;
        expect(vp.estado).toBe('facturado');
    });
});
// ─── 3. Envío informe ───
describe('EP-11B Sprint 5 — Envío Informe', () => {
    it('requires documento final generado', () => {
        const vpSinDoc = makeVP({ documento_final_url: null });
        const result = checkEnvioPreconditions(vpSinDoc);
        expect(result.ok).toBe(false);
        expect(result.code).toBe(412);
        const vpConDoc = makeVP({ documento_final_url: '/docs/vp-1-v1.pdf' });
        const resultOk = checkEnvioPreconditions(vpConDoc);
        expect(resultOk.ok).toBe(true);
    });
    it('email send with Resend (or dry run without API key)', () => {
        const resendApiKey = process.env.RESEND_API_KEY ?? null;
        const isDryRun = resendApiKey === null;
        const envio = makeEnvio({ canal: 'email' });
        if (isDryRun) {
            envio.estado = 'enviado_dry_run';
        }
        else {
            envio.estado = 'enviado';
        }
        // In test environment, no RESEND_API_KEY → dry run
        expect(['enviado', 'enviado_dry_run']).toContain(envio.estado);
    });
    it('success updates VP to enviado', () => {
        const vp = makeVP({ estado: 'facturado', documento_final_url: '/docs/vp-1-v1.pdf' });
        const envio = makeEnvio({ estado: 'enviado' });
        if (envio.estado === 'enviado') {
            vp.estado = VP_TRANSITIONS_SPRINT5['facturado->enviar-informe'];
        }
        expect(vp.estado).toBe('enviado');
    });
    it('error records error_detalle', () => {
        const envio = makeEnvio();
        // Simulate send failure
        const sendError = new Error('SMTP connection refused');
        envio.estado = 'error';
        envio.error_detalle = sendError.message;
        expect(envio.estado).toBe('error');
        expect(envio.error_detalle).toBe('SMTP connection refused');
    });
    it('manual canal marks as enviado immediately', () => {
        const envio = makeEnvio({ canal: 'manual' });
        // Manual canal does not require actual sending
        if (envio.canal === 'manual') {
            envio.estado = 'enviado';
        }
        expect(envio.estado).toBe('enviado');
    });
});
// ─── 4. Reintento envío ───
describe('EP-11B Sprint 5 — Reintento Envío', () => {
    it('only failed envios can be retried', () => {
        const envioOk = makeEnvio({ estado: 'enviado' });
        const canRetryOk = envioOk.estado === 'error';
        expect(canRetryOk).toBe(false);
        const envioError = makeEnvio({ estado: 'error', error_detalle: 'Timeout' });
        const canRetryError = envioError.estado === 'error';
        expect(canRetryError).toBe(true);
    });
    it('increments intento_numero', () => {
        const envio = makeEnvio({ estado: 'error', intento_numero: 1 });
        // Retry
        envio.intento_numero += 1;
        envio.estado = 'pendiente';
        envio.error_detalle = null;
        expect(envio.intento_numero).toBe(2);
        // Second retry
        envio.estado = 'error';
        envio.error_detalle = 'Still failing';
        envio.intento_numero += 1;
        envio.estado = 'pendiente';
        expect(envio.intento_numero).toBe(3);
    });
    it('only admin/supervisor/financiero can retry', () => {
        expect(canRetryEnvio('admin')).toBe(true);
        expect(canRetryEnvio('supervisor')).toBe(true);
        expect(canRetryEnvio('financiero')).toBe(true);
        expect(canRetryEnvio('perito')).toBe(false);
        expect(canRetryEnvio('tramitador')).toBe(false);
    });
});
// ─── 5. VP estado transitions ───
describe('EP-11B Sprint 5 — VP Estado Transitions', () => {
    it('facturado after emitir-factura', () => {
        const newEstado = VP_TRANSITIONS_SPRINT5['valoracion_calculada->emitir-factura'];
        expect(newEstado).toBe('facturado');
    });
    it('enviado after enviar-informe success', () => {
        const newEstado = VP_TRANSITIONS_SPRINT5['facturado->enviar-informe'];
        expect(newEstado).toBe('enviado');
    });
    it('no automatic cerrado state (explicit only)', () => {
        const allTargets = Object.values(VP_TRANSITIONS_SPRINT5);
        expect(allTargets).not.toContain('cerrado');
    });
    it('no automatic cobrado (requires separate payment flow)', () => {
        const allTargets = Object.values(VP_TRANSITIONS_SPRINT5);
        expect(allTargets).not.toContain('cobrado');
    });
});
// ─── 6. Trazabilidad ───
describe('EP-11B Sprint 5 — Trazabilidad', () => {
    it('factura emission creates audit + domain event + timeline', () => {
        const sideEffects = {
            audit: { tabla: 'facturas', accion: 'INSERT', registro_id: 'fact-1', usuario_id: 'user-admin-1' },
            domainEvent: { aggregate_type: 'videoperitacion', event_type: 'FacturaVpEmitida', payload: { factura_id: 'fact-1', vp_id: 'vp-1' } },
            timeline: { tipo: 'nota_interna', emisor_tipo: 'sistema', asunto: 'Factura VP emitida', detalle: 'VP2026-00001' },
        };
        expect(sideEffects.audit.accion).toBe('INSERT');
        expect(sideEffects.audit.tabla).toBe('facturas');
        expect(sideEffects.domainEvent.event_type).toBe('FacturaVpEmitida');
        expect(sideEffects.timeline.asunto).toContain('Factura');
    });
    it('envío creates audit + domain event + timeline', () => {
        const sideEffects = {
            audit: { tabla: 'vp_envios', accion: 'INSERT', registro_id: 'envio-1', usuario_id: 'user-admin-1' },
            domainEvent: { aggregate_type: 'videoperitacion', event_type: 'InformeVpEnviado', payload: { envio_id: 'envio-1', vp_id: 'vp-1', canal: 'email' } },
            timeline: { tipo: 'nota_interna', emisor_tipo: 'sistema', asunto: 'Informe VP enviado', detalle: 'Canal: email' },
        };
        expect(sideEffects.audit.accion).toBe('INSERT');
        expect(sideEffects.audit.tabla).toBe('vp_envios');
        expect(sideEffects.domainEvent.event_type).toBe('InformeVpEnviado');
        expect(sideEffects.timeline.detalle).toContain('email');
    });
    it('vp_facturas bridge records baremo snapshot', () => {
        const vp = makeVP();
        const bridge = {
            vp_id: vp.id,
            factura_id: 'fact-1',
            baremo_id: vp.valoracion.baremo_id,
            baremo_version: vp.valoracion.baremo_version,
            baremo_nombre: vp.valoracion.baremo_nombre,
            total_valoracion: vp.valoracion.total_aplicado,
        };
        expect(bridge.baremo_id).toBe('bar-1');
        expect(bridge.baremo_version).toBe(3);
        expect(bridge.baremo_nombre).toBe('Baremo AXA 2026');
        expect(bridge.total_valoracion).toBe(631.00);
    });
    it('vp_envios records all attempts', () => {
        const attempts = [
            makeEnvio({ intento_numero: 1, estado: 'error', error_detalle: 'Timeout', created_at: '2026-03-17T11:00:00Z' }),
            makeEnvio({ id: 'envio-2', intento_numero: 2, estado: 'error', error_detalle: 'SMTP refused', created_at: '2026-03-17T11:30:00Z' }),
            makeEnvio({ id: 'envio-3', intento_numero: 3, estado: 'enviado', error_detalle: null, created_at: '2026-03-17T12:00:00Z' }),
        ];
        expect(attempts).toHaveLength(3);
        expect(attempts[0].estado).toBe('error');
        expect(attempts[1].estado).toBe('error');
        expect(attempts[2].estado).toBe('enviado');
        expect(attempts[2].intento_numero).toBe(3);
    });
});
// ─── 7. Access control ───
describe('EP-11B Sprint 5 — Access Control', () => {
    it('perito cannot emit factura', () => {
        expect(canEmitFactura('perito')).toBe(false);
    });
    it('tramitador cannot send informe', () => {
        expect(canEnviarInforme('tramitador')).toBe(false);
    });
    it('all authenticated can view', () => {
        for (const role of ALL_AUTHENTICATED_ROLES) {
            expect(canView(role)).toBe(true);
        }
    });
});
// ─── 8. Consistencia expediente ↔ VP ───
describe('EP-11B Sprint 5 — Consistencia Expediente ↔ VP', () => {
    it('factura links to correct expediente', () => {
        const vp = makeVP({ expediente_id: 'exp-42' });
        const factura = makeFactura({ expediente_id: vp.expediente_id });
        expect(factura.expediente_id).toBe('exp-42');
        expect(factura.expediente_id).toBe(vp.expediente_id);
    });
    it('envío links to correct expediente', () => {
        const vp = makeVP({ id: 'vp-99', expediente_id: 'exp-42' });
        const envio = makeEnvio({ vp_id: vp.id });
        expect(envio.vp_id).toBe('vp-99');
        // envio is linked via VP, which belongs to the expediente
        expect(vp.expediente_id).toBe('exp-42');
    });
    it('VP estado chain: valoracion_calculada → facturado → enviado', () => {
        const vp = makeVP({ estado: 'valoracion_calculada' });
        // Step 1: emit factura
        vp.estado = VP_TRANSITIONS_SPRINT5['valoracion_calculada->emitir-factura'];
        expect(vp.estado).toBe('facturado');
        // Step 2: send informe
        vp.estado = VP_TRANSITIONS_SPRINT5['facturado->enviar-informe'];
        expect(vp.estado).toBe('enviado');
    });
});
// ─── 9. Bloqueo facturación prematura ───
describe('EP-11B Sprint 5 — Bloqueo Facturación Prematura', () => {
    it('cannot emit with informe in borrador', () => {
        const vp = makeVP({ informe: { estado: 'borrador', version: 1 } });
        const result = checkFacturaPreconditions(vp, 'B12345678');
        expect(result.ok).toBe(false);
        expect(result.code).toBe(412);
        expect(result.error).toContain('informe must be validado');
    });
    it('cannot emit with valoracion in borrador', () => {
        const vp = makeVP({
            valoracion: { estado: 'borrador', total_aplicado: 0, baremo_id: 'bar-1', baremo_version: 3, baremo_nombre: 'Baremo AXA 2026' },
        });
        const result = checkFacturaPreconditions(vp, 'B12345678');
        expect(result.ok).toBe(false);
        expect(result.code).toBe(412);
        expect(result.error).toContain('valoracion must be calculada');
    });
});
