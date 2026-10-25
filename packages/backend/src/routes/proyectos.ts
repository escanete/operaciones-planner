import { Hono } from 'hono';
import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const proyectosRoutes = new Hono();

const proyectoSchema = z.object({
  nombre: z.string().min(1).max(200),
  codigo: z.string().optional(),
  clienteId: z.string().optional().nullable(),
  descripcion: z.string().optional(),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
  estado: z.enum(['PLANIFICACION', 'ACTIVO', 'EN_PAUSA', 'FINALIZADO', 'CANCELADO']).default('PLANIFICACION'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  activo: z.boolean().default(true),
  // Planificación tipo MS Project (decisión c)
  scheduledStart: z.string().optional().nullable(),
  scheduledEnd: z.string().optional().nullable(),
  percentComplete: z.number().min(0).max(100).optional().nullable(),
  subprojectId: z.string().optional().nullable(),
  dependencies: z.string().optional().nullable(), // JSON string con IDs predecesores
  relevante: z.boolean().optional(), // marcación manual de importancia
});

proyectosRoutes.get('/', async (c) => {
  const estado = c.req.query('estado');
  const clienteId = c.req.query('clienteId');
  const activo = c.req.query('activo');
  const q = c.req.query('q');

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;
  if (activo !== undefined) where.activo = activo === 'true';
  if (q) {
    where.OR = [
      { nombre: { contains: q } },
      { codigo: { contains: q } },
      { descripcion: { contains: q } },
    ];
  }

  const proyectos = await prisma.proyecto.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true } },
      _count: { select: { asignaciones: true } },
    },
    orderBy: [{ clienteId: 'asc' }, { nombre: 'asc' }],
  });

  return c.json(proyectos);
});

proyectosRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      cliente: true,
      asignaciones: {
        include: { recurso: true, tipoActividad: true },
        orderBy: { fechaInicio: 'asc' },
      },
    },
  });

  if (!proyecto) {
    return c.json({ error: 'Proyecto no encontrado' }, 404);
  }
  return c.json(proyecto);
});

proyectosRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO' && user.rol !== 'PLANIFICADOR') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = proyectoSchema.parse(body);

  const proyecto = await prisma.proyecto.create({
    data: {
      ...validated,
      fechaInicio: validated.fechaInicio ? new Date(validated.fechaInicio) : undefined,
      fechaFin: validated.fechaFin ? new Date(validated.fechaFin) : undefined,
      scheduledStart: validated.scheduledStart ? new Date(validated.scheduledStart) : null,
      scheduledEnd: validated.scheduledEnd ? new Date(validated.scheduledEnd) : null,
    },
    include: { cliente: true },
  });

  return c.json(proyecto, 201);
});

proyectosRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO' && user.rol !== 'PLANIFICADOR') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = proyectoSchema.partial().parse(body);

  // Si el proyecto ya tiene jerarquía WBS, el % manual no aplica:
  // el avance lo gobierna el roll-up de actividades. Se recalcula aquí mismo.
  if (validated.percentComplete !== undefined) {
    const totalActividades = await prisma.actividad.count({ where: { proyectoId: id } });
    if (totalActividades > 0) {
      delete validated.percentComplete;
    }
  }

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: {
      ...validated,
      ...(validated.fechaInicio ? { fechaInicio: new Date(validated.fechaInicio) } : {}),
      ...(validated.fechaFin ? { fechaFin: new Date(validated.fechaFin) } : {}),
      ...(validated.scheduledStart !== undefined
        ? { scheduledStart: validated.scheduledStart ? new Date(validated.scheduledStart) : null }
        : {}),
      ...(validated.scheduledEnd !== undefined
        ? { scheduledEnd: validated.scheduledEnd ? new Date(validated.scheduledEnd) : null }
        : {}),
      ...(validated.percentComplete !== undefined ? { percentComplete: validated.percentComplete } : {}),
      ...(validated.subprojectId !== undefined ? { subprojectId: validated.subprojectId } : {}),
      ...(validated.dependencies !== undefined ? { dependencies: validated.dependencies } : {}),
    },
    include: { cliente: true },
  });

  // Devolver el % real (roll-up) si tiene actividades
  const conWBS = await prisma.proyecto.findUnique({
    where: { id },
    select: { percentComplete: true },
  });

  return c.json({ ...proyecto, percentComplete: conWBS?.percentComplete });
});

