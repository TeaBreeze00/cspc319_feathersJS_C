import { analyze } from '../../../../src/tools/validation/rules/errorHandling';

describe('errorHandling rule', () => {
  it('flags generic Error usage', () => {
    const code = 'throw new Error(\"Boom\");';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes when no generic Error is thrown', () => {
    const code = 'const run = async () => { return 1; };';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
