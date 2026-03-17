import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../types';

const DIRECT_TIMELINE_TYPES = new Set([
  'nota_interna',
  'email_entrante',
  'email_saliente',
  'llamada',
  'sms',
  'sistema',
]);

export function normalizeExpedienteTimelineType(
  rawType?: string | null,
  actorScope?: string | null,
): string {
  if (!rawType) {
    return actorScope === 'sistema' ? 'sistema' : 'nota_interna';
  }

  if (DIRECT_TIMELINE_TYPES.has(rawType)) {
    return rawType;
  }

  if (rawType.startsWith('llamada_')) {
    return 'llamada';
  }

  if (rawType.startsWith('email_')) {
    return rawType === 'email_entrante' ? 'email_entrante' : 'email_saliente';
  }

  return actorScope === 'sistema' ? 'sistema' : 'nota_interna';
}

export function resolveActorName(
  user?: Pick<AuthUser, 'email' | 'roles'> | null,
  override?: string | null,
): string {
  const explicit = override?.trim();
  if (explicit) {
    return explicit;
  }

  const email = user?.email?.trim();
  if (email) {
    return email;
  }

  const primaryRole = user?.roles?.[0]?.trim();
  if (primaryRole) {
    return primaryRole;
  }

  return 'Sistema';
}

export interface InsertExpedienteTimelineEntryParams {
  expedienteId: string;
  actorId: string;
  content: string;
  subject?: string | null;
  type?: string | null;
  actorScope?: string | null;
  actorName?: string | null;
  actor?: Pick<AuthUser, 'email' | 'roles'> | null;
  metadata?: Record<string, unknown>;
}

export async function insertExpedienteTimelineEntry(
  supabase: SupabaseClient,
  params: InsertExpedienteTimelineEntryParams,
) {
  await supabase.from('comunicaciones').insert({
    expediente_id: params.expedienteId,
    tipo: normalizeExpedienteTimelineType(params.type, params.actorScope),
    asunto: params.subject?.trim() || null,
    contenido: params.content,
    actor_id: params.actorId,
    actor_nombre: resolveActorName(params.actor, params.actorName),
    metadata: params.metadata ?? {},
  });
}
