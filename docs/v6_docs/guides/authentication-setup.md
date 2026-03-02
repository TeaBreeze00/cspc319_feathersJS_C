# Authentication Setup

FeathersJS v6 ships with a flexible authentication system built on JWTs and
pluggable strategies. This guide walks through adding local (email + password)
authentication to a new application.

## Install dependencies

```bash
npm install @feathersjs/authentication @feathersjs/authentication-local
```

## Configure the authentication service

```typescript
// src/authentication.ts
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { LocalStrategy } from '@feathersjs/authentication-local';
import type { Application } from './declarations';

declare module './declarations' {
  interface ServiceTypes {
    authentication: AuthenticationService;
  }
}

export const authentication = (app: Application) => {
  const authService = new AuthenticationService(app);

  authService.register('jwt', new JWTStrategy());
  authService.register('local', new LocalStrategy());

  app.use('authentication', authService);
};
```

## Protect a service

```typescript
import { authenticate } from '@feathersjs/authentication';

app.service('messages').hooks({
  before: {
    all: [authenticate('jwt')],
  },
});
```

## Obtain a token

```bash
curl -X POST http://localhost:3030/authentication \
  -H 'Content-Type: application/json' \
  -d '{"strategy":"local","email":"user@example.com","password":"secret"}'
```

The response contains an `accessToken` you can pass as a `Bearer` header on
subsequent requests.
