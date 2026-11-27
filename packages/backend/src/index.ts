import { serve } from '@hono/node-server';
import app from './app.js';
import { env } from './lib/env.js';

// Entrypoint para desarrollo local y Docker. En Vercel no se usa este archivo:
// la función `api/[...path].ts` importa `app.ts` directamente (sin `serve`).
const port = parseInt(env.PORT);

console.log('Backend running on http://localhost:' + port);
console.log('Database: ' + env.DATABASE_URL);

serve({
  fetch: app.fetch,
  port,
});
