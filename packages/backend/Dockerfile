# ============================================
# Backend — Operaciones Planner (Hono + Prisma)
# Contexto de build: raíz del monorepo (ver docker-compose.yml)
# ============================================
FROM node:20-alpine

# OpenSSL necesario para los engines de Prisma en Alpine (musl)
RUN apk add --no-cache openssl

WORKDIR /app

# pnpm (misma versión mayor que la usada en desarrollo) y esbuild para empaquetar
RUN npm install -g pnpm@12 esbuild

# ---- 1) Manifiestos primero (cache de dependencias por capa) ----
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/mcp-server/package.json packages/mcp-server/

RUN pnpm install --frozen-lockfile

# ---- 2) Código fuente ----
COPY packages/shared packages/shared
COPY packages/backend packages/backend
COPY packages/mcp-server packages/mcp-server

# ---- 3) Generar cliente Prisma y empaquetar (esbuild) ----
# El bundle inlines @operaciones-planner/shared (que apunta a TS fuente)
# y deja los paquetes npm como imports externos (resueltos por node_modules).
RUN pnpm --filter @operaciones-planner/backend exec prisma generate
RUN cd packages/backend && \
    esbuild src/index.ts --bundle --platform=node --format=esm --packages=external \
      --alias:@operaciones-planner/shared=/app/packages/shared/src/index.ts \
      --outfile=dist/index.js && \
    esbuild prisma/seed.ts --bundle --platform=node --format=esm --packages=external \
      --outfile=seed.mjs && \
    esbuild scripts/reset-datos.ts --bundle --platform=node --format=esm --packages=external \
      --outfile=reset.mjs

# ---- 4) Servidor MCP (bundle para Claude Desktop) ----
# Se compila dentro de la imagen y el backend lo sirve en /api/mcp/...
# Asi cada PC lo descarga del propio servidor de la empresa (sin GitHub).
RUN pnpm --filter @operaciones-planner/mcp-server build && \
    mkdir -p /app/public && \
    cp packages/mcp-server/dist/index.js /app/public/operaciones-planner-mcp.js

WORKDIR /app/packages/backend
EXPOSE 3001

# Arranque: migrar BD -> seed idempotente (crea admin si falta) -> servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node seed.mjs && node dist/index.js"]
