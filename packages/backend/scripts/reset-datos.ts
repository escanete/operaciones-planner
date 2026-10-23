/**
 * Reset de datos: deja la aplicación "casi de cero".
 *
 * CONSERVA:
 *  - Usuario(s) SUPER_ADMIN (y sus sesiones)
 *  - Departamento "Operaciones" + sus equipos
 *  - Cargos existentes
 *  - Tipos de actividad: Despliegue terreno, Informe, Capacitación, Mantenimiento
 *  - Configuración global
 *
 * ELIMINA (todo lo demás):
 *  - Asignaciones, actividades, tareas, subtareas, asignados a tareas
 *  - Proyectos, clientes
 *  - Recursos (personas y vehículos) → quedan desvinculados de todo
 *  - Usuarios que NO son SUPER_ADMIN
 *  - Otros departamentos/equipos y tipos de actividad
 *  - Auditoría
 *
 * Uso:
 *  - Desarrollo:  pnpm --filter backend db:reset
 *  - Producción: docker compose exec backend node reset.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TIPOS_KEPT = ['Despliegue terreno', 'Informe', 'Capacitación', 'Mantenimiento'];

async function main() {
  console.log('🧹 Iniciando reset de datos...\n');

  // ===== 1) Borrar datos operativos (hijos primero) =====
  const delSubtareas = await prisma.subtarea.deleteMany({});
  const delTareaAsignado = await prisma.tareaAsignado.deleteMany({});
  const delTareas = await prisma.tarea.deleteMany({});
  const delActividades = await prisma.actividad.deleteMany({});
  const delAsignaciones = await prisma.asignacion.deleteMany({});
  const delProyectos = await prisma.proyecto.deleteMany({});
  const delClientes = await prisma.cliente.deleteMany({});
  const delRecursos = await prisma.recurso.deleteMany({});

  console.log(`  Subtareas eliminadas:        ${delSubtareas.count}`);
  console.log(`  Asignaciones a tareas:       ${delTareaAsignado.count}`);
  console.log(`  Tareas eliminadas:           ${delTareas.count}`);
  console.log(`  Actividades eliminadas:      ${delActividades.count}`);
  console.log(`  Asignaciones planificación:  ${delAsignaciones.count}`);
  console.log(`  Proyectos eliminados:        ${delProyectos.count}`);
  console.log(`  Clientes eliminados:         ${delClientes.count}`);
  console.log(`  Recursos eliminados:          ${delRecursos.count}`);

  // ===== 2) Usuarios: conservar solo SUPER_ADMIN =====
  const delUsuarios = await prisma.user.deleteMany({
    where: { rol: { not: 'SUPER_ADMIN' } },
  });
  // Desvincular recursoId de los admins (ya borrados en cascada SET NULL, por si acaso)
  await prisma.user.updateMany({ data: { recursoId: null }, where: { recursoId: { not: null } } });
  console.log(`  Usuarios no-admin eliminados: ${delUsuarios.count}`);

  // ===== 3) Auditoría =====
  const delAuditoria = await prisma.auditoria.deleteMany({});
  console.log(`  Registros de auditoría:      ${delAuditoria.count}`);

  // ===== 4) Tipos de actividad: conservar solo los 4 base =====
  const delTipos = await prisma.tipoActividad.deleteMany({
    where: { nombre: { notIn: TIPOS_KEPT } },
  });
  console.log(`  Tipos de actividad extra eliminados: ${delTipos.count}`);

  // ===== 5) Departamentos: conservar solo "Operaciones" =====
  const delDeptos = await prisma.departamento.deleteMany({
    where: { nombre: { not: 'Operaciones' } },
  });
  console.log(`  Departamentos extra eliminados: ${delDeptos.count}`);

  // ===== 6) Asegurar estructura base (idempotente) =====
  const deptOp = await prisma.departamento.upsert({
    where: { nombre: 'Operaciones' },
    update: {},
    create: { nombre: 'Operaciones', descripcion: 'Departamento de Operaciones', orden: 1 },
  });

  for (const [nombre, orden] of [
    ['SCADA', 1],
    ['Ingenieria', 2],
    ['Mantenimiento', 3],
  ] as const) {
    await prisma.equipo.upsert({
      where: { departamentoId_nombre: { departamentoId: deptOp.id, nombre } },
      update: {},
      create: { nombre, departamentoId: deptOp.id, orden },
    });
  }

  for (const [nombre, nivel] of [
    ['Ingeniero', 2],
    ['Técnico', 1],
    ['Supervisor', 3],
  ] as const) {
    await prisma.cargo.upsert({
      where: { nombre },
      update: {},
      create: { nombre, nivel, color: '#4472C4' },
    });
  }

  const tiposBase = [
    { nombre: 'Despliegue terreno', color: '#00B050', billable: true, requiereProyecto: true, orden: 1 },
    { nombre: 'Informe', color: '#FFD966', billable: false, requiereProyecto: true, orden: 2 },
    { nombre: 'Capacitación', color: '#9BC2E6', billable: false, requiereProyecto: false, orden: 3 },
    { nombre: 'Mantenimiento', color: '#F4B183', billable: false, requiereProyecto: false, orden: 4 },
  ];
  for (const t of tiposBase) {
    await prisma.tipoActividad.upsert({
      where: { nombre: t.nombre },
      update: { color: t.color, orden: t.orden },
      create: t,
    });
  }

  // ===== 7) Resumen final =====
  const [recursos, proyectos, clientes, usuarios, tipos, equipos, cargos] = await Promise.all([
    prisma.recurso.count(),
    prisma.proyecto.count(),
    prisma.cliente.count(),
    prisma.user.count(),
    prisma.tipoActividad.count(),
    prisma.equipo.count(),
    prisma.cargo.count(),
  ]);

  console.log('\n✅ Reset completado. Estado final:');
  console.log(`  - Recursos: ${recursos} | Proyectos: ${proyectos} | Clientes: ${clientes}`);
  console.log(`  - Usuarios: ${usuarios} (solo SUPER_ADMIN)`);
  console.log(`  - Tipos de actividad: ${tipos} | Equipos: ${equipos} | Cargos: ${cargos}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en reset:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
