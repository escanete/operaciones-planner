import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Layout } from '@/components/layout/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { PlanningPage } from '@/pages/PlanningPage';
import { ProyectosPage } from '@/pages/ProyectosPage';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { ReportesPage } from '@/pages/ReportesPage';
import { AdminPage } from '@/pages/AdminPage';
import { PerfilPage } from '@/pages/PerfilPage';
import { ConfiguracionPage } from '@/pages/ConfiguracionPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(user.rol)) {
    return <Navigate to="/planning" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { setUser, setLoading } = useAuthStore();

  // Validar sesión al cargar la app (el cookie viaja con credentials: include)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/get-session', {
          method: 'GET',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setUser(data.user);
            return;
          }
        }
        // Sin sesión válida
        setUser(null);
      } catch (error) {
        setUser(null);
      }
    };
    checkSession();
  }, [setUser, setLoading]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/planning" replace />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="proyectos" element={<ProyectosPage />} />
        <Route path="proyectos/:proyectoId" element={<ProjectDetailPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="admin" element={
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN_DEPTO']}>
            <AdminPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
