import { Hono } from 'hono';
import type { Context } from 'hono';
import { prisma } from '../lib/db.js';
import { env } from '../lib/env.js';
import { esErrorNoConectado, getGraphAccessToken } from '../lib/graph-session.js';
import { GraphNoConfiguradoError, GraphRequestError } from '../lib/msgraph.js';
import {
  createShareLink,
  deleteProjectFile,
  ensureProjectFolder,
  getDownloadUrl,
  listProjectFiles,
  uploadProjectFile,
} from '../lib/sharepoint.js';
import { getUser } from '../types/index.js';

/* ============================================================
   Archivos de proyecto en SharePoint

   GET    /api/proyectos/:id/archivos
   POST   /api/proyectos/:id/archivos            (multipart: archivo)
   GET    /api/proyectos/:id/archivos/carpeta
   GET    /api/proyectos/:id/archivos/:fileId/descarga
   GET    /api/proyectos/:id/archivos/:fileId/enlace?tipo=view|edit
   DELETE /api/proyectos/:id/archivos/:fileId

   Todas las operaciones usan el token delegado del usuario: SharePoint
   aplica sus propios permisos sobre la carpeta.
   ============================================================ */

const archivosRoutes = new Hono();

const ROLES_ESCRITURA = ['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL'];

function urlLogin(c: Context): string {
  const proyectoId = c.req.param('id') ?? '';
  const destino = proyectoId ? `/proyectos/${proyectoId}` : '/';
  return `/api/auth/msgraph/login?redirect=${encodeURIComponent(destino)}`;
}

function respuestaNoConectado(c: Context) {
  return c.json(
    {
      error: 'Conecta tu cuenta de Microsoft para acceder a los archivos del proyecto',
      code: 'MSGRAPH_NOT_CONNECTED',
      authUrl: urlLogin(c),
    },
    409
  );
}

function responderError(c: Context, err: unknown) {
  if (err instanceof GraphNoConfiguradoError) {
    return c.json(
      {
        error: 'SharePoint no está configurado en el servidor',
        code: 'MSGRAPH_NO_CONFIGURADO',
        detalle: err.message,
      },
      503
    );
  }

  if (esErrorNoConectado(err)) {
    return respuestaNoConectado(c);
  }

  if (err instanceof GraphRequestError) {
    if (err.status === 401) {
      return respuestaNoConectado(c);
    }
    return c.json(
      { error: err.message, code: err.code, detalle: err.detalle ?? null },
      (err.status >= 400 && err.status <= 599 ? err.status : 500) as 400
    );
  }

  const mensaje = err instanceof Error ? err.message : String(err);
  console.error('Error de SharePoint:', err);
  return c.json(
    { error: 'No se pudo completar la operación con SharePoint', detalle: mensaje },
    500
  );
}

async function proyectoExiste(proyectoId: string): Promise<boolean> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true },
  });
  return Boolean(proyecto);
}

function puedeEscribir(c: Context): boolean {
  const user = getUser(c);
  return ROLES_ESCRITURA.includes(user.rol);
}

/* ============================================================
   Listar archivos
   ============================================================ */
archivosRoutes.get('/:id/archivos', async (c) => {
  const proyectoId = c.req.param('id');

  if (!(await proyectoExiste(proyectoId))) {
    return c.json({ error: 'Proyecto no encontrado' }, 404);
  }

  const token = await getGraphAccessToken(c);
  if (!token) return respuestaNoConectado(c);

  try {
    const { carpeta, archivos } = await listProjectFiles(token, proyectoId);
    return c.json({ carpeta, archivos });
  } catch (err) {
    return responderError(c, err);
  }
});

/* ============================================================
   Datos de la carpeta del proyecto
   ============================================================ */
archivosRoutes.get('/:id/archivos/carpeta', async (c) => {
  const proyectoId = c.req.param('id');

  if (!(await proyectoExiste(proyectoId))) {
    return c.json({ error: 'Proyecto no encontrado' }, 404);
  }

  const token = await getGraphAccessToken(c);
  if (!token) return respuestaNoConectado(c);

  try {
    const carpeta = await ensureProjectFolder(token, proyectoId);
    return c.json({ carpeta });
  } catch (err) {
    return responderError(c, err);
  }
});

