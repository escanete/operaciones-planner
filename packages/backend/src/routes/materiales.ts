import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';

// ============================================
// MATERIALES / ACTIVOS DEL PROYECTO
// - Ver: cualquier usuario autenticado
// - Gestionar (crear/editar/eliminar): ROLES_WBS
//   (Gerente, PM, Comercial, Super Admin y Jefe de Área)
// ============================================

const ROLES_FULL = ['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL'];
const ROLES_WBS = [...ROLES_FULL, 'JEFE_AREA'];

const ESTADOS = ['PENDIENTE', 'SOLICITADO', 'ENTREGADO', 'INSTALADO', 'DEVUELTO'] as const;

const materialSchema = z.object({
  proyectoId: z.string().min(1),
  nombre: z.string().min(1).max(200),
  descripcion: z.string().optional().nullable(),
  categoria: z.string().max(100).optional().nullable(),
  cantidad: z.number().positive().default(1),
  unidad: z.string().max(20).optional().nullable(),
  estado: z.enum(ESTADOS).default('PENDIENTE'),
  recursoId: z.string().optional().nullable(),
  catalogoId: z.string().optional().nullable(), // ítem del catálogo global (opcional)
  notas: z.string().optional().nullable(),
});

const materialUpdateSchema = materialSchema.partial().omit({ proyectoId: true });

function canManageMateriales(rol: string): boolean {
  return ROLES_WBS.includes(rol);
}

const materialesRoutes = new Hono();

// Listar materiales de un proyecto
materialesRoutes.get('/', async (c) => {
  const proyectoId = c.req.query('proyectoId');
  if (!proyectoId) {
    return c.json({ error: 'Parámetro proyectoId es requerido' }, 400);
  }

  const materiales = await prisma.material.findMany({
    where: { proyectoId },
    include: {
      recurso: { select: { id: true, nombre: true, apellido: true, codigo: true } },
      catalogo: { select: { id: true, nombre: true, categoria: true, unidadBase: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { nombre: 'asc' }],
  });

  return c.json(materiales);
});

// Crear material
materialesRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (!canManageMateriales(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar materiales' }, 403);
  }

  const body = await c.req.json();
  const parsed = materialSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400);
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: parsed.data.proyectoId },
    select: { id: true },
  });
  if (!proyecto) return c.json({ error: 'Proyecto no encontrado' }, 404);

  // Si viene del catálogo, validar que exista
  if (parsed.data.catalogoId) {
    const cat = await prisma.materialCatalogo.findUnique({
      where: { id: parsed.data.catalogoId },
      select: { id: true },
    });
    if (!cat) return c.json({ error: 'Ítem del catálogo no encontrado' }, 400);
  }

  const material = await prisma.material.create({
    data: {
      proyectoId: parsed.data.proyectoId,
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion ?? undefined,
      categoria: parsed.data.categoria ?? undefined,
      cantidad: parsed.data.cantidad,
      unidad: parsed.data.unidad ?? undefined,
      estado: parsed.data.estado,
      recursoId: parsed.data.recursoId ?? undefined,
      catalogoId: parsed.data.catalogoId ?? undefined,
      notas: parsed.data.notas ?? undefined,
      creadoPorId: user.id,
    },
    include: {
      recurso: { select: { id: true, nombre: true, apellido: true, codigo: true } },
      catalogo: { select: { id: true, nombre: true, categoria: true, unidadBase: true } },
    },
  });

  return c.json(material, 201);
});

// Actualizar material
materialesRoutes.put('/:id', async (c) => {
  const user = getUser(c);
  if (!canManageMateriales(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar materiales' }, 403);
  }

  const { id } = c.req.param();
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Material no encontrado' }, 404);

  const body = await c.req.json();
  const parsed = materialUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400);
  }

  const d = parsed.data;
  const material = await prisma.material.update({
    where: { id },
    data: {
      ...(d.nombre !== undefined ? { nombre: d.nombre } : {}),
      ...(d.descripcion !== undefined ? { descripcion: d.descripcion ?? undefined } : {}),
      ...(d.categoria !== undefined ? { categoria: d.categoria ?? undefined } : {}),
      ...(d.cantidad !== undefined ? { cantidad: d.cantidad } : {}),
      ...(d.unidad !== undefined ? { unidad: d.unidad ?? undefined } : {}),
      ...(d.estado !== undefined ? { estado: d.estado } : {}),
      ...(d.recursoId !== undefined ? { recursoId: d.recursoId ?? undefined } : {}),
      ...(d.catalogoId !== undefined ? { catalogoId: d.catalogoId ?? undefined } : {}),
      ...(d.notas !== undefined ? { notas: d.notas ?? undefined } : {}),
    },
    include: {
      recurso: { select: { id: true, nombre: true, apellido: true, codigo: true } },
      catalogo: { select: { id: true, nombre: true, categoria: true, unidadBase: true } },
    },
  });

  return c.json(material);
});

// Eliminar material
materialesRoutes.delete('/:id', async (c) => {
  const user = getUser(c);
  if (!canManageMateriales(user.rol)) {
    return c.json({ error: 'No autorizado para gestionar materiales' }, 403);
  }

  const { id } = c.req.param();
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) return c.json({ error: 'Material no encontrado' }, 404);

  await prisma.material.delete({ where: { id } });
  return c.json({ success: true });
});

export { materialesRoutes };
