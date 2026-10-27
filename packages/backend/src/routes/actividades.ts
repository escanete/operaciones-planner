import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';
import type { ProyectoWBSResponse, Actividad, Tarea, Subtarea, TareaAsignado, AsignacionResumen } from '@operaciones-planner/shared';

const actividadesRoutes = new Hono();

// ============================================
// PERMISOS POR ROL (jerarquía WBS)
// - ROLES_FULL: gestionan todo, incl. crear/editar proyectos
// - ROLES_WBS: gestionan actividades/tareas/subtareas (no proyectos)
// - OPERADOR: solo subtareas de tareas donde está asignado
// - VISTA_SOLO: solo lectura
// ============================================

const ROLES_FULL = ['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL'];
const ROLES_WBS = [...ROLES_FULL, 'JEFE_AREA'];

function canManageProyecto(rol: string): boolean {
  return ROLES_FULL.includes(rol);
}

function canManageWBS(rol: string): boolean {
  return ROLES_WBS.includes(rol);
}

/** Un recurso puede escribir subtareas de una tarea si es responsable de ella */
async function puedeEscribirSubtarea(
  rol: string,
  recursoId: string | null,
  tareaId: string
): Promise<boolean> {
  if (canManageWBS(rol)) return true;
  if (rol !== 'OPERADOR' || !recursoId) return false;
  const asignado = await prisma.tareaAsignado.findUnique({
    where: { tareaId_recursoId: { tareaId, recursoId } },
  });
  return !!asignado;
}

// ============================================
// ROLL-UP DE AVANCE (hijo → padre → proyecto)
// ============================================

async function recalcFromTarea(tareaId: string): Promise<void> {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: { subtareas: true },
  });
  if (!tarea) return;

  const percent =
    tarea.subtareas.length > 0
      ? Math.round(
          tarea.subtareas.reduce((acc, s) => acc + (s.completada ? 100 : 0), 0) /
            tarea.subtareas.length
        )
      : tarea.completada
      ? 100
      : 0;

  await prisma.tarea.update({
    where: { id: tareaId },
    data: { percentComplete: percent, completada: percent === 100 },
  });

  await recalcFromActividad(tarea.actividadId);
}

async function recalcFromActividad(actividadId: string): Promise<void> {
  const actividad = await prisma.actividad.findUnique({
    where: { id: actividadId },
    include: { tareas: true },
  });
  if (!actividad) return;

  // Actividad con tareas: promedio. Sin tareas: sin avance propio (0).
  const percent =
    actividad.tareas.length > 0
      ? Math.round(
          actividad.tareas.reduce((acc, t) => acc + t.percentComplete, 0) /
            actividad.tareas.length
        )
      : 0;

  await prisma.actividad.update({
    where: { id: actividadId },
    data: { percentComplete: percent },
  });

  await recalcFromProyecto(actividad.proyectoId);
}

async function recalcFromProyecto(proyectoId: string): Promise<void> {
  const actividades = await prisma.actividad.findMany({
    where: { proyectoId },
    select: { percentComplete: true },
  });

  // Solo sobrescribe el % del proyecto si tiene actividades; si no, respeta el manual
  if (actividades.length === 0) return;

  const percent = Math.round(
    actividades.reduce((acc, a) => acc + a.percentComplete, 0) / actividades.length
  );

  await prisma.proyecto.update({
    where: { id: proyectoId },
    data: { percentComplete: percent },
  });
}

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

const actividadSchema = z.object({
  proyectoId: z.string().min(1),
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional().nullable(),
  orden: z.number().int().default(0),
  fechaInicio: z.string().optional().nullable(),
  fechaFin: z.string().optional().nullable(),
  relevante: z.boolean().optional().default(false),
  etiquetaIds: z.array(z.string()).optional().default([]),
});

const tareaSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional().nullable(),
  orden: z.number().int().default(0),
  fechaInicio: z.string().optional().nullable(),
  fechaFin: z.string().optional().nullable(),
  relevante: z.boolean().optional().default(false),
  asignados: z.array(z.string()).optional().default([]), // recursoIds
  etiquetaIds: z.array(z.string()).optional().default([]),
});

