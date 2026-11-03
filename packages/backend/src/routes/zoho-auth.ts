import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { auth } from '../lib/auth.js';
import { env } from '../lib/env.js';
import {
  cookieBase,
  getGraphAccessToken,
  guardarRefreshToken,
  limpiarSesionGraph,
  RETURN_COOKIE,
  STATE_COOKIE,
} from '../lib/graph-session.js';
import {
  diagnosticarZoho,
  exchangeZohoCode,
  getZohoAuthUrl,
  getZohoCurrentUser,
  getZohoPortals,
} from '../lib/zoho.js';
import {
  desconectarZoho,
  estadoZohoUsuario,
  guardarZohoToken,
} from '../lib/zoho-tokens.js';

const zohoRoutes = new Hono();

const ZOHO_STATE_COOKIE = 'op_zoho_state';
const ZOHO_RETURN_COOKIE = 'op_zoho_return';

function rutaSegura(valor: string | undefined, porDefecto = '/'): string {
  if (!valor) return porDefecto;
  if (!valor.startsWith('/') || valor.startsWith('//')) return porDefecto;
  return valor;
}

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

const zohoConfigurado = Boolean(env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_DOMAIN);

/* ============================================================
   GET /api/auth/zoho/login?redirect=/proyectos/xxx
   Inicia el flujo OAuth delegado con la cuenta de Zoho del usuario
   ============================================================ */
zohoRoutes.get('/login', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.redirect(urlFrontend('/login'));
  }

  if (!zohoConfigurado) {
    return c.json(
      {
        error: 'Zoho no está configurado en el servidor',
        code: 'ZOHO_NO_CONFIGURADO',
        detalle: 'Faltan ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET o ZOHO_DOMAIN en el entorno del backend.',
      },
      503
    );
  }

  const state = crypto.randomUUID();
  const destino = rutaSegura(c.req.query('redirect'));

  setCookie(c, ZOHO_STATE_COOKIE, state, { ...cookieBase(), maxAge: 60 * 10 });
  setCookie(c, ZOHO_RETURN_COOKIE, destino, { ...cookieBase(), maxAge: 60 * 10 });

  try {
    const url = getZohoAuthUrl(state);
    return c.redirect(url);
  } catch (err) {
    console.error('No se pudo generar la URL de login de Zoho:', err);
    return c.json(
      {
        error: 'No se pudo iniciar sesión con Zoho',
        code: 'ZOHO_LOGIN_ERROR',
        detalle: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

/* ============================================================
   GET /api/auth/zoho/callback
   Zoho vuelve aquí con ?code; se cambia por tokens
   ============================================================ */
zohoRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const stateCookie = getCookie(c, ZOHO_STATE_COOKIE);
  const destino = rutaSegura(getCookie(c, ZOHO_RETURN_COOKIE), '/');
  const errorZoho = c.req.query('error');
  const detalleZoho = c.req.query('error_description');

  deleteCookie(c, ZOHO_STATE_COOKIE, cookieBase());
  deleteCookie(c, ZOHO_RETURN_COOKIE, cookieBase());

  if (errorZoho) {
    console.error('Zoho devolvió un error en el login:', errorZoho, detalleZoho);
    return c.redirect(urlFrontend(destino, { zoho: 'error', motivo: errorZoho ?? 'desconocido' }));
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return c.redirect(urlFrontend(destino, { zoho: 'error', motivo: 'state_invalido' }));
  }

  if (!zohoConfigurado) {
    return c.redirect(urlFrontend(destino, { zoho: 'error', motivo: 'no_configurado' }));
  }

  try {
    const resultado = await exchangeZohoCode(code);

    if (!resultado?.accessToken) {
      throw new Error('Zoho no devolvió un access token');
    }

    // Obtener info del usuario y portal
    let cuenta = null;
    try {
      const [user, portals] = await Promise.all([
        getZohoCurrentUser(resultado.accessToken),
        getZohoPortals(resultado.accessToken),
      ]);
      const portal = portals.find(p => p.is_admin) ?? portals[0];
      cuenta = {
        portalId: portal?.portal_id ?? null,
        portalName: portal?.portal_name ?? null,
        email: user.email,
        userId: user.user_id,
      };
    } catch (err) {
      console.warn('No se pudo leer el perfil/portal de Zoho:', err);
    }

    // Guardar token persistente por usuario
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session?.user) {
      await guardarZohoToken(session.user.id, resultado, cuenta);
    }

    return c.redirect(urlFrontend(destino, { zoho: 'conectado' }));
  } catch (err) {
    console.error('Falló el intercambio de código de Zoho:', err);
    const mensaje = err instanceof Error ? err.message : 'token_exchange_failed';
    return c.redirect(urlFrontend(destino, { zoho: 'error', motivo: mensaje.slice(0, 300) }));
  }
});

/* ============================================================
   GET /api/auth/zoho/estado
   Diagnóstico para la UI
   ============================================================ */
zohoRoutes.get('/estado', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  if (!zohoConfigurado) {
    return c.json({
      configurado: false,
      conectado: false,
      detalle: 'Faltan ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET o ZOHO_DOMAIN en el entorno del backend.',
    });
  }

  const estado = await estadoZohoUsuario(session.user.id);

  return c.json({
    configurado: true,
    ...estado,
  });
});

/* ============================================================
   GET /api/auth/zoho/diagnostico (solo administradores)
   ============================================================ */
zohoRoutes.get('/diagnostico', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
  }

  const rol = String((session.user as unknown as { rol?: string }).rol ?? '');
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO'].includes(rol)) {
    return c.json({ error: 'Solo administradores', code: 'FORBIDDEN' }, 403);
  }

  const diagnostico = await diagnosticarZoho();
  return c.json({
    ...diagnostico,
    clientId: env.ZOHO_CLIENT_ID,
    domain: env.ZOHO_DOMAIN,
  });
});

/* ============================================================
   POST /api/auth/zoho/logout
   ============================================================ */
zohoRoutes.post('/logout', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user) await desconectarZoho(session.user.id);
  return c.json({ ok: true });
});

export { zohoRoutes };