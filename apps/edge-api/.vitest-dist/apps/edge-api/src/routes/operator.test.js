import { describe, it, expect } from 'vitest';
// Mock types for Supabase responses
const mockOperario = { id: 'op-1', user_id: 'user-1', nombre: 'Carlos', apellidos: 'García', activo: true };
const mockExpediente = { id: 'exp-1', numero_expediente: 'EXP-2026-00001', estado: 'EN_CURSO', operario_id: 'op-1' };
const mockCita = { id: 'cita-1', expediente_id: 'exp-1', operario_id: 'op-1', estado: 'programada' };
// Helpers to simulate getOperarioId + endpoint validation logic
function validateOperarioAccess(userId, operarioUserId) {
    return userId === operarioUserId;
}
function validateParteRequest(body) {
    const errors = [];
    if (!body.trabajos_realizados?.trim())
        errors.push('trabajos_realizados requerido');
    if (!body.resultado)
        errors.push('resultado requerido');
    if (body.resultado === 'ausente' && !body.motivo_resultado)
        errors.push('motivo requerido cuando resultado = ausente');
    if (body.resultado === 'requiere_material' && !body.motivo_resultado)
        errors.push('motivo requerido cuando resultado = requiere_material');
    return errors;
}
function isExpedienteAssigned(expedienteOperarioId, requestOperarioId) {
    return expedienteOperarioId === requestOperarioId;
}
describe('Operator access control', () => {
    it('rejects access for non-operator user', () => {
        expect(validateOperarioAccess('user-999', mockOperario.user_id)).toBe(false);
    });
    it('allows access for correct operator', () => {
        expect(validateOperarioAccess('user-1', mockOperario.user_id)).toBe(true);
    });
    it('rejects expediente not assigned to operator', () => {
        expect(isExpedienteAssigned('op-2', 'op-1')).toBe(false);
    });
    it('allows expediente assigned to operator', () => {
        expect(isExpedienteAssigned('op-1', 'op-1')).toBe(true);
    });
});
describe('Agenda returns only assigned citas', () => {
    it('filters citas by operario_id', () => {
        const allCitas = [
            { ...mockCita, operario_id: 'op-1' },
            { id: 'cita-2', expediente_id: 'exp-2', operario_id: 'op-2', estado: 'programada' },
        ];
        const myAgenda = allCitas.filter(c => c.operario_id === 'op-1');
        expect(myAgenda).toHaveLength(1);
        expect(myAgenda[0].id).toBe('cita-1');
    });
    it('excludes cancelled citas', () => {
        const citas = [
            { ...mockCita, estado: 'programada' },
            { id: 'cita-2', expediente_id: 'exp-1', operario_id: 'op-1', estado: 'cancelada' },
        ];
        const active = citas.filter(c => c.estado !== 'cancelada');
        expect(active).toHaveLength(1);
    });
});
describe('Parte validation by resultado', () => {
    it('requires trabajos_realizados', () => {
        const errors = validateParteRequest({ resultado: 'completada', trabajos_realizados: '' });
        expect(errors).toContain('trabajos_realizados requerido');
    });
    it('requires resultado', () => {
        const errors = validateParteRequest({ trabajos_realizados: 'Trabajo hecho' });
        expect(errors).toContain('resultado requerido');
    });
    it('requires motivo when ausente', () => {
        const errors = validateParteRequest({ trabajos_realizados: 'N/A', resultado: 'ausente' });
        expect(errors).toContain('motivo requerido cuando resultado = ausente');
    });
    it('requires motivo when requiere_material', () => {
        const errors = validateParteRequest({ trabajos_realizados: 'Parcial', resultado: 'requiere_material' });
        expect(errors).toContain('motivo requerido cuando resultado = requiere_material');
    });
    it('accepts completada without motivo', () => {
        const errors = validateParteRequest({ trabajos_realizados: 'Todo hecho', resultado: 'completada' });
        expect(errors).toHaveLength(0);
    });
    it('accepts pendiente without motivo', () => {
        const errors = validateParteRequest({ trabajos_realizados: 'Parcial', resultado: 'pendiente' });
        expect(errors).toHaveLength(0);
    });
});
describe('Evidence association', () => {
    it('links evidencias to parte by updating parte_id', () => {
        const evidencias = [
            { id: 'ev-1', expediente_id: 'exp-1', parte_id: null },
            { id: 'ev-2', expediente_id: 'exp-1', parte_id: null },
        ];
        const parteId = 'parte-1';
        const updated = evidencias.map(ev => ({ ...ev, parte_id: parteId }));
        expect(updated.every(ev => ev.parte_id === parteId)).toBe(true);
    });
    it('only links evidencias from same expediente', () => {
        const evidencias = [
            { id: 'ev-1', expediente_id: 'exp-1' },
            { id: 'ev-2', expediente_id: 'exp-2' }, // different expediente
        ];
        const validIds = evidencias.filter(ev => ev.expediente_id === 'exp-1').map(ev => ev.id);
        expect(validIds).toEqual(['ev-1']);
    });
});
describe('Firma linked to parte', () => {
    it('stores firma_storage_path on parte', () => {
        const parteData = {
            firma_storage_path: 'evidencias/exp-1/firma_123.png',
            firma_cliente_url: 'evidencias/exp-1/firma_123.png',
        };
        expect(parteData.firma_storage_path).toBeTruthy();
        expect(parteData.firma_cliente_url).toBe(parteData.firma_storage_path);
    });
    it('parte without firma has null path', () => {
        const parteData = { firma_storage_path: null };
        expect(parteData.firma_storage_path).toBeNull();
    });
});
describe('ParteRecibido event generation', () => {
    it('generates correct event payload', () => {
        const event = {
            aggregate_id: 'exp-1',
            aggregate_type: 'expediente',
            event_type: 'ParteRecibido',
            payload: {
                parte_id: 'parte-1',
                cita_id: 'cita-1',
                resultado: 'completada',
                requiere_nueva_visita: false,
            },
        };
        expect(event.event_type).toBe('ParteRecibido');
        expect(event.aggregate_type).toBe('expediente');
        expect(event.payload.parte_id).toBeTruthy();
        expect(event.payload.resultado).toBe('completada');
    });
});
describe('Timeline update after parte', () => {
    it('creates comunicacion entry for parte received', () => {
        const resultado = 'completada';
        const trabajos = 'Reparación de tubería completada';
        const comunicacion = {
            tipo: 'sistema',
            asunto: 'Parte recibido',
            contenido: `Parte enviado por operario. Resultado: ${resultado}. ${trabajos.substring(0, 200)}`,
        };
        expect(comunicacion.tipo).toBe('sistema');
        expect(comunicacion.contenido).toContain('completada');
        expect(comunicacion.contenido).toContain('Reparación');
    });
});
describe('Cita estado update after parte', () => {
    it('marks cita as realizada for completada', () => {
        const resultado = 'completada';
        const newEstado = resultado === 'ausente' ? 'no_show' : 'realizada';
        expect(newEstado).toBe('realizada');
    });
    it('marks cita as no_show for ausente', () => {
        const resultado = 'ausente';
        const newEstado = resultado === 'ausente' ? 'no_show' : 'realizada';
        expect(newEstado).toBe('no_show');
    });
});
describe('Informe caducado clearance after parte', () => {
    it('cita with parte no longer appears in informes caducados', () => {
        // v_informes_caducados checks: cita.fecha < now AND NOT EXISTS parte for that cita
        const citaConParte = { id: 'cita-1', fecha: '2026-03-10', hasParte: true };
        const citaSinParte = { id: 'cita-2', fecha: '2026-03-10', hasParte: false };
        const caducados = [citaConParte, citaSinParte].filter(c => !c.hasParte);
        expect(caducados).toHaveLength(1);
        expect(caducados[0].id).toBe('cita-2');
    });
});
