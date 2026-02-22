import { PrettierValidator } from '../../../src/tools/validation/prettierValidator';

describe('PrettierValidator', () => {
  jest.setTimeout(10000);

  it('reports formatted code as formatted', () => {
    const validator = new PrettierValidator();
    const result = validator.check('const x = 1;\n');
    expect(result.formatted).toBe(true);
  });

  it('detects unformatted code and formats it', () => {
    const validator = new PrettierValidator();
    const unformatted = 'const x=1;const y=2;';
    const check = validator.check(unformatted);
    expect(check.formatted).toBe(false);
    const formatted = validator.format(unformatted);
    expect(formatted).not.toBe(unformatted);
  });
});
