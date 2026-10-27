# AGENTS.md

## Flujo de trabajo (instrucción del usuario)

- **Cada cambio completado se sube a GitHub**: commit + push a `origin/main` después de cada tarea terminada y verificada.
- Mensajes de commit en español, una línea, describiendo los cambios principales (estilo del historial).
- NUNCA commitear `.env.docker` ni `.env.local` (contienen secretos; ya están en .gitignore).

## Verificación (no hay ESLint configurado)

- Tipos: `pnpm --filter @operaciones-planner/shared exec tsc --noEmit` (ídem backend y frontend).
- Build frontend: `pnpm --filter @operaciones-planner/frontend exec vite build`.
- Migraciones nuevas: probar con `DATABASE_URL=file:<temp>.db npx prisma migrate deploy` desde `packages/backend` y borrar la BD temporal.

## Despliegue

- Docker Compose: `docker compose up -d --build` (servidor 192.168.25.7).
- Las migraciones de Prisma se aplican solas al arrancar el contenedor (`prisma migrate deploy` en el CMD).
