import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type {
  Departamento,
  Equipo,
  Cargo,
  TipoActividad,
  Cliente,
  Proyecto,
  Recurso,
  Asignacion,
  ConflictInfo,
  PlanningGridResponse,
  ProjectGanttResponse,
  ProyectoWBSResponse,
  Actividad,
  Tarea,
  Subtarea,
  CargaTrabajoResumen,
  OcupacionProyectoResumen,
  CargaEquipoResumen,
  ProximosVencerResponse,
} from '@operaciones-planner/shared';

// ============================================
// DEPARTAMENTOS
// ============================================
export function useDepartamentos() {
  return useQuery({
    queryKey: ['departamentos'],
    queryFn: () => api.get<Departamento[]>('/api/departamentos'),
  });
}

export function useDepartamento(id: string) {
  return useQuery({
    queryKey: ['departamentos', id],
    queryFn: () => api.get<Departamento>(`/api/departamentos/${id}`),
    enabled: !!id,
  });
}

export function useCreateDepartamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Departamento>('/api/departamentos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departamentos'] }),
  });
}

export function useUpdateDepartamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Departamento>(`/api/departamentos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departamentos'] }),
  });
}

export function useDeleteDepartamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/departamentos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departamentos'] }),
  });
}

// ============================================
// EQUIPOS
// ============================================
export function useEquipos(departamentoId?: string) {
  return useQuery({
    queryKey: ['equipos', departamentoId],
    queryFn: () => api.get<Equipo[]>(`/api/equipos${departamentoId ? `?departamentoId=${departamentoId}` : ''}`),
  });
}

export function useCreateEquipo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Equipo>('/api/equipos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipos'] }),
  });
}

export function useUpdateEquipo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Equipo>(`/api/equipos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipos'] }),
  });
}

export function useDeleteEquipo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/equipos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipos'] }),
  });
}

// ============================================
// CARGOS
// ============================================
export function useCargos() {
  return useQuery({
    queryKey: ['cargos'],
    queryFn: () => api.get<Cargo[]>('/api/cargos'),
  });
}

export function useCreateCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Cargo>('/api/cargos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cargos'] }),
  });
}

export function useUpdateCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Cargo>(`/api/cargos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cargos'] }),
  });
}

export function useDeleteCargo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/cargos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cargos'] }),
  });
}

// ============================================
// TIPOS ACTIVIDAD
// ============================================
export function useTiposActividad() {
  return useQuery({
    queryKey: ['tipos-actividad'],
    queryFn: () => api.get<TipoActividad[]>('/api/tipos-actividad'),
  });
}

export function useCreateTipoActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<TipoActividad>('/api/tipos-actividad', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tipos-actividad'] }),
  });
}

export function useUpdateTipoActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<TipoActividad>(`/api/tipos-actividad/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tipos-actividad'] }),
  });
}

export function useDeleteTipoActividad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/tipos-actividad/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tipos-actividad'] }),
  });
}

// ============================================
// CLIENTES
// ============================================
export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get<Cliente[]>('/api/clientes'),
  });
}

export function useCreateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Cliente>('/api/clientes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

export function useUpdateCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Cliente>(`/api/clientes/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

export function useDeleteCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/clientes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  });
}

// ============================================
// PROYECTOS
// ============================================
export function useProyectos(estado?: string) {
  return useQuery({
    queryKey: ['proyectos', estado],
    queryFn: () => api.get<Proyecto[]>(`/api/proyectos${estado ? `?estado=${estado}` : ''}`),
  });
}

export function useCreateProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Proyecto>('/api/proyectos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proyectos'] }),
  });
}

export function useUpdateProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Proyecto>(`/api/proyectos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['proyectos'] }),
  });
}

export function useDeleteProyecto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/proyectos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
      queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      queryClient.invalidateQueries({ queryKey: ['proyecto-wbs'] });
    },
  });
}

// ============================================
// RECURSOS
// ============================================
export function useRecursos(params?: {
  departamentoId?: string;
  equipoId?: string;
  tipo?: string;
  activo?: boolean;
  q?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.departamentoId) searchParams.set('departamentoId', params.departamentoId);
  if (params?.equipoId) searchParams.set('equipoId', params.equipoId);
  if (params?.tipo) searchParams.set('tipo', params.tipo);
  if (params?.activo !== undefined) searchParams.set('activo', String(params.activo));
  if (params?.q) searchParams.set('q', params.q);

  const queryString = searchParams.toString();

  return useQuery({
    queryKey: ['recursos', params],
    queryFn: () => api.get<Recurso[]>(`/api/recursos${queryString ? `?${queryString}` : ''}`),
  });
}

