import { Hono } from 'hono';
import { z } from 'zod';
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

proyectosRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  await prisma.proyecto.update({
    where: { id },
    data: { activo: false },
  });

  return c.json({ success: true });
});

export { proyectosRoutes };
