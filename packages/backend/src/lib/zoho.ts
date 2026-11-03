import { env } from './env.js';
import { cifrarToken, descifrarToken } from './token-crypto.js';

/* ============================================================
   Cliente Zoho Projects (OAuth 2.0 + REST API)

   Cada usuario conecta su propia cuenta de Zoho. El backend
   guarda el refresh token cifrado en BD y renueva el access token.
   ============================================================ */

const ZOHO_ACCOUNTS_BASE = (() => {
  const d = env.ZOHO_DOMAIN ?? 'com';
  return `https://accounts.zoho.${d}`;
})();

const ZOHO_API_BASE = (() => {
  const d = env.ZOHO_DOMAIN ?? 'com';
  return `https://www.zohoapis.${d}`;
})();

export class ZohoNoConfiguradoError extends Error {
  constructor() {
    super('Zoho no está configurado. Faltan ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET o ZOHO_DOMAIN.');
    this.name = 'ZohoNoConfiguradoError';
  }
}

export class ZohoAuthError extends Error {
  constructor(message: string, public code = 'ZOHO_AUTH_ERROR') {
    super(message);
    this.name = 'ZohoAuthError';
  }
}

export class ZohoRequestError extends Error {
  constructor(message: string, public status: number, public code = 'ZOHO_ERROR', public detalle?: unknown) {
    super(message);
    this.name = 'ZohoRequestError';
  }
}

/* ============================================================
   OAuth 2.0 - Authorization Code (confidential client)
   ============================================================ */

export function getZohoScopes(): string[] {
  return (env.ZOHO_SCOPES ?? '').split(/[\s,]+/).filter(Boolean);
}

export function getZohoAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.ZOHO_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.ZOHO_REDIRECT_URI,
    scope: getZohoScopes().join(','),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${ZOHO_ACCOUNTS_BASE}/oauth/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  ok: boolean;
  status: number;
  body: Record<string, any> | null;
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${ZOHO_ACCOUNTS_BASE}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      ...params,
    }),
  });

  const texto = await res.text();
  let body: Record<string, any> | null = null;
  if (texto) {
    try { body = JSON.parse(texto); } catch { body = null; }
  }
  return { ok: res.ok, status: res.status, body };
}

export interface ZohoTokenResultado {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope?: string;
  tokenType?: string;
}

function parseTokenResponse(body: Record<string, any>): ZohoTokenResultado {
  if (!body?.access_token) {
    throw new ZohoAuthError(body?.error_description ?? 'Zoho no devolvió access_token', body?.error ?? 'ZOHO_TOKEN_ERROR');
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? undefined,
    expiresAt: Date.now() + (Number(body.expires_in ?? 3600) - 60) * 1000,
    scope: body.scope ?? undefined,
    tokenType: body.token_type ?? undefined,
  };
}

export async function exchangeZohoCode(code: string): Promise<ZohoTokenResultado> {
  const res = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.ZOHO_REDIRECT_URI,
  });
  if (!res.ok || !res.body) throw new ZohoAuthError(res.body?.error_description ?? `Zoho respondió ${res.status}`, res.body?.error ?? 'ZOHO_CODE_EXCHANGE_ERROR');
  return parseTokenResponse(res.body);
}

export async function refreshZohoToken(refreshToken: string): Promise<ZohoTokenResultado> {
  const res = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  if (!res.ok || !res.body) throw new ZohoAuthError(res.body?.error_description ?? `Zoho respondió ${res.status}`, res.body?.error ?? 'ZOHO_REFRESH_ERROR');
  // Zoho no siempre devuelve refresh_token nuevo; si no viene, conservamos el anterior
  const parsed = parseTokenResponse(res.body);
  if (!res.body.refresh_token) parsed.refreshToken = refreshToken;
  return parsed;
}

/* ============================================================
   Obtener información del portal/organización del usuario
   ============================================================ */

export interface ZohoPortal {
  portal_id: string;
  portal_name: string;
  portal_type: string;
  user_role: string;
  is_admin: boolean;
}

