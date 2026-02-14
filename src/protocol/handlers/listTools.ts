import { ToolMetadata } from '../types';
import ToolRegistry from '../registry';

/**
 * Returns a handler function suitable for registering as the MCP `tools/list` handler.
 * The returned handler returns `{ tools: ToolMetadata[] }`.
 */
export function listToolsHandler(registry: ToolRegistry) {
  return async function listTools(): Promise<{ tools: ToolMetadata[] }> {
    const tools: ToolMetadata[] = registry.getTools();
    return { tools };
  };
}

export default listToolsHandler;
