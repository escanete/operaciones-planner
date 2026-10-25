import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';
import type { ConflictInfo, ConflictCheckResult } from '@operaciones-planner/shared';

const asignacionesRoutes = new Hono();

const asignacionSchema = z.object({
  proyectoId: z.string(),
  recursoId: z.string(),
  tipoActividadId: z.string(),
  // Nombre de la actividad: qué hace específicamente la persona
  nombre: z.string().max(200).optional().nullable(),
  // Vinculación WBS opcional (actividad / tarea / subtarea del proyecto)
  actividadId: z.string().optional().nullable(),
  tareaId: z.string().optional().nullable(),
  subtareaId: z.string().optional().nullable(),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  todoDia: z.boolean().default(true),
  ubicacion: z.string().optional(),
  region: z.string().optional(),
  camionetaId: z.string().optional().nullable(),
  alojamiento: z.boolean().default(false),
  vueloId: z.string().optional(),
  estado: z.enum(['BORRADOR', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'CONFLICTO']).default('CONFIRMADA'),
  prioridad: z.number().int().min(0).default(0),
  notas: z.string().optional(),
});

// Verifica que los vínculos WBS pertenezcan al mismo proyecto
async function validarWbsLinks(
  proyectoId: string,
  links: { actividadId?: string | null; tareaId?: string | null; subtareaId?: string | null }
): Promise<string | null> {
  if (links.actividadId) {
    const act = await prisma.actividad.findUnique({
      where: { id: links.actividadId },
      select: { proyectoId: true },
    });
    if (!act || act.proyectoId !== proyectoId) return 'La actividad vinculada no pertenece al proyecto';
  }
  if (links.tareaId) {
    const tar = await prisma.tarea.findUnique({
      where: { id: links.tareaId },
      select: { actividad: { select: { proyectoId: true } } },
    });
    if (!tar || tar.actividad.proyectoId !== proyectoId) return 'La tarea vinculada no pertenece al proyecto';
  }
  if (links.subtareaId) {
    const sub = await prisma.subtarea.findUnique({
      where: { id: links.subtareaId },
      select: { tarea: { select: { actividad: { select: { proyectoId: true } } } } },
    });
    if (!sub || sub.tarea.actividad.proyectoId !== proyectoId) return 'La subtarea vinculada no pertenece al proyecto';
  }
  return null;
}

const moverSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recursoId: z.string().optional(),
  version: z.number().int(),
});

