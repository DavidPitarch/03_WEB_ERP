import type { SupabaseClient } from '@supabase/supabase-js';

export async function insertAudit(
  supabase: SupabaseClient,
  params: {
    tabla: string;
    registro_id: string;
    accion: 'INSERT' | 'UPDATE' | 'DELETE';
    actor_id: string;
    cambios: Record<string, unknown>;
    ip?: string;
  }
) {
  await supabase.from('auditoria').insert({
    tabla: params.tabla,
    registro_id: params.registro_id,
    accion: params.accion,
    actor_id: params.actor_id,
    cambios: params.cambios,
    ip: params.ip ?? null,
  });
}

export async function insertHistorialEstado(
  supabase: SupabaseClient,
  params: {
    expediente_id: string;
    estado_anterior: string | null;
    estado_nuevo: string;
    motivo?: string;
    actor_id: string;
  }
) {
  await supabase.from('historial_estados').insert({
    expediente_id: params.expediente_id,
    estado_anterior: params.estado_anterior,
    estado_nuevo: params.estado_nuevo,
    motivo: params.motivo ?? null,
    actor_id: params.actor_id,
  });
}

export async function insertDomainEvent(
  supabase: SupabaseClient,
  params: {
    aggregate_id: string;
    aggregate_type: string;
    event_type: string;
    payload: Record<string, unknown>;
    actor_id: string;
    correlation_id?: string;
    causation_id?: string;
  }
) {
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
