import type { SchemaShape } from '../engine';

export const intakeRootSchema: SchemaShape = {
  compania_id:          { required: true, isUuid: true },
  tipo_siniestro:       { required: true, minLength: 2 },
  descripcion:          { maxLength: 2000 },
  direccion_siniestro:  { required: true, minLength: 5 },
  prioridad:            { isEnum: ['baja', 'media', 'alta', 'urgente'] },
  numero_poliza:        { maxLength: 100 },
  numero_siniestro_cia: { maxLength: 100 },
};

export const intakeAseguradoSchema: SchemaShape = {
  nombre:    { required: true, minLength: 1, maxLength: 150 },
  apellidos: { maxLength: 150 },
  email:     { isEmail: true },
  telefono:  { maxLength: 20 },
  nif:       { maxLength: 20 },
};
