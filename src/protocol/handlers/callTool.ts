import { ToolResult } from '../types';
import ToolRegistry from '../registry';

/**
 * Returns a handler function for MCP `tools/call` requests.
 * The handler expects an object with `name` and optional `arguments`.
 */
export function callToolHandler(registry: ToolRegistry) {
  return async function callTool(params: { name: string; arguments?: unknown }): Promise<ToolResult> {
    const toolName = params?.name;
    const args = params?.arguments;

    if (!toolName) {
      throw new Error('Missing tool name');
    }

    if (!registry.has(toolName)) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const handler = registry.getHandler(toolName);
    if (!handler) {
      throw new Error(`No handler for tool: ${toolName}`);
    }

    const result = await handler(args);
    return result;
  };
}

export default callToolHandler;