const tareaUpdateSchema = tareaSchema.partial().extend({
  completada: z.boolean().optional(),
});

const subtareaSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional().nullable(),
  orden: z.number().int().default(0),
  completada: z.boolean().optional().default(false),
  relevante: z.boolean().optional().default(false),
  etiquetaIds: z.array(z.string()).optional().default([]),
});

function toNullableDate(s: string | null | undefined): Date | null {
  return s ? new Date(s) : null;
}

// Sincroniza las etiquetas de un nodo WBS (reemplazo completo)
type NodoEtiquetado = 'actividad' | 'tarea' | 'subtarea';

async function setEtiquetasWBS(
  tipo: NodoEtiquetado,
  id: string,
  etiquetaIds: string[]
): Promise<void> {
  // Validar que las etiquetas existan (ignora ids borrados a mitad de edición)
  const unicos = [...new Set(etiquetaIds)];
  const validas =
    unicos.length > 0
      ? await prisma.etiqueta.findMany({ where: { id: { in: unicos } }, select: { id: true } })
      : [];
  const idsValidos = validas.map((e) => e.id);

  if (tipo === 'actividad') {
    await prisma.actividadEtiqueta.deleteMany({ where: { actividadId: id } });
    if (idsValidos.length > 0) {
      await prisma.actividadEtiqueta.createMany({
        data: idsValidos.map((etiquetaId) => ({ actividadId: id, etiquetaId })),
      });
    }
  } else if (tipo === 'tarea') {
    await prisma.tareaEtiqueta.deleteMany({ where: { tareaId: id } });
    if (idsValidos.length > 0) {
      await prisma.tareaEtiqueta.createMany({
        data: idsValidos.map((etiquetaId) => ({ tareaId: id, etiquetaId })),
      });
    }
  } else {
    await prisma.subtareaEtiqueta.deleteMany({ where: { subtareaId: id } });
    if (idsValidos.length > 0) {
      await prisma.subtareaEtiqueta.createMany({
        data: idsValidos.map((etiquetaId) => ({ subtareaId: id, etiquetaId })),
      });
    }
  }
}

// ============================================
// ÁRBOL COMPLETO DEL PROYECTO (WBS)
// ============================================

