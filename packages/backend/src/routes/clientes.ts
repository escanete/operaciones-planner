import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const clientesRoutes = new Hono();

const clienteSchema = z.object({
  nombre: z.string().min(1).max(200),
  codigo: z.string().optional(),
  direccion: z.string().optional(),
  contacto: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefono: z.string().optional(),
  activo: z.boolean().default(true),
});

clientesRoutes.get('/', async (c) => {
  const q = c.req.query('q');
  const activo = c.req.query('activo');

  const where: Record<string, unknown> = {};
  if (activo !== undefined) where.activo = activo === 'true';
  if (q) {
    where.OR = [
      { nombre: { contains: q } },
      { codigo: { contains: q } },
      { contacto: { contains: q } },
    ];
  }

  const clientes = await prisma.cliente.findMany({
    where,
    include: {
      _count: { select: { proyectos: true } },
    },
    orderBy: { nombre: 'asc' },
  });

  return c.json(clientes);
});

clientesRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: { proyectos: true },
  });

  if (!cliente) {
    return c.json({ error: 'Cliente no encontrado' }, 404);
  }
  return c.json(cliente);
});

clientesRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = clienteSchema.parse(body);

  const cliente = await prisma.cliente.create({
    data: validated,
  });

  return c.json(cliente, 201);
});

clientesRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = clienteSchema.partial().parse(body);

  const cliente = await prisma.cliente.update({
    where: { id },
    data: validated,
  });

  return c.json(cliente);
});

clientesRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  await prisma.cliente.update({
    where: { id },
    data: { activo: false },
  });

  return c.json({ success: true });
});

export { clientesRoutes };
