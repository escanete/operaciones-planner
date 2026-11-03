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

interface RespuestaToken {
  ok: boolean;
  status: number;
  body: Record<string, any> | null;
}

/** Códigos con los que Microsoft indica que el cliente no pudo autenticarse */
const CODIGOS_CREDENCIAL = [7000215, 7000216, 7000218, 7000222];

function esErrorDeCredencial(body: Record<string, any> | null): boolean {
  if (!body) return false;
  if (body.error === 'invalid_client') return true;
  const codigos: number[] = Array.isArray(body.error_codes) ? body.error_codes : [];
  return codigos.some((codigo) => CODIGOS_CREDENCIAL.includes(codigo));
}

async function enviarToken(
  extra: Record<string, string>,
  conSecreto: boolean
): Promise<RespuestaToken> {
  const params: Record<string, string> = {
    client_id: env.MS_GRAPH_CLIENT_ID,
    ...extra,
  };
  if (conSecreto && env.MS_GRAPH_CLIENT_SECRET) {
    params.client_secret = env.MS_GRAPH_CLIENT_SECRET;
  }

  const res = await fetch(`${authorityBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const texto = await res.text();
  let body: Record<string, any> | null = null;
  try {
    body = texto ? JSON.parse(texto) : null;
  } catch {
    body = null;
  }

  return { ok: res.ok, status: res.status, body };
}

/**
 * Pide tokens al endpoint de Microsoft.
 *
 * Primero intenta con `client_secret` (cliente confidencial). Si Microsoft
 * responde que el secreto falta o no es válido, reintenta SIN secreto: así
 * también funciona cuando la App Registration está configurada como cliente
 * público ("Allow public client flows" habilitado), que es lo habitual para
 * el flujo de código de dispositivo.
 */
async function solicitarToken(extra: Record<string, string>): Promise<RespuestaToken> {
  const primero = await enviarToken(extra, true);
  if (primero.ok && primero.body?.access_token) return primero;
  if (!env.MS_GRAPH_CLIENT_SECRET || !esErrorDeCredencial(primero.body)) return primero;
  return enviarToken(extra, false);
}

const AYUDA_CREDENCIAL =
  'Revisa MS_GRAPH_CLIENT_SECRET en el servidor o habilita "Allow public client flows" ' +
  'en la App Registration de Microsoft Entra (Authentication → Advanced settings).';

function mensajeTokenError(respuesta: RespuestaToken): string {
  const detalle =
    respuesta.body?.error_description ?? `Microsoft rechazó la solicitud (${respuesta.status})`;
  return esErrorDeCredencial(respuesta.body) ? `${detalle} ${AYUDA_CREDENCIAL}` : detalle;
}

async function pedirToken(extra: Record<string, string>): Promise<TokenResultado> {
  const res = await solicitarToken(extra);
  const body = res.body;

  if (!res.ok || !body?.access_token) {
    throw new GraphAuthError(mensajeTokenError(res), body?.error ?? 'GRAPH_AUTH_ERROR');
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
   Device code flow

   No necesita redirect URI ni HTTPS: el usuario abre
   microsoft.com/devicelogin e ingresa un código temporal.
   ============================================================ */

export interface DeviceCodeInicio {
  deviceCode: string;
  codigoUsuario: string;
  urlVerificacion: string;
  expiraEn: number;
  intervalo: number;
  mensaje: string;
}

export async function iniciarDeviceCode(): Promise<DeviceCodeInicio> {
  const res = await fetch(`${authorityBase()}/devicecode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MS_GRAPH_CLIENT_ID,
      scope: getScopes().join(' '),
    }),
  });

  const body = (await res.json().catch(() => null)) as Record<string, any> | null;

  if (!res.ok || !body?.device_code) {
    throw new GraphAuthError(
      body?.error_description ?? `Microsoft rechazó la solicitud (${res.status})`,
      body?.error ?? 'DEVICE_CODE_ERROR'
    );
  }

  return {
    deviceCode: body.device_code,
    codigoUsuario: body.user_code,
    urlVerificacion: body.verification_uri,
    expiraEn: Number(body.expires_in ?? 900),
    intervalo: Math.max(5, Number(body.interval ?? 5)),
    mensaje: body.message ?? '',
  };
}

export type DeviceCodeResultado =
  | { estado: 'listo'; token: TokenResultado }
  | { estado: 'pendiente'; intervalo?: number }
  | { estado: 'expirado' }
  | { estado: 'rechazado' }
  | { estado: 'error'; detalle: string };

export async function consultarDeviceCode(deviceCode: string): Promise<DeviceCodeResultado> {
  const res = await solicitarToken({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
  });

  const body = res.body;

  if (res.ok && body?.access_token) {
    return {
      estado: 'listo',
      token: {
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? undefined,
        expiresAt: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
        scope: body.scope ?? undefined,
      },
    };
  }

  switch (body?.error) {
    case 'authorization_pending':
      return { estado: 'pendiente' };
    case 'slow_down':
      return { estado: 'pendiente', intervalo: 5 };
    case 'expired_token':
    case 'code_expired':
      return { estado: 'expirado' };
    case 'authorization_declined':
      return { estado: 'rechazado' };
    default:
      return { estado: 'error', detalle: mensajeTokenError(res) };
  }
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

/* ============================================================
   Diagnóstico de credenciales

   Comprueba si Microsoft acepta el client_secret configurado. No
   devuelve el secreto: solo su largo y el resultado de la prueba.
   ============================================================ */

export interface DiagnosticoCredenciales {
  configurado: boolean;
  secretoConfigurado: boolean;
  secretoLargo: number;
  prueba: 'ok' | 'error' | 'sin_secreto';
  codigo?: number;
  detalle?: string;
}

export async function diagnosticarCredenciales(): Promise<DiagnosticoCredenciales> {
  const base: DiagnosticoCredenciales = {
    configurado: Boolean(env.MS_GRAPH_CLIENT_ID && env.MS_GRAPH_TENANT_ID),
    secretoConfigurado: Boolean(env.MS_GRAPH_CLIENT_SECRET),
    secretoLargo: env.MS_GRAPH_CLIENT_SECRET.length,
    prueba: 'sin_secreto',
  };

  if (!env.MS_GRAPH_CLIENT_SECRET) return base;

  try {
    const res = await fetch(`${authorityBase()}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.MS_GRAPH_CLIENT_ID,
        client_secret: env.MS_GRAPH_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    const body = (await res.json().catch(() => null)) as Record<string, any> | null;

    if (res.ok && body?.access_token) return { ...base, prueba: 'ok' };

    return {
      ...base,
      prueba: 'error',
      codigo: Array.isArray(body?.error_codes) ? Number(body.error_codes[0]) : undefined,
      detalle: String(body?.error_description ?? `Microsoft respondió ${res.status}`).slice(0, 300),
    };
  } catch (err) {
    return {
      ...base,
      prueba: 'error',
      detalle: err instanceof Error ? err.message : String(err),
    };
  }
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
