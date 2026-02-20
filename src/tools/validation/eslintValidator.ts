/**
 * eslintValidator.ts
 *
 * Pattern-based ESLint-style validator for FeathersJS TypeScript code.
 *
 * Rather than shelling out to the ESLint CLI (which would require a config
 * file on disk and add significant latency), this module applies a curated
 * set of regex / AST-heuristic rules that cover the most common lint
 * violations seen in FeathersJS codebases.
 *
 * Each rule returns zero or more LintViolation objects so that callers get
 * the same structured output they would from a real ESLint run.
 */

import { ValidationError, ValidationResult } from './tsValidator';

// ---------------------------------------------------------------------------
// Internal rule type
// ---------------------------------------------------------------------------

interface LintRule {
  id: string;
  description: string;
  check: (code: string, lines: string[]) => ValidationError[];
}

// ---------------------------------------------------------------------------
// Individual lint rules
// ---------------------------------------------------------------------------

const rules: LintRule[] = [
  // ------------------------------------------------------------------
  // no-var: prefer const/let over var
  // ------------------------------------------------------------------
  {
    id: 'no-var',
    description: 'Unexpected var, use const or let instead.',
    check: (_code, lines) => {
      const errors: ValidationError[] = [];
      lines.forEach((line, i) => {
        if (/\bvar\s+\w/.test(line)) {
          errors.push({
            line: i + 1,
            column: line.indexOf('var') + 1,
            message: 'no-var: Unexpected var, use const or let instead.',
            severity: 'warning',
          });
        }
      });
      return errors;
    },
  },

  // ------------------------------------------------------------------
  // prefer-const: variable declared with let but never reassigned
  // (heuristic: let declarations whose name never appears again with =)
  // ------------------------------------------------------------------
  {
    id: 'prefer-const',
    description: 'prefer-const: Use const for variables that are never reassigned.',
    check: (_code, lines) => {
      const errors: ValidationError[] = [];
      lines.forEach((line, i) => {
        const m = line.match(/^\s*let\s+(\w+)\s*=\s*[^;]+;?\s*$/);
        if (!m) return;
        const name = m[1];
        // Look for reassignment in remaining lines
        const rest = lines.slice(i + 1).join('\n');
        const reassigned = new RegExp(`\\b${name}\\s*(?:=(?!=)|\\+\\=|\\-\\=|\\*\\=|\\/\\=)`).test(
          rest
        );
        if (!reassigned) {
          errors.push({
            line: i + 1,
            column: line.indexOf('let') + 1,
            message: `prefer-const: '${name}' is never reassigned; use const instead.`,
            severity: 'warning',
          });
        }
      });
      return errors;
    },
  },

  // ------------------------------------------------------------------
  // no-console: disallow console.log (allow console.error for MCP)
  // ------------------------------------------------------------------
  {
    id: 'no-console',
    description: 'no-console: Unexpected console.log statement.',
    check: (_code, lines) => {
      const errors: ValidationError[] = [];
      lines.forEach((line, i) => {
        if (/console\.log\s*\(/.test(line)) {
          errors.push({
            line: i + 1,
            column: line.indexOf('console') + 1,
            message: 'no-console: Unexpected console.log statement (use console.error instead).',
            severity: 'warning',
          });
        }
      });
      return errors;
    },
  },

  // ------------------------------------------------------------------
  // eqeqeq: require === instead of ==
  // ------------------------------------------------------------------
  {
    id: 'eqeqeq',
    description: 'eqeqeq: Expected === and instead saw ==.',
    check: (_code, lines) => {
      const errors: ValidationError[] = [];
      lines.forEach((line, i) => {
        // Match == but not === or !==
        const stripped = line.replace(/===|!==/g, '');
        const match = stripped.match(/[^!<>=]={2}(?!=)/);
        if (match) {
          errors.push({
            line: i + 1,
            column: (match.index ?? 0) + 2,
            message: 'eqeqeq: Expected === and instead saw ==.',
            severity: 'warning',
          });
        }
      });
      return errors;
    },
  },

  // ------------------------------------------------------------------
  // no-unused-vars: detect declared