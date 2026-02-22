import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as prettier from 'prettier';

export interface PrettierCheckResult {
  formatted: boolean;
}

/**
 * Prettier-based validator/formatter that applies the project's config.
 */
export class PrettierValidator {
  private config: prettier.Options;

  constructor(cwd = process.cwd()) {
    this.config = this.loadConfig(cwd);
  }

  check(code: string): PrettierCheckResult {
    const options = this.withDefaults();
    const result = this.runPrettier('check', code, options) as { formatted: boolean };
    return { formatted: Boolean(result.formatted) };
  }

  format(code: string): string {
    const options = this.withDefaults();
    const result = this.runPrettier('format', code, options) as { formatted: string };
    return String(result.formatted);
  }

  private withDefaults(): prettier.Options {
    return {
      parser: 'typescript',
      ...this.config,
    };
  }

  private loadConfig(cwd: string): prettier.Options {
    const configPath = path.join(cwd, '.prettierrc');
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
      return {};
    }
  }

  private runPrettier(mode: 'check' | 'format', code: string, options: prettier.Options): unknown {
    const script = `
      const fs = require('fs');
      const prettier = require('prettier');
      (async () => {
        const input = JSON.parse(fs.readFileSync(0, 'utf8'));
        const { mode, code, options } = input;
        if (mode === 'check') {
          const formatted = await prettier.check(code, options);
          process.stdout.write(JSON.stringify({ formatted }));
          return;
        }
        const formatted = await prettier.format(code, options);
        process.stdout.write(JSON.stringify({ formatted }));
      })().catch((err) => {
        console.error(err && err.stack ? err.stack : String(err));
        process.exit(1);
      });
    `;

    const payload = JSON.stringify({ mode, code, options });
    const output = execFileSync(process.execPath, ['-e', script], {
      input: payload,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    return JSON.parse(output);
  }
}
