import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================
// DESCARGA DEL SERVIDOR MCP (Claude Desktop)
// - Público: solo entrega el bundle JS del cliente y los instaladores.
//   No hay datos, sesiones ni secretos en esos archivos.
// - En producción se compilan dentro de la imagen Docker (ver
//   packages/backend/Dockerfile) y se copian a /app/public;
//   en desarrollo se usan los archivos del monorepo.
// ============================================

const mcpRoutes = new Hono();

interface Recurso {
  archivo: string;
  contentType: string;
  candidatos: string[];
}

function candidatos(...rutas: Array<string | undefined>): string[] {
  return [
    ...rutas.filter((ruta): ruta is string => Boolean(ruta)),
    resolve(process.cwd(), '../mcp-server/dist/index.js'),
    resolve(process.cwd(), 'packages/mcp-server/dist/index.js'),
  ];
}

const RECURSOS: Record<string, Recurso> = {
  'operaciones-planner-mcp.js': {
    archivo: 'operaciones-planner-mcp.js',
    contentType: 'text/javascript; charset=utf-8',
    candidatos: candidatos(
      process.env.MCP_BUNDLE_PATH,
      '/app/public/operaciones-planner-mcp.js'
    ),
  },
  'install.ps1': {
    archivo: 'install.ps1',
    contentType: 'text/plain; charset=utf-8',
    candidatos: [
      '/app/public/install.ps1',
      resolve(process.cwd(), '../mcp-server/install/install.ps1'),
      resolve(process.cwd(), 'packages/mcp-server/install/install.ps1'),
    ],
  },
  'install.sh': {
    archivo: 'install.sh',
    contentType: 'text/plain; charset=utf-8',
    candidatos: [
      '/app/public/install.sh',
      resolve(process.cwd(), '../mcp-server/install/install.sh'),
      resolve(process.cwd(), 'packages/mcp-server/install/install.sh'),
    ],
  },
};

function resolver(recurso: Recurso): string | null {
  return recurso.candidatos.find((ruta) => existsSync(ruta)) ?? null;
}

mcpRoutes.get('/', (c) => {
  const disponibles = Object.entries(RECURSOS).map(([nombre, recurso]) => ({
    archivo: nombre,
    url: `/api/mcp/${nombre}`,
    disponible: resolver(recurso) !== null,
  }));

  return c.json({
    name: 'operaciones-planner-mcp',
    version: '1.0.0',
    requisitos: 'Node.js 20 o superior + Claude Desktop',
    instalacion: 'Descargar install.ps1 (Windows) o install.sh (macOS/Linux) y ejecutarlo',
    archivos: disponibles,
  });
});

mcpRoutes.get('/:archivo', (c) => {
  const nombre = c.req.param('archivo');
  const recurso = RECURSOS[nombre];
  if (!recurso) {
    return c.json({ error: 'Archivo no encontrado', code: 'MCP_NO_ENCONTRADO' }, 404);
  }

  const ruta = resolver(recurso);
  if (!ruta) {
    return c.json(
      {
        error: 'El servidor MCP no esta publicado en esta instalacion.',
        code: 'MCP_NO_DISPONIBLE',
        detalle: 'Pide a TI que reconstruya el backend (docker compose up -d --build).',
      },
      404
    );
  }

  const contenido = readFileSync(ruta);
  return c.body(contenido, 200, {
    'Content-Type': recurso.contentType,
    'Content-Disposition': `attachment; filename="${recurso.archivo}"`,
    'Cache-Control': 'no-store',
    'Content-Length': String(contenido.length),
  });
});

export { mcpRoutes };
