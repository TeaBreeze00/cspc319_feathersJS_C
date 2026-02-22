import { McpServer, ToolRegistry, listToolsHandler } from './protocol';
import { ToolHandlerRegistry, ParameterValidator, ErrorHandler, Router } from './routing';
import { callToolHandler } from './protocol/handlers/callTool';
import {
  SearchDocsTool,
  GenerateServiceTool,
  ExplainConceptTool,
  ListToolsTool,
  ValidateCodeTool,
} from './tools';

// Protocol-level registry (metadata + implementations)
const registry = new ToolRegistry();

// Routing-layer components
const routingRegistry = new ToolHandlerRegistry();
const validator = new ParameterValidator();
const errorHandler = new ErrorHandler();
const router = new Router(routingRegistry, validator, errorHandler);

// Create tool instances
const searchDocsTool = new SearchDocsTool();
const generateServiceTool = new GenerateServiceTool();
const explainConceptTool = new ExplainConceptTool();
const listToolsTool = new ListToolsTool();
const validateCodeTool = new ValidateCodeTool();

// Register tools with protocol registry (metadata + handler for MCP)
registry.register(searchDocsTool.register());
registry.register(generateServiceTool.register());
registry.register(explainConceptTool.register());
registry.register(listToolsTool.register());
registry.register(validateCodeTool.register());

// Register tools with routing registry (handler + schema for routing layer)
routingRegistry.register(
  'search_docs',
  (params: unknown) => searchDocsTool.execute(params),
  searchDocsTool.inputSchema
);

routingRegistry.register(
  'generate_service',
  (params: unknown) => generateServiceTool.execute(params),
  generateServiceTool.inputSchema
);

routingRegistry.register(
  'explain_concept',
  (params: unknown) => explainConceptTool.execute(params),
  explainConceptTool.inputSchema
);

routingRegistry.register(
  'list_available_tools',
  (params: unknown) => listToolsTool.execute(params),
  listToolsTool.inputSchema
);
routingRegistry.register(
  'validate_code',
  (params: unknown) => validateCodeTool.execute(params),
  validateCodeTool.inputSchema
);

// Create protocol handlers wired to routing
const listHandler = listToolsHandler(registry);
const callHandler = callToolHandler(router);

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
