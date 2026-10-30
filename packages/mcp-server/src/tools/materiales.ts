import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  client,
  resolveCatalogoMaterial,
  resolveProyecto,
  resolveRecurso,
  register,
  type Material,
} from "./_shared.js";

const ESTADOS = ["PENDIENTE", "SOLICITADO", "ENTREGADO", "INSTALADO", "DEVUELTO"] as const;

async function buscarMaterial(proyectoId: string, referencia: string): Promise<Material> {
  const api = client();
  const materiales = await api.get<Material[]>("/api/materiales", { proyectoId });
  const normal = (s: string) => s.toLowerCase().trim();
  const ref = referencia.trim();
  const exactos = materiales.filter(
    (m) => m.id === ref || normal(m.nombre) === normal(ref)
  );
  if (exactos.length === 1) return exactos[0];
  if (exactos.length > 1) {
    throw new Error(
      `Hay varios materiales llamados "${ref}":\n` +
        exactos.map((m) => `- ${m.nombre} (ID: ${m.id})`).join("\n") +
        "\nUsa el ID exacto."
    );
  }
  const parciales = materiales.filter((m) => normal(m.nombre).includes(normal(ref)));
  if (parciales.length === 1) return parciales[0];
  throw new Error(
    `No encontre el material "${ref}" en el proyecto. Materiales:\n` +
      (materiales.map((m) => `- ${m.nombre} (ID: ${m.id})`).join("\n") || "(ninguno)")
  );
}

export function registerMateriales(server: McpServer): void {
  register(
    server,
    "agregar_material",
    "Agrega un material o activo a un proyecto. Si indicas `catalogo`, precarga unidad, categoria y cantidad sugerida del catalogo global.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      nombre: z.string().min(1).max(200),
      catalogo: z.string().optional().describe("Nombre del item del catalogo global"),
      cantidad: z.number().positive().optional().describe("Default: cantidad sugerida del catalogo o 1"),
      unidad: z.string().max(20).optional(),
      categoria: z.string().max(100).optional(),
      descripcion: z.string().optional(),
      estado: z.enum(ESTADOS).optional().describe("Default PENDIENTE"),
      recurso: z.string().optional().describe("Recurso-herramienta vinculado (nombre o ID)"),
      notas: z.string().optional(),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const avisos: string[] = [];
      const catalogo = args.catalogo ? await resolveCatalogoMaterial(args.catalogo) : null;
      if (args.catalogo && !catalogo) {
        avisos.push(`"${args.catalogo}" no esta en el catalogo; se agrego como material libre.`);
      }
      let recursoId: string | undefined;
      if (args.recurso) {
        try {
          recursoId = (await resolveRecurso(args.recurso)).id;
        } catch (error) {
          avisos.push(`No se vinculo el recurso: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const api = client();
      const material = await api.post<Material>("/api/materiales", {
        proyectoId: proyecto.id,
        nombre: args.nombre,
        catalogoId: catalogo?.id,
        cantidad: args.cantidad ?? catalogo?.cantidadSugerida ?? 1,
        unidad: args.unidad ?? catalogo?.unidadBase ?? undefined,
        categoria: args.categoria ?? catalogo?.categoria ?? undefined,
        descripcion: args.descripcion,
        estado: args.estado ?? "PENDIENTE",
        recursoId,
        notas: args.notas,
      });

      return (
        `Material agregado: **${material.nombre}** (ID: \`${material.id}\`)\n` +
        `- Proyecto: ${proyecto.nombre}\n` +
        `- Cantidad: ${material.cantidad} ${material.unidad ?? "u"}\n` +
        `- Estado: ${material.estado}` +
        (material.catalogo ? `\n- Catalogo: ${material.catalogo.nombre}` : "") +
        (avisos.length ? `\n\nAvisos:\n${avisos.map((a) => `- ${a}`).join("\n")}` : "")
      );
    }
  );

  register(
    server,
    "actualizar_material",
    "Actualiza un material de un proyecto: nombre, cantidad, unidad, categoria, estado, notas o recurso vinculado.",
    {
      proyecto: z.string().describe("Nombre o ID del proyecto"),
      material: z.string().describe("Nombre o ID del material"),
      nombre: z.string().min(1).max(200).optional(),
      cantidad: z.number().positive().optional(),
      unidad: z.string().max(20).optional(),
      categoria: z.string().max(100).optional(),
      descripcion: z.string().optional(),
      estado: z.enum(ESTADOS).optional(),
      notas: z.string().optional(),
      recurso: z.string().optional().describe("Nuevo recurso-herramienta vinculado"),
    },
    async (args) => {
      const proyecto = await resolveProyecto(args.proyecto);
      const material = await buscarMaterial(proyecto.id, args.material);

      const body: Record<string, unknown> = {};
      for (const campo of ["nombre", "cantidad", "unidad", "categoria", "descripcion", "estado", "notas"] as const) {
        if (args[campo] !== undefined) body[campo] = args[campo];
      }
      if (args.recurso !== undefined) {
        body.recursoId = args.recurso ? (await resolveRecurso(args.recurso)).id : null;
      }
      if (Object.keys(body).length === 0) return "No enviaste cambios.";

      const api = client();
      const actualizado = await api.put<Material>(`/api/materiales/${material.id}`, body);
      return (
        `Material actualizado: **${actualizado.nombre}** (ID: \`${actualizado.id}\`)\n` +
        `- Cantidad: ${actualizado.cantidad} ${actualizado.unidad ?? "u"}\n` +
        `- Estado: ${actualizado.estado}`
      );
    }
  );

  register(
    server,
    "crear_material_catalogo",
    "Crea un item en el catalogo global de materiales (requiere rol Super Admin o Admin de departamento).",
    {
      nombre: z.string().min(1).max(100),
      categoria: z.string().max(50).optional(),
      unidadBase: z.string().max(20).optional(),
      cantidadSugerida: z.number().positive().optional(),
      descripcion: z.string().max(500).optional(),
    },
    async (args) => {
      const api = client();
      const creado = await api.post<{ id: string; nombre: string }>("/api/materiales-catalogo", {
        nombre: args.nombre,
        categoria: args.categoria,
        unidadBase: args.unidadBase,
        cantidadSugerida: args.cantidadSugerida,
        descripcion: args.descripcion,
      });
      return `Material de catalogo creado: **${creado.nombre}** (ID: \`${creado.id}\`)`;
    }
  );
}
