// Shared Types for Operaciones Planner
// These types are used by both frontend and backend

// ============================================
// ENUMS
// ============================================

export type RecursoTipo = 'PERSONA' | 'VEHICULO' | 'EQUIPO_TECNICO' | 'HERRAMIENTA' | 'OTRO';

export type ProyectoEstado = 'PLANIFICACION' | 'ACTIVO' | 'EN_PAUSA' | 'FINALIZADO' | 'CANCELADO';

export type AsignacionEstado = 'BORRADOR' | 'CONFIRMADA' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA' | 'CONFLICTO';

export type Rol = 'SUPER_ADMIN' | 'ADMIN_DEPTO' | 'PLANIFICADOR' | 'COMERCIAL' | 'JEFE_AREA' | 'OPERADOR' | 'VISTA_SOLO';

export type AusenciaTipo = 'VACACIONES' | 'ENFERMEDAD' | 'PERMISO' | 'CAPACITACION' | 'COMISION_SERVICIO' | 'OTRO';

export type TimeScale = 'day' | 'week' | 'fortnight' | 'month' | 'quarter' | 'year';

export type ViewMode = 'grid' | 'timeline' | 'availability' | 'cards' | 'gantt';

// ============================================
// ENTIDADES PRINCIPALES
// ============================================

export interface Departamento {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  orden: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Equipo {
  id: string;
  nombre: string;
  departamentoId: string;
  departamento?: Departamento;
  descripcion?: string;
  liderId?: string;
  lider?: Recurso;
  orden: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Cargo {
  id: string;
  nombre: string;
  descripcion?: string;
  nivel: number;
  color?: string;
  activo: boolean;
}

export interface TipoActividad {
  id: string;
  nombre: string;
  color: string;
  icono?: string;
  billable: boolean;
  requiereProyecto: boolean;
  orden: number;
  activo: boolean;
  createdAt: Date;
}

export interface Cliente {
  id: string;
  nombre: string;
  codigo?: string;
  direccion?: string;
  contacto?: string;
  email?: string;
  telefono?: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Proyecto {
  id: string;
  nombre: string;
  codigo?: string;
  clienteId?: string;
  cliente?: Cliente;
  descripcion?: string;
  fechaInicio?: Date;
  fechaFin?: Date;
  estado: ProyectoEstado;
  color?: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Planificación tipo MS Project (decisión c)
  scheduledStart?: Date;
  scheduledEnd?: Date;
  percentComplete?: number;
  subprojectId?: string;
  dependencies?: string; // JSON string con IDs de predecesores
  relevante: boolean; // marcación manual de importancia (reemplaza ruta crítica automática)
}

// ============================================
// RECURSOS
// ============================================

export interface Recurso {
  id: string;
  codigo?: string;
  nombre: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  tipo: RecursoTipo;
  cargoId?: string;
  cargo?: Cargo;
  departamentoId: string;
  departamento?: Departamento;
  equipoId?: string;
  equipo?: Equipo;
  
  // Para vehículos/equipos
  patente?: string;
  marca?: string;
  modelo?: string;
  capacidad?: string;
  
  // Jerarquía y área (decisiones a y b)
  roleLevel: number;
  areaId?: string;
  
  fechaIngreso?: Date;
  fechaEgreso?: Date;
  activo: boolean;
  colorCalendario?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Disponibilidad {
  id: string;
  recursoId: string;
  diaSemana: number; // 1=Lun ... 7=Dom
  horaInicio: string;
  horaFin: string;
  activa: boolean;
}

export interface Ausencia {
  id: string;
  recursoId: string;
  tipo: AusenciaTipo;
  fechaInicio: Date;
  fechaFin: Date;
  todoDia: boolean;
  horaInicio?: string;
  horaFin?: string;
  descripcion?: string;
  aprobada: boolean;
  aprobadorId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PLANIFICACIÓN
// ============================================

export interface Asignacion {
  id: string;
  proyectoId: string;
  proyecto?: Proyecto;
  recursoId: string;
  recurso?: Recurso;
  tipoActividadId: string;
  tipoActividad?: TipoActividad;

  // Nombre de la actividad (texto libre: qué hace específicamente la persona)
  nombre?: string;
  // Vinculación WBS opcional (actividad, tarea o subtarea del proyecto)
  actividadId?: string;
  tareaId?: string;
  subtareaId?: string;

  fechaInicio: Date;
  fechaFin: Date;
  horaInicio?: string;
  horaFin?: string;
  todoDia: boolean;
  
  ubicacion?: string;
  region?: string;
  camionetaId?: string;
  camioneta?: Recurso;
  alojamiento: boolean;
  vueloId?: string;
  
