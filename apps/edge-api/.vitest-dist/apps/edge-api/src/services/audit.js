export async function insertAudit(supabase, params) {
    await supabase.from('auditoria').insert({
        tabla: params.tabla,
        registro_id: params.registro_id,
        accion: params.accion,
        actor_id: params.actor_id,
        cambios: params.cambios,
        ip: params.ip ?? null,
    });
}
export async function insertHistorialEstado(supabase, params) {
    await supabase.from('historial_estados').insert({
        expediente_id: params.expediente_id,
        estado_anterior: params.estado_anterior,
        estado_nuevo: params.estado_nuevo,
        motivo: params.motivo ?? null,
        actor_id: params.actor_id,
    });
}
export async function insertDomainEvent(supabase, params) {
    await supabase.from('eventos_dominio').insert({
        aggregate_id: params.aggregate_id,
        aggregate_type: params.aggregate_type,
        event_type: params.event_type,
        payload: params.payload,
        actor_id: params.actor_id,
        correlation_id: params.correlation_id ?? crypto.randomUUID(),
        causation_id: params.causation_id ?? null,
    });
}
