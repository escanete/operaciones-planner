// Shared Constants for Operaciones Planner

// ============================================
// UI CONFIG
// ============================================

export const TIME_SCALES = {
  day: { days: 1, label: 'Día' },
  week: { days: 7, label: 'Semanal' },
  fortnight: { days: 14, label: 'Quincenal' },
  month: { days: 30, label: 'Mensual' },
  quarter: { days: 90, label: 'Trimestral' },
  year: { days: 365, label: 'Anual' },
} as const;

export const VIEW_MODES = [
  { id: 'grid', label: 'Grilla' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'availability', label: 'Disponibilidad' },
  { id: 'cards', label: 'Tarjetas' },
  { id: 'gantt', label: 'Gantt (MS Project)' },
] as const;

// ============================================
// JERARQUÍA DE ROLES (decisión a)
// ============================================

export const ROLE_LEVELS: Record<number, string> = {
  0: 'Sin nivel',
  1: 'Operativo',
  2: 'Técnico',
  3: 'Profesional',
  4: 'Supervisor',
  5: 'Jefe de Área',
  6: 'Gerente',
};

export function getRoleLevelLabel(level: number): string {
  return ROLE_LEVELS[level] ?? `Nivel ${level}`;
}

// ============================================
// DEFAULTS
// ============================================

export const DEFAULT_TIPOS_ACTIVIDAD = [
  { nombre: 'Proyecto', color: '#00B050', billable: true, requiereProyecto: true, orden: 1 },
  { nombre: 'Informe', color: '#FFD966', billable: false, requiereProyecto: true, orden: 2 },
  { nombre: 'Capacitación', color: '#9BC2E6', billable: false, requiereProyecto: false, orden: 3 },
  { nombre: 'Mantenimiento', color: '#F4B183', billable: false, requiereProyecto: false, orden: 4 },
  { nombre: 'Guardia', color: '#C55A5A', billable: true, requiereProyecto: false, orden: 5 },
  { nombre: 'Vacaciones', color: '#D9D9D9', billable: false, requiereProyecto: false, orden: 6 },
] as const;

export const DEFAULT_COLORES_PROYECTO = [
  '#00B050', // Verde (como Excel)
  '#FFD966', // Amarillo (como Excel)
  '#4472C4', // Azul
  '#C00000', // Rojo
  '#7030A0', // Púrpura
  '#FF6600', // Naranja
  '#00B0F0', // Celeste
  '#92D050', // Verde claro
  '#993366', // Magenta
  '#808080', // Gris
] as const;

// ============================================
// VALIDACIÓN
// ============================================

export const JORNADA_DEFAULT = {
  inicio: '08:00',
  fin: '18:00',
  horas: 10,
} as const;

export const ALERTAS_CARGA = {
  NORMAL: { min: 0, max: 79, label: 'Disponible', color: '#00B050' },
  ALERTA_80: { min: 80, max: 99, label: 'Alta Carga', color: '#FFC000' },
  SOBRECARGA: { min: 100, max: 119, label: 'Sobrecargado', color: '#FF6600' },
  CRITICA_120: { min: 120, max: 999, label: 'Crítico', color: '#C00000' },
} as const;

// ============================================
// API
// ============================================

export const API_ROUTES = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    refresh: '/api/auth/refresh',
  },
  planning: {
    grid: '/api/planning/grid',
    disponibilidad: '/api/planning/disponibilidad',
  },
  asignaciones: {
    base: '/api/asignaciones',
    mover: '/api/asignaciones/:id/mover',
    extender: '/api/asignaciones/:id/extender',
    validarConflicto: '/api/asignaciones/validar-conflicto',
  },
  recursos: '/api/recursos',
  proyectos: '/api/proyectos',
  clientes: '/api/clientes',
  departamentos: '/api/departamentos',
  equipos: '/api/equipos',
  cargos: '/api/cargos',
  tiposActividad: '/api/tipos-actividad',
  usuarios: '/api/usuarios',
  auditoria: '/api/auditoria',
} as const;
