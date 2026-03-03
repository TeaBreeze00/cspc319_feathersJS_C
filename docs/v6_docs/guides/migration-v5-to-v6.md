# Migrating from v5 to v6

FeathersJS v6 introduced a number of breaking changes alongside significant
improvements to TypeScript support, composable hooks, and schema validation.

## 1. Update dependencies

```bash
npm install @feathersjs/feathers@6 @feathersjs/koa@6 \
            @feathersjs/socketio@6 @feathersjs/authentication@6
```

## 2. Replace Express adapter with Koa (recommended)

v6 ships a first-class Koa adapter. Express is still supported but the
new generator defaults to Koa:

```typescript
// v5
import express from '@feathersjs/express';
const app = express(feathers());

// v6
import { koa } from '@feathersjs/koa';
const app = koa(feathers());
```

## 3. Around hooks replace legacy before/after/error triples

```typescript
// v5 — separate before & after
app.service('messages').hooks({
  before: { create: [validateData] },
  after:  { create: [formatResponse] },
});

// v6 — single around hook
app.service('messages').hooks({
  around: {
    create: [async (ctx, next) => {
      validateData(ctx);
      await next();
      formatResponse(ctx);
    }],
  },
});
```

## 4. Schema & resolvers replace deprecated `@feathersjs/schema` v1

Use the new `@feathersjs/typebox` or `@feathersjs/schema` v2 resolvers:

```typescript
import { resolve } from '@feathersjs/schema';
import { Type, getDataValidator } from '@feathersjs/typebox';

export const messageSchema = Type.Object({
  id:        Type.Number(),
  text:      Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});
```

## 5. Run the migration codemod (optional)

```bash
npx @feathersjs/cli migrate
```

I am changing this here to see if it gets picked up by github automatically or not.
