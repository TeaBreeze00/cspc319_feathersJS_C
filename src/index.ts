import { McpServer, ToolRegistry, listToolsHandler } from './protocol';
import { ToolHandlerRegistry, ParameterValidator, ErrorHandler, Router } from './routing';
import { callToolHandler } from './protocol/handlers/callTool';
import {
  SearchDocsTool,
  GetTemplateTool,
  GenerateServiceTool,
  GetHookExampleTool,
  TroubleshootErrorTool,
  GetBestPracticesTool,
  ExplainConceptTool,
  SuggestAlternativesTool,
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
const getTemplateTool = new GetTemplateTool();
const generateServiceTool = new GenerateServiceTool();
const getHookExampleTool = new GetHookExampleTool();
const troubleshootErrorTool = new TroubleshootErrorTool();
const getBestPracticesTool = new GetBestPracticesTool();
const explainConceptTool = new ExplainConceptTool();
const suggestAlternativesTool = new SuggestAlternativesTool();
const listToolsTool = new ListToolsTool();
const validateCodeTool = new ValidateCodeTool();

// Register tools with protocol registry (metadata + handler for MCP)
registry.register(searchDocsTool.register());
registry.register(getTemplateTool.register());
registry.register(generateServiceTool.register());
registry.register(getHookExampleTool.register());
registry.register(troubleshootErrorTool.register());
registry.register(getBestPracticesTool.register());
registry.register(explainConceptTool.register());
registry.register(suggestAlternativesTool.register());
registry.register(listToolsTool.register());
registry.register(validateCodeTool.register());

// Register tools with routing registry (handler + schema for routing layer)
routingRegistry.register(
  'search_docs',
  (params: unknown) => searchDocsTool.execute(params),
  searchDocsTool.inputSchema
);
routingRegistry.register(
  'get_feathers_template',
  (params: unknown) => getTemplateTool.execute(params),
  getTemplateTool.inputSchema
);
routingRegistry.register(
  'generate_service',
  (params: unknown) => generateServiceTool.execute(params),
  generateServiceTool.inputSchema
);
routingRegistry.register(
  'get_hook_example',
  (params: unknown) => getHookExampleTool.execute(params),
  getHookExampleTool.inputSchema
);
routingRegistry.register(
  'troubleshoot_error',
  (params: unknown) => troubleshootErrorTool.execute(params),
  troubleshootErrorTool.inputSchema
);
routingRegistry.register(
  'get_best_practices',
  (params: unknown) => getBestPracticesTool.execute(params),
  getBestPracticesTool.inputSchema
);
routingRegistry.register(
  'explain_concept',
  (params: unknown) => explainConceptTool.execute(params),
  explainConceptTool.inputSchema
);
routingRegistry.register(
  'suggest_alternatives',
  (params: unknown) => suggestAlternativesTool.execute(params),
  suggestAlternativesTool.inputSchema
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
