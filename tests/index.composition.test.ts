import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: object;
  handler: (params: unknown) => Promise<unknown>;
  requiresNetwork?: boolean;
};

type RegisteredRoute = {
  name: string;
  requiresNetwork: boolean;
  schema: object;
};

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function createMockToolClass(name: string, requiresNetwork = false) {
  return jest.fn().mockImplementation(() => ({
    name,
    description: `${name} description`,
    inputSchema: { type: 'object', additionalProperties: true },
    requiresNetwork,
    execute: jest.fn(async (params: unknown) => ({ content: JSON.stringify({ name, params }) })),
    register(this: any) {
      return {
        name: this.name,
        description: this.description,
        inputSchema: this.inputSchema,
        handler: (params: unknown) => this.execute(params),
        requiresNetwork: this.requiresNetwork,
      };
    },
  }));
}

describe('src/index.ts composition', () => {
  const originalEnv = process.env;
  const originalCwd = process.cwd();
  const originalExitCode = process.exitCode;

  let tempDir: string;
  let protocolRegistrations: RegisteredTool[];
  let routingRegistrations: RegisteredRoute[];
  let serverInstances: Array<{ start: jest.Mock; stop: jest.Mock }>;
  let signalHandlers: Map<string, () => Promise<void>>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feathers-index-test-'));
    fs.mkdirSync(path.join(tempDir, 'ui'), { recursive: true });

    protocolRegistrations = [];
    routingRegistrations = [];
    serverInstances = [];
    signalHandlers = new Map();

    process.chdir(tempDir);
    process.env = { ...originalEnv };

    jest.resetModules();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'on').mockImplementation(((event: string, handler: () => Promise<void>) => {
      signalHandlers.set(event, handler);
      return process;
    }) as any);
    jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = originalEnv;
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
    jest.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function loadEntrypoint(options?: { startError?: Error }) {
    const SearchDocsTool = createMockToolClass('search_docs');
    const SubmitDocumentationTool = createMockToolClass('submit_documentation', true);
    const RemoveDocumentationTool = createMockToolClass('remove_documentation', true);
    const UpdateDocumentationTool = createMockToolClass('update_documentation', true);

    jest.doMock('../src/protocol', () => ({
      ToolRegistry: class MockToolRegistry {
        register(tool: RegisteredTool) {
          protocolRegistrations.push(tool);
        }
      },
      McpServer: class MockMcpServer {
        start = jest.fn(async () => {
          if (options?.startError) {
            throw options.startError;
          }
        });
        stop = jest.fn(async () => {});

        constructor(_registry: unknown) {
          serverInstances.push(this);
        }
      },
    }));

    jest.doMock('../src/routing', () => ({
      ToolHandlerRegistry: class MockRoutingRegistry {
        register(
          name: string,
          _handler: (params: unknown) => Promise<unknown>,
          schema: object,
          requiresNetwork = false
        ) {
          routingRegistrations.push({ name, requiresNetwork, schema });
        }
      },
      ParameterValidator: class MockParameterValidator {},
      ErrorHandler: class MockErrorHandler {},
      Router: class MockRouter {
        constructor(
          _registry: unknown,
          _validator: unknown,
          _errorHandler: unknown,
          _defaultTimeoutMs?: number
        ) {}
      },
    }));

    jest.doMock('../src/tools', () => ({
      SearchDocsTool,
      SubmitDocumentationTool,
      RemoveDocumentationTool,
      UpdateDocumentationTool,
    }));

    require('../src/index');

    return {
      SearchDocsTool,
      SubmitDocumentationTool,
      RemoveDocumentationTool,
      UpdateDocumentationTool,
    };
  }

  it('loads env files, preserves existing env vars, and wires all 4 tools into both registries', async () => {
    fs.writeFileSync(
      path.join(tempDir, '.env'),
      ['BOOTSTRAP_KEEP=from-file', 'BOOTSTRAP_ROOT_ONLY=cwd-env', ''].join('\n'),
      'utf8'
    );
    fs.writeFileSync(path.join(tempDir, 'ui', '.env'), 'BOOTSTRAP_UI_ONLY=ui-env\n', 'utf8');

    process.env.BOOTSTRAP_KEEP = 'from-process';

    loadEntrypoint();
    await flushMicrotasks();

    expect(process.env.BOOTSTRAP_KEEP).toBe('from-process');
    expect(process.env.BOOTSTRAP_ROOT_ONLY).toBe('cwd-env');
    expect(process.env.BOOTSTRAP_UI_ONLY).toBe('ui-env');

    expect(protocolRegistrations.map((tool) => tool.name)).toEqual([
      'search_docs',
      'submit_documentation',
      'remove_documentation',
      'update_documentation',
    ]);
    expect(routingRegistrations).toEqual([
      expect.objectContaining({ name: 'search_docs', requiresNetwork: false }),
      expect.objectContaining({ name: 'submit_documentation', requiresNetwork: true }),
      expect.objectContaining({ name: 'remove_documentation', requiresNetwork: true }),
      expect.objectContaining({ name: 'update_documentation', requiresNetwork: true }),
    ]);
    expect(serverInstances).toHaveLength(1);
    expect(serverInstances[0].start).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('Loaded 2 env var(s) from .env files');
    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('logs startup failures and sets a non-zero exit code', async () => {
    process.exitCode = undefined;

    loadEntrypoint({ startError: new Error('startup failed') });
    await flushMicrotasks();

    expect(serverInstances).toHaveLength(1);
    expect(serverInstances[0].start).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('Failed to start MCP server:', 'startup failed');
    expect(process.exitCode).toBe(1);
  });

  it('registers shutdown handlers that stop the server and exit cleanly', async () => {
    loadEntrypoint();
    await flushMicrotasks();

    const sigintHandler = signalHandlers.get('SIGINT');
    expect(sigintHandler).toBeDefined();

    await sigintHandler!();

    expect(serverInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('Received SIGINT, shutting down');
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
