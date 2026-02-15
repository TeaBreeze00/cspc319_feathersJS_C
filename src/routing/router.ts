import { ToolRequest, ToolResponse } from './types';
import ToolHandlerRegistry from './toolRegistry';
import ParameterValidator from './validator';
import ErrorHandler from './errorHandler';
import withTimeout, { TimeoutError } from './timeout';

/**
 * Router: validates, executes and formats tool calls for the routing layer.
 */
export class Router {
  private registry: ToolHandlerRegistry;
  private validator: ParameterValidator;
  private errorHandler: ErrorHandler;
  private defaultTimeoutMs: number;

  constructor(
    registry: ToolHandlerRegistry,
    validator: ParameterValidator,
    errorHandler: ErrorHandler,
    defaultTimeoutMs = 10000
  ) {
    this.registry = registry;
    this.validator = validator;
    this.errorHandler = errorHandler;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async route(request: ToolRequest): Promise<ToolResponse> {
    try {
      const entry = this.registry.lookup(request.toolName);
      if (!entry) {
        throw new Error(`Unknown tool: ${request.toolName}`);
      }

      // Validate parameters against schema
      const validation = this.validator.validate(request.params, entry.schema);
      if (!validation.valid) {
        // Create a validation-style error object that ErrorHandler recognizes
        const vErr: any = {
          name: 'ValidationError',
          message: 'Invalid parameters',
          errors: validation.errors,
        };
        return { success: false, error: this.errorHandler.handle(vErr) };
      }

      // Execute handler with timeout
      const result = await withTimeout(() => entry.handler(request.params), this.defaultTimeoutMs);

      return { success: true, data: result };
    } catch (err) {
      const toolErr = this.errorHandler.handle(err);
      return { success: false, error: toolErr };
    }
  }
}

export default Router;
