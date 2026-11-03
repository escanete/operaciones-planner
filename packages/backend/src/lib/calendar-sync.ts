import { env } from './env.js';
import { prisma } from './db.js';
import {
  GraphRequestError,
  graphRequest,
} from './msgraph.js';
import { getAccessTokenUsuario, registrarSyncUsuario } from './graph-tokens.js';

/* ============================================================
   Sincronización de asignaciones con el calendario de Outlook

   Cada asignación se refleja como un evento en el calendario del
   usuario de la app que tiene vinculada la ficha de persona
   asignada (User.recursoId = Asignacion.recursoId).

   - Crear asignación   → crea evento
   - Editar / mover     → actualiza evento
   - Cancelar / borrar  → elimina evento
   ============================================================ */

export type ResultadoSync =
  | { estado: 'SINCRONIZADO'; eventId: string; webLink?: string }
  | { estado: 'OMITIDO'; motivo: string }
  | { estado: 'ERROR'; detalle: string };

interface AsignacionParaCalendario {
  id: string;
  proyectoId: string;
  recursoId: string;
  nombre: string | null;
  fechaInicio: Date;
  fechaFin: Date;
  horaInicio: string | null;
  horaFin: string | null;
  todoDia: boolean;
  ubicacion: string | null;
  region: string | null;
  notas: string | null;
  estado: string;
  graphEventId: string | null;
  graphEventUserId: string | null;
  proyecto: { nombre: string; color: string | null };
  tipoActividad: { nombre: string; color: string };
  recurso: { nombre: string; apellido: string | null; email: string | null };
}

