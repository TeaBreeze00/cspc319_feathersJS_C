/// <reference types="jest" />

jest.mock('@modelcontextprotocol/sdk/server/index', () => {
  class MockServer {
    static __lastInstance: any;
    connect = jest.fn(async (_t?: any) => {});
    close = jest.fn(async () => {});
    setRequestHandler = jest.fn();
    constructor() {
      (MockServer as any).__lastInstance = this;
    }
  }
  return { Server: MockServer };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio', () => {
  class MockTransport {
    static __lastInstance: any;
    sent: any[] = [];
    constructor() {
      (MockTransport as any).__lastInstance = this;
    }
    send(msg: any) {
      this.sent.push(msg);
    }
    receive() {
      return new Promise(() => {});
    }
  }
  return { StdioServerTransport: MockTransport };
});

jest.mock('@modelcontextprotocol/sdk/types', () => {
  return {
    ListToolsRequestSchema: { method: 'tools/list' },
    CallToolRequestSchema: { method: 'tools/call' },
  };
});

import { ToolRegistry, McpServer } from '../../src/protocol';

describe('McpServer (mocked SDK)', () => {
  test('start connects SDK server to stdio transport and stop closes it', async () => {
    const registry = new ToolRegistry();
    const server = new McpServer(registry as any);

    await server.start();

    const MockServer = require('@modelcontextprotocol/sdk/server/index').Server;
    const MockTransport = require('@modelcontextprotocol/sdk/server/stdio').StdioServerTransport;

    const serverInstance = (MockServer as any).__lastInstance;
    const transportInstance = (MockTransport as any).__lastInstance;

    expect(serverInstance).toBeDefined();
    expect(transportInstance).toBeDefined();
    expect(serverInstance.connect).toHaveBeenCalled();
    expect(serverInstance.setRequestHandler).toHaveBeenCalledTimes(2); // tools/list and tools/call

    await server.stop();
    expect(serverInstance.close).toHaveBeenCalled();
  });

  test('registers tools/list and tools/call handlers', async () => {
    const registry = new ToolRegistry();

    // Register a test tool
    registry.register({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => ({ content: 'test result' }),
    });

    const server = new McpServer(registry as any);
    await server.start();

    const MockServer = require('@modelcontextprotocol/sdk/server/index').Server;
    const serverInstance = (MockServer as any).__lastInstance;

    // Verify setRequestHandler was called for both schemas
    const calls = serverInstance.setRequestHandler.mock.calls;
    expect(calls.length).toBe(2);

    // First call should be for ListToolsRequestSchema
    expect(calls[0][0]).toEqual({ method: 'tools/list' });

    // Second call should be for CallToolRequestSchema
    expect(calls[1][0]).toEqual({ method: 'tools/call' });

    await server.stop();
  });

  test('tools/list handler returns registered tools', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'my_tool',
      description: 'My test tool',
      inputSchema: { type: 'object', properties: { arg: { type: 'string' } } },
      handler: async () => ({ content: 'result' }),
    });

    const server = new McpServer(registry as any);
    await server.start();

    const MockServer = require('@modelcontextprotocol/sdk/server/index').Server;
    const serverInstance = (MockServer as any).__lastInstance;

    // Get the tools/list handler
    const listToolsHandler = serverInstance.setRequestHandler.mock.calls[0][1];

    // Call the handler
    const result = await listToolsHandler({});

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBe(1);
    expect(result.tools[0].name).toBe('my_tool');
    expect(result.tools[0].description).toBe('My test tool');

    await server.stop();
  });

  test('tools/call handler executes tool and returns result', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'echo_tool',
      description: 'Echoes input',
      inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
      handler: async (args: any) => ({ content: `Echo: ${args.message}` }),
    });

    const server = new McpServer(registry as any);
    await server.start();

    const MockServer = require('@modelcontextprotocol/sdk/server/index').Server;
    const serverInstance = (MockServer as any).__lastInstance;

    // Get the tools/call handler
    const callToolHandler = serverInstance.setRequestHandler.mock.calls[1][1];

    // Call the handler with a request
    const result = await callToolHandler({
      params: {
        name: 'echo_tool',
        arguments: { message: 'Hello World' },
      },
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Echo: Hello World');

    await server.stop();
  });

  test('tools/call handler returns error for unknown tool', async () => {
    const registry = new ToolRegistry();
    const server = new McpServer(registry as any);
    await server.start();

    const MockServer = require('@modelcontextprotocol/sdk/server/index').Server;
    const serverInstance = (MockServer as any).__lastInstance;

    // Get the tools/call handler
    const callToolHandler = serverInstance.setRequestHandler.mock.calls[1][1];

    // Call with unknown tool
    const result = await callToolHandler({
      params: {
        name: 'nonexistent_tool',
        arguments: {},
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');

    await server.stop();
  });

  test('tools/call handler returns error when tool throws', async () => {
    const registry = new ToolRegistry();

    registry.register({
      name: 'failing_tool',
      description: 'Always fails',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('Tool execution failed');
      },
    });

    const server = new McpServer(registry as any);
    await server.start();

    const MockServer = require('@modelcontextprotocol/sdk/server/index').Server;
    const serverInstance = (MockServer as any).__lastInstance;

    // Get the tools/call handler
    const callToolHandler = serverInstance.setRequestHandler.mock.calls[1][1];

    // Call the failing tool
    const result = await callToolHandler({
      params: {
        name: 'failing_tool',
        arguments: {},
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Tool execution failed');

    await server.stop();
  });
});
