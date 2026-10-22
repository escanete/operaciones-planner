-- CreateTable
CREATE TABLE "actividades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "percentComplete" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "actividades_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actividadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" DATETIME,
    "fechaFin" DATETIME,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "percentComplete" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tareas_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subtareas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tareaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "subtareas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tareas_asignados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tareaId" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    CONSTRAINT "tareas_asignados_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tareas_asignados_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "actividades_proyectoId_idx" ON "actividades"("proyectoId");

-- CreateIndex
CREATE INDEX "tareas_actividadId_idx" ON "tareas"("actividadId");

-- CreateIndex
CREATE INDEX "subtareas_tareaId_idx" ON "subtareas"("tareaId");

-- CreateIndex
CREATE UNIQUE INDEX "tareas_asignados_tareaId_recursoId_key" ON "tareas_asignados"("tareaId", "recursoId");
