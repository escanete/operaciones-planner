/**
 * Función serverless que expone toda la API Hono en Vercel.
 * El backend se importa sin arrancar el servidor Node (src/app.ts), de modo
 * que el mismo código sirve en local, Docker y Vercel.
 */
import app from '../packages/backend/src/app';

export default app;
