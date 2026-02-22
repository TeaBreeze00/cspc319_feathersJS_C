import { TypeScriptValidator } from '../../../src/tools/validation/tsValidator';

describe('TypeScriptValidator', () => {
  it('marks valid TypeScript as valid', () => {
    const validator = new TypeScriptValidator();
    const result = validator.validate('const x: number = 5;');
    expect(result.valid).toBe(true);
  });

  it('detects syntax errors with line numbers', () => {
    const validator = new TypeScriptValidator();
    const result = validator.validate('const x: = 5;');
    expect(result.valid).toBe(false);
    expect(result.errors && result.errors.length).toBeGreaterThan(0);
    expect(result.errors?.[0].line).toBeGreaterThan(0);
  });
});
