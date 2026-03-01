/// <reference types="jest" />

import { Router } from '../../src/routing/router';
import { ToolHandlerRegistry } from '../../src/routing/toolRegistry';
import { ParameterValidator } from '../../src/routing/validator';
import { ErrorHandler } from '../../src/routing/errorHandler';

describe('Router', () => {
  let registry: ToolHandlerRegistry;
  let validator: ParameterValidator;
  let errorHandler: ErrorHandler;
  let router: Router;

  beforeEach(() => {
    registry = new ToolHandlerRegistry();
    validator = new ParameterValidator();
    errorHandler = new ErrorHandler();
    router = new Router(registry, validator, errorHandler);

    // Silence stderr output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('routes a valid request and returns success', async () => {
    const schema = {
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
    };
    registry.register('double', async (params: any) => ({ content: String(params.x * 2) }), schema);

    const res = await router.route({ toolName: 'double', params: { x: 5 } });
    expect(res.success).toBe(true);
    expect((res.data as any).content).toBe('10');
  });

  test('returns INVALID_PARAMS on validation failure', async () => {
    const schema = {
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
    };
    registry.register('double', async (params: any) => ({ content: String(params.x * 2) }), schema);

    const res = await router.route({ toolName: 'double', params: { x: 'not-a-number' } });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('INVALID_PARAMS');
  });

  test('returns INTERNAL_ERROR for unknown tool', async () => {
    const res = await router.route({ toolName: 'nonexistent', params: {} });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('INTERNAL_ERROR');
  });

  test('returns TIMEOUT when handler exceeds timeout', async () => {
    const schema = { type: 'object' };
    registry.register(
      'slow',
      async () => new Promise((resolve) => setTimeout(resolve, 500)),
      schema
    );

    // Create router with a very short timeout
    const fastRouter = new Router(registry, validator, errorHandler, 50);
    const res = await fastRouter.route({ toolName: 'slow', params: {} });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe('TIMEOUT');
  });

  // =========================================================================
  // Network-tier gate (G1.5)
  // =========================================================================

  describe('network-tier gate', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    test('blocks network-tier tool when ALLOW_NETWORK_TOOLS is not set', async () => {
      delete process.env.ALLOW_NETWORK_TOOLS;

      const schema = { type: 'object' };
      registry.register(
        'net_tool',
        async () => ({ content: 'should not run' }),
        schema,
        true // requiresNetwork
      );

      const res = await router.route({ toolName: 'net_tool', params: {} });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error!.code).toBe('NETWORK_NOT_ALLOWED');
      expect(res.error!.message).toContain('net_tool');
    });

    test('blocks network-tier tool when ALLOW_NETWORK_TOOLS is "false"', async () => {
      process.env.ALLOW_NETWORK_TOOLS = 'false';

      const schema = { type: 'object' };
      registry.register('net_tool2', async () => ({ content: 'should not run' }), schema, true);

      const res = await router.route({ toolName: 'net_tool2', params: {} });
      expect(res.success).toBe(false);
      expect(res.error!.code).toBe('NETWORK_NOT_ALLOWED');
    });

    test('allows network-tier tool when ALLOW_NETWORK_TOOLS is "true"', async () => {
      process.env.ALLOW_NETWORK_TOOLS = 'true';

      const schema = { type: 'object' };
      registry.register('net_tool3', async () => ({ content: 'network result' }), schema, true);

      const res = await router.route({ toolName: 'net_tool3', params: {} });
      expect(res.success).toBe(true);
      expect((res.data as any).content).toBe('network result');
    });

    test('always allows non-network tools regardless of env var', async () => {
      delete process.env.ALLOW_NETWORK_TOOLS;

      const schema = { type: 'object' };
      registry.register(
        'local_tool',
        async () => ({ content: 'local result' }),
        schema,
        false // requiresNetwork = false
      );

      const res = await router.route({ toolName: 'local_tool', params: {} });
      expect(res.success).toBe(true);
      expect((res.data as any).content).toBe('local result');
    });
  });
});
