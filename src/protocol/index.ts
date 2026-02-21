export { McpServer } from './server';
export { ToolRegistry } from './registry';
export * from './types';
export { listToolsHandler } from './handlers/listTools';
export { callToolHandler } from './handlers/callTool';

import ToolRegistry from './registry';

// get_hook_example
// troubleshoot_error
// get_best_practices
// explain_concept
import {
  GetHookExampleTool,
  TroubleshootErrorTool,
  GetBestPracticesTool,
  ExplainConceptTool
} from '../tools';

const registry = new ToolRegistry();

// Register support tools
registry.register(new GetHookExampleTool().register());
registry.register(new TroubleshootErrorTool().register());
registry.register(new GetBestPracticesTool().register());
 registry.register(new ExplainConceptTool().register());



export { registry };