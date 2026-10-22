import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout() {
  const location = useLocation();
  // El panel de filtros solo aplica a la Planificación (afecta Vista Recursos y Vista Proyecto)
  const mostrarSidebar = location.pathname === '/planning';

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {mostrarSidebar && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
