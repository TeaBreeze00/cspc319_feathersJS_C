import { McpServer, ToolRegistry } from './protocol';
import { ToolHandlerRegistry, ParameterValidator, ErrorHandler, Router } from './routing';
import { SearchDocsTool, SubmitDocumentationTool } from './tools';

// Protocol-level registry (metadata + implementations)
const registry = new ToolRegistry();

// Routing-layer components
const routingRegistry = new ToolHandlerRegistry();
const validator = new ParameterValidator();
const errorHandler = new ErrorHandler();
const router = new Router(routingRegistry, validator, errorHandler);

// Create tool instances
const searchDocsTool = new SearchDocsTool();
const submitDocTool = new SubmitDocumentationTool();

// Register tools with protocol registry (metadata + handler for MCP)
registry.register(searchDocsTool.register());
registry.register(submitDocTool.register());

// Register tools with routing registry (handler + schema for routing layer)
routingRegistry.register(
  'search_docs',
  (params: unknown) => searchDocsTool.execute(params),
  searchDocsTool.inputSchema
);

routingRegistry.register(
  'submit_documentation',
  (params: unknown) => submitDocTool.execute(params),
  submitDocTool.inputSchema,
  true // requiresNetwork = true
);

// Create MCP server (protocol layer)
const server = new McpServer(registry);

async function startServer() {
  try {
    await server.start();
    console.error('feathers-mcp-server started');
  } catch (err) {
    console.error('Failed to start MCP server:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

startServer();

async function shutdown(signal: string) {
  try {
    console.error(`Received ${signal}, shutting down`);
    await server.stop();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
