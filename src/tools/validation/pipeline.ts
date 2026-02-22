import { TypeScriptValidator, ValidationResult as TsValidationResult } from './tsValidator';
import { ESLintValidator, ValidationResult as LintValidationResult } from './eslintValidator';
import { PrettierValidator, PrettierCheckResult } from './prettierValidator';
import { BestPracticeAnalyzer, RuleViolation } from './bestPracticeRules';

export interface ValidationOptions {
  typescript?: boolean;
  eslint?: boolean;
  prettier?: boolean;
  bestPractices?: boolean;
}

export interface PipelineResult {
  valid: boolean;
  typescript?: TsValidationResult;
  eslint?: LintValidationResult;
  prettier?: PrettierCheckResult;
  bestPractices?: RuleViolation[];
  formattedCode?: string;
}

/**
 * Validation pipeline chaining TypeScript, ESLint, Prettier, and best practices.
 */
export interface PipelineConfig {
  typeCheck?: boolean;
}

export class ValidationPipeline {
  private tsValidator: TypeScriptValidator;
  private eslintValidator = new ESLintValidator();
  private prettierValidator = new PrettierValidator();
  private bestPracticeAnalyzer = new BestPracticeAnalyzer();

  constructor(config: PipelineConfig = {}) {
    this.tsValidator = new TypeScriptValidator({ typeCheck: config.typeCheck });
  }

  async validate(code: string, options: ValidationOptions = {}): Promise<PipelineResult> {
    const enabled: Required<ValidationOptions> = {
      typescript: options.typescript !== false,
      eslint: options.eslint !== false,
      prettier: options.prettier !== false,
      bestPractices: options.bestPractices !== false,
    };

    const result: PipelineResult = { valid: true };

    if (enabled.typescript) {
      const tsResult = this.tsValidator.validate(code);
      result.typescript = tsResult;
      if (!tsResult.valid) {
        result.valid = false;
        return result;
      }
    }

    if (enabled.eslint) {
      const eslintResult = await this.eslintValidator.validate(code);
      result.eslint = eslintResult;
      if (!eslintResult.valid) {
        result.valid = false;
      }
    }

    if (enabled.prettier) {
      const prettierResult = this.prettierValidator.check(code);
      result.prettier = prettierResult;
      if (!prettierResult.formatted) {
        result.valid = false;
        result.formattedCode = this.prettierValidator.format(code);
      }
    }

    if (enabled.bestPractices) {
      const violations = this.bestPracticeAnalyzer.analyze(code);
      result.bestPractices = violations;
      if (violations.length > 0) {
        result.valid = false;
      }
    }

    return result;
  }
}
