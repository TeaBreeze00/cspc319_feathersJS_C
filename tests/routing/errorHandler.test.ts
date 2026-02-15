/// <reference types="jest" />

import { ErrorHandler } from '../../src/routing/errorHandler';
import { TimeoutError } from '../../src/routing/timeout';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler();
    // Silence stderr output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('maps validation-style error to INVALID_PARAMS', () => {
    const err = {
      name: 'ValidationError',
      message: 'bad params',
      errors: [{ path: '/name', message: 'required' }],
    };
    const result = handler.handle(err);
    expect(result.code).toBe('INVALID_PARAMS');
    expect(result.message).toBe('bad params');
  });

  test('maps TimeoutError to TIMEOUT', () => {
    const err = new TimeoutError('took too long');
    const result = handler.handle(err);
    expect(result.code).toBe('TIMEOUT');
    expect(result.message).toBe('took too long');
  });

  test('maps unknown error to INTERNAL_ERROR', () => {
    const err = new Error('something broke');
    const result = handler.handle(err);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('something broke');
  });

  test('handles non-Error objects gracefully', () => {
    const result = handler.handle('string error');
    expect(result.code).toBe('INTERNAL_ERROR');
  });
});
