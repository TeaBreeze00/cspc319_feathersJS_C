# Custom Hooks (Updated)

Hooks are the primary way to add cross-cutting logic in FeathersJS — think
validation, authorization, logging, and data transformation.

## Anatomy of a hook

```typescript
import type { HookContext } from '../declarations';

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

## Around hooks (v6+ — NEW SECTION)

Around hooks are the recommended pattern in v6. They wrap the entire method
call, giving you control of both the before and after phases:

```typescript
export const logDuration = async (context: HookContext, next: Function) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${context.method} on ${context.path} took ${ms}ms`);
};
```

## Composing multiple hooks

```typescript
import { hooks } from '@feathersjs/hooks';

const composed = hooks([validateData, addTimestamp, logDuration]);
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
