import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  client,
  describeError,
  ensureCliente,
  register,
  resolveCatalogoMaterial,
  resolveEtiquetas,
  resolveProyecto,
  resolveRecurso,
  type Etiqueta,
} from "./_shared.js";

const ESTADOS_PROYECTO = ["PLANIFICACION", "ACTIVO", "EN_PAUSA", "FINALIZADO", "CANCELADO"] as const;
const ESTADOS_MATERIAL = ["PENDIENTE", "SOLICITADO", "ENTREGADO", "INSTALADO", "DEVUELTO"] as const;
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa formato YYYY-MM-DD");

const subtareaSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional(),
  completada: z.boolean().optional(),
  etiquetas: z.array(z.string()).optional(),
});

const tareaSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional(),
  fechaInicio: FECHA.optional(),
  fechaFin: FECHA.optional(),
  recursos: z.array(z.string()).optional().describe("Nombres, emails o IDs de recursos asignados a la tarea"),
  etiquetas: z.array(z.string()).optional(),
  subtareas: z.array(subtareaSchema).optional(),
});

const actividadSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional(),
  fechaInicio: FECHA.optional(),
  fechaFin: FECHA.optional(),
  etiquetas: z.array(z.string()).optional(),
  tareas: z.array(tareaSchema).optional(),
});

const materialSchema = z.object({
  nombre: z.string().min(1).max(200),
  catalogo: z.string().optional().describe("Nombre del item del catalogo global (opcional)"),
  cantidad: z.number().positive().optional(),
  unidad: z.string().max(20).optional(),
  categoria: z.string().max(100).optional(),
  estado: z.enum(ESTADOS_MATERIAL).optional(),
  notas: z.string().optional(),
});

