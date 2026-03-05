# Hooks Demo (Feathers v6)

This demo shows a practical hook setup for a `messages` service, including `around`, `before`, `after`, and `error` hooks.

## Service Hook Registration

```ts
import {
  logRuntime,
  requireText,
  stampUpdatedAt,
  sanitizeResult,
  normalizeError
} from '../../hooks/demo-hooks'

app.service('messages').hooks({
  around: {
    all: [logRuntime]
  },
  before: {
    create: [requireText],
    patch: [stampUpdatedAt]
  },
  after: {
    all: [sanitizeResult]
  },
  error: {
    all: [normalizeError]
  }
})
```

## Demo Hook Implementations

```ts
import { BadRequest } from '@feathersjs/errors'
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

export const requireText = async (context: HookContext) => {
  const text = context.data?.text

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new BadRequest('Message text is required')
  }
}

export const stampUpdatedAt = async (context: HookContext) => {
  context.data = {
    ...context.data,
    updatedAt: new Date().toISOString()
  }
}

export const sanitizeResult = async (context: HookContext) => {
  const strip = (item: any) => {
    if (item && typeof item === 'object') {
      delete item.internalNotes
    }

    return item
  }

  const result = context.result as any

  // Paginated results: { total, limit, skip, data: [] }
  if (result && Array.isArray(result.data)) {
    result.data = result.data.map(strip)
    context.result = result
    return
  }

  // Multi results: []
  if (Array.isArray(result)) {
    context.result = result.map(strip)
    return
  }

  // Single result: {}
  context.result = strip(result)
}

export const normalizeError = async (context: HookContext) => {
  if (context.error && !context.error.code) {
    context.error = new BadRequest('Request failed')
  }
}
```

## Around Hook Flow

`around` hooks wrap the full lifecycle:

1. Code before `await next()` runs first.
2. Then `before` hooks run.
3. Then the service method runs.
4. Then `after` hooks run.
5. Finally, code after `await next()` runs.

This makes `around` hooks ideal for timing, tracing, and transaction boundaries.

## Quick Testing Pattern

```ts
import { requireText } from './demo-hooks'

test('requireText throws when text is missing', async () => {
  await expect(requireText({ data: {} } as any)).rejects.toBeTruthy()
})
```

## Notes

- Use `before` for validation and input shaping.
- Use `after` for response shaping.
- Use `error` for consistent error formatting.
- Use `around` for cross-cutting behavior that must run around the entire call.
