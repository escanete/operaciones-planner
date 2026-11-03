import { prisma } from './db.js';
import { cifrarToken, descifrarToken } from './token-crypto.js';
import { refreshAccessToken, type TokenResultado } from './msgraph.js';

/* ============================================================
   Tokens de Microsoft Graph por usuario

   A diferencia de la sesión de SharePoint (cookie del navegador),
   el calendario se sincroniza desde el servidor cuando se crea o
   modifica una asignación. Por eso el refresh token debe quedar
   guardado por usuario, cifrado, en la base de datos.
   ============================================================ */

export interface CuentaMicrosoft {
  id?: string;
  mail?: string | null;
  userPrincipalName?: string;
}

export interface TokenGuardado {
  userId: string;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiraAt?: Date | null;
  cuentaMicrosoft?: string | null;
  cuentaMicrosoftId?: string | null;
  calendarioActivo: boolean;
  ultimaSyncAt?: Date | null;
  ultimoError?: string | null;
}

const refrescosEnCurso = new Map<string, Promise<string | null>>();

function nombreCuenta(cuenta?: CuentaMicrosoft | null): string | null {
  if (!cuenta) return null;
  return cuenta.mail ?? cuenta.userPrincipalName ?? null;
}

/**
 * Guarda (o actualiza) el token de Microsoft del usuario. Si Microsoft no
 * devolvió un refresh token nuevo, conserva el que ya estaba guardado.
 */
export async function guardarTokenUsuario(
  userId: string,
  token: TokenResultado,
  cuenta?: CuentaMicrosoft | null
): Promise<void> {
  const existente = await prisma.graphToken.findUnique({ where: { userId } });
  const refreshCifrado = token.refreshToken ? cifrarToken(token.refreshToken) : null;

  if (!refreshCifrado && !existente) {
    throw new Error('Microsoft no entregó un refresh token (revisa el permiso offline_access)');
  }

  const datos = {
    accessToken: token.accessToken,
    accessTokenExpiraAt: new Date(token.expiresAt),
    ...(token.scope ? { scope: token.scope } : {}),
    ...(refreshCifrado ? { refreshTokenCifrado: refreshCifrado } : {}),
    ...(cuenta
      ? {
          cuentaMicrosoft: nombreCuenta(cuenta),
          cuentaMicrosoftId: cuenta.id ?? null,
        }
      : {}),
    ultimoError: null,
  };

  await prisma.graphToken.upsert({
    where: { userId },
    create: { userId, refreshTokenCifrado: refreshCifrado as string, ...datos },
    update: datos,
  });
}

export async function obtenerTokenUsuario(userId: string): Promise<TokenGuardado | null> {
  const registro = await prisma.graphToken.findUnique({ where: { userId } });
  if (!registro) return null;

  return {
    userId: registro.userId,
    refreshToken: descifrarToken(registro.refreshTokenCifrado),
    accessToken: registro.accessToken,
    accessTokenExpiraAt: registro.accessTokenExpiraAt,
    cuentaMicrosoft: registro.cuentaMicrosoft,
    cuentaMicrosoftId: registro.cuentaMicrosoftId,
    calendarioActivo: registro.calendarioActivo,
    ultimaSyncAt: registro.ultimaSyncAt,
    ultimoError: registro.ultimoError,
  };
}

/**
 * Devuelve un access token válido para el usuario, renovándolo si expiró.
 * Si el usuario no conectó su cuenta de Microsoft, devuelve null.
 */
export async function getAccessTokenUsuario(userId: string): Promise<string | null> {
  const registro = await prisma.graphToken.findUnique({ where: { userId } });
  if (!registro) return null;

  const vigente =
    registro.accessToken &&
    registro.accessTokenExpiraAt &&
    registro.accessTokenExpiraAt.getTime() - 120_000 > Date.now();

  if (vigente) return registro.accessToken;

  let refresco = refrescosEnCurso.get(userId);
  if (!refresco) {
    refresco = (async () => {
      try {
        const refreshToken = descifrarToken(registro.refreshTokenCifrado);
        const resultado = await refreshAccessToken(refreshToken);

        await prisma.graphToken.update({
          where: { userId },
          data: {
            accessToken: resultado.accessToken,
            accessTokenExpiraAt: new Date(resultado.expiresAt),
            ...(resultado.refreshToken
              ? { refreshTokenCifrado: cifrarToken(resultado.refreshToken) }
              : {}),
            ...(resultado.scope ? { scope: resultado.scope } : {}),
            ultimoError: null,
          },
        });

        return resultado.accessToken;
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : String(err);
        await prisma.graphToken
          .update({ where: { userId }, data: { ultimoError: mensaje.slice(0, 500) } })
          .catch(() => undefined);
        throw err;
      }
    })().finally(() => refrescosEnCurso.delete(userId));
    refrescosEnCurso.set(userId, refresco);
  }

  return refresco;
}

export async function setCalendarioActivo(userId: string, activo: boolean): Promise<void> {
  await prisma.graphToken.update({
    where: { userId },
    data: { calendarioActivo: activo },
  });
}

export async function registrarSyncUsuario(userId: string, error?: string | null): Promise<void> {
  await prisma.graphToken
    .update({
      where: { userId },
      data: {
        ultimaSyncAt: new Date(),
        ultimoError: error ? error.slice(0, 500) : null,
      },
    })
    .catch(() => undefined);
}

export async function desconectarUsuario(userId: string): Promise<void> {
  await prisma.graphToken.deleteMany({ where: { userId } });
}

export async function estadoCalendarioUsuario(userId: string) {
  const registro = await prisma.graphToken.findUnique({
    where: { userId },
    select: {
      cuentaMicrosoft: true,
      calendarioActivo: true,
      ultimaSyncAt: true,
      ultimoError: true,
      updatedAt: true,
      scope: true,
    },
  });

  if (!registro) {
    return {
      conectado: false,
      activo: false,
      cuenta: null,
      ultimaSyncAt: null,
      ultimoError: null,
      actualizadoAt: null,
      conPermisoCalendario: false,
    };
  }

  const scope = (registro.scope ?? '').toLowerCase();

  return {
    conectado: true,
    activo: registro.calendarioActivo,
    cuenta: registro.cuentaMicrosoft,
    ultimaSyncAt: registro.ultimaSyncAt,
    ultimoError: registro.ultimoError,
    actualizadoAt: registro.updatedAt,
    conPermisoCalendario: scope.includes('calendars.readwrite'),
  };
}
