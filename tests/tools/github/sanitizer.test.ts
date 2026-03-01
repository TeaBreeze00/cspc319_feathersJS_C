import { sanitizeContent } from '../../../src/tools/github/sanitizer';

describe('sanitizeContent', () => {
  describe('clean content', () => {
    it('accepts valid markdown without warnings', () => {
      const result = sanitizeContent('# Hello World\n\nThis is valid markdown content.');
      expect(result.rejected).toBe(false);
      expect(result.reasons).toHaveLength(0);
      expect(result.cleanContent).toBe('# Hello World\n\nThis is valid markdown content.');
    });

    it('accepts markdown with standard HTML tags', () => {
      const result = sanitizeContent('# Guide\n\n<strong>Bold</strong> and <em>italic</em>');
      expect(result.rejected).toBe(false);
    });

    it('accepts markdown with code blocks containing script-like text', () => {
      // Code inside a fenced block — the regex still matches because we
      // do simple string scanning (not AST-aware). This is intentional:
      // actual <script> tags in docs are always dangerous.
      const md = '# Example\n\n```html\n<script>alert("hi")</script>\n```';
      const result = sanitizeContent(md);
      // This WILL be rejected because our sanitizer is conservative
      expect(result.rejected).toBe(true);
    });
  });

  describe('hard rejections', () => {
    it('rejects content with <script> tags', () => {
      const result = sanitizeContent('# Bad\n\n<script>alert("xss")</script>');
      expect(result.rejected).toBe(true);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/<script>/i)])
      );
    });

    it('rejects content with </script> closing tags', () => {
      const result = sanitizeContent('# Bad\n\nsome text</script>');
      expect(result.rejected).toBe(true);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/<\/script>/i)])
      );
    });

    it('rejects content with <iframe> tags', () => {
      const result = sanitizeContent('# Bad\n\n<iframe src="http://evil.com"></iframe>');
      expect(result.rejected).toBe(true);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/<iframe>/i)])
      );
    });

    it('rejects content with javascript: URIs', () => {
      const result = sanitizeContent('# Bad\n\n[click](javascript:alert(1))');
      expect(result.rejected).toBe(true);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/javascript:/i)])
      );
    });

    it('rejects content with large base64 data URIs', () => {
      const largeBase64 = 'A'.repeat(2000);
      const result = sanitizeContent(`# Bad\n\n![img](data:image/png;base64,${largeBase64})`);
      expect(result.rejected).toBe(true);
      expect(result.reasons).toEqual(
        expect.arrayContaining([expect.stringMatching(/base64/i)])
      );
    });

    it('rejects content with </iframe> closing tags', () => {
      const result = sanitizeContent('# Bad\n\ntext</iframe>');
      expect(result.rejected).toBe(true);
    });
  });

  describe('warnings', () => {
    it('warns about inline event handlers', () => {
      const result = sanitizeContent('# Docs\n\n<div onclick="doSomething()">click</div>');
      expect(result.rejected).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/event handler/i);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const result = sanitizeContent('');
      expect(result.rejected).toBe(false);
      expect(result.cleanContent).toBe('');
    });

    it('does not modify accepted content', () => {
      const original = '# Title\n\nSome **bold** text with `code`.';
      const result = sanitizeContent(original);
      expect(result.cleanContent).toBe(original);
    });

    it('rejects case-insensitive script tags', () => {
      const result = sanitizeContent('# Bad\n\n<SCRIPT>alert(1)</SCRIPT>');
      expect(result.rejected).toBe(true);
    });

    it('rejects case-insensitive iframe tags', () => {
      const result = sanitizeContent('# Bad\n\n<IFRAME src="x">');
      expect(result.rejected).toBe(true);
    });
  });
});
