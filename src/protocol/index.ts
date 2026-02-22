export { McpServer } from './server';
export { ToolRegistry } from './registry';
export * from './types';
export { listToolsHandler } from './handlers/listTools';
export { callToolHandler } from './handlers/callTool';

import ToolRegistry from './registry';

import {
  ExplainConceptTool,
  GenerateServiceTool,
  SearchDocsTool,
  ListToolsTool,
  ValidateCodeTool,
} from '../tools';

const registry = new ToolRegistry();

// Register support tools

registry.register(new ExplainConceptTool().register());
registry.register(new ValidateCodeTool().register());
registry.register(new ListToolsTool().register());
registry.register(new GenerateServiceTool().register());
registry.register(new SearchDocsTool().register());

export { registry };
