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
});
