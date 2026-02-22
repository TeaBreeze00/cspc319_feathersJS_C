import * as path from 'node:path';
import { ESLint } from 'eslint';
import { LegacyESLint } from 'eslint/use-at-your-own-risk';

export interface LintError {
  line: number;
  column: number;
  message: string;
  ruleId?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  errors?: LintError[];
}

/**
 * ESLint-based validator that runs entirely in-memory and respects
 * the project's ESLint configuration.
 */
export class ESLintValidator {
  private eslint: ESLint | LegacyESLint;
  private cwd: string;

  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.eslint = this.createESLint();
  }

  async validate(code: string, filename = 'input.ts'): Promise<ValidationResult> {
    const filePath = path.isAbsolute(filename)
      ? filename
      : path.resolve(this.cwd, this.normalizeFilename(filename));

    try {
      const results = await this.eslint.lintText(code, { filePath });
      const messages = results.flatMap((result) => result.messages);
      const errors: LintError[] = messages.map((message) => ({
        line: message.line ?? 1,
        column: message.column ?? 1,
        message: message.message,
        ruleId: message.ruleId ?? undefined,
        severity: this.mapSeverity(message.severity),
      }));

      if (errors.length === 0) {
        return { valid: true };
      }

      return { valid: false, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [
          {
            line: 1,
            column: 1,
            message,
            severity: 'error',
          },
        ],
      };
    }
  }

  private createESLint(): ESLint | LegacyESLint {
    const configPath = path.resolve(this.cwd, '.eslintrc.json');
    return new LegacyESLint({
      cwd: this.cwd,
      overrideConfigFile: configPath,
      errorOnUnmatchedPattern: false,
    });
  }

  private normalizeFilename(filename: string): string {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
      return filename;
    }
    return `${filename}.ts`;
  }

  private mapSeverity(severity: number | undefined): 'error' | 'warning' | 'info' {
    if (severity === 2) return 'error';
    if (severity === 1) return 'warning';
    return 'info';
  }
}