export async function getZohoPortals(accessToken: string): Promise<ZohoPortal[]> {
  const res = await zohoRequest<{ portals: ZohoPortal[] }>(accessToken, '/portal/v1/organizations');
  return res.portals ?? [];
}

export async function getZohoCurrentUser(accessToken: string): Promise<{ email: string; user_id: string; name: string }> {
  return zohoRequest<{ email: string; user_id: string; name: string }>(accessToken, '/portal/v1/users/me');
}

/* ============================================================
   Llamadas REST a Zoho Projects API
   ============================================================ */

export async function zohoRequest<T = unknown>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  portalId?: string
): Promise<T> {
  const url = path.startsWith('https://') ? path : `${ZOHO_API_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Zoho-oauthtoken ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (portalId) {
    headers.set('X-ZOHO-PROJECTS-PORTALID', portalId);
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  let body: unknown = null;
  if (texto) {
    try { body = JSON.parse(texto); } catch { body = texto; }
  }

  if (!res.ok) {
    const err = (body as { code?: number; message?: string; error?: string } | null);
    throw new ZohoRequestError(
      err?.message ?? err?.error ?? `Zoho API respondió ${res.status}`,
      res.status,
      String(err?.code ?? 'ZOHO_API_ERROR'),
      body
    );
  }

  return body as T;
}

export async function zohoGetAll<T>(
  accessToken: string,
  path: string,
  portalId: string,
  max = 1000
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const perPage = 200;

  while (items.length < max) {
    const sep = path.includes('?') ? '&' : '?';
    const pagePath = `${path}${sep}page=${page}&per_page=${perPage}`;
    const res: { data?: T[]; page_context?: { page: number; per_page: number; total: number; has_more_page: boolean } } =
      await zohoRequest(accessToken, pagePath, { method: 'GET' }, portalId);

    if (res.data?.length) items.push(...res.data);
    if (!res.page_context?.has_more_page) break;
    page++;
  }
  return items.slice(0, max);
}

/* ============================================================
   Helpers específicos de Zoho Projects
   ============================================================ */

export interface ZohoProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_date: string;
  created_date_long: number;
  owner_id: string;
  owner_name: string;
}

export interface ZohoTasklist {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  status: string;
  created_date: string;
  owner_id: string;
}

export interface ZohoTask {
  id: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  start_date?: string;
  end_date?: string;
  project_id: string;
  project_name: string;
  tasklist_id: string;
  tasklist_name: string;
  owner_id?: string;
  owner_name?: string;
  percent_complete: number;
  created_date: string;
  created_by_id: string;
}

export interface ZohoUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  is_admin: boolean;
}

// Proyectos
export async function zohoListProjects(accessToken: string, portalId: string): Promise<ZohoProject[]> {
  return zohoGetAll<ZohoProject>(accessToken, '/projects/v1/projects', portalId);
}

export async function zohoGetProject(accessToken: string, portalId: string, projectId: string): Promise<ZohoProject> {
  return zohoRequest<{ project: ZohoProject }>(accessToken, `/projects/v1/projects/${projectId}`, { method: 'GET' }, portalId).then(r => r.project);
}

export async function zohoCreateProject(accessToken: string, portalId: string, data: { name: string; description?: string; start_date?: string; end_date?: string }): Promise<ZohoProject> {
  return zohoRequest<{ project: ZohoProject }>(accessToken, '/projects/v1/projects', { method: 'POST', body: JSON.stringify(data) }, portalId).then(r => r.project);
}

export async function zohoUpdateProject(accessToken: string, portalId: string, projectId: string, data: Partial<ZohoProject>): Promise<ZohoProject> {
  return zohoRequest<{ project: ZohoProject }>(accessToken, `/projects/v1/projects/${projectId}`, { method: 'POST', body: JSON.stringify(data) }, portalId).then(r => r.project);
}

// Tasklists (milestones/actividades)
export async function zohoListTasklists(accessToken: string, portalId: string, projectId: string): Promise<ZohoTasklist[]> {
  return zohoGetAll<ZohoTasklist>(accessToken, `/projects/v1/projects/${projectId}/tasklists`, portalId);
}

export async function zohoCreateTasklist(accessToken: string, portalId: string, projectId: string, data: { name: string; description?: string }): Promise<ZohoTasklist> {
  return zohoRequest<{ tasklist: ZohoTasklist }>(accessToken, `/projects/v1/projects/${projectId}/tasklists`, { method: 'POST', body: JSON.stringify(data) }, portalId).then(r => r.tasklist);
}

// Tasks (tareas/subtareas)
export async function zohoListTasks(accessToken: string, portalId: string, projectId: string, tasklistId?: string): Promise<ZohoTask[]> {
  let path = `/projects/v1/projects/${projectId}/tasks`;
  if (tasklistId) path += `?tasklist_id=${tasklistId}`;
  return zohoGetAll<ZohoTask>(accessToken, path, portalId);
}

export async function zohoGetTask(accessToken: string, portalId: string, projectId: string, taskId: string): Promise<ZohoTask> {
  return zohoRequest<{ task: ZohoTask }>(accessToken, `/projects/v1/projects/${projectId}/tasks/${taskId}`, { method: 'GET' }, portalId).then(r => r.task);
}

export async function zohoCreateTask(accessToken: string, portalId: string, projectId: string, data: Record<string, any>): Promise<ZohoTask> {
  return zohoRequest<{ task: ZohoTask }>(accessToken, `/projects/v1/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }, portalId).then(r => r.task);
}