asignacionesRoutes.get('/', async (c) => {
  const query = c.req.query();
  
  const where: Record<string, unknown> = {};
  
  if (query.proyectoId) where.proyectoId = query.proyectoId;
  if (query.recursoId) where.recursoId = query.recursoId;
  if (query.tipoActividadId) where.tipoActividadId = query.tipoActividadId;
  if (query.estado) where.estado = query.estado;
  if (query.fechaDesde) where.fechaFin = { gte: new Date(query.fechaDesde) };
  if (query.fechaHasta) where.fechaInicio = { lte: new Date(query.fechaHasta) };
  if (query.camionetaId) where.camionetaId = query.camionetaId;

  const page = parseInt(query.page ?? '1');
  const limit = Math.min(parseInt(query.limit ?? '50'), 100);
  const skip = (page - 1) * limit;

  const [asignaciones, total] = await Promise.all([
    prisma.asignacion.findMany({
      where,
      include: {
        proyecto: { select: { id: true, nombre: true, color: true } },
        recurso: { select: { id: true, nombre: true, apellido: true, tipo: true } },
        tipoActividad: { select: { id: true, nombre: true, color: true } },
        camioneta: { select: { id: true, nombre: true, patente: true } },
      },
      orderBy: [{ fechaInicio: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.asignacion.count({ where }),
  ]);

  return c.json({
    data: asignaciones,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

asignacionesRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const asignacion = await prisma.asignacion.findUnique({
    where: { id },
    include: {
      proyecto: true,
      recurso: { include: { departamento: true, equipo: true, cargo: true } },
      tipoActividad: true,
      camioneta: true,
    },
  });

  if (!asignacion) {
    return c.json({ error: 'Asignación no encontrada' }, 404);
  }
  return c.json(asignacion);
});

asignacionesRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = asignacionSchema.parse(body);

  const errWbs = await validarWbsLinks(validated.proyectoId, validated);
  if (errWbs) {
    return c.json({ error: errWbs }, 400);
  }

  const conflicto = await validarConflictoInterno(
    validated.recursoId,
    validated.fechaInicio,
    validated.fechaFin
  );

  if (!conflicto.valido && body.forzar !== true) {
    return c.json({
      error: 'Conflicto de asignación detectado',
      conflictos: conflicto.conflictos,
      code: 'CONFLICTO_DETECTADO',
    }, 409);
  }

  const asignacion = await prisma.asignacion.create({
    data: {
      ...validated,
      fechaInicio: new Date(validated.fechaInicio),
      fechaFin: new Date(validated.fechaFin),
      creadoPorId: user.id,
      estado: conflicto.valido ? validated.estado : 'CONFLICTO',
    },
    include: {
      proyecto: true,
      recurso: true,
      tipoActividad: true,
      camioneta: true,
    },
  });

  return c.json(asignacion, 201);
});

asignacionesRoutes.post('/bulk', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json() as { asignaciones: z.infer<typeof asignacionSchema>[] };
  const validated = z.array(asignacionSchema).parse(body.asignaciones);

  const resultados = { created: 0, errors: [] as Array<{ index: number; error: string }> };

  for (let i = 0; i < validated.length; i++) {
    try {
      const data = validated[i];
      await prisma.asignacion.create({
        data: {
          ...data,
          fechaInicio: new Date(data.fechaInicio),
          fechaFin: new Date(data.fechaFin),
          creadoPorId: user.id,
        },
      });
      resultados.created++;
    } catch (error) {
      resultados.errors.push({ index: i, error: String(error) });
    }
  }

  return c.json(resultados, 201);
});

asignacionesRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as Record<string, unknown>;
  const { version, ...rest } = body;
  const validated = asignacionSchema.partial().parse(rest);

  if (version === undefined || typeof version !== 'number') {
    return c.json({ error: 'Campo version es requerido para optimistic locking' }, 400);
  }

  const actual = await prisma.asignacion.findUnique({ where: { id } });
  if (!actual) {
    return c.json({ error: 'Asignación no encontrada' }, 404);
  }

  if (actual.version !== version) {
    return c.json({
      error: 'Conflicto de concurrencia',
      currentVersion: actual.version,
      yourVersion: version,
      code: 'OPTIMISTIC_LOCK_CONFLICT',
    }, 409);
  }

  const errWbs = await validarWbsLinks(validated.proyectoId ?? actual.proyectoId, validated);
  if (errWbs) {
    return c.json({ error: errWbs }, 400);
  }

  const asignacion = await prisma.asignacion.update({
    where: { id },
    data: {
      ...validated,
      ...(validated.fechaInicio ? { fechaInicio: new Date(validated.fechaInicio) } : {}),
      ...(validated.fechaFin ? { fechaFin: new Date(validated.fechaFin) } : {}),
      version: version + 1,
    },
    include: {
      proyecto: true,
      recurso: true,
      tipoActividad: true,
      camioneta: true,
    },
  });

  return c.json(asignacion);
});

asignacionesRoutes.patch('/:id/mover', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = moverSchema.parse(body);

  const actual = await prisma.asignacion.findUnique({ where: { id } });
  if (!actual) {
    return c.json({ error: 'Asignación no encontrada' }, 404);
  }

  const nuevoRecursoId = validated.recursoId ?? actual.recursoId;
  const nuevaFechaInicio = validated.fechaInicio ?? actual.fechaInicio.toISOString().split('T')[0];
  const nuevaFechaFin = validated.fechaFin ?? actual.fechaFin.toISOString().split('T')[0];

  const conflicto = await validarConflictoInterno(
    nuevoRecursoId,
    nuevaFechaInicio,
    nuevaFechaFin,
    id
  );

  if (!conflicto.valido && c.req.query('forzar') !== 'true') {
    return c.json({
      error: 'Conflicto de asignación detectado en nueva posición',
      conflictos: conflicto.conflictos,
      code: 'CONFLICTO_EN_MOVIMIENTO',
    }, 409);
  }

  const asignacion = await prisma.asignacion.update({
    where: { id },
    data: {
      recursoId: nuevoRecursoId,
      fechaInicio: new Date(nuevaFechaInicio),
      fechaFin: new Date(nuevaFechaFin),
      version: actual.version + 1,
      estado: conflicto.valido ? actual.estado : 'CONFLICTO',
    },
    include: {
      proyecto: true,
      recurso: true,
      tipoActividad: true,
      camioneta: true,
    },
  });

  return c.json(asignacion);
});

