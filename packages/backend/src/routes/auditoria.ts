import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

const auditoriaRoutes = new Hono();

auditoriaRoutes.get('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const query = c.req.query();
  const where: Record<string, unknown> = {};

  if (query.entidad) where.entidad = query.entidad;
  if (query.entidadId) where.entidadId = query.entidadId;
  if (query.userId) where.userId = query.userId;
  if (query.desde) where.createdAt = { gte: new Date(query.desde) };
  if (query.hasta) {
    const hastaDate = query.hasta;
    where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(hastaDate) };
  }

  const page = parseInt(query.page ?? '1');
  const limit = Math.min(parseInt(query.limit ?? '50'), 100);

  const [registros, total] = await Promise.all([
    prisma.auditoria.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditoria.count({ where }),
  ]);

  return c.json({
    data: registros,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

auditoriaRoutes.get('/entidad/:entidad/:entidadId', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { entidad, entidadId } = c.req.param();

  const registros = await prisma.auditoria.findMany({
    where: { entidad, entidadId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(registros);
});

export { auditoriaRoutes };
