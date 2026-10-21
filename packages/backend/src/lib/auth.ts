import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db.js';
import { env } from './env.js';

// Orígenes extra de producción vía TRUSTED_ORIGINS (separados por coma)
const extraOrigins = env.TRUSTED_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  
  // Email/Password auth
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false, // Simple para desarrollo local
  },

  // Session config - usando la configuración correcta de Better-Auth
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    freshAge: 60 * 60 * 24, // 1 día
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 días
    },
  },

  // Advanced: User additional fields
  user: {
    additionalFields: {
      apellido: { type: 'string', required: true },
      rol: { type: 'string', required: true, defaultValue: 'OPERADOR' },
      activo: { type: 'boolean', defaultValue: true },
      recursoId: { type: 'string', required: false },
      // Jerarquía y alcance (decisiones a y b)
      roleLevel: { type: 'number', defaultValue: 0, input: false },
      departmentId: { type: 'string', required: false, input: false },
      areaId: { type: 'string', required: false, input: false },
    },
  },

  // Orígenes confiables: local dev + extras de producción
  trustedOrigins: [
    env.CORS_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3001',
    ...extraOrigins,
  ],
});

export type Auth = typeof auth;