asignacionesRoutes.patch('/:id/extender', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as { fechaFin: string };

  const validated = z.object({
    fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(body);

  const actual = await prisma.asignacion.findUnique({ where: { id } });
  if (!actual) {
    return c.json({ error: 'Asignación no encontrada' }, 404);
  }

  const nuevaFechaFin = new Date(validated.fechaFin);
  if (nuevaFechaFin < actual.fechaInicio) {
    return c.json({ error: 'La fecha fin no puede ser anterior a la fecha inicio' }, 400);
  }

  const asignacion = await prisma.asignacion.update({
    where: { id },
    data: {
      fechaFin: nuevaFechaFin,
      version: actual.version + 1,
    },
    include: {
      proyecto: true,
      recurso: true,
      tipoActividad: true,
      camioneta: true,
    },
  });

  return c.json(asignacion);
});

asignacionesRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  
  await prisma.asignacion.update({
    where: { id },
    data: { estado: 'CANCELADA' },
  });

  return c.json({ success: true });
});

asignacionesRoutes.post('/validar-conflicto', async (c) => {
  const body = await c.req.json() as {
    recursoId: string;
    fechaInicio: string;
    fechaFin: string;
    excluirAsignacionId?: string;
  };
  
  const resultado = await validarConflictoInterno(
    body.recursoId,
    body.fechaInicio,
    body.fechaFin,
    body.excluirAsignacionId
  );

  return c.json(resultado);
});

// ============================================
// FUNCIÓN INTERNA DE VALIDACIÓN
// ============================================
async function validarConflictoInterno(
  recursoId: string,
  fechaInicio: string,
  fechaFin: string,
  excluirAsignacionId?: string
): Promise<ConflictCheckResult> {
  const conflictos: ConflictInfo[] = [];
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date(fechaFin + 'T23:59:59');

  const where: Record<string, unknown> = {
    recursoId,
    estado: { not: 'CANCELADA' },
    fechaInicio: { lte: fin },
    fechaFin: { gte: inicio },
  };
  if (excluirAsignacionId) {
    where.id = { not: excluirAsignacionId };
  }

  const asignacionesConflicto = await prisma.asignacion.findMany({
    where,
    include: { proyecto: true },
  });

  for (const a of asignacionesConflicto) {
    const esSolapeTotal = a.fechaInicio <= inicio && a.fechaFin >= fin;
    conflictos.push({
      tipo: esSolapeTotal ? 'SOLAPE_TOTAL' : 'SOLAPE_PARCIAL',
      severidad: esSolapeTotal ? 'ERROR' : 'WARNING',
      mensaje: `Conflicto con "${a.proyecto.nombre}" (${a.fechaInicio.toISOString().split('T')[0]} al ${a.fechaFin.toISOString().split('T')[0]})`,
      asignacionConflicto: {
        id: a.id,
        proyectoNombre: a.proyecto.nombre,
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin,
      },
      solucionSugerida: esSolapeTotal 
        ? 'Cambiar fechas o cancelar asignación conflictiva'
        : 'Ajustar horario para evitar solape parcial',
    });
  }

  const ausencias = await prisma.ausencia.findMany({
    where: {
      recursoId,
      fechaInicio: { lte: fin },
      fechaFin: { gte: inicio },
    },
  });

  for (const a of ausencias) {
    conflictos.push({
      tipo: 'AUSENCIA_PROGRAMADA',
      severidad: 'ERROR',
      mensaje: `El recurso tiene "${a.tipo}" programado del ${a.fechaInicio.toISOString().split('T')[0]} al ${a.fechaFin.toISOString().split('T')[0]}`,
      asignacionConflicto: {
        id: a.id,
        proyectoNombre: a.tipo,
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin,
      },
      solucionSugerida: 'Cancelar la ausencia o asignar a otro recurso',
    });
  }

  const asignacionConCamioneta = await prisma.asignacion.findFirst({
    where: {
      camionetaId: recursoId,
      ...(excluirAsignacionId ? { id: { not: excluirAsignacionId } } : {}),
      estado: { not: 'CANCELADA' },
      fechaInicio: { lte: fin },
      fechaFin: { gte: inicio },
    },
    include: { proyecto: true },
  });

  if (asignacionConCamioneta) {
    conflictos.push({
      tipo: 'VEHICULO_OCUPADO',
      severidad: 'ERROR',
      mensaje: `Vehículo ya asignado a "${asignacionConCamioneta.proyecto.nombre}" en ese período`,
      asignacionConflicto: {
        id: asignacionConCamioneta.id,
        proyectoNombre: asignacionConCamioneta.proyecto.nombre,
        fechaInicio: asignacionConCamioneta.fechaInicio,
        fechaFin: asignacionConCamioneta.fechaFin,
      },
      solucionSugerida: 'Asignar otro vehículo o ajustar fechas',
    });
  }

  return {
    valido: conflictos.filter(cf => cf.severidad === 'ERROR').length === 0,
    conflictos,
  };
}

export { asignacionesRoutes };
