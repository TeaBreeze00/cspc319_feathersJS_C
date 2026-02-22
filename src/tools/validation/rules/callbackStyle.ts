import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'avoid-callback-style';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const callbackRegex = /\([^)]*\b(callback|cb)\b[^)]*\)/;

  lines.forEach((line, index) => {
    if (callbackRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Avoid callback-style APIs in hooks and services.',
        suggestion: 'Use async/await and return promises instead.',
      });
    }
  });

  return violations;
}
