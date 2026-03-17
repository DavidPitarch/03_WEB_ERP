import { describe, it, expect } from 'vitest';
import { canTransition, getAllowedTransitions, validateTransitionPreconditions } from './expediente-states';
describe('Máquina de estados del expediente', () => {
    describe('canTransition', () => {
        it('permite NUEVO → NO_ASIGNADO', () => {
            expect(canTransition('NUEVO', 'NO_ASIGNADO')).toBe(true);
        });
        it('permite NUEVO → CANCELADO', () => {
            expect(canTransition('NUEVO', 'CANCELADO')).toBe(true);
        });
        it('no permite NUEVO → EN_CURSO (salto)', () => {
            expect(canTransition('NUEVO', 'EN_CURSO')).toBe(false);
        });
        it('no permite NUEVO → FACTURADO (salto)', () => {
            expect(canTransition('NUEVO', 'FACTURADO')).toBe(false);
        });
        it('permite EN_CURSO → FINALIZADO', () => {
            expect(canTransition('EN_CURSO', 'FINALIZADO')).toBe(true);
        });
        it('permite FINALIZADO → FACTURADO', () => {
            expect(canTransition('FINALIZADO', 'FACTURADO')).toBe(true);
        });
        it('no permite FACTURADO → CANCELADO (post-facturación)', () => {
            expect(canTransition('FACTURADO', 'CANCELADO')).toBe(false);
        });
        it('CERRADO es terminal', () => {
            expect(getAllowedTransitions('CERRADO')).toEqual([]);
        });
        it('CANCELADO es terminal', () => {
            expect(getAllowedTransitions('CANCELADO')).toEqual([]);
        });
    });
    describe('validateTransitionPreconditions', () => {
        it('rechaza FINALIZADO sin parte validado', () => {
            const result = validateTransitionPreconditions('EN_CURSO', 'FINALIZADO', { tiene_parte_validado: false });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('parte validado');
        });
        it('acepta FINALIZADO con parte validado', () => {
            const result = validateTransitionPreconditions('EN_CURSO', 'FINALIZADO', { tiene_parte_validado: true });
            expect(result.valid).toBe(true);
        });
        it('rechaza FACTURADO desde estado que no es FINALIZADO', () => {
            const result = validateTransitionPreconditions('EN_CURSO', 'FACTURADO', {});
            expect(result.valid).toBe(false);
        });
        it('rechaza transición no permitida', () => {
            const result = validateTransitionPreconditions('NUEVO', 'COBRADO', {});
            expect(result.valid).toBe(false);
        });
    });
    describe('getAllowedTransitions', () => {
        it('EN_CURSO tiene múltiples opciones', () => {
            const allowed = getAllowedTransitions('EN_CURSO');
            expect(allowed).toContain('FINALIZADO');
            expect(allowed).toContain('PENDIENTE');
            expect(allowed).toContain('PENDIENTE_MATERIAL');
            expect(allowed).toContain('CANCELADO');
        });
    });
});
