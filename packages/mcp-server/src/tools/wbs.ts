import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  client,
  findActividad,
  findSubtarea,
  findTarea,
  fmtDateRange,
  fmtPersona,
  getWbs,
  register,
  resolveEtiquetas,
  resolveProyecto,
  resolveRecurso,
} from "./_shared.js";

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa formato YYYY-MM-DD");

async function etiquetasDe(nombres?: string[]): Promise<{ ids: string[]; avisos: string[] }> {
  if (!nombres?.length) return { ids: [], avisos: [] };
  const resultado = await resolveEtiquetas(nombres);
  return { ids: resultado.ids, avisos: resultado.avisos };
}

export function registerWbs(server: McpServer): void {
  register(
    server,
    "crear_actividad",
    "Crea una actividad (nivel 1 del WBS) dentro de un proyecto.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      nombre: z.string().min(1).max(200),
      descripcion: z.string().optional(),
      fechaInicio: FECHA.optional(),
      fechaFin: FECHA.optional(),
      etiquetas: z.array(z.string()).optional(),
      relevante: z.boolean().optional(),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const etiquetas = await etiquetasDe(args.etiquetas);
      const api = client();
      const creada = await api.post<{ id: string; nombre: string }>("/api/actividades", {
        proyectoId: proyecto.id,
        nombre: args.nombre,
        descripcion: args.descripcion,
        fechaInicio: args.fechaInicio,
        fechaFin: args.fechaFin,
        etiquetaIds: etiquetas.ids,
        relevante: args.relevante ?? false,
      });
      return (
        `Actividad creada: **${creada.nombre}** (ID: \`${creada.id}\`) en "${proyecto.nombre}".` +
        (etiquetas.avisos.length ? `\n\nAvisos:\n${etiquetas.avisos.map((a) => `- ${a}`).join("\n")}` : "")
      );
    }
  );

  register(
    server,
    "crear_tarea",
    "Crea una tarea (nivel 2 del WBS) dentro de una actividad, con recursos asignados y subtareas opcionales.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      actividad: z.string().describe("Nombre o ID de la actividad contenedora"),
      nombre: z.string().min(1).max(200),
      descripcion: z.string().optional(),
      fechaInicio: FECHA.optional(),
      fechaFin: FECHA.optional(),
      recursos: z.array(z.string()).optional().describe("Nombres, emails o IDs de recursos"),
      etiquetas: z.array(z.string()).optional(),
      subtareas: z
        .array(z.object({ nombre: z.string().min(1), descripcion: z.string().optional(), completada: z.boolean().optional() }))
        .optional(),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const wbs = await getWbs(proyecto.id);
      const actividad = findActividad(wbs, args.actividad);
      const etiquetas = await etiquetasDe(args.etiquetas);

      const avisos: string[] = [...etiquetas.avisos];
      const asignados: string[] = [];
      for (const referencia of args.recursos ?? []) {
        try {
          asignados.push((await resolveRecurso(referencia)).id);
        } catch (error) {
          avisos.push(`No se asigno "${referencia}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const api = client();
      const tarea = await api.post<{ id: string; nombre: string }>(
        `/api/actividades/${actividad.id}/tareas`,
        {
          nombre: args.nombre,
          descripcion: args.descripcion,
          fechaInicio: args.fechaInicio,
          fechaFin: args.fechaFin,
          asignados,
          etiquetaIds: etiquetas.ids,
        }
      );

      let subtareasCreadas = 0;
      for (const subtarea of args.subtareas ?? []) {
        try {
          await api.post(`/api/actividades/tarea/${tarea.id}/subtareas`, {
            nombre: subtarea.nombre,
            descripcion: subtarea.descripcion,
            completada: subtarea.completada ?? false,
          });
          subtareasCreadas++;
        } catch (error) {
          avisos.push(
            `Subtarea "${subtarea.nombre}": ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return (
        `Tarea creada: **${tarea.nombre}** (ID: \`${tarea.id}\`)\n` +
        `Actividad: ${actividad.nombre} | Proyecto: ${proyecto.nombre}\n` +
        `Fechas: ${fmtDateRange(args.fechaInicio, args.fechaFin)} | Recursos asignados: ${
          asignados.length
        } | Subtareas: ${subtareasCreadas}` +
        (avisos.length ? `\n\nAvisos:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "")
      );
    }
  );

  register(
    server,
    "crear_subtarea",
    "Crea una subtarea (nivel 3 del WBS) dentro de una tarea.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      tarea: z.string().describe("Nombre o ID de la tarea contenedora"),
      actividad: z.string().optional().describe("Actividad contenedora, si el nombre de tarea se repite"),
      nombre: z.string().min(1).max(200),
      descripcion: z.string().optional(),
      completada: z.boolean().optional(),
      etiquetas: z.array(z.string()).optional(),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const wbs = await getWbs(proyecto.id);
      const { tarea } = findTarea(wbs, args.tarea, args.actividad);
      const etiquetas = await etiquetasDe(args.etiquetas);
      const api = client();
      const creada = await api.post<{ id: string; nombre: string }>(
        `/api/actividades/tarea/${tarea.id}/subtareas`,
        {
          nombre: args.nombre,
          descripcion: args.descripcion,
          completada: args.completada ?? false,
          etiquetaIds: etiquetas.ids,
        }
      );
      return (
        `Subtarea creada: **${creada.nombre}** (ID: \`${creada.id}\`) en la tarea "${tarea.nombre}".` +
        (etiquetas.avisos.length ? `\n\nAvisos:\n${etiquetas.avisos.map((a) => `- ${a}`).join("\n")}` : "")
      );
    }
  );

  register(
    server,
    "actualizar_tarea",
    "Actualiza una tarea: nombre, descripcion, fechas, completada, recursos asignados (reemplaza la lista) o etiquetas (reemplaza la lista).",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      tarea: z.string().describe("Nombre o ID de la tarea"),
      actividad: z.string().optional().describe("Actividad contenedora, si el nombre de tarea se repite"),
      nombre: z.string().min(1).max(200).optional(),
      descripcion: z.string().optional(),
      fechaInicio: FECHA.optional(),
      fechaFin: FECHA.optional(),
      completada: z.boolean().optional(),
      recursos: z.array(z.string()).optional().describe("Reemplaza los recursos asignados a la tarea"),
      etiquetas: z.array(z.string()).optional().describe("Reemplaza las etiquetas de la tarea"),
      relevante: z.boolean().optional(),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const wbs = await getWbs(proyecto.id);
      const { tarea } = findTarea(wbs, args.tarea, args.actividad);

      const body: Record<string, unknown> = {};
      for (const campo of ["nombre", "descripcion", "fechaInicio", "fechaFin", "completada", "relevante"] as const) {
        if (args[campo] !== undefined) body[campo] = args[campo];
      }
      const avisos: string[] = [];
      if (args.recursos !== undefined) {
        const ids: string[] = [];
        for (const referencia of args.recursos) {
          try {
            ids.push((await resolveRecurso(referencia)).id);
          } catch (error) {
            avisos.push(`No se asigno "${referencia}": ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        body.asignados = ids;
      }
      if (args.etiquetas !== undefined) {
        const etiquetas = await etiquetasDe(args.etiquetas);
        body.etiquetaIds = etiquetas.ids;
        avisos.push(...etiquetas.avisos);
      }
      if (Object.keys(body).length === 0) return "No enviaste cambios.";

      const api = client();
      const actualizada = await api.put<{
        id: string;
        nombre: string;
        asignados?: Array<{
          nombre?: string;
          apellido?: string | null;
          recurso?: { nombre: string; apellido?: string | null };
        }>;
      }>(`/api/actividades/tarea/${tarea.id}`, body);
      const nombresAsignados = (actualizada.asignados ?? [])
        .map((asignado) =>
          asignado.recurso
            ? fmtPersona(asignado.recurso)
            : asignado.nombre
              ? fmtPersona({ nombre: asignado.nombre, apellido: asignado.apellido })
              : ""
        )
        .filter(Boolean);
      return (
        `Tarea actualizada: **${actualizada.nombre}** (ID: \`${actualizada.id}\`)` +
        (actualizada.asignados ? `\nRecursos: ${nombresAsignados.join(", ") || "(ninguno)"}` : "") +
        (avisos.length ? `\n\nAvisos:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "")
      );
    }
  );

  register(
    server,
    "actualizar_subtarea",
    "Actualiza una subtarea: nombre, descripcion, completada o etiquetas (reemplaza la lista).",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      subtarea: z.string().describe("Nombre o ID de la subtarea"),
      tarea: z.string().optional().describe("Tarea contenedora, si el nombre de subtarea se repite"),
      nombre: z.string().min(1).max(200).optional(),
      descripcion: z.string().optional(),
      completada: z.boolean().optional(),
      etiquetas: z.array(z.string()).optional(),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const wbs = await getWbs(proyecto.id);
      const { subtarea } = findSubtarea(wbs, args.subtarea, args.tarea);

      const body: Record<string, unknown> = {};
      for (const campo of ["nombre", "descripcion", "completada"] as const) {
        if (args[campo] !== undefined) body[campo] = args[campo];
      }
      let avisos: string[] = [];
      if (args.etiquetas !== undefined) {
        const etiquetas = await etiquetasDe(args.etiquetas);
        body.etiquetaIds = etiquetas.ids;
        avisos = etiquetas.avisos;
      }
      if (Object.keys(body).length === 0) return "No enviaste cambios.";

      const api = client();
      const actualizada = await api.put<{ id: string; nombre: string }>(
        `/api/actividades/subtarea/${subtarea.id}`,
        body
      );
      return (
        `Subtarea actualizada: **${actualizada.nombre}** (ID: \`${actualizada.id}\`)` +
        (avisos.length ? `\n\nAvisos:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "")
      );
    }
  );
}
