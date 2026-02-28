import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest, expectMcpResponse } from './helpers';
import { resetIntegrationServer } from './setup';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Full request flow integration', () => {
  beforeEach(() => {
    resetIntegrationServer();
    mockedVectorSearch.search.mockImplementation(
      async (query: string, docs: DocEntry[], limit = 10): Promise<Array<{ id: string; score: number }>> => {
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

  test('search_docs executes Protocol -> Routing -> Tool -> Knowledge flow', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'search_docs',
      arguments: { query: 'hooks', version: 'v6', limit: 3 },
    });

    expectMcpResponse(response, { id: response.id });
    expect(response.error).toBeUndefined();
    const result = response.result as { content: string; metadata: { tool: string } };
    const payload = JSON.parse(result.content) as { results: Array<{ id: string; heading: string }> };
    expect(result.metadata.tool).toBe('search_docs');
    expect(Array.isArray(payload.results)).toBe(true);
    expect(payload.results.length).toBeGreaterThan(0);
    expect(payload.results[0]).toHaveProperty('heading');
  });

  test('generate_service returns a full service artifact set', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'generate_service',
      arguments: {
        name: 'notifications',
        database: 'mongodb',
        fields: [{ name: 'message', type: 'string', required: true }],
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const payload = JSON.parse(result.content) as {
      files: Record<string, { type: string; content: string }>;
    };
    expect(Object.keys(payload.files)).toContain('src/services/notifications/notifications.service.ts');
    expect(Object.keys(payload.files)).toContain('src/services/notifications/notifications.hooks.ts');
    expect(Object.keys(payload.files)).toContain('src/services/notifications/notifications.schema.ts');
  });

  test('validate_code returns structured validation output', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'validate_code',
      arguments: {
        code: 'const count: number = 1;\nconsole.log(count);',
        checks: ['typescript'],
      },
    });

    expect(response.error).toBeUndefined();
    const result = response.result as { content: string };
    const payload = JSON.parse(result.content) as {
      valid: boolean;
      results: { typescript?: { valid: boolean } };
    };
    expect(payload.valid).toBe(true);
    expect(payload.results.typescript?.valid).toBe(true);
  });

  test('legacy get_feathers_template requests fail cleanly (tool not implemented)', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'get_feathers_template',
      arguments: { database: 'mongodb', auth: true, typescript: true },
    });

    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toContain('Unknown tool');
  });
});
