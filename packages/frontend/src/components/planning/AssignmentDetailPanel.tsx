import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  Clock,
  Edit,
  Loader2,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getContrastColor, getRoleLevelLabel } from '@operaciones-planner/shared';
import type { Asignacion, Proyecto } from '@operaciones-planner/shared';

interface AssignmentDetailPanelProps {
  assignmentId: string;
  onClose: () => void;
  onEdit: () => void;
}

export function AssignmentDetailPanel({ assignmentId, onClose, onEdit }: AssignmentDetailPanelProps) {
  const queryClient = useQueryClient();
  const [asignacion, setAsignacion] = useState<Asignacion | null>(null);
  const [proyectoPadre, setProyectoPadre] = useState<Proyecto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setProyectoPadre(null);
      try {
        const data = await api.get<Asignacion>(`/api/asignaciones/${assignmentId}`);
        setAsignacion(data);
        // Jerarquía de proyectos (decisión c): cargar el proyecto padre si es un sub-proyecto
        if (data.proyecto?.subprojectId) {
          try {
            const padre = await api.get<Proyecto>(`/api/proyectos/${data.proyecto.subprojectId}`);
            setProyectoPadre(padre);
          } catch {
            // El padre puede haber sido eliminado; no es bloqueante
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la actividad');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [assignmentId]);

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta actividad?')) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/asignaciones/${assignmentId}`);
      await queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
      await queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      onClose();
    } catch (err) {
      alert('Error al eliminar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!assignmentId) return null;

  return (
    <aside className="w-96 border-l bg-card flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-semibold">Detalle de Actividad</h2>
        <div className="flex items-center gap-1">
          {asignacion && (
            <>
              <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Eliminar"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </div>
        ) : asignacion ? (
          <div className="space-y-4">
            {/* Banner del proyecto con color */}
            <div
              className="rounded-lg p-4 text-white"
              style={{
                backgroundColor: asignacion.tipoActividad?.color ?? '#888',
                color: getContrastColor(asignacion.tipoActividad?.color ?? '#888'),
              }}
            >
              <div className="text-xs opacity-80 font-medium uppercase tracking-wide">
                {asignacion.tipoActividad?.nombre}
              </div>
              <h3 className="text-lg font-bold mt-1">{asignacion.proyecto?.nombre}</h3>
              {asignacion.nombre && (
                <p className="text-sm font-semibold opacity-95 mt-0.5">{asignacion.nombre}</p>
              )}
              {proyectoPadre && (
                <p className="text-xs opacity-90 mt-0.5">
                  ↳ Sub-proyecto de: <span className="font-semibold">{proyectoPadre.nombre}</span>
                </p>
              )}
              {asignacion.proyecto?.cliente && (
                <p className="text-sm opacity-90 mt-1">{asignacion.proyecto.cliente.nombre}</p>
              )}
              {/* Avance del proyecto (decisión c) */}
              {asignacion.proyecto?.percentComplete !== undefined &&
                asignacion.proyecto?.percentComplete !== null && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                      <div
                        className="h-full rounded-full bg-current"
                        style={{ width: `${asignacion.proyecto.percentComplete}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs font-medium">
                      Avance: {asignacion.proyecto.percentComplete}%
                    </p>
                  </div>
                )}
            </div>

            {/* Estado */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              <Badge
                variant={
                  asignacion.estado === 'CONFIRMADA'
                    ? 'default'
                    : asignacion.estado === 'CONFLICTO'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {asignacion.estado}
              </Badge>
            </div>

            <Separator />

            {/* Participante */}
            <DetailRow icon={<User className="h-4 w-4" />} label="Participante">
              <p className="font-medium">
                {asignacion.recurso?.nombre} {asignacion.recurso?.apellido}
                {/* Nivel jerárquico del rol (decisión a) */}
                {(asignacion.recurso?.roleLevel ?? 0) > 0 && (
                  <Badge
                    variant={(asignacion.recurso?.roleLevel ?? 0) >= 4 ? 'default' : 'outline'}
                    className="ml-2 px-1.5 py-0 text-[10px]"
                    title={`Nivel jerárquico: ${getRoleLevelLabel(asignacion.recurso?.roleLevel ?? 0)}`}
                  >
                    N{asignacion.recurso?.roleLevel} · {getRoleLevelLabel(asignacion.recurso?.roleLevel ?? 0)}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {asignacion.recurso?.cargo?.nombre ?? ''}
                {asignacion.recurso?.equipo ? ` · ${asignacion.recurso.equipo.nombre}` : ''}
                {asignacion.recurso?.areaId ? ` · Área: ${asignacion.recurso.areaId}` : ''}
              </p>
            </DetailRow>

            {/* Fechas */}
            <DetailRow icon={<Calendar className="h-4 w-4" />} label="Período">
              <p className="font-medium">
                {format(parseISO(asignacion.fechaInicio.toString()), "EEEE d 'de' MMM, yyyy", { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground">
                hasta {format(parseISO(asignacion.fechaFin.toString()), "EEEE d 'de' MMM, yyyy", { locale: es })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil(
                  (new Date(asignacion.fechaFin).getTime() - new Date(asignacion.fechaInicio).getTime()) /
                    (1000 * 60 * 60 * 24)
                ) + 1}{' '}
                días
              </p>
            </DetailRow>

            {/* Horario */}
            <DetailRow icon={<Clock className="h-4 w-4" />} label="Horario">
              {asignacion.todoDia ? (
                <p className="font-medium">Todo el día</p>
              ) : (
                <p className="font-medium">
                  {asignacion.horaInicio} – {asignacion.horaFin}
                </p>
              )}
            </DetailRow>

            {/* Ubicación */}
            {asignacion.ubicacion && (
              <DetailRow icon={<MapPin className="h-4 w-4" />} label="Ubicación">
                <p className="font-medium">{asignacion.ubicacion}</p>
                {asignacion.region && (
                  <p className="text-xs text-muted-foreground">{asignacion.region}</p>
                )}
              </DetailRow>
            )}

            {/* Logística */}
            {(asignacion.camioneta || asignacion.alojamiento) && (
              <DetailRow icon={<Truck className="h-4 w-4" />} label="Logística">
                {asignacion.camioneta && (
                  <p className="font-medium">
                    {asignacion.camioneta.nombre} · {asignacion.camioneta.patente}
                  </p>
                )}
                {asignacion.alojamiento && (
                  <p className="text-xs text-muted-foreground">Requiere alojamiento</p>
                )}
              </DetailRow>
            )}

            {/* Notas */}
            {asignacion.notas && (
              <DetailRow icon={<MessageSquare className="h-4 w-4" />} label="Notas">
                <p className="text-sm whitespace-pre-wrap">{asignacion.notas}</p>
              </DetailRow>
            )}

            <Separator />

            {/* Metadata */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Creado: {format(new Date(asignacion.creadoAt), "d MMM yyyy, HH:mm", { locale: es })}</p>
              <p>Modificado: {format(new Date(asignacion.actualizadoAt), "d MMM yyyy, HH:mm", { locale: es })}</p>
              <p>Versión: {asignacion.version}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer con acciones */}
      {asignacion && (
        <div className="border-t p-4 space-y-2">
          <Button className="w-full" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar actividad
          </Button>
          <Button variant="outline" className="w-full">
            <MoreHorizontal className="mr-2 h-4 w-4" />
            Más acciones
          </Button>
        </div>
      )}
    </aside>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}
