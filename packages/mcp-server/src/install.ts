import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";

const SERVER_KEY = "operaciones-planner";

/**
 * Detecta TODAS las rutas posibles de configuración de Claude Desktop en Windows.
 * La versión Microsoft Store usa una ruta distinta a la del instalador web.
 */
function getAllClaudeConfigPaths(): string[] {
  const plat = platform();
  if (plat !== "win32") {
    // macOS / Linux: una sola ruta estándar
    if (plat === "darwin") {
      return [join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")];
    }
    return [join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "Claude", "claude_desktop_config.json")];
  }

  const paths: string[] = [];

  // 1. Instalador web clásico (Roaming)
  const roaming = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  paths.push(roaming);

  // 2. Microsoft Store (Local) - detectar carpeta del paquete
  const localBase = join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Claude-Data");
  if (existsSync(localBase)) {
    try {
      const entries = readdirSync(localBase, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("anthropicpbc.claude_")) {
          paths.push(join(localBase, entry.name, "claude_desktop_config.json"));
        }
      }
    } catch {
      /* ignorar errores de lectura */
    }
  }

  // 3. Fallback: Local\AppData\Claude (algunas versiones)
  paths.push(join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Claude", "claude_desktop_config.json"));

  return paths;
}

/**
 * Devuelve la ruta principal (la primera que existe o la clásica Roaming).
 * Para lectura/escritura única (compatibilidad hacia atrás).
 */
export function claudeConfigPath(): string {
  const paths = getAllClaudeConfigPaths();
  // Preferir la que ya existe
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  // Si ninguna existe, usar la clásica (Roaming)
  return paths[0];
}

/**
 * Escribe la configuración en TODAS las rutas detectadas (para cubrir ambas versiones).
 */
function writeClaudeConfigAll(config: any): {
  written: string[];
  backups: string[];
  errors: string[];
} {
  const paths = getAllClaudeConfigPaths();
  const written: string[] = [];
  const backups: string[] = [];
  const errors: string[] = [];

  for (const configPath of paths) {
    try {
      if (existsSync(configPath)) {
        const backupPath = `${configPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        copyFileSync(configPath, backupPath);
        backups.push(backupPath);
      }

      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
      written.push(configPath);
    } catch (e) {
      errors.push(`${configPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { written, backups, errors };
}

function readClaudeConfig(path: string): any {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `El archivo de configuración de Claude no es JSON válido: ${path}\n` +
        "Ábrelo, revisa la sintaxis y vuelve a ejecutar el instalador."
    );
  }
}

function currentEntryPoint(): string {
  const entry = process.argv[1];
  if (!entry) {
    throw new Error("No se pudo determinar la ruta del ejecutable del MCP.");
  }
  return resolve(entry);
}

interface ClaudeConfig {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface InstallResult {
  configPaths: string[];
  backupPaths: string[];
  serverPath: string;
  nodePath: string;
}

export function installClaudeDesktop(): InstallResult {
  const nodePath = process.execPath;
  const serverPath = currentEntryPoint();

  if (!existsSync(serverPath)) {
    throw new Error(`No se encontró el archivo del servidor MCP: ${serverPath}`);
  }

  // Leer la config principal (la que existe)
  const mainConfigPath = claudeConfigPath();
  const config = readClaudeConfig(mainConfigPath);
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;

  servers[SERVER_KEY] = {
    command: nodePath,
    args: [serverPath],
  };
  config.mcpServers = servers;

  // Escribir en TODAS las rutas detectadas
  const result = writeClaudeConfigAll(config);

  if (result.errors.length > 0) {
    console.error("Advertencias al escribir config:", result.errors.join("; "));
  }

  return {
    configPaths: result.written,
    backupPaths: result.backups,
    serverPath,
    nodePath,
  };
}

export function uninstallClaudeDesktop(): { configPaths: string[]; removed: boolean } {
  const paths = getAllClaudeConfigPaths();
  let removedAny = false;
  const removedPaths: string[] = [];

  for (const configPath of paths) {
    if (!existsSync(configPath)) continue;

    const config = readClaudeConfig(configPath);
    const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
    if (!(SERVER_KEY in servers)) continue;

    delete servers[SERVER_KEY];
    config.mcpServers = servers;

    try {
      const backupPath = `${configPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      copyFileSync(configPath, backupPath);
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
      removedPaths.push(configPath);
      removedAny = true;
    } catch {
      /* best effort */
    }
  }

  return { configPaths: removedPaths, removed: removedAny };
}