actividadesRoutes.get('/proyecto/:proyectoId', async (c) => {
  const { proyectoId } = c.req.param();

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: {
      id: true,
      nombre: true,
      estado: true,
      percentComplete: true,
      relevante: true,
      // Fechas para la vista Gantt del proyecto (scheduled > fechaInicio/Fin)
      fechaInicio: true,
      fechaFin: true,
      scheduledStart: true,
      scheduledEnd: true,
      etiquetas: { include: { etiqueta: true } },
    },
  });
  if (!proyecto) return c.json({ error: 'Proyecto no encontrado' }, 404);

  const [actividades, asignacionesRaw] = await Promise.all([
    prisma.actividad.findMany({
      where: { proyectoId },
      include: {
        etiquetas: { include: { etiqueta: true } },
        tareas: {
          include: {
            etiquetas: { include: { etiqueta: true } },
            subtareas: {
              orderBy: { orden: 'asc' },
              include: { etiquetas: { include: { etiqueta: true } } },
            },
            asignados: {
              include: { recurso: { select: { id: true, nombre: true, apellido: true } } },
            },
          },
          orderBy: { orden: 'asc' },
        },
      },
      orderBy: { orden: 'asc' },
    }),
    // Asignaciones de planificación del proyecto (se muestran en el árbol WBS
    // según su vínculo: actividad / tarea / subtarea / nivel proyecto)
    prisma.asignacion.findMany({
      where: { proyectoId, estado: { not: 'CANCELADA' } },
      include: {
        recurso: { select: { nombre: true, apellido: true } },
        tipoActividad: { select: { nombre: true } },
      },
      orderBy: { fechaInicio: 'asc' },
    }),
  ]);

  const toResumen = (a: (typeof asignacionesRaw)[number]): AsignacionResumen => ({
    id: a.id,
    nombre: a.nombre ?? undefined,
    recursoId: a.recursoId,
    recursoNombre: a.recurso.apellido
      ? `${a.recurso.nombre} ${a.recurso.apellido}`
      : a.recurso.nombre,
    tipoActividadNombre: a.tipoActividad.nombre,
    fechaInicio: a.fechaInicio,
    fechaFin: a.fechaFin,
    estado: a.estado as AsignacionResumen['estado'],
  });

  const porActividad = new Map<string, ReturnType<typeof toResumen>[]>();
  const porTarea = new Map<string, ReturnType<typeof toResumen>[]>();
  const porSubtarea = new Map<string, ReturnType<typeof toResumen>[]>();
  const aNivelProyecto: ReturnType<typeof toResumen>[] = [];

  for (const a of asignacionesRaw) {
    const r = toResumen(a);
    if (a.subtareaId) {
      porSubtarea.set(a.subtareaId, [...(porSubtarea.get(a.subtareaId) ?? []), r]);
    } else if (a.tareaId) {
      porTarea.set(a.tareaId, [...(porTarea.get(a.tareaId) ?? []), r]);
    } else if (a.actividadId) {
      porActividad.set(a.actividadId, [...(porActividad.get(a.actividadId) ?? []), r]);
    } else {
      aNivelProyecto.push(r);
    }
  }

  // Aplanar uniones de etiquetas al shape compartido EtiquetaRef
  const toEtiquetaRefs = (
    links: Array<{ etiqueta: { id: string; nombre: string; color: string } }>
  ) => links.map((l) => ({ id: l.etiqueta.id, nombre: l.etiqueta.nombre, color: l.etiqueta.color }));

  const actividadesOut = actividades.map((a) => ({
    ...a,
    etiquetas: toEtiquetaRefs(a.etiquetas),
    asignaciones: porActividad.get(a.id) ?? [],
    tareas: a.tareas.map((t) => ({
      ...t,
      etiquetas: toEtiquetaRefs(t.etiquetas),
      asignaciones: porTarea.get(t.id) ?? [],
      // Aplanar asignados al shape del tipo compartido TareaAsignado
      asignados: (t.asignados ?? []).map((ta) => ({
        id: ta.id,
        recursoId: ta.recursoId,
        nombre: ta.recurso.nombre,
        apellido: ta.recurso.apellido,
      })),
      subtareas: t.subtareas.map((s) => ({
        ...s,
        etiquetas: toEtiquetaRefs(s.etiquetas),
        asignaciones: porSubtarea.get(s.id) ?? [],
      })),
    })),
  }));

  const totalTareas = actividades.reduce((acc, a) => acc + a.tareas.length, 0);
  const totalSubtareas = actividades.reduce(
    (acc, a) => acc + a.tareas.reduce((s, t) => s + t.subtareas.length, 0),
    0
  );

  const response: ProyectoWBSResponse = {
    proyecto: {
      ...proyecto,
      estado: proyecto.estado as ProyectoWBSResponse['proyecto']['estado'],
      percentComplete: proyecto.percentComplete ?? 0,
      // Prisma devuelve null en los opcionales; el tipo compartido usa undefined
      fechaInicio: proyecto.fechaInicio ?? undefined,
      fechaFin: proyecto.fechaFin ?? undefined,
      scheduledStart: proyecto.scheduledStart ?? undefined,
      scheduledEnd: proyecto.scheduledEnd ?? undefined,
      etiquetas: toEtiquetaRefs(proyecto.etiquetas),
    },
    actividades: actividadesOut as unknown as Actividad[],
    asignaciones: aNivelProyecto,
    metadata: {
      totalActividades: actividades.length,
      totalTareas,
      totalSubtareas,
      totalAsignaciones: asignacionesRaw.length,
    },
  };

  return c.json(response);
});

// ============================================
// ACTIVIDADES
// ============================================

actividadesRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (!canManageWBS(user.rol)) {
    return c.json({ error: 'No autorizado para crear actividades' }, 403);
  }

  const body = await c.req.json();
  const data = actividadSchema.parse(body);

  const total = await prisma.actividad.count({ where: { proyectoId: data.proyectoId } });

  const actividad = await prisma.actividad.create({
    data: {
      proyectoId: data.proyectoId,
      nombre: data.nombre,
      descripcion: data.descripcion ?? undefined,
      orden: data.orden ?? total,
      fechaInicio: toNullableDate(data.fechaInicio),
      fechaFin: toNullableDate(data.fechaFin),
    },
  });

  if (data.etiquetaIds.length > 0) {
    await setEtiquetasWBS('actividad', actividad.id, data.etiquetaIds);
  }

  await recalcFromProyecto(data.proyectoId);
  return c.json(actividad, 201);
});

actividadesRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (!canManageWBS(user.rol)) {
    return c.json({ error: 'No autorizado para editar actividades' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const data = actividadSchema.partial().omit({ proyectoId: true }).parse(body);

  const actividad = await prisma.actividad.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion ?? undefined } : {}),
      ...(data.orden !== undefined ? { orden: data.orden } : {}),
      ...(data.fechaInicio !== undefined ? { fechaInicio: toNullableDate(data.fechaInicio) } : {}),
      ...(data.fechaFin !== undefined ? { fechaFin: toNullableDate(data.fechaFin) } : {}),
      ...(data.relevante !== undefined ? { relevante: data.relevante } : {}),
    },
  });

  if (data.etiquetaIds !== undefined) {
    await setEtiquetasWBS('actividad', id, data.etiquetaIds);
  }

  await recalcFromActividad(id);
  return c.json(actividad);
});

actividadesRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (!canManageWBS(user.rol)) {
    return c.json({ error: 'No autorizado para eliminar actividades' }, 403);
  }

  const { id } = c.req.param();
  const actividad = await prisma.actividad.delete({ where: { id } });
  await recalcFromProyecto(actividad.proyectoId);

  return c.json({ success: true });
});

// ============================================
// TAREAS
// ============================================

async function setAsignados(tareaId: string, recursoIds: string[]): Promise<void> {
  await prisma.tareaAsignado.deleteMany({ where: { tareaId } });
  const unicos = [...new Set(recursoIds)];
  if (unicos.length > 0) {
    await prisma.tareaAsignado.createMany({
      data: unicos.map((recursoId) => ({ tareaId, recursoId })),
    });
  }
}

