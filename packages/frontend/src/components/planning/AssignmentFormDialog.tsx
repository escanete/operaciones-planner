import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, Loader2, MapPin, Truck, Users } from 'lucide-react';
import { useProyectos, useRecursos, useTiposActividad, useDepartamentos, useProyectoWBS } from '@/hooks/useApi';
import { api, ApiError } from '@/services/api';
import { cn } from '@/lib/utils';
import { getRoleLevelLabel } from '@operaciones-planner/shared';
import type { Asignacion, ConflictInfo } from '@operaciones-planner/shared';

interface AssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asignacion?: Asignacion | null;
  defaultDate?: string;
  defaultRecursoId?: string;
}

export function AssignmentFormDialog({
  open,
  onOpenChange,
  asignacion,
  defaultDate,
  defaultRecursoId,
}: AssignmentFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!asignacion;

  // Form state
  const [proyectoId, setProyectoId] = useState('');
  const [tipoActividadId, setTipoActividadId] = useState('');
  const [recursoIds, setRecursoIds] = useState<string[]>([]);
  const [nombre, setNombre] = useState('');
  // Vínculo WBS opcional (conecta la asignación con el árbol del proyecto)
  const [wbsActividadId, setWbsActividadId] = useState<string>('');
  const [wbsTareaId, setWbsTareaId] = useState<string>('');
  const [wbsSubtareaId, setWbsSubtareaId] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [todoDia, setTodoDia] = useState(true);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [ubicacion, setUbicacion] = useState('');
  const [region, setRegion] = useState('');
  const [camionetaId, setCamionetaId] = useState<string>('');
  const [alojamiento, setAlojamiento] = useState(false);
  const [notas, setNotas] = useState('');
  const [estado, setEstado] = useState('CONFIRMADA');

  // Jerarquía y filtros (decisiones b y e)
  const [filtroDepartamento, setFiltroDepartamento] = useState('__all__');
  const [filtroArea, setFiltroArea] = useState('__all__');
  const [avanceProyecto, setAvanceProyecto] = useState<number | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictos, setConflictos] = useState<ConflictInfo[]>([]);

  // Data
  const { data: proyectos } = useProyectos(); // Todos los proyectos
  const { data: tiposActividad } = useTiposActividad();
  const { data: recursos } = useRecursos({ activo: true, tipo: 'PERSONA' });
  const { data: camionetas } = useRecursos({ activo: true, tipo: 'VEHICULO' });
  const { data: departamentos } = useDepartamentos();
  // Árbol WBS del proyecto seleccionado (para vincular la asignación)
  const { data: wbs } = useProyectoWBS(proyectoId || '__none__');

  // Nodos WBS disponibles según la selección en cascada
  const wbsActividades = wbs?.actividades ?? [];
  const wbsTareas = useMemo(
    () => wbsActividades.find((a) => a.id === wbsActividadId)?.tareas ?? [],
    [wbsActividades, wbsActividadId]
  );
  const wbsSubtareas = useMemo(
    () => wbsTareas.find((t) => t.id === wbsTareaId)?.subtareas ?? [],
    [wbsTareas, wbsTareaId]
  );

  // Áreas disponibles derivadas de los recursos (decisión b)
  const areasDisponibles = useMemo(() => {
    const areas = new Set<string>();
    recursos?.forEach((r) => {
      if (r.areaId) areas.add(r.areaId);
    });
    return Array.from(areas).sort();
  }, [recursos]);

  // Recursos filtrados por departamento/área (decisión e)
  const recursosFiltrados = useMemo(() => {
    return (recursos ?? []).filter((r) => {
      if (filtroDepartamento !== '__all__' && r.departamentoId !== filtroDepartamento) return false;
      if (filtroArea !== '__all__' && r.areaId !== filtroArea) return false;
      return true;
    });
  }, [recursos, filtroDepartamento, filtroArea]);

  // % de avance del proyecto seleccionado (decisión c/e)
  const selectedProyecto = proyectos?.find((p) => p.id === proyectoId);
  useEffect(() => {
    if (open) {
      setAvanceProyecto(selectedProyecto?.percentComplete ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proyectoId]);

  // Solo mostrar proyectos que no estén finalizados ni cancelados
  const proyectosDisponibles = proyectos?.filter(
    (p) => p.estado !== 'FINALIZADO' && p.estado !== 'CANCELADO'
  );

  // Reset/Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (asignacion) {
        setProyectoId(asignacion.proyectoId);
        setTipoActividadId(asignacion.tipoActividadId);
        setRecursoIds([asignacion.recursoId]);
        setNombre(asignacion.nombre ?? '');
        setWbsActividadId(asignacion.actividadId ?? '');
        setWbsTareaId(asignacion.tareaId ?? '');
        setWbsSubtareaId(asignacion.subtareaId ?? '');
        setFechaInicio(asignacion.fechaInicio.toString().split('T')[0]);
        setFechaFin(asignacion.fechaFin.toString().split('T')[0]);
        setTodoDia(asignacion.todoDia);
        setHoraInicio(asignacion.horaInicio ?? '08:00');
        setHoraFin(asignacion.horaFin ?? '18:00');
        setUbicacion(asignacion.ubicacion ?? '');
        setRegion(asignacion.region ?? '');
        setCamionetaId(asignacion.camionetaId ?? '');
        setAlojamiento(asignacion.alojamiento);
        setNotas(asignacion.notas ?? '');
        setEstado(asignacion.estado);
      } else {
        // Defaults para nueva asignación
        setProyectoId(proyectosDisponibles?.[0]?.id ?? '');
        setTipoActividadId(tiposActividad?.[0]?.id ?? '');
        setRecursoIds(defaultRecursoId ? [defaultRecursoId] : []);
        setNombre('');
        setWbsActividadId('');
        setWbsTareaId('');
        setWbsSubtareaId('');
        setFechaInicio(defaultDate ?? new Date().toISOString().split('T')[0]);
        setFechaFin(defaultDate ?? new Date().toISOString().split('T')[0]);
        setTodoDia(true);
        setHoraInicio('08:00');
        setHoraFin('18:00');
        setUbicacion('');
        setRegion('');
        setCamionetaId('');
        setAlojamiento(false);
        setNotas('');
        setEstado('CONFIRMADA');
      }
      setError(null);
      setConflictos([]);
    }
  }, [open, asignacion, defaultDate, defaultRecursoId, proyectos, tiposActividad]);

  const toggleRecurso = (id: string) => {
    setRecursoIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (forzar = false) => {
    setError(null);
    setConflictos([]);

    if (!proyectoId || !tipoActividadId || recursoIds.length === 0 || !fechaInicio || !fechaFin) {
      setError('Completa todos los campos obligatorios');
      return;
    }

    if (fechaFin < fechaInicio) {
      setError('La fecha fin no puede ser anterior a la fecha inicio');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        proyectoId,
        tipoActividadId,
        nombre: nombre || undefined,
        actividadId: wbsActividadId || undefined,
        tareaId: wbsTareaId || undefined,
        subtareaId: wbsSubtareaId || undefined,
        fechaInicio,
        fechaFin,
        todoDia,
        ubicacion: ubicacion || undefined,
        region: region || undefined,
        camionetaId: camionetaId && camionetaId !== '__none__' ? camionetaId : undefined,
        alojamiento,
        notas: notas || undefined,
        estado,
        forzar,
      };

      if (!todoDia) {
        payload.horaInicio = horaInicio;
        payload.horaFin = horaFin;
      }

      if (isEditing && asignacion) {
        await api.put(`/api/asignaciones/${asignacion.id}`, {
          ...payload,
          recursoId: recursoIds[0],
          version: asignacion.version,
        });
      } else {
        // Crear una asignación por cada recurso seleccionado
        for (const recursoId of recursoIds) {
          await api.post('/api/asignaciones', { ...payload, recursoId });
        }
      }

      // Guardar % de avance del proyecto si cambió (decisión e)
      if (avanceProyecto !== null && selectedProyecto && avanceProyecto !== (selectedProyecto.percentComplete ?? null)) {
        await api.put(`/api/proyectos/${proyectoId}`, { percentComplete: avanceProyecto });
      }

      // Invalidar queries para refrescar el grid
      await queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
      await queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      await queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      await queryClient.invalidateQueries({ queryKey: ['proyecto-wbs'] });
      await queryClient.invalidateQueries({ queryKey: ['proyectos'] });

      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { conflictos?: ConflictInfo[] };
        setConflictos(data.conflictos ?? []);
        setError('Se detectaron conflictos de actividad (mismo recurso en fechas que se solapan)');
      } else {
        setError(err instanceof Error ? err.message : 'Error al guardar');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTipoActividad = tiposActividad?.find((t) => t.id === tipoActividadId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isEditing ? 'Editar Actividad' : 'Nueva Actividad'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la actividad existente'
              : 'Asigna uno o más participantes a un proyecto en un rango de fechas'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Proyecto y Tipo de Actividad */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proyecto">
                Proyecto <span className="text-destructive">*</span>
              </Label>
              <Select
                value={proyectoId}
                onValueChange={(v) => {
                  setProyectoId(v);
                  setWbsActividadId('');
                  setWbsTareaId('');
                  setWbsSubtareaId('');
                }}
              >
                <SelectTrigger id="proyecto">
                  <SelectValue placeholder="Seleccionar proyecto" />
                </SelectTrigger>
                <SelectContent>
                  {proyectosDisponibles?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: p.color ?? '#888' }}
                        />
                        <span>{p.nombre}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.cliente ? `(${p.cliente.nombre})` : ''} · {p.estado}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoActividad">
                Tipo de Actividad <span className="text-destructive">*</span>
              </Label>
              <Select value={tipoActividadId} onValueChange={setTipoActividadId}>
                <SelectTrigger id="tipoActividad">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposActividad?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        {t.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nombre de la actividad (qué hace específicamente la persona) */}
          <div className="space-y-2">
            <Label htmlFor="nombre-actividad">Nombre de la actividad</Label>
            <Input
              id="nombre-actividad"
              placeholder="Ej: Mantenimiento SCADA — Planta Norte"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Describe qué se hará específicamente. Se muestra en el calendario, el Gantt y el árbol
              del proyecto. Si se deja vacío se usa el tipo de actividad.
            </p>
          </div>

          {/* Vinculación WBS: conectar la asignación con el árbol del proyecto */}
          {wbsActividades.length > 0 && (
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Vincular al árbol del proyecto (opcional)
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={wbsActividadId || '__none__'}
                  onValueChange={(v) => {
                    setWbsActividadId(v === '__none__' ? '' : v);
                    setWbsTareaId('');
                    setWbsSubtareaId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Actividad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin actividad —</SelectItem>
                    {wbsActividades.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={wbsTareaId || '__none__'}
                  disabled={wbsTareas.length === 0}
                  onValueChange={(v) => {
                    setWbsTareaId(v === '__none__' ? '' : v);
                    setWbsSubtareaId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tarea" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin tarea —</SelectItem>
                    {wbsTareas.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={wbsSubtareaId || '__none__'}
                  disabled={wbsSubtareas.length === 0}
                  onValueChange={(v) => setWbsSubtareaId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subtarea" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin subtarea —</SelectItem>
                    {wbsSubtareas.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                La actividad aparecerá en el árbol del proyecto bajo el elemento seleccionado.
              </p>
            </div>
          )}

          {/* Participantes (multi-select) con filtros por depto/área (decisiones b y e) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participantes <span className="text-destructive">*</span>
                {recursoIds.length > 0 && (
                  <Badge variant="secondary">{recursoIds.length} seleccionados</Badge>
                )}
              </Label>
            </div>

            {/* Filtros de departamento y área */}
            <div className="grid grid-cols-2 gap-2">
              <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos los departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los departamentos</SelectItem>
                  {departamentos?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroArea} onValueChange={setFiltroArea} disabled={areasDisponibles.length === 0}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todas las áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas las áreas</SelectItem>
                  {areasDisponibles.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2">
                {recursosFiltrados.map((r) => (
                  <label
                    key={r.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors',
                      recursoIds.includes(r.id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent'
                    )}
                  >
                    <Checkbox
                      checked={recursoIds.includes(r.id)}
                      onCheckedChange={() => toggleRecurso(r.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {r.nombre} {r.apellido}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.cargo?.nombre ?? r.equipo?.nombre}
                        {r.areaId ? ` · ${r.areaId}` : ''}
                      </p>
                    </div>
                    {/* Nivel jerárquico del rol (decisión a) */}
                    {r.roleLevel > 0 && (
                      <Badge
                        variant={r.roleLevel >= 4 ? 'default' : 'outline'}
                        className="shrink-0 px-1.5 py-0 text-[9px]"
                        title={`Nivel jerárquico: ${getRoleLevelLabel(r.roleLevel)}`}
                      >
                        N{r.roleLevel}
                      </Badge>
                    )}
                  </label>
                ))}
                {recursosFiltrados.length === 0 && (
                  <p className="col-span-2 py-4 text-center text-xs text-muted-foreground">
                    Sin participantes con los filtros actuales
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* % Avance del proyecto (decisiones c y e) */}
          {selectedProyecto && (
            <div className="space-y-2">
              <Label htmlFor="avance" className="text-xs">
                Avance del proyecto «{selectedProyecto.nombre}» (%)
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="avance"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={avanceProyecto ?? 0}
                  onChange={(e) => setAvanceProyecto(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="w-12 text-right text-sm font-medium tabular-nums">
                  {avanceProyecto ?? 0}%
                </span>
              </div>
            </div>
          )}

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaInicio">
                Fecha Inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaFin">
                Fecha Fin <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fechaFin"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
          </div>

          {/* Todo el día / Horario */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={todoDia} onCheckedChange={(c) => setTodoDia(c === true)} />
              <span className="text-sm">Todo el día</span>
            </label>
            {!todoDia && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-28"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
                <span className="text-muted-foreground">a</span>
                <Input
                  type="time"
                  className="w-28"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Ubicación y Región */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ubicacion" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ubicación
              </Label>
              <Input
                id="ubicacion"
                placeholder="Ej: Planta Norte, Oficina Central..."
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Región</Label>
              <Input
                id="region"
                placeholder="Ej: Metropolitana, Valparaíso..."
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>

          {/* Logística: Camioneta y Alojamiento */}
          <div className="space-y-3 rounded-md border p-3 bg-muted/30">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="h-4 w-4" />
              Logística
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="camioneta" className="text-xs">
                  Vehículo asignado
                </Label>
                <Select value={camionetaId} onValueChange={setCamionetaId}>
                  <SelectTrigger id="camioneta">
                    <SelectValue placeholder="Sin vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin vehículo</SelectItem>
                    {camionetas?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.nombre} ({v.patente})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <Checkbox
                    checked={alojamiento}
                    onCheckedChange={(c) => setAlojamiento(c === true)}
                  />
                  <span className="text-sm">Requiere alojamiento</span>
                </label>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Observaciones adicionales..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          {/* Estado (solo edición) */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger id="estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BORRADOR">Borrador</SelectItem>
                  <SelectItem value="CONFIRMADA">Confirmada</SelectItem>
                  <SelectItem value="EN_CURSO">En Curso</SelectItem>
                  <SelectItem value="COMPLETADA">Completada</SelectItem>
                  <SelectItem value="CANCELADA">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Errores y Conflictos */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
              {conflictos.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {conflictos.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge
                        variant={c.severidad === 'ERROR' ? 'destructive' : 'secondary'}
                        className="mt-0.5"
                      >
                        {c.severidad}
                      </Badge>
                      <span>{c.mensaje}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {conflictos.length > 0 && conflictos.every((c) => c.severidad !== 'ERROR') && (
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
            >
              Guardar con advertencias
            </Button>
          )}
          <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Actividad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
