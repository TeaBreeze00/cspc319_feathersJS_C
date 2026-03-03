import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest } from '../integration/helpers';
import { resetIntegrationServer } from '../integration/setup';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';
import { _resetRateLimit as resetSubmitRate } from '../../src/tools/submitDocumentation';
import { _resetRateLimit as resetRemoveRate } from '../../src/tools/removeDocumentation';
import { _resetRateLimit as resetUpdateRate } from '../../src/tools/updateDocumentation';

jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

jest.mock('../../src/tools/github/githubClient', () => {
  return {
    GitHubClient: jest.fn().mockImplementation(() => ({
      createDocsPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/200',
        prNumber: 200,
        branch: 'docs/contrib/20260302T000000Z-e2e-test',
      }),
      createRemovalPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/201',
        prNumber: 201,
        branch: 'docs/contrib/20260302T000000Z-remove-e2e',
      }),
    })),
  };
});

// Mock global fetch for GitHub existence checks
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Developer scenarios (E2E)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetIntegrationServer();
    resetSubmitRate();
    resetRemoveRate();
    resetUpdateRate();

    mockFetch.mockResolvedValue({ ok: true });

    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'ghp_e2etoken',
      GITHUB_OWNER: 'testowner',
      GITHUB_REPO: 'testrepo',
      ALLOW_NETWORK_TOOLS: 'true',
    };

    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockedVectorSearch.search.mockImplementation(
      async (
        query: string,
        docs: DocEntry[],
        limit = 10
      ): Promise<Array<{ id: string; score: number }>> => {
        const q = query.toLowerCase();
        const matches = docs
          .map((doc) => ({
            id: doc.id,
            score: `${doc.heading} ${doc.rawContent}`.toLowerCase().includes(q) ? 1 : 0,
          }))
          .filter((entry) => entry.score > 0)
          .slice(0, limit);
        return matches;
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    mockFetch.mockReset();
  });

  // =========================================================================
  // Search scenarios
  // =========================================================================

  test('search docs for hooks returns relevant results', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'hooks', version: 'v6', limit: 5 },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const payload = JSON.parse(result.content) as {
      results: Array<{ id: string; heading: string }>;
    };
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0]).toHaveProperty('heading');
  });

  test('search docs for services returns relevant results', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'services', version: 'all', limit: 5 },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const payload = JSON.parse(result.content) as { results: Array<{ id: string }> };
    expect(payload.results.length).toBeGreaterThan(0);
  });

  test('search docs for authentication returns relevant results', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'authentication jwt', version: 'v6', limit: 3 },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const payload = JSON.parse(result.content) as { results: Array<{ id: string }> };
    expect(Array.isArray(payload.results)).toBe(true);
  });

  test('unknown tool returns clean error', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'generate_service',
      arguments: { name: 'tasks' },
    });

    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toContain('Unknown tool');
  });

  // =========================================================================
  // Contributor submission scenario
  // =========================================================================

  test('contributor submits new documentation via PR', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Add a comprehensive Koa middleware guide',
        filePath: 'docs/v6_docs/cookbook/koa-middleware.md',
        content:
          '# Koa Middleware Guide\n\n' +
          'This guide explains how to use Koa middleware with FeathersJS v6.\n\n' +
          '## Prerequisites\n\nYou need Node.js 20+ installed.\n\n' +
          '## Steps\n\n1. Install the package\n2. Configure it\n3. Run the server\n\n' +
          'Additional text to meet the minimum length requirement for documentation.',
        version: 'v6',
        category: 'cookbook',
        contributorName: 'E2E Test User',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toContain('github.com');
    expect(parsed.prNumber).toBeGreaterThan(0);
  });

  test('contributor submission with invalid content is rejected', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Submit with malicious content for testing',
        filePath: 'docs/v6_docs/guides/xss-test.md',
        content:
          '# XSS Test\n\n<script>alert("xss")</script>\n\n' +
          'Some more content to meet the minimum length. '.repeat(5),
        version: 'v6',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /script/i.test(e))).toBe(true);
  });

  // =========================================================================
  // Contributor removal scenario
  // =========================================================================

  test('contributor requests removal of outdated documentation', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/cookbook/deprecated-guide.md',
        version: 'v6',
        reason: 'This guide covers a deprecated API that was removed in FeathersJS v6.',
        contributorName: 'E2E Cleanup User',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toContain('github.com');
  });

  test('contributor removal fails for non-existent file', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const response = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/guides/does-not-exist.md',
        version: 'v6',
        reason: 'Attempting to remove a file that does not exist for testing.',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
  });

  // =========================================================================
  // Contributor update scenario
  // =========================================================================

  test('contributor updates existing documentation via PR', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Update hooks guide with around hook examples',
        filePath: 'docs/v6_docs/guides/custom-hooks.md',
        content:
          '# Custom Hooks (Updated)\n\n' +
          'This guide explains the updated hook patterns in FeathersJS v6.\n\n' +
          '## Around Hooks\n\nAround hooks wrap service methods.\n\n' +
          '## Before & After Hooks\n\nClassic hook patterns.\n\n' +
          'Additional text to meet the minimum length requirement for updates.',
        version: 'v6',
        category: 'hooks',
        contributorName: 'E2E Update User',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toContain('github.com');
  });

  test('contributor update fails when file does not exist', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const response = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Update a guide that does not exist yet',
        filePath: 'docs/v6_docs/guides/nonexistent.md',
        content:
          '# Nonexistent Guide\n\n' +
          'This should fail because the file does not exist in the repo.\n\n' +
          '## Section\n\nMore text to meet the minimum length for updates.',
        version: 'v6',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
  });

  // =========================================================================
  // Cross-cutting: network gate blocks all contributor tools
  // =========================================================================

  test('all contributor tools blocked when ALLOW_NETWORK_TOOLS is unset', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const submitRes = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Blocked submission during E2E testing',
        filePath: 'docs/v6_docs/guides/blocked.md',
        content: '# Blocked\n\nShould be blocked.\n\n## Section\n\nMore text for minimum length.',
        version: 'v6',
      },
    });
    expect(submitRes.error).toBeDefined();
    expect(submitRes.error!.message).toContain('network');

    const removeRes = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/cookbook/blocked.md',
        version: 'v6',
        reason: 'Should be blocked by the network gate during E2E.',
      },
    });
    expect(removeRes.error).toBeDefined();
    expect(removeRes.error!.message).toContain('network');

    const updateRes = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Blocked update during E2E testing run',
        filePath: 'docs/v6_docs/guides/blocked.md',
        content: '# Blocked\n\nShould be blocked.\n\n## Section\n\nMore text for minimum length.',
        version: 'v6',
      },
    });
    expect(updateRes.error).toBeDefined();
    expect(updateRes.error!.message).toContain('network');
  });
});