export async function zohoUpdateTask(accessToken: string, portalId: string, projectId: string, taskId: string, data: Record<string, any>): Promise<ZohoTask> {
  return zohoRequest<{ task: ZohoTask }>(accessToken, `/projects/v1/projects/${projectId}/tasks/${taskId}`, { method: 'POST', body: JSON.stringify(data) }, portalId).then(r => r.task);
}

export async function zohoDeleteTask(accessToken: string, portalId: string, projectId: string, taskId: string): Promise<void> {
  await zohoRequest(accessToken, `/projects/v1/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }, portalId);
}

// Usuarios del portal
export async function zohoListUsers(accessToken: string, portalId: string): Promise<ZohoUser[]> {
  return zohoGetAll<ZohoUser>(accessToken, `/portal/v1/users`, portalId);
}

export async function zohoGetUser(accessToken: string, portalId: string, userId: string): Promise<ZohoUser> {
  return zohoRequest<{ user: ZohoUser }>(accessToken, `/portal/v1/users/${userId}`, { method: 'GET' }, portalId).then(r => r.user);
}

/* ============================================================
   Diagnóstico de credenciales
   ============================================================ */

export interface ZohoDiagnostico {
  configurado: boolean;
  secretoConfigurado: boolean;
  secretoLargo: number;
  prueba: 'ok' | 'error' | 'sin_secreto';
  codigo?: number;
  detalle?: string;
}

export async function diagnosticarZoho(): Promise<ZohoDiagnostico> {
  const base: ZohoDiagnostico = {
    configurado: Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_DOMAIN),
    secretoConfigurado: Boolean(env.ZOHO_CLIENT_SECRET),
    secretoLargo: env.ZOHO_CLIENT_SECRET.length,
    prueba: 'sin_secreto',
  };

  if (!env.ZOHO_CLIENT_SECRET) return base;

  try {
    // Prueba con client_credentials (no existe en Zoho, usamos refresh_token dummy)
    // En su lugar validamos que el client_id/secret sean aceptados pidiendo un token con grant_type inválido
    const res = await fetch(`${ZOHO_ACCOUNTS_BASE}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: env.ZOHO_CLIENT_ID,
        client_secret: env.ZOHO_CLIENT_SECRET,
      }),
    });
    const body = (await res.json().catch(() => null)) as Record<string, any> | null;

    // Zoho devuelve error "invalid_client" si las credenciales son malas
    if (body?.error === 'invalid_client') {
      return { ...base, prueba: 'error', codigo: 0, detalle: body.error_description ?? 'Credenciales inválidas' };
    }
    // Si no es invalid_client, las credenciales son válidas (el error será unsupported_grant_type)
    return { ...base, prueba: 'ok' };
  } catch (err) {
    return { ...base, prueba: 'error', detalle: err instanceof Error ? err.message : String(err) };
  }
}