import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';
import { vincularUsuariosDeRecurso } from '../lib/vinculo-usuario.js';

const recursosRoutes = new Hono();

const recursoSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefono: z.string().optional(),
  tipo: z.enum(['PERSONA', 'VEHICULO', 'EQUIPO_TECNICO', 'HERRAMIENTA', 'OTRO']).default('PERSONA'),
  cargoId: z.string().optional().nullable(),
  departamentoId: z.string(),
  equipoId: z.string().optional().nullable(),
  patente: z.string().optional().nullable(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  capacidad: z.string().optional(),
  // Jerarquía y área (decisiones a y b)
  roleLevel: z.number().int().min(0).max(10).default(0),
  areaId: z.string().optional().nullable(),
  fechaIngreso: z.string().optional(),
  fechaEgreso: z.string().optional(),
  activo: z.boolean().default(true),
  colorCalendario: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

recursosRoutes.get('/', async (c) => {
  const departamentoId = c.req.query('departamentoId');
  const equipoId = c.req.query('equipoId');
  const tipo = c.req.query('tipo');
  const activo = c.req.query('activo');
  const areaId = c.req.query('areaId');
  const q = c.req.query('q');

  const where: Record<string, unknown> = {};
  if (departamentoId) where.departamentoId = departamentoId;
  if (equipoId) where.equipoId = equipoId;
  if (tipo) where.tipo = tipo;
  if (areaId) where.areaId = areaId;
  if (activo !== undefined) where.activo = activo === 'true';
  if (q) {
    where.OR = [
      { nombre: { contains: q } },
      { apellido: { contains: q } },
      { codigo: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const recursos = await prisma.recurso.findMany({
    where,
    include: {
      departamento: { select: { id: true, nombre: true } },
      equipo: { select: { id: true, nombre: true } },
      cargo: { select: { id: true, nombre: true } },
    },
    orderBy: [{ departamentoId: 'asc' }, { equipoId: 'asc' }, { nombre: 'asc' }],
  });

  return c.json(recursos);
});

recursosRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const recurso = await prisma.recurso.findUnique({
    where: { id },
    include: {
      departamento: true,
      equipo: true,
      cargo: true,
      disponibilidades: true,
      ausencias: { orderBy: { fechaInicio: 'desc' } },
      asignaciones: {
        include: { proyecto: true, tipoActividad: true },
        orderBy: { fechaInicio: 'desc' },
        take: 50,
      },
    },
  });

  if (!recurso) {
    return c.json({ error: 'Recurso no encontrado' }, 404);
  }
  return c.json(recurso);
});

recursosRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = recursoSchema.parse(body);

  const recurso = await prisma.recurso.create({
    data: {
      ...validated,
      email: validated.email || undefined,
      fechaIngreso: validated.fechaIngreso ? new Date(validated.fechaIngreso) : undefined,
      fechaEgreso: validated.fechaEgreso ? new Date(validated.fechaEgreso) : undefined,
    },
    include: { departamento: true, equipo: true, cargo: true },
  });

  // Si ya existe un usuario con ese email, queda vinculado automáticamente
  if (recurso.email) await vincularUsuariosDeRecurso(recurso.id);

  return c.json(recurso, 201);
});

recursosRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = recursoSchema.partial().parse(body);

  const recurso = await prisma.recurso.update({
    where: { id },
    data: {
      ...validated,
      ...(validated.email !== undefined ? { email: validated.email || undefined } : {}),
      ...(validated.fechaIngreso ? { fechaIngreso: new Date(validated.fechaIngreso) } : {}),
      ...(validated.fechaEgreso ? { fechaEgreso: new Date(validated.fechaEgreso) } : {}),
    },
    include: { departamento: true, equipo: true, cargo: true },
  });

  if (recurso.email) await vincularUsuariosDeRecurso(recurso.id);

  return c.json(recurso);
});

recursosRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();

  // Borrado REAL en cascada (las FK eliminan asignaciones, disponibilidades,
  // ausencias y asignaciones a tareas del WBS; usuario.recursoId y
  // equipo.liderId quedan en null)
  const eliminado = await prisma.$transaction(async (tx) => {
    const [asignaciones, disponibilidades, ausencias, tareasWbs] = await Promise.all([
      tx.asignacion.count({ where: { recursoId: id } }),
      tx.disponibilidad.count({ where: { recursoId: id } }),
      tx.ausencia.count({ where: { recursoId: id } }),
      tx.tareaAsignado.count({ where: { recursoId: id } }),
    ]);
    await tx.recurso.delete({ where: { id } });
    return { asignaciones, disponibilidades, ausencias, tareasWbs };
  });

  return c.json({ success: true, eliminado });
});

// Disponibilidad
recursosRoutes.get('/:id/disponibilidad', async (c) => {
  const { id } = c.req.param();
  const disponibilidad = await prisma.disponibilidad.findMany({
    where: { recursoId: id },
    orderBy: { diaSemana: 'asc' },
  });
  return c.json(disponibilidad);
});

recursosRoutes.put('/:id/disponibilidad', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as { disponibilidades: Array<{ diaSemana: number; horaInicio: string; horaFin: string; activa?: boolean }> };
  
  await prisma.disponibilidad.deleteMany({ where: { recursoId: id } });
  
  const created = await prisma.disponibilidad.createMany({
    data: body.disponibilidades.map(d => ({
      recursoId: id,
      diaSemana: d.diaSemana,
      horaInicio: d.horaInicio,
      horaFin: d.horaFin,
      activa: d.activa ?? true,
    })),
  });

  return c.json({ success: true, created: created.count });
});

// Ausencias
recursosRoutes.get('/:id/ausencias', async (c) => {
  const { id } = c.req.param();
  const desde = c.req.query('desde');
  const hasta = c.req.query('hasta');

  const where: Record<string, unknown> = { recursoId: id };
  if (desde) where.fechaFin = { gte: new Date(desde) };
  if (hasta) {
    where.fechaInicio = { lte: new Date(hasta) };
  }

  const ausencias = await prisma.ausencia.findMany({
    where,
    orderBy: { fechaInicio: 'desc' },
  });

  return c.json(ausencias);
});

recursosRoutes.post('/:id/ausencias', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as {
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    todoDia?: boolean;
    horaInicio?: string;
    horaFin?: string;
    descripcion?: string;
  };

  const ausencia = await prisma.ausencia.create({
    data: {
      recursoId: id,
      tipo: body.tipo,
      fechaInicio: new Date(body.fechaInicio),
      fechaFin: new Date(body.fechaFin),
      todoDia: body.todoDia ?? true,
      horaInicio: body.horaInicio,
      horaFin: body.horaFin,
      descripcion: body.descripcion,
    },
  });

  return c.json(ausencia, 201);
});

recursosRoutes.delete('/:id/ausencias/:ausenciaId', async (c) => {
  const user = getUser(c);
  if (!['SUPER_ADMIN', 'ADMIN_DEPTO'].includes(user.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id: recursoId, ausenciaId } = c.req.param();
  await prisma.ausencia.delete({
    where: { id: ausenciaId, recursoId },
  });

  return c.json({ success: true });
});

// Carga de trabajo
recursosRoutes.get('/:id/carga-trabajo', async (c) => {
  const { id } = c.req.param();
  const desde = c.req.query('desde');
  const hasta = c.req.query('hasta');

  if (!desde || !hasta) {
    return c.json({ error: 'Parámetros desde y hasta son requeridos' }, 400);
  }

  const fechaInicio = new Date(desde);
  const fechaFin = new Date(hasta);

  const asignaciones = await prisma.asignacion.findMany({
    where: {
      recursoId: id,
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
      estado: { not: 'CANCELADA' },
    },
    include: { proyecto: true, tipoActividad: true },
  });

  const horasAsignadas = asignaciones.reduce((acc, a) => {
    const dias = Math.ceil((a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return acc + dias * (a.todoDia ? 8 : 4);
  }, 0);

  return c.json({
    recursoId: id,
    periodo: { desde, hasta },
    horasAsignadas,
    totalAsignaciones: asignaciones.length,
    asignaciones,
  });
});

export { recursosRoutes };
