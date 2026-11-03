import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { auth } from '../lib/auth.js';
import { env, graphConfigurado } from '../lib/env.js';
import {
  cookieBase,
  getGraphAccessToken,
  guardarRefreshToken,
  limpiarSesionGraph,
  RETURN_COOKIE,
  STATE_COOKIE,
} from '../lib/graph-session.js';
import {
  consultarDeviceCode,
  exchangeCode,
  getAuthCodeUrl,
  getGraphMe,
  iniciarDeviceCode,
  resolveSiteAndDrive,
} from '../lib/msgraph.js';

const msgraphRoutes = new Hono();

/** Solo rutas internas: evita redirecciones abiertas a otros dominios */
function rutaSegura(valor: string | undefined, porDefecto = '/'): string {
  if (!valor) return porDefecto;
  if (!valor.startsWith('/') || valor.startsWith('//')) return porDefecto;
  return valor;
}

/** Vuelve al frontend (no al backend) conservando la ruta y los parámetros */
function urlFrontend(destino: string, params?: Record<string, string>): string {
  const base =
    (env.FRONTEND_URL.split(',')[0] ?? '').trim().replace(/\/+$/, '') ||
    'http://localhost:5173';
  const url = new URL(destino.startsWith('/') ? destino : '/', `${base}/`);
  for (const [clave, valor] of Object.entries(params ?? {})) {
    url.searchParams.set(clave, valor);
  }
  return url.toString();
}

/* ============================================================
   GET /api/auth/msgraph/login?redirect=/proyectos/xxx
   Inicia el flujo OAuth delegado con la cuenta de Microsoft del usuario
   ============================================================ */
