-- Materiales / activos por proyecto (base del futuro módulo de inventario)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "notas" TEXT,
    "creadoPorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "materiales_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "materiales_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "materiales_proyectoId_idx" ON "materiales"("proyectoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
