import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'hook-return-value';

export function analyze(code: string): RuleViolation[] {
  if (code.includes('return context')) {
    return [];
  }

  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];

  lines.forEach((line, index) => {
    const looksLikeHook =
      line.includes('context') && (line.includes('hook') || line.includes('=>') || line.includes('function'));
    if (looksLikeHook) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Hooks should return the context object.',
        suggestion: 'Return context at the end of the hook.',
      });
    }
  });

  return violations;
}
