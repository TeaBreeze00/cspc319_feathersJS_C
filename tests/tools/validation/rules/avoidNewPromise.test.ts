import { analyze } from '../../../../src/tools/validation/rules/avoidNewPromise';

describe('avoidNewPromise rule', () => {
  it('flags new Promise usage', () => {
    const code = 'return new Promise(() => {});';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes promise helpers', () => {
    const code = 'return Promise.resolve(1);';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
