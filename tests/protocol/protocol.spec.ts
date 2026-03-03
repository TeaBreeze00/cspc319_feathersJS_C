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

describe('default registry exports all 4 tools', () => {
  // Re-import the pre-built registry that protocol/index.ts exports
  // We import lazily to avoid side-effects in other tests
  let registry: ToolRegistry;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const proto = require('../../src/protocol');
    registry = proto.registry;
  });

  test('registry contains search_docs', () => {
    expect(registry.has('search_docs')).toBe(true);
  });

  test('registry contains submit_documentation', () => {
    expect(registry.has('submit_documentation')).toBe(true);
  });

  test('registry contains remove_documentation', () => {
    expect(registry.has('remove_documentation')).toBe(true);
  });

  test('registry contains update_documentation', () => {
    expect(registry.has('update_documentation')).toBe(true);
  });

  test('listTools returns metadata for all 4 tools', async () => {
    const handler = listToolsHandler(registry);
    const res = await handler();

    expect(res.tools.length).toBe(4);
    const names = res.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'remove_documentation',
      'search_docs',
      'submit_documentation',
      'update_documentation',
    ]);
  });
});
