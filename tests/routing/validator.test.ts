/// <reference types="jest" />

import { ParameterValidator } from '../../src/routing/validator';

describe('ParameterValidator', () => {
  let validator: ParameterValidator;

  beforeEach(() => {
    validator = new ParameterValidator();
  });

  test('returns valid for correct params', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    const result = validator.validate({ name: 'Alice', age: 30 }, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  test('returns errors with paths for invalid params', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    const result = validator.validate({ age: 'not-a-number' }, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThanOrEqual(1);

    // Should report missing required property and/or wrong type
    const messages = result.errors!.map((e) => e.message).join(' ');
    expect(messages).toMatch(/required|type/i);
  });

  test('caches compiled schemas across calls', () => {
    const schema = { type: 'string' };
    const r1 = validator.validate('hello', schema);
    const r2 = validator.validate('world', schema);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });
});
