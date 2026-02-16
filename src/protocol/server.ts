import ToolRegistry from './registry';

type AnyClass = any;

export class McpServer {
  private registry: ToolRegistry;
  private server?: AnyClass;
  private transport?: AnyClass;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
    this.server = undefined;
  }

  async start(): Promise<void> {
    if (this.server) return;

    // Use the low-level Server class (not McpServer wrapper) to support JSON Schema
    const _serverModule = require('@modelcontextprotocol/sdk/server/index.js');
    const _stdio = require('@modelcontextprotocol/sdk/server/stdio.js');
    const _types = require('@modelcontextprotocol/sdk/types.js');

    const ServerClass: AnyClass = _serverModule.Server ?? _serverModule.default ?? _serverModule;
    const StdioServerTransport: AnyClass = _stdio.StdioServerTransport ?? _stdio.default ?? _stdio;
    const ListToolsRequestSchema = _types.ListToolsRequestSchema;
    const CallToolRequestSchema = _types.CallToolRequestSchema;

    // Create the low-level Server with tools capability enabled
    this.server = new ServerClass(
      { name: 'feathers-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.transport = new StdioServerTransport();

    // Register request handlers for tools/list and tools/call
    this.registerToolHandlers(ListToolsRequestSchema, CallToolRequestSchema);

    // Connect the server to stdio transport
    await this.server.connect(this.transport);
  }

  /**
   * Registers handlers for tools/list and tools/call using the low-level Server API.
   * This approach allows us to use plain JSON Schema objects instead of Zod schemas.
   */
  private registerToolHandlers(
    ListToolsRequestSchema: AnyClass,
    CallToolRequestSchema: AnyClass
  ): void {
    if (!this.server) return;

    // Handler for tools/list - returns metadata for all registered tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.registry.getTools();
      return {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    // Handler for tools/call - executes the requested tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request: AnyClass) => {
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};

      if (!toolName) {
        return {
          content: [{ type: 'text', text: 'Error: Missing tool name' }],
          isError: true,
        };
      }

      if (!this.registry.has(toolName)) {
        return {
          content: [{ type: 'text', text: `Error: Unknown tool: ${toolName}` }],
          isError: true,
        };
      }

      try {
        const handler = this.registry.getHandler(toolName);
        if (!handler) {
          return {
            content: [{ type: 'text', text: `Error: No handler for tool: ${toolName}` }],
            isError: true,
          };
        }

        // Execute the tool handler with the arguments
        const result = await handler(args);

        // Normalize the result to ensure content is always an array
        return this.normalizeResult(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  /**
   * Normalizes a tool result to ensure it conforms to MCP SDK expectations.
   * The SDK requires `content` to be an array of content parts.
   */
  private normalizeResult(result: unknown): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  } {
    // If result is null/undefined, return empty content
    if (result == null) {
      return { content: [{ type: 'text', text: '' }] };
    }

    // If result is already in the correct format with content array
    if (typeof result === 'object' && 'content' in result) {
      const r = result as { content: unknown; isError?: boolean; metadata?: unknown };

      // If content is already an array, return as-is (with potential isError)
      if (Array.isArray(r.content)) {
        return {
          content: r.content,
          ...(r.isError ? { isError: true } : {}),
        };
      }

      // If content is a string, wrap it in array
      if (typeof r.content === 'string') {
        return {
          content: [{ type: 'text', text: r.content }],
          ...(r.isError ? { isError: true } : {}),
        };
      }

      // If content is something else (object), stringify it
      return {
        content: [{ type: 'text', text: JSON.stringify(r.content, null, 2) }],
        ...(r.isError ? { isError: true } : {}),
      };
    }

    // If result is a plain string
    if (typeof result === 'string') {
      return { content: [{ type: 'text', text: result }] };
    }

    // If result is any other object, stringify it
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    if (typeof this.server.close === 'function') {
      await this.server.close();
    }
    this.server = undefined;
    this.transport = undefined;
  }
}

export default McpServer;
