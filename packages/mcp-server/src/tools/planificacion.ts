import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  client,
  findActividad,
  findSubtarea,
  findTarea,
  fmtDate,
  fmtPersona,
  getWbs,
  register,
  resolveProyecto,
  resolveRecurso,
  resolveTipoActividad,
} from "./_shared.js";

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa formato YYYY-MM-DD");
const ESTADOS = ["BORRADOR", "CONFIRMADA", "EN_CURSO", "COMPLETADA", "CANCELADA", "CONFLICTO"] as const;

export function registerPlanificacion(server: McpServer): void {
  register(
    server,
    "asignar_recurso",
    "Crea una asignacion de planificacion: vincula un recurso a un proyecto (y opcionalmente a una actividad, tarea o subtarea) en un rango de fechas. Si la API detecta un conflicto bloqueante devuelve 409 con el detalle; repite con forzar=true para imponerla.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      recurso: z.string().describe("Nombre, email o ID del recurso"),
      tipoActividad: z.string().describe("Nombre o ID del tipo de actividad (ver listar_tipos_actividad)"),
      fechaInicio: FECHA,
      fechaFin: FECHA,
      nombre: z.string().max(200).optional().describe("Que hara concretamente el recurso"),
      actividad: z.string().optional().describe("Actividad del WBS a la que se vincula"),
      tarea: z.string().optional().describe("Tarea del WBS a la que se vincula"),
      subtarea: z.string().optional().describe("Subtarea del WBS a la que se vincula"),
      todoDia: z.boolean().optional().describe("Default true"),
      horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().describe("HH:MM (si no es todo el dia)"),
      horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().describe("HH:MM (si no es todo el dia)"),
      estado: z.enum(ESTADOS).optional().describe("Default CONFIRMADA"),
      prioridad: z.number().int().min(0).optional(),
      notas: z.string().optional(),
      forzar: z.boolean().optional().describe("Imponer la asignacion aunque haya conflicto"),
    },
    async (args) => {
      if (args.fechaFin < args.fechaInicio) {
        throw new Error("La fecha fin no puede ser anterior a la fecha inicio.");
      }
      const proyecto = await resolveProyecto(args.proyecto);
      const recurso = await resolveRecurso(args.recurso);
      const tipo = await resolveTipoActividad(args.tipoActividad);

      let actividadId: string | undefined;
      let tareaId: string | undefined;
      let subtareaId: string | undefined;
      let detalleVinculo = "nivel proyecto";

      if (args.actividad || args.tarea || args.subtarea) {
        const wbs = await getWbs(proyecto.id);
        if (args.subtarea) {
          const encontrada = findSubtarea(wbs, args.subtarea, args.tarea);
          subtareaId = encontrada.subtarea.id;
          detalleVinculo = `${encontrada.actividad.nombre} > ${encontrada.tarea.nombre} > ${encontrada.subtarea.nombre}`;
        } else if (args.tarea) {
          const encontrada = findTarea(wbs, args.tarea, args.actividad);
          tareaId = encontrada.tarea.id;
          detalleVinculo = `${encontrada.actividad.nombre} > ${encontrada.tarea.nombre}`;
        } else if (args.actividad) {
          actividadId = findActividad(wbs, args.actividad).id;
          detalleVinculo = args.actividad;
        }
      }

      const api = client();
      const asignacion = await api.post<{
        id: string;
        fechaInicio: string;
        fechaFin: string;
        estado: string;
      }>("/api/asignaciones", {
        proyectoId: proyecto.id,
        recursoId: recurso.id,
        tipoActividadId: tipo.id,
        nombre: args.nombre,
        actividadId,
        tareaId,
        subtareaId,
        fechaInicio: args.fechaInicio,
        fechaFin: args.fechaFin,
        horaInicio: args.horaInicio,
        horaFin: args.horaFin,
        todoDia: args.todoDia ?? true,
        estado: args.estado ?? "CONFIRMADA",
        prioridad: args.prioridad ?? 0,
        notas: args.notas,
        forzar: args.forzar ?? false,
      });

      return (
        `Asignacion creada (ID: \`${asignacion.id}\`)\n` +
        `- Recurso: ${fmtPersona(recurso)}\n` +
        `- Proyecto: ${proyecto.nombre}\n` +
        `- Tipo: ${tipo.nombre}\n` +
        `- Vinculo WBS: ${detalleVinculo}\n` +
        `- Fechas: ${fmtDate(asignacion.fechaInicio)} a ${fmtDate(asignacion.fechaFin)}\n` +
        `- Estado: ${asignacion.estado}`
      );
    }
  );

  register(
    server,
    "mover_asignacion",
    "Cambia las fechas o el recurso de una asignacion existente (mueve el bloque en el planning). Usa forzar=true si hay conflicto en la nueva posicion.",
    {
      asignacionId: z.string().describe("ID de la asignacion"),
      fechaInicio: FECHA.optional(),
      fechaFin: FECHA.optional(),
      recurso: z.string().optional().describe("Nuevo recurso (nombre, email o ID)"),
      forzar: z.boolean().optional(),
    },
    async (args) => {
      const api = client();
      const actual = await api.get<{
        id: string;
        version: number;
        fechaInicio: string;
        fechaFin: string;
      }>(`/api/asignaciones/${args.asignacionId}`);

      const body: Record<string, unknown> = { version: actual.version };
      if (args.fechaInicio) body.fechaInicio = args.fechaInicio;
      if (args.fechaFin) body.fechaFin = args.fechaFin;
      if (args.recurso) body.recursoId = (await resolveRecurso(args.recurso)).id;

      const movida = await api.patch<{ id: string; fechaInicio: string; fechaFin: string; estado: string }>(
        `/api/asignaciones/${args.asignacionId}/mover`,
        body,
        { forzar: args.forzar ? "true" : undefined }
      );
      return (
        `Asignacion movida (ID: \`${movida.id}\`)\n` +
        `- Nuevas fechas: ${fmtDate(movida.fechaInicio)} a ${fmtDate(movida.fechaFin)}\n` +
        `- Estado: ${movida.estado}`
      );
    }
  );

  register(
    server,
    "cancelar_asignacion",
    "Cancela una asignacion de planificacion (soft delete: pasa a estado CANCELADA).",
    { asignacionId: z.string().describe("ID de la asignacion") },
    async (args) => {
      const api = client();
      await api.delete(`/api/asignaciones/${args.asignacionId}`);
      return `Asignacion \`${args.asignacionId}\` cancelada.`;
    }
  );

  register(
    server,
    "validar_conflicto_asignacion",
    "Comprueba si un recurso tiene conflictos (solapes, ausencias, vehiculo ocupado) en un rango de fechas antes de asignarlo.",
    {
      recurso: z.string().describe("Nombre, email o ID del recurso"),
      fechaInicio: FECHA,
      fechaFin: FECHA,
      excluirAsignacionId: z.string().optional(),
    },
    async (args) => {
      const recurso = await resolveRecurso(args.recurso);
      const api = client();
      const resultado = await api.post<{
        valido: boolean;
        conflictos: Array<{ tipo: string; severidad: string; mensaje: string; solucionSugerida?: string }>;
      }>("/api/asignaciones/validar-conflicto", {
        recursoId: recurso.id,
        fechaInicio: args.fechaInicio,
        fechaFin: args.fechaFin,
        excluirAsignacionId: args.excluirAsignacionId,
      });

      if (resultado.conflictos.length === 0) {
        return `Sin conflictos para ${fmtPersona(recurso)} entre ${args.fechaInicio} y ${args.fechaFin}.`;
      }
      const bloqueantes = resultado.conflictos.filter((c) => c.severidad === "ERROR").length;
      return (
        `${bloqueantes > 0 ? "Conflictos bloqueantes" : "Advertencias (no bloquean)"} para ${fmtPersona(
          recurso
        )} entre ${args.fechaInicio} y ${args.fechaFin}:\n` +
        resultado.conflictos
          .map(
            (c) =>
              `- [${c.severidad}] ${c.mensaje}${c.solucionSugerida ? `\n  Solucion sugerida: ${c.solucionSugerida}` : ""}`
          )
          .join("\n")
      );
    }
  );
}
