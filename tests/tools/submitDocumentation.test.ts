import { SubmitDocumentationTool, _resetRateLimit } from '../../src/tools/submitDocumentation';
import { KnowledgeLoader } from '../../src/knowledge';
import { GitHubClient } from '../../src/tools/github/githubClient';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Mock GitHubClient
// ---------------------------------------------------------------------------

jest.mock('../../src/tools/github/githubClient', () => {
  return {
    GitHubClient: jest.fn().mockImplementation(() => ({
      createDocsPR: jest.fn(),
    })),
  };
});

// ---------------------------------------------------------------------------
// Mock global fetch for GitHub API duplication checks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function validParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Add a new Koa middleware guide for FeathersJS',
    filePath: 'docs/v6_docs/cookbook/koa-middleware.md',
    content:
      '# Koa Middleware Guide\n\n' +
      'This guide explains how to use Koa middleware with FeathersJS v6.\n\n' +
      '## Prerequisites\n\nYou need Node.js 20+ installed.\n\n' +
      '## Steps\n\n1. Install the package\n2. Configure it\n3. Run the server\n\n' +
      'Some more filler text to get past the minimum character requirement for this submission.',
    version: 'v6',
    ...overrides,
  };
}

// A minimal mock loader that returns no existing docs
function createMockLoader(docs: any[] = []): jest.Mocked<KnowledgeLoader> {
  return {
    load: jest.fn().mockResolvedValue(docs),
    preload: jest.fn(),
    clearCache: jest.fn(),
    buildIndex: jest.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubmitDocumentationTool', () => {
  let tool: SubmitDocumentationTool;
  let mockLoader: jest.Mocked<KnowledgeLoader>;
  let mockGithubClient: jest.Mocked<GitHubClient>;
  const originalEnv = process.env;

  beforeEach(() => {
    _resetRateLimit();
    mockLoader = createMockLoader();
    mockGithubClient = new GitHubClient() as jest.Mocked<GitHubClient>;
    tool = new SubmitDocumentationTool(mockLoader, mockGithubClient);

    // By default, mock fetch to return 404 (file does not exist = new submission)
    mockFetch.mockResolvedValue({ ok: false });

    // Set required env vars for the GitHub path
    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'ghp_testtoken123',
      GITHUB_OWNER: 'testowner',
      GITHUB_REPO: 'testrepo',
      ALLOW_NETWORK_TOOLS: 'true',
    };

    // Silence stderr
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    mockFetch.mockReset();
  });

  // =========================================================================
  // Tool metadata
  // =========================================================================

  describe('tool metadata', () => {
    it('has correct name', () => {
      expect(tool.name).toBe('submit_documentation');
    });

    it('declares requiresNetwork = true', () => {
      expect(tool.requiresNetwork).toBe(true);
    });

    it('has a description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(20);
    });

    it('has a valid input schema', () => {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('title');
      expect(tool.inputSchema.required).toContain('filePath');
      expect(tool.inputSchema.required).toContain('content');
      expect(tool.inputSchema.required).toContain('version');
    });

    it('register() includes requiresNetwork in the registration', () => {
      const reg = tool.register();
      expect(reg.requiresNetwork).toBe(true);
      expect(reg.name).toBe('submit_documentation');
      expect(typeof reg.handler).toBe('function');
    });
  });

  // =========================================================================
  // Stage 1: Schema validation
  // =========================================================================

  describe('Stage 1 — Schema validation', () => {
    it('rejects null params', async () => {
      const result = await tool.execute(null);
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
    });

    it('rejects missing title', async () => {
      const result = await tool.execute(validParams({ title: undefined }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /title/i.test(e))).toBe(true);
    });

    it('rejects title that is too short', async () => {
      const result = await tool.execute(validParams({ title: 'Short' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /title/i.test(e))).toBe(true);
    });

    it('rejects title that is too long', async () => {
      const result = await tool.execute(validParams({ title: 'A'.repeat(121) }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /title/i.test(e))).toBe(true);
    });

    it('rejects missing content', async () => {
      const result = await tool.execute(validParams({ content: undefined }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /content/i.test(e))).toBe(true);
    });

    it('rejects content that is too short', async () => {
      const result = await tool.execute(validParams({ content: '# Hi\n\nShort.' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /content/i.test(e))).toBe(true);
    });

    it('rejects invalid version', async () => {
      const result = await tool.execute(validParams({ version: 'v4' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /version/i.test(e))).toBe(true);
    });

    it('rejects invalid category', async () => {
      const result = await tool.execute(validParams({ category: 'invalid-category' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /category/i.test(e))).toBe(true);
    });

    it('accepts valid category', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/1',
        prNumber: 1,
        branch: 'docs/contrib/test',
      });

      const result = await tool.execute(validParams({ category: 'hooks' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });
  });

  // =========================================================================
  // Stage 2: Path restriction
  // =========================================================================

  describe('Stage 2 — Path restriction', () => {
    it('rejects paths outside docs/v5_docs and docs/v6_docs', async () => {
      const result = await tool.execute(validParams({ filePath: 'src/evil.md' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /filePath/i.test(e))).toBe(true);
    });

    it('rejects path traversal with ".."', async () => {
      const result = await tool.execute(
        validParams({ filePath: 'docs/v6_docs/../../../etc/passwd.md' })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
    });

    it('rejects double slashes', async () => {
      const result = await tool.execute(validParams({ filePath: 'docs/v6_docs//evil.md' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
    });

    it('rejects non-markdown files', async () => {
      const result = await tool.execute(validParams({ filePath: 'docs/v6_docs/evil.js' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
    });

    it('rejects version mismatch (v5 path, v6 version)', async () => {
      const result = await tool.execute(
        validParams({
          filePath: 'docs/v5_docs/guide.md',
          version: 'v6',
        })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /mismatch/i.test(e))).toBe(true);
    });

    it('rejects version mismatch (v6 path, v5 version)', async () => {
      const result = await tool.execute(
        validParams({
          filePath: 'docs/v6_docs/guide.md',
          version: 'v5',
        })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /mismatch/i.test(e))).toBe(true);
    });

    it('accepts valid nested paths', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/1',
        prNumber: 1,
        branch: 'docs/contrib/test',
      });

      const result = await tool.execute(
        validParams({ filePath: 'docs/v6_docs/api/authentication/jwt.md' })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });
  });

  // =========================================================================
  // Stage 3: Content sanitization
  // =========================================================================

  describe('Stage 3 — Content sanitization', () => {
    it('rejects content with <script> tags', async () => {
      const content =
        '# Guide\n\n<script>alert("xss")</script>\n\n' +
        'Some more content to meet the minimum length. '.repeat(5);
      const result = await tool.execute(validParams({ content }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /script/i.test(e))).toBe(true);
    });

    it('rejects content with <iframe> tags', async () => {
      const content =
        '# Guide\n\n<iframe src="http://evil.com"></iframe>\n\n' +
        'Some more content to meet the minimum length. '.repeat(5);
      const result = await tool.execute(validParams({ content }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /iframe/i.test(e))).toBe(true);
    });

    it('rejects content with javascript: URIs', async () => {
      const content =
        '# Guide\n\n[click me](javascript:alert(1))\n\n' +
        'Some more content to meet the minimum length. '.repeat(5);
      const result = await tool.execute(validParams({ content }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /javascript/i.test(e))).toBe(true);
    });
  });

  // =========================================================================
  // Stage 4: Markdown lint
  // =========================================================================

  describe('Stage 4 — Markdown lint', () => {
    it('rejects content without a top-level heading', async () => {
      const content =
        'No heading here, just paragraphs.\n\n' +
        'Some more content to meet the minimum length. '.repeat(5);
      const result = await tool.execute(validParams({ content }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /heading/i.test(e))).toBe(true);
    });

    it('rejects content that is mostly code blocks', async () => {
      const content = '# Title\n\n```typescript\n' + 'const x = 1;\n'.repeat(50) + '```';
      const result = await tool.execute(validParams({ content }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /short|prose/i.test(e))).toBe(true);
    });
  });

  // =========================================================================
  // Stage 5: Duplication detection
  // =========================================================================

  describe('Stage 5 — Duplication detection', () => {
    it('marks submission as update when filePath matches existing doc', async () => {
      const existingDocs = [
        {
          id: 'existing-doc',
          heading: 'Koa Middleware',
          content: 'old content',
          rawContent: 'old content',
          breadcrumb: 'Cookbook > Koa',
          version: 'v6',
          tokens: 100,
          category: 'cookbook',
          sourceFile: 'docs/v6_docs/cookbook/koa-middleware.md',
          hasCode: false,
          codeLanguages: [],
        },
      ];
      const loader = createMockLoader(existingDocs);
      const localTool = new SubmitDocumentationTool(loader, mockGithubClient);

      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/2',
        prNumber: 2,
        branch: 'docs/contrib/test',
      });

      const result = await localTool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.isUpdate).toBe(true);

      // Verify the GitHubClient was called with isUpdate = true
      expect(mockGithubClient.createDocsPR).toHaveBeenCalledWith(
        expect.objectContaining({ isUpdate: true })
      );
    });

    it('marks submission as new when filePath does not match', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/3',
        prNumber: 3,
        branch: 'docs/contrib/test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.isUpdate).toBe(false);
    });
  });

  // =========================================================================
  // Stage 6: Rate limiting
  // =========================================================================

  describe('Stage 6 — Rate limiting', () => {
    it('allows the first submission', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/4',
        prNumber: 4,
        branch: 'docs/contrib/test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });

    it('rate-limits a second submission within 60 seconds', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/5',
        prNumber: 5,
        branch: 'docs/contrib/test',
      });

      // First submission succeeds
      await tool.execute(validParams());

      // Second submission should be rate-limited
      const result = await tool.execute(
        validParams({ title: 'Another submission that should be limited' })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /rate limit/i.test(e))).toBe(true);
    });

    it('allows submission after rate limit reset', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/6',
        prNumber: 6,
        branch: 'docs/contrib/test',
      });

      // First submission
      await tool.execute(validParams());

      // Reset rate limit (simulates time passing)
      _resetRateLimit();

      // Second submission should succeed
      const result = await tool.execute(
        validParams({ title: 'After rate limit reset submission' })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });
  });

  // =========================================================================
  // GitHub PR dispatch
  // =========================================================================

  describe('GitHub PR dispatch', () => {
    it('returns error when ALLOW_NETWORK_TOOLS is not set (defense-in-depth gate)', async () => {
      // GITHUB_TOKEN is set (from beforeEach) but ALLOW_NETWORK_TOOLS is removed
      delete process.env.ALLOW_NETWORK_TOOLS;

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /ALLOW_NETWORK_TOOLS/i.test(e))).toBe(true);
    });

    it('returns PR details on success', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/testowner/testrepo/pull/10',
        prNumber: 10,
        branch: 'docs/contrib/20260301T143022Z-add-koa-middleware',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.prUrl).toBe('https://github.com/testowner/testrepo/pull/10');
      expect(parsed.prNumber).toBe(10);
      expect(parsed.branch).toMatch(/docs\/contrib\//);
      expect(result.metadata?.success).toBe(true);
    });

    it('passes correct parameters to GitHubClient', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/11',
        prNumber: 11,
        branch: 'docs/contrib/test',
      });

      await tool.execute(
        validParams({
          description: 'A detailed description',
          contributorName: 'Jane Doe',
          category: 'cookbook',
        })
      );

      expect(mockGithubClient.createDocsPR).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'ghp_testtoken123',
          owner: 'testowner',
          repo: 'testrepo',
          filePath: 'docs/v6_docs/cookbook/koa-middleware.md',
          title: 'Add a new Koa middleware guide for FeathersJS',
          description: 'A detailed description',
          contributorName: 'Jane Doe',
          version: 'v6',
          category: 'cookbook',
        })
      );
    });

    it('returns error on GitHub failure', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: false,
        error: 'Failed to create PR: Authentication failed.',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toMatch(/Authentication failed/);
    });
  });

  // =========================================================================
  // Offline fallback (local staging)
  // =========================================================================

  describe('Offline fallback — local staging', () => {
    let tmpDir: string;

    beforeEach(() => {
      // Remove GITHUB_TOKEN to trigger offline mode
      delete process.env.GITHUB_TOKEN;
      tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'mcp-test-'));

      // Override cwd so pending-contributions/ is created in the temp dir
      jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    });

    afterEach(() => {
      // Clean up temp files
      const stagingDir = path.join(tmpDir, 'pending-contributions');
      if (fs.existsSync(stagingDir)) {
        for (const file of fs.readdirSync(stagingDir)) {
          fs.unlinkSync(path.join(stagingDir, file));
        }
        fs.rmdirSync(stagingDir);
      }
      fs.rmdirSync(tmpDir);
    });

    it('saves submission locally when GITHUB_TOKEN is absent', async () => {
      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.mode).toBe('local-staging');
      expect(parsed.file).toMatch(/\.json$/);

      // Verify file was written
      const stagingDir = path.join(tmpDir, 'pending-contributions');
      const files = fs.readdirSync(stagingDir);
      expect(files.length).toBe(1);

      const payload = JSON.parse(fs.readFileSync(path.join(stagingDir, files[0]), 'utf-8'));
      expect(payload.title).toBe('Add a new Koa middleware guide for FeathersJS');
      expect(payload.filePath).toBe('docs/v6_docs/cookbook/koa-middleware.md');
      expect(payload.version).toBe('v6');
    });
  });

  // =========================================================================
  // validatePath unit tests
  // =========================================================================

  describe('validatePath()', () => {
    it('accepts valid v5 path with v5 version', () => {
      expect(tool.validatePath('docs/v5_docs/api/services.md', 'v5')).toEqual([]);
    });

    it('accepts valid v6 path with v6 version', () => {
      expect(tool.validatePath('docs/v6_docs/guides/basics/app.md', 'v6')).toEqual([]);
    });

    it('rejects paths with null bytes', () => {
      const errors = tool.validatePath('docs/v6_docs/test\0.md', 'v6');
      expect(errors.some((e) => /null/i.test(e))).toBe(true);
    });

    it('rejects paths with backslashes', () => {
      const errors = tool.validatePath('docs\\v6_docs\\test.md', 'v6');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects absolute paths', () => {
      const errors = tool.validatePath('/docs/v6_docs/test.md', 'v6');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // lintMarkdown unit tests
  // =========================================================================

  describe('lintMarkdown()', () => {
    it('accepts valid markdown with heading and prose', () => {
      const md = '# Title\n\nThis is a paragraph with enough text to pass the lint check easily.';
      expect(tool.lintMarkdown(md)).toEqual([]);
    });

    it('rejects markdown without any heading', () => {
      const md =
        'Just paragraphs without any heading at all, no matter how long they are in total.';
      const errors = tool.lintMarkdown(md);
      expect(errors.some((e) => /heading/i.test(e))).toBe(true);
    });

    it('rejects markdown with only code blocks', () => {
      const md = '# T\n\n```\n' + 'code\n'.repeat(100) + '```';
      const errors = tool.lintMarkdown(md);
      expect(errors.some((e) => /short|prose/i.test(e))).toBe(true);
    });
  });
});
