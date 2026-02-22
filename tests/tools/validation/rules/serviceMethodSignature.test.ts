import { analyze } from '../../../../src/tools/validation/rules/serviceMethodSignature';

describe('serviceMethodSignature rule', () => {
  it('flags missing params in find', () => {
    const code = 'async find() { return []; }';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes correct update signature', () => {
    const code = 'async update(id, data, params) { return data; }';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('flags patch missing params', () => {
    const code = 'async patch(id, data) { return data; }';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes find with params', () => {
    const code = 'async find(params) { return []; }';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });
});
