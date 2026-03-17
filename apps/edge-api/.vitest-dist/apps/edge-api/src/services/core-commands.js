const BUSINESS_ERROR_STATUS = {
    VALIDATION: 422,
    INVALID_STATE: 422,
    INVALID_TRANSITION: 422,
    PRECONDITION_FAILED: 422,
    NOT_FOUND: 404,
    CONFLICT: 409,
    FORBIDDEN: 403,
};
function normalizeText(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
export class RpcCommandError extends Error {
    code;
    status;
    details;
    constructor(code, message, status, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = 'RpcCommandError';
    }
}
export function isRpcCommandError(error) {
    return error instanceof RpcCommandError;
}
export function normalizeCommandError(error) {
    if (isRpcCommandError(error)) {
        return error;
    }
    if (error instanceof Error) {
        return new RpcCommandError('DB_ERROR', error.message, 500);
    }
    return new RpcCommandError('DB_ERROR', 'Error interno no controlado', 500);
}
export function mapRpcError(error) {
    const businessStatus = BUSINESS_ERROR_STATUS[error.message];
    if (error.code === 'P0001' && businessStatus) {
        return new RpcCommandError(error.message, normalizeText(error.details) ?? 'Error de negocio', businessStatus, normalizeText(error.hint) ?? normalizeText(error.details));
    }
    if (error.code === '23505') {
        return new RpcCommandError('CONFLICT', normalizeText(error.details) ?? 'Conflicto de datos', 409, normalizeText(error.message));
    }
    if (error.code === '23503' || error.code === '22P02') {
        return new RpcCommandError('VALIDATION', normalizeText(error.details) ?? 'Referencia o formato invalido', 422, normalizeText(error.message));
    }
    return new RpcCommandError('DB_ERROR', normalizeText(error.message) ?? 'Error de base de datos', 500, normalizeText(error.details) ?? normalizeText(error.hint));
}
async function callRpc(supabase, fn, params, emptyMessage) {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) {
        throw mapRpcError(error);
    }
    if (data == null) {
        throw new RpcCommandError('DB_ERROR', emptyMessage, 500);
    }
    return data;
}
export async function createExpedienteCommand(supabase, input, actorId, ip) {
    return callRpc(supabase, 'erp_create_expediente', {
        p_payload: input,
        p_actor_id: actorId,
        p_ip: ip ?? null,
    }, 'La creacion del expediente no devolvio datos');
}
export async function createCitaCommand(supabase, input, actorId, ip) {
    return callRpc(supabase, 'erp_create_cita', {
        p_payload: input,
        p_actor_id: actorId,
        p_ip: ip ?? null,
    }, 'La creacion de la cita no devolvio datos');
}
export async function transitionExpedienteCommand(supabase, input, actorId, ip) {
    return callRpc(supabase, 'erp_transition_expediente', {
        p_expediente_id: input.expediente_id,
        p_estado_nuevo: input.estado_nuevo,
        p_actor_id: actorId,
        p_motivo: input.motivo ?? null,
        p_causa_pendiente: input.causa_pendiente ?? null,
        p_causa_pendiente_detalle: input.causa_pendiente_detalle ?? null,
        p_ip: ip ?? null,
    }, 'La transicion del expediente no devolvio datos');
}
