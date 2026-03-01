/**
 * sanitizer.ts
 *
 * Content sanitization for contributor documentation submissions.
 * Detects and rejects dangerous content (XSS, iframes, JS URIs, large data URIs).
 */

export interface SanitizationResult {
  /** The content after sanitization (unchanged — we accept or reject, never modify). */
  cleanContent: string;
  /** True if the content must be rejected. */
  rejected: boolean;
  /** Rejection reasons (only populated when rejected === true). */
  reasons: string[];
  /** Non-blocking warnings (content is allowed but flagged). */
  warnings: string[];
}

/**
 * Validate markdown content for dangerous patterns.
 * Content is never silently modified — it is either accepted or rejected.
 */
export function sanitizeContent(raw: string): SanitizationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Hard rejections — malicious content
  if (/<script[\s>]/i.test(raw)) {
    reasons.push('Content contains <script> tags');
  }
  if (/<\/script>/i.test(raw)) {
    reasons.push('Content contains </script> closing tags');
  }
  if (/<iframe[\s>]/i.test(raw)) {
    reasons.push('Content contains <iframe> tags');
  }
  if (/javascript\s*:/i.test(raw)) {
    reasons.push('Content contains javascript: URIs');
  }
  if (/data:[^;]+;base64,.{1024,}/i.test(raw)) {
    reasons.push('Content contains large base64 data URIs (>1KB)');
  }
  if (/<\/iframe>/i.test(raw)) {
    reasons.push('Content contains </iframe> closing tags');
  }
  if (/on\w+\s*=\s*["'][^"']*["']/i.test(raw)) {
    // Detect inline event handlers like onclick="..." onerror="..."
    warnings.push('Content may contain inline event handlers (e.g., onclick)');
  }

  return {
    cleanContent: raw,
    rejected: reasons.length > 0,
    reasons,
    warnings,
  };
}
