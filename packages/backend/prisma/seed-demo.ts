/**
 * Seed de DEMOSTRACIÓN para el despliegue cloud (Neon PostgreSQL).
 *
 * Crea datos 100% sintéticos —no datos reales de clientes— con idempotencia:
 * se puede ejecutar las veces que se quiera sin duplicar registros.
 *
 * Uso (con DATABASE_URL apuntando a Neon y el cliente Prisma de Postgres generado):
 *   pnpm --filter @operaciones-planner/backend db:seed:demo
 *
 * Credenciales de acceso: admin@operaciones.local / (DEMO_ADMIN_PASSWORD o admin123)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

/** Fecha relativa a hoy, a medianoche UTC, para que el Gantt siempre se vea vigente. */
function dia(offset: number): Date {
  const fecha = new Date();
  fecha.setUTCDate(fecha.getUTCDate() + offset);
  fecha.setUTCHours(0, 0, 0, 0);
  return fecha;
}

const ADMIN_ID = 'admin-user-id-001';

async function main() {
  console.log('🌱 Iniciando seed de demostración (datos sintéticos)...');

  // ---------- Usuario administrador ----------
  const passwordDemo = process.env.DEMO_ADMIN_PASSWORD ?? 'admin123';
  const hashedPassword = await hashPassword(passwordDemo);
  await prisma.user.upsert({
    where: { id: ADMIN_ID },
    update: {},
    create: {
      id: ADMIN_ID,
      email: 'admin@operaciones.local',
      name: 'Administrador',
      apellido: 'Demo',
      rol: 'SUPER_ADMIN',
      roleLevel: 10,
      emailVerified: true,
      accounts: {
        create: {
          id: 'admin-account-id-001',
          accountId: ADMIN_ID,
          providerId: 'credential',
          password: hashedPassword,
        },
      },
    },
  });

  // ---------- Catálogos base ----------
  const departamento = await prisma.departamento.upsert({
    where: { id: 'demo-dept-operaciones' },
    update: {},
    create: {
      id: 'demo-dept-operaciones',
      nombre: 'Operaciones',
      descripcion: 'Departamento de demostración',
      color: '#4472C4',
      orden: 1,
    },
  });

  for (const [id, nombre, color, nivel] of [
    ['demo-cargo-ing', 'Ingeniero', '#4472C4', 2],
    ['demo-cargo-tec', 'Técnico', '#00B050', 1],
    ['demo-cargo-sup', 'Supervisor', '#C00000', 3],
  ] as const) {
    await prisma.cargo.upsert({
      where: { id },
      update: {},
      create: { id, nombre, color, nivel },
    });
  }

  const equipos = await Promise.all(
    ([
      ['demo-equipo-scada', 'SCADA', 1],
      ['demo-equipo-ing', 'Ingenieria', 2],
      ['demo-equipo-mant', 'Mantenimiento', 3],
    ] as const).map(([id, nombre, orden]) =>
      prisma.equipo.upsert({
        where: { departamentoId_nombre: { departamentoId: departamento.id, nombre } },
        update: {},
        create: { id, nombre, orden, departamentoId: departamento.id },
      })
    )
  );

  const tipos = await Promise.all(
    ([
      ['demo-tipo-terreno', 'Despliegue terreno', '#00B050', true, 1],
      ['demo-tipo-informe', 'Informe', '#FFD966', false, 2],
      ['demo-tipo-capacitacion', 'Capacitación', '#9BC2E6', false, 3],
      ['demo-tipo-mantenimiento', 'Mantenimiento', '#F4B183', false, 4],
    ] as const).map(([id, nombre, color, billable, orden]) =>
      prisma.tipoActividad.upsert({
        where: { id },
        update: {},
        create: {
          id,
          nombre,
          color,
          billable,
          orden,
          requiereProyecto: true,
        },
      })
    )
  );

  const etiquetas = await Promise.all(
    ([
      ['demo-etq-urgente', 'Urgente', '#DC2626'],
      ['demo-etq-cliente', 'Cliente', '#2563EB'],
      ['demo-etq-interno', 'Interno', '#64748B'],
    ] as const).map(([id, nombre, color]) =>
      prisma.etiqueta.upsert({ where: { id }, update: {}, create: { id, nombre, color } })
    )
  );

  // ---------- Cliente y proyectos ----------
  await prisma.cliente.upsert({
    where: { id: 'demo-cliente' },
    update: {},
    create: {
      id: 'demo-cliente',
      nombre: 'Cliente Demo S.A.',
      codigo: 'CLI-DEMO-001',
      contacto: 'contacto@clientedemo.example',
      email: 'contacto@clientedemo.example',
    },
  });

  const proyectos = await Promise.all(
    [
      {
        id: 'demo-proy-1',
        nombre: 'Implantación SCADA Demo',
        codigo: 'PRY-DEMO-001',
        estado: 'ACTIVO',
        color: '#00B050',
        inicio: -14,
        fin: 21,
        avance: 45,
      },
      {
        id: 'demo-proy-2',
        nombre: 'Modernización Mantenimiento Demo',
        codigo: 'PRY-DEMO-002',
        estado: 'ACTIVO',
        color: '#4472C4',
        inicio: -7,
        fin: 14,
        avance: 20,
      },
      {
        id: 'demo-proy-3',
        nombre: 'Informe de Capacidad Demo',
        codigo: 'PRY-DEMO-003',
        estado: 'PLANIFICACION',
        color: '#FFD966',
        inicio: 7,
        fin: 28,
        avance: 0,
      },
    ].map((p) =>
      prisma.proyecto.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          clienteId: 'demo-cliente',
          descripcion: 'Proyecto de demostración con datos ficticios.',
          estado: p.estado,
          color: p.color,
          fechaInicio: dia(p.inicio),
          fechaFin: dia(p.fin),
          scheduledStart: dia(p.inicio),
          scheduledEnd: dia(p.fin),
          percentComplete: p.avance,
        },
      })
    )
  );

  // ---------- Recursos (personas y vehículos ficticios) ----------
  const personas = await Promise.all(
    ([
      ['demo-rec-1', 'Ana', 'Pérez', 'ana.perez@operaciones.local', 0, 1],
      ['demo-rec-2', 'Bruno', 'Gómez', 'bruno.gomez@operaciones.local', 0, 1],
      ['demo-rec-3', 'Carla', 'Ruiz', 'carla.ruiz@operaciones.local', 1, 2],
      ['demo-rec-4', 'Diego', 'Soto', 'diego.soto@operaciones.local', 1, 2],
      ['demo-rec-5', 'Elena', 'Muñoz', 'elena.munoz@operaciones.local', 2, 3],
      ['demo-rec-6', 'Felipe', 'Castro', 'felipe.castro@operaciones.local', 2, 3],
      ['demo-rec-7', 'Gloria', 'Vargas', 'gloria.vargas@operaciones.local', 3, 1],
      ['demo-rec-8', 'Hugo', 'López', 'hugo.lopez@operaciones.local', 3, 2],
    ] as const).map(([id, nombre, apellido, email, cargoIndex, equipoIndex]) =>
      prisma.recurso.upsert({
        where: { id },
        update: {},
        create: {
          id,
          nombre,
          apellido,
          email,
          codigo: id.toUpperCase(),
          tipo: 'PERSONA',
          departamentoId: departamento.id,
          equipoId: equipos[equipoIndex - 1].id,
          cargoId: ['demo-cargo-tec', 'demo-cargo-ing', 'demo-cargo-sup'][cargoIndex],
          roleLevel: cargoIndex,
          fechaIngreso: dia(-365),
        },
      })
    )
  );

  await Promise.all(
    ([
      ['demo-rec-v1', 'Camioneta Demo 1', 'ABC-1234'],
      ['demo-rec-v2', 'Camioneta Demo 2', 'XYZ-5678'],
    ] as const).map(([id, nombre, patente]) =>
      prisma.recurso.upsert({
        where: { id },
        update: {},
        create: {
          id,
          nombre,
          tipo: 'VEHICULO',
          patente,
          departamentoId: departamento.id,
          capacidad: '4 personas',
        },
      })
    )
  );

  // ---------- Asignaciones ----------
  const asignacionesDemo = [
    [0, 0, 0, -7, -4, 'Levantamiento de señales'],
    [0, 1, 0, -5, -1, 'Configuración de RTU'],
    [0, 2, 0, -3, 3, 'Pruebas de campo'],
    [0, 3, 1, -2, 2, 'Redacción de informe parcial'],
    [0, 4, 0, 1, 5, 'Despliegue en sitio'],
    [0, 5, 3, 3, 6, 'Mantenimiento preventivo'],
    [1, 6, 3, -6, -2, 'Diagnóstico de equipos'],
    [1, 7, 1, -4, 1, 'Actualización de fichas'],
    [1, 0, 3, -1, 4, 'Reposición de componentes'],
    [1, 1, 2, 2, 7, 'Capacitación al equipo'],
    [2, 2, 1, 8, 12, 'Recopilación de antecedentes'],
    [2, 3, 1, 11, 16, 'Análisis de capacidad'],
    [2, 4, 2, 14, 18, 'Taller de validación'],
    [2, 5, 1, 17, 22, 'Informe final'],
  ] as const;

  for (const [i, item] of asignacionesDemo.entries()) {
    const [personaIndex, recursoIndex, tipoIndex, inicio, fin, nombre] = item;
    await prisma.asignacion.upsert({
      where: { id: `demo-asig-${i + 1}` },
      update: {},
      create: {
        id: `demo-asig-${i + 1}`,
        proyectoId: proyectos[personaIndex].id,
        recursoId: personas[recursoIndex].id,
        tipoActividadId: tipos[tipoIndex].id,
        nombre,
        fechaInicio: dia(inicio),
        fechaFin: dia(fin),
        todoDia: true,
        ubicacion: 'Planta Demo',
        region: 'Región Metropolitana',
        estado: 'CONFIRMADA',
        creadoPorId: ADMIN_ID,
        prioridad: i % 3,
      },
    });
  }

  // Etiquetas de ejemplo en las primeras asignaciones
  await prisma.asignacionEtiqueta.upsert({
    where: { asignacionId_etiquetaId: { asignacionId: 'demo-asig-1', etiquetaId: etiquetas[0].id } },
    update: {},
    create: { asignacionId: 'demo-asig-1', etiquetaId: etiquetas[0].id },
  });
  await prisma.proyectoEtiqueta.upsert({
    where: { proyectoId_etiquetaId: { proyectoId: proyectos[0].id, etiquetaId: etiquetas[1].id } },
    update: {},
    create: { proyectoId: proyectos[0].id, etiquetaId: etiquetas[1].id },
  });

  // ---------- WBS de ejemplo en el proyecto 1 ----------
  await prisma.actividad.upsert({
    where: { id: 'demo-act-1' },
    update: {},
    create: {
      id: 'demo-act-1',
      proyectoId: proyectos[0].id,
      nombre: 'Implantación de campo',
      descripcion: 'Actividad de demostración',
      orden: 1,
      percentComplete: 50,
    },
  });
  await prisma.tarea.upsert({
    where: { id: 'demo-tarea-1' },
    update: {},
    create: {
      id: 'demo-tarea-1',
      actividadId: 'demo-act-1',
      nombre: 'Instalación de RTU',
      orden: 1,
      completada: true,
      percentComplete: 100,
    },
  });
  await prisma.subtarea.upsert({
    where: { id: 'demo-sub-1' },
    update: {},
    create: {
      id: 'demo-sub-1',
      tareaId: 'demo-tarea-1',
      nombre: 'Montaje de armario',
      orden: 1,
      completada: true,
    },
  });

  console.log('✅ Seed de demostración completado');
  console.log(`   - ${personas.length} personas + 2 vehículos ficticios`);
  console.log(`   - ${proyectos.length} proyectos y ${asignacionesDemo.length} asignaciones`);
  console.log('   - Usuario: admin@operaciones.local');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de demostración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
