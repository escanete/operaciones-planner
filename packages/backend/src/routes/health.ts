import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { env } from '../lib/env.js';

const healthRoutes = new Hono();

healthRoutes.get('/', async (c) => {
  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
  }

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database: dbStatus,
    version: '1.0.0',
  });
});

healthRoutes.get('/db', async (c) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    return c.json({ status: 'ok', database: 'connected', result });
  } catch (error) {
    return c.json({ status: 'error', database: 'disconnected', error: String(error) }, 500);
  }
});

export { healthRoutes };