// ============================================
// IMPORTAR DESDE MS PROJECT (XML / formato MSPDI)
// Asistente: preview=true devuelve el resumen sin crear nada.
// ============================================

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** "2026-11-02T08:00:00" → "2026-11-02" */
function mspDateToISO(s: unknown): string | undefined {
  if (!s) return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(s));
  return m ? m[1] : undefined;
}

proyectosRoutes.post('/import-msproject', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = (await c.req.json()) as {
    xml?: string;
    preview?: boolean;
    crearRecursos?: boolean;
    nombreOverride?: string;
  };
  if (!body.xml || typeof body.xml !== 'string') {
    return c.json({ error: 'Falta el contenido del archivo XML' }, 400);
  }

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    isArray: (name) => name === 'Task' || name === 'Resource' || name === 'Assignment',
  });

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(body.xml) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'El archivo no es un XML válido' }, 400);
  }

  const project = (doc.Project ?? doc.project) as Record<string, unknown> | undefined;
  if (!project) {
    return c.json({ error: 'No parece un archivo de MS Project (falta el nodo Project)' }, 400);
  }

  const rawTasks = asArray(
    project.Tasks ? (project.Tasks as Record<string, unknown>).Task : undefined
  ) as Record<string, unknown>[];
  if (rawTasks.length === 0) {
    return c.json({ error: 'El archivo no contiene tareas' }, 400);
  }

  // Normalizar tareas (nivel 0 = resumen del proyecto, se omite)
  const tareasMsp = rawTasks.map((t, i) => ({
    uid: Number(t.UID ?? i),
    name: String(t.Name ?? `Tarea ${i}`),
    outlineLevel: Number(t.OutlineLevel ?? 0),
    percent: Number(t.PercentComplete ?? 0),
    start: mspDateToISO(t.Start),
    finish: mspDateToISO(t.Finish),
  }));
  const estructuradas = tareasMsp.filter((t) => t.outlineLevel > 0);

  // Recursos del XML (UID → nombre)
  const recursosXml = new Map<number, string>();
  (asArray(
    project.Resources ? (project.Resources as Record<string, unknown>).Resource : undefined
  ) as Record<string, unknown>[]).forEach((r) => {
    const uid = Number(r.UID ?? -1);
    if (uid >= 0 && r.Name) recursosXml.set(uid, String(r.Name));
  });

  // Asignaciones del XML (TaskUID → [ResourceUID])
  const asigsPorTarea = new Map<number, number[]>();
  (asArray(
    project.Assignments ? (project.Assignments as Record<string, unknown>).Assignment : undefined
  ) as Record<string, unknown>[]).forEach((a) => {
    const taskUid = Number(a.TaskUID ?? -1);
    const resUid = Number(a.ResourceUID ?? -1);
    if (taskUid < 0 || resUid < 0 || resUid === -65535) return; // -65535 = sin recurso
    asigsPorTarea.set(taskUid, [...(asigsPorTarea.get(taskUid) ?? []), resUid]);
  });

  // Mapear nombres de recursos XML → recursos existentes en la BD
  const recursosBd = await prisma.recurso.findMany({ where: { activo: true, tipo: 'PERSONA' } });
  const porNombre = new Map<string, string>();
  recursosBd.forEach((r) => {
    porNombre.set(`${r.nombre} ${r.apellido ?? ''}`.trim().toLowerCase(), r.id);
    porNombre.set(r.nombre.trim().toLowerCase(), r.id);
  });

  const fechaInicio = mspDateToISO(project.StartDate) ?? estructuradas[0]?.start;
  const fechaFin = mspDateToISO(project.FinishDate) ?? estructuradas[estructuradas.length - 1]?.finish;
  const nombreBase = (body.nombreOverride ?? String(project.Name ?? project.Title ?? 'Proyecto importado')).trim();

  // ===== PASO 1: PREVIEW (no crea nada) =====
  if (body.preview) {
    const encontrados = new Set<number>();
    const faltantes = new Set<string>();
    recursosXml.forEach((nombre, uid) => {
      if (porNombre.has(nombre.trim().toLowerCase())) encontrados.add(uid);
      else faltantes.add(nombre);
    });
    return c.json({
      preview: true,
      nombreProyecto: nombreBase,
      fechaInicio,
      fechaFin,
      totalActividades: estructuradas.filter((t) => t.outlineLevel === 1).length,
      totalTareas: estructuradas.filter((t) => t.outlineLevel === 2).length,
      totalSubtareas: estructuradas.filter((t) => t.outlineLevel >= 3).length,
      recursosExistentes: encontrados.size,
      recursosFaltantes: Array.from(faltantes),
    });
  }

  // ===== PASO 2: IMPORT REAL =====
  const resultado = await prisma.$transaction(async (tx) => {
    // Crear recursos faltantes (opcional): persona nueva en el primer departamento
    const recursoPorUid = new Map<number, string>();
    const faltantesCreados: string[] = [];
    let deptoId: string | null = null;
    for (const [uid, nombre] of recursosXml) {
      const match = porNombre.get(nombre.trim().toLowerCase());
      if (match) {
        recursoPorUid.set(uid, match);
        continue;
      }
      if (!body.crearRecursos) continue;
      if (!deptoId) {
        const depto = await tx.departamento.findFirst({ orderBy: { orden: 'asc' } });
        if (!depto) throw new Error('No hay departamentos para crear recursos');
        deptoId = depto.id;
      }
      const partes = nombre.trim().split(/\s+/);
      const creado = await tx.recurso.create({
        data: {
          nombre: partes[0],
          apellido: partes.length > 1 ? partes.slice(1).join(' ') : null,
          tipo: 'PERSONA',
          codigo: `IMP-${uid}`,
          departamentoId: deptoId,
        },
      });
      faltantesCreados.push(nombre);
      recursoPorUid.set(uid, creado.id);
    }

    // Nombre único para el proyecto
    const duplicados = await tx.proyecto.count({ where: { nombre: nombreBase } });
    const nombreFinal =
      duplicados > 0 ? `${nombreBase} (importado ${new Date().toISOString().slice(0, 10)})` : nombreBase;

    const proyecto = await tx.proyecto.create({
      data: {
        nombre: nombreFinal,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        scheduledStart: fechaInicio ? new Date(fechaInicio) : null,
        scheduledEnd: fechaFin ? new Date(fechaFin) : null,
        estado: 'PLANIFICACION',
      },
    });

    // Ensamblar jerarquía por OutlineLevel (orden del documento)
    const creados = { actividades: 0, tareas: 0, subtareas: 0, asignaciones: 0 };
    const tareaIdPorUid = new Map<number, string>();
    let actividadActual: string | null = null;
    let tareaActual: string | null = null;
    let ordenAct = 0;
    let ordenTar = 0;
    let ordenSub = 0;

    for (const t of estructuradas) {
      if (t.outlineLevel === 1) {
        const act = await tx.actividad.create({
          data: {
            proyectoId: proyecto.id,
            nombre: t.name,
            orden: ordenAct++,
            fechaInicio: t.start ? new Date(t.start) : null,
            fechaFin: t.finish ? new Date(t.finish) : null,
          },
        });
        actividadActual = act.id;
        tareaActual = null;
        creados.actividades++;
      } else if (t.outlineLevel === 2) {
        if (!actividadActual) continue; // tarea huérfana (sin actividad contenedora): se omite
        const tar = await tx.tarea.create({
          data: {
            actividadId: actividadActual,
            nombre: t.name,
            orden: ordenTar++,
            completada: t.percent >= 100,
            percentComplete: t.percent >= 100 ? 100 : 0,
            fechaInicio: t.start ? new Date(t.start) : null,
            fechaFin: t.finish ? new Date(t.finish) : null,
          },
        });
        tareaIdPorUid.set(t.uid, tar.id);
        tareaActual = tar.id;
        ordenSub = 0;
        creados.tareas++;
      } else {
        if (!tareaActual) continue;
        await tx.subtarea.create({
          data: {
            tareaId: tareaActual,
            nombre: t.name,
            orden: ordenSub++,
            completada: t.percent >= 100,
          },
        });
        creados.subtareas++;
      }
    }

    // Asignaciones (solo tareas nivel 2 tienen TareaAsignado)
    for (const [taskUid, resUids] of asigsPorTarea) {
      const tareaId = tareaIdPorUid.get(taskUid);
      if (!tareaId) continue;
      for (const resUid of resUids) {
        const recursoId = recursoPorUid.get(resUid);
        if (!recursoId) continue;
        try {
          await tx.tareaAsignado.create({ data: { tareaId, recursoId } });
          creados.asignaciones++;
        } catch {
          /* par duplicado tarea-recurso: se ignora */
        }
      }
    }

    // Roll-up de avance: actividad = promedio de tareas; proyecto = promedio de actividades
    const acts = await tx.actividad.findMany({
      where: { proyectoId: proyecto.id },
      include: { tareas: { select: { percentComplete: true } } },
    });
    for (const a of acts) {
      if (a.tareas.length > 0) {
        const prom = a.tareas.reduce((s, t) => s + t.percentComplete, 0) / a.tareas.length;
        await tx.actividad.update({ where: { id: a.id }, data: { percentComplete: prom } });
      }
    }
    if (acts.length > 0) {
      const recarga = await tx.actividad.findMany({
        where: { proyectoId: proyecto.id },
        select: { percentComplete: true },
      });
      const promP = recarga.reduce((s, a) => s + a.percentComplete, 0) / recarga.length;
      await tx.proyecto.update({
        where: { id: proyecto.id },
        data: { percentComplete: Math.round(promP) },
      });
    }

    return {
      proyectoId: proyecto.id,
      nombre: nombreFinal,
      recursosCreados: faltantesCreados,
      ...creados,
    };
  });

  return c.json(resultado, 201);
});

proyectosRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();

  // Borrado real en cascada: actividades → tareas → subtareas + asignados,
  // asignaciones y el proyecto. Los recursos NO se tocan (quedan libres).
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const proyecto = await tx.proyecto.findUnique({ where: { id } });
      if (!proyecto) return null;

      // Descolgar subproyectos del padre (SET NULL explícito)
      await tx.proyecto.updateMany({
        where: { subprojectId: id },
        data: { subprojectId: null },
      });

      // Jerarquía WBS
      const actividadIds = (
        await tx.actividad.findMany({ where: { proyectoId: id }, select: { id: true } })
      ).map((a) => a.id);

      let totalTareas = 0;
      let totalSubtareas = 0;
      if (actividadIds.length > 0) {
        const tareaIds = (
          await tx.tarea.findMany({ where: { actividadId: { in: actividadIds } }, select: { id: true } })
        ).map((t) => t.id);
        totalTareas = tareaIds.length;

        if (tareaIds.length > 0) {
          const sub = await tx.subtarea.deleteMany({ where: { tareaId: { in: tareaIds } } });
          totalSubtareas = sub.count;
          await tx.tareaAsignado.deleteMany({ where: { tareaId: { in: tareaIds } } });
        }
        await tx.tarea.deleteMany({ where: { actividadId: { in: actividadIds } } });
      }
      await tx.actividad.deleteMany({ where: { proyectoId: id } });

      // Asignaciones de planificación
      const asig = await tx.asignacion.deleteMany({ where: { proyectoId: id } });

      // El proyecto
      await tx.proyecto.delete({ where: { id } });

      return {
        proyecto: proyecto.nombre,
        actividades: actividadIds.length,
        tareas: totalTareas,
        subtareas: totalSubtareas,
        asignaciones: asig.count,
      };
    });

    if (!resultado) {
      return c.json({ error: 'Proyecto no encontrado' }, 404);
    }

    return c.json({ success: true, eliminado: resultado });
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    return c.json(
      { error: 'No se pudo eliminar el proyecto. Verifique que no tenga dependencias externas.' },
      500
    );
  }
});

export { proyectosRoutes };
