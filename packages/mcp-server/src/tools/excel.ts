import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { z } from "zod";
import * as XLSX from "xlsx";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "./_shared.js";

function normalizeCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 500 ? trimmed.slice(0, 500) + "..." : trimmed;
  }
  return value;
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const normalized = normalizeCell(value);
  return typeof normalized === "string" ? normalized : String(normalized);
}

export function registerExcel(server: McpServer): void {
  register(
    server,
    "leer_excel",
    "Lee un archivo Excel (.xlsx/.xls) o CSV local y devuelve sus hojas, columnas y filas como JSON para que puedas analizarlo o crear el proyecto con crear_proyecto_completo. El archivo lo aporta el usuario en su PC; no se sube a la plataforma.",
    {
      ruta: z.string().describe("Ruta absoluta o relativa del archivo Excel/CSV"),
      hoja: z.string().optional().describe("Nombre de la hoja (default: la primera)"),
      desde: z.number().int().min(0).optional().describe("Fila de datos inicial, 0-based (default 0)"),
      limite: z.number().int().min(1).max(200).optional().describe("Cantidad de filas a devolver (default 50, max 200)"),
    },
    async (args) => {
      const ruta = resolve(args.ruta);
      if (!existsSync(ruta)) {
        throw new Error(`No existe el archivo: ${ruta}`);
      }
      const extension = extname(ruta).toLowerCase();
      if (![".xlsx", ".xls", ".csv"].includes(extension)) {
        throw new Error(`Formato no soportado "${extension}". Usa .xlsx, .xls o .csv.`);
      }

      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.readFile(ruta, { cellDates: true });
      } catch (error) {
        throw new Error(
          `No se pudo leer el Excel: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const hojas = workbook.SheetNames;
      if (hojas.length === 0) throw new Error("El archivo no tiene hojas.");
      const hoja = args.hoja ?? hojas[0];
      const sheet = workbook.Sheets[hoja];
      if (!sheet) {
        throw new Error(`No existe la hoja "${hoja}". Hojas disponibles: ${hojas.join(", ")}`);
      }

      const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        blankrows: false,
        defval: "",
        raw: true,
      });
      if (matriz.length === 0) throw new Error(`La hoja "${hoja}" esta vacia.`);

      const encabezados = (matriz[0] ?? []).map((valor, indice) => {
        const texto = cellToText(valor);
        return texto || `Columna${indice + 1}`;
      });

      const filas = matriz.slice(1).map((fila) => {
        const objeto: Record<string, unknown> = {};
        encabezados.forEach((encabezado, indice) => {
          objeto[encabezado] = normalizeCell(fila[indice] ?? "");
        });
        return objeto;
      });

      const desde = args.desde ?? 0;
      const limite = args.limite ?? 50;
      const pagina = filas.slice(desde, desde + limite);

      return (
        `# Archivo: ${ruta}\n` +
        `Hojas: ${hojas.map((h) => (h === hoja ? `**${h}**` : h)).join(", ")}\n` +
        `Filas de datos: ${filas.length} (mostrando ${pagina.length} desde la fila ${desde})\n` +
        `Columnas (${encabezados.length}): ${encabezados.join(" | ")}\n\n` +
        "```json\n" +
        JSON.stringify(pagina, null, 2) +
        "\n```" +
        (desde + pagina.length < filas.length
          ? `\n\n_Quedan ${filas.length - desde - pagina.length} filas. Vuelve a llamar con \`desde: ${
              desde + pagina.length
            }\`._`
          : "")
      );
    }
  );
}
