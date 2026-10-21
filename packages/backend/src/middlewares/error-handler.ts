import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

export function errorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof HTTPException) {
        return c.json(
          { error: err.message, code: `HTTP_${err.status}` },
          err.status
        );
      }
      
      if (err instanceof Error) {
        console.error('Unhandled error:', err);
        return c.json(
          { error: 'Internal Server Error', message: err.message, code: 'INTERNAL_ERROR' },
          500
        );
      }

      return c.json({ error: 'Unknown error', code: 'UNKNOWN_ERROR' }, 500);
    }
  };
}
