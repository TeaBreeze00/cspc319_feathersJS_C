# Koa Middleware

This guide explains how to use Koa middleware with FeathersJS v6.

## Prerequisites

You need Node.js 20+ installed and a FeathersJS v6 project.

## Steps

1. Install the Koa adapter
2. Configure middleware
3. Run the server

```typescript
import { feathers } from '@feathersjs/feathers';
import { koa, rest, bodyParser, errorHandler } from '@feathersjs/koa';

const app = koa(feathers());

app.use(errorHandler());
app.use(bodyParser());
app.configure(rest());

app.listen(3030).then(() => {
  console.log('Server running on http://localhost:3030');
});
```

## Custom Middleware

You can add custom Koa middleware before or after the FeathersJS configuration:

```typescript
app.use(async (ctx, next) => {
  console.log(`Request: ${ctx.method} ${ctx.url}`);
  await next();
});
```
