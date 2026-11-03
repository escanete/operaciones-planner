import { prisma } from './db.js';
import { cifrarToken, descifrarToken } from './token-crypto.js';
import { refreshZohoToken, type ZohoTokenResultado, getZohoPortals, getZohoCurrentUser } from './zoho.js';

/* ============================================================
   Tokens de Zoho por usuario

   El refresh token se guarda cifrado en BD. El access token
   se renueva automáticamente cuando expira.
   ============================================================ */

export interface ZohoCuentaInfo {
  portalId?: string;
  portalName?: string;
  email?: string;
  userId?: string;
}

export interface ZohoTokenGuardado {
  userId: string;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiraAt?: Date | null;
  portalId?: string | null;
  portalName?: string | null;
  cuentaZoho?: string | null;
  syncActivo: boolean;
  ultimaSyncAt?: Date | null;
  ultimoError?: string | null;
}

const refrescosEnCurso = new Map<string, Promise<string | null>>();

export async function guardarZohoToken(
  userId: string,
  token: ZohoTokenResultado,
  cuenta?: ZohoCuentaInfo | null
): Promise<void> {
  const existente = await prisma.zohoToken.findUnique({ where: { userId } });
  const refreshCifrado = token.refreshToken ? cifrarToken(token.refreshToken) : null;

  if (!refreshCifrado && !existente) {
    throw new Error('Zoho no entregó un refresh token');
  }

  const datos = {
    accessToken: token.accessToken,
    accessTokenExpiraAt: new Date(token.expiresAt),
    ...(token.scope ? { scope: token.scope } : {}),
    ...(refreshCifrado ? { refreshTokenCifrado: refreshCifrado } : {}),
    ...(cuenta
      ? {
          portalId: cuenta.portalId ?? null,
          portalName: cuenta.portalName ?? null,
          cuentaZoho: cuenta.email ?? null,
        }
      : {}),
    ultimoError: null,
  };

  await prisma.zohoToken.upsert({
    where: { userId },
    create: { userId, refreshTokenCifrado: refreshCifrado as string, ...datos },
    update: datos,
  });
}

export async function obtenerZohoToken(userId: string): Promise<ZohoTokenGuardado | null> {
  const registro = await prisma.zohoToken.findUnique({ where: { userId } });
  if (!registro) return null;

  return {
    userId: registro.userId,
    refreshToken: descifrarToken(registro.refreshTokenCifrado),
    accessToken: registro.accessToken,
    accessTokenExpiraAt: registro.accessTokenExpiraAt,
    portalId: registro.portalId,
    portalName: registro.portalName,
    cuentaZoho: registro.cuentaZoho,
    syncActivo: registro.syncActivo,
    ultimaSyncAt: registro.ultimaSyncAt,
    ultimoError: registro.ultimoError,
  };
}

export async function getZohoAccessToken(userId: string): Promise<string | null> {
  const registro = await prisma.zohoToken.findUnique({ where: { userId } });
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
        const resultado = await refreshZohoToken(refreshToken);

        await prisma.zohoToken.update({
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
        await prisma.zohoToken
          .update({ where: { userId }, data: { ultimoError: mensaje.slice(0, 500) } })
          .catch(() => undefined);
        throw err;
      }
    })().finally(() => refrescosEnCurso.delete(userId));
    refrescosEnCurso.set(userId, refresco);
  }

  return refresco;
}

export async function setZohoSyncActivo(userId: string, activo: boolean): Promise<void> {
  await prisma.zohoToken.update({
    where: { userId },
    data: { syncActivo: activo },
  });
}

export async function registrarZohoSync(userId: string, error?: string | null): Promise<void> {
  await prisma.zohoToken
    .update({
      where: { userId },
      data: {
        ultimaSyncAt: new Date(),
        ultimoError: error ? error.slice(0, 500) : null,
      },
    })
    .catch(() => undefined);
}

export async function desconectarZoho(userId: string): Promise<void> {
  await prisma.zohoToken.deleteMany({ where: { userId } });
}

export async function estadoZohoUsuario(userId: string) {
  const registro = await prisma.zohoToken.findUnique({
    where: { userId },
    select: {
      cuentaZoho: true,
      portalId: true,
      portalName: true,
      syncActivo: true,
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
      portalId: null,
      portalName: null,
      ultimaSyncAt: null,
      ultimoError: null,
      actualizadoAt: null,
    };
  }

  return {
    conectado: true,
    activo: registro.syncActivo,
    cuenta: registro.cuentaZoho,
    portalId: registro.portalId,
    portalName: registro.portalName,
    ultimaSyncAt: registro.ultimaSyncAt,
    ultimoError: registro.ultimoError,
    actualizadoAt: registro.updatedAt,
  };
}

/** Descubre y guarda el portal del usuario si no lo tiene */
export async function asegurarPortalZoho(userId: string): Promise<{ portalId: string; portalName: string } | null> {
  const registro = await prisma.zohoToken.findUnique({ where: { userId } });
  if (registro?.portalId) return { portalId: registro.portalId, portalName: registro.portalName ?? '' };

  const accessToken = await getZohoAccessToken(userId);
  if (!accessToken) return null;

  try {
    const portals = await getZohoPortals(accessToken);
    if (portals.length === 0) return null;

    // Usar el primer portal donde sea admin, o el primero
    const portal = portals.find(p => p.is_admin) ?? portals[0];

    await prisma.zohoToken.update({
      where: { userId },
      data: { portalId: portal.portal_id, portalName: portal.portal_name },
    });

    return { portalId: portal.portal_id, portalName: portal.portal_name };
  } catch (err) {
    console.warn('[zoho] No se pudo obtener portal:', err);
    return null;
  }
}