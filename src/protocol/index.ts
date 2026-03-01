export { McpServer } from './server';
export { ToolRegistry } from './registry';
export * from './types';
export { listToolsHandler } from './handlers/listTools';
export { callToolHandler } from './handlers/callTool';

import ToolRegistry from './registry';

import { SearchDocsTool, SubmitDocumentationTool } from '../tools';

const registry = new ToolRegistry();

registry.register(new SearchDocsTool().register());
registry.register(new SubmitDocumentationTool().register());

export { registry };
