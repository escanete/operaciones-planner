import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';
import type {
  PlanningGridResponse,
  RecursoGridItem,
  AsignacionGridItem,
  ProjectGanttResponse,
  GanttTaskItem,
} from '@operaciones-planner/shared';

const planningRoutes = new Hono();

// ============================================
// HELPERS DE ROLES (decisiones a y b)
// ============================================

/**
 * Resuelve el alcance de departamento del usuario actual:
 * - SUPER_ADMIN: ve todos los departamentos (null)
 * - ADMIN_DEPTO: ve solo su departamento (vía recurso vinculado o departmentId)
 * - Otros roles: ve todo (los permisos de edición se aplican en cada endpoint)
 */
async function resolveDepartmentScope(c: import('hono').Context): Promise<string | null> {
  let user: { rol: string; recursoId?: string | null; departmentId?: string | null };
  try {
    user = getUser(c) as unknown as typeof user;
  } catch {
    return null;
  }
  if (!user || user.rol !== 'ADMIN_DEPTO') return null;

  // Prioridad 1: departamento explícito del usuario (decisión b)
  if (user.departmentId) return user.departmentId;

  // Prioridad 2: departamento del recurso vinculado
  if (user.recursoId) {
    const recurso = await prisma.recurso.findUnique({
      where: { id: user.recursoId },
      select: { departamentoId: true },
    });
    if (recurso) return recurso.departamentoId;
  }
  return null;
}

