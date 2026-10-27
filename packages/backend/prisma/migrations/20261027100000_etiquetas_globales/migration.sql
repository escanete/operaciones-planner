-- Etiquetas (estilo Zoho): catálogo global + unión con
-- proyectos, actividades, tareas, subtareas y asignaciones
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "etiquetas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748B',
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "etiquetas_nombre_key" ON "etiquetas"("nombre");

CREATE TABLE "proyecto_etiquetas" (
    "proyectoId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,
    CONSTRAINT "proyecto_etiquetas_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "proyecto_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("proyectoId", "etiquetaId")
);

CREATE TABLE "actividad_etiquetas" (
    "actividadId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,
    CONSTRAINT "actividad_etiquetas_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "actividad_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("actividadId", "etiquetaId")
);

CREATE TABLE "tarea_etiquetas" (
    "tareaId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,
    CONSTRAINT "tarea_etiquetas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tarea_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("tareaId", "etiquetaId")
);

CREATE TABLE "subtarea_etiquetas" (
    "subtareaId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,
    CONSTRAINT "subtarea_etiquetas_subtareaId_fkey" FOREIGN KEY ("subtareaId") REFERENCES "subtareas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subtarea_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("subtareaId", "etiquetaId")
);

CREATE TABLE "asignacion_etiquetas" (
    "asignacionId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,
    CONSTRAINT "asignacion_etiquetas_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "asignaciones" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignacion_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("asignacionId", "etiquetaId")
);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
