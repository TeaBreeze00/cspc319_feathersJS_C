import { analyze as hookReturnValue } from './rules/hookReturnValue';
import { analyze as asyncAwaitUsage } from './rules/asyncAwaitUsage';
import { analyze as errorHandling } from './rules/errorHandling';
import { analyze as serviceMethodSignature } from './rules/serviceMethodSignature';
import { analyze as importPatterns } from './rules/importPatterns';
import { analyze as avoidAnyTypes } from './rules/avoidAnyTypes';
import { analyze as legacyHookParamName } from './rules/legacyHookParamName';
import { analyze as callbackStyle } from './rules/callbackStyle';
import { analyze as avoidNewPromise } from './rules/avoidNewPromise';
import { analyze as throwString } from './rules/throwString';

export interface RuleViolation {
  rule: string;
  line: number;
  message: string;
  suggestion: string;
}

type RuleCheck = (code: string) => RuleViolation[];

const ruleChecks: RuleCheck[] = [
  hookReturnValue,
  asyncAwaitUsage,
  errorHandling,
  serviceMethodSignature,
  importPatterns,
  avoidAnyTypes,
  legacyHookParamName,
  callbackStyle,
  avoidNewPromise,
  throwString,
];

/**
 * Best practice analyzer for FeathersJS v5 code.
 * Uses lightweight heuristics to flag common anti-patterns.
 */
export class BestPracticeAnalyzer {
  analyze(code: string): RuleViolation[] {
    return ruleChecks.flatMap((check) => check(code));
  }
}
