import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest } from '../integration/helpers';
import { resetIntegrationServer } from '../integration/setup';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Developer scenarios (E2E)', () => {
  beforeEach(() => {
    resetIntegrationServer();
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
});
