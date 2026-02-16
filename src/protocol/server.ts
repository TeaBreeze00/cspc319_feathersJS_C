import ToolRegistry from './registry';

type AnyClass = any;

export class McpServer {
  private registry: ToolRegistry;
  private sdkServer?: AnyClass;
  private transport?: AnyClass;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.sdkServer = undefined;
  }

  async start(): Promise<void> {
    if (this.sdkServer) return;

    // Defer loading the SDK until start to avoid requiring it at module load time.
    const _sdkMcp = require('@modelcontextprotocol/sdk/server/mcp.js');
    const _stdio = require('@modelcontextprotocol/sdk/server/stdio.js');
    const SdkMcpServer: AnyClass = _sdkMcp.McpServer ?? _sdkMcp.default ?? _sdkMcp;
    const StdioServerTransport: AnyClass = _stdio.StdioServerTransport ?? _stdio.default ?? _stdio;

    // Create the underlying SDK MCP server and attach stdio transport
    this.sdkServer = new SdkMcpServer({ name: 'feathers-mcp-server', version: '1.0.0' });
    this.transport = new StdioServerTransport();

    // Register all tools from our registry with the SDK server
    this.registerToolsWithSdk();

    // Connect the MCP server to stdio transport
    if (typeof this.sdkServer.connect === 'function') {
      await this.sdkServer.connect(this.transport);
    } else if (typeof this.sdkServer.server?.connect === 'function') {
      await this.sdkServer.server.connect(this.transport);
    }
  }

  /**
   * Registers all tools from our ToolRegistry with the SDK server.
   * This wires our tool handlers to the MCP protocol so they appear
   * in tools/list and can be called via tools/call.
   */
  private registerToolsWithSdk(): void {
    if (!this.sdkServer) return;

    // Get tool metadata from our registry
    const tools = this.registry.getTools();

    for (const toolMeta of tools) {
      const handler = this.registry.getHandler(toolMeta.name);
      if (!handler) continue;

      // Use the SDK's tool() method to register each tool
      // The SDK expects: tool(name, description, inputSchema, callback)
      // or tool(name, inputSchema, callback) with description in schema
      if (typeof this.sdkServer.tool === 'function') {
        this.sdkServer.tool(
          toolMeta.name,
          toolMeta.description,
          toolMeta.inputSchema,
          async (params: unknown) => {
            try {
              const result = await handler(params);
              // MCP SDK expects content array format
              if (result && typeof result === 'object' && 'content' in result) {
                // Already in correct format
                return result;
              }
              // Wrap result in content array if needed
              return {
                content: [
                  {
                    type: 'text',
                    text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                  },
                ],
              };
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: ${message}`,
                  },
                ],
                isError: true,
              };
            }
          }
        );
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.sdkServer) return;
    if (typeof this.sdkServer.close === 'function') {
      await this.sdkServer.close();
    } else if (typeof this.sdkServer.server?.close === 'function') {
      await this.sdkServer.server.close();
    }
    this.sdkServer = undefined;
    this.transport = undefined;
  }
}

export default McpServer;
