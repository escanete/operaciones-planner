-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "proyectos_subprojectId_fkey" FOREIGN KEY ("subprojectId") REFERENCES "proyectos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_proyectos" ("activo", "clienteId", "codigo", "color", "createdAt", "descripcion", "estado", "fechaFin", "fechaInicio", "id", "nombre", "updatedAt") SELECT "activo", "clienteId", "codigo", "color", "createdAt", "descripcion", "estado", "fechaFin", "fechaInicio", "id", "nombre", "updatedAt" FROM "proyectos";
DROP TABLE "proyectos";
ALTER TABLE "new_proyectos" RENAME TO "proyectos";
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");
CREATE INDEX "proyectos_clienteId_idx" ON "proyectos"("clienteId");
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");
CREATE INDEX "proyectos_subprojectId_idx" ON "proyectos"("subprojectId");
CREATE TABLE "new_recursos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'PERSONA',
    "cargoId" TEXT,
    "departamentoId" TEXT NOT NULL,
    "equipoId" TEXT,
    "patente" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "capacidad" TEXT,
    "roleLevel" INTEGER NOT NULL DEFAULT 0,
    "areaId" TEXT,
    "fechaIngreso" DATETIME,
    "fechaEgreso" DATETIME,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "colorCalendario" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "recursos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recursos_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recursos_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_recursos" ("activo", "apellido", "capacidad", "cargoId", "codigo", "colorCalendario", "createdAt", "departamentoId", "email", "equipoId", "fechaEgreso", "fechaIngreso", "id", "marca", "modelo", "nombre", "patente", "telefono", "tipo", "updatedAt") SELECT "activo", "apellido", "capacidad", "cargoId", "codigo", "colorCalendario", "createdAt", "departamentoId", "email", "equipoId", "fechaEgreso", "fechaIngreso", "id", "marca", "modelo", "nombre", "patente", "telefono", "tipo", "updatedAt" FROM "recursos";
DROP TABLE "recursos";
ALTER TABLE "new_recursos" RENAME TO "recursos";
CREATE UNIQUE INDEX "recursos_codigo_key" ON "recursos"("codigo");
CREATE UNIQUE INDEX "recursos_email_key" ON "recursos"("email");
CREATE UNIQUE INDEX "recursos_patente_key" ON "recursos"("patente");
CREATE INDEX "recursos_departamentoId_activo_idx" ON "recursos"("departamentoId", "activo");
CREATE INDEX "recursos_equipoId_idx" ON "recursos"("equipoId");
CREATE INDEX "recursos_tipo_activo_idx" ON "recursos"("tipo", "activo");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" DATETIME,
    "roleLevel" INTEGER NOT NULL DEFAULT 0,
    "departmentId" TEXT,
    "areaId" TEXT,
    "recursoId" TEXT,
    CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departamentos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("activo", "apellido", "createdAt", "email", "emailVerified", "id", "image", "name", "recursoId", "rol", "ultimoAcceso", "updatedAt") SELECT "activo", "apellido", "createdAt", "email", "emailVerified", "id", "image", "name", "recursoId", "rol", "ultimoAcceso", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_recursoId_key" ON "users"("recursoId");
CREATE INDEX "users_rol_activo_idx" ON "users"("rol", "activo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