planningRoutes.get('/grid', async (c) => {
  try {
    const query = c.req.query();
    
    const params = {
      fechaInicio: query.fechaInicio,
      fechaFin: query.fechaFin,
      departamentoId: query.departamentoId,
      equipoId: query.equipoId,
      recursoId: query.recursoId,
    };

    if (!params.fechaInicio || !params.fechaFin) {
      return c.json({ error: 'Parámetros fechaInicio y fechaFin son requeridos' }, 400);
    }

    const fechaInicio = new Date(params.fechaInicio + 'T00:00:00');
    const fechaFin = new Date(params.fechaFin + 'T23:59:59');

    const whereRecurso: Record<string, unknown> = { activo: true };
    // Scope por rol: ADMIN_DEPTO solo ve recursos de su departamento (decisión b)
    const scopeDeptId = await resolveDepartmentScope(c);
    if (scopeDeptId) whereRecurso.departamentoId = scopeDeptId;
    // Filtros multi-selección: los ids llegan separados por comas ("id1,id2")
    if (params.departamentoId) whereRecurso.departamentoId = { in: params.departamentoId.split(',') };
    if (params.equipoId) whereRecurso.equipoId = { in: params.equipoId.split(',') };
    if (params.recursoId) whereRecurso.id = { in: params.recursoId.split(',') };
    if (query.areaId) whereRecurso.areaId = query.areaId;

    const recursos = await prisma.recurso.findMany({
      where: whereRecurso,
      include: {
        departamento: { select: { nombre: true, color: true } },
        equipo: { select: { nombre: true } },
        cargo: { select: { nombre: true } },
        disponibilidades: { where: { activa: true } },
      },
      orderBy: [
        { departamento: { orden: 'asc' } },
        { equipo: { orden: 'asc' } },
        { nombre: 'asc' },
      ],
    });

    // Orden del panel de recursos (decisión UX): dentro de cada departamento,
    // 1) recursos CON equipo (por orden del equipo), 2) personas sin equipo,
    // 3) vehículos y otros equipos técnicos al final.
    // (SQLite ordena los NULL primero en ASC, lo que dejaba los "Sin Equipo" arriba)
    const TIPO_ORDEN: Record<string, number> = {
      PERSONA: 0,
      EQUIPO_TECNICO: 1,
      HERRAMIENTA: 2,
      VEHICULO: 3,
      OTRO: 4,
    };
    const recursosOrdenados = [...recursos].sort((a, b) => {
      const equipoA = a.equipoId ? 0 : 1;
      const equipoB = b.equipoId ? 0 : 1;
      if (equipoA !== equipoB) return equipoA - equipoB;
      const tipoA = TIPO_ORDEN[a.tipo] ?? 9;
      const tipoB = TIPO_ORDEN[b.tipo] ?? 9;
      if (tipoA !== tipoB) return tipoA - tipoB;
      return 0; // estable: conserva depto → equipo.orden → nombre
    });

    const whereAsignacion: Record<string, unknown> = {
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
      estado: { not: 'CANCELADA' },
    };
    if (query.proyectoId) whereAsignacion.proyectoId = { in: query.proyectoId.split(',') };
    if (query.tipoActividadId) whereAsignacion.tipoActividadId = { in: query.tipoActividadId.split(',') };
    if (query.estado) whereAsignacion.estado = query.estado;

    if (query.clienteId) {
      whereAsignacion.proyecto = { clienteId: query.clienteId };
    }

    const asignaciones = await prisma.asignacion.findMany({
      where: whereAsignacion,
      include: {
        proyecto: { select: { id: true, nombre: true, color: true } },
        tipoActividad: { select: { nombre: true, color: true } },
      },
    });

    const recursosGrid: RecursoGridItem[] = recursosOrdenados.map((r) => {
      const diasPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Si no tiene disponibilidad configurada, asumir jornada estándar 8h x 5 días hábiles
      const horasDisponiblesSemana = r.disponibilidades.length > 0
        ? r.disponibilidades.reduce((acc, d) => {
            const inicio = d.horaInicio.split(':').map(Number);
            const fin = d.horaFin.split(':').map(Number);
            return acc + (fin[0] - inicio[0] + (fin[1] - inicio[1]) / 60);
          }, 0)
        : 40; // 8h x 5 días hábiles por defecto

      const horasDisponibles = horasDisponiblesSemana * Math.ceil(diasPeriodo / 7);

      // Contar solo las horas DENTRO del rango visible
      const horasAsignadas = asignaciones
        .filter((a) => a.recursoId === r.id)
        .reduce((acc, a) => {
          const start = a.fechaInicio > fechaInicio ? a.fechaInicio : fechaInicio;
          const end = a.fechaFin < fechaFin ? a.fechaFin : fechaFin;
          const dias = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          let horasPorDia: number;
          if (a.todoDia) {
            horasPorDia = 8;
          } else if (a.horaInicio && a.horaFin) {
            const [h1, m1] = a.horaInicio.split(':').map(Number);
            const [h2, m2] = a.horaFin.split(':').map(Number);
            horasPorDia = Math.max(0, h2 - h1 + (m2 - m1) / 60);
          } else {
            horasPorDia = 4;
          }
          return acc + dias * horasPorDia;
        }, 0);

      const porcentajeOcupacion = horasDisponibles > 0 ? Math.round((horasAsignadas / horasDisponibles) * 100) : 0;

      let alerta: RecursoGridItem['disponibilidad']['alerta'] = 'NORMAL';
      if (porcentajeOcupacion >= 120) alerta = 'SOBRECARGA';
      else if (porcentajeOcupacion >= 100) alerta = 'SOBRECARGA';
      else if (porcentajeOcupacion >= 80) alerta = 'ALERTA_80';
      else if (porcentajeOcupacion === 0) alerta = 'SIN_ASIGNAR';

      return {
        id: r.id,
        nombre: r.nombre,
        apellido: r.apellido ?? undefined,
        tipo: r.tipo as RecursoGridItem['tipo'],
        cargoNombre: r.cargo?.nombre,
        equipoNombre: r.equipo?.nombre,
        departamentoNombre: r.departamento.nombre,
        colorCalendario: r.colorCalendario ?? undefined,
        roleLevel: r.roleLevel ?? 0,
        areaId: r.areaId ?? undefined,
        disponibilidad: {
          porcentajeOcupacion,
          horasAsignadas: Math.round(horasAsignadas * 10) / 10,
          horasDisponibles: Math.round(horasDisponibles * 10) / 10,
          alerta,
        },
      };
    });

    const asignacionesGrid: AsignacionGridItem[] = asignaciones.map((a) => ({
      id: a.id,
      recursoId: a.recursoId,
      proyectoId: a.proyectoId,
      proyectoNombre: a.proyecto.nombre,
      proyectoColor: a.proyecto.color ?? undefined,
      tipoActividadNombre: a.tipoActividad.nombre,
      tipoActividadColor: a.tipoActividad.color,
      nombre: a.nombre ?? undefined,
      actividadId: a.actividadId ?? undefined,
      tareaId: a.tareaId ?? undefined,
      subtareaId: a.subtareaId ?? undefined,
      fechaInicio: a.fechaInicio.toISOString().split('T')[0],
      fechaFin: a.fechaFin.toISOString().split('T')[0],
      horaInicio: a.horaInicio ?? undefined,
      horaFin: a.horaFin ?? undefined,
      todoDia: a.todoDia,
      estado: a.estado as AsignacionGridItem['estado'],
      version: a.version,
    }));

    const response: PlanningGridResponse = {
      recursos: recursosGrid,
      asignaciones: asignacionesGrid,
      metadata: {
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        totalRecursos: recursosGrid.length,
        totalAsignaciones: asignacionesGrid.length,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('Error in planning/grid:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

planningRoutes.get('/disponibilidad', async (c) => {
  try {
    const query = c.req.query();
    
    const fechaInicio = new Date((query.fechaInicio ?? '') + 'T00:00:00');
    const fechaFin = new Date((query.fechaFin ?? '') + 'T23:59:59');

    if (!query.fechaInicio || !query.fechaFin) {
      return c.json({ error: 'Parámetros fechaInicio y fechaFin son requeridos' }, 400);
    }

    const whereRecurso: Record<string, unknown> = { activo: true };
    if (query.departamentoId) whereRecurso.departamentoId = query.departamentoId;
    if (query.equipoId) whereRecurso.equipoId = query.equipoId;
    if (query.recursoId) whereRecurso.id = query.recursoId;

    const recursos = await prisma.recurso.findMany({
      where: whereRecurso,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        disponibilidades: { where: { activa: true } },
        asignaciones: {
          where: {
            fechaInicio: { lte: fechaFin },
            fechaFin: { gte: fechaInicio },
            estado: { not: 'CANCELADA' },
          },
          select: {
            id: true,
            fechaInicio: true,
            fechaFin: true,
            horaInicio: true,
            horaFin: true,
            todoDia: true,
          },
        },
      },
    });

    const disponibilidadData = recursos.map((r) => {
      // Jornada por defecto si no hay disponibilidad configurada
      const horasDisponiblesPorDia = r.disponibilidades.length > 0
        ? r.disponibilidades.reduce((acc, d) => {
            const inicio = d.horaInicio.split(':').map(Number);
            const fin = d.horaFin.split(':').map(Number);
            return acc + (fin[0] - inicio[0] + (fin[1] - inicio[1]) / 60);
          }, 0)
        : 8;

      const diasPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const horasDisponiblesTotal = horasDisponiblesPorDia * Math.ceil(diasPeriodo / 7);

      const horasAsignadas = r.asignaciones.reduce((acc, a) => {
        const start = a.fechaInicio > fechaInicio ? a.fechaInicio : fechaInicio;
        const end = a.fechaFin < fechaFin ? a.fechaFin : fechaFin;
        const dias = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return acc + dias * (a.todoDia ? 8 : 4);
      }, 0);

      return {
        recursoId: r.id,
        nombre: r.apellido ? `${r.nombre} ${r.apellido}` : r.nombre,
        horasDisponibles: Math.round(horasDisponiblesTotal * 10) / 10,
        horasAsignadas: Math.round(horasAsignadas * 10) / 10,
        porcentajeOcupacion: horasDisponiblesTotal > 0 ? Math.round((horasAsignadas / horasDisponiblesTotal) * 100) : 0,
      };
    });

    return c.json({
      periodo: { desde: query.fechaInicio, hasta: query.fechaFin },
      recursos: disponibilidadData,
    });
  } catch (error) {
    console.error('Error in planning/disponibilidad:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// GANTT — Vista tipo MS Project (decisión d)
// ============================================

function parseDependencies(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((d) => typeof d === 'string');
    return [];
  } catch {
    return [];
  }
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

planningRoutes.get('/gantt', async (c) => {
  try {
    const query = c.req.query();

    if (!query.fechaInicio || !query.fechaFin) {
      return c.json({ error: 'Parámetros fechaInicio y fechaFin son requeridos' }, 400);
    }

    const fechaInicio = new Date(query.fechaInicio + 'T00:00:00');
    const fechaFin = new Date(query.fechaFin + 'T23:59:59');

    const whereProyecto: Record<string, unknown> = { activo: true };
    // Multi-selección del panel de filtros: "id1,id2" (compatible con un solo id)
    if (query.proyectoId) whereProyecto.id = { in: query.proyectoId.split(',') };
    if (query.clienteId) whereProyecto.clienteId = query.clienteId;

    // Filtro por recurso (panel de filtros): aplica a las asignaciones del Gantt.
    // La estructura WBS (proyecto → actividad → tarea) se mantiene; solo se
    // ocultan las asignaciones (hojas) de otros recursos.
    const whereAsignacionGantt: Record<string, unknown> = {
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
      estado: { not: 'CANCELADA' },
    };
    if (query.recursoId) whereAsignacionGantt.recursoId = { in: query.recursoId.split(',') };

    const proyectos = await prisma.proyecto.findMany({
      where: whereProyecto,
      include: {
        cliente: { select: { nombre: true } },
        subproyectos: { select: { id: true } },
        asignaciones: {
          where: whereAsignacionGantt,
          include: {
            recurso: { select: { nombre: true, apellido: true } },
            tipoActividad: { select: { nombre: true, color: true } },
            subtarea: { select: { tareaId: true } },
          },
          orderBy: { fechaInicio: 'asc' },
        },
      },
      orderBy: [{ subprojectId: 'asc' }, { nombre: 'asc' }],
    });

    const totalAsignaciones = proyectos.reduce((acc, p) => acc + p.asignaciones.length, 0);

    // ===== Jerarquía WBS: actividades y tareas por proyecto (decisión Gantt+WBS) =====
    const proyectoIds = proyectos.map((p) => p.id);
    const actividades = proyectoIds.length
      ? await prisma.actividad.findMany({
          where: { proyectoId: { in: proyectoIds } },
          include: {
            tareas: {
              orderBy: { orden: 'asc' },
              include: {
                asignados: {
                  include: { recurso: { select: { nombre: true, apellido: true } } },
                },
              },
            },
          },
          orderBy: { orden: 'asc' },
        })
      : [];

    // ===== Construir tareas (proyecto con roll-up de asignaciones) =====
    const projectTasks = new Map<string, GanttTaskItem>();
    const assignmentTasks: GanttTaskItem[] = [];

    proyectos.forEach((p) => {
      const asignaciones = p.asignaciones;

      // Roll-up: scheduledStart/End explícitos > min/max asignaciones > fechaInicio/Fin
      let start = p.scheduledStart;
      let end = p.scheduledEnd;
      if ((!start || !end) && asignaciones.length > 0) {
        const minAsig = asignaciones.reduce(
          (min, a) => (a.fechaInicio < min ? a.fechaInicio : min),
          asignaciones[0].fechaInicio
        );
        const maxAsig = asignaciones.reduce(
          (max, a) => (a.fechaFin > max ? a.fechaFin : max),
          asignaciones[0].fechaFin
        );
        if (!start) start = minAsig;
        if (!end) end = maxAsig;
      }
      if (!start) start = p.fechaInicio ?? fechaInicio;
      if (!end) end = p.fechaFin ?? fechaFin;
      if (end < start) end = start;

      // Avance: explícito > promedio por estado de asignaciones
      let percent = p.percentComplete ?? null;
      if (percent === null) {
        if (asignaciones.length > 0) {
          const sum = asignaciones.reduce((acc, a) => {
            if (a.estado === 'COMPLETADA') return acc + 100;
            if (a.estado === 'EN_CURSO') return acc + 50;
            return acc;
          }, 0);
          percent = Math.round(sum / asignaciones.length);
        } else {
          percent = p.estado === 'FINALIZADO' ? 100 : 0;
        }
      }

      projectTasks.set(p.id, {
        id: p.id,
        tipo: 'PROYECTO',
        proyectoId: p.id,
        nombre: p.nombre,
        fechaInicio: toISODate(start),
        fechaFin: toISODate(end),
        percentComplete: percent,
        color: p.color ?? undefined,
        parentId: p.subprojectId ?? undefined,
        dependencies: parseDependencies(p.dependencies),
        // Roll-up de recursos asignados (únicos, unidos por coma)
        recursos:
          [...new Set(asignaciones.map((a) => (a.recurso.apellido ? `${a.recurso.nombre} ${a.recurso.apellido}` : a.recurso.nombre)))].join(', ') ||
          undefined,
        notas: p.descripcion ?? undefined,
        estado: p.estado as GanttTaskItem['estado'],
        esCritica: p.relevante, // marcación manual de relevancia (ya no se calcula ruta crítica)
      });

      // Filas hijas: una por asignación (colgada de su nodo WBS vinculado)
      asignaciones.forEach((a) => {
        const visInicio = a.fechaInicio < fechaInicio ? fechaInicio : a.fechaInicio;
        const visFin = a.fechaFin > fechaFin ? fechaFin : a.fechaFin;
        // Nodo padre efectivo: tarea > tarea de la subtarea > actividad > proyecto
        const parentId = a.tareaId ?? a.subtarea?.tareaId ?? a.actividadId ?? p.id;
        assignmentTasks.push({
          id: `asig-${a.id}`,
          tipo: 'ASIGNACION',
          proyectoId: p.id,
          nombre: a.nombre ?? a.tipoActividad.nombre,
          fechaInicio: toISODate(visInicio),
          fechaFin: toISODate(visFin),
          percentComplete:
            a.estado === 'COMPLETADA' ? 100 : a.estado === 'EN_CURSO' ? 50 : 0,
          color: a.tipoActividad.color,
          parentId,
          dependencies: [],
          recursos: a.recurso.apellido
            ? `${a.recurso.nombre} ${a.recurso.apellido}`
            : a.recurso.nombre,
          notas: a.notas ?? undefined,
          estado: a.estado as GanttTaskItem['estado'],
          esCritica: false,
        });
      });
    });

    // ===== Tareas del WBS (actividades → tareas) con % real del roll-up =====
    const actTaskById = new Map<string, GanttTaskItem>();
    const wbsTareasPorActividad = new Map<string, GanttTaskItem[]>();
    const actividadesPorProyecto = new Map<string, typeof actividades>();

    actividades.forEach((a) => {
      const lista = actividadesPorProyecto.get(a.proyectoId) ?? [];
      lista.push(a);
      actividadesPorProyecto.set(a.proyectoId, lista);
    });

    actividadesPorProyecto.forEach((acts, pid) => {
      const pTask = projectTasks.get(pid);
      if (!pTask) return;
      const pStart = new Date(pTask.fechaInicio + 'T00:00:00');
      const pEnd = new Date(pTask.fechaFin + 'T00:00:00');

      acts.forEach((a) => {
        const aTareas = a.tareas;
        const aStart = a.fechaInicio ?? (aTareas[0]?.fechaInicio ?? pStart);
        const aEnd = a.fechaFin ?? (aTareas[aTareas.length - 1]?.fechaFin ?? pEnd);

        const actTask: GanttTaskItem = {
          id: a.id,
          tipo: 'ACTIVIDAD',
          proyectoId: pid,
          nombre: a.nombre,
          fechaInicio: toISODate(aStart),
          fechaFin: toISODate(aEnd),
          percentComplete: Math.round(a.percentComplete),
          color: pTask.color ?? undefined,
          parentId: pid,
          dependencies: [],
          notas: a.descripcion ?? undefined,
          estado: undefined,
          esCritica: a.relevante,
        };
        actTaskById.set(a.id, actTask);

        const tareasDelGantt: GanttTaskItem[] = aTareas.map((t) => ({
          id: t.id,
          tipo: 'TAREA' as const,
          proyectoId: pid,
          nombre: t.nombre,
          fechaInicio: toISODate(t.fechaInicio ?? aStart),
          fechaFin: toISODate(t.fechaFin ?? aEnd),
          percentComplete: Math.round(t.percentComplete),
          color: undefined,
          parentId: a.id,
          dependencies: [],
          recursos:
            [...new Set(t.asignados.map((ta) => (ta.recurso.apellido ? `${ta.recurso.nombre} ${ta.recurso.apellido}` : ta.recurso.nombre)))].join(', ') ||
            undefined,
          notas: t.descripcion ?? undefined,
          estado: undefined,
          esCritica: t.relevante,
        }));
        wbsTareasPorActividad.set(a.id, tareasDelGantt);
      });
    });

    // (La ruta crítica automática se eliminó: ahora la relevancia se marca
    // manualmente con el campo `relevante` en proyecto/actividad/tarea/subtarea)

    // ===== Ordenar: proyecto → actividades → tareas → asignaciones → subproyectos =====
    const ordered: GanttTaskItem[] = [];
    const emitProject = (id: string, depth = 0) => {
      if (depth > 10) return; // protección contra ciclos
      const task = projectTasks.get(id);
      if (!task || (ordered as GanttTaskItem[]).includes(task)) return;
      ordered.push(task);

      // Jerarquía WBS: actividades → tareas (con sus asignaciones vinculadas)
      (actividadesPorProyecto.get(id) ?? []).forEach((a) => {
        const actTask = actTaskById.get(a.id);
        if (actTask) ordered.push(actTask);
        (wbsTareasPorActividad.get(a.id) ?? []).forEach((t) => {
          ordered.push(t);
          // Asignaciones vinculadas a esta tarea (o a subtareas de ella)
          assignmentTasks
            .filter((as) => as.parentId === t.id)
            .forEach((as) => ordered.push(as));
        });
        // Asignaciones vinculadas directo a la actividad
        assignmentTasks
          .filter((as) => as.parentId === a.id)
          .forEach((as) => ordered.push(as));
      });

      // Asignaciones a nivel de proyecto (sin vínculo WBS)
      assignmentTasks
        .filter((a) => a.parentId === id)
        .forEach((a) => ordered.push(a));

      // Subproyectos
      proyectos
        .filter((p) => p.subprojectId === id)
        .forEach((child) => emitProject(child.id, depth + 1));
    };
    // Raíces primero (proyectos sin padre)
    proyectos.filter((p) => !p.subprojectId).forEach((p) => emitProject(p.id));
    // Huérfanos por seguridad (padre fuera del resultado)
    proyectos
      .filter((p) => p.subprojectId && !projectTasks.has(p.subprojectId))
      .forEach((p) => emitProject(p.id));

    const response: ProjectGanttResponse = {
      tareas: ordered,
      metadata: {
        fechaInicio: query.fechaInicio,
        fechaFin: query.fechaFin,
        totalProyectos: projectTasks.size,
        totalAsignaciones,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('Error in planning/gantt:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { planningRoutes };
