/**
 * Routing layer types for the FeathersJS MCP Server
 */

/**
 * Tool request passed to the routing layer
 */
export interface ToolRequest {
  toolName: string;
  params: unknown;
}

/**
 * Tool execution response
 */
export interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: ToolError;
}

/**
 * Structured error information
 */
export interface ToolError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Result of parameter validation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Individual validation error with context
 */
export interface ValidationError {
  path: string;
  message: string;
}
