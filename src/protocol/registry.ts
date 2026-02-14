import { ToolRegistration, ToolMetadata, ToolHandler } from './types';

export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();

  register(tool: ToolRegistration): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  getTools(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  getHandler(name: string): ToolHandler | undefined {
    const reg = this.tools.get(name);
    if (!reg) {
      throw new Error(`No handler registered for tool "${name}"`);
    }
    return reg.handler;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export default ToolRegistry;
