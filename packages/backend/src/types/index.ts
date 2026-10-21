// Backend internal types and Hono context helpers
import type { Context, Next } from 'hono';
import type { User as SharedUser } from '@operaciones-planner/shared';

export interface User {
  id: string;
  email: string;
  name: string;
  apellido: string;
  rol: string;
  activo: boolean;
  recursoId: string | null;
  roleLevel?: number;
  departmentId?: string | null;
  areaId?: string | null;
}

export interface Session {
  id: string;
  token: string;
  expiresAt: Date;
}

// Tipo extendido de Hono con variables de contexto
export type AppContext = Context<{
  Variables: {
    user: User;
    session: Session;
  };
}>;

// Helper para obtener el usuario del contexto con tipado seguro
export function getUser(c: Context): User {
  return c.get('user') as User;
}

// Helper para obtener la sesión del contexto
export function getSession(c: Context): Session {
  return c.get('session') as Session;
}
