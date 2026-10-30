import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";
import { ApiClient, ApiError } from "../api.js";
import { requireSession } from "../config.js";

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface Recurso {
  id: string;
  nombre: string;
  apellido?: string | null;
  email?: string | null;
  codigo?: string | null;
  tipo?: string;
  departamento?: { id: string; nombre: string } | null;
  equipo?: { id: string; nombre: string } | null;
  cargo?: { id: string; nombre: string } | null;
}

export interface Etiqueta {
  id: string;
  nombre: string;
  color?: string;
}

export interface Proyecto {
  id: string;
  nombre: string;
  estado: string;
  percentComplete?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  descripcion?: string | null;
  cliente?: { id: string; nombre: string } | null;
  clienteId?: string | null;
  etiquetas?: Etiqueta[];
}

export interface WbsTarea {
  id: string;
  nombre: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  completada?: boolean;
  percentComplete?: number;
  relevante?: boolean;
  asignados?: Array<{ id: string; recursoId: string; nombre: string; apellido?: string | null }>;
  subtareas?: WbsSubtarea[];
  etiquetas?: Etiqueta[];
}

export interface WbsSubtarea {
  id: string;
  nombre: string;
  descripcion?: string | null;
  completada?: boolean;
  relevante?: boolean;
  etiquetas?: Etiqueta[];
}

export interface WbsActividad {
  id: string;
  nombre: string;
  descripcion?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  percentComplete?: number;
  tareas?: WbsTarea[];
  etiquetas?: Etiqueta[];
}

export interface WbsResponse {
  proyecto: Proyecto & { scheduledStart?: string | null; scheduledEnd?: string | null };
  actividades: WbsActividad[];
  asignaciones: Array<{
    id: string;
    recursoId: string;
    recursoNombre: string;
    tipoActividadNombre: string;
    nombre?: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
  }>;
  metadata: Record<string, number>;
}

export interface Material {
  id: string;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  cantidad: number;
  unidad?: string | null;
  estado: string;
  notas?: string | null;
  catalogo?: { id: string; nombre: string; categoria?: string | null; unidadBase?: string | null } | null;
  recurso?: { id: string; nombre: string; apellido?: string | null } | null;
}

export function text(value: string): ToolResult {
  return { content: [{ type: "text", text: value }] };
}

