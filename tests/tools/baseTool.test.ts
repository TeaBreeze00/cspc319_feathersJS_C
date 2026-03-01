import { BaseTool } from '../../src/tools/baseTool';
import { ToolResult, JsonSchema } from '../../src/protocol/types';

// Concrete test tool that does NOT require network (default)
class LocalTool extends BaseTool {
  name = 'local_test';
  description = 'A tool that does not require network';
  inputSchema: JsonSchema = { type: 'object', properties: {} };

  async execute(_params: unknown): Promise<ToolResult> {
    return { content: 'local result' };
  }
}

// Concrete test tool that DOES require network
class NetworkTool extends BaseTool {
  name = 'network_test';
  description = 'A tool that requires network access';
  requiresNetwork = true;
  inputSchema: JsonSchema = { type: 'object', properties: {} };

  async execute(_params: unknown): Promise<ToolResult> {
    return { content: 'network result' };
  }
}

describe('BaseTool', () => {
  describe('requiresNetwork', () => {
    it('defaults to false', () => {
      const tool = new LocalTool();
      expect(tool.requiresNetwork).toBe(false);
    });

    it('can be set to true by subclass', () => {
      const tool = new NetworkTool();
      expect(tool.requiresNetwork).toBe(true);
    });
  });

  describe('register()', () => {
    it('includes requiresNetwork = false for local tools', () => {
      const tool = new LocalTool();
      const reg = tool.register();
      expect(reg.name).toBe('local_test');
      expect(reg.requiresNetwork).toBe(false);
      expect(typeof reg.handler).toBe('function');
    });

    it('includes requiresNetwork = true for network tools', () => {
      const tool = new NetworkTool();
      const reg = tool.register();
      expect(reg.name).toBe('network_test');
      expect(reg.requiresNetwork).toBe(true);
    });

    it('handler delegates to execute()', async () => {
      const tool = new LocalTool();
      const reg = tool.register();
      const result = await reg.handler({});
      expect(result.content).toBe('local result');
    });
  });

  describe('tool metadata', () => {
    it('exposes name, description, and inputSchema', () => {
      const tool = new LocalTool();
      expect(tool.name).toBe('local_test');
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
    });
  });
});
