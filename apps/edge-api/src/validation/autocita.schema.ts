import type { SchemaShape } from './schema';

export const autocitaIssueLinkSchema: SchemaShape = {
  expediente_id: { required: true, isUuid: true },
  scope: { isEnum: ['confirmar', 'seleccionar', 'ambos'] },
};

export const autocitaSeleccionarSchema: SchemaShape = {
  slot_id: { required: true, minLength: 10 },
};
