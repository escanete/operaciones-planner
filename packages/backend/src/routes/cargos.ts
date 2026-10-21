import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const cargosRoutes = new Hono();

const cargoSchema = z.object({
  nombre: z.string().min(1).max(100),
  descripcion: z.string().optional(),
  nivel: z.number().int().min(0).default(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  activo: z.boolean().default(true),
});

cargosRoutes.get('/', async (c) => {
  const cargos = await prisma.cargo.findMany({
    where: { activo: true },
    orderBy: { nivel: 'asc' },
    include: { _count: { select: { recursos: true } } },
  });
  return c.json(cargos);
});

cargosRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const cargo = await prisma.cargo.findUnique({
    where: { id },
    include: { recursos: true },
  });
  if (!cargo) {
    return c.json({ error: 'Cargo no encontrado' }, 404);
  }
  return c.json(cargo);
});

cargosRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = cargoSchema.parse(body);

  const cargo = await prisma.cargo.create({
    data: validated,
  });

  return c.json(cargo, 201);
});

cargosRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = cargoSchema.partial().parse(body);

  const cargo = await prisma.cargo.update({
    where: { id },
    data: validated,
  });

  return c.json(cargo);
});

cargosRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  await prisma.cargo.update({
    where: { id },
    data: { activo: false },
  });

  return c.json({ success: true });
});

export { cargosRoutes };
