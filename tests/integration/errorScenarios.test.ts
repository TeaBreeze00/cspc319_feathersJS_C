// tests/integration/errorScenarios.test.ts
import { DocEntry } from '../../src/knowledge/types';
import { sendMcpRequest, sendRawMcpRequest } from './helpers';
import { getIntegrationServer, resetIntegrationServer } from './setup';
import * as vectorSearchModule from '../../src/tools/search/vectorSearch';

jest.mock('../../src/tools/search/vectorSearch', () => ({
  vectorSearch: {
    search: jest.fn(),
  },
}));

const mockedVectorSearch = vectorSearchModule.vectorSearch as jest.Mocked<
  typeof vectorSearchModule.vectorSearch
>;

describe('Integration error scenarios', () => {
  beforeEach(() => {
    resetIntegrationServer();
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
});
