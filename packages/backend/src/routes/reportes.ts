import { Hono } from 'hono';
import { prisma } from '../lib/db.js';
import { getUser } from '../types/index.js';
import type { CargaTrabajoResumen, OcupacionProyectoResumen } from '@operaciones-planner/shared';

const reportesRoutes = new Hono();

reportesRoutes.get('/utilizacion-recursos', async (c) => {
  const query = c.req.query();
  const desde = query.desde;
  const hasta = query.hasta;

  if (!desde || !hasta) {
    return c.json({ error: 'Parámetros desde y hasta son requeridos' }, 400);
  }

  const fechaInicio = new Date(desde);
  const fechaFin = new Date(hasta);
  const diasPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const recursos = await prisma.recurso.findMany({
    where: { activo: true, tipo: 'PERSONA' },
    include: {
      departamento: { select: { nombre: true } },
      equipo: { select: { nombre: true } },
      asignaciones: {
        where: {
          fechaInicio: { lte: fechaFin },
          fechaFin: { gte: fechaInicio },
          estado: { not: 'CANCELADA' },
        },
        include: { proyecto: true, tipoActividad: true },
      },
      disponibilidades: { where: { activa: true } },
    },
  });

  const resultados: CargaTrabajoResumen[] = recursos.map(r => {
    const horasAsignadas = r.asignaciones.reduce((acc, a) => {
      const diasAsignacion = Math.ceil((a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return acc + diasAsignacion * (a.todoDia ? 8 : 4);
    }, 0);

    const horasDisponiblesSemana = r.disponibilidades.length > 0
      ? r.disponibilidades.reduce((acc, d) => {
          const [h1, m1] = d.horaInicio.split(':').map(Number);
          const [h2, m2] = d.horaFin.split(':').map(Number);
          return acc + (h2 - h1 + (m2 - m1) / 60);
        }, 0)
      : 40; // jornada por defecto

    const semanasPeriodo = Math.ceil(diasPeriodo / 7);
    const horasDisponibles = horasDisponiblesSemana * semanasPeriodo;
    const porcentajeOcupacion = horasDisponibles > 0 ? Math.round((horasAsignadas / horasDisponibles) * 100) : 0;

    let alerta = 'NORMAL';
    if (porcentajeOcupacion >= 120) alerta = 'CRITICA_120';
    else if (porcentajeOcupacion >= 100) alerta = 'SOBRECARGA';
    else if (porcentajeOcupacion >= 80) alerta = 'ALERTA_80';
    else if (porcentajeOcupacion === 0) alerta = 'SIN_ASIGNAR';

    const detallePorProyecto = r.asignaciones.reduce((acc, a) => {
      const existing = acc.find(p => p.proyectoId === a.proyectoId);
      const dias = (a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24) + 1;
      const horas = Math.round(dias * (a.todoDia ? 8 : 4) * 10) / 10;
      if (existing) {
        existing.horas += horas;
      } else {
        acc.push({ proyectoId: a.proyectoId, proyectoNombre: a.proyecto.nombre, horas });
      }
      return acc;
    }, [] as { proyectoId: string; proyectoNombre: string; horas: number }[]);

    const detallePorTipoActividad = r.asignaciones.reduce((acc, a) => {
      const existing = acc.find(t => t.tipoActividadId === a.tipoActividadId);
      const dias = (a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24) + 1;
      const horas = Math.round(dias * (a.todoDia ? 8 : 4) * 10) / 10;
      if (existing) {
        existing.horas += horas;
      } else {
        acc.push({ tipoActividadId: a.tipoActividadId, nombre: a.tipoActividad.nombre, horas });
      }
      return acc;
    }, [] as { tipoActividadId: string; nombre: string; horas: number }[]);

    return {
      recursoId: r.id,
      recursoNombre: `${r.nombre} ${r.apellido ?? ''}`.trim(),
      equipoNombre: r.equipo?.nombre,
      departamentoNombre: r.departamento?.nombre,
      periodo: { desde, hasta },
      horasAsignadas: Math.round(horasAsignadas * 10) / 10,
      horasDisponibles: Math.round(horasDisponibles * 10) / 10,
      porcentajeOcupacion,
      alerta,
      detallePorProyecto,
      detallePorTipoActividad,
    };
  });

  return c.json({
    periodo: { desde, hasta },
    agruparPor: query.agruparPor ?? 'recurso',
    totalRecursos: resultados.length,
    recursos: resultados,
  });
});

reportesRoutes.get('/ocupacion-proyectos', async (c) => {
  const query = c.req.query();
  const desde = query.desde;
  const hasta = query.hasta;

  if (!desde || !hasta) {
    return c.json({ error: 'Parámetros desde y hasta son requeridos' }, 400);
  }

  const fechaInicio = new Date(desde);
  const fechaFin = new Date(hasta);
  const diasPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const proyectos = await prisma.proyecto.findMany({
    where: { activo: true },
    include: {
      cliente: true,
      asignaciones: {
        where: {
          fechaInicio: { lte: fechaFin },
          fechaFin: { gte: fechaInicio },
          estado: { not: 'CANCELADA' },
        },
        include: { recurso: true },
      },
    },
  });

  const resultados: OcupacionProyectoResumen[] = proyectos.map(p => {
    const recursosUnicos = [...new Set(p.asignaciones.map(a => a.recursoId))];
    const horasTotales = p.asignaciones.reduce((acc, a) => {
      const dias = Math.ceil((a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return acc + dias * (a.todoDia ? 8 : 4);
    }, 0);

    const horasPorRecurso = p.asignaciones.reduce((acc, a) => {
      const existing = acc.find(r => r.recursoId === a.recursoId);
      const dias = (a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24) + 1;
      const horas = Math.round(dias * (a.todoDia ? 8 : 4) * 10) / 10;
      if (existing) {
        existing.horas += horas;
      } else {
        acc.push({ recursoId: a.recursoId, nombre: `${a.recurso.nombre} ${a.recurso.apellido ?? ''}`.trim(), horas });
      }
      return acc;
    }, [] as { recursoId: string; nombre: string; horas: number }[]);

    return {
      proyectoId: p.id,
      proyectoNombre: p.nombre,
      clienteNombre: p.cliente?.nombre,
      periodo: { desde, hasta },
      diasTotales: diasPeriodo,
      recursosAsignados: recursosUnicos.length,
      horasTotales: Math.round(horasTotales * 10) / 10,
      horasPorRecurso,
    };
  });

  return c.json({
    periodo: { desde, hasta },
    totalProyectos: resultados.length,
    proyectos: resultados,
  });
});

reportesRoutes.get('/carga-equipos', async (c) => {
  const query = c.req.query();
  const desde = query.desde;
  const hasta = query.hasta;

  if (!desde || !hasta) {
    return c.json({ error: 'Parámetros desde y hasta son requeridos' }, 400);
  }

  const fechaInicio = new Date(desde);
  const fechaFin = new Date(hasta);

  const equipos = await prisma.equipo.findMany({
    where: { activo: true },
    include: {
      departamento: true,
      recursos: {
        where: { activo: true, tipo: 'PERSONA' },
        include: {
          asignaciones: {
            where: {
              fechaInicio: { lte: fechaFin },
              fechaFin: { gte: fechaInicio },
              estado: { not: 'CANCELADA' },
            },
          },
          disponibilidades: { where: { activa: true } },
        },
      },
    },
  });

  const resultados = equipos.map(e => {
    const horasAsignadas = e.recursos.reduce((acc, r) => {
      return acc + r.asignaciones.reduce((acc2, a) => {
        const dias = Math.ceil((a.fechaFin.getTime() - a.fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return acc2 + dias * (a.todoDia ? 8 : 4);
      }, 0);
    }, 0);

    const horasDisponibles = e.recursos.reduce((acc, r) => {
      const horasSemana = r.disponibilidades.reduce((acc2, d) => {
        const [h1] = d.horaInicio.split(':').map(Number);
        const [h2] = d.horaFin.split(':').map(Number);
        return acc2 + (h2 - h1);
      }, 0);
      return acc + horasSemana;
    }, 0) * Math.ceil(((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) / 7);

    return {
      equipoId: e.id,
      equipoNombre: e.nombre,
      departamentoNombre: e.departamento?.nombre,
      totalRecursos: e.recursos.length,
      horasAsignadas: Math.round(horasAsignadas * 10) / 10,
      horasDisponibles: Math.round(horasDisponibles * 10) / 10,
      porcentajeOcupacion: horasDisponibles > 0 ? Math.round((horasAsignadas / horasDisponibles) * 100) : 0,
      recursosSinAsignar: e.recursos.filter(r => r.asignaciones.length === 0).length,
    };
  });

  return c.json({
    periodo: { desde, hasta },
    totalEquipos: resultados.length,
    equipos: resultados,
  });
});

export { reportesRoutes };