actividadesRoutes.post('/:id/tareas', async (c) => {
  const user = getUser(c);
  if (!canManageWBS(user.rol)) {
    return c.json({ error: 'No autorizado para crear tareas' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const data = tareaSchema.parse(body);

  const total = await prisma.tarea.count({ where: { actividadId: id } });

  const tarea = await prisma.tarea.create({
    data: {
      actividadId: id,
      nombre: data.nombre,
      descripcion: data.descripcion ?? undefined,
      orden: data.orden ?? total,
      fechaInicio: toNullableDate(data.fechaInicio),
      fechaFin: toNullableDate(data.fechaFin),
    },
    include: { asignados: { include: { recurso: { select: { id: true, nombre: true, apellido: true } } } } },
  });

  if (data.asignados.length > 0) {
    await setAsignados(tarea.id, data.asignados);
  }

  if (data.etiquetaIds.length > 0) {
    await setEtiquetasWBS('tarea', tarea.id, data.etiquetaIds);
  }

  await recalcFromTarea(tarea.id);
  const final = await prisma.tarea.findUnique({
    where: { id: tarea.id },
    include: {
      asignados: { include: { recurso: { select: { id: true, nombre: true, apellido: true } } } },
      etiquetas: { include: { etiqueta: true } },
    },
  });
  return c.json(final, 201);
});

actividadesRoutes.put('/tarea/:id', async (c) => {
  const user = getUser(c);
  if (!canManageWBS(user.rol)) {
    return c.json({ error: 'No autorizado para editar tareas' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const data = tareaUpdateSchema.parse(body);

  const actual = await prisma.tarea.findUnique({
    where: { id },
    include: { subtareas: true },
  });
  if (!actual) return c.json({ error: 'Tarea no encontrada' }, 404);

  // Si tiene subtareas, el checkbox no se edita a mano (es roll-up)
  const puedeEditarCompletada = actual.subtareas.length === 0;

  await prisma.tarea.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion ?? undefined } : {}),
      ...(data.orden !== undefined ? { orden: data.orden } : {}),
      ...(data.fechaInicio !== undefined ? { fechaInicio: toNullableDate(data.fechaInicio) } : {}),
      ...(data.fechaFin !== undefined ? { fechaFin: toNullableDate(data.fechaFin) } : {}),
      ...(data.relevante !== undefined ? { relevante: data.relevante } : {}),
      ...(puedeEditarCompletada && data.completada !== undefined ? { completada: data.completada } : {}),
    },
  });

  if (data.asignados !== undefined) {
    await setAsignados(id, data.asignados);
  }

  if (data.etiquetaIds !== undefined) {
    await setEtiquetasWBS('tarea', id, data.etiquetaIds);
  }

  await recalcFromTarea(id);

  const tarea = await prisma.tarea.findUnique({
    where: { id },
    include: {
      asignados: { include: { recurso: { select: { id: true, nombre: true, apellido: true } } } },
      etiquetas: { include: { etiqueta: true } },
    },
  });
  return c.json(tarea);
});

actividadesRoutes.delete('/tarea/:id', async (c) => {
  const user = getUser(c);
  if (!canManageWBS(user.rol)) {
    return c.json({ error: 'No autorizado para eliminar tareas' }, 403);
  }

  const { id } = c.req.param();
  const tarea = await prisma.tarea.delete({ where: { id } });
  await recalcFromActividad(tarea.actividadId);

  return c.json({ success: true });
});

// ============================================
// SUBTAREAS
// ============================================

actividadesRoutes.post('/tarea/:id/subtareas', async (c) => {
  const user = getUser(c);
  const ok = await puedeEscribirSubtarea(user.rol, user.recursoId, c.req.param('id'));
  if (!ok) {
    return c.json(
      { error: 'Solo puedes agregar subtareas en tareas donde estás asignado' },
      403
    );
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const data = subtareaSchema.parse(body);

  const total = await prisma.subtarea.count({ where: { tareaId: id } });

  const subtarea = await prisma.subtarea.create({
    data: {
      tareaId: id,
      nombre: data.nombre,
      descripcion: data.descripcion ?? undefined,
      orden: data.orden ?? total,
      completada: data.completada ?? false,
    },
  });

  if (data.etiquetaIds.length > 0) {
    await setEtiquetasWBS('subtarea', subtarea.id, data.etiquetaIds);
  }

  await recalcFromTarea(id);
  return c.json(subtarea, 201);
});

actividadesRoutes.put('/subtarea/:id', async (c) => {
  const { id } = c.req.param();
  const subtarea = await prisma.subtarea.findUnique({ where: { id } });
  if (!subtarea) return c.json({ error: 'Subtarea no encontrada' }, 404);

  const user = getUser(c);
  const ok = await puedeEscribirSubtarea(user.rol, user.recursoId, subtarea.tareaId);
  if (!ok) {
    return c.json(
      { error: 'Solo puedes editar subtareas de tareas donde estás asignado' },
      403
    );
  }

  const body = await c.req.json();
  const data = subtareaSchema.partial().parse(body);

  const updated = await prisma.subtarea.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
      ...(data.descripcion !== undefined ? { descripcion: data.descripcion ?? undefined } : {}),
      ...(data.orden !== undefined ? { orden: data.orden } : {}),
      ...(data.completada !== undefined ? { completada: data.completada } : {}),
      ...(data.relevante !== undefined ? { relevante: data.relevante } : {}),
    },
  });

  if (data.etiquetaIds !== undefined) {
    await setEtiquetasWBS('subtarea', id, data.etiquetaIds);
  }

  await recalcFromTarea(subtarea.tareaId);
  return c.json(updated);
});

actividadesRoutes.delete('/subtarea/:id', async (c) => {
  const { id } = c.req.param();
  const subtarea = await prisma.subtarea.findUnique({ where: { id } });
  if (!subtarea) return c.json({ error: 'Subtarea no encontrada' }, 404);

  const user = getUser(c);
  const ok = await puedeEscribirSubtarea(user.rol, user.recursoId, subtarea.tareaId);
  if (!ok) {
    return c.json(
      { error: 'Solo puedes eliminar subtareas de tareas donde estás asignado' },
      403
    );
  }

  await prisma.subtarea.delete({ where: { id } });
  await recalcFromTarea(subtarea.tareaId);

  return c.json({ success: true });
});

