import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'legacy-hook-param';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const hookParamRegex = /\(\s*hook[\s,:)]/;

  lines.forEach((line, index) => {
    if (hookParamRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Use "context" instead of legacy "hook" parameter naming.',
        suggestion: 'Rename the hook parameter to context.',
      });
    }
  });

  return violations;
}
