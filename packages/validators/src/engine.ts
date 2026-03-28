/**
 * Lightweight declarative schema validator — zero external dependencies.
 * Works in Cloudflare Workers, Node.js and browser environments.
 * Produces structured field-level errors (422).
 *
 * Usage:
 *   const result = validate(body, {
 *     expediente_id: { required: true, isUuid: true },
 *     tipo_siniestro: { required: true, isEnum: ['agua', 'fuego', 'electrico'] },
 *     email: { isEmail: true },
 *   });
 *   if (!result.ok) return validationError(c, result.errors);
 */

export interface FieldRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  isUuid?: boolean;
  isEmail?: boolean;
  isEnum?: readonly string[];
  isPositive?: boolean;
  isNumber?: boolean;
}

export type SchemaShape = Record<string, FieldRule | undefined>;

type ValidationOk = { ok: true };
type ValidationFail = { ok: false; errors: Record<string, string[]> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(body: unknown, schema: SchemaShape): ValidationOk | ValidationFail {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: { _body: ['El cuerpo de la petición debe ser un objeto JSON válido'] } };
  }

  const obj = body as Record<string, unknown>;
  const errors: Record<string, string[]> = {};

  for (const [field, rule] of Object.entries(schema)) {
    if (!rule) continue;

    const val = obj[field];
    const isEmpty = val === undefined || val === null || val === '';
    const fieldErrors: string[] = [];

    if (rule.required && isEmpty) {
      fieldErrors.push('Campo requerido');
      errors[field] = fieldErrors;
      continue;
    }

    if (isEmpty) continue;

    if (typeof val === 'string') {
      const trimmed = val.trim();

      if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
        fieldErrors.push(`Mínimo ${rule.minLength} caracteres`);
      }
      if (rule.maxLength !== undefined && val.length > rule.maxLength) {
        fieldErrors.push(`Máximo ${rule.maxLength} caracteres`);
      }
      if (rule.isUuid && !UUID_RE.test(val)) {
        fieldErrors.push('Debe ser un UUID válido');
      }
      if (rule.isEmail && !EMAIL_RE.test(val)) {
        fieldErrors.push('Debe ser un email válido');
      }
      if (rule.isEnum && !rule.isEnum.includes(val)) {
        fieldErrors.push(`Valor inválido. Permitidos: ${rule.isEnum.join(', ')}`);
      }
    }

    if (rule.isNumber && typeof val !== 'number') {
      fieldErrors.push('Debe ser un número');
    }
    if (rule.isPositive && typeof val === 'number' && val <= 0) {
      fieldErrors.push('Debe ser mayor que cero');
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }

  if (Object.keys(errors).length === 0) return { ok: true };
  return { ok: false, errors };
}

/**
 * Returns the standard ApiResult JSON body for a 422 validation error.
 * Framework-agnostic — use this in any environment.
 * In Hono: return c.json(formatValidationError(result.errors), 422)
 */
export function formatValidationError(errors: Record<string, string[]>) {
  return {
    data: null,
    error: {
      code: 'VALIDATION',
      message: 'Datos de entrada inválidos',
      details: errors,
    },
  };
}
