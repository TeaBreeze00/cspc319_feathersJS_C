import ToolRegistry from './registry';

// Use runtime require to avoid pulling complex SDK types into the compiler.
const _sdkMcp = require('@modelcontextprotocol/sdk/server/mcp');
const _stdio = require('@modelcontextprotocol/sdk/server/stdio');

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

    const SdkMcpServer: AnyClass = _sdkMcp.McpServer ?? _sdkMcp.default ?? _sdkMcp;
    const StdioServerTransport: AnyClass = _stdio.StdioServerTransport ?? _stdio.default ?? _stdio;

    // Create the underlying SDK MCP server and attach stdio transport
    this.sdkServer = new SdkMcpServer({ name: 'feathers-mcp-server', version: '0.0.0' });
    this.transport = new StdioServerTransport();

    // Connect the MCP server to stdio transport
    if (typeof this.sdkServer.connect === 'function') {
      await this.sdkServer.connect(this.transport);
    } else if (typeof this.sdkServer.server?.connect === 'function') {
      await this.sdkServer.server.connect(this.transport);
    }
  }

  async stop(): Promise<void> {
    if (!this.sdkServer) return;
    if (typeof this.sdkServer.close === 'function') {
      await this.sdkServer.close();
    }
    else if (typeof this.sdkServer.server?.close === 'function') {
      await this.sdkServer.server.close();
    }
    this.sdkServer = undefined;
    this.transport = undefined;
  }
}

export default McpServer;
