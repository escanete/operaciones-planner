import readline from "node:readline";
import { ApiError } from "./api.js";
import { readConfig, resolveApiUrl, writeConfig, clearSession, type AppConfig } from "./config.js";

interface SessionUser {
  id: string;
  email: string;
  name?: string;
  rol?: string;
}

interface SessionResponse {
  session?: { expiresAt?: string; createdAt?: string };
  user?: SessionUser;
}

function splitSetCookie(header: string): string[] {
  // Separa varias cookies cuando el runtime no expone getSetCookie().
  // Las comas dentro de "Expires=Wed, 21 Oct..." no inician una cookie nueva.
  return header.split(/,(?=\s*[^;=,\s]+=)/g).map((s) => s.trim()).filter(Boolean);
}

function extractCookieHeader(response: Response): string {
  const anyHeaders = response.headers as unknown as { getSetCookie?: () => string[] };
  const raw =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : splitSetCookie(response.headers.get("set-cookie") ?? "");

  const pairs: string[] = [];
  for (const header of raw) {
    const pair = header.split(";")[0]?.trim();
    if (!pair || !pair.includes("=")) continue;
    const name = pair.slice(0, pair.indexOf("=")).toLowerCase();
    if (name.includes("better-auth") || name.includes("session")) {
      if (!pairs.some((p) => p.slice(0, p.indexOf("=")) === pair.slice(0, pair.indexOf("=")))) {
        pairs.push(pair);
      }
    }
  }
  return pairs.join("; ");
}

async function fetchSession(apiUrl: string, cookie: string): Promise<SessionResponse | null> {
  const response = await fetch(`${apiUrl}/api/auth/get-session`, {
    headers: { Accept: "application/json", Cookie: cookie },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as SessionResponse | null;
  return data?.user ? data : null;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = (rl as any)._writeToOutput as (text: string) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rl as any)._writeToOutput = function (text: string) {
      if (text.includes(question)) original.call(rl, text);
      else original.call(rl, "*".repeat(text.length));
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

export interface LoginOptions {
  apiUrl?: string;
  email?: string;
  password?: string;
}

export async function login(options: LoginOptions = {}): Promise<{ apiUrl: string; user: SessionUser }> {
  const apiUrl = resolveApiUrl(options.apiUrl);

  process.stderr.write(`Servidor: ${apiUrl}\n`);
  const email = options.email?.trim() || (await ask("Email: "));
  const password = options.password ?? (await askHidden("Contraseña: "));

  if (!email || !password) {
    throw new Error("Email y contraseña son obligatorios.");
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: apiUrl,
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo conectar con ${apiUrl}: ${reason}`);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      (typeof body.message === "string" && body.message) ||
      (typeof body.error === "string" && body.error) ||
      "Credenciales incorrectas o usuario inactivo.";
    throw new Error(`Login fallido (${response.status}): ${message}`);
  }

  const cookie = extractCookieHeader(response);
  if (!cookie) {
    throw new Error("El servidor inició sesión pero no devolvió la cookie de sesión esperada.");
  }

  const session = await fetchSession(apiUrl, cookie);
  if (!session?.user) {
    throw new Error("La cookie de sesión no fue aceptada por el servidor. Intenta nuevamente.");
  }

  const config: AppConfig = {
    apiUrl,
    sessionCookie: cookie,
    sessionEmail: session.user.email || email,
    sessionSavedAt: new Date().toISOString(),
    sessionExpiresAt: session.session?.expiresAt,
  };
  writeConfig(config);

  return { apiUrl, user: session.user };
}

export async function logout(): Promise<void> {
  const config = readConfig();
  const cookie = config.sessionCookie;
  if (cookie) {
    try {
      await fetch(`${config.apiUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie, Origin: config.apiUrl },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      /* la sesión local se borra igual */
    }
  }
  clearSession();
}

export interface SessionStatus {
  apiUrl: string;
  hasSession: boolean;
  email?: string;
  expiresAt?: string;
  valid: boolean;
  error?: string;
}

export async function checkStatus(apiUrlOverride?: string): Promise<SessionStatus> {
  const config = readConfig();
  const apiUrl = resolveApiUrl(apiUrlOverride || config.apiUrl);
  if (!config.sessionCookie) {
    return { apiUrl, hasSession: false, valid: false, error: "No hay sesión guardada." };
  }
  try {
    const session = await fetchSession(apiUrl, config.sessionCookie);
    if (!session?.user) {
      return {
        apiUrl,
        hasSession: true,
        email: config.sessionEmail,
        expiresAt: config.sessionExpiresAt,
        valid: false,
        error: "La sesión expiró o fue revocada. Ejecuta --login nuevamente.",
      };
    }
    return {
      apiUrl,
      hasSession: true,
      email: session.user.email || config.sessionEmail,
      expiresAt: session.session?.expiresAt || config.sessionExpiresAt,
      valid: true,
    };
  } catch (error) {
    return {
      apiUrl,
      hasSession: true,
      email: config.sessionEmail,
      expiresAt: config.sessionExpiresAt,
      valid: false,
      error: error instanceof ApiError ? error.message : error instanceof Error ? error.message : String(error),
    };
  }
}
