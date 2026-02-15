import { ToolError } from './types';
import { TimeoutError } from './timeout';

function sanitizeStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  // Remove file paths and line numbers, keep basic call structure
  return stack
    .split('\n')
    .map((line) => line.replace(/\((?:[^)\\]*[\\/])?([^:\)]+:\d+:\d+)\)/g, '(<redacted>)'))
    .map((line) => line.replace(/\s+at\s+([^\s]+)\s+/g, ' at $1 '))
    .join('\n');
}

export class ErrorHandler {
  handle(err: unknown): ToolError {
    const e = err as any;

    // Log full error to stderr for operators
    try {
      // Keep console.error on stderr per guardrail
      console.error('[ErrorHandler] full error:', e);
    } catch (logErr) {
      // ignore logging failures
    }

    // Validation errors (from validator) may be plain objects with `errors` array
    if (e && (e.name === 'ValidationError' || (Array.isArray(e.errors) && e.errors.length > 0))) {
      return {
        code: 'INVALID_PARAMS',
        message: e.message || 'Invalid parameters',
        details: { errors: e.errors },
      };
    }

    // Timeouts
    if (e instanceof TimeoutError || (e && e.code === 'TIMEOUT')) {
      return {
        code: 'TIMEOUT',
        message: e.message || 'Operation timed out',
      };
    }

    // Unknown/internal errors
    return {
      code: 'INTERNAL_ERROR',
      message: (e && e.message) || 'Internal error',
      details: { stack: sanitizeStack(e && e.stack) },
    };
  }
}

export default ErrorHandler;
