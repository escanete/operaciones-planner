import { env } from './env.js';
import { GraphRequestError, graphGetAll, graphRequest, resolveSiteAndDrive } from './msgraph.js';

/* ============================================================
   Archivos de proyecto en SharePoint

   Estructura: {MS_GRAPH_FOLDER_ROOT}/{proyectoId}/
   Todas las llamadas usan el token DELEGADO del usuario, por lo que
   SharePoint aplica sus propios permisos.
   ============================================================ */

export interface ArchivoProyecto {
  id: string;
  nombre: string;
  tamano: number;
  modificado: string | null;
  creado: string | null;
  webUrl: string;
  tipoMime: string;
  subidoPor: string | null;
  esCarpeta: boolean;
}

export interface CarpetaProyecto {
  folderId: string;
  folderPath: string;
  webUrl: string;
  driveId: string;
}

export interface SubidaProyecto {
  archivo: ArchivoProyecto;
}

const TAMANO_SIMPLE = 4 * 1024 * 1024; // límite de Graph para PUT directo
const TAMANO_BLOQUE = 10 * 1024 * 1024; // múltiplo de 320 KiB (requisito de Graph)

function normalizarSegmentos(...partes: string[]): string[] {
  return partes
    .join('/')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

function rutaCodificada(segmentos: string[]): string {
  return segmentos.map((s) => encodeURIComponent(s)).join('/');
}

function mapearArchivo(item: Record<string, any>): ArchivoProyecto {
  const creador = item.createdBy?.user ?? item.lastModifiedBy?.user ?? null;
  return {
    id: item.id,
    nombre: item.name,
    tamano: Number(item.size ?? 0),
    modificado: item.lastModifiedDateTime ?? null,
    creado: item.createdDateTime ?? null,
    webUrl: item.webUrl ?? '',
    tipoMime: item.file?.mimeType ?? 'application/octet-stream',
    subidoPor: creador?.displayName ?? creador?.email ?? null,
    esCarpeta: Boolean(item.folder),
  };
}

/**
 * Asegura que exista la carpeta del proyecto y devuelve su id/URL.
 * Crea los segmentos que falten (Operaciones → Planner_Proyectos → proyecto).
 */
export async function ensureProjectFolder(
  accessToken: string,
  proyectoId: string
): Promise<CarpetaProyecto> {
  const { driveId, driveWebUrl } = await resolveSiteAndDrive(accessToken);
  const segmentos = normalizarSegmentos(env.MS_GRAPH_FOLDER_ROOT, proyectoId);

  let parentId = 'root';
  let rutaActual: string[] = [];
  let carpeta: Record<string, any> | null = null;

  for (const segmento of segmentos) {
    rutaActual = [...rutaActual, segmento];
    const ruta = rutaCodificada(rutaActual);

    try {
      const item = await graphRequest<Record<string, any>>(
        accessToken,
        `/drives/${driveId}/root:/${ruta}?$select=id,name,folder,webUrl`
      );
      if (!item.folder) {
        throw new GraphRequestError(
          `"${rutaActual.join('/')}" existe pero no es una carpeta`,
          409,
          'NOT_A_FOLDER'
        );
      }
      parentId = item.id;
      carpeta = item;
    } catch (err) {
      if (!(err instanceof GraphRequestError) || err.status !== 404) throw err;

      try {
        const creada = await graphRequest<Record<string, any>>(
          accessToken,
          `/drives/${driveId}/items/${parentId}/children`,
          {
            method: 'POST',
            body: JSON.stringify({
              name: segmento,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'fail',
            }),
          }
        );
        parentId = creada.id;
        carpeta = creada;
      } catch (crearErr) {
        // Otra persona la creó al mismo tiempo: reintentamos leerla
        if (crearErr instanceof GraphRequestError && crearErr.status === 409) {
          const item = await graphRequest<Record<string, any>>(
            accessToken,
            `/drives/${driveId}/root:/${ruta}?$select=id,name,folder,webUrl`
          );
          parentId = item.id;
          carpeta = item;
        } else {
          throw crearErr;
        }
      }
    }
  }

  return {
    folderId: parentId,
    folderPath: segmentos.join('/'),
    webUrl: carpeta?.webUrl ?? driveWebUrl,
    driveId,
  };
}

/** Lista los archivos (no subcarpetas) de la carpeta del proyecto */
export async function listProjectFiles(
  accessToken: string,
  proyectoId: string
): Promise<{ carpeta: CarpetaProyecto; archivos: ArchivoProyecto[] }> {
  const carpeta = await ensureProjectFolder(accessToken, proyectoId);

  const items = await graphGetAll<Record<string, any>>(
    accessToken,
    `/drives/${carpeta.driveId}/items/${carpeta.folderId}/children` +
      '?$select=id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,createdBy,lastModifiedBy' +
      '&$top=200'
  );

  const archivos = items
    .filter((item) => item.file)
    .map(mapearArchivo)
    .sort((a, b) => (b.modificado ?? '').localeCompare(a.modificado ?? ''));

  return { carpeta, archivos };
}

/** Comprueba que el item pertenece a la carpeta del proyecto */
async function assertItemDelProyecto(
  accessToken: string,
  proyectoId: string,
  itemId: string
): Promise<{ carpeta: CarpetaProyecto; item: Record<string, any> }> {
  const carpeta = await ensureProjectFolder(accessToken, proyectoId);
  const item = await graphRequest<Record<string, any>>(
    accessToken,
    `/drives/${carpeta.driveId}/items/${itemId}` +
      '?$select=id,name,size,webUrl,file,folder,parentReference'
  );

  if (item.parentReference?.id !== carpeta.folderId) {
    throw new GraphRequestError(
      'El archivo no pertenece a la carpeta de este proyecto',
      403,
      'ITEM_FUERA_DEL_PROYECTO'
    );
  }

  return { carpeta, item };
}

/** Sube un archivo a la carpeta del proyecto (directo o por sesión) */
export async function uploadProjectFile(
  accessToken: string,
  proyectoId: string,
  nombre: string,
  contenido: Buffer,
  tipoMime: string
): Promise<ArchivoProyecto> {
  const carpeta = await ensureProjectFolder(accessToken, proyectoId);
  const nombreCodificado = encodeURIComponent(nombre);

  if (contenido.length <= TAMANO_SIMPLE) {
    const item = await graphRequest<Record<string, any>>(
      accessToken,
      `/drives/${carpeta.driveId}/items/${carpeta.folderId}:/${nombreCodificado}:/content` +
        '?@microsoft.graph.conflictBehavior=rename',
      {
        method: 'PUT',
        headers: { 'Content-Type': tipoMime || 'application/octet-stream' },
        body: contenido,
      }
    );
    return mapearArchivo(item);
  }

  return subirPorSesion(accessToken, carpeta, nombre, contenido, tipoMime);
}

async function subirPorSesion(
  accessToken: string,
  carpeta: CarpetaProyecto,
  nombre: string,
  contenido: Buffer,
  tipoMime: string
): Promise<ArchivoProyecto> {
  const nombreCodificado = encodeURIComponent(nombre);
  const sesion = await graphRequest<{ uploadUrl: string }>(
    accessToken,
    `/drives/${carpeta.driveId}/items/${carpeta.folderId}:/${nombreCodificado}:/createUploadSession`,
    {
      method: 'POST',
      body: JSON.stringify({
        item: {
          name: nombre,
          '@microsoft.graph.conflictBehavior': 'rename',
          ...(tipoMime ? { file: {} } : {}),
        },
      }),
    }
  );

  const total = contenido.length;
  let inicio = 0;
  let ultimo: Record<string, any> | null = null;

  while (inicio < total) {
    const fin = Math.min(inicio + TAMANO_BLOQUE, total) - 1;
    const bloque = contenido.subarray(inicio, fin + 1);

    const res = await fetch(sesion.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(bloque.length),
        'Content-Range': `bytes ${inicio}-${fin}/${total}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bloque,
    });

    const cuerpo = await res.text();
    const json = cuerpo ? JSON.parse(cuerpo) : null;

    if (!res.ok) {
      throw new GraphRequestError(
        json?.error?.message ?? `Falló la subida del bloque (${res.status})`,
        res.status,
        json?.error?.code ?? 'UPLOAD_FAILED'
      );
    }

    ultimo = json;
    inicio = fin + 1;
  }

  if (!ultimo?.id) {
    throw new GraphRequestError('SharePoint no confirmó el archivo subido', 502, 'UPLOAD_SIN_RESPUESTA');
  }

  return mapearArchivo(ultimo);
}

export async function deleteProjectFile(
  accessToken: string,
  proyectoId: string,
  itemId: string
): Promise<void> {
  const { carpeta } = await assertItemDelProyecto(accessToken, proyectoId, itemId);
  await graphRequest<void>(accessToken, `/drives/${carpeta.driveId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

/** Enlace de descarga temporal (pre-autenticado por Graph) */
export async function getDownloadUrl(
  accessToken: string,
  proyectoId: string,
  itemId: string
): Promise<{ url: string; nombre: string }> {
  const { carpeta, item } = await assertItemDelProyecto(accessToken, proyectoId, itemId);

  const detalle = await graphRequest<Record<string, any>>(
    accessToken,
    `/drives/${carpeta.driveId}/items/${item.id}?$select=id,name,@microsoft.graph.downloadUrl`
  );

  const url = detalle['@microsoft.graph.downloadUrl'];
  if (!url) {
    throw new GraphRequestError(
      'SharePoint no entregó una URL de descarga para este archivo',
      502,
      'SIN_DOWNLOAD_URL'
    );
  }

  return { url, nombre: detalle.name ?? item.name };
}

export async function createShareLink(
  accessToken: string,
  proyectoId: string,
  itemId: string,
  tipo: 'view' | 'edit' = 'view'
): Promise<{ webUrl: string; tipo: string; alcance: string }> {
  const { carpeta } = await assertItemDelProyecto(accessToken, proyectoId, itemId);

  const resultado = await graphRequest<{
    link: { webUrl: string; type: string; scope: string };
  }>(accessToken, `/drives/${carpeta.driveId}/items/${itemId}/createLink`, {
    method: 'POST',
    body: JSON.stringify({
      type: tipo,
      scope: env.MS_GRAPH_SHARE_SCOPE === 'anonymous' ? 'anonymous' : 'organization',
    }),
  });

  return {
    webUrl: resultado.link.webUrl,
    tipo: resultado.link.type,
    alcance: resultado.link.scope,
  };
}
