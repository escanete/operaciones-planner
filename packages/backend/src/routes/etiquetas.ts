import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

// ============================================
// ETIQUETAS (catálogo global, estilo Zoho)
// - Ver/asignar: cualquier usuario autenticado
// - Crear/editar: SUPER_ADMIN y ADMIN_DEPTO (como catálogos)
// - Eliminar: solo SUPER_ADMIN
// ============================================

const ROLES_GESTION = ['SUPER_ADMIN', 'ADMIN_DEPTO'];

const etiquetaSchema = z.object({
  nombre: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#64748B'),
  descripcion: z.string().max(200).optional().nullable(),
  activo: z.boolean().default(true),
});

const etiquetaUpdateSchema = etiquetaSchema.partial();

const etiquetasRoutes = new Hono();

// Listar (todas, también inactivas para el admin; orden alfabético)
etiquetasRoutes.get('/', async (c) => {
  const soloActivas = c.req.query('activo') === 'true';
  const etiquetas = await prisma.etiqueta.findMany({
    where: soloActivas ? { activo: true } : {},
    orderBy: { nombre: 'asc' },
  });
  return c.json(etiquetas);
});

// Crear
etiquetasRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (!ROLES_GESTION.includes(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar etiquetas' }, 403);
  }

  const body = await c.req.json();
  const parsed = etiquetaSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400);
  }

  const existe = await prisma.etiqueta.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existe) {
    return c.json({ error: `Ya existe una etiqueta llamada "${parsed.data.nombre}"` }, 409);
  }

  const etiqueta = await prisma.etiqueta.create({
    data: {
      nombre: parsed.data.nombre,
      color: parsed.data.color,
      descripcion: parsed.data.descripcion ?? undefined,
      activo: parsed.data.activo,
    },
  });
  return c.json(etiqueta, 201);
});

// Actualizar
etiquetasRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (!ROLES_GESTION.includes(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar etiquetas' }, 403);
  }

  const { id } = c.req.param();
  const existing = await prisma.etiqueta.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Etiqueta no encontrada' }, 404);

  const body = await c.req.json();
  const parsed = etiquetaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400);
  }

  // Validar unicidad del nombre si cambia
  if (parsed.data.nombre && parsed.data.nombre !== existing.nombre) {
    const duplicado = await prisma.etiqueta.findUnique({ where: { nombre: parsed.data.nombre } });
    if (duplicado) {
      return c.json({ error: `Ya existe una etiqueta llamada "${parsed.data.nombre}"` }, 409);
    }
  }

  const etiqueta = await prisma.etiqueta.update({
    where: { id },
    data: {
      ...(parsed.data.nombre !== undefined ? { nombre: parsed.data.nombre } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      ...(parsed.data.descripcion !== undefined
        ? { descripcion: parsed.data.descripcion ?? undefined }
        : {}),
      ...(parsed.data.activo !== undefined ? { activo: parsed.data.activo } : {}),
    },
  });
  return c.json(etiqueta);
});

// Eliminar (solo SUPER_ADMIN, como catálogos): se desasigna de todo por cascada
etiquetasRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'Solo un Super Admin puede eliminar etiquetas' }, 403);
  }

  const { id } = c.req.param();
  const existing = await prisma.etiqueta.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Etiqueta no encontrada' }, 404);

  await prisma.etiqueta.delete({ where: { id } });
  return c.json({ success: true });
});

export { etiquetasRoutes };
