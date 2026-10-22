import { useMemo, useState } from 'react';
import { format, addDays, isSameDay, isWeekend, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getContrastColor } from '@operaciones-planner/shared';
import { Badge } from '@/components/ui/badge';
import { usePlanningStore } from '@/stores/planningStore';
import type { AsignacionGridItem, RecursoGridItem, GanttTaskItem } from '@operaciones-planner/shared';

// Configuración de tamaño de celda según escala temporal
const CELL_WIDTHS: Record<string, number> = {
  day: 200,
  week: 64,
  fortnight: 48,
  month: 34,
  quarter: 22,
  year: 14,
};

const LANE_HEIGHT = 22;
const LANE_GAP = 2;
const ROW_MIN_HEIGHT = 40;

interface GridProps {
  recursos: RecursoGridItem[];
  asignaciones: AsignacionGridItem[];
  fechaInicio: Date;
  fechaFin: Date;
  onSelectAssignment?: (id: string) => void;
  onQuickCreate?: (recursoId: string, date: Date) => void;
  onMoveAssignment?: (payload: {
    id: string;
    recursoId: string;
    fechaInicio: string;
    fechaFin: string;
    version: number;
  }) => void;
}

interface AssignmentLayout {
  asignacion: AsignacionGridItem;
  lane: number;              // carril vertical
  startOffset: number;       // días desde fechaInicio del grid
  spanDias: number;          // días visibles
  clippedLeft: boolean;      // viene de antes del rango
  clippedRight: boolean;     // sigue después del rango
  tieneConflicto: boolean;   // se topa con otra asignación
}

