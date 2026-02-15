/// <reference types="jest" />

import { withTimeout, TimeoutError } from '../../src/routing/timeout';

describe('withTimeout', () => {
  test('fast function completes successfully', async () => {
    const result = await withTimeout(() => Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  test('slow function rejects with TimeoutError', async () => {
    await expect(
      withTimeout(() => new Promise((r) => setTimeout(r, 500)), 50)
    ).rejects.toThrow(TimeoutError);
  });

  test('TimeoutError has code TIMEOUT', async () => {
    try {
      await withTimeout(() => new Promise((r) => setTimeout(r, 500)), 50);
      fail('should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect(err.code).toBe('TIMEOUT');
    }
  });

  test('uses default timeout of 10000ms when not specified', async () => {
    // A fast function should complete within the default timeout
    const result = await withTimeout(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  test('propagates errors from the function itself', async () => {
    await expect(
      withTimeout(() => Promise.reject(new Error('boom')), 5000)
    ).rejects.toThrow('boom');
  });
});
