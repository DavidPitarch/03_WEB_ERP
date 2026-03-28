/**
 * Re-exports the shared validation engine from @erp/validators.
 * Adds the Hono-specific `validationError()` wrapper that stays in edge-api
 * because it depends on the Hono context object (c.json).
 */
export { validate, formatValidationError } from '@erp/validators';
export type { FieldRule, SchemaShape } from '@erp/validators';

import { formatValidationError } from '@erp/validators';

/** Returns a Hono 422 response with structured field errors. */
export function validationError(c: any, errors: Record<string, string[]>) {
  return c.json(formatValidationError(errors), 422);
}
