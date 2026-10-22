import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProyectos } from '@/hooks/useApi';

export function ProyectosPage() {
  const navigate = useNavigate();
  const { data: proyectos, isLoading } = useProyectos();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Gestión de Proyectos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Proyectos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Cargando...</p>
          ) : (
            <div className="space-y-2">
              {proyectos?.map((p) => (
                <div
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between rounded border p-3 transition-colors hover:bg-accent"
                  onClick={() => navigate(`/proyectos/${p.id}`)}
                  title="Abrir detalle con actividades, tareas y subtareas"
                >
                  <div>
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-sm text-muted-foreground">{p.codigo} - {p.cliente?.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.percentComplete !== undefined && p.percentComplete !== null && (
                      <span className="text-sm font-medium tabular-nums">{p.percentComplete}%</span>
                    )}
                    <Badge variant={p.activo ? 'default' : 'secondary'}>
                      {p.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
