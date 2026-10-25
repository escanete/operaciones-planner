-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_actividades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "percentComplete" REAL NOT NULL DEFAULT 0,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "actividades_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_actividades" ("createdAt", "descripcion", "fechaFin", "fechaInicio", "id", "nombre", "orden", "percentComplete", "proyectoId", "updatedAt") SELECT "createdAt", "descripcion", "fechaFin", "fechaInicio", "id", "nombre", "orden", "percentComplete", "proyectoId", "updatedAt" FROM "actividades";
DROP TABLE "actividades";
ALTER TABLE "new_actividades" RENAME TO "actividades";
CREATE INDEX "actividades_proyectoId_idx" ON "actividades"("proyectoId");
CREATE TABLE "new_proyectos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "clienteId" TEXT,
    "descripcion" TEXT,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'PLANIFICACION',
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scheduledStart" DATETIME,
    "scheduledEnd" DATETIME,
    "percentComplete" REAL,
    "subprojectId" TEXT,
    "dependencies" TEXT,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "proyectos_subprojectId_fkey" FOREIGN KEY ("subprojectId") REFERENCES "proyectos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_proyectos" ("activo", "clienteId", "codigo", "color", "createdAt", "dependencies", "descripcion", "estado", "fechaFin", "fechaInicio", "id", "nombre", "percentComplete", "scheduledEnd", "scheduledStart", "subprojectId", "updatedAt") SELECT "activo", "clienteId", "codigo", "color", "createdAt", "dependencies", "descripcion", "estado", "fechaFin", "fechaInicio", "id", "nombre", "percentComplete", "scheduledEnd", "scheduledStart", "subprojectId", "updatedAt" FROM "proyectos";
DROP TABLE "proyectos";
ALTER TABLE "new_proyectos" RENAME TO "proyectos";
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");
CREATE INDEX "proyectos_clienteId_idx" ON "proyectos"("clienteId");
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");
CREATE INDEX "proyectos_subprojectId_idx" ON "proyectos"("subprojectId");
CREATE TABLE "new_subtareas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tareaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subtareas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subtareas" ("completada", "createdAt", "descripcion", "id", "nombre", "orden", "tareaId", "updatedAt") SELECT "completada", "createdAt", "descripcion", "id", "nombre", "orden", "tareaId", "updatedAt" FROM "subtareas";
DROP TABLE "subtareas";
ALTER TABLE "new_subtareas" RENAME TO "subtareas";
CREATE INDEX "subtareas_tareaId_idx" ON "subtareas"("tareaId");
CREATE TABLE "new_tareas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actividadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "percentComplete" REAL NOT NULL DEFAULT 0,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tareas_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tareas" ("actividadId", "completada", "createdAt", "descripcion", "fechaFin", "fechaInicio", "id", "nombre", "orden", "percentComplete", "updatedAt") SELECT "actividadId", "completada", "createdAt", "descripcion", "fechaFin", "fechaInicio", "id", "nombre", "orden", "percentComplete", "updatedAt" FROM "tareas";
DROP TABLE "tareas";
ALTER TABLE "new_tareas" RENAME TO "tareas";
CREATE INDEX "tareas_actividadId_idx" ON "tareas"("actividadId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
