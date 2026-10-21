import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecursos } from '@/hooks/useApi';
import type { Recurso } from '@operaciones-planner/shared';

export function RecursosPage() {
  const { data: recursos, isLoading } = useRecursos();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Gestión de Recursos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recursos del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Cargando...</p>
          ) : (
            <div className="space-y-2">
              {recursos?.map((r: Recurso) => (
                <div key={r.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="font-medium">{r.nombre} {r.apellido}</p>
                    <p className="text-sm text-muted-foreground">{r.tipo} - {r.codigo}</p>
                  </div>
                  <span className={r.activo ? 'text-green-600' : 'text-gray-400'}>
                    {r.activo ? 'Activo' : 'Inactivo'}
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