// ============================================
// EXPORT A MS PROJECT DESKTOP (formato XML MSPDI)
// ============================================

// Construido con String.fromCharCode para evitar problemas de escape de entidades XML
const AMP = String.fromCharCode(38); // &
const LT = String.fromCharCode(60); // <
const GT = String.fromCharCode(62); // >
const QUOT = String.fromCharCode(34); // "
const APOS = String.fromCharCode(39); // '

function xmlEscape(s: string): string {
  return s
    .split(AMP).join(AMP + 'amp;')
    .split(LT).join(AMP + 'lt;')
    .split(GT).join(AMP + 'gt;')
    .split(QUOT).join(AMP + 'quot;')
    .split(APOS).join(AMP + 'apos;');
}

function mspDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}T08:00:00`;
}

actividadesRoutes.get('/proyecto/:proyectoId/export-msproject', async (c) => {
  const { proyectoId } = c.req.param();

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      cliente: { select: { nombre: true } },
      actividades: {
        include: {
          tareas: {
            include: {
              subtareas: { orderBy: { orden: 'asc' } },
              asignados: {
                include: { recurso: { select: { id: true, nombre: true, apellido: true } } },
              },
            },
            orderBy: { orden: 'asc' },
          },
        },
        orderBy: { orden: 'asc' },
      },
    },
  });
  if (!proyecto) return c.json({ error: 'Proyecto no encontrado' }, 404);

  const hoy = new Date();
  const fallbackInicio = proyecto.fechaInicio ?? proyecto.scheduledStart ?? hoy;
  const fallbackFin = proyecto.fechaFin ?? proyecto.scheduledEnd ?? hoy;

  // ===== Tasks =====
  interface XmlTask {
    name: string;
    outlineLevel: number;
    percent: number;
    start: Date;
    finish: Date;
    summary: boolean;
    asignados: { recursoId: string; nombre: string }[];
  }

  const tasks: XmlTask[] = [];

  // Fechas globales del proyecto (para la tarea resumen)
  let globalStart = fallbackInicio;
  let globalFinish = fallbackFin;
  const allDates: Date[] = [];
  proyecto.actividades.forEach((a) => {
    allDates.push(a.fechaInicio ?? fallbackInicio);
    allDates.push(a.fechaFin ?? fallbackFin);
    a.tareas.forEach((t) => {
      allDates.push(t.fechaInicio ?? fallbackInicio);
      allDates.push(t.fechaFin ?? fallbackFin);
    });
  });
  if (allDates.length > 0) {
    globalStart = new Date(Math.min(...allDates.map((d) => d.getTime())));
    globalFinish = new Date(Math.max(...allDates.map((d) => d.getTime())));
  }

  // Tarea 0: resumen del proyecto
  tasks.push({
    name: `${proyecto.nombre}${proyecto.cliente ? ` — ${proyecto.cliente.nombre}` : ''}`,
    outlineLevel: 0,
    percent: Math.round(proyecto.percentComplete ?? 0),
    start: globalStart,
    finish: globalFinish,
    summary: true,
    asignados: [],
  });

  // Actividades → tareas → subtareas
  proyecto.actividades.forEach((a) => {
    const aInicio = a.fechaInicio ?? (a.tareas[0]?.fechaInicio ?? fallbackInicio);
    const aFin = a.fechaFin ?? (a.tareas[a.tareas.length - 1]?.fechaFin ?? fallbackFin);
    tasks.push({
      name: a.nombre,
      outlineLevel: 1,
      percent: Math.round(a.percentComplete),
      start: aInicio,
      finish: aFin,
      summary: a.tareas.length > 0,
      asignados: [],
    });

    a.tareas.forEach((t) => {
      tasks.push({
        name: t.nombre,
        outlineLevel: 2,
        percent: Math.round(t.percentComplete),
        start: t.fechaInicio ?? aInicio,
        finish: t.fechaFin ?? aFin,
        summary: false,
        asignados: t.asignados.map((ta) => ({
          recursoId: ta.recursoId,
          nombre: ta.recurso.apellido ? `${ta.recurso.nombre} ${ta.recurso.apellido}` : ta.recurso.nombre,
        })),
      });

      t.subtareas.forEach((s) => {
        tasks.push({
          name: s.nombre,
          outlineLevel: 3,
          percent: s.completada ? 100 : 0,
          start: t.fechaInicio ?? aInicio,
          finish: t.fechaFin ?? aFin,
          summary: false,
          asignados: [],
        });
      });
    });
  });

  // ===== Resources (únicos por recursoId) =====
  const recursosMap = new Map<string, { uid: number; nombre: string }>();
  tasks.forEach((t) =>
    t.asignados.forEach((a) => {
      if (!recursosMap.has(a.recursoId)) {
        recursosMap.set(a.recursoId, { uid: recursosMap.size + 1, nombre: a.nombre });
      }
    })
  );

  // ===== XML =====
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push('<Project xmlns="http://schemas.microsoft.com/project">');
  lines.push(`  <Name>${xmlEscape(proyecto.nombre)}</Name>`);
  lines.push(`  <Title>${xmlEscape(proyecto.nombre)}</Title>`);
  lines.push(`  <StartDate>${mspDate(globalStart)}</StartDate>`);
  lines.push(`  <FinishDate>${mspDate(globalFinish)}</FinishDate>`);
  lines.push(`  <MinutesPerDay>480</MinutesPerDay>`);
  lines.push(`  <MinutesPerWeek>2400</MinutesPerWeek>`);
  lines.push(`  <DaysPerMonth>20</DaysPerMonth>`);
  lines.push('  <Tasks>');

  tasks.forEach((t, index) => {
    lines.push('    <Task>');
    lines.push(`      <UID>${index}</UID>`);
    lines.push(`      <ID>${index}</ID>`);
    lines.push(`      <Name>${xmlEscape(t.name)}</Name>`);
    lines.push(`      <Active>1</Active>`);
    lines.push(`      <Milestone>0</Milestone>`);
    lines.push(`      <Summary>${t.summary ? 1 : 0}</Summary>`);
    lines.push(`      <PercentComplete>${t.percent}</PercentComplete>`);
    lines.push(`      <OutlineLevel>${t.outlineLevel}</OutlineLevel>`);
    lines.push(`      <Start>${mspDate(t.start)}</Start>`);
    lines.push(`      <Finish>${mspDate(t.finish)}</Finish>`);
    lines.push(`      <ConstraintType>0</ConstraintType>`);
    lines.push('    </Task>');
  });

  lines.push('  </Tasks>');
  lines.push('  <Resources>');

  const recursoPorId = new Map<string, number>();
  recursosMap.forEach((r, recursoId) => recursoPorId.set(recursoId, r.uid));
  recursosMap.forEach((r) => {
    lines.push('    <Resource>');
    lines.push(`      <UID>${r.uid}</UID>`);
    lines.push(`      <ID>${r.uid - 1}</ID>`);
    lines.push(`      <Name>${xmlEscape(r.nombre)}</Name>`);
    lines.push(`      <Type>1</Type>`);
    lines.push(`      <MaxUnits>1</MaxUnits>`);
    lines.push('    </Resource>');
  });

  lines.push('  </Resources>');
  lines.push('  <Assignments>');

  let assignUid = 1;
  tasks.forEach((t, index) => {
    t.asignados.forEach((a) => {
      const resourceUid = recursoPorId.get(a.recursoId);
      if (!resourceUid) return;
      lines.push('    <Assignment>');
      lines.push(`      <UID>${assignUid++}</UID>`);
      lines.push(`      <TaskUID>${index}</TaskUID>`);
      lines.push(`      <ResourceUID>${resourceUid}</ResourceUID>`);
      lines.push(`      <Units>1</Units>`);
      lines.push(`      <Start>${mspDate(t.start)}</Start>`);
      lines.push(`      <Finish>${mspDate(t.finish)}</Finish>`);
      lines.push('    </Assignment>');
    });
  });

  lines.push('  </Assignments>');
  lines.push('</Project>');

  const nombreArchivo = proyecto.nombre.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_');

  return new Response(lines.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo || 'proyecto'}.xml"`,
    },
  });
});

export { actividadesRoutes };
