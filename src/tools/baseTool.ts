import { ToolResult, ToolRegistration, JsonSchema } from '../protocol/types';

/**
 * Abstract base class for all MCP tools.
 *
 * Concrete tool implementations extend this class, providing a name,
 * description, JSON Schema for the input, and an execute method.
 * The `register()` helper converts the tool into a `ToolRegistration`
 * object that can be handed directly to the protocol layer's registry.
 */
export abstract class BaseTool {
  /** Unique tool name (used in MCP tool/call requests) */
  abstract name: string;

  /** Human-readable description surfaced in tool listings */
  abstract description: string;

  /** JSON Schema describing the expected input parameters */
  abstract inputSchema: JsonSchema;

  /**
   * Execute the tool with the given parameters.
   *
   * @param params - Validated input parameters (shape defined by `inputSchema`)
   * @returns A promise resolving to the tool result
   */
  abstract execute(params: unknown): Promise<ToolResult>;

  /**
   * Build a `ToolRegistration` object suitable for the protocol-layer
   * `ToolRegistry`.  The handler delegates to `this.execute` so that
   * sub-classes only need to implement `execute`.
   */
  register(): ToolRegistration {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      handler: (params: unknown) => this.execute(params),
    };
  }
}
