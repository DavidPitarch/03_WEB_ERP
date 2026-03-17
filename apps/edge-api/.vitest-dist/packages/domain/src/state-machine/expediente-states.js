// Mapa de transiciones permitidas: estado_actual → estados_destino[]
const TRANSITIONS = {
    NUEVO: ['NO_ASIGNADO', 'CANCELADO'],
    NO_ASIGNADO: ['EN_PLANIFICACION', 'CANCELADO'],
    EN_PLANIFICACION: ['EN_CURSO', 'PENDIENTE_CLIENTE', 'CANCELADO'],
    EN_CURSO: [
        'FINALIZADO',
        'PENDIENTE',
        'PENDIENTE_MATERIAL',
        'PENDIENTE_PERITO',
        'PENDIENTE_CLIENTE',
        'CANCELADO',
    ],
    PENDIENTE: ['EN_CURSO', 'CANCELADO'],
    PENDIENTE_MATERIAL: ['EN_CURSO', 'CANCELADO'],
    PENDIENTE_PERITO: ['EN_CURSO', 'CANCELADO'],
    PENDIENTE_CLIENTE: ['EN_PLANIFICACION', 'EN_CURSO', 'CANCELADO'],
    FINALIZADO: ['FACTURADO', 'EN_CURSO'], // reabrir si hay error
    FACTURADO: ['COBRADO'],
    COBRADO: ['CERRADO'],
    CERRADO: [], // estado terminal
    CANCELADO: [], // estado terminal
};
export function canTransition(from, to) {
    return TRANSITIONS[from]?.includes(to) ?? false;
}
export function getAllowedTransitions(from) {
    return TRANSITIONS[from] ?? [];
}
export function validateTransitionPreconditions(from, to, ctx) {
    if (!canTransition(from, to)) {
        return { valid: false, error: `Transición no permitida: ${from} → ${to}` };
    }
    if (to === 'FINALIZADO' && !ctx.tiene_parte_validado) {
        return { valid: false, error: 'No se puede finalizar sin parte validado' };
    }
    if (to === 'FACTURADO' && !ctx.tiene_factura) {
        return { valid: false, error: 'No se puede marcar como facturado sin factura emitida' };
    }
    if (to === 'COBRADO' && !ctx.tiene_cobro) {
        return { valid: false, error: 'No se puede marcar como cobrado sin pago registrado' };
    }
    return { valid: true };
}
