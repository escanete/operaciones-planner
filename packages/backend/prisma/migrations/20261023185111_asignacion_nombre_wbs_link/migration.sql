-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_asignaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "tipoActividadId" TEXT NOT NULL,
    "nombre" TEXT,
    "actividadId" TEXT,
    "tareaId" TEXT,
    "subtareaId" TEXT,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "todoDia" BOOLEAN NOT NULL DEFAULT true,
    "ubicacion" TEXT,
    "region" TEXT,
    "camionetaId" TEXT,
    "alojamiento" BOOLEAN NOT NULL DEFAULT false,
    "vueloId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "asignaciones_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_tipoActividadId_fkey" FOREIGN KEY ("tipoActividadId") REFERENCES "tipos_actividad" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_subtareaId_fkey" FOREIGN KEY ("subtareaId") REFERENCES "subtareas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_camionetaId_fkey" FOREIGN KEY ("camionetaId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_asignaciones" ("actualizadoAt", "alojamiento", "camionetaId", "creadoAt", "creadoPorId", "estado", "fechaFin", "fechaInicio", "horaFin", "horaInicio", "id", "notas", "prioridad", "proyectoId", "recursoId", "region", "tipoActividadId", "todoDia", "ubicacion", "version", "vueloId") SELECT "actualizadoAt", "alojamiento", "camionetaId", "creadoAt", "creadoPorId", "estado", "fechaFin", "fechaInicio", "horaFin", "horaInicio", "id", "notas", "prioridad", "proyectoId", "recursoId", "region", "tipoActividadId", "todoDia", "ubicacion", "version", "vueloId" FROM "asignaciones";
DROP TABLE "asignaciones";
ALTER TABLE "new_asignaciones" RENAME TO "asignaciones";
CREATE INDEX "asignaciones_proyectoId_fechaInicio_fechaFin_idx" ON "asignaciones"("proyectoId", "fechaInicio", "fechaFin");
CREATE INDEX "asignaciones_recursoId_fechaInicio_fechaFin_idx" ON "asignaciones"("recursoId", "fechaInicio", "fechaFin");
CREATE INDEX "asignaciones_fechaInicio_fechaFin_idx" ON "asignaciones"("fechaInicio", "fechaFin");
CREATE INDEX "asignaciones_estado_idx" ON "asignaciones"("estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
