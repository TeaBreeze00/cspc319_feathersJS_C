import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'async-await-usage';

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];
  const thenRegex = /\.then\s*\(/;
  const catchRegex = /\.catch\s*\(/;

  lines.forEach((line, index) => {
    if (thenRegex.test(line) || catchRegex.test(line)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Prefer async/await over promise chaining.',
        suggestion: 'Use await and try/catch for async flows.',
      });
    }
  });

  return violations;
}
