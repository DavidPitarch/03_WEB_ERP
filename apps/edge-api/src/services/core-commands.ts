import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateExpedienteRequest, ExpedienteEstado } from '@erp/types';

type RpcErrorLike = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

type RpcCommandStatus = 403 | 404 | 409 | 422 | 500;

const BUSINESS_ERROR_STATUS: Record<string, RpcCommandStatus> = {
  VALIDATION: 422,
  INVALID_STATE: 422,
  INVALID_TRANSITION: 422,
  PRECONDITION_FAILED: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  FORBIDDEN: 403,
};

function normalizeText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export class RpcCommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: RpcCommandStatus,
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'RpcCommandError';
  }
}

export function isRpcCommandError(error: unknown): error is RpcCommandError {
  return error instanceof RpcCommandError;
}

export function normalizeCommandError(error: unknown): RpcCommandError {
  if (isRpcCommandError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new RpcCommandError('DB_ERROR', error.message, 500);
  }

  return new RpcCommandError('DB_ERROR', 'Error interno no controlado', 500);
}

export function mapRpcError(error: RpcErrorLike): RpcCommandError {
  const businessStatus = BUSINESS_ERROR_STATUS[error.message];
  if (error.code === 'P0001' && businessStatus) {
    return new RpcCommandError(
      error.message,
      normalizeText(error.details) ?? 'Error de negocio',
      businessStatus,
      normalizeText(error.hint) ?? normalizeText(error.details),
    );
  }

  if (error.code === '23505') {
    return new RpcCommandError(
      'CONFLICT',
      normalizeText(error.details) ?? 'Conflicto de datos',
      409,
      normalizeText(error.message),
    );
  }

  if (error.code === '23503' || error.code === '22P02') {
    return new RpcCommandError(
      'VALIDATION',
      normalizeText(error.details) ?? 'Referencia o formato invalido',
      422,
      normalizeText(error.message),
    );
  }

  return new RpcCommandError(
    'DB_ERROR',
    normalizeText(error.message) ?? 'Error de base de datos',
    500,
    normalizeText(error.details) ?? normalizeText(error.hint),
  );
}

async function callRpc<T>(
  supabase: SupabaseClient,
  fn: string,
  params: Record<string, unknown>,
  emptyMessage: string,
): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);

  if (error) {
    throw mapRpcError(error);
  }

  if (data == null) {
    throw new RpcCommandError('DB_ERROR', emptyMessage, 500);
  }

  return data as T;
}

export interface CreateExpedienteCommandInput extends CreateExpedienteRequest {
  datos_origen?: Record<string, unknown>;
}

export interface CreateCitaCommandInput {
  expediente_id: string;
  operario_id: string;
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  notas?: string | null;
}

export interface TransitionExpedienteCommandInput {
  expediente_id: string;
  estado_nuevo: ExpedienteEstado;
  motivo?: string | null;
  causa_pendiente?: string | null;
  causa_pendiente_detalle?: string | null;
}

export interface TransitionExpedienteCommandResult {
  id: string;
  estado: ExpedienteEstado;
}

export async function createExpedienteCommand(
  supabase: SupabaseClient,
  input: CreateExpedienteCommandInput,
  actorId: string,
  ip?: string | null,
) {
  return callRpc<Record<string, unknown>>(
    supabase,
    'erp_create_expediente',
    {
      p_payload: input,
      p_actor_id: actorId,
      p_ip: ip ?? null,
    },
    'La creacion del expediente no devolvio datos',
  );
}

export async function createCitaCommand(
  supabase: SupabaseClient,
  input: CreateCitaCommandInput,
  actorId: string,
  ip?: string | null,
) {
  return callRpc<Record<string, unknown>>(
    supabase,
    'erp_create_cita',
    {
      p_payload: input,
      p_actor_id: actorId,
      p_ip: ip ?? null,
    },
    'La creacion de la cita no devolvio datos',
  );
}

export async function transitionExpedienteCommand(
  supabase: SupabaseClient,
  input: TransitionExpedienteCommandInput,
  actorId: string,
  ip?: string | null,
) {
  return callRpc<TransitionExpedienteCommandResult>(
    supabase,
    'erp_transition_expediente',
    {
      p_expediente_id: input.expediente_id,
      p_estado_nuevo: input.estado_nuevo,
      p_actor_id: actorId,
      p_motivo: input.motivo ?? null,
      p_causa_pendiente: input.causa_pendiente ?? null,
      p_causa_pendiente_detalle: input.causa_pendiente_detalle ?? null,
      p_ip: ip ?? null,
    },
    'La transicion del expediente no devolvio datos',
  );
}
