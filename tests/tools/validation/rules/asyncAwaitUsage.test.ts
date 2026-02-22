import { analyze } from '../../../../src/tools/validation/rules/asyncAwaitUsage';

describe('asyncAwaitUsage rule', () => {
  it('flags promise chaining', () => {
    const code = 'doThing().then(() => {});';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes async/await usage', () => {
    const code = 'const run = async () => { await doThing(); };';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('does not flag async without then/catch', () => {
    const code = 'async function run() { return doThing(); }';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
