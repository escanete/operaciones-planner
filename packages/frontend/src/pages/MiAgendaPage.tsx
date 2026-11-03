import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useRecurso, useGraphEstado } from '@/hooks/useApi';
import { api, ApiError } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CalendarCheck, ChevronLeft, ChevronRight, ExternalLink, Loader2, LogOut, Settings, User, Calendar, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { format, addDays, parseISO, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Asignacion, AsignacionEstado, Proyecto, TipoActividad, Recurso } from '@operaciones-planner/shared';

interface AsignacionConDetalle extends Omit<Asignacion, 'proyecto' | 'tipoActividad' | 'recurso'> {
  proyecto: Pick<Proyecto, 'id' | 'nombre' | 'color'>;
  tipoActividad: Pick<TipoActividad, 'id' | 'nombre' | 'color'>;
  recurso: Pick<Recurso, 'id' | 'nombre' | 'apellido' | 'email'>;
  graphEventId: string | null;
  graphEventWebLink: string | null;
}

interface AgendaState {
  asignaciones: AsignacionConDetalle[];
  isLoading: boolean;
  error: string | null;
  weekStart: Date;
}

export function MiAgendaPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: recurso, isLoading: recursoLoading } = useRecurso(user?.recursoId ?? '');
  const { data: estadoGraph, refetch: refetchGraphEstado } = useGraphEstado();
  
  const [state, setState] = useState<AgendaState>({
    asignaciones: [],
    isLoading: true,
    error: null,
    weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  // Device code flow state
  const [deviceCode, setDeviceCode] = useState<{ codigo: string; url: string; intervalo: number; expiraEn: number } | null>(null);
  const [devicePolling, setDevicePolling] = useState(false);

  const cargarAsignaciones = async () => {
    if (!user?.recursoId) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const weekEnd = endOfWeek(state.weekStart, { weekStartsOn: 1 });
    
    try {
      const res = await api.get<{ data: AsignacionConDetalle[] }>(
        `/api/asignaciones?recursoId=${user.recursoId}&fechaDesde=${format(state.weekStart, 'yyyy-MM-dd')}&fechaHasta=${format(weekEnd, 'yyyy-MM-dd')}&estado=BORRADOR,CONFIRMADA,EN_CURSO,COMPLETADA,CONFLICTO`
      );
      setState(prev => ({ ...prev, asignaciones: res.data, isLoading: false }));
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: err instanceof Error ? err.message : 'No se pudieron cargar las asignaciones' 
      }));
    }
  };

  useEffect(() => {
    cargarAsignaciones();
  }, [user?.recursoId, state.weekStart]);

  const semanaAnterior = () => setState(prev => ({ ...prev, weekStart: addWeeks(prev.weekStart, -1) }));
  const semanaSiguiente = () => setState(prev => ({ ...prev, weekStart: addWeeks(prev.weekStart, 1) }));
  const irAHoy = () => setState(prev => ({ ...prev, weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }) }));

  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i));

  const obtenerColorEstado = (estado: AsignacionEstado) => {
    switch (estado) {
      case 'BORRADOR': return 'bg-gray-500';
      case 'CONFIRMADA': return 'bg-blue-500';
      case 'EN_CURSO': return 'bg-yellow-500';
      case 'COMPLETADA': return 'bg-green-500';
      case 'CANCELADA': return 'bg-red-500';
      case 'CONFLICTO': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const obtenerLabelEstado = (estado: AsignacionEstado) => {
    switch (estado) {
      case 'BORRADOR': return 'Borrador';
      case 'CONFIRMADA': return 'Confirmada';
      case 'EN_CURSO': return 'En curso';
      case 'COMPLETADA': return 'Completada';
      case 'CANCELADA': return 'Cancelada';
      case 'CONFLICTO': return 'Conflicto';
      default: return estado;
    }
  };

  const asignacionesDelDia = (fecha: Date) => 
    state.asignaciones.filter(a => 
      new Date(a.fechaInicio) <= fecha && new Date(a.fechaFin) >= fecha
    );

  const inicialesRecurso = recurso 
    ? `${recurso.nombre?.[0] ?? ''}${recurso.apellido?.[0] ?? ''}` 
    : '?';

  const conectarCalendario = async () => {
    try {
      const res = await api.post<{ codigo: string; url: string; mensaje: string; intervalo: number; expiraEn: number }>(
        '/api/auth/msgraph/device/iniciar', 
        {}
      );
      setDeviceCode({ codigo: res.codigo, url: res.url, intervalo: res.intervalo, expiraEn: res.expiraEn });
      setDevicePolling(true);
      window.open(res.url, '_blank');
      // Iniciar polling
      pollDeviceCode();
    } catch (err) {
      alert('No se pudo iniciar la conexión: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const cancelarConexion = () => {
    setDevicePolling(false);
    setDeviceCode(null);
  };

  const pollDeviceCode = async () => {
    if (!devicePolling) return;
    
    try {
      const res = await api.get<{ 
        estado: 'iniciando' | 'pendiente' | 'listo' | 'expirado' | 'rechazado' | 'error' | 'sin_inicio'; 
        intervalo?: number;
        detalle?: string;
        cuenta?: string | null;
      }>('/api/auth/msgraph/device/estado');
      
      if (res.estado === 'listo') {
        setDevicePolling(false);
        setDeviceCode(null);
        // Refrescar estado de Graph (calendario) y recurso (por si se auto-vinculó)
        await Promise.all([refetchGraphEstado(), queryClient.invalidateQueries({ queryKey: ['recursos'] })]);
        alert(`¡Outlook conectado! (${res.cuenta ?? 'cuenta de Microsoft'})`);
      } else if (res.estado === 'pendiente') {
        const intervalo = (res.intervalo ?? 5) * 1000;
        setTimeout(pollDeviceCode, intervalo);
      } else if (res.estado === 'expirado') {
        setDevicePolling(false);
        setDeviceCode(null);
        alert('El código expiró. Intenta de nuevo.');
      } else if (res.estado === 'rechazado') {
        setDevicePolling(false);
        setDeviceCode(null);
        alert('La autorización fue rechazada.');
      } else if (res.estado === 'error') {
        setDevicePolling(false);
        setDeviceCode(null);
        alert('Error: ' + (res.detalle ?? 'desconocido'));
      }
    } catch (err) {
      console.error('Error polling device code:', err);
      setDevicePolling(false);
      setDeviceCode(null);
      alert('Error consultando el estado: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <CalendarDays className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Mi Agenda</h1>
            <p className="text-sm text-muted-foreground">
              Tus asignaciones de la semana del {format(state.weekStart, 'd MMM', { locale: es })} al {format(endOfWeek(state.weekStart, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: es })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={semanaAnterior}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={irAHoy}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={semanaSiguiente}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          {!estadoGraph?.conectado && !estadoGraph?.calendario?.conectado && (
            <Button variant="default" size="sm" onClick={conectarCalendario}>
              <CalendarCheck className="mr-2 h-4 w-4" />
              Conectar Outlook
            </Button>
          )}
          
          {estadoGraph?.calendario?.conectado && (
            <Badge variant={estadoGraph.calendario.activo ? 'default' : 'secondary'} className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Outlook conectado
            </Badge>
          )}
        </div>
      </div>

      {/* Device code flow UI */}
      {deviceCode && devicePolling && (
        <Card className="mb-4 border-primary bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-primary">Conectando con Microsoft...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ingresa este código en <a href={deviceCode.url} target="_blank" rel="noopener" className="underline">microsoft.com/devicelogin</a>
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <code className="px-3 py-1.5 bg-background border rounded font-mono text-lg letter-spacing-wide font-bold">
                    {deviceCode.codigo}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(deviceCode.codigo)}>
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  El código expira en {Math.ceil(deviceCode.expiraEn / 60)} minutos. Esperando autorización...
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={cancelarConexion}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info del recurso vinculado */}
      {recursoLoading ? (
        <Card className="mb-4">
          <CardContent className="py-4 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4 border-l-4 border-primary">
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {inicialesRecurso}
              </div>
              <div className="flex-1">
                <p className="font-medium">{recurso ? `${recurso.nombre} ${recurso.apellido ?? ''}` : 'Sin recurso vinculado'}</p>
                <p className="text-sm text-muted-foreground">{recurso?.email ?? 'Sin email'}</p>
                {recurso && (
                  <p className="text-xs text-muted-foreground">
                    {recurso.departamento?.nombre} · {recurso.equipo?.nombre ?? 'Sin equipo'}
                  </p>
                )}
                {!recurso && (
                  <p className="text-sm text-amber-600 mt-1">
                    ⚠ No tienes un recurso (persona) vinculado a tu usuario. 
                    Pide a un administrador que te vincule en Admin → Usuarios para ver tus asignaciones y sincronizar con Outlook.
                  </p>
                )}
              </div>
              {estadoGraph?.calendario?.ultimoError && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Error de sync: {estadoGraph.calendario.ultimoError.slice(0, 50)}...
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vista semanal */}
      {state.isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {diasSemana.map(dia => (
            <Card key={dia.toISOString()} className="min-h-[200px]">
              <CardContent className="py-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : state.error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center text-destructive">
            <AlertCircle className="mx-auto h-8 w-8 mb-2" />
            <p>{state.error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={cargarAsignaciones}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {diasSemana.map(dia => {
            const esHoy = format(dia, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const asignaciones = asignacionesDelDia(dia);
            const esFinDeSemana = dia.getDay() === 0 || dia.getDay() === 6;

            return (
              <Card 
                key={dia.toISOString()} 
                className={cn(
                  'min-h-[200px] flex flex-col',
                  esHoy && 'ring-2 ring-primary',
                  esFinDeSemana && 'bg-muted/30'
                )}
              >
                <CardHeader className={cn('pb-2', esHoy && 'bg-primary/5')}>
                  <div className={cn('flex items-center justify-between', esHoy && 'text-primary font-semibold')}>
                    <span className="text-sm font-medium">
                      {format(dia, 'EEE d MMM', { locale: es })}
                    </span>
                    {asignaciones.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {asignaciones.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-0 space-y-1.5 px-2 py-2">
                  {asignaciones.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Sin asignaciones
                    </p>
                  ) : (
                    asignaciones.map(a => (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded p-2 text-xs cursor-pointer transition-colors hover:bg-accent',
                          'border-l-3',
                          obtenerColorEstado(a.estado).replace('bg-', 'border-l-')
                        )}
                        onClick={() => navigate(`/proyectos/${a.proyectoId}?asignacion=${a.id}`)}
                        title="Clic para ver el proyecto"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate pr-2">
                            {a.proyecto.nombre}
                          </span>
                          <Badge variant="outline" className={cn('text-[10px]', obtenerColorEstado(a.estado).replace('bg-', 'text-'))}>
                            {obtenerLabelEstado(a.estado)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span className="truncate text-[11px]">
                            {a.tipoActividad.nombre}{a.nombre ? ` · ${a.nombre}` : ''}
                          </span>
                        </div>
                        {!a.todoDia && a.horaInicio && (
                          <div className="text-[10px] text-muted-foreground">
                            {a.horaInicio}{a.horaFin ? ` - ${a.horaFin}` : ''}
                          </div>
                        )}
                        {a.graphEventId && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="mt-1 h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (a.graphEventWebLink) window.open(a.graphEventWebLink, '_blank');
                            }}
                            title="Abrir en Outlook"
                          >
                            <ExternalLink className="h-3 w-3 text-primary" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resumen de la semana */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Resumen de la semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {state.asignaciones.filter(a => a.estado === 'CONFIRMADA').length}
              </p>
              <p className="text-sm text-muted-foreground">Confirmadas</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {state.asignaciones.filter(a => a.estado === 'EN_CURSO').length}
              </p>
              <p className="text-sm text-muted-foreground">En curso</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {state.asignaciones.filter(a => a.estado === 'COMPLETADA').length}
              </p>
              <p className="text-sm text-muted-foreground">Completadas</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {state.asignaciones.filter(a => a.estado === 'CONFLICTO').length}
              </p>
              <p className="text-sm text-muted-foreground">Conflictos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}