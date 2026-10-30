import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface AppConfig {
  /** URL base del backend (sin /api final). */
  apiUrl: string;
  /** Cookie de sesión de Better-Auth ya serializada: "nombre=valor; nombre2=valor2". */
  sessionCookie?: string;
  sessionEmail?: string;
  sessionSavedAt?: string;
  sessionExpiresAt?: string;
}

export const DEFAULT_API_URL = "http://192.168.25.7:3001";

function baseDir(): string {
  if (process.env.OPERACIONES_PLANNER_CONFIG_DIR) {
    return process.env.OPERACIONES_PLANNER_CONFIG_DIR;
  }
  const plat = platform();
  if (plat === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "operaciones-planner-mcp");
  }
  if (plat === "darwin") {
    return join(homedir(), "Library", "Application Support", "operaciones-planner-mcp");
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "operaciones-planner-mcp");
}

export function configPath(): string {
  return join(baseDir(), "config.json");
}

function ensureDir(): void {
  const dir = baseDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

export function readConfig(): AppConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return { apiUrl: DEFAULT_API_URL };
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<AppConfig>;
    return {
      ...parsed,
      apiUrl: (parsed.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, ""),
    };
  } catch {
    // Config corrupta: no bloqueamos el arranque del MCP, se reescribe al hacer login.
    return { apiUrl: DEFAULT_API_URL };
  }
}

export function writeConfig(config: AppConfig): void {
  ensureDir();
  const path = configPath();
  const data = { ...config, apiUrl: config.apiUrl.replace(/\/+$/, "") };
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  if (platform() !== "win32") {
    try {
      chmodSync(path, 0o600);
    } catch {
      /* best effort */
    }
  }
}

export function clearSession(): AppConfig {
  const config = readConfig();
  const next: AppConfig = { apiUrl: config.apiUrl };
  writeConfig(next);
  return next;
}

/** Config + cookie, o error claro para mostrar al usuario. */
export function requireSession(): { config: AppConfig; cookie: string } {
  const config = readConfig();
  const cookie = config.sessionCookie || process.env.OPERACIONES_PLANNER_COOKIE;
  if (!cookie) {
    throw new Error(
      "No hay sesión guardada. Ejecuta `operaciones-planner-mcp --login` en una terminal para iniciar sesión con tu cuenta."
    );
  }
  return { config, cookie };
}

export function resolveApiUrl(explicit?: string): string {
  const url = explicit || process.env.OPERACIONES_PLANNER_API_URL || readConfig().apiUrl || DEFAULT_API_URL;
  return url.replace(/\/+$/, "");
}
