# Services & Real-Time Events

Services are the heart of every FeathersJS application. Any object that
implements one or more of the standard service methods (`find`, `get`,
`create`, `patch`, `update`, `remove`) can be registered as a service.

## Defining a minimal service

```typescript
import type { Params } from '@feathersjs/feathers';

class MessageService {
  private messages: any[] = [];

  async find(_params?: Params) {
    return this.messages;
  }

  async create(data: any, _params?: Params) {
    const message = { id: Date.now(), ...data };
    this.messages.push(message);
    return message;
  }
}

app.use('messages', new MessageService());
```

## Listening to real-time events on the client

```typescript
import { io } from 'socket.io-client';
import { feathers } from '@feathersjs/feathers';
import socketio from '@feathersjs/socketio-client';

const socket = io('http://localhost:3030');
const client = feathers().configure(socketio(socket));

client.service('messages').on('created', (message) => {
  console.log('New message:', message);
});
```

## Channels — controlling who receives events

```typescript
// src/channels.ts
app.on('connection', (connection) => {
  app.channel('anonymous').join(connection);
});

app.publish((data, context) => {
  return app.channel('anonymous');
});
```