/* ============================================================
   Subir archivo (arrayBuffer en memoria, límite configurable)
   ============================================================ */
archivosRoutes.post('/:id/archivos', async (c) => {
  const proyectoId = c.req.param('id');

  if (!(await proyectoExiste(proyectoId))) {
    return c.json({ error: 'Proyecto no encontrado' }, 404);
  }

  if (!puedeEscribir(c)) {
    return c.json({ error: 'No tienes permisos para subir archivos', code: 'FORBIDDEN' }, 403);
  }

  const token = await getGraphAccessToken(c);
  if (!token) return respuestaNoConectado(c);

  try {
    const formData = await c.req.formData();
    const archivo = (formData.get('archivo') ?? formData.get('file')) as File | null;

    if (!archivo || typeof archivo === 'string') {
      return c.json({ error: 'No se recibió ningún archivo (campo "archivo")' }, 400);
    }

    const nombre = archivo.name?.trim();
    if (!nombre) {
      return c.json({ error: 'El archivo no tiene nombre' }, 400);
    }

    if (nombre.includes('/') || nombre.includes('\\')) {
      return c.json({ error: 'El nombre del archivo no es válido' }, 400);
    }

    const maximo = env.MS_GRAPH_MAX_UPLOAD_MB * 1024 * 1024;
    if (archivo.size > maximo) {
      return c.json(
        {
          error: `El archivo supera el máximo permitido (${env.MS_GRAPH_MAX_UPLOAD_MB} MB)`,
          code: 'ARCHIVO_DEMASIADO_GRANDE',
        },
        413
      );
    }

    const contenido = Buffer.from(await archivo.arrayBuffer());

    const subido = await uploadProjectFile(
      token,
      proyectoId,
      nombre,
      contenido,
      archivo.type || 'application/octet-stream'
    );

    return c.json({ archivo: subido }, 201);
  } catch (err) {
    return responderError(c, err);
  }
});

/* ============================================================
   Descargar: se resuelve la URL pre-autenticada de Graph y se redirige
   ============================================================ */
archivosRoutes.get('/:id/archivos/:fileId/descarga', async (c) => {
  const proyectoId = c.req.param('id');
  const fileId = c.req.param('fileId');

  const token = await getGraphAccessToken(c);
  if (!token) return respuestaNoConectado(c);

  try {
    const { url } = await getDownloadUrl(token, proyectoId, fileId);
    return c.redirect(url);
  } catch (err) {
    return responderError(c, err);
  }
});

/* ============================================================
   Enlace para compartir / abrir en SharePoint
   ============================================================ */
archivosRoutes.get('/:id/archivos/:fileId/enlace', async (c) => {
  const proyectoId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const tipo = c.req.query('tipo') === 'edit' ? 'edit' : 'view';

  if (!puedeEscribir(c)) {
    return c.json({ error: 'No tienes permisos para compartir archivos', code: 'FORBIDDEN' }, 403);
  }

  const token = await getGraphAccessToken(c);
  if (!token) return respuestaNoConectado(c);

  try {
    const enlace = await createShareLink(token, proyectoId, fileId, tipo);
    return c.json({ enlace });
  } catch (err) {
    return responderError(c, err);
  }
});

/* ============================================================
   Eliminar archivo
   ============================================================ */
archivosRoutes.delete('/:id/archivos/:fileId', async (c) => {
  const proyectoId = c.req.param('id');
  const fileId = c.req.param('fileId');

  if (!puedeEscribir(c)) {
    return c.json({ error: 'No tienes permisos para eliminar archivos', code: 'FORBIDDEN' }, 403);
  }

  const token = await getGraphAccessToken(c);
  if (!token) return respuestaNoConectado(c);

  try {
    await deleteProjectFile(token, proyectoId, fileId);
    return c.json({ ok: true });
  } catch (err) {
    return responderError(c, err);
  }
});

export { archivosRoutes as projectFilesRoutes };
