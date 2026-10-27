-- Catálogo global de materiales (base del futuro módulo de inventario)
-- + vínculo Material.catalogoId (instancia por proyecto → ítem del catálogo)
-- Nota: SQLite no soporta ALTER TABLE ADD CONSTRAINT, por lo que la tabla
-- "materiales" se recrea con la nueva columna/FK y se copian los datos.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "material_catalogos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "unidadBase" TEXT,
    "descripcion" TEXT,
    "recursoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "material_catalogos_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "material_catalogos_nombre_key" ON "material_catalogos"("nombre");

-- RecreateTable: materiales + columna catalogoId con FK
ALTER TABLE "materiales" RENAME TO "materiales_old";
CREATE TABLE "materiales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "cantidad" REAL NOT NULL DEFAULT 1,
    "unidad" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "recursoId" TEXT,
    "catalogoId" TEXT,
    "notas" TEXT,
    "creadoPorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "materiales_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "materiales_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "materiales_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "material_catalogos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "materiales" ("id", "proyectoId", "nombre", "descripcion", "categoria", "cantidad", "unidad", "estado", "recursoId", "notas", "creadoPorId", "createdAt", "updatedAt")
SELECT "id", "proyectoId", "nombre", "descripcion", "categoria", "cantidad", "unidad", "estado", "recursoId", "notas", "creadoPorId", "createdAt", "updatedAt" FROM "materiales_old";
DROP TABLE "materiales_old";

-- CreateIndex
CREATE INDEX "materiales_proyectoId_idx" ON "materiales"("proyectoId");
CREATE INDEX "materiales_catalogoId_idx" ON "materiales"("catalogoId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
