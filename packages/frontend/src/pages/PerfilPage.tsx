import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useRecurso } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getRoleLevelLabel } from '@operaciones-planner/shared';

export function PerfilPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { data: recurso } = useRecurso(user?.recursoId ?? '');

  const initials = user ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}` : 'U';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } finally {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Datos de la cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {initials}
            </div>
            <div>
              <p className="text-lg font-semibold">
                {user?.nombre} {user?.apellido}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Rol</p>
              <Badge variant="secondary" className="mt-1">{user?.rol}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Nivel jerárquico</p>
              <Badge variant="outline" className="mt-1">
                N{user?.roleLevel ?? 0} · {getRoleLevelLabel(user?.roleLevel ?? 0)}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Recurso vinculado</p>
              <p className="mt-1 font-medium">
                {recurso ? `${recurso.nombre} ${recurso.apellido ?? ''}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Departamento</p>
              <p className="mt-1 font-medium">{recurso?.departamento?.nombre ?? '—'}</p>
            </div>
          </div>

          <Separator />

          <Button variant="destructive" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
