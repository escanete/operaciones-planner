import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const equiposRoutes = new Hono();

const equipoSchema = z.object({
  nombre: z.string().min(1).max(100),
  departamentoId: z.string(),
  descripcion: z.string().optional(),
  liderId: z.string().optional().nullable(),
  orden: z.number().int().default(0),
  activo: z.boolean().default(true),
});

equiposRoutes.get('/', async (c) => {
  const departamentoId = c.req.query('departamentoId');
  const equipos = await prisma.equipo.findMany({
    where: {
      activo: true,
      ...(departamentoId ? { departamentoId } : {}),
    },
    include: {
      departamento: { select: { id: true, nombre: true } },
      lider: { select: { id: true, nombre: true, apellido: true } },
      _count: { select: { recursos: true } },
    },
    orderBy: [{ departamentoId: 'asc' }, { orden: 'asc' }],
  });
  return c.json(equipos);
});

equiposRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const equipo = await prisma.equipo.findUnique({
    where: { id },
    include: { departamento: true, recursos: true, lider: true },
  });
  if (!equipo) {
    return c.json({ error: 'Equipo no encontrado' }, 404);
  }
  return c.json(equipo);
});

equiposRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = equipoSchema.parse(body);

  const equipo = await prisma.equipo.create({
    data: validated,
    include: { departamento: true, lider: true },
  });

  return c.json(equipo, 201);
});

equiposRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = equipoSchema.partial().parse(body);

  const equipo = await prisma.equipo.update({
    where: { id },
    data: validated,
    include: { departamento: true, lider: true },
  });

  return c.json(equipo);
});

equiposRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  await prisma.equipo.update({
    where: { id },
    data: { activo: false },
  });

  return c.json({ success: true });
});

export { equiposRoutes };
