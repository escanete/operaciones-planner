import { prisma } from './db.js';

/* ============================================================
   Vínculo automático entre usuarios de la app y recursos (personas)

   El usuario inicia sesión con su cuenta de Office (ej:
   esteban.canete@scadatech.cl). Si existe una ficha de persona con
   ese mismo correo, se vincula automáticamente para que sus
   asignaciones se sincronicen con su calendario de Outlook.
   ============================================================ */

function normalizarEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

/** Vincula un usuario con la persona que tiene su mismo email, si existe. */
export async function vincularUsuarioPorEmail(
  userId: string,
  emailUsuario?: string | null
): Promise<string | null> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, recursoId: true },
  });
  if (!usuario) return null;
  if (usuario.recursoId) return usuario.recursoId;

  const objetivo = normalizarEmail(emailUsuario || usuario.email);
  if (!objetivo) return null;

  // SQLite compara texto de forma sensible a mayúsculas; la lista de
  // personas es pequeña, así que comparamos normalizado en memoria.
  const candidatos = await prisma.recurso.findMany({
    where: { tipo: 'PERSONA', email: { not: null } },
    select: { id: true, email: true },
  });
  const recurso = candidatos.find((r) => normalizarEmail(r.email) === objetivo);
  if (!recurso) return null;

  const yaVinculado = await prisma.user.findUnique({
    where: { recursoId: recurso.id },
    select: { id: true },
  });
  if (yaVinculado && yaVinculado.id !== userId) return null;

  await prisma.user.update({
    where: { id: userId },
    data: { recursoId: recurso.id },
  });

  return recurso.id;
}

/** Vincula los usuarios sin recurso cuyo email coincide con el de la persona. */
export async function vincularUsuariosDeRecurso(recursoId: string): Promise<number> {
  const recurso = await prisma.recurso.findUnique({
    where: { id: recursoId },
    select: { id: true, email: true, tipo: true },
  });
  if (!recurso?.email || recurso.tipo !== 'PERSONA') return 0;

  const yaVinculado = await prisma.user.findUnique({
    where: { recursoId: recurso.id },
    select: { id: true },
  });
  if (yaVinculado) return 0;

  const objetivo = normalizarEmail(recurso.email);
  const usuarios = await prisma.user.findMany({
    where: { recursoId: null },
    select: { id: true, email: true },
  });

  const usuario = usuarios.find((u) => normalizarEmail(u.email) === objetivo);
  if (!usuario) return 0;

  await prisma.user.update({
    where: { id: usuario.id },
    data: { recursoId: recurso.id },
  });
  return 1;
}
