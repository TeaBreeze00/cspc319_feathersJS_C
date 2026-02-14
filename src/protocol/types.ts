/**
 * Protocol types for the FeathersJS MCP Server
 */

/**
 * JSON Schema object for tool input validation
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Metadata describing a tool's interface and capabilities
 */
export interface ToolMetadata {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

/**
 * Result returned by a tool handler
 */
export interface ToolResult {
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Function signature for tool handlers
 */
export type ToolHandler = (params: unknown) => Promise<ToolResult>;

/**
 * Complete tool registration combining metadata and implementation
 */
export interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: ToolHandler;
}