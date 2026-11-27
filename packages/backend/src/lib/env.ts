import 'dotenv/config';

const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const DATABASE_URL = process.env.DATABASE_URL ?? 'file:./data/dev.db';
/** SQLite en local/Docker; PostgreSQL (Neon) en el despliegue cloud. */
const DATABASE_PROVIDER =
  process.env.DATABASE_PROVIDER ?? (DATABASE_URL.startsWith('postgres') ? 'postgresql' : 'sqlite');

/**
 * Limpia un valor de entorno: quita espacios y comillas accidentales.
 * Un secreto copiado con "" o con un salto de línea hace que Microsoft
 * rechace el login con errores difíciles de diagnosticar.
 */
function limpiar(valor: string | undefined): string {
  const texto = (valor ?? '').trim();
  if (
    texto.length >= 2 &&
    ((texto.startsWith('"') && texto.endsWith('"')) ||
      (texto.startsWith("'") && texto.endsWith("'")))
  ) {
    return texto.slice(1, -1).trim();
  }
  return texto;
}

/** Microsoft Graph / SharePoint (permisos delegados: cada usuario con su cuenta) */
const MS_GRAPH_CLIENT_ID = limpiar(process.env.MS_GRAPH_CLIENT_ID);
const MS_GRAPH_CLIENT_SECRET = limpiar(process.env.MS_GRAPH_CLIENT_SECRET);
const MS_GRAPH_TENANT_ID = limpiar(process.env.MS_GRAPH_TENANT_ID);
const MS_GRAPH_REDIRECT_URI =
  process.env.MS_GRAPH_REDIRECT_URI ?? `${BETTER_AUTH_URL}/api/auth/msgraph/callback`;

export const env = {
  DATABASE_URL,
  DATABASE_PROVIDER,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production-please-64-chars-minimo',
  BETTER_AUTH_URL,
  PORT: process.env.PORT ?? '3001',
  NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Origen del frontend: allí se vuelve después del login de Microsoft */
  FRONTEND_URL:
    process.env.FRONTEND_URL ??
    (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0].trim(),
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS ?? '',

  // Microsoft Graph / SharePoint
  MS_GRAPH_CLIENT_ID,
  MS_GRAPH_CLIENT_SECRET,
  MS_GRAPH_TENANT_ID,
  MS_GRAPH_REDIRECT_URI,
  MS_GRAPH_SITE_URL:
    process.env.MS_GRAPH_SITE_URL ?? 'https://scadatech.sharepoint.com/sites/ScadatechRecursos',
  MS_GRAPH_DRIVE_NAME: process.env.MS_GRAPH_DRIVE_NAME ?? 'Documentos compartidos',
  MS_GRAPH_FOLDER_ROOT: process.env.MS_GRAPH_FOLDER_ROOT ?? 'Operaciones/Planner_Proyectos',
  /** Microsoft Graph / SharePoint */
  MS_GRAPH_SCOPES:
    process.env.MS_GRAPH_SCOPES ??
    'https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Sites.ReadWrite.All https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read offline_access',
  /** Zona horaria con la que se crean los eventos de Outlook */
  MS_GRAPH_TIMEZONE: process.env.MS_GRAPH_TIMEZONE ?? 'America/Santiago',
  /** Sincronización automática de asignaciones con Outlook */
  MS_GRAPH_CALENDAR_SYNC: process.env.MS_GRAPH_CALENDAR_SYNC !== 'false',

  /** Zoho Projects */
  ZOHO_DOMAIN: process.env.ZOHO_DOMAIN ?? 'com',
  ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID ?? '',
  ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET ?? '',
  ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI ?? `${BETTER_AUTH_URL}/api/auth/zoho/callback`,
  ZOHO_SCOPES: process.env.ZOHO_SCOPES ?? 'ZohoProjects.projects.ALL,ZohoProjects.tasks.ALL,ZohoProjects.users.ALL,ZohoProjects.portal.ALL',
  /**
   * Cómo conecta cada usuario su cuenta de Microsoft:
   * - device: código de dispositivo (funciona con HTTP en red interna, sin redirect URI)
   * - redirect: OAuth con redirección (requiere HTTPS salvo localhost)
   */
  MS_GRAPH_AUTH_MODE:
    process.env.MS_GRAPH_AUTH_MODE === 'redirect' ? ('redirect' as const) : ('device' as const),
  /** Alcance de los enlaces de compartir: organization | anonymous */
  MS_GRAPH_SHARE_SCOPE: process.env.MS_GRAPH_SHARE_SCOPE ?? 'organization',
  /** Tamaño máximo de subida por archivo (MB) */
  MS_GRAPH_MAX_UPLOAD_MB: Number(process.env.MS_GRAPH_MAX_UPLOAD_MB ?? 100),
} as const;

/**
 * true cuando la App Registration está configurada en el entorno.
 * El flujo de código de dispositivo funciona como cliente público y no
 * necesita el secreto; el flujo con redirección sí lo exige.
 */
export const graphConfigurado = Boolean(
  env.MS_GRAPH_CLIENT_ID &&
    env.MS_GRAPH_TENANT_ID &&
    (env.MS_GRAPH_CLIENT_SECRET || env.MS_GRAPH_AUTH_MODE === 'device')
);

export type Env = typeof env;
