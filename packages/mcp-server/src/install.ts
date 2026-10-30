import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";

const SERVER_KEY = "operaciones-planner";

export function claudeConfigPath(): string {
  const plat = platform();
  if (plat === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  if (plat === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "Claude", "claude_desktop_config.json");
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

function readClaudeConfig(path: string): ClaudeConfig {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ClaudeConfig;
  } catch {
    throw new Error(
      `El archivo de configuración de Claude no es JSON válido: ${path}\n` +
        "Ábrelo, revisa la sintaxis y vuelve a ejecutar el instalador."
    );
  }
}

export interface InstallResult {
  configPath: string;
  backupPath?: string;
  serverPath: string;
  nodePath: string;
}

export function installClaudeDesktop(): InstallResult {
  const configPath = claudeConfigPath();
  const nodePath = process.execPath;
  const serverPath = currentEntryPoint();

  if (!existsSync(serverPath)) {
    throw new Error(`No se encontró el archivo del servidor MCP: ${serverPath}`);
  }

  const config = readClaudeConfig(configPath);
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;

  let backupPath: string | undefined;
  if (existsSync(configPath)) {
    backupPath = `${configPath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    copyFileSync(configPath, backupPath);
  }

  servers[SERVER_KEY] = {
    command: nodePath,
    args: [serverPath],
  };
  config.mcpServers = servers;

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  return { configPath, backupPath, serverPath, nodePath };
}

export function uninstallClaudeDesktop(): { configPath: string; removed: boolean } {
  const configPath = claudeConfigPath();
  if (!existsSync(configPath)) return { configPath, removed: false };

  const config = readClaudeConfig(configPath);
  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  if (!(SERVER_KEY in servers)) return { configPath, removed: false };

  delete servers[SERVER_KEY];
  config.mcpServers = servers;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  return { configPath, removed: true };
}
