import { McpServer, ToolRegistry } from '../../src/protocol';
import { ErrorHandler, ParameterValidator, Router, ToolHandlerRegistry } from '../../src/routing';
import {
  ExplainConceptTool,
  GenerateServiceTool,
  ListToolsTool,
  SearchDocsTool,
  ValidateCodeTool,
} from '../../src/tools';
import { MockTransport } from '../helpers/mockTransport';

export interface IntegrationServerContext {
  server: McpServer;
  protocolRegistry: ToolRegistry;
  routingRegistry: ToolHandlerRegistry;
  router: Router;
  tools: Array<
    SearchDocsTool | GenerateServiceTool | ValidateCodeTool | ExplainConceptTool | ListToolsTool
  >;
  transport: MockTransport;
}

let context: IntegrationServerContext | null = null;

export function createIntegrationServer(): IntegrationServerContext {
  const protocolRegistry = new ToolRegistry();
  const routingRegistry = new ToolHandlerRegistry();
  const validator = new ParameterValidator();
  const errorHandler = new ErrorHandler();
  const router = new Router(routingRegistry, validator, errorHandler);

  const tools = [
    new SearchDocsTool(),
    new GenerateServiceTool(),
    new ValidateCodeTool(),
    new ExplainConceptTool(),
    new ListToolsTool(),
  ];

  for (const tool of tools) {
    protocolRegistry.register(tool.register());
    routingRegistry.register(tool.name, (params: unknown) => tool.execute(params), tool.inputSchema);
  }

  const server = new McpServer(protocolRegistry);
  const transport = new MockTransport();

  context = {
    server,
    protocolRegistry,
    routingRegistry,
    router,
    tools,
    transport,
  };

  return context;
}

export function getIntegrationServer(): IntegrationServerContext {
  if (!context) {
    return createIntegrationServer();
  }
  return context;
}

export function resetIntegrationServer(): void {
  context = null;
}
