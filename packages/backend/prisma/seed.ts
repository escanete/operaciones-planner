/**
 * Seed MÍNIMO para partir casi de cero.
 *
 * Crea (idempotente):
 *  - Departamento "Operaciones" + equipos SCADA, Ingenieria, Mantenimiento
 *  - Cargos: Ingeniero, Técnico, Supervisor
 *  - Tipos de actividad: Despliegue terreno, Informe, Capacitación, Mantenimiento
 *  - Usuario admin: admin@operaciones.local / admin123 (SUPER_ADMIN)
 *
 * NO crea recursos, proyectos, clientes ni asignaciones de ejemplo.
 * Para limpiar una base con datos, usar: pnpm --filter backend db:reset
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed (mínimo)...');

  // 1. Departamento de Operaciones
  const deptOp = await prisma.departamento.upsert({
    where: { nombre: 'Operaciones' },
    update: {},
    create: { nombre: 'Operaciones', descripcion: 'Departamento de Operaciones', orden: 1 },
  });

  // 2. Cargos
  const cargoIngeniero = await prisma.cargo.upsert({
    where: { nombre: 'Ingeniero' },
    update: {},
    create: { nombre: 'Ingeniero', nivel: 2, color: '#4472C4' },
  });
  await prisma.cargo.upsert({
    where: { nombre: 'Técnico' },
    update: {},
    create: { nombre: 'Técnico', nivel: 1, color: '#00B050' },
  });
  await prisma.cargo.upsert({
    where: { nombre: 'Supervisor' },
    update: {},
    create: { nombre: 'Supervisor', nivel: 3, color: '#C00000' },
  });
  // Referencia para evitar warning de variable no usada en builds futuros
  void cargoIngeniero;

  // 3. Equipos
  for (const [nombre, orden, descripcion] of [
    ['SCADA', 1, 'Equipo SCADA'],
    ['Ingenieria', 2, 'Equipo Ingeniería'],
    ['Mantenimiento', 3, 'Equipo Mantenimiento'],
  ] as const) {
    await prisma.equipo.upsert({
      where: { departamentoId_nombre: { departamentoId: deptOp.id, nombre } },
      update: {},
      create: { nombre, departamentoId: deptOp.id, descripcion, orden },
    });
  }

  // 4. Tipos de actividad
  const tipos = [
    { nombre: 'Despliegue terreno', color: '#00B050', billable: true, requiereProyecto: true, orden: 1 },
    { nombre: 'Informe', color: '#FFD966', billable: false, requiereProyecto: true, orden: 2 },
    { nombre: 'Capacitación', color: '#9BC2E6', billable: false, requiereProyecto: false, orden: 3 },
    { nombre: 'Mantenimiento', color: '#F4B183', billable: false, requiereProyecto: false, orden: 4 },
  ];
  for (const t of tipos) {
    await prisma.tipoActividad.upsert({
      where: { nombre: t.nombre },
      update: {},
      create: t,
    });
  }

  // 5. Usuario admin por defecto (idempotente)
  const hashedPassword = await hashPassword('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@operaciones.local' },
    update: {},
    create: {
      id: 'admin-user-id-001',
      email: 'admin@operaciones.local',
      name: 'Administrador',
      apellido: 'Sistema',
      rol: 'SUPER_ADMIN',
      emailVerified: true,
      accounts: {
        create: {
          id: 'admin-account-id-001',
          // Better-Auth vincula la cuenta credential con accountId = userId
          accountId: 'admin-user-id-001',
          providerId: 'credential',
          password: hashedPassword,
        },
      },
    },
  });

  console.log('✅ Seed completado');
  console.log('   - Departamento: Operaciones (3 equipos)');
  console.log('   - Cargos: 3 | Tipos de actividad: 4');
  console.log('   - Usuario admin: admin@operaciones.local / admin123');
  console.log('   - Sin recursos, proyectos ni clientes (parte limpio)');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
