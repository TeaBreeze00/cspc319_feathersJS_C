# Hooks Demo (Feathers v6)

This demo shows a minimal hook setup for a `messages` service.

## Service Hook Registration

```ts
import { logRuntime, requireText, sanitizeResult, normalizeError } from '../../hooks/demo-hooks'

app.service('messages').hooks({
  around: {
    all: [logRuntime]
  },
  before: {
    create: [requireText]
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
  await next()
  const ms = Date.now() - start
  console.log(`${context.path}.${context.method} took ${ms}ms`)
}

export const requireText = async (context: HookContext) => {
  const text = context.data?.text

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new BadRequest('Message text is required')
  }
}

export const sanitizeResult = async (context: HookContext) => {
  const strip = (item: any) => {
    if (item && typeof item === 'object') {
      delete item.internalNotes
    }
    return item
  }

  if (Array.isArray(context.result?.data)) {
    context.result.data = context.result.data.map(strip)
  } else if (Array.isArray(context.result)) {
    context.result = context.result.map(strip)
  } else {
    context.result = strip(context.result)
  }
}

export const normalizeError = async (context: HookContext) => {
  if (context.error && !context.error.code) {
    context.error = new BadRequest('Request failed')
  }
}
```

## Notes

- `around` wraps the full lifecycle (`before` + service method + `after`).
- `before` is best for validation and input shaping.
- `after` is best for response shaping.
- `error` is best for consistent error formatting.
