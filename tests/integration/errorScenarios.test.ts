import { sendMcpRequest, sendRawMcpRequest } from './helpers';
import { getIntegrationServer, resetIntegrationServer } from './setup';

describe('Integration error scenarios', () => {
  beforeEach(() => {
    resetIntegrationServer();
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

  test('returns invalid params for malformed tool arguments', async () => {
    const response = await sendMcpRequest('tools/call', {
      name: 'generate_service',
      arguments: {
        name: 'broken-service',
        database: 'mongodb',
        // fields is required and intentionally omitted
      },
    });

    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toContain('Invalid parameters');
  });

  test('returns timeout for slow handlers and keeps server usable', async () => {
    const context = getIntegrationServer();
    const originalTimeout = (context.router as unknown as { defaultTimeoutMs: number }).defaultTimeoutMs;

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

    const healthyResponse = await sendMcpRequest('tools/call', {
      name: 'list_available_tools',
      arguments: {},
    });

    expect(healthyResponse.error).toBeUndefined();
    expect((healthyResponse.result as { content: string }).content).toContain('Available tools');
  });
});
