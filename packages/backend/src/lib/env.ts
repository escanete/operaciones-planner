import 'dotenv/config';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data/dev.db',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production-please-64-chars',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  PORT: process.env.PORT ?? '3001',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS ?? '',
} as const;

export type Env = typeof env;
