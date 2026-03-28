import type { SchemaShape } from '../engine';

export const createExpedienteSchema: SchemaShape = {
  compania_id:          { required: true, isUuid: true },
  tipo_siniestro:       { required: true, minLength: 2, maxLength: 100 },
  descripcion:          { maxLength: 2000 },
  direccion_siniestro:  { required: true, minLength: 5, maxLength: 300 },
  cp:                   { maxLength: 10 },
  localidad:            { maxLength: 150 },
  provincia:            { maxLength: 100 },
  numero_poliza:        { maxLength: 100 },
  numero_siniestro_cia: { maxLength: 100 },
  prioridad:            { isEnum: ['baja', 'media', 'alta', 'urgente'] },
};

export const transicionEstadoSchema: SchemaShape = {
  estado_nuevo: { required: true, minLength: 3, maxLength: 50 },
  motivo:       { maxLength: 500 },
};
