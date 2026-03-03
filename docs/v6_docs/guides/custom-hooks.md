# Custom Hooks

Hooks are the primary way to add cross-cutting logic in FeathersJS — think
validation, authorization, logging, and data transformation.

## Anatomy of a hook

```typescript
import type { HookContext } from '../declarations';

// A simple before-create hook that stamps a createdAt field
export const addTimestamp = async (context: HookContext) => {
  context.data = {
    ...context.data,
    createdAt: new Date().toISOString(),
  };
  return context;
};
```

## Registering hooks on a service

```typescript
app.service('messages').hooks({
  before: {
    create: [addTimestamp],
    patch: [addTimestamp],
  },
});
```

## Around hooks (v6+)

Around hooks wrap the entire method call, giving you control of both
the before and after phases in one function:

```typescript
export const logDuration = async (context: HookContext, next: Function) => {
  const start = Date.now();
  await next();
  console.log(`${context.method} took ${Date.now() - start} ms`);
};
```

## Unit-testing a hook

```typescript
import { addTimestamp } from './hooks/addTimestamp';

test('stamps createdAt', async () => {
  const ctx: any = { data: { text: 'hello' } };
  await addTimestamp(ctx);
  expect(ctx.data.createdAt).toBeDefined();
});
```
I am adding this just to make our lives easier
