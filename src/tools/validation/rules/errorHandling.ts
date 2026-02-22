import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'feathers-error-handling';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const errorRegex = /throw\s+new\s+Error\s*\(/;

  lines.forEach((line, index) => {
    if (errorRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Use Feathers errors for consistent error handling.',
        suggestion: "Throw @feathersjs/errors (e.g. BadRequest, NotFound).",
      });
    }
  });

  return violations;
}
