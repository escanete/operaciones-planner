import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

// ============================================
// CATÁLOGO GLOBAL DE MATERIALES
// - Ver: cualquier usuario autenticado (necesario en proyectos)
// - Crear/editar: SUPER_ADMIN y ADMIN_DEPTO (como catálogos)
// - Eliminar: solo SUPER_ADMIN (materiales de proyectos quedan
//   como texto libre vía onDelete: SetNull)
// ============================================

const ROLES_GESTION = ['SUPER_ADMIN', 'ADMIN_DEPTO'];

const materialCatalogoSchema = z.object({
  nombre: z.string().min(1).max(100),
  categoria: z.string().max(50).optional().nullable(),
  unidadBase: z.string().max(20).optional().nullable(),
  cantidadSugerida: z.number().positive().optional().nullable(),
  descripcion: z.string().max(500).optional().nullable(),
  recursoId: z.string().optional().nullable(), // vínculo con recurso-herramienta (inventario)
  activo: z.boolean().default(true),
});

const materialCatalogoUpdateSchema = materialCatalogoSchema.partial();

const materialesCatalogoRoutes = new Hono();

// Listar (todas, también inactivas para el admin; orden alfabético)
// ?activo=true filtra solo activas (para selects de proyectos)
materialesCatalogoRoutes.get('/', async (c) => {
  const soloActivos = c.req.query('activo') === 'true';
  const items = await prisma.materialCatalogo.findMany({
    where: soloActivos ? { activo: true } : {},
    include: { recurso: { select: { id: true, nombre: true, apellido: true, tipo: true } } },
    orderBy: { nombre: 'asc' },
  });
  return c.json(items);
});

// Crear
materialesCatalogoRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (!ROLES_GESTION.includes(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar el catálogo de materiales' }, 403);
  }

  const body = await c.req.json();
  const parsed = materialCatalogoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400);
  }

  const existe = await prisma.materialCatalogo.findUnique({ where: { nombre: parsed.data.nombre } });
  if (existe) {
    return c.json({ error: `Ya existe un material llamado "${parsed.data.nombre}" en el catálogo` }, 409);
  }

  if (parsed.data.recursoId) {
    const recurso = await prisma.recurso.findUnique({ where: { id: parsed.data.recursoId } });
    if (!recurso) return c.json({ error: 'Recurso vinculado no encontrado' }, 400);
  }

  const item = await prisma.materialCatalogo.create({
    data: {
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria ?? undefined,
      unidadBase: parsed.data.unidadBase ?? undefined,
      cantidadSugerida: parsed.data.cantidadSugerida ?? undefined,
      descripcion: parsed.data.descripcion ?? undefined,
      recursoId: parsed.data.recursoId ?? undefined,
      activo: parsed.data.activo,
    },
    include: { recurso: { select: { id: true, nombre: true, apellido: true, tipo: true } } },
  });
  return c.json(item, 201);
});

// Actualizar
materialesCatalogoRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (!ROLES_GESTION.includes(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar el catálogo de materiales' }, 403);
  }

  const { id } = c.req.param();
  const existing = await prisma.materialCatalogo.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Material del catálogo no encontrado' }, 404);

  const body = await c.req.json();
  const parsed = materialCatalogoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400);
  }

  // Validar unicidad del nombre si cambia
  if (parsed.data.nombre && parsed.data.nombre !== existing.nombre) {
    const duplicado = await prisma.materialCatalogo.findUnique({
      where: { nombre: parsed.data.nombre },
    });
    if (duplicado) {
      return c.json({ error: `Ya existe un material llamado "${parsed.data.nombre}" en el catálogo` }, 409);
    }
  }

  if (parsed.data.recursoId) {
    const recurso = await prisma.recurso.findUnique({ where: { id: parsed.data.recursoId } });
    if (!recurso) return c.json({ error: 'Recurso vinculado no encontrado' }, 400);
  }

  const item = await prisma.materialCatalogo.update({
    where: { id },
    data: {
      ...(parsed.data.nombre !== undefined ? { nombre: parsed.data.nombre } : {}),
      ...(parsed.data.categoria !== undefined ? { categoria: parsed.data.categoria ?? undefined } : {}),
      ...(parsed.data.unidadBase !== undefined ? { unidadBase: parsed.data.unidadBase ?? undefined } : {}),
      ...(parsed.data.cantidadSugerida !== undefined
        ? { cantidadSugerida: parsed.data.cantidadSugerida ?? null }
        : {}),
      ...(parsed.data.descripcion !== undefined ? { descripcion: parsed.data.descripcion ?? undefined } : {}),
      ...(parsed.data.recursoId !== undefined ? { recursoId: parsed.data.recursoId ?? undefined } : {}),
      ...(parsed.data.activo !== undefined ? { activo: parsed.data.activo } : {}),
    },
    include: { recurso: { select: { id: true, nombre: true, apellido: true, tipo: true } } },
  });
  return c.json(item);
});

// Eliminar (solo SUPER_ADMIN): los materiales de proyectos que lo referenciaban
// quedan como texto libre (onDelete: SetNull)
materialesCatalogoRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'Solo un Super Admin puede eliminar materiales del catálogo' }, 403);
  }

  const { id } = c.req.param();
  const existing = await prisma.materialCatalogo.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Material del catálogo no encontrado' }, 404);

  const enUso = await prisma.material.count({ where: { catalogoId: id } });
  await prisma.materialCatalogo.delete({ where: { id } });
  return c.json({ success: true, desvinculados: enUso });
});

export { materialesCatalogoRoutes };
