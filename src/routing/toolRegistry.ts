/**
 * ToolHandlerRegistry stores routing-aware handlers along with their JSON schemas.
 */

export type ToolHandler = (params: unknown) => Promise<unknown>;

export interface ToolHandlerEntry {
  handler: ToolHandler;
  schema: object;
}

export class ToolHandlerRegistry {
  private handlers: Map<string, ToolHandlerEntry> = new Map();

  register(name: string, handler: ToolHandler, schema: object): void {
    if (this.handlers.has(name)) {
      throw new Error(`Handler for "${name}" is already registered`);
    }
    this.handlers.set(name, { handler, schema });
  }

  lookup(name: string): ToolHandlerEntry | undefined {
    return this.handlers.get(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }
}

export default ToolHandlerRegistry;
