// Shared Utilities for Operaciones Planner

import type { TimeScale } from './types';

// ============================================
// FECHAS
// ============================================

/**
 * Calcula el rango de fechas visible según la escala seleccionada.
 * Usa límites de calendario reales (lunes a domingo, mes completo, etc.)
 */
export function getDateRange(
  centerDate: Date,
  timeScale: TimeScale,
  direction: 'current' | 'prev' | 'next' = 'current'
): { start: Date; end: Date } {
  const center = new Date(centerDate);
  center.setHours(0, 0, 0, 0);

  let start: Date;
  let end: Date;

  // Primero calculamos el rango base según la escala
  switch (timeScale) {
    case 'day': {
      start = new Date(center);
      end = new Date(center);
      break;
    }
    case 'week': {
      // Lunes a domingo de la semana que contiene centerDate
      const dayOfWeek = center.getDay(); // 0=Dom, 1=Lun...
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(center);
      start.setDate(start.getDate() - daysToMonday);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    }
    case 'fortnight': {
      // 14 días: desde el lunes de la semana actual
      const dayOfWeek = center.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(center);
      start.setDate(start.getDate() - daysToMonday);
      end = new Date(start);
      end.setDate(end.getDate() + 13);
      break;
    }
    case 'month': {
      // Mes calendario completo
      start = new Date(center.getFullYear(), center.getMonth(), 1);
      end = new Date(center.getFullYear(), center.getMonth() + 1, 0);
      break;
    }
    case 'quarter': {
      // Trimestre calendario completo
      const quarterStartMonth = Math.floor(center.getMonth() / 3) * 3;
      start = new Date(center.getFullYear(), quarterStartMonth, 1);
      end = new Date(center.getFullYear(), quarterStartMonth + 3, 0);
      break;
    }
    case 'year': {
      // Año calendario completo
      start = new Date(center.getFullYear(), 0, 1);
      end = new Date(center.getFullYear(), 11, 31);
      break;
    }
  }

  // Aplicar navegación (prev/next) en bloques de la misma duración
  if (direction !== 'current') {
    const durationMs = end.getTime() - start.getTime() + 1; // +1 para incluir el día final
    const multiplier = direction === 'next' ? 1 : -1;
    start = new Date(start.getTime() + multiplier * durationMs);
    end = new Date(end.getTime() + multiplier * durationMs);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  const d = new Date(date).setHours(0, 0, 0, 0);
  const s = new Date(start).setHours(0, 0, 0, 0);
  const e = new Date(end).setHours(23, 59, 59, 999);
  return d >= s && d <= e;
}

export function doRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 <= end2 && end1 >= start2;
}

export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

// ============================================
// VALIDACIÓN
// ============================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidTime(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

// ============================================
// FORMATO
// ============================================

export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase();
}

// ============================================
// CÁLCULOS
// ============================================

export function calcularHoras(horaInicio: string, horaFin: string): number {
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return Math.round(minutos / 60 * 10) / 10;
}

export function calcularPorcentaje(cantidad: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((cantidad / total) * 100);
}

export function getAlertaFromPorcentaje(porcentaje: number): string {
  if (porcentaje >= 120) return 'CRITICA_120';
  if (porcentaje >= 100) return 'SOBRECARGA';
  if (porcentaje >= 80) return 'ALERTA_80';
  return 'NORMAL';
}

// ============================================
// COLORES
// ============================================

export function getContrastColor(hexColor: string): string {
  // Remover # si existe
  const hex = hexColor.replace('#', '');
  
  // Convertir a RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calcular luminancia relativa (ITU-R BT.709)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  
  // Retornar blanco o negro según luminancia
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export function lightenColor(hexColor: string, percent: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const amt = Math.round(2.55 * percent);
  const newR = Math.min(255, r + amt);
  const newG = Math.min(255, g + amt);
  const newB = Math.min(255, b + amt);
  
  return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}
