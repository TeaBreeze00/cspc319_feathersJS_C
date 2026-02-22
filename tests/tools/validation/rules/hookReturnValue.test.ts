import { analyze } from '../../../../src/tools/validation/rules/hookReturnValue';

describe('hookReturnValue rule', () => {
  it('flags hooks without returning context', () => {
    const code = 'const hook = async (context) => { console.log(context); };';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes when context is returned', () => {
    const code = 'const hook = async (context) => { return context; };';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('does not flag unrelated context usage', () => {
    const code = 'const context = 1;';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
