/// <reference types="jest" />

import { ToolRegistry, listToolsHandler, callToolHandler } from '../../src/protocol';

describe('protocol handlers', () => {
  test('listTools returns registered tools', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'echo',
      description: 'Echo tool',
      inputSchema: { type: 'string' },
      handler: async (args: unknown) => ({ content: String(args ?? '') }),
    });

    const handler = listToolsHandler(registry);
    const res = await handler();

    expect(res.tools).toHaveLength(1);
    expect(res.tools[0].name).toBe('echo');
    expect(res.tools[0].description).toBe('Echo tool');
  });

  test('callTool invokes handler and returns ToolResult', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'sum',
      description: 'Sum numbers',
      inputSchema: { type: 'array' },
      handler: async (params: unknown) => {
        const nums = Array.isArray(params) ? (params as number[]) : [];
        const sum = nums.reduce((a, b) => a + b, 0);
        return { content: String(sum) };
      },
    });

    const handler = callToolHandler(registry);
    const res = await handler({ name: 'sum', arguments: [1, 2, 3] });

    expect(res).toBeDefined();
    expect(res.content).toBe('6');
  });
});
