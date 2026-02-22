import type { RuleViolation } from '../bestPracticeRules';

const RULE = 'service-method-signature';

const METHOD_REGEX =
  /\basync\s+(find|get|create|update|patch|remove)\s*\(([^)]*)\)/;

export function analyze(code: string): RuleViolation[] {
  const lines = code.split(/\r?\n/);
  const violations: RuleViolation[] = [];

  lines.forEach((line, index) => {
    const match = line.match(METHOD_REGEX);
    if (!match) return;

    const method = match[1];
    const rawParams = match[2] || '';
    const params = rawParams
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const hasParams = params.some((p) => p.includes('params'));
    const hasId = params.some((p) => p.startsWith('id') || p.includes('id:'));
    const hasData = params.some((p) => p.startsWith('data') || p.includes('data:'));

    if ((method === 'find' || method === 'get' || method === 'remove') && !hasParams) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: `Service method "${method}" should accept params.`,
        suggestion: `Add a params argument to ${method}(params).`,
      });
    }

    if (method === 'create' && !hasParams) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: 'Service method "create" should accept (data, params).',
        suggestion: 'Add params as the second argument to create(data, params).',
      });
    }

    if ((method === 'update' || method === 'patch') && (!hasId || !hasData || !hasParams)) {
      violations.push({
        rule: RULE,
        line: index + 1,
        message: `Service method "${method}" should accept (id, data, params).`,
        suggestion: `Use ${method}(id, data, params).`,
      });
    }
  });

  return violations;
}