  estado: AsignacionEstado;
  prioridad: number;
  notas?: string;
  creadoPorId: string;
  creadoAt: Date;
  actualizadoAt: Date;
  version: number;
}

// ============================================
// USUARIOS Y AUTH
// ============================================

export interface User {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  avatar?: string;
  rol: Rol;
  activo: boolean;
  ultimoAcceso?: Date;
  creadoAt: Date;
  actualizadoAt: Date;
  recursoId?: string;
  recurso?: Recurso;
  // Jerarquía y alcance (decisiones a y b)
  roleLevel: number;
  departmentId?: string;
  areaId?: string;
}

export interface UserPreferencias {
  id: string;
  userId: string;
  tema: string;
  vistaPorDefecto: string;
  zonaHoraria: string;
  notificaciones: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// AUDITORÍA
// ============================================

export interface Auditoria {
  id: string;
  userId: string;
  user?: User;
  accion: string;
  entidad: string;
  entidadId: string;
  antes?: Record<string, unknown>;
  despues?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================
// API DTOs
// ============================================

export interface AsignacionCreateInput {
  proyectoId: string;
  recursoId: string;
  tipoActividadId: string;
  fechaInicio: string; // ISO string
  fechaFin: string;
  horaInicio?: string;
  horaFin?: string;
  todoDia?: boolean;
  ubicacion?: string;
  region?: string;
  camionetaId?: string;
  alojamiento?: boolean;
  notas?: string;
  estado?: AsignacionEstado;
}

export interface AsignacionUpdateInput extends Partial<AsignacionCreateInput> {
  version: number;
}

export interface ConflictInfo {
  tipo: 'SOLAPE_TOTAL' | 'SOLAPE_PARCIAL' | 'EXCEDE_JORNADA' | 'VEHICULO_OCUPADO' | 'AUSENCIA_PROGRAMADA';
  severidad: 'ERROR' | 'WARNING' | 'INFO';
  mensaje: string;
  asignacionConflicto: {
    id: string;
    proyectoNombre: string;
    fechaInicio: Date;
    fechaFin: Date;
  };
  solucionSugerida?: string;
}

export interface ConflictCheckInput {
  recursoId: string;
  fechaInicio: string;
  fechaFin: string;
  excluirAsignacionId?: string;
}

export interface ConflictCheckResult {
  valido: boolean;
  conflictos: ConflictInfo[];
}

// ============================================
// VIEW / GRID TYPES
// ============================================

export interface RecursoGridItem {
  id: string;
  nombre: string;
  apellido?: string;
  tipo: RecursoTipo;
  cargoNombre?: string;
  equipoNombre?: string;
  departamentoNombre?: string;
  colorCalendario?: string;
  roleLevel: number;
  areaId?: string;
  disponibilidad: {
    porcentajeOcupacion: number;
    horasAsignadas: number;
    horasDisponibles: number;
    alerta: 'NORMAL' | 'ALERTA_80' | 'SOBRECARGA' | 'SIN_ASIGNAR';
  };
}

export interface AsignacionGridItem {
  id: string;
  recursoId: string;
  proyectoId: string;
  proyectoNombre: string;
  proyectoColor?: string;
  tipoActividadNombre: string;
  tipoActividadColor: string;
  nombre?: string; // nombre de la actividad (qué hace específicamente)
  // vínculo WBS opcional
  actividadId?: string;
  tareaId?: string;
  subtareaId?: string;
  fechaInicio: string; // ISO
  fechaFin: string;
  horaInicio?: string;
  horaFin?: string;
  todoDia: boolean;
  estado: AsignacionEstado;
  version: number;
}

export interface PlanningGridResponse {
  recursos: RecursoGridItem[];
  asignaciones: AsignacionGridItem[];
  metadata: {
    fechaInicio: string;
    fechaFin: string;
    totalRecursos: number;
    totalAsignaciones: number;
  };
}

// ============================================
// WBS: ACTIVIDADES → TAREAS → SUBTAREAS
// ============================================

export interface Subtarea {
  id: string;
  tareaId: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  completada: boolean; // checkbox 0/100
  relevante: boolean;
  asignaciones?: AsignacionResumen[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TareaAsignado {
  id: string;
  recursoId: string;
  nombre: string;
  apellido?: string;
}

// Asignación de planificación resumida (dentro del árbol WBS del proyecto)
export interface AsignacionResumen {
  id: string;
  nombre?: string; // qué hace específicamente (texto libre)
  recursoId: string;
  recursoNombre: string; // "Nombre Apellido" o código
  tipoActividadNombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: AsignacionEstado;
}

export interface Tarea {
  id: string;
  actividadId: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  completada: boolean; // checkbox directo si no tiene subtareas
  percentComplete: number; // roll-up de subtareas o 0/100
  relevante: boolean;
  subtareas?: Subtarea[];
  asignados?: TareaAsignado[];
  asignaciones?: AsignacionResumen[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Actividad {
  id: string;
  proyectoId: string;
  nombre: string;
  descripcion?: string;
  orden: number;
  fechaInicio?: Date;
  fechaFin?: Date;
  percentComplete: number; // promedio automático de tareas
  relevante: boolean;
  tareas?: Tarea[];
  asignaciones?: AsignacionResumen[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProyectoWBSResponse {
  proyecto: {
    id: string;
    nombre: string;
    estado: ProyectoEstado;
    percentComplete: number;
    relevante: boolean;
  };
  actividades: Actividad[];
  // Asignaciones de planificación sin vínculo WBS (cuelgan directo del proyecto)
  asignaciones: AsignacionResumen[];
  metadata: {
    totalActividades: number;
    totalTareas: number;
    totalSubtareas: number;
    totalAsignaciones: number;
  };
}

// ============================================
// IMPORTACIÓN MS PROJECT (XML)
// ============================================

export interface MsProjectImportPreview {
  preview: true;
  nombreProyecto: string;
  fechaInicio?: string;
  fechaFin?: string;
  totalActividades: number;
  totalTareas: number;
  totalSubtareas: number;
  recursosExistentes: number;
  recursosFaltantes: string[];
}

export interface MsProjectImportResult {
  proyectoId: string;
  nombre: string;
  actividades: number;
  tareas: number;
  subtareas: number;
  asignaciones: number;
  recursosCreados: string[];
}

// ============================================
// GANTT (vista tipo MS Project — decisión d)
// ============================================

export interface GanttTaskItem {
  id: string; // id del proyecto/actividad/tarea o `asig-{asignacionId}`
  tipo: 'PROYECTO' | 'ACTIVIDAD' | 'TAREA' | 'ASIGNACION';
  proyectoId: string;
  nombre: string;
  fechaInicio: string; // ISO date (yyyy-MM-dd)
  fechaFin: string; // ISO date (yyyy-MM-dd)
  percentComplete: number; // 0-100
  color?: string;
  parentId?: string; // proyecto padre (jerarquía)
  dependencies: string[]; // ids de tareas predecesoras
  recursos?: string; // nombres de recursos (asignación o roll-up del proyecto)
  notas?: string; // comentarios: descripción del proyecto o notas de la asignación
  estado?: ProyectoEstado | AsignacionEstado; // estado del proyecto o de la asignación
  esCritica: boolean; // ruta crítica calculada
}

export interface ProjectGanttResponse {
  tareas: GanttTaskItem[];
  metadata: {
    fechaInicio: string;
    fechaFin: string;
    totalProyectos: number;
    totalAsignaciones: number;
  };
}

// ============================================
// FILTROS
// ============================================

export interface PlanningFilters {
  departamentoId?: string;
  equipoId?: string;
  recursoId?: string;
  proyectoId?: string;
  clienteId?: string;
  tipoActividadId?: string;
  estado?: AsignacionEstado;
  region?: string;
  camionetaId?: string;
  areaId?: string;
  soloConflictos?: boolean;
  soloSinAsignar?: boolean;
}

// ============================================
// REPORTES
// ============================================

export interface CargaTrabajoResumen {
  recursoId: string;
  recursoNombre: string;
  equipoNombre?: string;
  departamentoNombre?: string;
  periodo: { desde: string; hasta: string };
  horasAsignadas: number;
  horasDisponibles: number;
  porcentajeOcupacion: number;
  alerta: string;
  detallePorProyecto: { proyectoId: string; proyectoNombre: string; horas: number }[];
  detallePorTipoActividad: { tipoActividadId: string; nombre: string; horas: number }[];
}

export interface OcupacionProyectoResumen {
  proyectoId: string;
  proyectoNombre: string;
  clienteNombre?: string;
  periodo: { desde: string; hasta: string };
  diasTotales: number;
  recursosAsignados: number;
  horasTotales: number;
  horasPorRecurso: { recursoId: string; nombre: string; horas: number }[];
}

export interface CargaEquipoResumen {
  equipoId: string;
  equipoNombre: string;
  departamentoNombre?: string;
  totalRecursos: number;
  horasAsignadas: number;
  horasDisponibles: number;
  porcentajeOcupacion: number;
  recursosSinAsignar: number;
}

export interface ProximosVencerAsignacion {
  id: string;
  tipo: 'ASIGNACION';
  nombre: string;
  proyectoNombre: string;
  proyectoColor?: string;
  recurso: string;
  fechaFin: string;
  diasRestantes: number;
  estado: AsignacionEstado;
}

export interface ProximosVencerProyecto {
  id: string;
  nombre: string;
  cliente?: string;
  estado: ProyectoEstado;
  fechaInicio?: string;
  fechaFin?: string;
  percentComplete: number;
  diasRestantes: number;
}

export interface ProximosVencerResponse {
  dias: number;
  asignaciones: ProximosVencerAsignacion[];
  proyectos: ProximosVencerProyecto[];
}
