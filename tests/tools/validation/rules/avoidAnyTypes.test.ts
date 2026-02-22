import { analyze } from '../../../../src/tools/validation/rules/avoidAnyTypes';

describe('avoidAnyTypes rule', () => {
  it('flags any usage', () => {
    const code = 'const x: any = 1;';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes explicit types', () => {
    const code = 'const x: number = 1;';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('flags generic any usage', () => {
    const code = 'type Box<T = any> = { value: T };';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });
});
