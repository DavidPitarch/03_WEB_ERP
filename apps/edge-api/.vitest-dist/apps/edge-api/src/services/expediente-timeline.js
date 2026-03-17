const DIRECT_TIMELINE_TYPES = new Set([
    'nota_interna',
    'email_entrante',
    'email_saliente',
    'llamada',
    'sms',
    'sistema',
]);
export function normalizeExpedienteTimelineType(rawType, actorScope) {
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
export function resolveActorName(user, override) {
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
export async function insertExpedienteTimelineEntry(supabase, params) {
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
