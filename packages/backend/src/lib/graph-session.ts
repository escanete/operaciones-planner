import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { env } from './env.js';
import { refreshAccessToken } from './msgraph.js';

/* ============================================================
   Sesión de Microsoft Graph por usuario

   El refresh token vive en una cookie httpOnly; el access token
   se mantiene en memoria (por hash del refresh token) y se renueva
   automáticamente cuando expira.
   ============================================================ */

export const RT_COOKIE = 'op_msgraph_rt';
export const STATE_COOKIE = 'op_msgraph_state';
export const RETURN_COOKIE = 'op_msgraph_return';

const NO_CONECTADO = 'MSGRAPH_NOT_CONNECTED';

/** Secure solo cuando el redirect registrado en Azure es https; si no,
 *  el navegador descartaría la cookie en despliegues http internos. */
export function cookieSecure(): boolean {
  try {
    return new URL(env.MS_GRAPH_REDIRECT_URI).protocol === 'https:';
  } catch {
    return false;
  }
}

export function cookieBase(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieSecure(),
    path: '/',
  };
}

export function guardarRefreshToken(c: Context, refreshToken: string): void {
  setCookie(c, RT_COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 90, // 90 días
  });
}

export function limpiarSesionGraph(c: Context): void {
  const rt = getCookie(c, RT_COOKIE);
  if (rt) tokenCache.delete(hash(rt));
  deleteCookie(c, RT_COOKIE, cookieBase());
  deleteCookie(c, STATE_COOKIE, cookieBase());
  deleteCookie(c, RETURN_COOKIE, cookieBase());
}

interface TokenCacheado {
  accessToken: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, TokenCacheado>();
const refrescosEnCurso = new Map<string, Promise<TokenCacheado & { refreshToken?: string }>>();

function hash(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

function leerCache(clave: string): string | null {
  const item = tokenCache.get(clave);
  if (!item) return null;
  // Renovamos 2 minutos antes de que expire
  if (item.expiresAt - 120_000 <= Date.now()) return null;
  return item.accessToken;
}

export interface GraphSessionError extends Error {
  code: string;
  requiereConexion: boolean;
}

function errorSesion(mensaje: string, requiereConexion: boolean): GraphSessionError {
  const err = new Error(mensaje) as GraphSessionError;
  err.name = 'GraphSessionError';
  err.code = requiereConexion ? NO_CONECTADO : 'MSGRAPH_REFRESH_FAILED';
  err.requiereConexion = requiereConexion;
  return err;
}

/**
 * Devuelve un access token válido para el usuario del request, o null si
 * todavía no conectó su cuenta de Microsoft.
 * Lanza GraphSessionError si el refresh token ya no es válido.
 */
export async function getGraphAccessToken(c: Context): Promise<string | null> {
  const refreshToken = getCookie(c, RT_COOKIE);
  if (!refreshToken) return null;

  const clave = hash(refreshToken);
  const enCache = leerCache(clave);
  if (enCache) return enCache;

  let refresco = refrescosEnCurso.get(clave);
  if (!refresco) {
    refresco = refreshAccessToken(refreshToken)
      .then((resultado) => {
        if (!resultado?.accessToken) {
          throw errorSesion('Microsoft no devolvió un access token', false);
        }
        return {
          accessToken: resultado.accessToken,
          expiresAt: resultado.expiresAt,
          refreshToken: resultado.refreshToken,
        };
      })
      .finally(() => refrescosEnCurso.delete(clave));
    refrescosEnCurso.set(clave, refresco);
  }

  try {
    const resultado = await refresco;
    tokenCache.set(clave, {
      accessToken: resultado.accessToken,
      expiresAt: resultado.expiresAt,
    });

    // Azure puede rotar el refresh token: guardamos el nuevo
    if (resultado.refreshToken && resultado.refreshToken !== refreshToken) {
      guardarRefreshToken(c, resultado.refreshToken);
    }

    return resultado.accessToken;
  } catch (err) {
    tokenCache.delete(clave);
    // invalid_grant / interaction_required → hay que volver a conectar
    const mensaje = err instanceof Error ? err.message : 'No se pudo renovar el token de Microsoft';
    limpiarSesionGraph(c);
    throw errorSesion(mensaje, true);
  }
}

export function esErrorNoConectado(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as GraphSessionError).code === NO_CONECTADO);
}
