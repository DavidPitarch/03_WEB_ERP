export const VP_SIGNED_URL_TTL_SECONDS = 900;
const VP_OFFICE_ROLES = new Set(['admin', 'supervisor', 'tramitador', 'financiero', 'direccion']);
export class VpArtefactAccessError extends Error {
    code;
    status;
    constructor(code, message, status) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'VpArtefactAccessError';
    }
}
export function hasVpOfficeAccess(userRoles) {
    return (userRoles ?? []).some((role) => VP_OFFICE_ROLES.has(role));
}
export function canAccessVpArtefactScope(userRoles, scope, isAssignedPerito) {
    if (hasVpOfficeAccess(userRoles)) {
        return true;
    }
    if (!(userRoles ?? []).includes('perito')) {
        return false;
    }
    if (!isAssignedPerito) {
        return false;
    }
    return scope === 'perito' || scope === 'all';
}
async function resolveCurrentPeritoId(supabase, userId) {
    const { data, error } = await supabase
        .from('peritos')
        .select('id')
        .eq('user_id', userId)
        .eq('activo', true)
        .maybeSingle();
    if (error) {
        throw new VpArtefactAccessError('FORBIDDEN', 'No se ha podido resolver el perito actual', 403);
    }
    return data?.id ?? null;
}
export async function assertVpArtefactAccess(supabase, userId, userRoles, artefactoId) {
    const { data, error } = await supabase
        .from('vp_artefactos')
        .select('id, storage_path, provider_url, visibility_scope, videoperitacion_id, vp_videoperitaciones!inner(perito_id)')
        .eq('id', artefactoId)
        .single();
    if (error || !data) {
        throw new VpArtefactAccessError('NOT_FOUND', 'Artefacto no encontrado', 404);
    }
    const artefacto = {
        id: data.id,
        storage_path: data.storage_path,
        provider_url: data.provider_url,
        visibility_scope: data.visibility_scope,
        videoperitacion_id: data.videoperitacion_id,
    };
    if (hasVpOfficeAccess(userRoles)) {
        return { artefacto, accessRole: 'office' };
    }
    const peritoId = await resolveCurrentPeritoId(supabase, userId);
    const assignedPeritoId = data.vp_videoperitaciones?.perito_id ?? null;
    const isAssignedPerito = Boolean(peritoId && assignedPeritoId && peritoId === assignedPeritoId);
    if (!canAccessVpArtefactScope(userRoles, artefacto.visibility_scope, isAssignedPerito)) {
        throw new VpArtefactAccessError('FORBIDDEN', 'No tiene permiso para acceder a este artefacto', 403);
    }
    return { artefacto, accessRole: 'perito' };
}