interface EventoOutlook {
  subject: string;
  body: { contentType: 'HTML'; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  location?: { displayName: string };
  categories: string[];
  transactionId: string;
  showAs: string;
  reminderMinutesBeforeStart?: number;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setUTCDate(copia.getUTCDate() + dias);
  return copia;
}

function fechaHora(fecha: Date, hora: string): string {
  return `${fechaISO(fecha)}T${hora}:00`;
}

function construirEvento(a: AsignacionParaCalendario): EventoOutlook {
  const actividad = a.nombre?.trim() || a.tipoActividad.nombre;
  const responsable = `${a.recurso.nombre} ${a.recurso.apellido ?? ''}`.trim();

  const detalle: string[] = [
    `<p><strong>Proyecto:</strong> ${escaparHtml(a.proyecto.nombre)}</p>`,
    `<p><strong>Actividad:</strong> ${escaparHtml(actividad)}</p>`,
    `<p><strong>Tipo:</strong> ${escaparHtml(a.tipoActividad.nombre)}</p>`,
    `<p><strong>Responsable:</strong> ${escaparHtml(responsable)}</p>`,
  ];
  if (a.ubicacion) detalle.push(`<p><strong>Ubicación:</strong> ${escaparHtml(a.ubicacion)}</p>`);
  if (a.region) detalle.push(`<p><strong>Región:</strong> ${escaparHtml(a.region)}</p>`);
  if (a.notas) detalle.push(`<p><strong>Notas:</strong> ${escaparHtml(a.notas)}</p>`);
  detalle.push(
    `<p><a href="${escaparHtml(
      `${env.FRONTEND_URL}/proyectos/${a.proyectoId}`
    )}">Abrir proyecto en el Planificador</a></p>`,
    '<hr />',
    '<p style="color:#64748b;font-size:12px">Evento generado automáticamente por el Planificador de Operaciones. Los cambios en la asignación se reflejan en este evento.</p>'
  );

  let inicio: string;
  let fin: string;
  let todoDia: boolean;

  if (a.todoDia) {
    todoDia = true;
    inicio = `${fechaISO(a.fechaInicio)}T00:00:00`;
    // En Outlook el fin de un evento de todo el día es exclusivo
    fin = `${fechaISO(sumarDias(a.fechaFin, 1))}T00:00:00`;
  } else {
    todoDia = false;
    const horaInicio = a.horaInicio || '08:00';
    const horaFin = a.horaFin || '18:00';
    inicio = fechaHora(a.fechaInicio, horaInicio);
    fin = fechaHora(a.fechaFin, horaFin);
    if (new Date(fin) <= new Date(inicio)) {
      const [h, m] = horaInicio.split(':').map(Number);
      fin = fechaHora(a.fechaInicio, `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  const evento: EventoOutlook = {
    subject: `${a.proyecto.nombre} · ${actividad}`.slice(0, 250),
    body: { contentType: 'HTML', content: detalle.join('') },
    start: { dateTime: inicio, timeZone: env.MS_GRAPH_TIMEZONE },
    end: { dateTime: fin, timeZone: env.MS_GRAPH_TIMEZONE },
    isAllDay: todoDia,
    categories: ['Planificador Operaciones'],
    transactionId: `planner-asignacion-${a.id}`,
    showAs: a.estado === 'BORRADOR' || a.estado === 'CONFLICTO' ? 'tentative' : 'busy',
  };

  if (a.ubicacion) evento.location = { displayName: a.ubicacion };
  if (!todoDia) evento.reminderMinutesBeforeStart = 30;

  return evento;
}

async function cargarAsignacion(id: string): Promise<AsignacionParaCalendario | null> {
  return prisma.asignacion.findUnique({
    where: { id },
    select: {
      id: true,
      proyectoId: true,
      recursoId: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true,
      horaInicio: true,
      horaFin: true,
      todoDia: true,
      ubicacion: true,
      region: true,
      notas: true,
      estado: true,
      graphEventId: true,
      graphEventUserId: true,
      proyecto: { select: { nombre: true, color: true } },
      tipoActividad: { select: { nombre: true, color: true } },
      recurso: { select: { nombre: true, apellido: true, email: true } },
    },
  });
}

async function usuarioDelRecurso(recursoId: string) {
  return prisma.user.findFirst({
    where: { recursoId, activo: true },
    select: {
      id: true,
      email: true,
      graphToken: { select: { calendarioActivo: true } },
    },
  });
}

async function marcarAsignacion(
  id: string,
  data: {
    graphEventId?: string | null;
    graphEventWebLink?: string | null;
    graphEventUserId?: string | null;
    graphSyncEstado: string;
    graphSyncError?: string | null;
  }
): Promise<void> {
  await prisma.asignacion.update({
    where: { id },
    data: { ...data, graphSyncAt: new Date() },
  });
}

/** Borra el evento de Outlook asociado a una asignación (si existe). */
export async function eliminarEventoAsignacion(
  asignacionId: string,
  asignacion?: AsignacionParaCalendario | null
): Promise<ResultadoSync> {
  const a = asignacion ?? (await cargarAsignacion(asignacionId));
  if (!a) return { estado: 'OMITIDO', motivo: 'Asignación no encontrada' };

  const usuarioId = a.graphEventUserId ?? (await usuarioDelRecurso(a.recursoId))?.id;
  if (!a.graphEventId || !usuarioId) {
    if (a.graphEventId) {
      await marcarAsignacion(a.id, {
        graphEventId: null,
        graphEventWebLink: null,
        graphEventUserId: null,
        graphSyncEstado: 'OMITIDO',
        graphSyncError: null,
      });
    }
    return { estado: 'OMITIDO', motivo: 'La asignación no tenía evento en Outlook' };
  }

  try {
    const token = await getAccessTokenUsuario(usuarioId);
    if (token) {
      try {
        await graphRequest(token, `/me/events/${encodeURIComponent(a.graphEventId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        // Si el evento ya no existe (el usuario lo borró a mano), seguimos
        if (!(err instanceof GraphRequestError && err.status === 404)) throw err;
      }
    }

    await marcarAsignacion(a.id, {
      graphEventId: null,
      graphEventWebLink: null,
      graphEventUserId: null,
      graphSyncEstado: 'OMITIDO',
      graphSyncError: null,
    });

    return { estado: 'OMITIDO', motivo: 'Evento eliminado de Outlook' };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    await marcarAsignacion(a.id, {
      graphSyncEstado: 'ERROR',
      graphSyncError: detalle.slice(0, 500),
    });
    return { estado: 'ERROR', detalle };
  }
}

/**
 * Crea o actualiza el evento de Outlook de una asignación.
 * Nunca lanza: los errores quedan registrados en la asignación para que
 * no interrumpan la creación/edición de la planificación.
 */
export async function sincronizarAsignacion(asignacionId: string): Promise<ResultadoSync> {
  if (!env.MS_GRAPH_CALENDAR_SYNC) {
    return { estado: 'OMITIDO', motivo: 'Sincronización de calendario desactivada en el servidor' };
  }

  const a = await cargarAsignacion(asignacionId);
  if (!a) return { estado: 'OMITIDO', motivo: 'Asignación no encontrada' };

  if (a.estado === 'CANCELADA') {
    return eliminarEventoAsignacion(a.id, a);
  }

  const usuario = await usuarioDelRecurso(a.recursoId);
  if (!usuario) {
    await marcarAsignacion(a.id, {
      graphSyncEstado: 'OMITIDO',
      graphSyncError: 'El recurso no tiene un usuario vinculado en la plataforma',
    });
    return { estado: 'OMITIDO', motivo: 'El recurso no tiene usuario vinculado' };
  }

  if (!usuario.graphToken) {
    await marcarAsignacion(a.id, {
      graphSyncEstado: 'OMITIDO',
      graphSyncError: 'El usuario no ha conectado su calendario de Outlook',
    });
    return { estado: 'OMITIDO', motivo: 'El usuario no conectó su calendario' };
  }

  if (!usuario.graphToken.calendarioActivo) {
    await marcarAsignacion(a.id, {
      graphSyncEstado: 'OMITIDO',
      graphSyncError: 'La sincronización de calendario está desactivada para el usuario',
    });
    return { estado: 'OMITIDO', motivo: 'Calendario desactivado por el usuario' };
  }

  try {
    const token = await getAccessTokenUsuario(usuario.id);
    if (!token) {
      throw new Error('No se pudo obtener un token de Microsoft para el usuario');
    }

    // Si la asignación cambió de persona, el evento anterior vive en otro
    // calendario: se elimina antes de crear el nuevo.
    if (a.graphEventId && a.graphEventUserId && a.graphEventUserId !== usuario.id) {
      try {
        const tokenAnterior = await getAccessTokenUsuario(a.graphEventUserId);
        if (tokenAnterior) {
          await graphRequest(tokenAnterior, `/me/events/${encodeURIComponent(a.graphEventId)}`, {
            method: 'DELETE',
          });
        }
      } catch (err) {
        console.warn('[calendario] No se pudo borrar el evento del calendario anterior:', err);
      }
    }

    const evento = construirEvento(a);
    let eventId = a.graphEventId && a.graphEventUserId === usuario.id ? a.graphEventId : null;
    let webLink: string | undefined;

    if (eventId) {
      try {
        const actualizado = await graphRequest<{ id: string; webLink?: string }>(
          token,
          `/me/events/${encodeURIComponent(eventId)}`,
          { method: 'PATCH', body: JSON.stringify(evento) }
        );
        webLink = actualizado.webLink;
      } catch (err) {
        if (!(err instanceof GraphRequestError && err.status === 404)) throw err;
        eventId = null; // lo borraron en Outlook: se recrea
      }
    }

    if (!eventId) {
      const creado = await graphRequest<{ id: string; webLink?: string }>(token, '/me/events', {
        method: 'POST',
        body: JSON.stringify(evento),
      });
      eventId = creado.id;
      webLink = creado.webLink;
    }

    await marcarAsignacion(a.id, {
      graphEventId: eventId,
      graphEventWebLink: webLink ?? null,
      graphEventUserId: usuario.id,
      graphSyncEstado: 'SINCRONIZADO',
      graphSyncError: null,
    });
    await registrarSyncUsuario(usuario.id, null);

    return { estado: 'SINCRONIZADO', eventId, webLink };
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error('[calendario] Error sincronizando asignación', a.id, detalle);

    await marcarAsignacion(a.id, {
      graphSyncEstado: 'ERROR',
      graphSyncError: detalle.slice(0, 500),
    });
    await registrarSyncUsuario(usuario.id, detalle);

    return { estado: 'ERROR', detalle };
  }
}

/** Sincroniza las asignaciones del usuario en una ventana de fechas. */
export async function sincronizarAgendaUsuario(
  userId: string,
  opciones?: { diasAtras?: number; diasAdelante?: number }
): Promise<{ total: number; sincronizadas: number; omitidas: number; errores: number; detalle: ResultadoSync[] }> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { recursoId: true },
  });

  if (!usuario?.recursoId) {
    return { total: 0, sincronizadas: 0, omitidas: 0, errores: 0, detalle: [] };
  }

  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - (opciones?.diasAtras ?? 30));
  const hasta = new Date();
  hasta.setUTCDate(hasta.getUTCDate() + (opciones?.diasAdelante ?? 180));

  const asignaciones = await prisma.asignacion.findMany({
    where: {
      recursoId: usuario.recursoId,
      fechaFin: { gte: desde },
      fechaInicio: { lte: hasta },
    },
    select: { id: true },
    orderBy: { fechaInicio: 'asc' },
  });

  const detalle: ResultadoSync[] = [];
  for (const asignacion of asignaciones) {
    detalle.push(await sincronizarAsignacion(asignacion.id));
  }

  return {
    total: asignaciones.length,
    sincronizadas: detalle.filter((d) => d.estado === 'SINCRONIZADO').length,
    omitidas: detalle.filter((d) => d.estado === 'OMITIDO').length,
    errores: detalle.filter((d) => d.estado === 'ERROR').length,
    detalle,
  };
}
