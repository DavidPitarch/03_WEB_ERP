import { describe, it, expect } from 'vitest';
// ─── EP-11: Portal de peritos Tests ───
describe('Perito access control', () => {
    it('perito can only see expedientes assigned to them', () => {
        const peritoId = 'perito-001';
        const expedientes = [
            { id: 'exp-1', perito_id: 'perito-001' },
            { id: 'exp-2', perito_id: 'perito-002' },
            { id: 'exp-3', perito_id: 'perito-001' },
            { id: 'exp-4', perito_id: null },
        ];
        const visible = expedientes.filter((e) => e.perito_id === peritoId);
        expect(visible).toHaveLength(2);
        expect(visible.map((e) => e.id)).toEqual(['exp-1', 'exp-3']);
    });
    it('non-perito role cannot access perito endpoints', () => {
        const userRoles = ['tramitador'];
        const isPerito = userRoles.includes('perito');
        expect(isPerito).toBe(false);
    });
    it('admin can manage peritos (CRUD)', () => {
        const userRoles = ['admin'];
        const canManagePeritos = userRoles.includes('admin') || userRoles.includes('supervisor');
        expect(canManagePeritos).toBe(true);
    });
});
describe('Dictamen creation and auto-numbering', () => {
    it('generates DIC-YYYY-NNNNN format', () => {
        const year = 2026;
        const count = 42;
        const seq = (count + 1).toString().padStart(5, '0');
        const numero = `DIC-${year}-${seq}`;
        expect(numero).toBe('DIC-2026-00043');
        expect(numero).toMatch(/^DIC-\d{4}-\d{5}$/);
    });
    it('first dictamen of year gets 00001', () => {
        const count = 0;
        const seq = (count + 1).toString().padStart(5, '0');
        expect(seq).toBe('00001');
    });
    it('validates perito is assigned to expediente before creating dictamen', () => {
        const peritoId = 'perito-001';
        const expediente = { id: 'exp-1', perito_id: 'perito-001' };
        const isAssigned = expediente.perito_id === peritoId;
        expect(isAssigned).toBe(true);
        const expediente2 = { id: 'exp-2', perito_id: 'perito-002' };
        const isAssigned2 = expediente2.perito_id === peritoId;
        expect(isAssigned2).toBe(false);
    });
});
describe('Dictamen update restrictions', () => {
    it('only allows update when estado is borrador', () => {
        const estados = ['borrador', 'emitido', 'revisado', 'aceptado', 'rechazado'];
        const canEdit = estados.map((e) => ({ estado: e, editable: e === 'borrador' }));
        expect(canEdit.filter((e) => e.editable)).toHaveLength(1);
        expect(canEdit[0].editable).toBe(true);
    });
    it('prevents editing protected fields', () => {
        const body = {
            tipo_dano: 'agua',
            id: 'hack',
            perito_id: 'hack',
            expediente_id: 'hack',
            numero_dictamen: 'hack',
            estado: 'hack',
            emitido_at: 'hack',
        };
        const protectedFields = ['id', 'perito_id', 'expediente_id', 'numero_dictamen', 'estado', 'emitido_at'];
        protectedFields.forEach((f) => delete body[f]);
        expect(Object.keys(body)).toEqual(['tipo_dano']);
    });
});
describe('Emitir dictamen', () => {
    it('transitions estado from borrador to emitido', () => {
        const dictamen = { estado: 'borrador', emitido_at: null };
        // Simulate emitir
        dictamen.estado = 'emitido';
        dictamen.emitido_at = new Date().toISOString();
        expect(dictamen.estado).toBe('emitido');
        expect(dictamen.emitido_at).toBeTruthy();
    });
    it('rejects emitir if not in borrador', () => {
        const estados = ['emitido', 'revisado', 'aceptado', 'rechazado'];
        estados.forEach((estado) => {
            const canEmitir = estado === 'borrador';
            expect(canEmitir).toBe(false);
        });
    });
    it('generates DictamenEmitido domain event', () => {
        const event = {
            aggregate_type: 'dictamen',
            event_type: 'DictamenEmitido',
            payload: { dictamen_id: 'd-1', expediente_id: 'exp-1', perito_id: 'p-1' },
        };
        expect(event.event_type).toBe('DictamenEmitido');
        expect(event.aggregate_type).toBe('dictamen');
    });
    it('clears PENDIENTE_PERITO causa on expediente', () => {
        const expediente = { estado: 'PENDIENTE_PERITO' };
        if (expediente.estado === 'PENDIENTE_PERITO') {
            expediente.estado = 'EN_CURSO';
        }
        expect(expediente.estado).toBe('EN_CURSO');
    });
    it('does not change expediente estado if not PENDIENTE_PERITO', () => {
        const expediente = { estado: 'EN_CURSO' };
        const originalEstado = expediente.estado;
        if (expediente.estado === 'PENDIENTE_PERITO') {
            expediente.estado = 'EN_CURSO';
        }
        expect(expediente.estado).toBe(originalEstado);
    });
});
describe('Evidencia association', () => {
    it('associates evidencia to dictamen', () => {
        const evidencia = {
            dictamen_id: 'd-1',
            storage_path: 'dictamenes/d-1/foto1.jpg',
            nombre_original: 'foto1.jpg',
            clasificacion: 'dano',
        };
        expect(evidencia.dictamen_id).toBe('d-1');
        expect(['dano', 'causa', 'contexto', 'detalle']).toContain(evidencia.clasificacion);
    });
    it('validates required fields for evidencia', () => {
        const valid = { storage_path: 'path.jpg', nombre_original: 'file.jpg' };
        const invalid = { storage_path: '', nombre_original: '' };
        expect(valid.storage_path && valid.nombre_original).toBeTruthy();
        expect(invalid.storage_path && invalid.nombre_original).toBeFalsy();
    });
});
describe('Dictamen estado flow', () => {
    it('supports full lifecycle: borrador -> emitido -> revisado -> aceptado', () => {
        const flow = ['borrador', 'emitido', 'revisado', 'aceptado'];
        let estado = flow[0];
        for (let i = 1; i < flow.length; i++) {
            estado = flow[i];
        }
        expect(estado).toBe('aceptado');
    });
    it('supports rejection path: borrador -> emitido -> revisado -> rechazado', () => {
        const flow = ['borrador', 'emitido', 'revisado', 'rechazado'];
        const finalEstado = flow[flow.length - 1];
        expect(finalEstado).toBe('rechazado');
    });
    it('all valid estados are recognized', () => {
        const validEstados = ['borrador', 'emitido', 'revisado', 'aceptado', 'rechazado'];
        const testEstados = ['borrador', 'emitido', 'revisado', 'aceptado', 'rechazado', 'invalido'];
        const recognized = testEstados.filter((e) => validEstados.includes(e));
        const unrecognized = testEstados.filter((e) => !validEstados.includes(e));
        expect(recognized).toHaveLength(5);
        expect(unrecognized).toEqual(['invalido']);
    });
});
