-- Calendario de Outlook: token de Microsoft Graph por usuario y estado de
-- sincronización de cada asignación con el evento creado en Outlook.

CREATE TABLE "graph_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiraAt" DATETIME,
    "scope" TEXT,
    "cuentaMicrosoft" TEXT,
    "cuentaMicrosoftId" TEXT,
    "calendarioActivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSyncAt" DATETIME,
    "ultimoError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "graph_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "graph_tokens_userId_key" ON "graph_tokens"("userId");

ALTER TABLE "asignaciones" ADD COLUMN "graphEventId" TEXT;
ALTER TABLE "asignaciones" ADD COLUMN "graphEventWebLink" TEXT;
ALTER TABLE "asignaciones" ADD COLUMN "graphEventUserId" TEXT;
ALTER TABLE "asignaciones" ADD COLUMN "graphSyncEstado" TEXT;
ALTER TABLE "asignaciones" ADD COLUMN "graphSyncError" TEXT;
ALTER TABLE "asignaciones" ADD COLUMN "graphSyncAt" DATETIME;
