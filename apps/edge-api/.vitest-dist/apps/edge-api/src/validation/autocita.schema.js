export const autocitaIssueLinkSchema = {
    expediente_id: { required: true, isUuid: true },
    scope: { isEnum: ['confirmar', 'seleccionar', 'ambos'] },
};
export const autocitaSeleccionarSchema = {
    slot_id: { required: true, minLength: 10 },
};
