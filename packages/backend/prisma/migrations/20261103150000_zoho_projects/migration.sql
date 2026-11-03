-- Zoho Projects: tokens por usuario y mapeos de entidades

CREATE TABLE "zoho_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiraAt" DATETIME,
    "scope" TEXT,
    "portalId" TEXT,
    "portalName" TEXT,
    "cuentaZoho" TEXT,
    "syncActivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSyncAt" DATETIME,
    "ultimoError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "zoho_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "zoho_tokens_userId_key" ON "zoho_tokens"("userId");

CREATE TABLE "zoho_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidad" TEXT NOT NULL,
    "entidadLocalId" TEXT NOT NULL,
    "zohoId" TEXT NOT NULL,
    "zohoPortalId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "zoho_mappings_entidad_entidadLocalId_zohoPortalId_key" ON "zoho_mappings"("entidad", "entidadLocalId", "zohoPortalId");
CREATE INDEX "zoho_mappings_zohoId_idx" ON "zoho_mappings"("zohoId");