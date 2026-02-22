import { ESLintValidator } from '../../../src/tools/validation/eslintValidator';

describe('ESLintValidator', () => {
  jest.setTimeout(10000);

  it('passes clean code', async () => {
    const validator = new ESLintValidator();
    const result = await validator.validate('const x = 1; console.log(x);');
    expect(result.valid).toBe(true);
  });

  it('detects lint violations', async () => {
    const validator = new ESLintValidator();
    const result = await validator.validate('const x = 1;');
    expect(result.valid).toBe(false);
    expect(result.errors && result.errors.length).toBeGreaterThan(0);
  });
});
