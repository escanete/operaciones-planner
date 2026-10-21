import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProyectos } from '@/hooks/useApi';

export function ProyectosPage() {
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
                <div key={p.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-sm text-muted-foreground">{p.codigo} - {p.cliente?.nombre}</p>
                  </div>
                  <span className={p.activo ? 'text-green-600' : 'text-gray-400'}>
                    {p.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
