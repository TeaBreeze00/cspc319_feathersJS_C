jest.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  class MockServer {
    static __lastInstance: MockServer | undefined;
    connect = jest.fn(async () => {});
    close = jest.fn(async () => {});
    setRequestHandler = jest.fn((schema: { method: string }, handler: (request?: any) => unknown) => {
      if (schema.method === 'tools/list') {
        (this as any).listToolsHandler = handler;
      }
      if (schema.method === 'tools/call') {
        (this as any).callToolHandler = handler;
      }
    });

    constructor() {
      MockServer.__lastInstance = this;
    }
  }

  return { Server: MockServer };
});

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  class MockTransport {}
  return { StdioServerTransport: MockTransport };
});

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: { method: 'tools/list' },
  CallToolRequestSchema: { method: 'tools/call' },
}));

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('System smoke: entry module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'on').mockImplementation((() => process) as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  async function bootServer() {
    require('../../src/index');
    await flushMicrotasks();

    const MockServer = require('@modelcontextprotocol/sdk/server/index.js').Server as {
      __lastInstance: {
        connect: jest.Mock;
        listToolsHandler?: () => Promise<unknown>;
        callToolHandler?: (request: unknown) => Promise<unknown>;
      };
    };

    const server = MockServer.__lastInstance;
    expect(server).toBeDefined();
    expect(server.connect).toHaveBeenCalledTimes(1);

    return server;
  }

  it('starts cleanly and exposes the 4 supported tools', async () => {
    const server = await bootServer();
    const response = (await server.listToolsHandler?.()) as {
      tools: Array<{ name: string }>;
    };

    expect(response.tools.map((tool) => tool.name).sort()).toEqual([
      'remove_documentation',
      'search_docs',
      'submit_documentation',
      'update_documentation',
    ]);
  });

  it('returns a normalized error for unknown tools', async () => {
    const server = await bootServer();
    const response = (await server.callToolHandler?.({
      params: { name: 'unknown_tool', arguments: {} },
    })) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Unknown tool');
  });

  it('keeps network-gated tools disabled when the env flag is absent', async () => {
    process.env.GITHUB_TOKEN = 'ghp_systemsmoke';
    delete process.env.ALLOW_NETWORK_TOOLS;

    const server = await bootServer();
    const response = (await server.callToolHandler?.({
      params: {
        name: 'submit_documentation',
        arguments: {
          title: 'Blocked submission in system smoke test',
          filePath: 'docs/v6_docs/guides/system-smoke.md',
          content:
            '# Blocked\n\nThis request should stop at the network gate inside the tool.\n\n' +
            '## Details\n\nAdditional text to satisfy the minimum content length requirement.',
          version: 'v6',
        },
      },
    })) as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };

    const payload = JSON.parse(response.content[0].text) as {
      success: boolean;
      errors: string[];
    };

    expect(response.isError).toBeUndefined();
    expect(payload.success).toBe(false);
    expect(payload.errors.some((message) => /network access not enabled/i.test(message))).toBe(
      true
    );
  });
});
