import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, LogOut, Settings, User } from 'lucide-react';
import { usePlanningStore } from '@/stores/planningStore';

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const setViewMode = usePlanningStore((s) => s.setViewMode);

  const goPlanning = (mode: 'grid' | 'gantt') => {
    setViewMode(mode);
    navigate('/planning');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
      logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const initials = user ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}` : 'U';

  return (
    <header className="border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/planning" className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span>Planificador Operaciones</span>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => goPlanning('grid')}>
            Planificación
          </Button>
          <Link to="/recursos">
            <Button variant="ghost" size="sm">Recursos</Button>
          </Link>
          <Link to="/proyectos">
            <Button variant="ghost" size="sm">Proyectos</Button>
          </Link>
          <Link to="/reportes">
            <Button variant="ghost" size="sm">Reportes</Button>
          </Link>
          {(user?.rol === 'SUPER_ADMIN' || user?.rol === 'ADMIN_DEPTO') && (
            <Link to="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} alt={user?.nombre} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.nombre} {user?.apellido}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    Rol: {user?.rol}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/perfil')}>
                <User className="mr-2 h-4 w-4" />
                <span>Mi Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracion')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
