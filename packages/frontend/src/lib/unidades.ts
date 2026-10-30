// ============================================
// UNIDADES DE MEDIDA DE MATERIALES
// Catálogo único reutilizado por el catálogo global (Admin) y por los
// materiales de cada proyecto. Define cómo se muestra la unidad y si
// admite cantidades fraccionarias (ej: 2,5 kg sí; 3 unidades no).
// ============================================

export interface UnidadMedida {
  /** Valor que se guarda en la base de datos (ej: "kg") */
  valor: string;
  /** Texto visible en los selectores (ej: "Kilogramos (kg)") */
  etiqueta: string;
  /** Símbolo corto que acompaña a la cantidad (ej: "kg") */
  simbolo: string;
  /** Si admite fracciones (2,5 kg) o solo enteros (3 cajas) */
  decimales: boolean;
}

export const UNIDADES_MEDIDA: UnidadMedida[] = [
  { valor: 'un', etiqueta: 'Unidad (un)', simbolo: 'un', decimales: false },
  { valor: 'mt', etiqueta: 'Metros (mt)', simbolo: 'mt', decimales: true },
  { valor: 'm2', etiqueta: 'Metros cuadrados (m²)', simbolo: 'm²', decimales: true },
  { valor: 'm3', etiqueta: 'Metros cúbicos (m³)', simbolo: 'm³', decimales: true },
  { valor: 'kg', etiqueta: 'Kilogramos (kg)', simbolo: 'kg', decimales: true },
  { valor: 'g', etiqueta: 'Gramos (g)', simbolo: 'g', decimales: true },
  { valor: 'lt', etiqueta: 'Litros (lt)', simbolo: 'lt', decimales: true },
  { valor: 'ml', etiqueta: 'Mililitros (ml)', simbolo: 'ml', decimales: true },
  { valor: 'galon', etiqueta: 'Galones (gal)', simbolo: 'gal', decimales: true },
  { valor: 'caja', etiqueta: 'Caja (caja)', simbolo: 'caja', decimales: false },
  { valor: 'rollo', etiqueta: 'Rollo (rollo)', simbolo: 'rollo', decimales: false },
  { valor: 'bolsa', etiqueta: 'Bolsa (bolsa)', simbolo: 'bolsa', decimales: false },
  { valor: 'par', etiqueta: 'Par (par)', simbolo: 'par', decimales: false },
  { valor: 'set', etiqueta: 'Set / juego (set)', simbolo: 'set', decimales: false },
  { valor: 'tramo', etiqueta: 'Tramo (tramo)', simbolo: 'tramo', decimales: false },
];

export function getUnidad(valor?: string | null): UnidadMedida | undefined {
  if (!valor) return undefined;
  const normalizado = valor.trim().toLowerCase();
  return UNIDADES_MEDIDA.find((u) => u.valor.toLowerCase() === normalizado);
}

/** Símbolo corto para mostrar junto a la cantidad. Unidades personalizadas se muestran tal cual. */
export function simboloUnidad(valor?: string | null): string {
  return getUnidad(valor)?.simbolo ?? (valor?.trim() || 'un');
}

/** Etiqueta larga para selectores y textos de ayuda. */
export function etiquetaUnidad(valor?: string | null): string {
  const unidad = getUnidad(valor);
  if (unidad) return unidad.etiqueta;
  return valor?.trim() ? `${valor.trim()} (personalizada)` : 'Sin unidad';
}

/** Las unidades personalizadas se asumen fraccionarias para no bloquear al usuario. */
export function admiteDecimales(valor?: string | null): boolean {
  return getUnidad(valor)?.decimales ?? true;
}
