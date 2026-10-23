import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useRecursos } from '@/hooks/useApi';
import type { Recurso } from '@operaciones-planner/shared';

export function RecursosPage() {
  // Por defecto solo activos (los eliminados ahora se borran de verdad);
  // el checkbox permite ver los desactivados manualmente vía edición.
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const { data: recursos, isLoading } = useRecursos(
    mostrarInactivos ? undefined : { activo: true }
  );

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Gestión de Recursos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recursos del Sistema</CardTitle>
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="mostrar-inactivos"
              checked={mostrarInactivos}
              onCheckedChange={(v) => setMostrarInactivos(v === true)}
            />
            <Label htmlFor="mostrar-inactivos" className="text-sm font-normal text-muted-foreground">
              Mostrar recursos inactivos
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Cargando...</p>
          ) : recursos && recursos.length > 0 ? (
            <div className="space-y-2">
              {recursos.map((r: Recurso) => (
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
          ) : (
            <p className="text-sm text-muted-foreground">No hay recursos para mostrar.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
