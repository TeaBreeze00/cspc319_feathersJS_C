import { ToolResult } from '../types';
import { ToolRequest } from '../../routing/types';
import { Router } from '../../routing/router';
import ToolRegistry from '../registry';

/**
 * Returns a handler function for MCP `tools/call` requests that delegates to the routing `Router`.
 * The handler expects an object with `name` and optional `arguments`.
 */
export function callToolHandler(routerOrRegistry: Router | ToolRegistry) {
  return async function callTool(params: { name: string; arguments?: unknown }): Promise<ToolResult> {
    const toolName = params?.name;
    const args = params?.arguments;

    if (!toolName) {
      throw new Error('Missing tool name');
    }

    // If a Router was passed, delegate to routing
    if (typeof (routerOrRegistry as any).route === 'function') {
      const router = routerOrRegistry as Router;
      const request: ToolRequest = { toolName, params: args };
      const res = await router.route(request);

      if (res.success) {
        return res.data as ToolResult;
      }

      throw new Error(res.error?.message || 'Tool execution failed');
    }

    // Otherwise treat as legacy ToolRegistry
    const registry = routerOrRegistry as ToolRegistry;

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
