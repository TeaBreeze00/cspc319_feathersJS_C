import { analyze } from '../../../../src/tools/validation/rules/importPatterns';

describe('importPatterns rule', () => {
  it('flags legacy feathers import', () => {
    const code = 'import feathers from \"@feathersjs/feathers\";';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('passes named imports', () => {
    const code = 'import { Application } from \"@feathersjs/feathers\";';
    const violations = analyze(code);
    expect(violations.length).toBe(0);
  });

  it('flags legacy feathers import path', () => {
    const code = 'import feathers from \"feathers\";';
    const violations = analyze(code);
    expect(violations.length).toBeGreaterThan(0);
  });
});
