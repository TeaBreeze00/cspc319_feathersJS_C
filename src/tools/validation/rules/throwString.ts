import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'throw-string';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const throwStringRegex = /throw\s+['"`]/;

  lines.forEach((line, index) => {
    if (throwStringRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Avoid throwing strings; use Error objects.',
        suggestion: 'Throw a Feathers error or an Error instance.',
      });
    }
  });

  return violations;
}
