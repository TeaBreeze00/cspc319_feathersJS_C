/**
 * Timeout wrapper for async functions used by the routing layer
 */

export class TimeoutError extends Error {
  code: string;
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export async function withTimeout<T>(fn: () => Promise<T>, ms = 10000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  return await new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    // Start timeout
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError());
    }, ms) as unknown as NodeJS.Timeout;

    // Execute the function
    fn()
      .then((res) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(res);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });
  });
}

export default withTimeout;
