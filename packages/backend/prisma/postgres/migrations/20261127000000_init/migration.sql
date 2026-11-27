-- CreateTable
CREATE TABLE "departamentos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "color" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "descripcion" TEXT,
    "liderId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_actividad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#00B050',
    "icono" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "requiereProyecto" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "direccion" TEXT,
    "contacto" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "clienteId" TEXT,
    "descripcion" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'PLANIFICACION',
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "percentComplete" DOUBLE PRECISION,
    "subprojectId" TEXT,
    "dependencies" TEXT,
    "relevante" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748B',
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto_etiquetas" (
    "proyectoId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "proyecto_etiquetas_pkey" PRIMARY KEY ("proyectoId","etiquetaId")
);

-- CreateTable
CREATE TABLE "actividad_etiquetas" (
    "actividadId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "actividad_etiquetas_pkey" PRIMARY KEY ("actividadId","etiquetaId")
);

-- CreateTable
CREATE TABLE "tarea_etiquetas" (
    "tareaId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "tarea_etiquetas_pkey" PRIMARY KEY ("tareaId","etiquetaId")
);

-- CreateTable
CREATE TABLE "subtarea_etiquetas" (
    "subtareaId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "subtarea_etiquetas_pkey" PRIMARY KEY ("subtareaId","etiquetaId")
);

-- CreateTable
CREATE TABLE "asignacion_etiquetas" (
    "asignacionId" TEXT NOT NULL,
    "etiquetaId" TEXT NOT NULL,

    CONSTRAINT "asignacion_etiquetas_pkey" PRIMARY KEY ("asignacionId","etiquetaId")
);

-- CreateTable
CREATE TABLE "material_catalogos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "unidadBase" TEXT,
    "cantidadSugerida" DOUBLE PRECISION,
    "descripcion" TEXT,
    "recursoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_catalogos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiales" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "recursoId" TEXT,
    "catalogoId" TEXT,
    "notas" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recursos" (
    "id" TEXT NOT NULL,
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
    "fechaIngreso" TIMESTAMP(3),
    "fechaEgreso" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "colorCalendario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidades" (
    "id" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "disponibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'VACACIONES',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "todoDia" BOOLEAN NOT NULL DEFAULT true,
    "horaInicio" TEXT,
    "horaFin" TEXT,
    "descripcion" TEXT,
    "aprobada" BOOLEAN NOT NULL DEFAULT false,
    "aprobadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,
    "tipoActividadId" TEXT NOT NULL,
    "nombre" TEXT,
    "actividadId" TEXT,
    "tareaId" TEXT,
    "subtareaId" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
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
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "graphEventId" TEXT,
    "graphEventWebLink" TEXT,
    "graphEventUserId" TEXT,
    "graphSyncEstado" TEXT,
    "graphSyncError" TEXT,
    "graphSyncAt" TIMESTAMP(3),

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtareas" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "completada" BOOLEAN NOT NULL DEFAULT false,
    "relevante" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_asignados" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "recursoId" TEXT NOT NULL,

    CONSTRAINT "tareas_asignados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'OPERADOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "roleLevel" INTEGER NOT NULL DEFAULT 0,
    "departmentId" TEXT,
    "areaId" TEXT,
    "recursoId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiraAt" TIMESTAMP(3),
    "scope" TEXT,
    "cuentaMicrosoft" TEXT,
    "cuentaMicrosoftId" TEXT,
    "calendarioActivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSyncAt" TIMESTAMP(3),
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoho_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiraAt" TIMESTAMP(3),
    "scope" TEXT,
    "portalId" TEXT,
    "portalName" TEXT,
    "cuentaZoho" TEXT,
    "syncActivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimaSyncAt" TIMESTAMP(3),
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zoho_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zoho_mappings" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadLocalId" TEXT NOT NULL,
    "zohoId" TEXT NOT NULL,
    "zohoPortalId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zoho_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferencias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tema" TEXT NOT NULL DEFAULT 'system',
    "vistaPorDefecto" TEXT NOT NULL DEFAULT 'semanal',
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Santiago',
    "notificaciones" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "antes" TEXT,
    "despues" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "proyectos_subprojectId_idx" ON "proyectos"("subprojectId");

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_nombre_key" ON "etiquetas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "material_catalogos_nombre_key" ON "material_catalogos"("nombre");

-- CreateIndex
CREATE INDEX "materiales_proyectoId_idx" ON "materiales"("proyectoId");

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
CREATE INDEX "actividades_proyectoId_idx" ON "actividades"("proyectoId");

-- CreateIndex
CREATE INDEX "tareas_actividadId_idx" ON "tareas"("actividadId");

-- CreateIndex
CREATE INDEX "subtareas_tareaId_idx" ON "subtareas"("tareaId");

-- CreateIndex
CREATE UNIQUE INDEX "tareas_asignados_tareaId_recursoId_key" ON "tareas_asignados"("tareaId", "recursoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_recursoId_key" ON "users"("recursoId");

-- CreateIndex
CREATE INDEX "users_rol_activo_idx" ON "users"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "graph_tokens_userId_key" ON "graph_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "zoho_tokens_userId_key" ON "zoho_tokens"("userId");

-- CreateIndex
CREATE INDEX "zoho_mappings_zohoId_idx" ON "zoho_mappings"("zohoId");

-- CreateIndex
CREATE UNIQUE INDEX "zoho_mappings_entidad_entidadLocalId_zohoPortalId_key" ON "zoho_mappings"("entidad", "entidadLocalId", "zohoPortalId");

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

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "recursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_subprojectId_fkey" FOREIGN KEY ("subprojectId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_etiquetas" ADD CONSTRAINT "proyecto_etiquetas_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_etiquetas" ADD CONSTRAINT "proyecto_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_etiquetas" ADD CONSTRAINT "actividad_etiquetas_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_etiquetas" ADD CONSTRAINT "actividad_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_etiquetas" ADD CONSTRAINT "tarea_etiquetas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_etiquetas" ADD CONSTRAINT "tarea_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtarea_etiquetas" ADD CONSTRAINT "subtarea_etiquetas_subtareaId_fkey" FOREIGN KEY ("subtareaId") REFERENCES "subtareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtarea_etiquetas" ADD CONSTRAINT "subtarea_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_etiquetas" ADD CONSTRAINT "asignacion_etiquetas_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "asignaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion_etiquetas" ADD CONSTRAINT "asignacion_etiquetas_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "etiquetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_catalogos" ADD CONSTRAINT "material_catalogos_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiales" ADD CONSTRAINT "materiales_catalogoId_fkey" FOREIGN KEY ("catalogoId") REFERENCES "material_catalogos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos" ADD CONSTRAINT "recursos_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disponibilidades" ADD CONSTRAINT "disponibilidades_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_tipoActividadId_fkey" FOREIGN KEY ("tipoActividadId") REFERENCES "tipos_actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_subtareaId_fkey" FOREIGN KEY ("subtareaId") REFERENCES "subtareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_camionetaId_fkey" FOREIGN KEY ("camionetaId") REFERENCES "recursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtareas" ADD CONSTRAINT "subtareas_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_asignados" ADD CONSTRAINT "tareas_asignados_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_asignados" ADD CONSTRAINT "tareas_asignados_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "recursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_tokens" ADD CONSTRAINT "graph_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zoho_tokens" ADD CONSTRAINT "zoho_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferencias" ADD CONSTRAINT "user_preferencias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias" ADD CONSTRAINT "auditorias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
