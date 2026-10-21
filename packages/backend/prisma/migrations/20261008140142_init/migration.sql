-- CreateTable
CREATE TABLE "departamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "descripcion" TEXT,
    "liderId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "equipos_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "equipos_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "tipos_actividad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#00B050',
    "icono" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "requiereProyecto" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "direccion" TEXT,
    "contacto" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "proyectos" (
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
    CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "recursos" (
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

-- CreateTable
CREATE TABLE "disponibilidades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recursoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "disponibilidades_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recursoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'VACACIONES',
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "todoDia" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "descripcion" TEXT,
    "aprobada" BOOLEAN NOT NULL DEFAULT false,
    "aprobadorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ausencias_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "proyectoId" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "tipoActividadId" TEXT NOT NULL,
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
    CONSTRAINT "asignaciones_camionetaId_fkey" FOREIGN KEY ("camionetaId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
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
    "recursoId" TEXT,
    CONSTRAINT "users_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_preferencias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tema" TEXT NOT NULL DEFAULT 'system',
    "vistaPorDefecto" TEXT NOT NULL DEFAULT 'semanal',
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Santiago',
    "notificaciones" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferencias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "antes" TEXT,
    "despues" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditorias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_nombre_key" ON "departamentos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_departamentoId_nombre_key" ON "equipos"("departamentoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_nombre_key" ON "cargos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_actividad_nombre_key" ON "tipos_actividad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_nombre_key" ON "clientes"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_key" ON "clientes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE INDEX "proyectos_clienteId_idx" ON "proyectos"("clienteId");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "recursos_codigo_key" ON "recursos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "recursos_email_key" ON "recursos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "recursos_patente_key" ON "recursos"("patente");

-- CreateIndex
CREATE INDEX "recursos_departamentoId_activo_idx" ON "recursos"("departamentoId", "activo");

-- CreateIndex
CREATE INDEX "recursos_equipoId_idx" ON "recursos"("equipoId");

-- CreateIndex
CREATE INDEX "recursos_tipo_activo_idx" ON "recursos"("tipo", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidades_recursoId_diaSemana_key" ON "disponibilidades"("recursoId", "diaSemana");

-- CreateIndex
CREATE INDEX "ausencias_recursoId_fechaInicio_fechaFin_idx" ON "ausencias"("recursoId", "fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "asignaciones_proyectoId_fechaInicio_fechaFin_idx" ON "asignaciones"("proyectoId", "fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "asignaciones_recursoId_fechaInicio_fechaFin_idx" ON "asignaciones"("recursoId", "fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "asignaciones_fechaInicio_fechaFin_idx" ON "asignaciones"("fechaInicio", "fechaFin");

-- CreateIndex
CREATE INDEX "asignaciones_estado_idx" ON "asignaciones"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_recursoId_key" ON "users"("recursoId");

-- CreateIndex
CREATE INDEX "users_rol_activo_idx" ON "users"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferencias_userId_key" ON "user_preferencias"("userId");

-- CreateIndex
CREATE INDEX "auditorias_entidad_entidadId_idx" ON "auditorias"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "auditorias_userId_createdAt_idx" ON "auditorias"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "auditorias_createdAt_idx" ON "auditorias"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_clave_key" ON "configuracion"("clave");

-- CreateIndex
CREATE INDEX "configuracion_clave_idx" ON "configuracion"("clave");
