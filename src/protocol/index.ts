export { McpServer } from './server';
export { ToolRegistry } from './registry';
export * from './types';
export { listToolsHandler } from './handlers/listTools';
export { callToolHandler } from './handlers/callTool';

import ToolRegistry from './registry';

import {
  SearchDocsTool,
  SubmitDocumentationTool,
  RemoveDocumentationTool,
  UpdateDocumentationTool,
} from '../tools';

const registry = new ToolRegistry();

registry.register(new SearchDocsTool().register());
registry.register(new SubmitDocumentationTool().register());
registry.register(new RemoveDocumentationTool().register());
registry.register(new UpdateDocumentationTool().register());

export { registry };
