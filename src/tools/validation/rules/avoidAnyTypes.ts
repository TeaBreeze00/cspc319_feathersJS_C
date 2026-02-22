import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'avoid-any-types';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const anyRegex = /:\s*any\b|<[^>]*\bany\b[^>]*>|\bany\[\]|\b=\s*any\b/;

  lines.forEach((line, index) => {
    if (anyRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Avoid using the "any" type.',
        suggestion: 'Use explicit types or generics instead of any.',
      });
    }
  });

  return violations;
}
