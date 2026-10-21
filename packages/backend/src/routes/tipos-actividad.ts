import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const tiposActividadRoutes = new Hono();

const tipoActividadSchema = z.object({
  nombre: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#00B050'),
  icono: z.string().optional(),
  billable: z.boolean().default(true),
  requiereProyecto: z.boolean().default(true),
  orden: z.number().int().default(0),
  activo: z.boolean().default(true),
});

tiposActividadRoutes.get('/', async (c) => {
  const tipos = await prisma.tipoActividad.findMany({
    where: { activo: true },
    orderBy: { orden: 'asc' },
    include: { _count: { select: { asignaciones: true } } },
  });
  return c.json(tipos);
});

tiposActividadRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const tipo = await prisma.tipoActividad.findUnique({
    where: { id },
    include: { asignaciones: { take: 10 } },
  });

  if (!tipo) {
    return c.json({ error: 'Tipo de actividad no encontrado' }, 404);
  }
  return c.json(tipo);
});

tiposActividadRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = tipoActividadSchema.parse(body);

  const tipo = await prisma.tipoActividad.create({
    data: validated,
  });

  return c.json(tipo, 201);
});

tiposActividadRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const validated = tipoActividadSchema.partial().parse(body);

  const tipo = await prisma.tipoActividad.update({
    where: { id },
    data: validated,
  });

  return c.json(tipo);
});

tiposActividadRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  await prisma.tipoActividad.update({
    where: { id },
    data: { activo: false },
  });

  return c.json({ success: true });
});

export { tiposActividadRoutes };
