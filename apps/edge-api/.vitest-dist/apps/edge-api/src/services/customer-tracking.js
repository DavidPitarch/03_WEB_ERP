const STATUS_LABELS = {
    NUEVO: 'Recibido',
    NO_ASIGNADO: 'Pendiente de asignacion',
    EN_PLANIFICACION: 'Planificando visita',
    EN_CURSO: 'En intervencion',
    PENDIENTE: 'Pendiente de gestion',
    PENDIENTE_MATERIAL: 'Pendiente de material',
    PENDIENTE_PERITO: 'Pendiente de peritacion',
    PENDIENTE_CLIENTE: 'Pendiente de cliente',
    FINALIZADO: 'Trabajos finalizados',
    FACTURADO: 'Cierre administrativo',
    COBRADO: 'Cerrado economicamente',
    CERRADO: 'Cerrado',
    CANCELADO: 'Cancelado',
};
const STATUS_SUMMARIES = {
    NUEVO: 'Hemos recibido tu siniestro y estamos preparando la gestion.',
    NO_ASIGNADO: 'Tu expediente esta pendiente de asignacion.',
    EN_PLANIFICACION: 'Estamos coordinando la siguiente visita.',
    EN_CURSO: 'Hay una actuacion en marcha sobre tu expediente.',
    PENDIENTE: 'Tu expediente requiere una gestion adicional.',
    PENDIENTE_MATERIAL: 'Estamos pendientes de material antes de continuar.',
    PENDIENTE_PERITO: 'Estamos pendientes de validacion pericial.',
    PENDIENTE_CLIENTE: 'Necesitamos una accion o confirmacion por tu parte.',
    FINALIZADO: 'La intervencion operativa ha finalizado.',
    FACTURADO: 'El expediente esta en cierre administrativo.',
    COBRADO: 'El expediente esta practicamente cerrado.',
    CERRADO: 'El expediente esta cerrado.',
    CANCELADO: 'El expediente ha sido cancelado.',
};
const CITA_LABELS = {
    programada: 'Programada',
    confirmada: 'Confirmada',
    realizada: 'Realizada',
    cancelada: 'Cancelada',
    no_show: 'No realizada',
};
function toHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
}
export async function hashCustomerTrackingToken(token) {
    const payload = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', payload);
    return toHex(digest);
}
export function validateCustomerTrackingToken(token, now = new Date()) {
    if (!token) {
        return { ok: false, code: 'TOKEN_INVALIDO', status: 404 };
    }
    if (token.revoked_at) {
        return { ok: false, code: 'TOKEN_REVOCADO', status: 410 };
    }
    if (new Date(token.expires_at).getTime() <= now.getTime()) {
        return { ok: false, code: 'TOKEN_EXPIRADO', status: 410 };
    }
    if (token.use_count >= token.max_uses) {
        return { ok: false, code: 'TOKEN_AGOTADO', status: 422 };
    }
    return { ok: true, code: 'TOKEN_VALIDO', status: 200 };
}
export function canConfirmCustomerAppointment(cita, now = new Date()) {
    if (!cita)
        return false;
    if (!['programada', 'confirmada'].includes(cita.estado))
        return false;
    if (cita.customer_confirmed_at)
        return false;
    const appointmentEnd = new Date(`${cita.fecha}T${cita.franja_fin}`);
    return appointmentEnd.getTime() > now.getTime();
}
export function canRequestCustomerReschedule(cita, now = new Date(), minHoursBefore = 4) {
    if (!cita)
        return false;
    if (!['programada', 'confirmada'].includes(cita.estado))
        return false;
    if (cita.customer_reschedule_status === 'pendiente')
        return false;
    const appointmentStart = new Date(`${cita.fecha}T${cita.franja_inicio}`);
    const diffMs = appointmentStart.getTime() - now.getTime();
    return diffMs >= minHoursBefore * 60 * 60 * 1000;
}
export function buildCustomerTrackingTimeline(params) {
    const estadoItems = params.historial.map((item) => ({
        id: `estado-${item.id}`,
        type: 'estado',
        title: `Estado actualizado a ${STATUS_LABELS[item.estado_nuevo] ?? item.estado_nuevo}`,
        detail: STATUS_SUMMARIES[item.estado_nuevo] ?? null,
        created_at: item.created_at,
    }));
    const citaItems = params.citas.map((item) => ({
        id: `cita-${item.id}`,
        type: 'cita',
        title: `Cita ${CITA_LABELS[item.estado] ?? item.estado.toLowerCase()}`,
        detail: `${item.fecha} ${item.franja_inicio}-${item.franja_fin}`,
        created_at: item.created_at,
    }));
    const actionItems = params.comunicaciones
        .filter((item) => item.metadata?.customer_tracking_visible === true)
        .map((item) => ({
        id: `accion-${item.id}`,
        type: 'accion_cliente',
        title: String(item.metadata?.customer_tracking_label ?? 'Actualizacion del cliente'),
        detail: item.contenido,
        created_at: item.created_at,
    }));
    return [...estadoItems, ...citaItems, ...actionItems]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 20);
}
export function buildCustomerTrackingContact(config) {
    const contacto = config?.customer_tracking_contact ?? config?.contacto_cliente ?? null;
    if (!contacto) {
        return null;
    }
    return {
        label: contacto.label ?? contacto.nombre ?? 'Oficina de siniestros',
        telefono: contacto.telefono ?? null,
        email: contacto.email ?? null,
    };
}
export function buildAuthorizedTechnicianLabel(operario) {
    if (!operario?.nombre) {
        return null;
    }
    const lastInitial = operario.apellidos?.trim()?.charAt(0);
    return lastInitial ? `${operario.nombre} ${lastInitial}.` : operario.nombre;
}
export function buildCustomerTrackingView(params) {
    const now = params.now ?? new Date();
    const cita = params.cita;
    return {
        expediente: {
            id: params.expediente.id,
            numero_expediente: params.expediente.numero_expediente,
            estado: params.expediente.estado,
            estado_label: STATUS_LABELS[params.expediente.estado] ?? params.expediente.estado,
            estado_resumen: STATUS_SUMMARIES[params.expediente.estado] ?? 'Tu expediente sigue en gestion.',
            tipo_siniestro: params.expediente.tipo_siniestro,
            updated_at: params.expediente.updated_at,
        },
        cita: cita ? {
            id: cita.id,
            fecha: cita.fecha,
            franja_inicio: cita.franja_inicio,
            franja_fin: cita.franja_fin,
            estado: cita.estado,
            estado_label: CITA_LABELS[cita.estado] ?? cita.estado,
            tecnico: {
                identificacion: buildAuthorizedTechnicianLabel(params.operario),
            },
            customer_confirmed_at: cita.customer_confirmed_at ?? null,
            customer_reschedule_requested_at: cita.customer_reschedule_requested_at ?? null,
            customer_reschedule_requested_slot: cita.customer_reschedule_requested_slot ?? null,
            customer_reschedule_status: cita.customer_reschedule_status ?? null,
            can_confirm: canConfirmCustomerAppointment(cita, now),
            can_request_change: canRequestCustomerReschedule(cita, now),
        } : null,
        contacto: params.contacto,
        timeline: params.timeline,
    };
}
export function buildCustomerTrackingActionMetadata(label, action) {
    return {
        customer_tracking_visible: true,
        customer_tracking_label: label,
        customer_tracking_action: action,
        module: 'customer_tracking',
    };
}
