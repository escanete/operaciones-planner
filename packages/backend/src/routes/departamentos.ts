import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const departamentosRoutes = new Hono();

const departamentoSchema = z.object({
  nombre: z.string().min(1).max(100),
  descripcion: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  orden: z.number().int().default(0),
  activo: z.boolean().default(true),
});

// GET /api/departamentos
departamentosRoutes.get('/', async (c) => {
  const departamentos = await prisma.departamento.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    include: {
      _count: { select: { equipos: true, recursos: true } },
    },
  });
  return c.json(departamentos);
});

// GET /api/departamentos/:id
departamentosRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const departamento = await prisma.departamento.findUnique({
    where: { id },
    include: { equipos: true, recursos: true },
  });
  if (!departamento) {
    return c.json({ error: 'Departamento no encontrado' }, 404);
  }
  return c.json(departamento);
});

// POST /api/departamentos
departamentosRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = departamentoSchema.parse(body);

  const departamento = await prisma.departamento.create({
    data: validated,
  });

  return c.json(departamento, 201);
});

// PUT /api/departamentos/:id
departamentosRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = departamentoSchema.partial().parse(body);

  const departamento = await prisma.departamento.update({
    where: { id },
    data: validated,
  });

  return c.json(departamento);
});

// DELETE /api/departamentos/:id
departamentosRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  
  await prisma.departamento.update({
    where: { id },
    data: { activo: false },
  });

  return c.json({ success: true });
});

export { departamentosRoutes };
