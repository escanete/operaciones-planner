import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileDown,
  Loader2,
  Pencil,
  Plus,
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
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
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
} from '@/hooks/useApi';
import { cn } from '@/lib/utils';
import type { Actividad, Subtarea, Tarea } from '@operaciones-planner/shared';

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

export function ProjectDetailPage() {
  const { proyectoId } = useParams<{ proyectoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data, isLoading, error } = useProyectoWBS(proyectoId ?? '');
  const { data: recursos } = useRecursos({ tipo: 'PERSONA', activo: true });

  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const rol = user?.rol ?? '';
  const canWBS = ROLES_FULL.includes(rol) || rol === 'JEFE_AREA';
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
            <h1 className="truncate text-lg font-semibold">{data?.proyecto.nombre ?? 'Proyecto'}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{data?.proyecto.estado}</Badge>
              {data && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {data.metadata.totalActividades} actividades · {data.metadata.totalTareas} tareas ·{' '}
                  {data.metadata.totalSubtareas} subtareas
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

      {/* ===== Árbol WBS ===== */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.actividades.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Este proyecto aún no tiene actividades</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Las actividades son los servicios cobrados al cliente. Dentro de cada una se crean
                tareas y subtareas; al completarlas, el avance del proyecto sube automáticamente.
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
            {data!.actividades.map((actividad) => (
              <ActividadCard
                key={actividad.id}
                actividad={actividad}
                canWBS={canWBS}
                puedeEditarSubtareaDe={puedeEditarSubtareaDe}
                collapsed={collapsed}
                toggleCollapse={toggleCollapse}
                openDialog={setDialog}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== Diálogo crear/editar ===== */}
      {dialog && (
        <WBSDialog
          config={dialog}
          proyectoId={proyectoId ?? ''}
          recursos={recursos ?? []}
          onClose={() => setDialog(null)}
        />
      )}
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
  collapsed,
  toggleCollapse,
  openDialog,
}: {
  actividad: Actividad;
  canWBS: boolean;
  puedeEditarSubtareaDe: (tarea: Tarea) => boolean;
  collapsed: Set<string>;
  toggleCollapse: (key: string) => void;
  openDialog: (d: DialogConfig) => void;
}) {
  const deleteActividad = useDeleteActividad(actividad.proyectoId);
  const deleteTarea = useDeleteTarea(actividad.proyectoId);
  const deleteSubtarea = useDeleteSubtarea(actividad.proyectoId);
  const updateSubtarea = useUpdateSubtarea(actividad.proyectoId);
  const updateTarea = useUpdateTarea(actividad.proyectoId);

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
                    <div
                      key={subtarea.id}
                      className="flex items-center gap-2 py-1.5 pl-16 pr-3 hover:bg-accent/30"
                    >
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
                  ))}
              </div>
            );
          })}

          {(actividad.tareas ?? []).length === 0 && (
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