export function VirtualizedTimeGrid({
  recursos,
  asignaciones,
  fechaInicio,
  fechaFin,
  onSelectAssignment,
  onQuickCreate,
  onMoveAssignment,
}: GridProps) {
  const { timeScale, draggingAssignmentId, setDraggingAssignment } = usePlanningStore();
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const cellWidth = CELL_WIDTHS[timeScale] ?? 48;
  const leftColWidth = 220;

  /** Suelta una asignación en la celda (día, recurso): recalcula fechas conservando duración */
  const handleDrop = (e: React.DragEvent, recursoId: string, dia: Date) => {
    e.preventDefault();
    setHoverCell(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id || !onMoveAssignment) {
      setDraggingAssignment(null);
      return;
    }
    const asig = asignaciones.find((a) => a.id === id);
    setDraggingAssignment(null);
    if (!asig) return;

    const grabOffset = Math.round(Number(e.dataTransfer.getData('application/x-grab-days') || 0)) || 0;
    const nuevaInicio = addDays(dia, -grabOffset);
    const duracion =
      differenceInCalendarDays(parseISO(asig.fechaFin), parseISO(asig.fechaInicio)) + 1;
    const nuevaFin = addDays(nuevaInicio, duracion - 1);

    const inicioStr = format(nuevaInicio, 'yyyy-MM-dd');
    const finStr = format(nuevaFin, 'yyyy-MM-dd');

    // Sin cambios: no llamar al backend
    if (asig.recursoId === recursoId && asig.fechaInicio === inicioStr) return;

    onMoveAssignment({
      id: asig.id,
      recursoId,
      fechaInicio: inicioStr,
      fechaFin: finStr,
      version: asig.version,
    });
  };

  /** Inicio de arrastre: guarda id, offset de días del agarre y marca visual */
  const handleAssignmentDragStart = (e: React.DragEvent, layout: AssignmentLayout) => {
    e.dataTransfer.setData('text/plain', layout.asignacion.id);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabDays = Math.floor((e.clientX - rect.left) / cellWidth);
    e.dataTransfer.setData('application/x-grab-days', String(Math.max(0, grabDays)));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingAssignment(layout.asignacion.id);
  };

  // Generar los días visibles
  const dias = useMemo(() => {
    const days: Date[] = [];
    let current = new Date(fechaInicio);
    while (current <= fechaFin) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  }, [fechaInicio, fechaFin]);

  const totalDias = dias.length;
  const gridWidth = totalDias * cellWidth;

  // Agrupar recursos por departamento y equipo con headers
  const filas = useMemo(() => {
    const grouped: Array<{
      type: 'departamento' | 'equipo' | 'recurso';
      id: string;
      nombre: string;
      recurso?: RecursoGridItem;
    }> = [];

    let currentDept = '';
    let currentEquipo = '';

    recursos.forEach((r) => {
      const dept = r.departamentoNombre ?? 'Sin Departamento';
      const equipo = r.equipoNombre ?? 'Sin Equipo';

      if (dept !== currentDept) {
        grouped.push({ type: 'departamento', id: `dept-${dept}`, nombre: dept });
        currentDept = dept;
        currentEquipo = '';
      }

      if (equipo !== currentEquipo) {
        grouped.push({ type: 'equipo', id: `equipo-${equipo}`, nombre: equipo });
        currentEquipo = equipo;
      }

      grouped.push({ type: 'recurso', id: r.id, nombre: `${r.nombre} ${r.apellido ?? ''}`, recurso: r });
    });

    return grouped;
  }, [recursos]);

  // Calcular layout de cada asignación por recurso (lanes + conflictos + clipping)
  const layoutPorRecurso = useMemo(() => {
    const map = new Map<string, { layouts: AssignmentLayout[]; lanes: number; tieneConflicto: boolean }>();

    // Agrupar asignaciones por recurso
    const porRecurso = new Map<string, AsignacionGridItem[]>();
    asignaciones.forEach((a) => {
      if (!porRecurso.has(a.recursoId)) porRecurso.set(a.recursoId, []);
      porRecurso.get(a.recursoId)!.push(a);
    });

    porRecurso.forEach((asigs, recursoId) => {
      // Clonar y ordenar por fecha de inicio, luego por duración (más largas primero)
      const sorted = [...asigs].sort((a, b) => {
        const diffA = differenceInCalendarDays(parseISO(a.fechaInicio), fechaInicio);
        const diffB = differenceInCalendarDays(parseISO(b.fechaInicio), fechaInicio);
        if (diffA !== diffB) return diffA - diffB;
        const durA = differenceInCalendarDays(parseISO(a.fechaFin), parseISO(a.fechaInicio));
        const durB = differenceInCalendarDays(parseISO(b.fechaFin), parseISO(b.fechaInicio));
        return durB - durA;
      });

      const layouts: AssignmentLayout[] = [];
      const laneEnds: Date[] = []; // fecha fin de cada carril
      let tieneConflicto = false;

      sorted.forEach((a) => {
        const aInicio = parseISO(a.fechaInicio);
        const aFin = parseISO(a.fechaFin);

        // Clip al rango visible
        const visInicio = aInicio < fechaInicio ? fechaInicio : aInicio;
        const visFin = aFin > fechaFin ? fechaFin : aFin;
        if (visInicio > visFin) return; // fuera del rango

        const startOffset = differenceInCalendarDays(visInicio, fechaInicio);
        const spanDias = differenceInCalendarDays(visFin, visInicio) + 1;

        // Asignar carril: buscar el primer carril libre
        let lane = -1;
        for (let i = 0; i < laneEnds.length; i++) {
          if (laneEnds[i] < aInicio) {
            lane = i;
            laneEnds[i] = aFin;
            break;
          }
        }
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(aFin);
        }

        // Detectar conflicto: se topa con otra asignación en el mismo recurso
        const conflicto = sorted.some((other) => {
          if (other.id === a.id) return false;
          const oInicio = parseISO(other.fechaInicio);
          const oFin = parseISO(other.fechaFin);
          return aInicio <= oFin && aFin >= oInicio;
        });
        if (conflicto) tieneConflicto = true;

        layouts.push({
          asignacion: a,
          lane,
          startOffset,
          spanDias,
          clippedLeft: aInicio < fechaInicio,
          clippedRight: aFin > fechaFin,
          tieneConflicto: conflicto,
        });
      });

      map.set(recursoId, {
        layouts,
        lanes: Math.max(1, laneEnds.length),
        tieneConflicto,
      });
    });

    return map;
  }, [asignaciones, fechaInicio, fechaFin]);


  const rowHeight = (recursoId: string) => {
    const info = layoutPorRecurso.get(recursoId);
    if (!info) return ROW_MIN_HEIGHT;
    return Math.max(ROW_MIN_HEIGHT, info.lanes * (LANE_HEIGHT + LANE_GAP) + 4);
  };

  const headerHeight = 46;

  return (
    // Contenedor único con scroll horizontal y vertical
    <div className="relative h-full w-full overflow-auto grid-scrollbar bg-card">
      <div style={{ width: leftColWidth + gridWidth, minWidth: '100%' }}>
        {/* ===== Header de fechas (sticky top) ===== */}
        <div
          className="sticky top-0 z-30 flex border-b bg-card"
          style={{ height: headerHeight }}
        >
          {/* Esquina fija (sticky en ambos ejes) */}
          <div
            className="sticky left-0 z-40 flex flex-shrink-0 items-center border-r bg-card px-3"
            style={{ width: leftColWidth, height: headerHeight }}
          >
            <span className="text-sm font-semibold">Recurso</span>
          </div>

          {/* Días */}
          <div className="flex flex-shrink-0" style={{ width: gridWidth }}>
            {dias.map((dia) => (
              <div
                key={dia.toISOString()}
                className={cn(
                  'flex flex-shrink-0 flex-col items-center justify-center border-r px-0.5 text-center',
                  isWeekend(dia) && 'bg-muted/50',
                  isSameDay(dia, new Date()) && 'bg-primary/10'
                )}
                style={{ width: cellWidth, height: headerHeight }}
              >
                {cellWidth >= 30 && (
                  <div className="text-[10px] uppercase leading-tight text-muted-foreground">
                    {format(dia, 'EEE', { locale: es })}
                  </div>
                )}
                <div className={cn('text-sm font-medium leading-tight', isSameDay(dia, new Date()) && 'text-primary font-bold')}>
                  {format(dia, 'd')}
                </div>
                {cellWidth >= 40 && (
                  <div className="text-[9px] leading-tight text-muted-foreground">
                    {format(dia, 'MMM', { locale: es })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== Filas de recursos ===== */}
        {filas.map((fila) => {
          // Header de departamento (ancho completo, sticky left)
          if (fila.type === 'departamento') {
            return (
              <div
                key={fila.id}
                className="sticky left-0 z-20 flex items-center border-b bg-muted px-3 text-sm font-semibold"
                style={{ height: 28, width: 'max-content', minWidth: '100%' }}
              >
                {fila.nombre}
              </div>
            );
          }

          // Header de equipo
          if (fila.type === 'equipo') {
            return (
              <div
                key={fila.id}
                className="sticky left-0 z-20 flex items-center border-b bg-muted/60 px-3 pl-8 text-xs font-medium text-muted-foreground"
                style={{ height: 24, width: 'max-content', minWidth: '100%' }}
              >
                {fila.nombre}
              </div>
            );
          }

          // Fila de recurso
          const recurso = fila.recurso!;
          const info = layoutPorRecurso.get(recurso.id);
          const height = rowHeight(recurso.id);

          return (
            <div key={fila.id} className="flex border-b" style={{ height }}>
              {/* Columna fija - info recurso (sticky left, sobre las asignaciones) */}
              <div
                className="sticky left-0 z-20 flex flex-shrink-0 items-center gap-2 border-r bg-card px-3 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]"
                style={{ width: leftColWidth, height }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: recurso.colorCalendario ?? '#94a3b8' }}
                    />
                    <span className="truncate text-sm font-medium leading-tight">
                      {recurso.nombre} {recurso.apellido}
                    </span>
                    {info?.tieneConflicto && (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                  </div>
                  <div className="truncate text-xs leading-tight text-muted-foreground">
                    {recurso.cargoNombre ?? recurso.equipoNombre ?? ''}
                  </div>
                </div>
                <Badge
                  variant={
                    recurso.disponibilidad.alerta === 'NORMAL'
                      ? 'default'
                      : recurso.disponibilidad.alerta === 'ALERTA_80'
                      ? 'secondary'
                      : recurso.disponibilidad.alerta === 'SIN_ASIGNAR'
                      ? 'outline'
                      : 'destructive'
                  }
                  className="shrink-0 px-1.5 py-0 text-[10px]"
                >
                  {recurso.disponibilidad.alerta === 'SIN_ASIGNAR'
                    ? 'Libre'
                    : `${recurso.disponibilidad.porcentajeOcupacion}%`}
                </Badge>
              </div>

              {/* Franja de días con asignaciones */}
              <div className="relative flex-1" style={{ height, width: gridWidth }}>
                {/* Celdas de fondo */}
                <div className="absolute inset-0 flex" style={{ width: gridWidth }}>
                  {dias.map((dia) => {
                    const cellKey = `${recurso.id}-${dia.toISOString()}`;
                    return (
                      <div
                        key={dia.toISOString()}
                        className={cn(
                          'group h-full flex-shrink-0 border-r border-border/40',
                          isWeekend(dia) && 'bg-muted/40',
                          isSameDay(dia, new Date()) && 'bg-primary/5',
                          onQuickCreate && 'cursor-pointer hover:bg-accent/50',
                          draggingAssignmentId && 'cursor-move',
                          hoverCell === cellKey && 'bg-primary/15 outline outline-1 outline-primary/40 -outline-offset-1'
                        )}
                        style={{ width: cellWidth }}
                        onClick={() => onQuickCreate?.(recurso.id, dia)}
                        onDragOver={(e) => {
                          if (draggingAssignmentId) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        }}
                        onDragEnter={() => {
                          if (draggingAssignmentId) setHoverCell(cellKey);
                        }}
                        onDragLeave={() => {
                          if (hoverCell === cellKey) setHoverCell(null);
                        }}
                        onDrop={(e) => handleDrop(e, recurso.id, dia)}
                      >
                        {onQuickCreate && !draggingAssignmentId && (
                          <div className="pointer-events-none flex h-full items-center justify-center opacity-0 transition-opacity group-hover:opacity-60">
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Asignaciones en lanes (por debajo de la columna fija: z-10 < z-20) */}
                {info?.layouts.map((l) => (
                  <AssignmentBlock
                    key={l.asignacion.id}
                    layout={l}
                    cellWidth={cellWidth}
                    onSelect={() => onSelectAssignment?.(l.asignacion.id)}
                    draggable={!!onMoveAssignment}
                    isDragging={draggingAssignmentId === l.asignacion.id}
                    onDragStart={handleAssignmentDragStart}
                    onDragEnd={() => {
                      setDraggingAssignment(null);
                      setHoverCell(null);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Mensaje si no hay recursos */}
        {filas.filter((f) => f.type === 'recurso').length === 0 && (
          <div className="sticky left-0 z-20 flex items-center justify-center py-12 text-sm text-muted-foreground" style={{ width: '100%' }}>
            No hay recursos para mostrar con los filtros actuales
          </div>
        )}
      </div>
    </div>
  );
}

// Bloque individual asignado a un carril (arrastrable: mover a otro día/recurso)
function AssignmentBlock({
  layout,
  cellWidth,
  onSelect,
  onDragStart,
  onDragEnd,
  isDragging,
  draggable,
}: {
  layout: AssignmentLayout;
  cellWidth: number;
  onSelect?: () => void;
  onDragStart?: (e: React.DragEvent, layout: AssignmentLayout) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  draggable?: boolean;
}) {
  const { asignacion, lane, startOffset, spanDias, clippedLeft, clippedRight, tieneConflicto } = layout;
  const textColor = getContrastColor(asignacion.tipoActividadColor);

  return (
    <div
      draggable={!!draggable}
      onDragStart={(e) => onDragStart?.(e, layout)}
      onDragEnd={onDragEnd}
      className={cn(
        'absolute flex items-center gap-0.5 overflow-hidden px-1 transition-shadow hover:shadow-md',
        draggable ? 'cursor-move' : 'cursor-pointer',
        tieneConflicto && 'ring-1 ring-destructive',
        isDragging && 'opacity-40 ring-2 ring-primary'
      )}
      style={{
        left: startOffset * cellWidth + 1,
        width: spanDias * cellWidth - 2,
        top: lane * (LANE_HEIGHT + LANE_GAP) + 2,
        height: LANE_HEIGHT,
        backgroundColor: asignacion.tipoActividadColor,
        color: textColor,
        borderRadius: 3,
        zIndex: 10, // Por debajo de la columna fija (z-20) y el header (z-30)
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      title={`${asignacion.proyectoNombre} · ${asignacion.tipoActividadNombre}\n${asignacion.fechaInicio} → ${asignacion.fechaFin}${tieneConflicto ? '\n⚠️ Conflicto: solape con otra asignación' : ''}${draggable ? '\nArrastra para mover' : ''}`}
    >
      {clippedLeft && <span className="shrink-0 text-[9px]">◂</span>}
      <span className="truncate text-[10px] font-medium leading-none">
        {asignacion.proyectoNombre}
      </span>
      {tieneConflicto && <AlertTriangle className="h-3 w-3 shrink-0" />}
      {clippedRight && <span className="shrink-0 text-[9px]">▸</span>}
    </div>
  );
}

// ============================================
// VISTA GANTT — ESTILO MS PROJECT (decisión d)
// ============================================

const GANTT_ROW_HEIGHT = 36;

// Columnas de la tabla de tareas (estilo MS Project)
const GANTT_COLS = {
  num: 34,        // N°
  nombre: 190,    // Tarea
  estado: 96,     // Estado
  asignado: 120,  // Asignado a
  inicio: 76,     // Fecha inicio
  termino: 76,    // Fecha término
  duracion: 46,   // Duración (días)
  avance: 64,     // % avance
  comentarios: 150, // Comentarios
} as const;

const GANTT_LEFT_WIDTH = Object.values(GANTT_COLS).reduce((a, b) => a + b, 0);

interface GanttProps {
  tareas: GanttTaskItem[];
  fechaInicio: Date;
  fechaFin: Date;
  onUpdatePercent?: (proyectoId: string, percent: number) => void;
  onSelectProject?: (proyectoId: string) => void;
}

export function ProjectGanttView({
  tareas,
  fechaInicio,
  fechaFin,
  onUpdatePercent,
  onSelectProject,
}: GanttProps) {
  const { timeScale } = usePlanningStore();
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const cellWidth = CELL_WIDTHS[timeScale] ?? 48;

  // Hijos directos por id (para colapsar/desplegar jerárquicamente)
  const childrenMap = useMemo(() => {
    const map = new Map<string, GanttTaskItem[]>();
    tareas.forEach((t) => {
      if (!t.parentId) return;
      const lista = map.get(t.parentId) ?? [];
      lista.push(t);
      map.set(t.parentId, lista);
    });
    return map;
  }, [tareas]);

  const toggleCollapse = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Filas con hijos: para colapsar/expandir todo
  const idsConHijos = useMemo(
    () => tareas.filter((t) => (childrenMap.get(t.id)?.length ?? 0) > 0).map((t) => t.id),
    [tareas, childrenMap]
  );
  const todoColapsado =
    idsConHijos.length > 0 && idsConHijos.every((id) => collapsedIds.has(id));
  const toggleTodos = () =>
    setCollapsedIds(todoColapsado ? new Set() : new Set(idsConHijos));

  const dias = useMemo(() => {
    const days: Date[] = [];
    let current = new Date(fechaInicio);
    while (current <= fechaFin) {
      days.push(new Date(current));
      current = addDays(current, 1);
    }
    return days;
  }, [fechaInicio, fechaFin]);

  const totalDias = dias.length;
  const gridWidth = totalDias * cellWidth;
  const headerHeight = 46;

  // Filas visibles: indentación por jerarquía + colapso de padres
  const rows = useMemo(() => {
    // Profundidad genérica: proyecto→actividad→tarea y asignaciones bajo el proyecto.
    // El backend emite las filas en orden jerárquico, así que una pasada basta.
    const depthMap = new Map<string, number>();
    tareas.forEach((t) => {
      if (t.tipo === 'PROYECTO') {
        depthMap.set(t.id, t.parentId ? (depthMap.get(t.parentId) ?? 0) + 1 : 0);
      } else if (t.tipo === 'ASIGNACION') {
        depthMap.set(t.id, (depthMap.get(t.proyectoId) ?? 0) + 1);
      } else {
        // ACTIVIDAD (padre=proyecto) y TAREA (padre=actividad)
        const parentDepth = t.parentId ? depthMap.get(t.parentId) : 0;
        depthMap.set(t.id, (parentDepth ?? 0) + 1);
      }
    });

    // Emisión recursiva respetando el estado de colapso
    const visibles: GanttTaskItem[] = [];
    const emitidos = new Set<string>();
    const emit = (t: GanttTaskItem) => {
      if (emitidos.has(t.id)) return;
      emitidos.add(t.id);
      visibles.push(t);
      if (collapsedIds.has(t.id)) return;
      (childrenMap.get(t.id) ?? []).forEach(emit);
    };
    tareas.filter((t) => !t.parentId).forEach(emit);
    // Huérfanos por seguridad
    tareas.forEach((t) => {
      if (!emitidos.has(t.id)) emit(t);
    });

    return visibles.map((t, index) => ({
      tarea: t,
      index,
      depth: depthMap.get(t.id) ?? 0,
      tieneHijos: (childrenMap.get(t.id) ?? []).length > 0,
      totalHijos: (childrenMap.get(t.id) ?? []).length,
    }));
  }, [tareas, collapsedIds, childrenMap]);

  // Posiciones (x en px) para dibujar flechas de dependencia
  const barGeometry = useMemo(() => {
    const geo = new Map<string, { startX: number; endX: number; centerY: number }>();
    rows.forEach((row) => {
      const startOffset = differenceInCalendarDays(parseISO(row.tarea.fechaInicio), fechaInicio);
      const spanDias =
        differenceInCalendarDays(parseISO(row.tarea.fechaFin), parseISO(row.tarea.fechaInicio)) + 1;
      geo.set(row.tarea.id, {
        startX: Math.max(0, startOffset) * cellWidth,
        endX: Math.max(0, startOffset + spanDias) * cellWidth,
        centerY: row.index * GANTT_ROW_HEIGHT + GANTT_ROW_HEIGHT / 2,
      });
    });
    return geo;
  }, [rows, fechaInicio, cellWidth]);

  // Flechas de dependencia (fin → inicio)
  const dependencyPaths = useMemo(() => {
    const paths: { d: string; critica: boolean }[] = [];
    tareas.forEach((t) => {
      t.dependencies.forEach((depId) => {
        const from = barGeometry.get(depId);
        const to = barGeometry.get(t.id);
        if (!from || !to) return;
        const x1 = from.endX;
        const y1 = from.centerY;
        const x2 = to.startX;
        const y2 = to.centerY;
        const midX = Math.max(x1, x2 - 12) + 6;
        const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2 - 5}`;
        paths.push({ d, critica: t.esCritica });
      });
    });
    return paths;
  }, [tareas, barGeometry]);

  const svgHeight = rows.length * GANTT_ROW_HEIGHT;

  return (
    <div className="relative h-full w-full overflow-auto grid-scrollbar bg-card">
      <div style={{ width: GANTT_LEFT_WIDTH + gridWidth, minWidth: '100%' }}>
        {/* ===== Header ===== */}
        <div className="sticky top-0 z-30 flex border-b bg-card" style={{ height: headerHeight }}>
          <div
            className="sticky left-0 z-40 flex flex-shrink-0 items-stretch border-r bg-card"
            style={{ width: GANTT_LEFT_WIDTH, height: headerHeight }}
          >
            {[
              { key: 'num', label: 'N°', width: GANTT_COLS.num, center: true },
              { key: 'nombre', label: 'Tarea', width: GANTT_COLS.nombre },
              { key: 'estado', label: 'Estado', width: GANTT_COLS.estado },
              { key: 'asignado', label: 'Asignado a', width: GANTT_COLS.asignado },
              { key: 'inicio', label: 'Inicio', width: GANTT_COLS.inicio },
              { key: 'termino', label: 'Término', width: GANTT_COLS.termino },
              { key: 'duracion', label: 'Dur', width: GANTT_COLS.duracion, center: true },
              { key: 'avance', label: 'Avance', width: GANTT_COLS.avance, center: true },
              { key: 'comentarios', label: 'Comentarios', width: GANTT_COLS.comentarios },
            ].map((col) => (
              <div
                key={col.key}
                className={cn(
                  'flex flex-shrink-0 items-center gap-1 border-r px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                  col.center && 'justify-center'
                )}
                style={{ width: col.width, height: headerHeight }}
              >
                {col.key === 'nombre' && (
                  <button
                    className="rounded p-0.5 hover:bg-accent"
                    onClick={toggleTodos}
                    title={todoColapsado ? 'Expandir todo' : 'Colapsar todo'}
                  >
                    {todoColapsado ? (
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronsDownUp className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {col.label}
              </div>
            ))}
          </div>
          <div className="flex flex-shrink-0" style={{ width: gridWidth }}>
            {dias.map((dia) => (
              <div
                key={dia.toISOString()}
                className={cn(
                  'flex flex-shrink-0 flex-col items-center justify-center border-r px-0.5 text-center',
                  isWeekend(dia) && 'bg-muted/50',
                  isSameDay(dia, new Date()) && 'bg-primary/10'
                )}
                style={{ width: cellWidth, height: headerHeight }}
              >
                {cellWidth >= 30 && (
                  <div className="text-[10px] uppercase leading-tight text-muted-foreground">
                    {format(dia, 'EEE', { locale: es })}
                  </div>
                )}
                <div className={cn('text-sm font-medium leading-tight', isSameDay(dia, new Date()) && 'text-primary font-bold')}>
                  {format(dia, 'd')}
                </div>
                {cellWidth >= 40 && (
                  <div className="text-[9px] leading-tight text-muted-foreground">
                    {format(dia, 'MMM', { locale: es })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ===== Filas de tareas ===== */}
        {rows.map((row) => (
          <GanttRow
            key={row.tarea.id}
            row={row}
            dias={dias}
            cellWidth={cellWidth}
            gridWidth={gridWidth}
            fechaInicio={fechaInicio}
            onUpdatePercent={onUpdatePercent}
            onSelectProject={onSelectProject}
            colapsada={collapsedIds.has(row.tarea.id)}
            onToggleCollapse={() => toggleCollapse(row.tarea.id)}
          />
        ))}

        {rows.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            No hay proyectos o asignaciones en el rango visible
          </div>
        )}

        {/* ===== Flechas de dependencia (overlay SVG) ===== */}
        {dependencyPaths.length > 0 && (
          <svg
            className="pointer-events-none absolute"
            style={{ left: GANTT_LEFT_WIDTH, top: headerHeight }}
            width={gridWidth}
            height={Math.max(svgHeight, 1)}
          >
            <defs>
              <marker id="gantt-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
              </marker>
            </defs>
            {dependencyPaths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill="none"
                strokeWidth={1.5}
                stroke={p.critica ? '#dc2626' : 'currentColor'}
                className={p.critica ? '' : 'text-muted-foreground'}
                markerEnd="url(#gantt-arrow)"
                opacity={p.critica ? 0.9 : 0.55}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

// Fila individual del Gantt (columna fija + barra)
function GanttRow({
  row,
  dias,
  cellWidth,
  gridWidth,
  fechaInicio,
  onUpdatePercent,
  onSelectProject,
  colapsada,
  onToggleCollapse,
}: {
  row: { tarea: GanttTaskItem; index: number; depth: number; tieneHijos: boolean; totalHijos: number };
  dias: Date[];
  cellWidth: number;
  gridWidth: number;
  fechaInicio: Date;
  onUpdatePercent?: (proyectoId: string, percent: number) => void;
  onSelectProject?: (proyectoId: string) => void;
  colapsada?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { tarea, depth, tieneHijos } = row;
  const [editingPercent, setEditingPercent] = useState(false);
  const [percentDraft, setPercentDraft] = useState(String(tarea.percentComplete));

  const startOffset = Math.max(0, differenceInCalendarDays(parseISO(tarea.fechaInicio), fechaInicio));
  const spanDias = Math.max(
    1,
    differenceInCalendarDays(parseISO(tarea.fechaFin), parseISO(tarea.fechaInicio)) + 1
  );

  const esProyecto = tarea.tipo === 'PROYECTO';
  const esResumen = esProyecto || tarea.tipo === 'ACTIVIDAD';
  const esSubproyecto = esProyecto && !!tarea.parentId;
  const barColor =
    tarea.color ??
    (tarea.tipo === 'PROYECTO'
      ? '#334155'
      : tarea.tipo === 'ACTIVIDAD'
      ? '#475569'
      : tarea.tipo === 'TAREA'
      ? '#64748b'
      : '#94a3b8');
  // Geometría de barra por nivel
  const barTop =
    tarea.tipo === 'PROYECTO' ? 12 : tarea.tipo === 'ACTIVIDAD' ? 13 : tarea.tipo === 'TAREA' ? 15 : 13;
  const barHeight =
    tarea.tipo === 'PROYECTO' ? 12 : tarea.tipo === 'ACTIVIDAD' ? 10 : tarea.tipo === 'TAREA' ? 7 : 10;

  const commitPercent = () => {
    setEditingPercent(false);
    const val = Number(percentDraft);
    if (!Number.isNaN(val) && val >= 0 && val <= 100 && val !== tarea.percentComplete) {
      onUpdatePercent?.(tarea.proyectoId, Math.round(val));
    }
  };

  const estadoVariant =
    tarea.estado === 'ACTIVO' ||
    tarea.estado === 'EN_CURSO' ||
    tarea.estado === 'CONFIRMADA'
      ? 'default'
      : tarea.estado === 'FINALIZADO' || tarea.estado === 'COMPLETADA'
      ? 'secondary'
      : tarea.estado === 'CANCELADA'
      ? 'destructive'
      : 'outline';

  // Estado derivado para filas del WBS (actividades/tareas no tienen estado propio)
  const esWBS = tarea.tipo === 'ACTIVIDAD' || tarea.tipo === 'TAREA';
  const estadoLabel = tarea.estado ?? (tarea.percentComplete >= 100
    ? 'COMPLETADA'
    : tarea.percentComplete > 0
    ? 'EN_CURSO'
    : 'PENDIENTE');

  return (
    <div className="flex border-b" style={{ height: GANTT_ROW_HEIGHT }}>
      {/* ===== Columna fija: tabla de tareas completa (estilo MS Project) ===== */}
      <div
        className="sticky left-0 z-20 flex flex-shrink-0 items-stretch border-r shadow-[4px_0_6px_-4px_rgba(0,0,0,0.15)]"
        style={{ width: GANTT_LEFT_WIDTH, height: GANTT_ROW_HEIGHT }}
      >
        {/* N° */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center justify-center border-r px-1 text-xs tabular-nums text-muted-foreground',
            esProyecto && 'bg-muted/50 font-semibold'
          )}
          style={{ width: GANTT_COLS.num }}
        >
          {row.index + 1}
        </div>

        {/* Nombre de la tarea (con jerarquía y flechita de colapso) */}
        <div
          className={cn(
            'flex min-w-0 flex-shrink-0 cursor-pointer flex-col justify-center border-r px-2',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.nombre, paddingLeft: 8 + depth * 14 }}
          onClick={() => esProyecto && onSelectProject?.(tarea.proyectoId)}
          title={tarea.nombre}
        >
          <div className="flex min-w-0 items-center gap-1">
            {row.tieneHijos ? (
              <button
                className="shrink-0 rounded p-0.5 hover:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse?.();
                }}
                title={colapsada ? 'Desplegar contenido' : 'Colapsar contenido'}
              >
                {colapsada ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-[18px] shrink-0" />
            )}

            {esProyecto ? (
              <>
                <span className={cn('truncate text-sm leading-tight', esSubproyecto ? 'font-semibold' : 'font-bold')}>
                  {esSubproyecto ? '↳ ' : ''}
                  {tarea.nombre}
                </span>
                {colapsada && row.totalHijos > 0 && (
                  <span className="shrink-0 text-[9px] text-muted-foreground">(+{row.totalHijos})</span>
                )}
              </>
            ) : tarea.tipo === 'ACTIVIDAD' ? (
              <>
                <span className="truncate text-sm font-semibold leading-tight">{tarea.nombre}</span>
                {colapsada && row.totalHijos > 0 && (
                  <span className="shrink-0 text-[9px] text-muted-foreground">(+{row.totalHijos})</span>
                )}
              </>
            ) : (
              <span className="truncate text-xs leading-tight text-muted-foreground">
                {'· '}
                {tarea.nombre}
              </span>
            )}
          </div>
          {esProyecto && tarea.esCritica && (
            <span className="w-fit rounded bg-red-100 px-1 text-[9px] font-semibold leading-tight text-red-700">
              RUTA CRÍTICA
            </span>
          )}
        </div>

        {/* Estado */}
        <div
          className={cn('flex flex-shrink-0 items-center border-r px-1.5', esProyecto && 'bg-muted/50')}
          style={{ width: GANTT_COLS.estado }}
        >
          <Badge variant={estadoVariant} className="truncate px-1.5 py-0 text-[9px]">
            {esWBS ? estadoLabel : (tarea.estado ?? '-')}
          </Badge>
        </div>

        {/* Asignado a */}
        <div
          className={cn(
            'flex min-w-0 flex-shrink-0 items-center border-r px-2',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.asignado }}
          title={tarea.recursos ?? ''}
        >
          <span className="truncate text-xs">{tarea.recursos ?? '-'}</span>
        </div>

        {/* Fecha inicio */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center border-r px-1.5 text-xs tabular-nums',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.inicio }}
        >
          {format(parseISO(tarea.fechaInicio), 'dd/MM/yy')}
        </div>

        {/* Fecha término */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center border-r px-1.5 text-xs tabular-nums',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.termino }}
        >
          {format(parseISO(tarea.fechaFin), 'dd/MM/yy')}
        </div>

        {/* Duración (días) */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center justify-center border-r px-1 text-xs tabular-nums text-muted-foreground',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.duracion }}
        >
          {spanDias}d
        </div>

        {/* % Avance (editable en proyectos — decisión e) */}
        <div
          className={cn(
            'flex flex-shrink-0 flex-col items-center justify-center gap-0.5 border-r px-1',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.avance }}
        >
          {esProyecto && onUpdatePercent ? (
            editingPercent ? (
              <input
                autoFocus
                type="number"
                min={0}
                max={100}
                value={percentDraft}
                onChange={(e) => setPercentDraft(e.target.value)}
                onBlur={commitPercent}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPercent();
                  if (e.key === 'Escape') setEditingPercent(false);
                }}
                className="w-11 rounded border border-primary bg-background px-1 text-center text-xs"
              />
            ) : (
              <button
                className="rounded px-1 text-xs font-semibold tabular-nums hover:bg-accent"
                title="Click para editar el % de avance"
                onClick={() => {
                  setPercentDraft(String(tarea.percentComplete));
                  setEditingPercent(true);
                }}
              >
                {tarea.percentComplete}%
              </button>
            )
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground">{tarea.percentComplete}%</span>
          )}
          {/* Mini barra de progreso */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-border/50">
            <div
              className={cn('h-full rounded-full', tarea.esCritica ? 'bg-red-600' : 'bg-green-600')}
              style={{ width: `${tarea.percentComplete}%` }}
            />
          </div>
        </div>

        {/* Comentarios */}
        <div
          className={cn(
            'flex min-w-0 flex-shrink-0 items-center px-2',
            esProyecto && 'bg-muted/50'
          )}
          style={{ width: GANTT_COLS.comentarios }}
          title={tarea.notas ?? ''}
        >
          <span className="truncate text-xs text-muted-foreground">{tarea.notas ?? ''}</span>
        </div>
      </div>

      {/* ===== Timeline: celdas + barra ===== */}
      <div className="relative flex-1" style={{ height: GANTT_ROW_HEIGHT, width: gridWidth }}>
        {/* Fondo */}
        <div className="absolute inset-0 flex" style={{ width: gridWidth }}>
          {dias.map((dia) => (
            <div
              key={dia.toISOString()}
              className={cn(
                'h-full flex-shrink-0 border-r border-border/40',
                isWeekend(dia) && 'bg-muted/40',
                isSameDay(dia, new Date()) && 'bg-primary/5'
              )}
              style={{ width: cellWidth }}
            />
          ))}
        </div>

        {/* Barra */}
        <div
          className={cn(
            'absolute flex items-center overflow-hidden rounded-[3px]',
            esProyecto ? 'font-bold' : '',
            tarea.esCritica && 'ring-2 ring-red-600'
          )}
          style={{
            left: startOffset * cellWidth + 1,
            width: spanDias * cellWidth - 2,
            top: barTop,
            height: barHeight,
            backgroundColor: barColor,
            zIndex: 10,
          }}
          title={`${tarea.nombre}\n${tarea.fechaInicio} → ${tarea.fechaFin} · ${tarea.percentComplete}%${tarea.esCritica ? '\n⚠️ Ruta crítica' : ''}`}
        >
          {/* Relleno de avance */}
          <div
            className="h-full"
            style={{
              width: `${tarea.percentComplete}%`,
              backgroundColor: tarea.esCritica ? '#b91c1c' : '#15803d',
              opacity: 0.85,
            }}
          />
          {/* Terminales de barra resumen (estilo MS Project) */}
          {esResumen && tieneHijos && (
            <>
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderRight: `6px solid ${barColor}`,
                }}
              />
              <span
                className="absolute right-0 top-1/2 -translate-y-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderLeft: `6px solid ${barColor}`,
                }}
              />
            </>
          )}
        </div>

        {/* Nombre del recurso al lado de la barra (asignaciones) */}
        {!esProyecto && tarea.recursos && cellWidth >= 34 && (
          <span
            className="absolute whitespace-nowrap text-[10px] text-muted-foreground"
            style={{
              left: (startOffset + spanDias) * cellWidth + 4,
              top: 15,
              zIndex: 10,
            }}
          >
            {tarea.recursos}
          </span>
        )}
      </div>
    </div>
  );
}
