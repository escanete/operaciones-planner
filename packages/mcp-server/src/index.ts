import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { checkStatus, login, logout } from "./auth.js";
import { configPath, readConfig } from "./config.js";
import { claudeConfigPath, installClaudeDesktop, uninstallClaudeDesktop } from "./install.js";
import { registerConsultas } from "./tools/consultas.js";
import { registerExcel } from "./tools/excel.js";
import { registerMateriales } from "./tools/materiales.js";
import { registerPlanificacion } from "./tools/planificacion.js";
import { registerProyectos } from "./tools/proyectos.js";
import { registerWbs } from "./tools/wbs.js";

const VERSION = "1.0.0";

const HELP = `Operaciones Planner MCP Server ${VERSION}

Conecta Claude Desktop con tu cuenta de Operaciones Planner (lectura y escritura).

USO
  operaciones-planner-mcp                 Inicia el servidor MCP por stdio (lo usa Claude)
  operaciones-planner-mcp --login         Inicia sesion y configura Claude Desktop
  operaciones-planner-mcp --status        Muestra la sesion y el servidor configurado
  operaciones-planner-mcp --logout        Cierra la sesion local
  operaciones-planner-mcp --install       Solo escribe la configuracion de Claude Desktop
  operaciones-planner-mcp --uninstall     Quita el servidor de Claude Desktop

OPCIONES
  --api-url <url>     URL del backend (default: http://192.168.25.7:3001)
  --email <email>     Email para el login (si no, se pregunta)
  --password <pass>   Contrasena para el login (si no, se pregunta de forma oculta)
  --no-install        Con --login, no toca la configuracion de Claude Desktop
  -h, --help          Muestra esta ayuda

ARCHIVOS
  Configuracion MCP:  ${configPath()}
  Config de Claude:   ${claudeConfigPath()}
`;

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function print(message: string): void {
  process.stdout.write(message + "\n");
}

async function startServer(): Promise<void> {
  const server = new McpServer(
    { name: "operaciones-planner", version: VERSION },
    {
      instructions: [
        "Servidor local de Operaciones Planner. Cada persona usa su propia cuenta; los permisos son los de su rol.",
        "Reglas de uso:",
        "- Fechas siempre en formato YYYY-MM-DD.",
        "- Resuelve proyectos, recursos y tareas por nombre o por ID; si hay ambiguedad la herramienta devuelve las opciones.",
        "- Jerarquia WBS: Proyecto > Actividad > Tarea > Subtarea.",
        "- Para asignar personas a tareas (sin fechas de planificacion) usa crear_tarea o actualizar_tarea con el campo recursos.",
        "- Para planificacion con fechas usa asignar_recurso (requiere tipo de actividad) y consultar_carga para ver ocupacion.",
        "- Los materiales pueden venir del catalogo global o ser libres.",
        "- Si una herramienta devuelve 401, la sesion expiro: pide ejecutar `operaciones-planner-mcp --login`.",
        "- No inventes IDs ni datos: consulta primero con las herramientas de listado.",
      ].join("\n"),
    }
  );

  registerConsultas(server);
  registerProyectos(server);
  registerWbs(server);
  registerPlanificacion(server);
  registerMateriales(server);
  registerExcel(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const config = readConfig();
  console.error(`[operaciones-planner] MCP ${VERSION} listo (API: ${config.apiUrl})`);
  if (!config.sessionCookie) {
    console.error("[operaciones-planner] Sin sesion guardada. Ejecuta --login para autenticarte.");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    print(HELP);
    return;
  }

  if (hasFlag(args, "--login")) {
    const resultado = await login({
      apiUrl: flagValue(args, "--api-url"),
      email: flagValue(args, "--email"),
      password: flagValue(args, "--password"),
    });
    const nombre = resultado.user.name || resultado.user.email;
    print(`Sesion iniciada como ${nombre} (${resultado.user.rol ?? "sin rol"}) en ${resultado.apiUrl}.`);
    if (!hasFlag(args, "--no-install")) {
      try {
        const install = installClaudeDesktop();
        print(`Claude Desktop configurado: ${install.configPath}`);
        print("Cierra y vuelve a abrir Claude Desktop para que aparezca el servidor.");
        if (install.backupPath) print(`Respaldo de la configuracion anterior: ${install.backupPath}`);
      } catch (error) {
        print(
          `No se pudo configurar Claude Desktop automaticamente: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        print("Puedes ejecutar `operaciones-planner-mcp --install` mas tarde.");
      }
    }
    return;
  }

  if (hasFlag(args, "--logout")) {
    await logout();
    print("Sesion local cerrada y eliminada.");
    return;
  }

  if (hasFlag(args, "--status")) {
    const status = await checkStatus(flagValue(args, "--api-url"));
    print(`Servidor: ${status.apiUrl}`);
    print(`Configuracion MCP: ${configPath()}`);
    print(`Config de Claude: ${claudeConfigPath()}`);
    if (!status.hasSession) {
      print("Sesion: sin iniciar. Ejecuta `operaciones-planner-mcp --login`.");
      return;
    }
    print(`Usuario: ${status.email ?? "(desconocido)"}`);
    print(`Vence: ${status.expiresAt ?? "(desconocido)"}`);
    print(`Estado: ${status.valid ? "VALIDA" : "INVALIDA"}`);
    if (status.error) print(`Detalle: ${status.error}`);
    return;
  }

  if (hasFlag(args, "--install")) {
    const install = installClaudeDesktop();
    print(`Servidor MCP registrado en Claude Desktop.`);
    print(`Config: ${install.configPath}`);
    print(`Comando: ${install.nodePath} ${install.serverPath}`);
    return;
  }

  if (hasFlag(args, "--uninstall")) {
    const result = uninstallClaudeDesktop();
    print(
      result.removed
        ? `Servidor MCP quitado de ${result.configPath}.`
        : `El servidor MCP no estaba registrado en ${result.configPath}.`
    );
    return;
  }

  await startServer();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
