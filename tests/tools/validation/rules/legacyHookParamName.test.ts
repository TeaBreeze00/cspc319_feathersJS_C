import { analyze } from '../../../../src/tools/validation/rules/legacyHookParamName';

describe('legacyHookParamName rule', () => {
  it('flags legacy hook parameter name', () => {
    const code = 'const hook = async (hook) => hook;';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes context parameter name', () => {
    const code = 'const hook = async (context) => context;';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('does not flag hook word in comments', () => {
    const code = '// hook should be fast';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
