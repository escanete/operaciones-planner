import { env } from './env.js';

/* ============================================================
   Cliente Microsoft Graph (permisos DELEGADOS)

   Cada usuario conecta su propia cuenta de Microsoft. El backend
   guarda únicamente el refresh token en una cookie httpOnly y
   refresca el access token cuando expira.
   ============================================================ */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class GraphNoConfiguradoError extends Error {
  constructor() {
    super(
      'Microsoft Graph no está configurado. Faltan MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET o MS_GRAPH_TENANT_ID.'
    );
    this.name = 'GraphNoConfiguradoError';
  }
}

export class GraphAuthError extends Error {
  constructor(
    message: string,
    public code = 'GRAPH_AUTH_ERROR'
  ) {
    super(message);
    this.name = 'GraphAuthError';
  }
}

export class GraphRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = 'GRAPH_ERROR',
    public detalle?: unknown
  ) {
    super(message);
    this.name = 'GraphRequestError';
  }
}

/* ============================================================
   OAuth 2.0 authorization code (cliente confidencial)

   Se usa el endpoint de tokens directamente con fetch: así el
   refresh token queda en nuestras manos (cookie httpOnly) y no
   dependemos de la caché en memoria de MSAL.
   ============================================================ */

export interface TokenResultado {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms */
  expiresAt: number;
  scope?: string;
}

export function getScopes(): string[] {
  return env.MS_GRAPH_SCOPES.split(/[\s,]+/).filter(Boolean);
}

function authorityBase(): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(env.MS_GRAPH_TENANT_ID)}/oauth2/v2.0`;
}

/** URL de login de Microsoft. `state` lo valida el callback contra una cookie. */
export function getAuthCodeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.MS_GRAPH_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MS_GRAPH_REDIRECT_URI,
    response_mode: 'query',
    scope: getScopes().join(' '),
    state,
    prompt: 'select_account',
  });
  return `${authorityBase()}/authorize?${params.toString()}`;
}

async function pedirToken(extra: Record<string, string>): Promise<TokenResultado> {
  const res = await fetch(`${authorityBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MS_GRAPH_CLIENT_ID,
      client_secret: env.MS_GRAPH_CLIENT_SECRET,
      ...extra,
    }),
  });

  const texto = await res.text();
  let body: Record<string, any> | null = null;
  try {
    body = texto ? JSON.parse(texto) : null;
  } catch {
    body = null;
  }

  if (!res.ok || !body?.access_token) {
    throw new GraphAuthError(
      body?.error_description ?? `Microsoft rechazó la solicitud (${res.status})`,
      body?.error ?? 'GRAPH_AUTH_ERROR'
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? undefined,
    expiresAt: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
    scope: body.scope ?? undefined,
  };
}

export function exchangeCode(code: string): Promise<TokenResultado> {
  return pedirToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.MS_GRAPH_REDIRECT_URI,
    scope: getScopes().join(' '),
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResultado> {
  return pedirToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: getScopes().join(' '),
  });
}

/* ============================================================
   Llamadas REST a Graph
   ============================================================ */

export async function graphRequest<T = unknown>(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('https://') ? path : `${GRAPH_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  let body: unknown = null;
  if (texto) {
    try {
      body = JSON.parse(texto);
    } catch {
      body = texto;
    }
  }

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new GraphRequestError(
      err?.message ?? `Microsoft Graph respondió ${res.status}`,
      res.status,
      err?.code ?? 'GRAPH_ERROR',
      body
    );
  }

  return body as T;
}

/** GET con seguimiento de @odata.nextLink */
export async function graphGetAll<T>(
  accessToken: string,
  path: string,
  maximo = 1000
): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = path;

  while (next && items.length < maximo) {
    const page: { value?: T[]; '@odata.nextLink'?: string } = await graphRequest(
      accessToken,
      next
    );
    items.push(...(page.value ?? []));
    next = page['@odata.nextLink'] ?? null;
  }

  return items.slice(0, maximo);
}

/* ============================================================
   Sitio y biblioteca de SharePoint
   ============================================================ */

export interface SiteDrive {
  siteId: string;
  siteWebUrl: string;
  driveId: string;
  driveName: string;
  driveWebUrl: string;
}

let _siteDrive: SiteDrive | null = null;

export function clearSiteDriveCache(): void {
  _siteDrive = null;
}

/**
 * Resuelve el siteId y el driveId a partir de MS_GRAPH_SITE_URL y
 * MS_GRAPH_DRIVE_NAME. Los IDs son del tenant, así que se cachean.
 */
export async function resolveSiteAndDrive(accessToken: string): Promise<SiteDrive> {
  if (_siteDrive) return _siteDrive;

  const url = new URL(env.MS_GRAPH_SITE_URL);
  const host = url.hostname;
  const sitePath = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segmento) => encodeURIComponent(segmento))
    .join('/');

  const site = await graphRequest<{ id: string; webUrl: string }>(
    accessToken,
    `/sites/${host}:/${sitePath}?$select=id,webUrl`
  );

  const drives = await graphGetAll<{
    id: string;
    name: string;
    webUrl: string;
    driveType?: string;
  }>(accessToken, `/sites/${site.id}/drives?$select=id,name,webUrl,driveType`);

  const buscado = env.MS_GRAPH_DRIVE_NAME.trim().toLowerCase();
  const drive =
    drives.find((d) => d.name.trim().toLowerCase() === buscado) ??
    drives.find((d) => d.driveType === 'documentLibrary') ??
    drives[0];

  if (!drive) {
    throw new GraphRequestError(
      `No se encontró la biblioteca "${env.MS_GRAPH_DRIVE_NAME}" en ${env.MS_GRAPH_SITE_URL}`,
      404,
      'DRIVE_NOT_FOUND'
    );
  }

  _siteDrive = {
    siteId: site.id,
    siteWebUrl: site.webUrl,
    driveId: drive.id,
    driveName: drive.name,
    driveWebUrl: drive.webUrl,
  };
  return _siteDrive;
}

/** Usuario autenticado en Microsoft (para mostrar en la UI) */
export function getGraphMe(accessToken: string) {
  return graphRequest<{
    id: string;
    displayName: string | null;
    mail: string | null;
    userPrincipalName: string;
  }>(accessToken, '/me?$select=id,displayName,mail,userPrincipalName');
}
