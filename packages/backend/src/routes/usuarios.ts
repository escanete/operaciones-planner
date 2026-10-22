import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { auth } from '../lib/auth.js';
import { getUser } from '../types/index.js';

const usuariosRoutes = new Hono();

const createUsuarioSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  apellido: z.string().min(1),
  rol: z.enum(['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL', 'JEFE_AREA', 'OPERADOR', 'VISTA_SOLO']).default('OPERADOR'),
  recursoId: z.string().optional().nullable(),
  roleLevel: z.number().int().min(0).max(10).default(0),
  departmentId: z.string().optional().nullable(),
  areaId: z.string().optional().nullable(),
});

// POST /api/usuarios (solo SUPER_ADMIN) - Crear usuario con Better-Auth
usuariosRoutes.post('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json();
  const validated = createUsuarioSchema.parse(body);

  try {
    // Usar la API de Better-Auth para crear el usuario (hash correcto de password)
    const response = await auth.api.signUpEmail({
      body: {
        email: validated.email,
        password: validated.password,
        name: validated.name,
        apellido: validated.apellido,
        rol: validated.rol,
      },
    });

    // Si se asignó un recurso, vincularlo
    if (validated.recursoId && response.user) {
      await prisma.user.update({
        where: { id: response.user.id },
        data: {
          recursoId: validated.recursoId,
          roleLevel: validated.roleLevel,
          ...(validated.departmentId ? { departmentId: validated.departmentId } : {}),
          ...(validated.areaId ? { areaId: validated.areaId } : {}),
        },
      });
    } else if (response.user) {
      // Aun sin recurso, guardar jerarquía y alcance (decisiones a y b)
      await prisma.user.update({
        where: { id: response.user.id },
        data: {
          roleLevel: validated.roleLevel,
          ...(validated.departmentId ? { departmentId: validated.departmentId } : {}),
          ...(validated.areaId ? { areaId: validated.areaId } : {}),
        },
      });
    }

    return c.json({ success: true, user: response.user }, 201);
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return c.json({ error: 'El email ya está registrado' }, 409);
    }
    console.error('Error creating user:', error);
    return c.json({ error: 'Error al crear usuario', details: String(error) }, 500);
  }
});


usuariosRoutes.get('/', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const usuarios = await prisma.user.findMany({
    include: {
      recurso: { select: { id: true, nombre: true, apellido: true } },
      preferencias: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json(usuarios.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    apellido: u.apellido,
    rol: u.rol,
    activo: u.activo,
    roleLevel: u.roleLevel,
    departmentId: u.departmentId,
    areaId: u.areaId,
    recurso: u.recurso,
    createdAt: u.createdAt,
    ultimoAcceso: u.ultimoAcceso,
  })));
});

usuariosRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const usuario = await prisma.user.findUnique({
    where: { id },
    include: { recurso: true, preferencias: true },
  });

  if (!usuario) {
    return c.json({ error: 'Usuario no encontrado' }, 404);
  }

  return c.json({
    id: usuario.id,
    email: usuario.email,
    name: usuario.name,
    apellido: usuario.apellido,
    rol: usuario.rol,
    activo: usuario.activo,
    recurso: usuario.recurso,
    preferencias: usuario.preferencias,
    createdAt: usuario.createdAt,
  });
});

usuariosRoutes.put('/:id/rol', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as {
    rol?: string;
    roleLevel?: number;
    departmentId?: string | null;
    areaId?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (body.rol !== undefined) data.rol = body.rol;
  if (body.roleLevel !== undefined) data.roleLevel = body.roleLevel;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;
  if (body.areaId !== undefined) data.areaId = body.areaId || null;

  const usuario = await prisma.user.update({
    where: { id },
    data,
  });

  return c.json({
    id: usuario.id,
    rol: usuario.rol,
    roleLevel: usuario.roleLevel,
    departmentId: usuario.departmentId,
    areaId: usuario.areaId,
  });
});

// PUT /api/usuarios/:id/activo (solo SUPER_ADMIN)
usuariosRoutes.put('/:id/activo', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as { activo: boolean };

  const usuario = await prisma.user.update({
    where: { id },
    data: { activo: body.activo },
  });

  return c.json({ id: usuario.id, activo: usuario.activo });
});

usuariosRoutes.put('/:id/recurso', async (c) => {
  const user = getUser(c);
  if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN_DEPTO') {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const { id } = c.req.param();
  const body = await c.req.json() as { recursoId: string | null };

  const usuario = await prisma.user.update({
    where: { id },
    data: { recursoId: body.recursoId },
    include: { recurso: true },
  });

  return c.json({ id: usuario.id, recursoId: usuario.recursoId, recurso: usuario.recurso });
});

usuariosRoutes.get('/:id/preferencias', async (c) => {
  const { id } = c.req.param();
  const preferencias = await prisma.userPreferencias.findUnique({
    where: { userId: id },
  });

  return c.json(preferencias ?? { userId: id, vistaPorDefecto: 'semanal' });
});

usuariosRoutes.put('/:id/preferencias', async (c) => {
  const currentUser = getUser(c);
  const { id } = c.req.param();
  
  if (currentUser.id !== id && !['SUPER_ADMIN', 'ADMIN_DEPTO'].includes(currentUser.rol)) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  const body = await c.req.json() as {
    tema?: string;
    vistaPorDefecto?: string;
    zonaHoraria?: string;
    notificaciones?: string;
  };

  const preferencias = await prisma.userPreferencias.upsert({
    where: { userId: id },
    create: { 
      userId: id, 
      tema: body.tema,
      vistaPorDefecto: body.vistaPorDefecto,
      zonaHoraria: body.zonaHoraria,
      notificaciones: body.notificaciones,
    },
    update: {
      tema: body.tema,
      vistaPorDefecto: body.vistaPorDefecto,
      zonaHoraria: body.zonaHoraria,
      notificaciones: body.notificaciones,
    },
  });

  return c.json(preferencias);
});

export { usuariosRoutes };
