# Around Hooks Example (MCP Test)

This page demonstrates using an `around` hook in Feathers v6.

## Why around hooks

`around` hooks run before and after the service method in a single function, which is useful for timing, tracing, and transaction-style behavior.

## Example hook

```ts
import type { HookContext, NextFunction } from '../declarations'

export const logRuntime = async (context: HookContext, next: NextFunction) => {
  const start = Date.now()

  try {
    await next()
  } finally {
    const ms = Date.now() - start
    console.log(`${context.path}.${context.method} took ${ms}ms`)
  }
}
```

## Register the hook

```ts
app.service('messages').hooks({
  around: {
    all: [logRuntime]
  }
})
```

## Execution flow

1. Code before `await next()` runs first.
2. Then normal `before` hooks run.
3. Then the service method runs.
4. Then `after` hooks run.
5. Finally code after `await next()` runs.

This makes `around` hooks a clean place for cross-cutting behavior.