export function useRecurso(id: string) {
  return useQuery({
    queryKey: ['recursos', id],
    queryFn: () => api.get<Recurso>(`/api/recursos/${id}`),
    enabled: !!id,
  });
}

export function useCreateRecurso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Recurso>('/api/recursos', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recursos'] }),
  });
}

export function useUpdateRecurso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Recurso>(`/api/recursos/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recursos'] }),
  });
}

export function useDeleteRecurso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/recursos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recursos'] });
      queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
      queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      queryClient.invalidateQueries({ queryKey: ['proyecto-wbs'] });
    },
  });
}

// ============================================
// ASIGNACIONES
// ============================================
export function useAsignaciones(params?: {
  proyectoId?: string;
  recursoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.proyectoId) searchParams.set('proyectoId', params.proyectoId);
  if (params?.recursoId) searchParams.set('recursoId', params.recursoId);
  if (params?.fechaDesde) searchParams.set('fechaDesde', params.fechaDesde);
  if (params?.fechaHasta) searchParams.set('fechaHasta', params.fechaHasta);
  if (params?.estado) searchParams.set('estado', params.estado);

  const queryString = searchParams.toString();

  return useQuery({
    queryKey: ['asignaciones', params],
    queryFn: () => api.get<{ data: Asignacion[]; pagination: unknown }>(`/api/asignaciones${queryString ? `?${queryString}` : ''}`),
  });
}

export function useCreateAsignacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Asignacion>('/api/asignaciones', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
    },
  });
}

export function useUpdateAsignacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, version }: { id: string; data: Record<string, unknown>; version: number }) =>
      api.put<Asignacion>(`/api/asignaciones/${id}`, { ...data, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
    },
  });
}

export function useMoveAsignacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recursoId, fechaInicio, fechaFin, version }: {
      id: string;
      recursoId?: string;
      fechaInicio?: string;
      fechaFin?: string;
      version: number;
    }) => api.patch<Asignacion>(`/api/asignaciones/${id}/mover`, { recursoId, fechaInicio, fechaFin, version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
    },
  });
}

export function useDeleteAsignacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/asignaciones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['planning-grid'] });
    },
  });
}

// ============================================
// PLANNING GRID
// ============================================
export function usePlanningGrid(params: {
  fechaInicio: string;
  fechaFin: string;
  departamentoId?: string;
  equipoId?: string;
  recursoId?: string;
  proyectoId?: string;
  clienteId?: string;
  tipoActividadId?: string;
  estado?: string;
  areaId?: string;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  return useQuery({
    queryKey: ['planning-grid', params],
    queryFn: () => api.get<PlanningGridResponse>(`/api/planning/grid?${searchParams.toString()}`),
    staleTime: 1000 * 60, // 1 minute
  });
}

// ============================================
// GANTT (vista tipo MS Project — decisión d)
// ============================================
export function useProjectGantt(params: {
  fechaInicio: string;
  fechaFin: string;
  clienteId?: string;
  proyectoId?: string;
}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });

  return useQuery({
    queryKey: ['project-gantt', params],
    queryFn: () => api.get<ProjectGanttResponse>(`/api/planning/gantt?${searchParams.toString()}`),
    staleTime: 1000 * 30,
  });
}

export function useUpdateProyectoAvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, percentComplete, scheduledStart, scheduledEnd }: {
      id: string;
      percentComplete?: number;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
    }) =>
      api.put<Proyecto>(`/api/proyectos/${id}`, {
        ...(percentComplete !== undefined ? { percentComplete } : {}),
        ...(scheduledStart !== undefined ? { scheduledStart } : {}),
        ...(scheduledEnd !== undefined ? { scheduledEnd } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });
}

// ============================================
// WBS: ACTIVIDADES → TAREAS → SUBTAREAS
// ============================================

export function useProyectoWBS(proyectoId: string) {
  return useQuery({
    queryKey: ['proyecto-wbs', proyectoId],
    queryFn: () => api.get<ProyectoWBSResponse>(`/api/actividades/proyecto/${proyectoId}`),
    enabled: !!proyectoId,
  });
}

function invalidateWBS(queryClient: ReturnType<typeof useQueryClient>, proyectoId: string) {
  queryClient.invalidateQueries({ queryKey: ['proyecto-wbs', proyectoId] });
  queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
  queryClient.invalidateQueries({ queryKey: ['proyectos'] });
}

export function useCreateActividad(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Actividad>('/api/actividades', data),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useUpdateActividad(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Actividad>(`/api/actividades/${id}`, data),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useDeleteActividad(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/actividades/${id}`),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useCreateTarea(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actividadId, data }: { actividadId: string; data: Record<string, unknown> }) =>
      api.post<Tarea>(`/api/actividades/${actividadId}/tareas`, data),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useUpdateTarea(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Tarea>(`/api/actividades/tarea/${id}`, data),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useDeleteTarea(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/actividades/tarea/${id}`),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useCreateSubtarea(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tareaId, data }: { tareaId: string; data: Record<string, unknown> }) =>
      api.post<Subtarea>(`/api/actividades/tarea/${tareaId}/subtareas`, data),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useUpdateSubtarea(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put<Subtarea>(`/api/actividades/subtarea/${id}`, data),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

export function useDeleteSubtarea(proyectoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/actividades/subtarea/${id}`),
    onSuccess: () => invalidateWBS(queryClient, proyectoId),
  });
}

