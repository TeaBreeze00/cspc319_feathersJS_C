import Ajv, { ValidateFunction } from 'ajv';
import { ValidationResult, ValidationError } from './types';

/**
 * ParameterValidator wraps Ajv to validate params against JSON Schemas.
 * It caches compiled validators by schema fingerprint to avoid recompilation.
 */
export class ParameterValidator {
  private ajv: Ajv;
  private cache: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.cache = new Map();
  }

  private fingerprint(schema: unknown): string {
    try {
      return JSON.stringify(schema);
    } catch (e) {
      return String(schema);
    }
  }

  validate(params: unknown, schema: object): ValidationResult {
    const key = this.fingerprint(schema);
    let validate: ValidateFunction | undefined = this.cache.get(key);
    if (!validate) {
      validate = this.ajv.compile(schema as object);
      this.cache.set(key, validate);
    }

    const valid = validate(params as any) as boolean;
    if (valid) {
      return { valid: true };
    }

    const errors: ValidationError[] = (validate.errors || []).map((e) => ({
      path: e.instancePath || '',
      message: e.message || 'invalid',
    }));

    return { valid: false, errors };
  }
}

export default ParameterValidator;
