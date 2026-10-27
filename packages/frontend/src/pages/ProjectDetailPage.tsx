import { Fragment, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileDown,
  FileText,
  GanttChartSquare,
  ListTree,
  Loader2,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { usePlanningStore } from '@/stores/planningStore';
import { api } from '@/services/api';
import { AssignmentFormDialog } from '@/components/planning/AssignmentFormDialog';
import { ProjectGanttView } from '@/components/planning/VirtualizedTimeGrid';
import {
  useProyectoWBS,
  useRecursos,
  useCreateActividad,
  useUpdateActividad,
  useDeleteActividad,
  useCreateTarea,
  useUpdateTarea,
  useDeleteTarea,
  useCreateSubtarea,
  useUpdateSubtarea,
  useDeleteSubtarea,
  useMateriales,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  useProjectGantt,
  useUpdateProyectoAvance,
} from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type {
  Actividad,
  Subtarea,
  Tarea,
  AsignacionResumen,
  Asignacion,
  Material,
  MaterialEstado,
  GanttTaskItem,
  ProyectoWBSResponse,
  TimeScale,
} from '@operaciones-planner/shared';

// ============================================
// PERMISOS (definición de roles acordada)
// - FULL (Gerente=ADMIN_DEPTO, PM=PLANIFICADOR, COMERCIAL, SUPER_ADMIN):
//     gestionan desde el proyecto hasta la subtarea
// - JEFE_AREA: gestiona actividades, tareas y subtareas (no proyectos)
// - OPERADOR (técnico/ingeniero): solo subtareas de tareas donde está asignado
// - VISTA_SOLO: solo lectura
// ============================================

const ROLES_FULL = ['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL'];

interface DialogConfig {
  tipo: 'actividad' | 'tarea' | 'subtarea';
  mode: 'create' | 'edit';
  target?: Actividad | Tarea | Subtarea;
  actividadId?: string;
  tareaId?: string;
}

type DetalleTab = 'wbs' | 'materiales' | 'documentos' | 'gantt';

const TABS: { id: DetalleTab; label: string; icon: typeof ListTree }[] = [
  { id: 'wbs', label: 'Actividades', icon: ListTree },
  { id: 'materiales', label: 'Materiales', icon: Package },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'gantt', label: 'Gantt', icon: GanttChartSquare },
];

