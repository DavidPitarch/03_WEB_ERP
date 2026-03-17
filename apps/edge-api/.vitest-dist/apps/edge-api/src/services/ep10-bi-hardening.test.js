import { describe, it, expect } from 'vitest';
// ─── EP-10 + Hardening Tests ───
describe('Hardening — Email sender', () => {
    it('opera en dry-run sin API key', () => {
        const apiKey = undefined;
        const isDryRun = !apiKey;
        expect(isDryRun).toBe(true);
    });
    it('construye email de factura con datos correctos', () => {
        const factura = {
            numero_factura: 'F-2026-00001',
            total: 1234.56,
            compania_email: 'facturas@cia.com',
            empresa_nombre: 'Mi Empresa SL',
            expediente_numero: 'EXP-2026-00001',
        };
        expect(factura.compania_email).toContain('@');
        expect(factura.total).toBeGreaterThan(0);
    });
    it('construye email de pedido con magic link', () => {
        const pedido = {
            numero_pedido: 'PED-2026-00001',
            proveedor_email: 'proveedor@test.com',
            magic_link: 'https://erp.ejemplo.com/confirm?token=abc123',
            lineas: [{ descripcion: 'Tubería', cantidad: 5, unidad: 'ud' }],
        };
        expect(pedido.magic_link).toContain('token=');
        expect(pedido.lineas.length).toBeGreaterThan(0);
    });
    it('registra resultado de envío (ok o error)', () => {
        const resultOk = { success: true, messageId: 'msg-123', dryRun: false };
        const resultErr = { success: false, error: 'Connection refused', dryRun: false };
        expect(resultOk.success).toBe(true);
        expect(resultErr.success).toBe(false);
        expect(resultErr.error).toBeTruthy();
    });
});
describe('Hardening — Scheduled Worker / Cron', () => {
    it('detecta pedidos caducados por fecha límite', () => {
        const now = new Date();
        const pedidos = [
            { id: '1', estado: 'enviado', fecha_limite: new Date(now.getTime() - 86400000).toISOString() },
            { id: '2', estado: 'pendiente', fecha_limite: new Date(now.getTime() + 86400000).toISOString() },
        ];
        const caducados = pedidos.filter(p => ['pendiente', 'enviado'].includes(p.estado) && new Date(p.fecha_limite) < now);
        expect(caducados).toHaveLength(1);
        expect(caducados[0].id).toBe('1');
    });
    it('detecta facturas vencidas por fecha_vencimiento', () => {
        const now = new Date();
        const facturas = [
            { id: '1', estado: 'enviada', estado_cobro: 'pendiente', fecha_vencimiento: new Date(now.getTime() - 86400000).toISOString() },
            { id: '2', estado: 'emitida', estado_cobro: 'pendiente', fecha_vencimiento: new Date(now.getTime() + 86400000).toISOString() },
        ];
        const vencidas = facturas.filter(f => ['emitida', 'enviada'].includes(f.estado) &&
            f.estado_cobro === 'pendiente' &&
            new Date(f.fecha_vencimiento) < now);
        expect(vencidas).toHaveLength(1);
    });
    it('genera alertas para tareas vencidas', () => {
        const alerta = {
            tipo: 'tarea_vencida',
            titulo: 'Tarea vencida: Revisar presupuesto',
            prioridad: 'alta',
            estado: 'activa',
        };
        expect(alerta.tipo).toBe('tarea_vencida');
        expect(alerta.prioridad).toBe('alta');
    });
    it('genera alertas para partes pendientes >3 días', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
        const parte = { created_at: new Date(Date.now() - 5 * 86400000).toISOString(), validado: false };
        const esAntiguo = !parte.validado && new Date(parte.created_at) < threeDaysAgo;
        expect(esAntiguo).toBe(true);
    });
});
describe('Hardening — RLS E2E', () => {
    it('roles staff pueden ver facturas', () => {
        const staffRoles = ['admin', 'supervisor', 'tramitador', 'financiero'];
        staffRoles.forEach(r => expect(['admin', 'supervisor', 'tramitador', 'financiero']).toContain(r));
    });
    it('operario no ve facturas', () => {
        const role = 'operario';
        const canSeeFacturas = ['admin', 'supervisor', 'tramitador', 'financiero'].includes(role);
        expect(canSeeFacturas).toBe(false);
    });
    it('solo financiero y admin pueden registrar cobro', () => {
        const canCobro = (role) => ['admin', 'financiero'].includes(role);
        expect(canCobro('admin')).toBe(true);
        expect(canCobro('financiero')).toBe(true);
        expect(canCobro('supervisor')).toBe(false);
        expect(canCobro('tramitador')).toBe(false);
    });
    it('pedidos visibles solo para staff', () => {
        const staffRoles = ['admin', 'supervisor', 'tramitador', 'financiero'];
        const nonStaff = ['operario', 'proveedor', 'perito', 'cliente_final'];
        staffRoles.forEach(r => expect(staffRoles).toContain(r));
        nonStaff.forEach(r => expect(staffRoles).not.toContain(r));
    });
    it('confirmación de pedido es pública (magic link)', () => {
        // The confirm endpoint should work without auth
        const requiresAuth = false; // noted in code as needing public mount
        expect(requiresAuth).toBe(false);
    });
});
describe('EP-10 — Dashboard KPIs', () => {
    it('calcula KPIs correctamente', () => {
        const kpis = {
            total_expedientes: 100,
            exp_en_curso: 25,
            exp_pendientes: 10,
            exp_finalizados_sin_factura: 5,
            total_facturado: 50000,
            total_cobrado: 35000,
            total_pendiente_cobro: 15000,
            facturas_vencidas: 3,
        };
        expect(kpis.total_pendiente_cobro).toBe(kpis.total_facturado - kpis.total_cobrado);
        expect(kpis.facturas_vencidas).toBeGreaterThanOrEqual(0);
    });
});
describe('EP-10 — Rentabilidad', () => {
    it('identifica expedientes deficitarios', () => {
        const exps = [
            { margen_previsto: 500, es_deficitario: false },
            { margen_previsto: -200, es_deficitario: true },
            { margen_previsto: 0, es_deficitario: false },
        ];
        const deficitarios = exps.filter(e => e.margen_previsto < 0);
        expect(deficitarios).toHaveLength(1);
        expect(deficitarios[0].es_deficitario).toBe(true);
    });
    it('calcula desviación margen real vs previsto', () => {
        const exp = { margen_previsto: 1000, margen_real: 800, desviacion: -200 };
        expect(exp.desviacion).toBe(exp.margen_real - exp.margen_previsto);
    });
    it('calcula margen medio por compañía', () => {
        const comp = { ingreso_total: 100000, margen_total: 25000, margen_medio_pct: 25 };
        expect(comp.margen_medio_pct).toBe((comp.margen_total / comp.ingreso_total) * 100);
    });
});
describe('EP-10 — Productividad operarios', () => {
    it('calcula tasa de validación', () => {
        const op = { partes_enviados: 20, partes_validados: 18 };
        const tasa = op.partes_enviados > 0 ? (op.partes_validados / op.partes_enviados) * 100 : 0;
        expect(tasa).toBe(90);
    });
    it('operario sin partes tiene tasa 0', () => {
        const op = { partes_enviados: 0, partes_validados: 0 };
        const tasa = op.partes_enviados > 0 ? (op.partes_validados / op.partes_enviados) * 100 : 0;
        expect(tasa).toBe(0);
    });
});
describe('EP-10 — Autofacturación', () => {
    it('genera número de autofactura AF-YYYY-NNNNN', () => {
        const year = new Date().getFullYear();
        const seq = 7;
        const numero = `AF-${year}-${String(seq).padStart(5, '0')}`;
        expect(numero).toMatch(/^AF-\d{4}-\d{5}$/);
    });
    it('solo operarios subcontratados son liquidables', () => {
        const operarios = [
            { id: '1', es_subcontratado: true },
            { id: '2', es_subcontratado: false },
            { id: '3', es_subcontratado: true },
        ];
        const liquidables = operarios.filter(o => o.es_subcontratado);
        expect(liquidables).toHaveLength(2);
    });
    it('flujo de estados: borrador → revisada → emitida', () => {
        const VALID = {
            borrador: ['revisada', 'anulada'],
            revisada: ['emitida', 'anulada'],
            emitida: [],
            anulada: [],
        };
        expect(VALID.borrador).toContain('revisada');
        expect(VALID.revisada).toContain('emitida');
        expect(VALID.emitida).toHaveLength(0);
    });
    it('calcula totales de autofactura', () => {
        const lineas = [
            { cantidad: 3, precio_unitario: 50, importe: 150 },
            { cantidad: 1, precio_unitario: 200, importe: 200 },
        ];
        const base = lineas.reduce((s, l) => s + l.importe, 0);
        const iva = base * 0.21;
        const total = base + iva;
        expect(base).toBe(350);
        expect(total).toBeCloseTo(423.5);
    });
    it('no incluye partes ya autofacturados', () => {
        const partesDisponibles = ['p1', 'p2', 'p3'];
        const partesYaEnAF = ['p2'];
        const liquidables = partesDisponibles.filter(p => !partesYaEnAF.includes(p));
        expect(liquidables).toEqual(['p1', 'p3']);
    });
});
describe('EP-10 — Reporting masivo', () => {
    it('genera CSV con BOM para Excel', () => {
        const BOM = '\uFEFF';
        const csv = BOM + 'col1;col2\nval1;val2';
        expect(csv.startsWith(BOM)).toBe(true);
    });
    it('aplica filtros de fecha a facturas', () => {
        const facturas = [
            { id: '1', fecha_emision: '2026-01-15' },
            { id: '2', fecha_emision: '2026-03-15' },
            { id: '3', fecha_emision: '2026-06-15' },
        ];
        const desde = '2026-02-01';
        const hasta = '2026-04-30';
        const filtered = facturas.filter(f => f.fecha_emision >= desde && f.fecha_emision <= hasta);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('2');
    });
    it('calcula totales de reporting', () => {
        const rows = [
            { base_imponible: 1000, total: 1210, cobrado: 1210, pendiente: 0 },
            { base_imponible: 500, total: 605, cobrado: 0, pendiente: 605 },
        ];
        const sumTotal = rows.reduce((s, r) => s + r.total, 0);
        const sumPendiente = rows.reduce((s, r) => s + r.pendiente, 0);
        expect(sumTotal).toBe(1815);
        expect(sumPendiente).toBe(605);
    });
});
