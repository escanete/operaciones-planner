import { useMemo, useState } from 'react';
import { usePlanningStore } from '@/stores/planningStore';
import { usePlanningGrid, useProjectGantt, useUpdateProyectoAvance } from '@/hooks/useApi';
import { api } from '@/services/api';
import { VirtualizedTimeGrid, ProjectGanttView } from '@/components/planning/VirtualizedTimeGrid';
import { AssignmentFormDialog } from '@/components/planning/AssignmentFormDialog';
import { AssignmentDetailPanel } from '@/components/planning/AssignmentDetailPanel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Columns3, GanttChartSquare, Plus, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Asignacion, TimeScale } from '@operaciones-planner/shared';
import { cn } from '@/lib/utils';

export function PlanningPage() {
  const {
    viewMode,
    timeScale,
    filters,
    selectedAssignmentId,
    sidebarOpen,
    setViewMode,
    setTimeScale,
    navigateDate,
    selectAssignment,
    setSidebarOpen,
  } = usePlanningStore();

  const [formOpen, setFormOpen] = useState(false);
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>(undefined);
  const [formDefaultRecurso, setFormDefaultRecurso] = useState<string | undefined>(undefined);
  const [editingAsignacion, setEditingAsignacion] = useState<Asignacion | null>(null);

  const { start, end } = usePlanningStore.getState().getDateRange();

  const { data, isLoading, error } = usePlanningGrid({
    fechaInicio: format(start, 'yyyy-MM-dd'),
    fechaFin: format(end, 'yyyy-MM-dd'),
    departamentoId: filters.departamentoId,
    equipoId: filters.equipoId,
    proyectoId: filters.proyectoId,
    tipoActividadId: filters.tipoActividadId,
  });

  // Gantt (decisión d): solo se consulta cuando la vista está activa
  const isGantt = viewMode === 'gantt';
  const { data: ganttData, isLoading: ganttLoading } = useProjectGantt({
    fechaInicio: format(start, 'yyyy-MM-dd'),
    fechaFin: format(end, 'yyyy-MM-dd'),
    proyectoId: filters.proyectoId,
  });
  const updateAvance = useUpdateProyectoAvance();

  const handleUpdatePercent = (proyectoId: string, percent: number) => {
    updateAvance.mutate({ id: proyectoId, percentComplete: percent });
  };

  const title = useMemo(() => {
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    if (timeScale === 'day') {
      return capitalize(format(start, "EEEE d 'de' MMMM, yyyy", { locale: es }));
    }
    if (timeScale === 'week') {
      return `Semana del ${format(start, "d 'de' MMM", { locale: es })} al ${format(end, "d 'de' MMM, yyyy", { locale: es })}`;
    }
    if (timeScale === 'fortnight') {
      return `${format(start, "d 'de' MMM", { locale: es })} – ${format(end, "d 'de' MMM, yyyy", { locale: es })}`;
    }
    if (timeScale === 'month') {
      return capitalize(format(start, 'MMMM yyyy', { locale: es }));
    }
    if (timeScale === 'quarter') {
      return `${format(start, 'MMM yyyy', { locale: es })} – ${format(end, 'MMM yyyy', { locale: es })}`;
    }
    return format(start, 'yyyy');
  }, [start, end, timeScale]);

  const openQuickCreate = (recursoId: string, date: Date) => {
    setFormDefaultRecurso(recursoId);
    setFormDefaultDate(format(date, 'yyyy-MM-dd'));
    setEditingAsignacion(null);
    setFormOpen(true);
  };

  const openNewAssignment = () => {
    setFormDefaultRecurso(undefined);
    setFormDefaultDate(format(new Date(), 'yyyy-MM-dd'));
    setEditingAsignacion(null);
    setFormOpen(true);
  };

  const openEditAssignment = () => {
    if (!selectedAssignmentId) return;
    // Cargar asignación actual y abrir el form en modo edición
    api.get<Asignacion>(`/api/asignaciones/${selectedAssignmentId}`)
      .then((data) => {
        setEditingAsignacion(data);
        setFormOpen(true);
      })
      .catch(() => alert('No se pudo cargar la asignación'));
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Error al cargar los datos</p>
          <p className="text-sm text-muted-foreground mt-1">{String(error)}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Columna principal */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => navigateDate('prev')} title="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateDate('today')}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateDate('next')} title="Siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <h1 className="text-lg font-semibold">{title}</h1>

            {/* Selector de vista: Recursos | Vista Proyecto (Gantt) — decisión d */}
            <div className="flex items-center rounded-md border p-0.5">
              <Button
                variant={!isGantt ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={() => setViewMode('grid')}
                title="Vista de recursos (grilla por persona)"
              >
                <Columns3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vista Recursos</span>
              </Button>
              <Button
                variant={isGantt ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={() => setViewMode('gantt')}
                title="Vista Proyecto: todas las tareas, subtareas, estados, avance y Gantt estilo MS Project"
              >
                <GanttChartSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Vista Proyecto</span>
              </Button>
            </div>

            <Select value={timeScale} onValueChange={(v) => setTimeScale(v as TimeScale)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Día</SelectItem>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="fortnight">Quincenal</SelectItem>
                <SelectItem value="month">Mensual</SelectItem>
                <SelectItem value="quarter">Trimestral</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(!sidebarOpen && 'text-muted-foreground')}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filtros
            </Button>
            <Button size="sm" onClick={openNewAssignment}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Asignación
            </Button>
          </div>
        </div>

        {/* Grid / Gantt según la vista */}
        <div className="flex-1 overflow-hidden">
          {isGantt ? (
            ganttLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <ProjectGanttView
                tareas={ganttData?.tareas ?? []}
                fechaInicio={start}
                fechaFin={end}
                onUpdatePercent={handleUpdatePercent}
              />
            )
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <VirtualizedTimeGrid
              recursos={data?.recursos ?? []}
              asignaciones={data?.asignaciones ?? []}
              fechaInicio={start}
              fechaFin={end}
              onSelectAssignment={selectAssignment}
              onQuickCreate={openQuickCreate}
            />
          )}
        </div>
      </div>

      {/* Panel lateral derecho: detalle de asignación */}
      {selectedAssignmentId && (
        <AssignmentDetailPanel
          assignmentId={selectedAssignmentId}
          onClose={() => selectAssignment(null)}
          onEdit={openEditAssignment}
        />
      )}

      {/* Modal de crear/editar asignación */}
      <AssignmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asignacion={editingAsignacion}
        defaultDate={formDefaultDate}
        defaultRecursoId={formDefaultRecurso}
      />
    </div>
  );
}
