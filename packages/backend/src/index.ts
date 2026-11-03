import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { auth } from './lib/auth.js';
import { errorHandler } from './middlewares/error-handler.js';

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
import { msgraphRoutes } from './routes/msgraph-auth.js';
import { projectFilesRoutes } from './routes/project-files.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use('*', errorHandler());

/* ============================================================
   Rutas públicas (sin sesión de la app)
   ============================================================ */

// Health y MCP autentican por su cuenta (MCP usa su propio token)
app.route('/api/health', healthRoutes);
app.route('/api/mcp', mcpRoutes);

// IMPORTANTE: /api/auth/msgraph debe ir ANTES de /api/auth, porque
// Better-Auth captura todo /api/auth/* y respondería 404 a estas rutas.
app.route('/api/auth/msgraph', msgraphRoutes);
app.route('/api/auth', authRoutes);

/* ============================================================
   API protegida: requiere sesión de la aplicación
   ============================================================ */
const api = new Hono();

api.use('*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }
  (c as any).set('user', session.user);
  (c as any).set('session', session.session);
  await next();
});

api.route('/departamentos', departamentosRoutes);
api.route('/equipos', equiposRoutes);
api.route('/cargos', cargosRoutes);
api.route('/recursos', recursosRoutes);
api.route('/proyectos', proyectosRoutes);
api.route('/proyectos', projectFilesRoutes);
api.route('/clientes', clientesRoutes);
api.route('/tipos-actividad', tiposActividadRoutes);
api.route('/asignaciones', asignacionesRoutes);
api.route('/actividades', actividadesRoutes);
api.route('/materiales', materialesRoutes);
api.route('/materiales-catalogo', materialesCatalogoRoutes);
api.route('/etiquetas', etiquetasRoutes);
api.route('/planning', planningRoutes);
api.route('/usuarios', usuariosRoutes);
api.route('/auditoria', auditoriaRoutes);
api.route('/reportes', reportesRoutes);

app.route('/api', api);

app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.url }, 404);
});

app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

const port = parseInt(env.PORT);

console.log('Backend running on http://localhost:' + port);
console.log('Database: ' + env.DATABASE_URL);

serve({
  fetch: app.fetch,
  port,
});

export default app;