// ============================================
// USUARIOS (Admin)
// ============================================
export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get<any[]>('/api/usuarios'),
  });
}

export function useCreateUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; name: string; apellido: string; rol: string; recursoId?: string }) =>
      api.post('/api/usuarios', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useUpdateUsuarioRol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rol }: { id: string; rol: string }) =>
      api.put(`/api/usuarios/${id}/rol`, { rol }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useAsignarRecursoUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, recursoId }: { userId: string; recursoId: string | null }) =>
      api.put(`/api/usuarios/${userId}/recurso`, { recursoId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

// ============================================
// REPORTES
// ============================================

export function useReporteUtilizacion(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte-utilizacion', desde, hasta],
    queryFn: () =>
      api.get<{ periodo: { desde: string; hasta: string }; totalRecursos: number; recursos: CargaTrabajoResumen[] }>(
        `/api/reportes/utilizacion-recursos?desde=${desde}&hasta=${hasta}`
      ),
    enabled: !!desde && !!hasta,
  });
}

export function useReporteOcupacionProyectos(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte-ocupacion', desde, hasta],
    queryFn: () =>
      api.get<{ periodo: { desde: string; hasta: string }; totalProyectos: number; proyectos: OcupacionProyectoResumen[] }>(
        `/api/reportes/ocupacion-proyectos?desde=${desde}&hasta=${hasta}`
      ),
    enabled: !!desde && !!hasta,
  });
}

export function useReporteCargaEquipos(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reporte-equipos', desde, hasta],
    queryFn: () =>
      api.get<{ periodo: { desde: string; hasta: string }; totalEquipos: number; equipos: CargaEquipoResumen[] }>(
        `/api/reportes/carga-equipos?desde=${desde}&hasta=${hasta}`
      ),
    enabled: !!desde && !!hasta,
  });
}

export function useReporteProximosVencer(dias: number) {
  return useQuery({
    queryKey: ['reporte-proximos-vencer', dias],
    queryFn: () => api.get<ProximosVencerResponse>(`/api/reportes/proximos-vencer?dias=${dias}`),
  });
}

// ============================================
// VALIDACIÓN CONFLICTOS
// ============================================
export function useValidarConflicto() {
  return useMutation({
    mutationFn: (data: {
      recursoId: string;
      fechaInicio: string;
      fechaFin: string;
      excluirAsignacionId?: string;
    }) => api.post<{ valido: boolean; conflictos: ConflictInfo[] }>('/api/asignaciones/validar-conflicto', data),
  });
}

// ============================================
// EXPORTACIONES
// ============================================
export function useExportExcel() {
  return useMutation({
    mutationFn: (data: { tipo: string; filtros?: Record<string, unknown>; columnas?: string[] }) =>
      api.post<{ downloadUrl: string }>('/api/export/excel', data),
  });
}
