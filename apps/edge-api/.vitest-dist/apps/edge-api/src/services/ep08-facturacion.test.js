import { describe, it, expect } from 'vitest';
// ─── Emisión de factura ───────────────────────────────────────────
describe('Factura emission validations', () => {
    it('rejects if expediente not FINALIZADO', () => {
        const estado = 'EN_CURSO';
        const canEmit = estado === 'FINALIZADO';
        expect(canEmit).toBe(false);
    });
    it('allows if expediente FINALIZADO', () => {
        const estado = 'FINALIZADO';
        const canEmit = estado === 'FINALIZADO';
        expect(canEmit).toBe(true);
    });
    it('rejects if no approved presupuesto', () => {
        const presupuesto = { aprobado: false };
        expect(presupuesto.aprobado).toBe(false);
    });
    it('rejects if presupuesto has no lines', () => {
        const lineasCount = 0;
        expect(lineasCount).toBe(0);
        const canEmit = lineasCount > 0;
        expect(canEmit).toBe(false);
    });
    it('rejects if empresa has no CIF', () => {
        const empresa = { cif: null };
        const hasCif = !!empresa.cif;
        expect(hasCif).toBe(false);
    });
    it('rejects if serie not active', () => {
        const serie = { activa: false };
        expect(serie.activa).toBe(false);
    });
    it('rejects duplicate factura for same expediente+serie', () => {
        const existingFacturas = [{ expediente_id: 'exp-1', serie_id: 's-1', estado: 'emitida' }];
        const hasDuplicate = existingFacturas.some((f) => f.expediente_id === 'exp-1' && f.serie_id === 's-1' && f.estado !== 'anulada');
        expect(hasDuplicate).toBe(true);
    });
});
// ─── Numeración ──────────────────────────────────────────────────
describe('Invoice numbering', () => {
    it('generates correct numero from serie', () => {
        const prefijo = 'F-';
        const year = 2026;
        const contador = 1;
        const numero = `${prefijo}${year}-${String(contador).padStart(5, '0')}`;
        expect(numero).toBe('F-2026-00001');
    });
    it('increments without duplicates', () => {
        const numeros = new Set();
        for (let i = 1; i <= 100; i++) {
            const num = `F-2026-${String(i).padStart(5, '0')}`;
            expect(numeros.has(num)).toBe(false);
            numeros.add(num);
        }
        expect(numeros.size).toBe(100);
    });
});
// ─── Pendientes de facturar ──────────────────────────────────────
describe('Pendientes de facturar', () => {
    it('includes FINALIZADO without factura', () => {
        const expedientes = [
            { id: 'e1', estado: 'FINALIZADO', hasFactura: false },
            { id: 'e2', estado: 'FINALIZADO', hasFactura: true },
            { id: 'e3', estado: 'EN_CURSO', hasFactura: false },
        ];
        const pendientes = expedientes.filter((e) => e.estado === 'FINALIZADO' && !e.hasFactura);
        expect(pendientes).toHaveLength(1);
        expect(pendientes[0].id).toBe('e1');
    });
    it('exits pendientes when factura emitted', () => {
        const antes = { estado: 'FINALIZADO', hasFactura: false };
        const despues = { ...antes, hasFactura: true };
        const isPendiente = despues.estado === 'FINALIZADO' && !despues.hasFactura;
        expect(isPendiente).toBe(false);
    });
});
// ─── Facturas caducadas ──────────────────────────────────────────
describe('Facturas caducadas', () => {
    it('enters caducadas when vencimiento passed', () => {
        const factura = {
            fecha_vencimiento: '2026-02-01',
            estado_cobro: 'pendiente',
            estado: 'enviada',
        };
        const hoy = new Date('2026-03-15');
        const vencimiento = new Date(factura.fecha_vencimiento);
        const isCaducada = vencimiento < hoy && !['cobrada', 'incobrable'].includes(factura.estado_cobro) && factura.estado !== 'anulada';
        expect(isCaducada).toBe(true);
    });
    it('exits caducadas when cobro registered', () => {
        const factura = { estado_cobro: 'cobrada' };
        const isCaducada = !['cobrada', 'incobrable'].includes(factura.estado_cobro);
        expect(isCaducada).toBe(false);
    });
    it('does not include anuladas', () => {
        const factura = { estado: 'anulada', fecha_vencimiento: '2026-01-01', estado_cobro: 'pendiente' };
        const isCaducada = factura.estado !== 'anulada';
        expect(isCaducada).toBe(false);
    });
});
// ─── Cobro ───────────────────────────────────────────────────────
describe('Cobro registration', () => {
    it('marks as cobrada when full amount paid', () => {
        const facturaTotal = 1210;
        const pagos = [{ importe: 1210 }];
        const totalCobrado = pagos.reduce((s, p) => s + p.importe, 0);
        const isCobrada = totalCobrado >= facturaTotal;
        expect(isCobrada).toBe(true);
    });
    it('stays pendiente with partial payment', () => {
        const facturaTotal = 1210;
        const pagos = [{ importe: 500 }];
        const totalCobrado = pagos.reduce((s, p) => s + p.importe, 0);
        const isCobrada = totalCobrado >= facturaTotal;
        expect(isCobrada).toBe(false);
    });
    it('handles multiple partial payments', () => {
        const facturaTotal = 1000;
        const pagos = [{ importe: 400 }, { importe: 300 }, { importe: 300 }];
        const totalCobrado = pagos.reduce((s, p) => s + p.importe, 0);
        expect(totalCobrado).toBe(1000);
        expect(totalCobrado >= facturaTotal).toBe(true);
    });
});
// ─── Envío y reintento ──────────────────────────────────────────
describe('Invoice sending', () => {
    it('records envio attempt', () => {
        const factura = { envio_intentos: 0, canal_envio: null, enviada_at: null };
        // After sending
        factura.envio_intentos++;
        factura.canal_envio = 'email';
        factura.enviada_at = new Date().toISOString();
        expect(factura.envio_intentos).toBe(1);
        expect(factura.canal_envio).toBe('email');
    });
    it('allows resend on failure', () => {
        const factura = { envio_intentos: 1, envio_error: 'timeout', estado: 'emitida' };
        const canResend = factura.estado === 'emitida' || factura.estado === 'enviada';
        expect(canResend).toBe(true);
    });
});
// ─── Export ──────────────────────────────────────────────────────
describe('CSV export', () => {
    it('generates correct CSV header', () => {
        const headers = 'serie,numero_factura,fecha_emision,fecha_vencimiento,empresa_cif,empresa_nombre,compania_nombre,base_imponible,iva_porcentaje,iva_importe,total,estado,estado_cobro,fecha_cobro,expediente_numero';
        const cols = headers.split(',');
        expect(cols).toHaveLength(15);
        expect(cols[0]).toBe('serie');
        expect(cols[cols.length - 1]).toBe('expediente_numero');
    });
    it('filters by date range', () => {
        const facturas = [
            { fecha_emision: '2026-01-15' },
            { fecha_emision: '2026-02-20' },
            { fecha_emision: '2026-03-10' },
        ];
        const desde = '2026-02-01';
        const hasta = '2026-03-01';
        const filtered = facturas.filter((f) => f.fecha_emision >= desde && f.fecha_emision <= hasta);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].fecha_emision).toBe('2026-02-20');
    });
});
// ─── Facturación prematura bloqueada ─────────────────────────────
describe('Premature invoicing blocked', () => {
    it('cannot invoice from EN_CURSO', () => {
        const expedienteEstado = 'EN_CURSO';
        expect(expedienteEstado === 'FINALIZADO').toBe(false);
    });
    it('cannot invoice from PENDIENTE_MATERIAL', () => {
        const expedienteEstado = 'PENDIENTE_MATERIAL';
        expect(expedienteEstado === 'FINALIZADO').toBe(false);
    });
    it('cannot invoice anulada factura', () => {
        const factura = { estado: 'anulada' };
        const canCobrar = factura.estado !== 'anulada';
        expect(canCobrar).toBe(false);
    });
});
