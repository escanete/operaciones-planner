import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================
// DESCARGA DEL SERVIDOR MCP (Claude Desktop)
// - Público: solo entrega el bundle JS del cliente.
//   No hay datos, sesiones ni secretos en ese archivo.
// - En producción el bundle se compila dentro de la imagen
//   Docker (ver packages/backend/Dockerfile) y se copia a
//   /app/public; en desarrollo se usa dist del monorepo.
// ============================================

const mcpRoutes = new Hono();

const CANDIDATOS = [
  process.env.MCP_BUNDLE_PATH,
  '/app/public/operaciones-planner-mcp.js',
  resolve(process.cwd(), '../mcp-server/dist/index.js'),
  resolve(process.cwd(), 'packages/mcp-server/dist/index.js'),
].filter((ruta): ruta is string => Boolean(ruta));

function bundlePath(): string | null {
  return CANDIDATOS.find((ruta) => existsSync(ruta)) ?? null;
}

mcpRoutes.get('/', (c) => {
  return c.json({
    name: 'operaciones-planner-mcp',
    version: '1.0.0',
    download: '/api/mcp/operaciones-planner-mcp.js',
    disponible: bundlePath() !== null,
    requisitos: 'Node.js 20 o superior + Claude Desktop',
    instalacion: 'Ejecutar install.ps1 (Windows) o install.sh (macOS/Linux) y luego --login',
  });
});

mcpRoutes.get('/operaciones-planner-mcp.js', (c) => {
  const archivo = bundlePath();
  if (!archivo) {
    return c.json(
      {
        error: 'El servidor MCP no esta publicado en esta instalacion.',
        code: 'MCP_NO_DISPONIBLE',
        detalle: 'Pide a TI que reconstruya el backend (docker compose up -d --build).',
      },
      404
    );
  }

  const contenido = readFileSync(archivo);
  return c.body(contenido, 200, {
    'Content-Type': 'text/javascript; charset=utf-8',
    'Content-Disposition': 'attachment; filename="operaciones-planner-mcp.js"',
    'Cache-Control': 'no-store',
    'Content-Length': String(contenido.length),
  });
});

export { mcpRoutes };
