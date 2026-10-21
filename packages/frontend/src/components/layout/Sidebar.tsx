import { usePlanningStore } from '@/stores/planningStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDepartamentos, useEquipos, useProyectos, useTiposActividad } from '@/hooks/useApi';
import { X } from 'lucide-react';

export function Sidebar() {
  const { sidebarOpen, filters, setFilters, clearFilters, setSidebarOpen } = usePlanningStore();

  const { data: departamentos } = useDepartamentos();
  const { data: equipos } = useEquipos();
  const { data: proyectos } = useProyectos();
  const { data: tiposActividad } = useTiposActividad();

  if (!sidebarOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-16 z-50"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Abrir sidebar</span>
        →
      </Button>
    );
  }

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <aside className="w-64 border-r bg-card p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Filtros</h2>
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">{activeFiltersCount}</Badge>
          )}
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Departamento</Label>
          <Select
            value={filters.departamentoId ?? '__all__'}
            onValueChange={(v) => setFilters({ departamentoId: v === '__all__' ? undefined : v, equipoId: undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {departamentos?.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Equipo</Label>
          <Select
            value={filters.equipoId ?? '__all__'}
            onValueChange={(v) => setFilters({ equipoId: v === '__all__' ? undefined : v })}
            disabled={!filters.departamentoId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {equipos?.filter(e => !filters.departamentoId || e.departamentoId === filters.departamentoId).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Proyecto</Label>
          <Select
            value={filters.proyectoId ?? '__all__'}
            onValueChange={(v) => setFilters({ proyectoId: v === '__all__' ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {proyectos?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tipo Actividad</Label>
          <Select
            value={filters.tipoActividadId ?? '__all__'}
            onValueChange={(v) => setFilters({ tipoActividadId: v === '__all__' ? undefined : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {tiposActividad?.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Buscar Recurso</Label>
          <Input
            placeholder="Nombre, cargo..."
            value={filters.recursoId ?? ''}
            onChange={(e) => setFilters({ recursoId: e.target.value || undefined })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => clearFilters()}
          >
            Limpiar
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold mb-2">Leyenda</h3>
        <div className="space-y-2">
          {tiposActividad?.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: t.color }}
              />
              <span className="text-sm">{t.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
