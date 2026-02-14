/// <reference types="jest" />

jest.mock('@modelcontextprotocol/sdk/server/mcp', () => {
  class MockSdk {
    static __lastInstance: any;
    connect = jest.fn(async (_t?: any) => {});
    close = jest.fn(async () => {});
    constructor() {
      (MockSdk as any).__lastInstance = this;
    }
  }
  return { McpServer: MockSdk };
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

import { ToolRegistry, McpServer } from '../../src/protocol';

describe('McpServer (mocked SDK)', () => {
  test('start connects SDK server to stdio transport and stop closes it', async () => {
    const registry = new ToolRegistry();
    const server = new McpServer(registry as any);

    await server.start();

    const MockSdk = require('@modelcontextprotocol/sdk/server/mcp').McpServer;
    const MockTransport = require('@modelcontextprotocol/sdk/server/stdio').StdioServerTransport;

    const sdkInstance = (MockSdk as any).__lastInstance;
    const transportInstance = (MockTransport as any).__lastInstance;

    expect(sdkInstance).toBeDefined();
    expect(transportInstance).toBeDefined();
    expect(sdkInstance.connect).toHaveBeenCalled();

    await server.stop();
    expect(sdkInstance.close).toHaveBeenCalled();
  });
});
