import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { prisma } from './lib/db.js';
import { auth } from './lib/auth.js';
import { errorHandler } from './middlewares/error-handler.js';

// Routes
import { authRoutes } from './routes/auth.js';
import { departamentosRoutes } from './routes/departamentos.js';
import { equiposRoutes } from './routes/equipos.js';
import { cargosRoutes } from './routes/cargos.js';
import { recursosRoutes } from './routes/recursos.js';
import { proyectosRoutes } from './routes/proyectos.js';
import { clientesRoutes } from './routes/clientes.js';
import { tiposActividadRoutes } from './routes/tipos-actividad.js';
import { asignacionesRoutes } from './routes/asignaciones.js';
import { actividadesRoutes } from './routes/actividades.js';
import { materialesRoutes } from './routes/materiales.js';
import { etiquetasRoutes } from './routes/etiquetas.js';
import { materialesCatalogoRoutes } from './routes/materiales-catalogo.js';
import { planningRoutes } from './routes/planning.js';
import { usuariosRoutes } from './routes/usuarios.js';
import { auditoriaRoutes } from './routes/auditoria.js';
import { reportesRoutes } from './routes/reportes.js';
import { healthRoutes } from './routes/health.js';
import { mcpRoutes } from './routes/mcp.js';

const app = new Hono();

// ============================================
// MIDDLEWARE GLOBAL
// ============================================
app.use('*', logger());
app.use('*', cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
app.use('*', errorHandler());

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================
app.route('/api/health', healthRoutes);
app.route('/api/auth', authRoutes);
// Descarga del servidor MCP: publica a proposito (solo entrega el cliente JS)
app.route('/api/mcp', mcpRoutes);

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================
const protectedApp = app.basePath('/api');
// Audit middleware inline para compatibilidad de tipos
protectedApp.use('*', async (c, next) => {
  const method = c.req.method;
  if (method !== 'GET' && !c.req.url.includes('/health')) {
    // Se ejecutará post-auth, aquí solo marcamos
    await next();
    return;
  }
  await next();
});
protectedApp.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c as any).set('user', session.user);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (c as any).set('session', session.session);
  await next();
});

// Register protected routes
protectedApp.route('/departamentos', departamentosRoutes);
protectedApp.route('/equipos', equiposRoutes);
protectedApp.route('/cargos', cargosRoutes);
protectedApp.route('/recursos', recursosRoutes);
protectedApp.route('/proyectos', proyectosRoutes);
protectedApp.route('/clientes', clientesRoutes);
protectedApp.route('/tipos-actividad', tiposActividadRoutes);
protectedApp.route('/asignaciones', asignacionesRoutes);
protectedApp.route('/actividades', actividadesRoutes);
protectedApp.route('/materiales', materialesRoutes);
protectedApp.route('/materiales-catalogo', materialesCatalogoRoutes);
protectedApp.route('/etiquetas', etiquetasRoutes);
protectedApp.route('/planning', planningRoutes);
protectedApp.route('/usuarios', usuariosRoutes);
protectedApp.route('/auditoria', auditoriaRoutes);
protectedApp.route('/reportes', reportesRoutes);

// ============================================
// ERROR HANDLING
// ============================================
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.url }, 404);
});

app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

// ============================================
// START SERVER
// ============================================
const port = parseInt(env.PORT);

console.log(`🚀 Backend running on http://localhost:${port}`);
console.log(`📊 Database: ${env.DATABASE_URL}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
