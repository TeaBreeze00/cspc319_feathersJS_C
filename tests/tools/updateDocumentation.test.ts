import { UpdateDocumentationTool, _resetRateLimit } from '../../src/tools/updateDocumentation';
import { GitHubClient } from '../../src/tools/github/githubClient';

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
// Mock global fetch for GitHub API existence checks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function validParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Update the custom hooks guide with new patterns',
    filePath: 'docs/v6_docs/guides/custom-hooks.md',
    content:
      '# Custom Hooks Guide (Updated)\n\n' +
      'This guide explains how to write custom hooks in FeathersJS v6.\n\n' +
      '## Before Hooks\n\nBefore hooks run before the service method.\n\n' +
      '## After Hooks\n\nAfter hooks run after the service method.\n\n' +
      'Additional text to meet the minimum length requirement for this update submission.',
    version: 'v6',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UpdateDocumentationTool', () => {
  let tool: UpdateDocumentationTool;
  let mockGithubClient: jest.Mocked<GitHubClient>;
  const originalEnv = process.env;

  beforeEach(() => {
    _resetRateLimit();
    mockGithubClient = new GitHubClient() as jest.Mocked<GitHubClient>;
    tool = new UpdateDocumentationTool(mockGithubClient);

    // By default, mock fetch to return 200 (file exists in GitHub)
    mockFetch.mockResolvedValue({ ok: true });

    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'ghp_testtoken123',
      GITHUB_OWNER: 'testowner',
      GITHUB_REPO: 'testrepo',
      ALLOW_NETWORK_TOOLS: 'true',
    };

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
      expect(tool.name).toBe('update_documentation');
    });

    it('declares requiresNetwork = true', () => {
      expect(tool.requiresNetwork).toBe(true);
    });

    it('has a description mentioning existing documents', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description).toContain('existing');
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
      expect(reg.name).toBe('update_documentation');
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
      const result = await tool.execute(validParams({ category: 'nonexistent' }));
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
    it('rejects paths outside docs/', async () => {
      const result = await tool.execute(validParams({ filePath: 'src/evil.md' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /filePath/i.test(e))).toBe(true);
    });

    it('rejects path traversal', async () => {
      const result = await tool.execute(
        validParams({ filePath: 'docs/v6_docs/../../../etc/passwd.md' })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
    });

    it('rejects version mismatch', async () => {
      const result = await tool.execute(
        validParams({ filePath: 'docs/v5_docs/guide.md', version: 'v6' })
      );
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /mismatch/i.test(e))).toBe(true);
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
  });

  // =========================================================================
  // Stage 5: Existence check (inverted — must exist)
  // =========================================================================

  describe('Stage 5 — Existence check (must exist in GitHub)', () => {
    it('rejects update when doc does NOT exist in GitHub repo', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
      expect(parsed.errors.some((e: string) => /submit_documentation/i.test(e))).toBe(true);
    });

    it('accepts update when doc exists in GitHub repo', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/20',
        prNumber: 20,
        branch: 'docs/contrib/update-test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });

    it('always passes isUpdate = true to GitHub client', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/21',
        prNumber: 21,
        branch: 'docs/contrib/update-test',
      });

      await tool.execute(validParams());

      expect(mockGithubClient.createDocsPR).toHaveBeenCalledWith(
        expect.objectContaining({ isUpdate: true })
      );
    });
  });

  // =========================================================================
  // Stage 6: Rate limiting
  // =========================================================================

  describe('Stage 6 — Rate limiting', () => {
    it('allows the first update', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/22',
        prNumber: 22,
        branch: 'docs/contrib/update-test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });

    it('rate-limits a second update within 60 seconds', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/23',
        prNumber: 23,
        branch: 'docs/contrib/update-test',
      });

      await tool.execute(validParams());
      const result2 = await tool.execute(validParams());
      const parsed2 = JSON.parse(result2.content);
      expect(parsed2.success).toBe(false);
      expect(parsed2.errors.some((e: string) => /rate/i.test(e))).toBe(true);
    });
  });

  // =========================================================================
  // GitHub PR dispatch
  // =========================================================================

  describe('GitHub PR dispatch', () => {
    it('creates an update PR when GITHUB_TOKEN is set', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/24',
        prNumber: 24,
        branch: 'docs/contrib/update-hooks',
      });

      const result = await tool.execute(validParams({ contributorName: 'Test User' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.prUrl).toBe('https://github.com/test/pull/24');
      expect(parsed.message).toContain('update');
    });

    it('returns error when GitHub API fails', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: false,
        error: 'Failed to create PR: Network error',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Failed');
    });

    it('blocks update when ALLOW_NETWORK_TOOLS is not set', async () => {
      delete process.env.ALLOW_NETWORK_TOOLS;

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /ALLOW_NETWORK_TOOLS/i.test(e))).toBe(true);
    });
  });

  // =========================================================================
  // Bundled token fallback
  // =========================================================================

  describe('Local staging fallback', () => {
    beforeEach(() => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.GITHUB_OWNER;
      delete process.env.GITHUB_REPO;
      process.env.ALLOW_NETWORK_TOOLS = 'true';
    });

    it('uses the bundled token when GITHUB_TOKEN is not set', async () => {
      mockGithubClient.createDocsPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/TeaBreeze00/cspc319_feathersJS_C/pull/99',
        prNumber: 99,
        branch: 'docs/update-test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(mockGithubClient.createDocsPR).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'TeaBreeze00', repo: 'cspc319_feathersJS_C' })
      );
    });
  });
});
