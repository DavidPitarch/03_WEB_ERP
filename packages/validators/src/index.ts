// Engine — core validation primitives
export { validate, formatValidationError } from './engine';
export type { FieldRule, SchemaShape } from './engine';

// Domain schemas
export * from './schemas/autocita';
export * from './schemas/expedientes';
export * from './schemas/intake';
export * from './schemas/facturacion';
