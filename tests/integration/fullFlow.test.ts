import { DocEntry } from '../../src/knowledge/types';
import { expectMcpResponse, sendMcpRequest } from './helpers';
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

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Integration smoke flow', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetIntegrationServer();
    resetSubmitRate();
    resetRemoveRate();
    resetUpdateRate();

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

        return docs
          .map((doc) => ({
            id: doc.id,
            score: `${doc.heading} ${doc.rawContent}`.toLowerCase().includes(loweredQuery) ? 1 : 0,
          }))
          .filter((entry) => entry.score > 0)
          .slice(0, limit);
      }
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    mockedVectorSearch.search.mockReset();
  });

  test('tools/list exposes the 4 current tools through the JSON-RPC harness', async () => {
    const response = await sendMcpRequest('tools/list');

    expectMcpResponse(response, { id: response.id });
    expect(response.error).toBeUndefined();

    const result = response.result as {
      tools: Array<{ name: string; description: string }>;
    };

    expect(result.tools).toHaveLength(4);
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      'remove_documentation',
      'search_docs',
      'submit_documentation',
      'update_documentation',
    ]);
  });

  test('search_docs executes the integration harness against the current tool chain', async () => {
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
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0]).toHaveProperty('heading');
  });

  test('unknown tool requests fail cleanly through the integration harness', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'get_feathers_template',
      arguments: { database: 'mongodb', auth: true, typescript: true },
    });

    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toContain('Unknown tool');
  });

  test('network tools stay blocked when ALLOW_NETWORK_TOOLS is not set', async () => {
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

    expect(submitRes.error).toBeDefined();
    expect(submitRes.error!.message).toContain('network');
  });
});
