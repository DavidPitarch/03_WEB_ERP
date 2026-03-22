import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutocitaTokenScope } from '@erp/types';

export interface AutocitaTokenRecord {
  id: string;
  expediente_id: string;
  cita_id_origen: string | null;
  compania_id: string | null;
  token_hash: string;
  scope: AutocitaTokenScope;
  estado: string;
  expires_at: string;
  max_uses: number;
  uso_count: number;
  revoked_at: string | null;
  created_by: string;
}

export interface AutocitaTokenValidationResult {
  ok: boolean;
  code: 'TOKEN_VALIDO' | 'TOKEN_INVALIDO' | 'TOKEN_EXPIRADO' | 'TOKEN_REVOCADO' | 'TOKEN_AGOTADO';
  status: 200 | 404 | 410 | 422;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashAutocitaToken(token: string): Promise<string> {
  const payload = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return toHex(digest);
}

export function validateAutocitaToken(
  token: AutocitaTokenRecord | null | undefined,
  now = new Date(),
): AutocitaTokenValidationResult {
  if (!token) {
    return { ok: false, code: 'TOKEN_INVALIDO', status: 404 };
  }

  if (token.revoked_at) {
    return { ok: false, code: 'TOKEN_REVOCADO', status: 410 };
  }

  if (new Date(token.expires_at).getTime() <= now.getTime()) {
    return { ok: false, code: 'TOKEN_EXPIRADO', status: 410 };
  }

  if (token.uso_count >= token.max_uses) {
    return { ok: false, code: 'TOKEN_AGOTADO', status: 422 };
  }

  return { ok: true, code: 'TOKEN_VALIDO', status: 200 };
}

export async function findAutocitaTokenByRawValue(
  supabase: SupabaseClient,
  rawToken: string,
): Promise<AutocitaTokenRecord | null> {
  const tokenHash = await hashAutocitaToken(rawToken);
  const { data } = await supabase
    .from('autocita_tokens')
    .select('id, expediente_id, cita_id_origen, compania_id, token_hash, scope, estado, expires_at, max_uses, uso_count, revoked_at, created_by')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  return (data as AutocitaTokenRecord | null) ?? null;
}

export async function consumeAutocitaToken(
  supabase: SupabaseClient,
  token: AutocitaTokenRecord,
): Promise<void> {
  const newCount = token.uso_count + 1;
  const updates: Record<string, unknown> = {
    uso_count: newCount,
    last_used_at: new Date().toISOString(),
  };

  if (newCount >= token.max_uses) {
    updates.estado = 'usado';
  }

  await supabase
    .from('autocita_tokens')
    .update(updates)
    .eq('id', token.id);
}

export async function countCambiosExpediente(
  supabase: SupabaseClient,
  expedienteId: string,
): Promise<number> {
  const { data } = await supabase
    .from('autocita_selecciones')
    .select('id', { count: 'exact', head: false })
    .eq('expediente_id', expedienteId)
    .in('accion', ['seleccion_hueco', 'cambio_solicitado']);

  return Array.isArray(data) ? data.length : 0;
}

export async function insertAutocitaSeleccion(
  supabase: SupabaseClient,
  params: {
    tokenId: string;
    expedienteId: string;
    citaId?: string | null;
    accion: 'confirmacion_propuesta' | 'seleccion_hueco' | 'cambio_solicitado' | 'slot_no_disponible';
    slotFecha?: string | null;
    slotFranjaInicio?: string | null;
    slotFranjaFin?: string | null;
    ip: string | null;
    userAgent: string | null;
    detalle?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from('autocita_selecciones').insert({
    token_id: params.tokenId,
    expediente_id: params.expedienteId,
    cita_id: params.citaId ?? null,
    accion: params.accion,
    slot_fecha: params.slotFecha ?? null,
    slot_franja_inicio: params.slotFranjaInicio ?? null,
    slot_franja_fin: params.slotFranjaFin ?? null,
    ip_cliente: params.ip,
    user_agent: params.userAgent,
    detalle: params.detalle ?? {},
  });
}

export function resolveAutocitaConfig(companiaConfig: Record<string, unknown> | null | undefined) {
  const cfg = (companiaConfig?.autocita ?? {}) as Record<string, unknown>;
  return {
    maxSlotsMostrados: Number(cfg.max_slots_mostrados ?? 5),
    diasMaxSeleccion: Number(cfg.dias_max_seleccion ?? 14),
    margenAvisoH: Number(cfg.margen_aviso_h ?? 24),
    bufferSlaH: Number(cfg.buffer_sla_h ?? 48),
    permiteSeleccionLibre: Boolean(cfg.permite_seleccion_libre ?? true),
    maxCambiosPorExpediente: Number(cfg.max_cambios_por_expediente ?? 2),
  };
}
