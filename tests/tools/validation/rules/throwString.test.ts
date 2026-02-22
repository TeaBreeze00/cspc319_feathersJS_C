import { analyze } from '../../../../src/tools/validation/rules/throwString';

describe('throwString rule', () => {
  it('flags throwing strings', () => {
    const code = "throw 'error';";
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes throwing Error objects', () => {
    const code = "throw new Error('error');";
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('flags template string throws', () => {
    const code = "throw `error`;";
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });
});
