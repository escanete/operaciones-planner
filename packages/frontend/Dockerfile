# ============================================
# Frontend — Operaciones Planner (React + Vite)
# Contexto de build: raíz del monorepo (ver docker-compose.yml)
# Multi-stage: node compila, nginx sirve estáticos + proxy /api
# ============================================

# ---- Etapa 1: compilación ----
FROM node:20-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@12

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/frontend/package.json packages/frontend/

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/frontend packages/frontend

# Compila (tsc + vite build). El frontend usa rutas relativas (/api),
# nginx se encarga de proxyearlas al backend.
RUN pnpm --filter @operaciones-planner/frontend build

# ---- Etapa 2: nginx ----
FROM nginx:alpine

COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/frontend/dist /usr/share/nginx/html

EXPOSE 80
