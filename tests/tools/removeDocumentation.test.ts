import { RemoveDocumentationTool, _resetRateLimit } from '../../src/tools/removeDocumentation';
import { GitHubClient } from '../../src/tools/github/githubClient';

// ---------------------------------------------------------------------------
// Mock GitHubClient
// ---------------------------------------------------------------------------

jest.mock('../../src/tools/github/githubClient', () => {
  return {
    GitHubClient: jest.fn().mockImplementation(() => ({
      createRemovalPR: jest.fn(),
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
    filePath: 'docs/v6_docs/cookbook/old-guide.md',
    version: 'v6',
    reason: 'This guide is outdated and has been superseded by the new guide.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RemoveDocumentationTool', () => {
  let tool: RemoveDocumentationTool;
  let mockGithubClient: jest.Mocked<GitHubClient>;
  const originalEnv = process.env;

  beforeEach(() => {
    _resetRateLimit();
    mockGithubClient = new GitHubClient() as jest.Mocked<GitHubClient>;
    tool = new RemoveDocumentationTool(mockGithubClient);

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
      expect(tool.name).toBe('remove_documentation');
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
      expect(tool.inputSchema.required).toContain('filePath');
      expect(tool.inputSchema.required).toContain('version');
      expect(tool.inputSchema.required).toContain('reason');
    });

    it('register() includes requiresNetwork in the registration', () => {
      const reg = tool.register();
      expect(reg.requiresNetwork).toBe(true);
      expect(reg.name).toBe('remove_documentation');
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

    it('rejects missing filePath', async () => {
      const result = await tool.execute(validParams({ filePath: undefined }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /filePath/i.test(e))).toBe(true);
    });

    it('rejects invalid version', async () => {
      const result = await tool.execute(validParams({ version: 'v4' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /version/i.test(e))).toBe(true);
    });

    it('rejects missing reason', async () => {
      const result = await tool.execute(validParams({ reason: undefined }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /reason/i.test(e))).toBe(true);
    });

    it('rejects reason that is too short', async () => {
      const result = await tool.execute(validParams({ reason: 'Too short' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /reason/i.test(e))).toBe(true);
    });

    it('rejects reason that is too long', async () => {
      const result = await tool.execute(validParams({ reason: 'A'.repeat(501) }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /reason/i.test(e))).toBe(true);
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

    it('rejects path traversal with ".."', async () => {
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
  // Stage 3: Existence check
  // =========================================================================

  describe('Stage 3 — Existence check (GitHub API)', () => {
    it('rejects removal when doc does not exist in GitHub repo', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
    });

    it('accepts removal when doc exists in GitHub repo', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      (mockGithubClient as any).createRemovalPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/10',
        prNumber: 10,
        branch: 'docs/contrib/remove-test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });

    it('rejects removal when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
    });
  });

  // =========================================================================
  // Stage 4: Rate limiting
  // =========================================================================

  describe('Stage 4 — Rate limiting', () => {
    it('allows the first removal', async () => {
      (mockGithubClient as any).createRemovalPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/11',
        prNumber: 11,
        branch: 'docs/contrib/remove-test',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
    });

    it('rate-limits a second removal within 60 seconds', async () => {
      (mockGithubClient as any).createRemovalPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/12',
        prNumber: 12,
        branch: 'docs/contrib/remove-test',
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
    it('creates a removal PR when GITHUB_TOKEN is set', async () => {
      (mockGithubClient as any).createRemovalPR.mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/pull/13',
        prNumber: 13,
        branch: 'docs/contrib/remove-old-guide',
      });

      const result = await tool.execute(validParams({ contributorName: 'Test User' }));
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.prUrl).toBe('https://github.com/test/pull/13');
      expect(parsed.prNumber).toBe(13);

      expect((mockGithubClient as any).createRemovalPR).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: 'docs/v6_docs/cookbook/old-guide.md',
          reason: expect.any(String),
          version: 'v6',
          contributorName: 'Test User',
        })
      );
    });

    it('returns error when GitHub API fails', async () => {
      (mockGithubClient as any).createRemovalPR.mockResolvedValue({
        success: false,
        error: 'Failed to create removal PR: Network error',
      });

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Failed');
    });

    it('blocks removal when ALLOW_NETWORK_TOOLS is not set', async () => {
      delete process.env.ALLOW_NETWORK_TOOLS;

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
      expect(parsed.errors.some((e: string) => /ALLOW_NETWORK_TOOLS/i.test(e))).toBe(true);
    });
  });

  // =========================================================================
  // Local staging (no GITHUB_TOKEN)
  // =========================================================================

  describe('Local staging fallback', () => {
    beforeEach(() => {
      delete process.env.GITHUB_TOKEN;
    });

    it('stages removal locally when GITHUB_TOKEN is not set', async () => {
      // Mock fs to avoid actually writing files
      const mkdirSpy = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      const writeSpy = jest.spyOn(require('fs'), 'writeFileSync').mockImplementation(() => {});

      const result = await tool.execute(validParams());
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.mode).toBe('local-staging');
      expect(parsed.file).toContain('remove-');

      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });
});
