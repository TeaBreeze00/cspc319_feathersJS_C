import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest, expectMcpResponse } from './helpers';
import { resetIntegrationServer } from './setup';
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
        prUrl: 'https://github.com/test/repo/pull/100',
        prNumber: 100,
        branch: 'docs/contrib/20260302T000000Z-full-flow-test',
      }),
      createRemovalPR: jest.fn().mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/test/repo/pull/101',
        prNumber: 101,
        branch: 'docs/contrib/20260302T000000Z-remove-test',
      }),
    })),
  };
});

// Mock global fetch for GitHub existence checks (remove/update tools)
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Full request flow integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetIntegrationServer();
    resetSubmitRate();
    resetRemoveRate();
    resetUpdateRate();

    mockFetch.mockResolvedValue({ ok: true });

    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: 'ghp_fullflowtoken',
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
        const loweredQuery = query.toLowerCase().trim();
        if (!loweredQuery) return [];

        const scored = docs
          .map((doc) => {
            const haystack = `${doc.heading} ${doc.rawContent}`.toLowerCase();
            const hits = loweredQuery
              .split(/\s+/)
              .filter((token) => token.length > 0)
              .filter((token) => haystack.includes(token)).length;
            return { id: doc.id, score: hits };
          })
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        if (scored.length === 0) return [];
        const max = scored[0].score;
        return scored.map((entry) => ({ id: entry.id, score: entry.score / max }));
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    mockFetch.mockReset();
  });

  // =========================================================================
  // search_docs
  // =========================================================================

  test('search_docs executes Protocol -> Routing -> Tool -> Knowledge flow', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'hooks', version: 'v6', limit: 3 },
    });

    expectMcpResponse(response, { id: response.id });
    expect(response.error).toBeUndefined();
    const result = response.result as { content: string; metadata: { tool: string } };
    const payload = JSON.parse(result.content) as {
      results: Array<{ id: string; heading: string }>;
    };
    expect(result.metadata.tool).toBe('search_docs');
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0]).toHaveProperty('heading');
  });

  test('unknown tool requests fail cleanly', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'get_feathers_template',
      arguments: { database: 'mongodb', auth: true, typescript: true },
    });

    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toContain('Unknown tool');
  });

  // =========================================================================
  // submit_documentation
  // =========================================================================

  test('submit_documentation executes full Protocol -> Routing -> Tool -> GitHub flow', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Add integration test guide for FeathersJS',
        filePath: 'docs/v6_docs/guides/integration-test.md',
        content:
          '# Integration Test Guide\n\n' +
          'This guide covers integration testing patterns in FeathersJS v6.\n\n' +
          '## Setup\n\nInstall the test dependencies and configure your test runner.\n\n' +
          '## Running Tests\n\nRun the test suite with `npm test`.\n\n' +
          'Additional text to meet the minimum length requirement for submissions.',
        version: 'v6',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toBeDefined();
    expect(parsed.prNumber).toBeDefined();
  });

  test('submit_documentation rejects invalid params through router', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        // Missing required fields
        title: 'x',
      },
    });

    // Router-level validation or tool-level validation catches it
    if (response.error) {
      expect(response.error.code).toBe(-32602);
    } else {
      const result = response.result as { content: string };
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(false);
    }
  });

  // =========================================================================
  // remove_documentation
  // =========================================================================

  test('remove_documentation executes full Protocol -> Routing -> Tool -> GitHub flow', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/cookbook/old-guide.md',
        version: 'v6',
        reason: 'This guide is outdated and has been superseded by the new guide.',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toBeDefined();
  });

  test('remove_documentation fails when file does not exist', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const response = await sendMcpRequest('tools/call', {
      name: 'remove_documentation',
      arguments: {
        filePath: 'docs/v6_docs/cookbook/nonexistent.md',
        version: 'v6',
        reason: 'This file should not exist and this removal should fail.',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(false);
    expect(parsed.errors.some((e: string) => /does not exist/i.test(e))).toBe(true);
  });

  // =========================================================================
  // update_documentation
  // =========================================================================

  test('update_documentation executes full Protocol -> Routing -> Tool -> GitHub flow', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Update hooks guide with around hook patterns',
        filePath: 'docs/v6_docs/guides/custom-hooks.md',
        content:
          '# Custom Hooks Guide (Updated)\n\n' +
          'This guide explains how to write custom hooks in FeathersJS v6.\n\n' +
          '## Around Hooks\n\nAround hooks wrap the entire service method.\n\n' +
          '## Before Hooks\n\nBefore hooks run before the service method.\n\n' +
          'Additional text to meet the minimum length requirement for update submissions.',
        version: 'v6',
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const parsed = JSON.parse(result.content);
    expect(parsed.success).toBe(true);
    expect(parsed.prUrl).toBeDefined();
  });

  test('update_documentation fails when file does not exist', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const response = await sendMcpRequest('tools/call', {
      name: 'update_documentation',
      arguments: {
        title: 'Update a guide that does not exist yet',
        filePath: 'docs/v6_docs/guides/nonexistent.md',
        content:
          '# Nonexistent Guide\n\n' +
          'This should fail because the file does not exist.\n\n' +
          '## Section\n\nMore text to meet the minimum length requirement for submissions.',
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
  // Network-tier gate — cross-tool verification
  // =========================================================================

  test('network tools are blocked when ALLOW_NETWORK_TOOLS is not set', async () => {
    delete process.env.ALLOW_NETWORK_TOOLS;

    const submitRes = await sendMcpRequest('tools/call', {
      name: 'submit_documentation',
      arguments: {
        title: 'Blocked submission attempt for testing',
        filePath: 'docs/v6_docs/guides/blocked.md',
        content:
          '# Blocked\n\nThis should be blocked by the network gate.\n\n' +
          '## Section\n\nMore text to meet the minimum length.',
        version: 'v6',
      },
    });

    // Network tools should be blocked at the router level
    expect(submitRes.error).toBeDefined();
    expect(submitRes.error!.message).toContain('network');
  });
});
