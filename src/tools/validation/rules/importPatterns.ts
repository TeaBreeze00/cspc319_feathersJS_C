import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'import-patterns';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];

  lines.forEach((line, index) => {
    if (/from\s+['"]feathers['"]/.test(line) || /from\s+['"]feathersjs['"]/.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Use @feathersjs/feathers imports for v5.',
        suggestion: "Replace with @feathersjs/feathers named imports.",
      });
    }

    if (/import\s+[\w$]+\s+from\s+['"]@feathersjs\/feathers['"]/.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Avoid default imports from @feathersjs/feathers.',
        suggestion: 'Use named imports instead of a default import.',
      });
    }
  });

  return violations;
}
