import { describe, expect, it, vi } from 'vitest';
import { createCitaCommand, createExpedienteCommand, mapRpcError, normalizeCommandError, RpcCommandError, transitionExpedienteCommand, } from './core-commands';
describe('core-commands error mapping', () => {
    it('maps business errors raised from SQL functions', () => {
        const error = mapRpcError({
            code: 'P0001',
            message: 'PRECONDITION_FAILED',
            details: 'No se puede finalizar sin parte validado',
        });
        expect(error).toBeInstanceOf(RpcCommandError);
        expect(error.code).toBe('PRECONDITION_FAILED');
        expect(error.status).toBe(422);
        expect(error.message).toBe('No se puede finalizar sin parte validado');
    });
    it('maps unique violations to conflict', () => {
        const error = mapRpcError({
            code: '23505',
            message: 'duplicate key value violates unique constraint "idx_expedientes_ref_externa"',
            details: 'Key (referencia_externa)=(ABC) already exists.',
        });
        expect(error.code).toBe('CONFLICT');
        expect(error.status).toBe(409);
    });
    it('normalizes unexpected errors as DB_ERROR', () => {
        const error = normalizeCommandError(new Error('boom'));
        expect(error.code).toBe('DB_ERROR');
        expect(error.status).toBe(500);
        expect(error.message).toBe('boom');
    });
});
describe('core-commands rpc contract', () => {
    it('calls erp_create_expediente rpc with payload and actor context', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: { id: 'exp-1' }, error: null });
        const supabase = { rpc };
        await createExpedienteCommand(supabase, {
            compania_id: 'cia-1',
            empresa_facturadora_id: 'emp-1',
            tipo_siniestro: 'agua',
            descripcion: 'Fuga',
            direccion_siniestro: 'Calle 1',
            codigo_postal: '46001',
            localidad: 'Valencia',
            provincia: 'Valencia',
            asegurado_id: 'aseg-1',
        }, 'user-1', '127.0.0.1');
        expect(rpc).toHaveBeenCalledWith('erp_create_expediente', {
            p_payload: expect.objectContaining({
                compania_id: 'cia-1',
                asegurado_id: 'aseg-1',
            }),
            p_actor_id: 'user-1',
            p_ip: '127.0.0.1',
        });
    });
    it('calls erp_create_cita rpc with atomic command payload', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: { id: 'cita-1' }, error: null });
        const supabase = { rpc };
        await createCitaCommand(supabase, {
            expediente_id: 'exp-1',
            operario_id: 'op-1',
            fecha: '2026-03-17',
            franja_inicio: '09:00',
            franja_fin: '11:00',
            notas: 'Avisar antes',
        }, 'user-1', null);
        expect(rpc).toHaveBeenCalledWith('erp_create_cita', {
            p_payload: {
                expediente_id: 'exp-1',
                operario_id: 'op-1',
                fecha: '2026-03-17',
                franja_inicio: '09:00',
                franja_fin: '11:00',
                notas: 'Avisar antes',
            },
            p_actor_id: 'user-1',
            p_ip: null,
        });
    });
    it('calls erp_transition_expediente rpc with transition metadata', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: { id: 'exp-1', estado: 'FINALIZADO' }, error: null });
        const supabase = { rpc };
        await transitionExpedienteCommand(supabase, {
            expediente_id: 'exp-1',
            estado_nuevo: 'FINALIZADO',
            motivo: 'Parte validado',
        }, 'user-1', '10.0.0.1');
        expect(rpc).toHaveBeenCalledWith('erp_transition_expediente', {
            p_expediente_id: 'exp-1',
            p_estado_nuevo: 'FINALIZADO',
            p_actor_id: 'user-1',
            p_motivo: 'Parte validado',
            p_causa_pendiente: null,
            p_causa_pendiente_detalle: null,
            p_ip: '10.0.0.1',
        });
    });
});
