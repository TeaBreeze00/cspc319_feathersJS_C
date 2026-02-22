import { analyze } from '../../../../src/tools/validation/rules/callbackStyle';

describe('callbackStyle rule', () => {
  it('flags callback parameters', () => {
    const code = 'function run(callback) { callback(); }';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes async functions', () => {
    const code = 'const run = async () => { return 1; };';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
