import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // 1. Crear departamentos
  const deptOp = await prisma.departamento.upsert({
    where: { nombre: 'Operaciones' },
    update: {},
    create: { nombre: 'Operaciones', descripcion: 'Departamento de Operaciones', orden: 1 },
  });

  // 2. Crear cargos
  const cargoIngeniero = await prisma.cargo.upsert({
    where: { nombre: 'Ingeniero' },
    update: {},
    create: { nombre: 'Ingeniero', nivel: 2, color: '#4472C4' },
  });

  const cargoTecnico = await prisma.cargo.upsert({
    where: { nombre: 'Técnico' },
    update: {},
    create: { nombre: 'Técnico', nivel: 1, color: '#00B050' },
  });

  const cargoSupervisor = await prisma.cargo.upsert({
    where: { nombre: 'Supervisor' },
    update: {},
    create: { nombre: 'Supervisor', nivel: 3, color: '#C00000' },
  });

  // 3. Crear equipos (basado en Excel)
  const equipoSCADA = await prisma.equipo.upsert({
    where: { departamentoId_nombre: { departamentoId: deptOp.id, nombre: 'SCADA' } },
    update: {},
    create: { nombre: 'SCADA', departamentoId: deptOp.id, descripcion: 'Equipo SCADA', orden: 1 },
  });

  const equipoIngenieria = await prisma.equipo.upsert({
    where: { departamentoId_nombre: { departamentoId: deptOp.id, nombre: 'Ingenieria' } },
    update: {},
    create: { nombre: 'Ingenieria', departamentoId: deptOp.id, descripcion: 'Equipo Ingeniería', orden: 2 },
  });

  const equipoMantenimiento = await prisma.equipo.upsert({
    where: { departamentoId_nombre: { departamentoId: deptOp.id, nombre: 'Mantenimiento' } },
    update: {},
    create: { nombre: 'Mantenimiento', departamentoId: deptOp.id, descripcion: 'Equipo Mantenimiento', orden: 3 },
  });

  // 4. Crear tipos de actividad (basado en colores Excel)
  const tipoProyecto = await prisma.tipoActividad.upsert({
    where: { nombre: 'Proyecto' },
    update: {},
    create: { nombre: 'Proyecto', color: '#00B050', billable: true, requiereProyecto: true, orden: 1 },
  });

  const tipoInforme = await prisma.tipoActividad.upsert({
    where: { nombre: 'Informe' },
    update: {},
    create: { nombre: 'Informe', color: '#FFD966', billable: false, requiereProyecto: true, orden: 2 },
  });

  const tipoCapacitacion = await prisma.tipoActividad.upsert({
    where: { nombre: 'Capacitación' },
    update: {},
    create: { nombre: 'Capacitación', color: '#9BC2E6', billable: false, requiereProyecto: false, orden: 3 },
  });

  const tipoMantenimiento = await prisma.tipoActividad.upsert({
    where: { nombre: 'Mantenimiento' },
    update: {},
    create: { nombre: 'Mantenimiento', color: '#F4B183', billable: false, requiereProyecto: false, orden: 4 },
  });

  // 5. Crear cliente y proyecto de ejemplo
  const clienteDemo = await prisma.cliente.upsert({
    where: { nombre: 'Cliente Demo' },
    update: {},
    create: { nombre: 'Cliente Demo', codigo: 'CLI-001', email: 'cliente@demo.cl' },
  });

  const proyectoA = await prisma.proyecto.upsert({
    where: { codigo: 'PRY-001' },
    update: {},
    create: {
      nombre: 'Proyecto A',
      codigo: 'PRY-001',
      clienteId: clienteDemo.id,
      estado: 'ACTIVO',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-12-31'),
    },
  });

  const proyectoB = await prisma.proyecto.upsert({
    where: { codigo: 'PRY-002' },
    update: {},
    create: {
      nombre: 'Proyecto B',
      codigo: 'PRY-002',
      clienteId: clienteDemo.id,
      estado: 'PLANIFICACION',
      fechaInicio: new Date('2026-02-01'),
      fechaFin: new Date('2026-06-30'),
    },
  });

  // 6. Crear recursos (basado en Excel) — con nivel jerárquico de rol (decisión a)
  const recursos = [
    // SCADA
    { nombre: 'Juan', apellido: 'Pérez', equipoId: equipoSCADA.id, cargoId: cargoTecnico.id, codigo: 'EMP-001', roleLevel: 1 },
    { nombre: 'Leonardo', apellido: 'González', equipoId: equipoSCADA.id, cargoId: cargoIngeniero.id, codigo: 'EMP-002', roleLevel: 3 },
    { nombre: 'Luis', apellido: 'Martínez', equipoId: equipoSCADA.id, cargoId: cargoTecnico.id, codigo: 'EMP-003', roleLevel: 1 },
    { nombre: 'Victor', apellido: 'López', equipoId: equipoSCADA.id, cargoId: cargoTecnico.id, codigo: 'EMP-004', roleLevel: 1 },
    { nombre: 'Miguel', apellido: 'Sánchez', equipoId: equipoSCADA.id, cargoId: cargoTecnico.id, codigo: 'EMP-005', roleLevel: 1 },
    // Ingeniería
    { nombre: 'Esteban', apellido: 'Rodríguez', equipoId: equipoIngenieria.id, cargoId: cargoIngeniero.id, codigo: 'EMP-006', roleLevel: 3 },
    { nombre: 'Diego', apellido: 'Fernández', equipoId: equipoIngenieria.id, cargoId: cargoIngeniero.id, codigo: 'EMP-007', roleLevel: 3 },
    { nombre: 'Giovanni', apellido: 'Moreno', equipoId: equipoIngenieria.id, cargoId: cargoTecnico.id, codigo: 'EMP-008', roleLevel: 1 },
    { nombre: 'Agustin', apellido: 'Jiménez', equipoId: equipoIngenieria.id, cargoId: cargoTecnico.id, codigo: 'EMP-009', roleLevel: 1 },
    // Mantenimiento
    { nombre: 'Alvaro', apellido: 'Ruiz', equipoId: equipoMantenimiento.id, cargoId: cargoSupervisor.id, codigo: 'EMP-010', roleLevel: 4 },
    { nombre: 'Matias', apellido: 'Diaz', equipoId: equipoMantenimiento.id, cargoId: cargoTecnico.id, codigo: 'EMP-011', roleLevel: 1 },
    { nombre: 'Fabian', apellido: 'Torres', equipoId: equipoMantenimiento.id, cargoId: cargoTecnico.id, codigo: 'EMP-012', roleLevel: 1 },
  ];

  for (const r of recursos) {
    await prisma.recurso.upsert({
      where: { codigo: r.codigo },
      update: {},
      create: {
        ...r,
        departamentoId: deptOp.id,
        tipo: 'PERSONA',
        activo: true,
      },
    });
  }

  // 7. Crear vehículos de ejemplo
  const camioneta1 = await prisma.recurso.upsert({
    where: { patente: 'ABCD-12' },
    update: {},
    create: {
      codigo: 'VEH-001',
      nombre: 'Camioneta Toyota Hilux',
      tipo: 'VEHICULO',
      departamentoId: deptOp.id,
      patente: 'ABCD-12',
      marca: 'Toyota',
      modelo: 'Hilux 2023',
      capacidad: '4 personas',
    },
  });

  const camioneta2 = await prisma.recurso.upsert({
    where: { patente: 'WXYZ-98' },
    update: {},
    create: {
      codigo: 'VEH-002',
      nombre: 'Camioneta Ford Ranger',
      tipo: 'VEHICULO',
      departamentoId: deptOp.id,
      patente: 'WXYZ-98',
      marca: 'Ford',
      modelo: 'Ranger 2024',
      capacidad: '5 personas',
    },
  });

  // 8. Crear usuario admin por defecto
  const hashedPassword = await hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
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

  // 9. Crear asignaciones de ejemplo (basado en Excel)
  const fechaBase = new Date('2026-10-01');
  
  // Juan y Leonardo en Proyecto A (verde en Excel)
  const recursoJuan = await prisma.recurso.findUnique({ where: { codigo: 'EMP-001' } });
  const recursoLeonardo = await prisma.recurso.findUnique({ where: { codigo: 'EMP-002' } });
  const recursoEsteban = await prisma.recurso.findUnique({ where: { codigo: 'EMP-006' } });
  const recursoDiego = await prisma.recurso.findUnique({ where: { codigo: 'EMP-007' } });

  if (recursoJuan && recursoLeonardo && recursoEsteban && recursoDiego) {
    // Idempotente: solo crear asignaciones demo si la tabla está vacía
    const asignacionesExistentes = await prisma.asignacion.count();
    if (asignacionesExistentes === 0) {
      await prisma.asignacion.create({
      data: {
        proyectoId: proyectoA.id,
        recursoId: recursoJuan.id,
        tipoActividadId: tipoProyecto.id,
        fechaInicio: new Date(fechaBase.getTime() + 2 * 24 * 60 * 60 * 1000), // Día 3
        fechaFin: new Date(fechaBase.getTime() + 4 * 24 * 60 * 60 * 1000),   // Día 5
        creadoPorId: adminUser.id,
        estado: 'CONFIRMADA',
      },
    });

    await prisma.asignacion.create({
      data: {
        proyectoId: proyectoA.id,
        recursoId: recursoLeonardo.id,
        tipoActividadId: tipoProyecto.id,
        fechaInicio: new Date(fechaBase.getTime() + 2 * 24 * 60 * 60 * 1000),
        fechaFin: new Date(fechaBase.getTime() + 4 * 24 * 60 * 60 * 1000),
        creadoPorId: adminUser.id,
        estado: 'CONFIRMADA',
      },
    });

    // Esteban en Informe (amarillo en Excel)
    await prisma.asignacion.create({
      data: {
        proyectoId: proyectoB.id,
        recursoId: recursoDiego.id,
        tipoActividadId: tipoInforme.id,
        fechaInicio: new Date(fechaBase.getTime() + 7 * 24 * 60 * 60 * 1000), // Día 8
        fechaFin: new Date(fechaBase.getTime() + 9 * 24 * 60 * 60 * 1000),   // Día 10
        creadoPorId: adminUser.id,
        estado: 'CONFIRMADA',
      },
    });
    }
  }

  console.log('✅ Seed completado exitosamente');
  console.log(`   - Departamentos: 1`);
  console.log(`   - Equipos: 3`);
  console.log(`   - Cargos: 3`);
  console.log(`   - Tipos Actividad: 4`);
  console.log(`   - Recursos: ${recursos.length + 2} (12 personas + 2 vehículos)`);
  console.log(`   - Proyectos: 2`);
  console.log(`   - Usuario admin: admin@operaciones.local / admin123`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
