import type { Context, Next } from 'hono';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

// Middleware to log API calls for audit trail
export function auditMiddleware() {
  return async (c: Context, next: Next) => {
    let userId: string | undefined;
    
    try {
      userId = getUser(c)?.id;
    } catch {
      // No user in context, skip
    }
    
    const method = c.req.method;
    const path = c.req.url;
    
    if (method === 'GET' || path.includes('/health')) {
      await next();
      return;
    }

    await next();
    
    if (userId && (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH')) {
      try {
        await prisma.auditoria.create({
          data: {
            userId,
            accion: method,
            entidad: path,
            entidadId: path,
            ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? '',
            userAgent: c.req.header('user-agent') ?? '',
          },
        });
      } catch (error) {
        console.error('Failed to audit log:', error);
      }
    }
  };
}
