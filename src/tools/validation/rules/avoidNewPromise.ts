import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'avoid-new-promise';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const promiseRegex = /new\s+Promise\s*\(/;

  lines.forEach((line, index) => {
    if (promiseRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Avoid wrapping logic in new Promise.',
        suggestion: 'Use async functions and return the awaited value.',
      });
    }
  });

  return violations;
}