export function registerProyectos(server: McpServer): void {
  register(
    server,
    "crear_proyecto_completo",
    "Crea un proyecto y, opcionalmente, toda su jerarquia WBS (actividades, tareas, subtareas, recursos asignados), materiales y etiquetas en una sola operacion. Devuelve IDs y avisos de lo que no se pudo crear.",
    {
      nombre: z.string().min(1).max(200),
      cliente: z.string().optional().describe("Nombre del cliente; si no existe se intenta crear"),
      descripcion: z.string().optional(),
      fechaInicio: FECHA.optional(),
      fechaFin: FECHA.optional(),
      estado: z.enum(ESTADOS_PROYECTO).optional().describe("Default PLANIFICACION"),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      etiquetas: z.array(z.string()).optional(),
      actividades: z.array(actividadSchema).optional(),
      materiales: z.array(materialSchema).optional(),
    },
    async (args) => {
      const api = client();
      const avisos: string[] = [];
      const creados = { actividades: 0, tareas: 0, subtareas: 0, asignados: 0, materiales: 0 };

      let clienteId: string | undefined;
      if (args.cliente) {
        const resultado = await ensureCliente(args.cliente);
        clienteId = resultado.clienteId;
        if (resultado.aviso) avisos.push(resultado.aviso);
      }

      const etiquetasProyecto = args.etiquetas?.length
        ? await resolveEtiquetas(args.etiquetas)
        : { ids: [] as string[], etiquetas: [] as Etiqueta[], avisos: [] as string[] };
      avisos.push(...etiquetasProyecto.avisos);

      const proyecto = await api.post<{ id: string; nombre: string }>("/api/proyectos", {
        nombre: args.nombre,
        clienteId,
        descripcion: args.descripcion,
        fechaInicio: args.fechaInicio,
        fechaFin: args.fechaFin,
        estado: args.estado ?? "PLANIFICACION",
        color: args.color,
        etiquetaIds: etiquetasProyecto.ids,
      });

      for (const actividad of args.actividades ?? []) {
        try {
          const etiquetasActividad = actividad.etiquetas?.length
            ? await resolveEtiquetas(actividad.etiquetas)
            : { ids: [], avisos: [] as string[] };
          avisos.push(...etiquetasActividad.avisos);

          const actividadCreada = await api.post<{ id: string }>("/api/actividades", {
            proyectoId: proyecto.id,
            nombre: actividad.nombre,
            descripcion: actividad.descripcion,
            fechaInicio: actividad.fechaInicio,
            fechaFin: actividad.fechaFin,
            etiquetaIds: etiquetasActividad.ids,
          });
          creados.actividades++;

          for (const tarea of actividad.tareas ?? []) {
            try {
              const etiquetasTarea = tarea.etiquetas?.length
                ? await resolveEtiquetas(tarea.etiquetas)
                : { ids: [], avisos: [] as string[] };
              avisos.push(...etiquetasTarea.avisos);

              const asignados: string[] = [];
              for (const recursoRef of tarea.recursos ?? []) {
                try {
                  const recurso = await resolveRecurso(recursoRef);
                  asignados.push(recurso.id);
                } catch (error) {
                  avisos.push(
                    `Tarea "${tarea.nombre}": no se asigno "${recursoRef}" (${describeError(error)})`
                  );
                }
              }

              const tareaCreada = await api.post<{ id: string }>(
                `/api/actividades/${actividadCreada.id}/tareas`,
                {
                  nombre: tarea.nombre,
                  descripcion: tarea.descripcion,
                  fechaInicio: tarea.fechaInicio,
                  fechaFin: tarea.fechaFin,
                  asignados,
                  etiquetaIds: etiquetasTarea.ids,
                }
              );
              creados.tareas++;
              creados.asignados += asignados.length;

              for (const subtarea of tarea.subtareas ?? []) {
                try {
                  const etiquetasSubtarea = subtarea.etiquetas?.length
                    ? await resolveEtiquetas(subtarea.etiquetas)
                    : { ids: [], avisos: [] as string[] };
                  avisos.push(...etiquetasSubtarea.avisos);
                  await api.post(`/api/actividades/tarea/${tareaCreada.id}/subtareas`, {
                    nombre: subtarea.nombre,
                    descripcion: subtarea.descripcion,
                    completada: subtarea.completada ?? false,
                    etiquetaIds: etiquetasSubtarea.ids,
                  });
                  creados.subtareas++;
                } catch (error) {
                  avisos.push(
                    `Subtarea "${subtarea.nombre}" de "${tarea.nombre}": ${describeError(error)}`
                  );
                }
              }
            } catch (error) {
              avisos.push(`Tarea "${tarea.nombre}" en "${actividad.nombre}": ${describeError(error)}`);
            }
          }
        } catch (error) {
          avisos.push(`Actividad "${actividad.nombre}": ${describeError(error)}`);
        }
      }

      for (const material of args.materiales ?? []) {
        try {
          const catalogo = material.catalogo ? await resolveCatalogoMaterial(material.catalogo) : null;
          if (material.catalogo && !catalogo) {
            avisos.push(
              `Material "${material.nombre}": "${material.catalogo}" no esta en el catalogo; se agrego como material libre.`
            );
          }
          await api.post("/api/materiales", {
            proyectoId: proyecto.id,
            nombre: material.nombre,
            catalogoId: catalogo?.id,
            cantidad: material.cantidad ?? catalogo?.cantidadSugerida ?? 1,
            unidad: material.unidad ?? catalogo?.unidadBase ?? undefined,
            categoria: material.categoria ?? catalogo?.categoria ?? undefined,
            estado: material.estado ?? "PENDIENTE",
            notas: material.notas,
          });
          creados.materiales++;
        } catch (error) {
          avisos.push(`Material "${material.nombre}": ${describeError(error)}`);
        }
      }

      const lineas = [
        `Proyecto creado: **${proyecto.nombre}** (ID: \`${proyecto.id}\`)`,
        "",
        `- Actividades: ${creados.actividades}`,
        `- Tareas: ${creados.tareas}`,
        `- Subtareas: ${creados.subtareas}`,
        `- Recursos asignados a tareas: ${creados.asignados}`,
        `- Materiales: ${creados.materiales}`,
      ];
      if (avisos.length > 0) {
        lineas.push("", "## Avisos", ...avisos.map((a) => `- ${a}`));
      }
      return lineas.join("\n");
    }
  );

  register(
    server,
    "actualizar_proyecto",
    "Actualiza datos de un proyecto existente: nombre, descripcion, fechas, estado, color, cliente o etiquetas (las etiquetas reemplazan el conjunto completo).",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      nombre: z.string().min(1).max(200).optional(),
      descripcion: z.string().optional(),
      fechaInicio: FECHA.optional(),
      fechaFin: FECHA.optional(),
      estado: z.enum(ESTADOS_PROYECTO).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      cliente: z.string().optional().describe("Nombre del cliente; si no existe se intenta crear"),
      etiquetas: z.array(z.string()).optional().describe("Reemplaza todas las etiquetas del proyecto"),
    },
    async (args) => {
      const actual = await resolveProyecto(args.proyecto);
      const api = client();
      const body: Record<string, unknown> = {};

      for (const campo of ["nombre", "descripcion", "fechaInicio", "fechaFin", "estado", "color"] as const) {
        if (args[campo] !== undefined) body[campo] = args[campo];
      }
      if (args.cliente !== undefined) {
        const resultado = await ensureCliente(args.cliente);
        body.clienteId = resultado.clienteId ?? null;
      }
      if (args.etiquetas !== undefined) {
        const etiquetas = await resolveEtiquetas(args.etiquetas);
        body.etiquetaIds = etiquetas.ids;
      }
      if (Object.keys(body).length === 0) return "No enviaste cambios.";

      const actualizado = await api.put<{ id: string; nombre: string }>(
        `/api/proyectos/${actual.id}`,
        body
      );
      return `Proyecto actualizado: **${actualizado.nombre}** (ID: \`${actualizado.id}\`)`;
    }
  );

  register(
    server,
    "crear_cliente",
    "Crea un cliente nuevo (requiere rol Super Admin o Admin de departamento).",
    {
      nombre: z.string().min(1).max(200),
      contacto: z.string().optional(),
      email: z.string().email().optional(),
      telefono: z.string().optional(),
      direccion: z.string().optional(),
      codigo: z.string().optional(),
    },
    async (args) => {
      const api = client();
      const creado = await api.post<{ id: string; nombre: string }>("/api/clientes", {
        nombre: args.nombre,
        contacto: args.contacto,
        email: args.email,
        telefono: args.telefono,
        direccion: args.direccion,
        codigo: args.codigo,
      });
      return `Cliente creado: **${creado.nombre}** (ID: \`${creado.id}\`)`;
    }
  );

  register(
    server,
    "crear_etiqueta",
    "Crea una etiqueta en el catalogo global (requiere rol Super Admin o Admin de departamento).",
    {
      nombre: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Color hex, default #64748B"),
      descripcion: z.string().max(200).optional(),
    },
    async (args) => {
      const api = client();
      const creada = await api.post<Etiqueta>("/api/etiquetas", {
        nombre: args.nombre,
        color: args.color ?? "#64748B",
        descripcion: args.descripcion,
      });
      return `Etiqueta creada: **${creada.nombre}** (ID: \`${creada.id}\`, color ${creada.color})`;
    }
  );

  register(
    server,
    "crear_tipo_actividad",
    "Crea un tipo de actividad para planificacion (requiere rol Super Admin o Admin de departamento). Normalmente los tipos ya estan configurados.",
    {
      nombre: z.string().min(1).max(100),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      billable: z.boolean().optional(),
      requiereProyecto: z.boolean().optional(),
    },
    async (args) => {
      const api = client();
      const creado = await api.post<{ id: string; nombre: string }>("/api/tipos-actividad", {
        nombre: args.nombre,
        color: args.color ?? "#00B050",
        billable: args.billable,
        requiereProyecto: args.requiereProyecto,
      });
      return `Tipo de actividad creado: **${creado.nombre}** (ID: \`${creado.id}\`)`;
    }
  );
}
