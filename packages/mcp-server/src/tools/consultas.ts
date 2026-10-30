import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  client,
  fmtDate,
  fmtDateRange,
  fmtPersona,
  register,
  resolveProyecto,
  resolveRecurso,
  getWbs,
  type Material,
  type Proyecto,
  type Recurso,
} from "./_shared.js";

const ESTADOS_PROYECTO = ["PLANIFICACION", "ACTIVO", "EN_PAUSA", "FINALIZADO", "CANCELADO"] as const;

function proyectoLinea(p: Proyecto): string {
  const cliente = p.cliente?.nombre ?? "sin cliente";
  const avance = typeof p.percentComplete === "number" ? `${p.percentComplete}%` : "-";
  return `- **${p.nombre}** (ID: ${p.id}) - ${cliente} - ${p.estado} - ${fmtDateRange(p.fechaInicio, p.fechaFin)} - avance ${avance}`;
}

export function registerConsultas(server: McpServer): void {
  register(
    server,
    "listar_proyectos",
    "Lista proyectos de la plataforma con su ID, cliente, estado, fechas y avance. Usa `q` para buscar por nombre, codigo o descripcion.",
    {
      q: z.string().optional().describe("Texto a buscar en nombre, codigo o descripcion"),
      estado: z.enum(ESTADOS_PROYECTO).optional().describe("Filtra por estado"),
      cliente: z.string().optional().describe("Nombre o ID del cliente"),
      activo: z.boolean().optional().describe("true = solo activos, false = solo inactivos"),
    },
    async (args) => {
      const api = client();
      const query: Record<string, string | boolean | undefined> = {
        q: args.q,
        estado: args.estado,
        activo: args.activo,
      };
      if (args.cliente) {
        const clientes = await api.get<Array<{ id: string; nombre: string }>>("/api/clientes", {
          q: args.cliente,
        });
        const match =
          clientes.find((c) => c.nombre.toLowerCase() === String(args.cliente).toLowerCase()) ??
          (clientes.length === 1 ? clientes[0] : undefined);
        if (!match) {
          throw new Error(`No encontre el cliente "${args.cliente}". Usa listar_clientes.`);
        }
        query.clienteId = match.id;
      }

      const proyectos = await api.get<Proyecto[]>("/api/proyectos", query);
      if (proyectos.length === 0) return "No hay proyectos que coincidan con el filtro.";

      const limite = 60;
      const visibles = proyectos.slice(0, limite);
      const resto = proyectos.length - visibles.length;
      return (
        `# Proyectos (${proyectos.length})\n\n` +
        visibles.map(proyectoLinea).join("\n") +
        (resto > 0 ? `\n\n_... y ${resto} mas. Afina la busqueda con \`q\`._` : "")
      );
    }
  );

  register(
    server,
    "ver_proyecto",
    "Muestra el detalle completo de un proyecto: datos generales, jerarquia WBS (actividades, tareas, subtareas, asignados y avance), materiales y asignaciones a nivel proyecto.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      incluirMateriales: z.boolean().optional().describe("Incluir materiales del proyecto (default true)"),
      incluirAsignaciones: z.boolean().optional().describe("Incluir asignaciones de planificacion (default true)"),
      maxLineas: z.number().int().min(20).max(500).optional().describe("Limite de lineas del arbol WBS (default 250)"),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const wbs = await getWbs(proyecto.id);
      const api = client();
      const maxLineas = args.maxLineas ?? 250;

      const lineas: string[] = [];
      lineas.push(`# ${wbs.proyecto.nombre}`);
      lineas.push(`ID: \`${wbs.proyecto.id}\``);
      lineas.push(
        `Cliente: ${proyecto.cliente?.nombre ?? "sin cliente"} | Estado: ${wbs.proyecto.estado} | Avance: ${
          wbs.proyecto.percentComplete ?? 0
        }%`
      );
      lineas.push(`Fechas: ${fmtDateRange(wbs.proyecto.fechaInicio, wbs.proyecto.fechaFin)}`);
      if (wbs.proyecto.scheduledStart || wbs.proyecto.scheduledEnd) {
        lineas.push(
          `Planificado: ${fmtDateRange(wbs.proyecto.scheduledStart, wbs.proyecto.scheduledEnd)}`
        );
      }
      if (wbs.proyecto.etiquetas?.length) {
        lineas.push(`Etiquetas: ${wbs.proyecto.etiquetas.map((e) => e.nombre).join(", ")}`);
      }
      lineas.push(
        `Totales: ${wbs.metadata?.totalActividades ?? wbs.actividades.length} actividades, ${
          wbs.metadata?.totalTareas ?? 0
        } tareas, ${wbs.metadata?.totalSubtareas ?? 0} subtareas, ${
          wbs.metadata?.totalAsignaciones ?? 0
        } asignaciones`
      );
      lineas.push("");
      lineas.push("## Jerarquia WBS");

      if (wbs.actividades.length === 0) {
        lineas.push("_(sin actividades)_");
      }

      for (const [i, actividad] of wbs.actividades.entries()) {
        lineas.push("");
        lineas.push(
          `### ${i + 1}. ${actividad.nombre} (ID: \`${actividad.id}\`) - ${fmtDateRange(
            actividad.fechaInicio,
            actividad.fechaFin
          )} - ${Math.round(actividad.percentComplete ?? 0)}%`
        );
        if (actividad.descripcion) lineas.push(`_${actividad.descripcion}_`);
        if (actividad.etiquetas?.length) {
          lineas.push(`Etiquetas: ${actividad.etiquetas.map((e) => e.nombre).join(", ")}`);
        }
        if (!actividad.tareas?.length) lineas.push("- (sin tareas)");

        for (const tarea of actividad.tareas ?? []) {
          const check = tarea.completada ? "[x]" : "[ ]";
          const asignados = (tarea.asignados ?? []).map(fmtPersona).join(", ");
          const etiquetas = (tarea.etiquetas ?? []).map((e) => e.nombre).join(", ");
          lineas.push(
            `- ${check} **${tarea.nombre}** (ID: \`${tarea.id}\`) - ${fmtDateRange(
              tarea.fechaInicio,
              tarea.fechaFin
            )}${asignados ? ` - Asignados: ${asignados}` : ""}${
              etiquetas ? ` - Etiquetas: ${etiquetas}` : ""
            }`
          );
          for (const subtarea of tarea.subtareas ?? []) {
            lineas.push(`  - ${subtarea.completada ? "[x]" : "[ ]"} ${subtarea.nombre} (ID: \`${subtarea.id}\`)`);
          }
        }

        if (lineas.length > maxLineas) {
          lineas.push(`\n_Arbol truncado en ${maxLineas} lineas. Usa un ID para consultar o editar el resto._`);
          break;
        }
      }

      if (args.incluirMateriales !== false) {
        const materiales = await api.get<Material[]>("/api/materiales", { proyectoId: proyecto.id });
        lineas.push("");
        lineas.push(`## Materiales (${materiales.length})`);
        if (materiales.length === 0) lineas.push("_(sin materiales)_");
        for (const material of materiales) {
          lineas.push(
            `- ${material.nombre}: ${material.cantidad} ${material.unidad ?? "u"} - ${material.estado} (ID: \`${
              material.id
            }\`)${material.categoria ? ` - ${material.categoria}` : ""}${
              material.catalogo ? ` - catalogo: ${material.catalogo.nombre}` : ""
            }`
          );
        }
      }

      if (args.incluirAsignaciones !== false && wbs.asignaciones?.length) {
        lineas.push("");
        lineas.push(`## Asignaciones a nivel proyecto (${wbs.asignaciones.length})`);
        for (const asignacion of wbs.asignaciones) {
          lineas.push(
            `- ${asignacion.recursoNombre} - ${asignacion.tipoActividadNombre}${
              asignacion.nombre ? ` (${asignacion.nombre})` : ""
            } - ${fmtDate(asignacion.fechaInicio)} a ${fmtDate(asignacion.fechaFin)} - ${asignacion.estado} (ID: \`${
              asignacion.id
            }\`)`
          );
        }
      }

      return lineas.join("\n");
    }
  );

  register(
    server,
    "listar_recursos",
    "Lista o busca recursos (personas, vehiculos, equipos, herramientas) con su ID, tipo, departamento y equipo.",
    {
      q: z.string().optional().describe("Nombre, apellido, email o codigo"),
      tipo: z.enum(["PERSONA", "VEHICULO", "EQUIPO_TECNICO", "HERRAMIENTA", "OTRO"]).optional(),
      departamento: z.string().optional().describe("Nombre o ID del departamento"),
      activo: z.boolean().optional().describe("Default true"),
    },
    async (args) => {
      const api = client();
      const query: Record<string, string | boolean | undefined> = {
        q: args.q,
        tipo: args.tipo,
        activo: args.activo ?? true,
      };
      if (args.departamento) {
        const deptos = await api.get<Array<{ id: string; nombre: string }>>("/api/departamentos");
        const match = deptos.find(
          (d) =>
            d.id === args.departamento ||
            d.nombre.toLowerCase() === String(args.departamento).toLowerCase()
        );
        if (!match) throw new Error(`No encontre el departamento "${args.departamento}".`);
        query.departamentoId = match.id;
      }

      const recursos = await api.get<Recurso[]>("/api/recursos", query);
      if (recursos.length === 0) return "No hay recursos que coincidan con el filtro.";
      const visibles = recursos.slice(0, 100);
      const lineas = visibles.map((r) => {
        const partes = [
          `- **${fmtPersona(r)}**`,
          `ID: \`${r.id}\``,
          r.tipo ?? "PERSONA",
          r.departamento?.nombre,
          r.equipo?.nombre,
          r.cargo?.nombre,
          r.email,
        ].filter(Boolean);
        return partes.join(" - ");
      });
      return (
        `# Recursos (${recursos.length})\n` +
        lineas.join("\n") +
        (recursos.length > visibles.length ? `\n\n_... y ${recursos.length - visibles.length} mas._` : "")
      );
    }
  );

  register(
    server,
    "listar_clientes",
    "Lista o busca clientes con su ID, contacto y cantidad de proyectos.",
    {
      q: z.string().optional().describe("Nombre, codigo o contacto"),
      activo: z.boolean().optional(),
    },
    async (args) => {
      const api = client();
      const clientes = await api.get<
        Array<{
          id: string;
          nombre: string;
          contacto?: string | null;
          email?: string | null;
          telefono?: string | null;
          activo?: boolean;
          _count?: { proyectos?: number };
        }>
      >("/api/clientes", { q: args.q, activo: args.activo });
      if (clientes.length === 0) return "No hay clientes que coincidan.";
      return (
        `# Clientes (${clientes.length})\n` +
        clientes
          .slice(0, 100)
          .map(
            (c) =>
              `- **${c.nombre}** (ID: \`${c.id}\`) - ${c.contacto ?? "sin contacto"}${
                c.email ? ` - ${c.email}` : ""
              }${c.telefono ? ` - ${c.telefono}` : ""} - ${
                c._count?.proyectos ?? 0
              } proyectos${c.activo === false ? " - INACTIVO" : ""}`
          )
          .join("\n")
      );
    }
  );

  register(
    server,
    "listar_etiquetas",
    "Lista el catalogo global de etiquetas (nombre, color e ID).",
    { activo: z.boolean().optional().describe("true = solo activas") },
    async (args) => {
      const api = client();
      const etiquetas = await api.get<Array<{ id: string; nombre: string; color: string; activo?: boolean }>>(
        "/api/etiquetas",
        { activo: args.activo }
      );
      if (etiquetas.length === 0) return "No hay etiquetas en el catalogo.";
      return (
        `# Etiquetas (${etiquetas.length})\n` +
        etiquetas
          .map((e) => `- ${e.nombre} (ID: \`${e.id}\`) - color ${e.color}${e.activo === false ? " - inactiva" : ""}`)
          .join("\n")
      );
    }
  );

  register(
    server,
    "listar_catalogo_materiales",
    "Lista el catalogo global de materiales (nombre, categoria, unidad base y cantidad sugerida).",
    {
      q: z.string().optional().describe("Texto a buscar en el nombre"),
      activo: z.boolean().optional().describe("Default true"),
    },
    async (args) => {
      const api = client();
      const items = await api.get<
        Array<{
          id: string;
          nombre: string;
          categoria?: string | null;
          unidadBase?: string | null;
          cantidadSugerida?: number | null;
          activo?: boolean;
        }>
      >("/api/materiales-catalogo", { activo: args.activo ?? true });
      const filtrados = args.q
        ? items.filter((i) => i.nombre.toLowerCase().includes(String(args.q).toLowerCase()))
        : items;
      if (filtrados.length === 0) return "No hay materiales en el catalogo que coincidan.";
      return (
        `# Catalogo de materiales (${filtrados.length})\n` +
        filtrados
          .slice(0, 150)
          .map(
            (i) =>
              `- ${i.nombre} (ID: \`${i.id}\`)${i.categoria ? ` - ${i.categoria}` : ""}${
                i.unidadBase ? ` - unidad: ${i.unidadBase}` : ""
              }${i.cantidadSugerida ? ` - cantidad sugerida: ${i.cantidadSugerida}` : ""}`
          )
          .join("\n")
      );
    }
  );

  register(
    server,
    "listar_tipos_actividad",
    "Lista los tipos de actividad disponibles (obligatorios al crear una asignacion de planificacion).",
    {},
    async () => {
      const api = client();
      const tipos = await api.get<Array<{ id: string; nombre: string }>>("/api/tipos-actividad");
      if (tipos.length === 0) return "No hay tipos de actividad configurados.";
      return (
        `# Tipos de actividad (${tipos.length})\n` +
        tipos.map((t) => `- ${t.nombre} (ID: \`${t.id}\`)`).join("\n")
      );
    }
  );

  register(
    server,
    "consultar_carga",
    "Consulta la carga de trabajo por recurso en un rango de fechas: horas asignadas vs disponibles, porcentaje de ocupacion y alerta (SIN_ASIGNAR, NORMAL, ALERTA_80, SOBRECARGA).",
    {
      fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha inicio YYYY-MM-DD"),
      fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha fin YYYY-MM-DD"),
      recurso: z.string().optional().describe("Nombre, email o ID de un recurso"),
      departamento: z.string().optional().describe("Nombre o ID del departamento"),
      proyecto: z.string().optional().describe("Nombre o ID del proyecto para filtrar"),
      soloConCarga: z.boolean().optional().describe("Ocultar recursos con 0% de ocupacion"),
    },
    async (args) => {
      const api = client();
      const query: Record<string, string | undefined> = {
        fechaInicio: args.fechaInicio,
        fechaFin: args.fechaFin,
      };
      if (args.recurso) query.recursoId = (await resolveRecurso(args.recurso)).id;
      if (args.proyecto) query.proyectoId = (await resolveProyecto(args.proyecto)).id;
      if (args.departamento) {
        const deptos = await api.get<Array<{ id: string; nombre: string }>>("/api/departamentos");
        const match = deptos.find(
          (d) =>
            d.id === args.departamento ||
            d.nombre.toLowerCase() === String(args.departamento).toLowerCase()
        );
        if (!match) throw new Error(`No encontre el departamento "${args.departamento}".`);
        query.departamentoId = match.id;
      }

      const grid = await api.get<{
        recursos: Array<{
          id: string;
          nombre: string;
          apellido?: string;
          tipo: string;
          departamentoNombre: string;
          disponibilidad: {
            porcentajeOcupacion: number;
            horasAsignadas: number;
            horasDisponibles: number;
            alerta: string;
          };
        }>;
        asignaciones: Array<{
          recursoId: string;
          proyectoNombre: string;
          tipoActividadNombre: string;
          fechaInicio: string;
          fechaFin: string;
          estado: string;
        }>;
        metadata: { totalRecursos: number; totalAsignaciones: number };
      }>("/api/planning/grid", query);

      const recursos = args.soloConCarga
        ? grid.recursos.filter((r) => r.disponibilidad.porcentajeOcupacion > 0)
        : grid.recursos;
      if (recursos.length === 0) return "No hay recursos para el filtro en ese periodo.";

      const ordenados = [...recursos].sort(
        (a, b) => b.disponibilidad.porcentajeOcupacion - a.disponibilidad.porcentajeOcupacion
      );
      const porRecurso = new Map<string, number>();
      for (const a of grid.asignaciones) {
        porRecurso.set(a.recursoId, (porRecurso.get(a.recursoId) ?? 0) + 1);
      }

      return (
        `# Carga de trabajo ${args.fechaInicio} a ${args.fechaFin}\n` +
        `Recursos: ${grid.metadata.totalRecursos} | Asignaciones: ${grid.metadata.totalAsignaciones}\n\n` +
        ordenados
          .map((r) =>
            [
              `- **${r.nombre}${r.apellido ? " " + r.apellido : ""}**`,
              `${r.disponibilidad.porcentajeOcupacion}%`,
              `(${r.disponibilidad.horasAsignadas}h / ${r.disponibilidad.horasDisponibles}h)`,
              r.disponibilidad.alerta,
              r.departamentoNombre,
              `${porRecurso.get(r.id) ?? 0} asignaciones`,
            ].join(" - ")
          )
          .join("\n")
      );
    }
  );

  register(
    server,
    "listar_asignaciones",
    "Lista asignaciones de planificacion (recurso, proyecto, tipo, fechas y estado) con paginacion.",
    {
      proyecto: z.string().optional().describe("Nombre o ID del proyecto"),
      recurso: z.string().optional().describe("Nombre, email o ID del recurso"),
      fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      estado: z
        .enum(["BORRADOR", "CONFIRMADA", "EN_CURSO", "COMPLETADA", "CANCELADA", "CONFLICTO"])
        .optional(),
      pagina: z.number().int().min(1).optional().describe("Default 1"),
      limite: z.number().int().min(1).max(100).optional().describe("Default 50"),
    },
    async (args) => {
      const api = client();
      const query: Record<string, string | number | undefined> = {
        fechaDesde: args.fechaDesde,
        fechaHasta: args.fechaHasta,
        estado: args.estado,
        page: args.pagina ?? 1,
        limit: args.limite ?? 50,
      };
      if (args.proyecto) query.proyectoId = (await resolveProyecto(args.proyecto)).id;
      if (args.recurso) query.recursoId = (await resolveRecurso(args.recurso)).id;

      const response = await api.get<{
        data: Array<{
          id: string;
          proyecto: { id: string; nombre: string };
          recurso: { id: string; nombre: string; apellido?: string | null };
          tipoActividad: { nombre: string };
          nombre?: string | null;
          fechaInicio: string;
          fechaFin: string;
          estado: string;
          todoDia?: boolean;
          version: number;
        }>;
        pagination: { page: number; total: number; totalPages: number };
      }>("/api/asignaciones", query);

      if (response.data.length === 0) return "No hay asignaciones para el filtro.";
      return (
        `# Asignaciones (${response.data.length} de ${response.pagination.total}, pagina ${response.pagination.page}/${response.pagination.totalPages})\n` +
        response.data
          .map(
            (a) =>
              `- ${fmtPersona(a.recurso)} - ${a.proyecto.nombre} - ${a.tipoActividad.nombre}${
                a.nombre ? ` (${a.nombre})` : ""
              } - ${fmtDate(a.fechaInicio)} a ${fmtDate(a.fechaFin)} - ${a.estado} (ID: \`${a.id}\`, version ${
                a.version
              })`
          )
          .join("\n")
      );
    }
  );
}