export function ProjectDetailPage() {
  const { proyectoId } = useParams<{ proyectoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useProyectoWBS(proyectoId ?? '');
  const { data: recursos } = useRecursos({ tipo: 'PERSONA', activo: true });

  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<DetalleTab>('wbs');
  // Editar/eliminar actividades de planificación (asignaciones) desde el árbol
  const [editingAsignacion, setEditingAsignacion] = useState<Asignacion | null>(null);
  const [formAsignacionOpen, setFormAsignacionOpen] = useState(false);

  const rol = user?.rol ?? '';
  const canWBS = ROLES_FULL.includes(rol) || rol === 'JEFE_AREA';
  // Quién puede editar asignaciones de planificación (mismo criterio que el backend)
  const canPlanificar = ['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(rol);
  const miRecursoId = user?.recursoId ?? null;
  const puedeEditarSubtareaDe = (tarea: Tarea) =>
    canWBS ||
    (rol === 'OPERADOR' && !!miRecursoId && (tarea.asignados ?? []).some((a) => a.recursoId === miRecursoId));

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRelevanteProyecto = async () => {
    if (!proyectoId || !data) return;
    try {
      await api.put(`/api/proyectos/${proyectoId}`, { relevante: !data.proyecto.relevante });
      queryClient.invalidateQueries({ queryKey: ['proyecto-wbs', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    } catch (err) {
      alert('No se pudo actualizar: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // ===== Editar / eliminar actividades de planificación desde el árbol =====
  const handleEditAsignacion = async (id: string) => {
    try {
      const full = await api.get<Asignacion>(`/api/asignaciones/${id}`);
      setEditingAsignacion(full);
      setFormAsignacionOpen(true);
    } catch (err) {
      alert('No se pudo cargar la actividad: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteAsignacion = async (id: string) => {
    const ok = confirm(
      '¿Eliminar esta actividad de planificación?\n\n' +
        'Se quita del calendario del recurso y del árbol del proyecto.\n' +
        'La tarea/subtarea WBS a la que estaba vinculada NO se elimina.'
    );
    if (!ok) return;
    try {
      await api.delete(`/api/asignaciones/${id}`);
      await queryClient.invalidateQueries({ queryKey: ['proyecto-wbs', proyectoId ?? '' ] });
      await queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
      await queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      await queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
    } catch (err) {
      alert('No se pudo eliminar: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleExport = async () => {
    if (!proyectoId) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/actividades/proyecto/${proyectoId}/export-msproject`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data?.proyecto.nombre ?? 'proyecto')
        .replace(/[^a-zA-Z0-9-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '_')}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('No se pudo exportar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="font-medium text-destructive">Error al cargar el proyecto</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  const percent = Math.round(data?.proyecto.percentComplete ?? 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-lg font-semibold">
              {data?.proyecto.nombre ?? 'Proyecto'}
              {canWBS && (
                <button
                  className={cn(
                    'shrink-0 rounded p-0.5 transition-colors hover:bg-accent',
                    data?.proyecto.relevante ? 'text-amber-500' : 'text-muted-foreground/40'
                  )}
                  title={
                    data?.proyecto.relevante
                      ? 'Quitar marcación de relevancia'
                      : 'Marcar proyecto como relevante'
                  }
                  onClick={toggleRelevanteProyecto}
                >
                  <Star
                    className="h-4 w-4"
                    fill={data?.proyecto.relevante ? 'currentColor' : 'none'}
                  />
                </button>
              )}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{data?.proyecto.estado}</Badge>
              {data && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {data.metadata.totalActividades} actividades · {data.metadata.totalTareas} tareas ·{' '}
                  {data.metadata.totalSubtareas} subtareas
                  {data.metadata.totalAsignaciones > 0 &&
                    ` · ${data.metadata.totalAsignaciones} en planificación`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden w-40 md:block">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avance</span>
              <span className="font-semibold tabular-nums">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Exportar a MS Project
          </Button>

          {canWBS && (
            <Button size="sm" onClick={() => setDialog({ tipo: 'actividad', mode: 'create' })}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Actividad
            </Button>
          )}
        </div>
      </div>

      {/* ===== Pestañas del proyecto ===== */}
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
        <div className="flex items-center rounded-md border p-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 gap-1.5 px-2"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* ===== Contenido según pestaña ===== */}
      {activeTab === 'wbs' && (
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.actividades.length ?? 0) === 0 && (data?.asignaciones.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Este proyecto aún no tiene actividades</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Las actividades son los servicios cobrados al cliente. Dentro de cada una se crean
                tareas y subtareas; al completarlas, el avance del proyecto sube automáticamente.
                También puedes crear actividades desde la vista de Planificación y vincularlas aquí.
              </p>
              {canWBS && (
                <Button className="mt-2" onClick={() => setDialog({ tipo: 'actividad', mode: 'create' })}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera actividad
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Actividades de planificación sin vínculo WBS (cuelgan del proyecto) */}
            {(data?.asignaciones.length ?? 0) > 0 && (
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-2.5">
                  <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">
                    Actividades de planificación
                  </p>
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {data!.asignaciones.length}
                  </Badge>
                </div>
                <div className="divide-y">
                  {data!.asignaciones.map((a) => (
                    <AsignacionRow
                      key={a.id}
                      a={a}
                      indent="pl-10"
                      canEdit={canPlanificar}
                      onEdit={handleEditAsignacion}
                      onDelete={handleDeleteAsignacion}
                    />
                  ))}
                </div>
              </Card>
            )}

            {data!.actividades.map((actividad) => (
              <ActividadCard
                key={actividad.id}
                actividad={actividad}
                canWBS={canWBS}
                puedeEditarSubtareaDe={puedeEditarSubtareaDe}
                canEditAsignacion={canPlanificar}
                onEditAsignacion={handleEditAsignacion}
                onDeleteAsignacion={handleDeleteAsignacion}
                collapsed={collapsed}
                toggleCollapse={toggleCollapse}
                openDialog={setDialog}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {activeTab === 'materiales' && proyectoId && (
        <MaterialesTab proyectoId={proyectoId} canManage={canWBS} />
      )}

      {activeTab === 'documentos' && <DocumentosTab />}

      {activeTab === 'gantt' && (
        <GanttProyectoTab
          proyecto={data?.proyecto}
          isLoadingWbs={isLoading}
          canMover={canPlanificar}
          canAvance={canPlanificar}
        />
      )}

      {/* ===== Diálogo crear/editar ===== */}
      {dialog && (
        <WBSDialog
          config={dialog}
          proyectoId={proyectoId ?? ''}
          recursos={recursos ?? []}
          onClose={() => setDialog(null)}
        />
      )}

      {/* ===== Formulario de edición de actividades de planificación ===== */}
      <AssignmentFormDialog
        open={formAsignacionOpen}
        onOpenChange={(open) => {
          setFormAsignacionOpen(open);
          if (!open) setEditingAsignacion(null);
        }}
        asignacion={editingAsignacion}
      />
    </div>
  );
}

// ============================================
// Tarjeta de actividad (con tareas y subtareas)
// ============================================

function ActividadCard({
  actividad,
  canWBS,
  puedeEditarSubtareaDe,
  canEditAsignacion,
  onEditAsignacion,
  onDeleteAsignacion,
  collapsed,
  toggleCollapse,
  openDialog,
}: {
  actividad: Actividad;
  canWBS: boolean;
  puedeEditarSubtareaDe: (tarea: Tarea) => boolean;
  canEditAsignacion?: boolean;
  onEditAsignacion?: (id: string) => void;
  onDeleteAsignacion?: (id: string) => void;
  collapsed: Set<string>;
  toggleCollapse: (key: string) => void;
  openDialog: (d: DialogConfig) => void;
}) {
  const deleteActividad = useDeleteActividad(actividad.proyectoId);
  const deleteTarea = useDeleteTarea(actividad.proyectoId);
  const deleteSubtarea = useDeleteSubtarea(actividad.proyectoId);
  const updateSubtarea = useUpdateSubtarea(actividad.proyectoId);
  const updateTarea = useUpdateTarea(actividad.proyectoId);
  const updateActividad = useUpdateActividad(actividad.proyectoId);

  const isCollapsed = collapsed.has(`a-${actividad.id}`);
  const percent = Math.round(actividad.percentComplete);

  const handleDeleteActividad = async () => {
    if (confirm(`¿Eliminar la actividad "${actividad.nombre}" y todas sus tareas?`)) {
      await deleteActividad.mutateAsync(actividad.id);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Fila actividad */}
      <div className="flex items-center gap-2 bg-muted/40 px-3 py-2.5">
        <button
          className="rounded p-0.5 hover:bg-accent"
          onClick={() => toggleCollapse(`a-${actividad.id}`)}
          title={isCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => toggleCollapse(`a-${actividad.id}`)}
        >
          <p className="truncate text-sm font-bold">{actividad.nombre}</p>
          {actividad.descripcion && (
            <p className="truncate text-xs text-muted-foreground">{actividad.descripcion}</p>
          )}
        </div>

        <FechasChip fechaInicio={actividad.fechaInicio} fechaFin={actividad.fechaFin} />

        <MiniProgress percent={percent} />

        {canWBS && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', !actividad.relevante && 'text-muted-foreground/40')}
              title={actividad.relevante ? 'Quitar relevancia' : 'Marcar como relevante'}
              onClick={() =>
                updateActividad.mutate({ id: actividad.id, data: { relevante: !actividad.relevante } })
              }
            >
              <Star className="h-3.5 w-3.5" fill={actividad.relevante ? 'currentColor' : 'none'} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => openDialog({ tipo: 'tarea', mode: 'create', actividadId: actividad.id })}
            >
              <Plus className="mr-1 h-3 w-3" />
              Tarea
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Editar actividad"
              onClick={() => openDialog({ tipo: 'actividad', mode: 'edit', target: actividad })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Eliminar actividad"
              onClick={handleDeleteActividad}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {/* Tareas */}
      {!isCollapsed && (
        <div className="divide-y">
          {(actividad.tareas ?? []).map((tarea) => {
            const tareaColapsada = collapsed.has(`t-${tarea.id}`);
            const tieneSubtareas = (tarea.subtareas ?? []).length > 0;
            const puedeEditarSub = puedeEditarSubtareaDe(tarea);

            return (
              <div key={tarea.id}>
                {/* Fila tarea */}
                <div className="flex items-center gap-2 px-3 py-2 pl-10 hover:bg-accent/30">
                  {tieneSubtareas ? (
                    <button
                      className="rounded p-0.5 hover:bg-accent"
                      onClick={() => toggleCollapse(`t-${tarea.id}`)}
                    >
                      {tareaColapsada ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}

                  {/* Checkbox directo si la tarea no tiene subtareas (roll-up si tiene) */}
                  {!tieneSubtareas && canWBS ? (
                    <Checkbox
                      checked={tarea.completada}
                      onCheckedChange={(c) =>
                        updateTarea.mutate({ id: tarea.id, data: { completada: c === true } })
                      }
                      className="shrink-0"
                      title="Marcar tarea como completada"
                    />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}

                  <p
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      tarea.percentComplete === 100 && 'text-muted-foreground line-through'
                    )}
                  >
                    {tarea.nombre}
                  </p>

                  {/* Asignados (varias personas por tarea) */}
                  <div className="hidden max-w-[220px] flex-wrap items-center gap-1 md:flex">
                    {(tarea.asignados ?? []).map((a) => (
                      <Badge key={a.recursoId} variant="outline" className="px-1.5 py-0 text-[10px]">
                        {a.nombre} {a.apellido ?? ''}
                      </Badge>
                    ))}
                  </div>

                  <FechasChip fechaInicio={tarea.fechaInicio} fechaFin={tarea.fechaFin} />

                  <MiniProgress percent={Math.round(tarea.percentComplete)} />

                  {canWBS && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-7 w-7', !tarea.relevante && 'text-muted-foreground/40')}
                        title={tarea.relevante ? 'Quitar relevancia' : 'Marcar como relevante'}
                        onClick={() =>
                          updateTarea.mutate({ id: tarea.id, data: { relevante: !tarea.relevante } })
                        }
                      >
                        <Star className="h-3.5 w-3.5" fill={tarea.relevante ? 'currentColor' : 'none'} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          openDialog({ tipo: 'subtarea', mode: 'create', tareaId: tarea.id })
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Subtarea
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Editar tarea"
                        onClick={() => openDialog({ tipo: 'tarea', mode: 'edit', target: tarea })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Eliminar tarea"
                        onClick={() => {
                          if (confirm(`¿Eliminar la tarea "${tarea.nombre}"?`)) {
                            deleteTarea.mutateAsync(tarea.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Subtareas */}
                {!tareaColapsada &&
                  (tarea.subtareas ?? []).map((subtarea) => (
                    <Fragment key={subtarea.id}>
                      <div className="flex items-center gap-2 py-1.5 pl-16 pr-3 hover:bg-accent/30">
                      <Checkbox
                        checked={subtarea.completada}
                        disabled={!puedeEditarSub}
                        onCheckedChange={(c) =>
                          updateSubtarea.mutate({ id: subtarea.id, data: { completada: c === true } })
                        }
                        title={
                          puedeEditarSub
                            ? 'Marcar subtarea como completada'
                            : 'Solo puedes editar subtareas de tareas donde estás asignado'
                        }
                      />
                      <p
                        className={cn(
                          'min-w-0 flex-1 truncate text-xs',
                          subtarea.completada && 'text-muted-foreground line-through'
                        )}
                      >
                        {subtarea.nombre}
                      </p>
                      {puedeEditarSub && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn('h-6 w-6', !subtarea.relevante && 'text-muted-foreground/40')}
                            title={subtarea.relevante ? 'Quitar relevancia' : 'Marcar como relevante'}
                            onClick={() =>
                              updateSubtarea.mutate({
                                id: subtarea.id,
                                data: { relevante: !subtarea.relevante },
                              })
                            }
                          >
                            <Star className="h-3 w-3" fill={subtarea.relevante ? 'currentColor' : 'none'} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Editar subtarea"
                            onClick={() =>
                              openDialog({ tipo: 'subtarea', mode: 'edit', target: subtarea })
                            }
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Eliminar subtarea"
                            onClick={() => {
                              if (confirm(`¿Eliminar la subtarea "${subtarea.nombre}"?`)) {
                                deleteSubtarea.mutateAsync(subtarea.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                      </div>
                      {/* Actividades de planificación vinculadas a esta subtarea */}
                      {(subtarea.asignaciones ?? []).map((a) => (
                        <AsignacionRow
                          key={a.id}
                          a={a}
                          indent="pl-24"
                          canEdit={canEditAsignacion}
                          onEdit={onEditAsignacion}
                          onDelete={onDeleteAsignacion}
                        />
                      ))}
                    </Fragment>
                  ))}

                {/* Actividades de planificación vinculadas a esta tarea */}
                {!tareaColapsada &&
                  (tarea.asignaciones ?? []).map((a) => (
                    <AsignacionRow
                      key={a.id}
                      a={a}
                      indent="pl-16"
                      canEdit={canEditAsignacion}
                      onEdit={onEditAsignacion}
                      onDelete={onDeleteAsignacion}
                    />
                  ))}
              </div>
            );
          })}

          {/* Actividades de planificación vinculadas directo a la actividad */}
          {(actividad.asignaciones ?? []).map((a) => (
            <AsignacionRow
              key={a.id}
              a={a}
              indent="pl-10"
              canEdit={canEditAsignacion}
              onEdit={onEditAsignacion}
              onDelete={onDeleteAsignacion}
            />
          ))}

          {(actividad.tareas ?? []).length === 0 && (actividad.asignaciones ?? []).length === 0 && (
            <p className="px-10 py-2 text-xs text-muted-foreground">
              Sin tareas todavía{canWBS ? ' — usa «+ Tarea» para agregar la primera' : ''}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ============================================
// Utilidades visuales
// ============================================

// Fila de actividad de planificación dentro del árbol WBS
function AsignacionRow({
  a,
  indent = 'pl-10',
  canEdit = false,
  onEdit,
  onDelete,
}: {
  a: AsignacionResumen;
  indent?: string;
  canEdit?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const inicio = new Date(a.fechaInicio).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
  });
  const fin = new Date(a.fechaFin).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
  return (
    <div
      className={cn(
        'group flex items-center gap-2 py-1.5 pr-3 text-xs hover:bg-accent/30',
        indent
      )}
      title={`${a.nombre ?? a.tipoActividadNombre} — ${a.recursoNombre}\n${inicio} → ${fin} · ${a.estado}`}
    >
      <CalendarClock className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">
        {a.nombre ?? a.tipoActividadNombre}
      </span>
      <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
        {a.recursoNombre}
      </Badge>
      <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
        {inicio} → {fin}
      </span>
      <Badge
        variant={a.estado === 'COMPLETADA' ? 'default' : 'secondary'}
        className="shrink-0 px-1.5 py-0 text-[10px]"
      >
        {a.estado}
      </Badge>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Editar actividad de planificación"
            onClick={() => onEdit?.(a.id)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Eliminar actividad de planificación"
            onClick={() => onDelete?.(a.id)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}

function MiniProgress({ percent }: { percent: number }) {
  return (
    <div className="flex w-20 shrink-0 items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', percent === 100 ? 'bg-green-600' : 'bg-amber-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">
        {percent}%
      </span>
    </div>
  );
}

function FechasChip({
  fechaInicio,
  fechaFin,
}: {
  fechaInicio?: Date | string;
  fechaFin?: Date | string;
}) {
  if (!fechaInicio && !fechaFin) return null;
  const fmt = (d?: Date | string) => (d ? format(parseISO(d.toString()), 'dd/MM/yy') : '');
  return (
    <span className="hidden shrink-0 text-[10px] tabular-nums text-muted-foreground lg:inline">
      {fmt(fechaInicio)} → {fmt(fechaFin)}
    </span>
  );
}

// ============================================
// Diálogo unificado crear/editar (actividad | tarea | subtarea)
// ============================================

function WBSDialog({
  config,
  proyectoId,
  recursos,
  onClose,
}: {
  config: DialogConfig;
  proyectoId: string;
  recursos: { id: string; nombre: string; apellido?: string }[];
  onClose: () => void;
}) {
  const { tipo, mode, target, actividadId, tareaId } = config;
  const isEdit = mode === 'edit';

  const createActividad = useCreateActividad(proyectoId);
  const updateActividad = useUpdateActividad(proyectoId);
  const createTarea = useCreateTarea(proyectoId);
  const updateTarea = useUpdateTarea(proyectoId);
  const createSubtarea = useCreateSubtarea(proyectoId);
  const updateSubtarea = useUpdateSubtarea(proyectoId);

  const [nombre, setNombre] = useState(String(target?.nombre ?? ''));
  const [descripcion, setDescripcion] = useState(String(target?.descripcion ?? ''));
  const conFechas = target as { fechaInicio?: Date | string; fechaFin?: Date | string } | undefined;
  const [fechaInicio, setFechaInicio] = useState(
    conFechas?.fechaInicio ? format(parseISO(conFechas.fechaInicio.toString()), 'yyyy-MM-dd') : ''
  );
  const [fechaFin, setFechaFin] = useState(
    conFechas?.fechaFin ? format(parseISO(conFechas.fechaFin.toString()), 'yyyy-MM-dd') : ''
  );
  const [asignados, setAsignados] = useState<string[]>(
    isEdit && tipo === 'tarea'
      ? ((target as Tarea | undefined)?.asignados ?? []).map((a) => a.recursoId)
      : []
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const titulo =
    tipo === 'actividad'
      ? isEdit
        ? 'Editar actividad'
        : 'Nueva actividad (servicio)'
      : tipo === 'tarea'
      ? isEdit
        ? 'Editar tarea'
        : 'Nueva tarea'
      : isEdit
      ? 'Editar subtarea'
      : 'Nueva subtarea';

  const toggleAsignado = (id: string) => {
    setAsignados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const base = {
        nombre: nombre.trim(),
        descripcion: descripcion || undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
      };

      if (tipo === 'actividad') {
        if (isEdit) {
          await updateActividad.mutateAsync({ id: (target as Actividad).id, data: base });
        } else {
          await createActividad.mutateAsync({ proyectoId, ...base });
        }
      } else if (tipo === 'tarea') {
        const payload = { ...base, asignados };
        if (isEdit) {
          await updateTarea.mutateAsync({ id: (target as Tarea).id, data: payload });
        } else {
          await createTarea.mutateAsync({ actividadId: actividadId!, data: payload });
        }
      } else {
        const payload = { nombre: nombre.trim(), descripcion: descripcion || undefined };
        if (isEdit) {
          await updateSubtarea.mutateAsync({ id: (target as Subtarea).id, data: payload });
        } else {
          await createSubtarea.mutateAsync({ tareaId: tareaId!, data: payload });
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {tipo === 'actividad' &&
              'Las actividades representan los servicios cobrados al cliente. Su avance se calcula con sus tareas.'}
            {tipo === 'tarea' &&
              'Asigna una o varias personas responsables. El avance sube al completar subtareas o la tarea misma.'}
            {tipo === 'subtarea' &&
              'Al completar subtareas, el avance de la tarea, la actividad y el proyecto sube automáticamente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wbs-nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wbs-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={
                tipo === 'actividad'
                  ? 'Ej: Instalación de sistema SCADA'
                  : tipo === 'tarea'
                  ? 'Ej: Levantamiento en terreno'
                  : 'Ej: Revisar planos eléctricos'
              }
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wbs-descripcion">Descripción</Label>
            <Textarea
              id="wbs-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
            />
          </div>

          {tipo !== 'subtarea' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wbs-inicio">Fecha inicio</Label>
                <Input
                  id="wbs-inicio"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wbs-fin">Fecha término</Label>
                <Input
                  id="wbs-fin"
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
            </div>
          )}

          {tipo === 'tarea' && (
            <div className="space-y-2">
              <Label>
                Asignados ({asignados.length}) — varias personas pueden trabajar esta tarea
              </Label>
              <div className="max-h-44 overflow-y-auto rounded-md border p-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {recursos.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded border p-1.5 text-xs transition-colors',
                        asignados.includes(r.id) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                      )}
                    >
                      <Checkbox
                        checked={asignados.includes(r.id)}
                        onCheckedChange={() => toggleAsignado(r.id)}
                      />
                      <span className="truncate">
                        {r.nombre} {r.apellido ?? ''}
                      </span>
                    </label>
                  ))}
                  {recursos.length === 0 && (
                    <p className="col-span-2 py-2 text-center text-xs text-muted-foreground">
                      No hay personas registradas
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// PESTAÑA MATERIALES (base del futuro módulo de inventario)
// ============================================

const CATEGORIAS_SUGERIDAS = [
  'Electrónico',
  'Consumible',
  'Herramienta',
  'Cableado',
  'Repuesto',
  'Otro',
];

const UNIDADES_SUGERIDAS = ['un', 'mt', 'kg', 'caja', 'rollo', 'par', 'set'];

const ESTADO_MATERIAL_LABEL: Record<MaterialEstado, string> = {
  PENDIENTE: 'Pendiente',
  SOLICITADO: 'Solicitado',
  ENTREGADO: 'Entregado',
  INSTALADO: 'Instalado',
  DEVUELTO: 'Devuelto',
};

function EstadoMaterialBadge({ estado }: { estado: MaterialEstado }) {
  const conf: Record<MaterialEstado, { variant: 'outline' | 'default'; className?: string }> = {
    PENDIENTE: { variant: 'outline' },
    SOLICITADO: { variant: 'default', className: 'bg-amber-500' },
    ENTREGADO: { variant: 'default', className: 'bg-blue-600' },
    INSTALADO: { variant: 'default', className: 'bg-green-600' },
    DEVUELTO: { variant: 'outline' },
  };
  const c = conf[estado] ?? { variant: 'outline' as const };
  return (
    <Badge variant={c.variant} className={cn('shrink-0 px-1.5 py-0 text-[10px]', c.className)}>
      {ESTADO_MATERIAL_LABEL[estado] ?? estado}
    </Badge>
  );
}

function MaterialesTab({ proyectoId, canManage }: { proyectoId: string; canManage: boolean }) {
  const { data: materiales, isLoading } = useMateriales(proyectoId);
  const deleteMaterial = useDeleteMaterial(proyectoId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (m: Material) => {
    setEditing(m);
    setDialogOpen(true);
  };

  const handleDelete = (m: Material) => {
    if (confirm(`¿Eliminar el material "${m.nombre}"?`)) {
      deleteMaterial.mutate(m.id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Materiales y activos del proyecto</h2>
          <p className="text-xs text-muted-foreground">
            Artículos electrónicos, consumibles, herramientas y otros materiales asociados
            (base del futuro módulo de inventario)
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Material
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (materiales ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Este proyecto aún no tiene materiales registrados</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Registra los materiales y activos que necesita el proyecto: artículos electrónicos,
              consumibles, herramientas, cableado, etc.
            </p>
            {canManage && (
              <Button className="mt-2" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar primer material
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden items-center gap-2 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground md:grid md:grid-cols-[1fr_120px_90px_110px_80px]">
            <span>Material</span>
            <span>Categoría</span>
            <span>Cantidad</span>
            <span>Estado</span>
            <span className="text-right">Acciones</span>
          </div>
          <div className="divide-y">
            {(materiales ?? []).map((m) => (
              <div
                key={m.id}
                className="group grid items-center gap-2 px-3 py-2 hover:bg-accent/30 md:grid-cols-[1fr_120px_90px_110px_80px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.nombre}</p>
                  {m.descripcion && (
                    <p className="truncate text-xs text-muted-foreground" title={m.descripcion}>
                      {m.descripcion}
                    </p>
                  )}
                </div>
                <div className="min-w-0">
                  {m.categoria ? (
                    <Badge variant="outline" className="truncate px-1.5 py-0 text-[10px]">
                      {m.categoria}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <span className="text-sm tabular-nums">
                  {m.cantidad} <span className="text-xs text-muted-foreground">{m.unidad ?? ''}</span>
                </span>
                <EstadoMaterialBadge estado={m.estado} />
                {canManage ? (
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Editar material"
                      onClick={() => openEdit(m)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Eliminar material"
                      onClick={() => handleDelete(m)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {dialogOpen && (
        <MaterialDialog
          proyectoId={proyectoId}
          material={editing}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MaterialDialog({
  proyectoId,
  material,
  onClose,
}: {
  proyectoId: string;
  material: Material | null;
  onClose: () => void;
}) {
  const createMaterial = useCreateMaterial(proyectoId);
  const updateMaterial = useUpdateMaterial(proyectoId);
  const isEdit = !!material;

  const [nombre, setNombre] = useState(material?.nombre ?? '');
  const [categoria, setCategoria] = useState(material?.categoria ?? '');
  const [cantidad, setCantidad] = useState(String(material?.cantidad ?? 1));
  const [unidad, setUnidad] = useState(material?.unidad ?? '');
  const [estado, setEstado] = useState<MaterialEstado>(material?.estado ?? 'PENDIENTE');
  const [descripcion, setDescripcion] = useState(material?.descripcion ?? '');
  const [notas, setNotas] = useState(material?.notas ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    const cant = parseFloat(cantidad);
    if (Number.isNaN(cant) || cant <= 0) {
      setError('La cantidad debe ser un número mayor que 0');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        categoria: categoria || undefined,
        cantidad: cant,
        unidad: unidad || undefined,
        estado,
        descripcion: descripcion || undefined,
        notas: notas || undefined,
      };
      if (isEdit && material) {
        await updateMaterial.mutateAsync({ id: material.id, data: payload });
      } else {
        await createMaterial.mutateAsync({ proyectoId, ...payload });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar material' : 'Nuevo material'}</DialogTitle>
          <DialogDescription>
            Registra los materiales y activos del proyecto: artículos electrónicos,
            consumibles, herramientas, etc.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="mat-nombre">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mat-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Radio RTU Motorola"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mat-categoria">Categoría</Label>
              <Input
                id="mat-categoria"
                list="categorias-material"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej: Electrónico"
              />
              <datalist id="categorias-material">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as MaterialEstado)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ESTADO_MATERIAL_LABEL) as MaterialEstado[]).map((e) => (
                    <SelectItem key={e} value={e}>
                      {ESTADO_MATERIAL_LABEL[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mat-cantidad">Cantidad</Label>
              <Input
                id="mat-cantidad"
                type="number"
                min="0"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-unidad">Unidad</Label>
              <Input
                id="mat-unidad"
                list="unidades-material"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="un, mt, kg..."
              />
              <datalist id="unidades-material">
                {UNIDADES_SUGERIDAS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mat-descripcion">Descripción</Label>
            <Textarea
              id="mat-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Modelo, número de parte, detalles técnicos..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mat-notas">Notas</Label>
            <Textarea
              id="mat-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones, proveedor, ubicación física..."
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// PESTAÑA DOCUMENTOS (placeholder — módulo en diseño)
// ============================================

function DocumentosTab() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Gestión de documentos del proyecto</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Aquí podrás subir, descargar y organizar los documentos asociados al proyecto:
            planos, informes, actas, protocolos y manuales. El módulo está en diseño y se
            habilitará en una próxima actualización.
          </p>
          <Badge variant="outline" className="mt-1">Próximamente</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// PESTAÑA GANTT (solo del proyecto seleccionado)
// ============================================

function GanttProyectoTab({
  proyecto,
  isLoadingWbs,
  canMover,
  canAvance,
}: {
  proyecto?: ProyectoWBSResponse['proyecto'];
  isLoadingWbs: boolean;
  canMover: boolean;
  canAvance: boolean;
}) {
  const { timeScale, setTimeScale } = usePlanningStore();
  const queryClient = useQueryClient();
  const updateAvance = useUpdateProyectoAvance();

  // Rango del gantt: fechas programadas del proyecto (o fechaInicio/Fin) con
  // margen de una semana; sin fechas → ventana móvil alrededor de hoy
  const { start, end } = useMemo(() => {
    const inicioStr = proyecto?.scheduledStart ?? proyecto?.fechaInicio;
    const finStr = proyecto?.scheduledEnd ?? proyecto?.fechaFin;
    return {
      start: inicioStr ? addDays(parseISO(inicioStr.toString()), -7) : addDays(new Date(), -15),
      end: finStr ? addDays(parseISO(finStr.toString()), 7) : addDays(new Date(), 45),
    };
  }, [proyecto?.scheduledStart, proyecto?.fechaInicio, proyecto?.scheduledEnd, proyecto?.fechaFin]);

  const { data: ganttData, isLoading } = useProjectGantt(
    {
      fechaInicio: format(start, 'yyyy-MM-dd'),
      fechaFin: format(end, 'yyyy-MM-dd'),
      proyectoId: proyecto?.id,
    },
    { enabled: !!proyecto?.id }
  );

  const handleUpdatePercent = (proyectoId: string, percent: number) => {
    updateAvance.mutate({ id: proyectoId, percentComplete: percent });
  };

  const handleMoveTask = async (tarea: GanttTaskItem, dias: number) => {
    const nuevaInicio = format(addDays(parseISO(tarea.fechaInicio), dias), 'yyyy-MM-dd');
    const nuevaFin = format(addDays(parseISO(tarea.fechaFin), dias), 'yyyy-MM-dd');
    try {
      if (tarea.tipo === 'PROYECTO') {
        await api.put(`/api/proyectos/${tarea.id}`, {
          scheduledStart: nuevaInicio,
          scheduledEnd: nuevaFin,
        });
      } else if (tarea.tipo === 'ACTIVIDAD') {
        await api.put(`/api/actividades/${tarea.id}`, {
          fechaInicio: nuevaInicio,
          fechaFin: nuevaFin,
        });
      } else if (tarea.tipo === 'TAREA') {
        await api.put(`/api/actividades/tarea/${tarea.id}`, {
          fechaInicio: nuevaInicio,
          fechaFin: nuevaFin,
        });
      } else {
        return; // las asignaciones se mueven desde la vista de recursos
      }
      await queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      await queryClient.invalidateQueries({ queryKey: ['proyecto-wbs'] });
    } catch (err) {
      alert('No se pudo reprogramar: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (isLoadingWbs || !proyecto) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <p className="hidden text-sm text-muted-foreground sm:block">
          Gantt del proyecto — arrastra las barras para reprogramar
        </p>
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
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <ProjectGanttView
            tareas={ganttData?.tareas ?? []}
            fechaInicio={start}
            fechaFin={end}
            onUpdatePercent={canAvance ? handleUpdatePercent : undefined}
            onMoveTask={canMover ? handleMoveTask : undefined}
            canMoveTask={canMover}
          />
        )}
      </div>
    </div>
  );
}