export function errorText(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function client(): ApiClient {
  const { config, cookie } = requireSession();
  return new ApiClient({ apiUrl: config.apiUrl, cookie });
}

/** Envuelve un handler para devolver siempre un resultado MCP legible. */
export function register(
  server: McpServer,
  name: string,
  description: string,
  shape: ZodRawShape,
  handler: (args: any) => Promise<string>
): void {
  server.tool(name, description, shape, async (args: any) => {
    try {
      return text(await handler(args));
    } catch (error) {
      return errorText(describeError(error));
    }
  });
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return (
        "Sesion no valida o expirada (401).\n" +
        "Ejecuta en una terminal `operaciones-planner-mcp --login` y vuelve a intentarlo. " +
        "Si el problema continua, verifica el servidor configurado con `--status`."
      );
    }
    if (error.status === 403) {
      return `Sin permisos (403): ${error.message}\nTu usuario no tiene el rol necesario para esta accion.`;
    }
    if (error.code === "CONFLICTO_DETECTADO" || error.code === "CONFLICTO_EN_MOVIMIENTO") {
      const data = error.data as { conflictos?: Array<{ mensaje?: string; solucionSugerida?: string }> } | undefined;
      const detalles = (data?.conflictos ?? [])
        .map((c) => `- ${c.mensaje ?? "Conflicto"}${c.solucionSugerida ? ` (${c.solucionSugerida})` : ""}`)
        .join("\n");
      return (
        `Conflicto de planificacion (409): ${error.message}\n` +
        (detalles ? detalles + "\n" : "") +
        "Si la asignacion debe quedar igual, repite la operacion con `forzar: true`."
      );
    }
    if (error.code === "OPTIMISTIC_LOCK_CONFLICT") {
      return "La asignacion fue modificada por otra persona. Vuelve a consultarla y repite la operacion.";
    }
    const payload = error.data as { details?: unknown } | undefined;
    const extra = payload?.details ? `\nDetalles: ${JSON.stringify(payload.details)}` : "";
    return `Error de la API (${error.status || "sin conexion"}): ${error.message}${extra}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function fmtDate(value?: string | Date | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

export function fmtDateRange(inicio?: string | null, fin?: string | null): string {
  if (!inicio && !fin) return "sin fechas";
  return `${fmtDate(inicio)} a ${fmtDate(fin)}`;
}

export function fmtPersona(recurso: { nombre: string; apellido?: string | null }): string {
  return `${recurso.nombre}${recurso.apellido ? " " + recurso.apellido : ""}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ============================================
// RESOLUCION DE ENTIDADES POR NOMBRE O ID
// ============================================

export async function buscarProyectos(q?: string): Promise<Proyecto[]> {
  return client().get<Proyecto[]>("/api/proyectos", { q });
}

export async function resolveProyecto(referencia: string): Promise<Proyecto> {
  const ref = referencia.trim();
  if (!ref) throw new Error("Falta el proyecto (nombre o ID).");
  const api = client();

  const encontrados = await api.get<Proyecto[]>("/api/proyectos", { q: ref });
  const exacto = encontrados.find((p) => normalize(p.nombre) === normalize(ref));
  if (exacto) return exacto;
  if (encontrados.length === 1) return encontrados[0];

  if (/^[a-z0-9]{20,}$/i.test(ref)) {
    try {
      return await api.get<Proyecto>(`/api/proyectos/${ref}`);
    } catch {
      /* sigue con el mensaje de abajo */
    }
  }

  if (encontrados.length === 0) {
    throw new Error(
      `No encontre el proyecto "${ref}". Usa la herramienta listar_proyectos para ver los proyectos disponibles.`
    );
  }
  const lista = encontrados.slice(0, 15).map((p) => `- ${p.nombre} (ID: ${p.id})`).join("\n");
  throw new Error(`Hay varios proyectos que coinciden con "${ref}":\n${lista}\nUsa el ID exacto.`);
}

export async function getWbs(proyectoId: string): Promise<WbsResponse> {
  return client().get<WbsResponse>(`/api/actividades/proyecto/${proyectoId}`);
}

function coincideRecurso(ref: string, recurso: Recurso): boolean {
  const objetivo = normalize(ref);
  return (
    recurso.id === ref ||
    normalize(fmtPersona(recurso)) === objetivo ||
    normalize(recurso.nombre) === objetivo ||
    (recurso.email ? normalize(recurso.email) === objetivo : false) ||
    (recurso.codigo ? normalize(recurso.codigo) === objetivo : false)
  );
}

export async function resolveRecurso(referencia: string): Promise<Recurso> {
  const ref = referencia.trim();
  if (!ref) throw new Error("Falta el recurso (nombre, email o ID).");
  const api = client();
  const tokens = ref.split(/\s+/);
  const candidatos = new Map<string, Recurso>();

  for (const q of [...new Set([ref, tokens[0], tokens[tokens.length - 1]])]) {
    if (!q) continue;
    const lista = await api.get<Recurso[]>("/api/recursos", { q, activo: true });
    for (const recurso of lista) candidatos.set(recurso.id, recurso);
    const match = lista.filter((r) => coincideRecurso(ref, r));
    if (match.length === 1) return match[0];
    if (match.length > 1) {
      const opciones = match.map((r) => `- ${fmtPersona(r)} (ID: ${r.id})`).join("\n");
      throw new Error(`Hay varios recursos que coinciden con "${ref}":\n${opciones}\nUsa el ID exacto.`);
    }
  }

  const porId = candidatos.get(ref);
  if (porId) return porId;

  throw new Error(
    `No encontre el recurso "${ref}". Usa listar_recursos con una parte del nombre para ver las coincidencias.`
  );
}

export async function resolveRecursos(referencias: string[]): Promise<Recurso[]> {
  const out: Recurso[] = [];
  for (const ref of referencias) {
    out.push(await resolveRecurso(ref));
  }
  return out;
}

export async function resolveTipoActividad(referencia: string): Promise<{ id: string; nombre: string }> {
  const api = client();
  const tipos = await api.get<Array<{ id: string; nombre: string }>>("/api/tipos-actividad");
  const ref = referencia.trim();
  const exacto = tipos.find((t) => normalize(t.nombre) === normalize(ref) || t.id === ref);
  if (exacto) return exacto;
  const parciales = tipos.filter((t) => normalize(t.nombre).includes(normalize(ref)));
  if (parciales.length === 1) return parciales[0];
  const lista = tipos.map((t) => `- ${t.nombre} (ID: ${t.id})`).join("\n");
  throw new Error(`No encontre el tipo de actividad "${ref}". Tipos disponibles:\n${lista}`);
}

export async function listarEtiquetas(): Promise<Etiqueta[]> {
  return client().get<Etiqueta[]>("/api/etiquetas");
}

export async function resolveEtiquetas(
  nombres: string[],
  opciones: { crear?: boolean } = {}
): Promise<{ ids: string[]; etiquetas: Etiqueta[]; avisos: string[] }> {
  const api = client();
  const todas = await api.get<Etiqueta[]>("/api/etiquetas");
  const ids: string[] = [];
  const etiquetas: Etiqueta[] = [];
  const avisos: string[] = [];
  const crear = opciones.crear !== false;

  for (const nombre of nombres) {
    const existente = todas.find((e) => normalize(e.nombre) === normalize(nombre));
    if (existente) {
      ids.push(existente.id);
      etiquetas.push(existente);
      continue;
    }
    if (!crear) {
      avisos.push(`La etiqueta "${nombre}" no existe.`);
      continue;
    }
    try {
      const creada = await api.post<Etiqueta>("/api/etiquetas", { nombre });
      todas.push(creada);
      ids.push(creada.id);
      etiquetas.push(creada);
    } catch (error) {
      avisos.push(`No se pudo crear la etiqueta "${nombre}": ${describeError(error)}`);
    }
  }
  return { ids, etiquetas, avisos };
}

export async function ensureCliente(
  nombre: string
): Promise<{ clienteId?: string; aviso?: string }> {
  const api = client();
  const lista = await api.get<Array<{ id: string; nombre: string }>>("/api/clientes", { q: nombre });
  const existente = lista.find((c) => normalize(c.nombre) === normalize(nombre));
  if (existente) return { clienteId: existente.id };
  try {
    const creado = await api.post<{ id: string }>("/api/clientes", { nombre });
    return { clienteId: creado.id };
  } catch (error) {
    return {
      aviso: `El cliente "${nombre}" no existe y no se pudo crear (${describeError(error)}). El proyecto se creara sin cliente.`,
    };
  }
}

export async function resolveCatalogoMaterial(
  nombre: string
): Promise<{ id: string; nombre: string; categoria?: string | null; unidadBase?: string | null; cantidadSugerida?: number | null } | null> {
  const api = client();
  const items = await api.get<Array<{
    id: string;
    nombre: string;
    categoria?: string | null;
    unidadBase?: string | null;
    cantidadSugerida?: number | null;
  }>>("/api/materiales-catalogo", { activo: true });
  return items.find((i) => normalize(i.nombre) === normalize(nombre)) ?? null;
}

// ============================================
// BUSQUEDA DENTRO DEL WBS
// ============================================

export function findActividad(wbs: WbsResponse, referencia: string): WbsActividad {
  const ref = referencia.trim();
  const lista = wbs.actividades;
  const exactos = lista.filter((a) => a.id === ref || normalize(a.nombre) === normalize(ref));
  if (exactos.length === 1) return exactos[0];
  if (exactos.length > 1) {
    const opciones = exactos.map((a) => `- ${a.nombre} (ID: ${a.id})`).join("\n");
    throw new Error(`Hay varias actividades llamadas "${ref}":\n${opciones}\nUsa el ID exacto.`);
  }
  const parciales = lista.filter((a) => normalize(a.nombre).includes(normalize(ref)));
  if (parciales.length === 1) return parciales[0];
  const disponibles = lista.map((a) => `- ${a.nombre} (ID: ${a.id})`).join("\n");
  throw new Error(
    `No encontre la actividad "${ref}" en el proyecto. Actividades disponibles:\n${disponibles || "(ninguna)"}`
  );
}

export function findTarea(
  wbs: WbsResponse,
  referencia: string,
  actividadReferencia?: string
): { tarea: WbsTarea; actividad: WbsActividad } {
  const ref = referencia.trim();
  const actividades = actividadReferencia
    ? [findActividad(wbs, actividadReferencia)]
    : wbs.actividades;

  const pares = actividades.flatMap((actividad) =>
    (actividad.tareas ?? []).map((tarea) => ({ tarea, actividad }))
  );
  const exactos = pares.filter(
    ({ tarea }) => tarea.id === ref || normalize(tarea.nombre) === normalize(ref)
  );
  if (exactos.length === 1) return exactos[0];
  if (exactos.length > 1) {
    const opciones = exactos
      .map(({ tarea, actividad }) => `- ${actividad.nombre} > ${tarea.nombre} (ID: ${tarea.id})`)
      .join("\n");
    throw new Error(
      `Hay varias tareas llamadas "${ref}":\n${opciones}\nUsa el ID exacto o indica la actividad.`
    );
  }

  const parciales = pares.filter(({ tarea }) => normalize(tarea.nombre).includes(normalize(ref)));
  if (parciales.length === 1) return parciales[0];

  const disponibles = pares
    .slice(0, 40)
    .map(({ tarea, actividad }) => `- ${actividad.nombre} > ${tarea.nombre} (ID: ${tarea.id})`)
    .join("\n");
  throw new Error(
    `No encontre la tarea "${ref}" en el proyecto. Tareas disponibles:\n${disponibles || "(ninguna)"}`
  );
}

export function findSubtarea(
  wbs: WbsResponse,
  referencia: string,
  tareaReferencia?: string
): { subtarea: WbsSubtarea; tarea: WbsTarea; actividad: WbsActividad } {
  const ref = referencia.trim();
  const tareas = tareaReferencia
    ? [findTarea(wbs, tareaReferencia)]
    : wbs.actividades.flatMap((actividad) =>
        (actividad.tareas ?? []).map((tarea) => ({ tarea, actividad }))
      );

  const pares = tareas.flatMap(({ tarea, actividad }) =>
    (tarea.subtareas ?? []).map((subtarea) => ({ subtarea, tarea, actividad }))
  );
  const exactos = pares.filter(
    ({ subtarea }) => subtarea.id === ref || normalize(subtarea.nombre) === normalize(ref)
  );
  if (exactos.length === 1) return exactos[0];
  if (exactos.length > 1) {
    const opciones = exactos
      .map(
        ({ subtarea, tarea, actividad }) =>
          `- ${actividad.nombre} > ${tarea.nombre} > ${subtarea.nombre} (ID: ${subtarea.id})`
      )
      .join("\n");
    throw new Error(
      `Hay varias subtareas llamadas "${ref}":\n${opciones}\nUsa el ID exacto o indica la tarea.`
    );
  }
  const disponibles = pares
    .slice(0, 60)
    .map(
      ({ subtarea, tarea, actividad }) =>
        `- ${actividad.nombre} > ${tarea.nombre} > ${subtarea.nombre} (ID: ${subtarea.id})`
    )
    .join("\n");
  throw new Error(
    `No encontre la subtarea "${ref}" en el proyecto. Subtareas disponibles:\n${disponibles || "(ninguna)"}`
  );
}
