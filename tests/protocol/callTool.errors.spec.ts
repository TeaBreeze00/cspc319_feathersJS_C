/// <reference types="jest" />

import { ToolRegistry, callToolHandler } from '../../src/protocol';

describe('callTool error cases', () => {
  test('throws when name is missing', async () => {
    const registry = new ToolRegistry();
    const handler = callToolHandler(registry as any);

    await expect(handler({} as any)).rejects.toThrow('Missing tool name');
  });

  test('throws when tool is unknown', async () => {
    const registry = new ToolRegistry();
    const handler = callToolHandler(registry as any);

    await expect(handler({ name: 'does-not-exist' } as any)).rejects.toThrow('Unknown tool');
  });
});
