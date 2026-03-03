// tests/integration/errorScenarios.test.ts
import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest, sendRawMcpRequest } from './helpers';
import { getIntegrationServer, resetIntegrationServer } from './setup';
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
        prUrl: 'https://github.com/test/repo/pull/300',
        prNumber: 300,
        branch: 'docs/contrib/error-test',
      }),
      createRemovalPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/301',
        prNumber: 301,
        branch: 'docs/contrib/remove-error-test',
      }),
    })),
  };
});

// Mock global fetch for remove/update existence checks
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Integration error scenarios', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetIntegrationServer();
    resetSubmitRate();
    resetRemoveRate();
    resetUpdateRate();

    mockFetch.mockResolvedValue({ ok: true });

    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'ghp_errortest',
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
        const hits = docs
          .map((doc) => ({
            id: doc.id,
            score: `${doc.heading} ${doc.rawContent}`.toLowerCase().includes(q) ? 1 : 0,
          }))
          .filter((entry) => entry.score > 0)
          .slice(0, limit);
        return hits;
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    mockFetch.mockReset();
  });

  test('returns parse error for malformed JSON-RPC payload', async () => {
    const response = await sendRawMcpRequest('{"jsonrpc":"2.0","id":1,"method":"tools/list",');
    expect(response.error?.code).toBe(-32700);
    expect(response.error?.message).toContain('Parse error');
  });

  test('returns method/tool not found for unknown tool names', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'unknown_tool_name',
      arguments: {},
    });

    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toContain('Unknown tool');
  });

  test('returns invalid params for malformed search_docs arguments', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: {
        // query is required and intentionally omitted
        version: 'v6',
      },
    });

    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toContain('Invalid parameters');
  });

  test('returns timeout for slow handlers and keeps server usable', async () => {
    const context = getIntegrationServer();
    const originalTimeout = (context.router as unknown as { defaultTimeoutMs: number })
      .defaultTimeoutMs;

    const slowToolName = `slow_tool_${Date.now()}`;
    context.routingRegistry.register(
      slowToolName,
      async () =>
        await new Promise((resolve) => {
          setTimeout(() => resolve({ content: 'too slow' }), 80);
        }),
      { type: 'object', additionalProperties: true }
    );

    (context.router as unknown as { defaultTimeoutMs: number }).defaultTimeoutMs = 20;

    const timeoutResponse = await sendMcpRequest('tools/call', {
      name: slowToolName,
      arguments: {},
    });

    expect(timeoutResponse.error?.code).toBe(-32001);
    expect(timeoutResponse.error?.message).toContain('timed out');

    (context.router as unknown as { defaultTimeoutMs: number }).defaultTimeoutMs = originalTimeout;

    // Verify server is still healthy after timeout
    const healthyResponse = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'hooks', version: 'v6' },
    });

    expect(healthyResponse.error).toBeUndefined();
  });

  // =========================================================================
  // Network-tier gate error scenarios
  // =========================================================================

  test('submit_documentation blocked when ALLOW_NETWORK_TOOLS is unset', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const response = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Blocked submission for error scenario',
        filePath: 'docs/v6_docs/guides/blocked.md',
        content:
          '# Blocked\n\nShould be blocked by network gate.\n\n' +
          '## Section\n\nMore text to meet minimum length requirement.',
        version: 'v6',
      },
    });

    expect(response.error).toBeDefined();
    expect(response.error!.message).toContain('network');
  });

  test('remove_documentation blocked when ALLOW_NETWORK_TOOLS is unset', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const response = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/cookbook/blocked.md',
        version: 'v6',
        reason: 'Should be blocked by the network gate.',
      },
    });

    expect(response.error).toBeDefined();
    expect(response.error!.message).toContain('network');
  });

  test('update_documentation blocked when ALLOW_NETWORK_TOOLS is unset', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const response = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Blocked update for error scenario test',
        filePath: 'docs/v6_docs/guides/blocked.md',
        content:
          '# Blocked\n\nShould be blocked by network gate.\n\n' +
          '## Section\n\nMore text to meet minimum length requirement.',
        version: 'v6',
      },
    });

    expect(response.error).toBeDefined();
    expect(response.error!.message).toContain('network');
  });

  // =========================================================================
  // Tool-level validation error scenarios
  // =========================================================================

  test('submit_documentation rejects content with script tags', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Malicious content submission attempt',
        filePath: 'docs/v6_docs/guides/xss.md',
        content:
          '# XSS\n\n<script>alert("xss")</script>\n\n' +
          'Some more content to meet the minimum length. '.repeat(5),
        version: 'v6',
      },
    });

    // Tool handles it gracefully (returns result, not an error)
    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /script/i.test(e))).toBe(true);
  });

  test('remove_documentation rejects when file does not exist', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const response = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/cookbook/nonexistent.md',
        version: 'v6',
        reason: 'Trying to remove a file that does not exist.',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
  });

  test('update_documentation rejects when file does not exist', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const response = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Update to non-existent documentation file',
        filePath: 'docs/v6_docs/guides/nonexistent.md',
        content:
          '# Nonexistent\n\nThis should fail because the file is new.\n\n' +
          '## Section\n\nMore text to meet the minimum length requirement.',
        version: 'v6',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
  });
});