msgraphRoutes.get('/login', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.redirect(urlFrontend('/login'));
  }

  if (!graphConfigurado) {
    return c.json(
      {
        error: 'SharePoint no está configurado en el servidor',
        code: 'MSGRAPH_NO_CONFIGURADO',
        detalle:
          'Faltan MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET o MS_GRAPH_TENANT_ID en el entorno del backend.',
      },
      503
    );
  }

  const state = crypto.randomUUID();
  const destino = rutaSegura(c.req.query('redirect'));

  setCookie(c, STATE_COOKIE, state, { ...cookieBase(), maxAge: 60 * 10 });
  setCookie(c, RETURN_COOKIE, destino, { ...cookieBase(), maxAge: 60 * 10 });

  try {
    const url = await getAuthCodeUrl(state);
    return c.redirect(url);
  } catch (err) {
    console.error('No se pudo generar la URL de login de Microsoft:', err);
    return c.json(
      {
        error: 'No se pudo iniciar sesión con Microsoft',
        code: 'MSGRAPH_LOGIN_ERROR',
        detalle: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

/* ============================================================
   GET /api/auth/msgraph/callback
   Microsoft vuelve aquí con ?code; se cambia por tokens
   ============================================================ */
msgraphRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const stateCookie = getCookie(c, STATE_COOKIE);
  const destino = rutaSegura(getCookie(c, RETURN_COOKIE), '/');
  const errorMicrosoft = c.req.query('error');
  const detalleMicrosoft = c.req.query('error_description');

  deleteCookie(c, STATE_COOKIE, cookieBase());
  deleteCookie(c, RETURN_COOKIE, cookieBase());

  if (errorMicrosoft) {
    console.error('Microsoft devolvió un error en el login:', errorMicrosoft, detalleMicrosoft);
    return c.redirect(
      urlFrontend(destino, { sharepoint: 'error', motivo: errorMicrosoft ?? 'desconocido' })
    );
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return c.redirect(urlFrontend(destino, { sharepoint: 'error', motivo: 'state_invalido' }));
  }

  if (!graphConfigurado) {
    return c.redirect(urlFrontend(destino, { sharepoint: 'error', motivo: 'no_configurado' }));
  }

  try {
    const resultado = await exchangeCode(code);

    if (!resultado?.accessToken) {
      throw new Error('Microsoft no devolvió un access token');
    }

    if (resultado.refreshToken) {
      guardarRefreshToken(c, resultado.refreshToken);
    } else {
      console.warn(
        'Microsoft no devolvió refresh token. Revisa que el scope incluya offline_access y el consentimiento admin.'
      );
    }

    return c.redirect(urlFrontend(destino, { sharepoint: 'conectado' }));
  } catch (err) {
    console.error('Falló el intercambio de código de Microsoft Graph:', err);
    const mensaje = err instanceof Error ? err.message : 'token_exchange_failed';
    return c.redirect(
      urlFrontend(destino, { sharepoint: 'error', motivo: mensaje.slice(0, 300) })
    );
  }
});

/* ============================================================
   Device code flow (sin redirect URI ni HTTPS)

   POST /api/auth/msgraph/device/iniciar  → devuelve el código
   GET  /api/auth/msgraph/device/estado   → se consulta hasta 'listo'
   ============================================================ */

interface DevicePendiente {
  deviceCode: string;
  expiraAt: number;
  intervalo: number;
}

// device_code por usuario de la app (no se expone al navegador)
const dispositivos = new Map<string, DevicePendiente>();

msgraphRoutes.post('/device/iniciar', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  if (!graphConfigurado) {
    return c.json(
      {
        error: 'SharePoint no está configurado en el servidor',
        code: 'MSGRAPH_NO_CONFIGURADO',
        detalle:
          'Faltan MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET o MS_GRAPH_TENANT_ID en el entorno del backend.',
      },
      503
    );
  }

  try {
    const inicio = await iniciarDeviceCode();
    dispositivos.set(session.user.id, {
      deviceCode: inicio.deviceCode,
      expiraAt: Date.now() + inicio.expiraEn * 1000,
      intervalo: inicio.intervalo,
    });

    return c.json({
      codigo: inicio.codigoUsuario,
      url: inicio.urlVerificacion,
      mensaje: inicio.mensaje,
      intervalo: inicio.intervalo,
      expiraEn: inicio.expiraEn,
    });
  } catch (err) {
    console.error('No se pudo iniciar el código de dispositivo:', err);
    return c.json(
      {
        error: 'No se pudo iniciar sesión con Microsoft',
        code: 'MSGRAPH_DEVICE_ERROR',
        detalle: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

msgraphRoutes.get('/device/estado', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  const pendiente = dispositivos.get(session.user.id);
  if (!pendiente) {
    return c.json({ estado: 'sin_inicio' });
  }

  if (Date.now() > pendiente.expiraAt) {
    dispositivos.delete(session.user.id);
    return c.json({ estado: 'expirado' });
  }

  try {
    const resultado = await consultarDeviceCode(pendiente.deviceCode);

    if (resultado.estado === 'listo') {
      dispositivos.delete(session.user.id);

      if (!resultado.token.refreshToken) {
        return c.json({
          estado: 'error',
          detalle:
            'Microsoft no devolvió un refresh token. Revisa que el permiso offline_access esté configurado.',
        });
      }

      guardarRefreshToken(c, resultado.token.refreshToken);
      return c.json({ estado: 'listo' });
    }

    if (resultado.estado === 'pendiente') {
      if (resultado.intervalo) pendiente.intervalo = resultado.intervalo;
      return c.json({ estado: 'pendiente', intervalo: pendiente.intervalo });
    }

    dispositivos.delete(session.user.id);
    return c.json(resultado);
  } catch (err) {
    dispositivos.delete(session.user.id);
    return c.json({
      estado: 'error',
      detalle: err instanceof Error ? err.message : String(err),
    });
  }
});

/* ============================================================
   GET /api/auth/msgraph/estado
   Diagnóstico para la UI y para el administrador
   ============================================================ */
msgraphRoutes.get('/estado', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  if (!graphConfigurado) {
    return c.json({
      configurado: false,
      conectado: false,
      metodo: env.MS_GRAPH_AUTH_MODE,
      detalle:
        'Faltan MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET o MS_GRAPH_TENANT_ID en el entorno del backend.',
    });
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getGraphAccessToken(c);
  } catch {
    accessToken = null;
  }

  if (!accessToken) {
    return c.json({
      configurado: true,
      conectado: false,
      metodo: env.MS_GRAPH_AUTH_MODE,
    });
  }

  try {
    const usuario = await getGraphMe(accessToken);
    const sitio = await resolveSiteAndDrive(accessToken);
    return c.json({
      configurado: true,
      conectado: true,
      metodo: env.MS_GRAPH_AUTH_MODE,
      usuario,
      sitio: {
        nombre: sitio.driveName,
        webUrl: sitio.driveWebUrl,
        siteWebUrl: sitio.siteWebUrl,
      },
    });
  } catch (err) {
    return c.json({
      configurado: true,
      conectado: true,
      metodo: env.MS_GRAPH_AUTH_MODE,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/* ============================================================
   POST /api/auth/msgraph/logout
   ============================================================ */
msgraphRoutes.post('/logout', (c) => {
  limpiarSesionGraph(c);
  return c.json({ ok: true });
});

export { msgraphRoutes };
