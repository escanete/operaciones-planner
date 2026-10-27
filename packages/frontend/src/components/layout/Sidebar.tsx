import { useState } from 'react';
import { usePlanningStore } from '@/stores/planningStore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDepartamentos, useEquipos, useProyectos, useTiposActividad, useRecursos } from '@/hooks/useApi';
import { ChevronsUpDown, X } from 'lucide-react';

// Filtro multi-selección: guarda los ids como string separado por comas
// (compatible con el backend, que acepta listas "id1,id2")
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Todos',
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const labelBoton =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? options.find((o) => o.id === selected[0])?.label ?? '1 seleccionado'
      : `${selected.length} seleccionados`;

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between font-normal">
            <span className="truncate">{labelBoton}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-h-72 overflow-y-auto p-1">
          {selected.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-1 w-full justify-start text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              <X className="h-3 w-3" /> Limpiar selección
            </Button>
          )}
          {options.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Sin opciones disponibles</p>
          )}
          {options.map((o) => (
            <div
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => toggle(o.id)}
            >
              <Checkbox
                checked={selected.includes(o.id)}
                className="pointer-events-none"
                tabIndex={-1}
              />
              <span className="truncate">{o.label}</span>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

const toIds = (v?: string) => (v ? v.split(',').filter(Boolean) : []);

const TIPO_RECURSO_LABEL: Record<string, string> = {
  VEHICULO: 'Vehículo',
  EQUIPO_TECNICO: 'Equipo técnico',
  HERRAMIENTA: 'Herramienta',
  OTRO: 'Otro',
};

export function Sidebar() {
  const { sidebarOpen, filters, setFilters, clearFilters, setSidebarOpen } = usePlanningStore();

  const { data: departamentos } = useDepartamentos();
  const { data: equipos } = useEquipos();
  const { data: proyectos } = useProyectos();
  const { data: tiposActividad } = useTiposActividad();
  // Todos los recursos activos (personas + vehículos/equipos técnicos),
  // para poder filtrar también por camioneta en la vista de recursos
  const { data: recursos } = useRecursos({ activo: true });

  // Cerrado: no renderizar nada. Se reabre desde el botón "Filtros"
  // del toolbar de Planificación (evitaba solaparse con la flecha del período).
  if (!sidebarOpen) return null;

  const deptosSel = toIds(filters.departamentoId);

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
        <MultiSelectFilter
          label="Departamento"
          options={(departamentos ?? []).map((d) => ({ id: d.id, label: d.nombre }))}
          selected={deptosSel}
          onChange={(ids) =>
            setFilters({
              departamentoId: ids.length ? ids.join(',') : undefined,
              equipoId: undefined,
            })
          }
        />

        <MultiSelectFilter
          label="Equipo"
          options={(equipos ?? [])
            .filter(
              (e) => deptosSel.length === 0 || (e.departamentoId && deptosSel.includes(e.departamentoId))
            )
            .map((e) => ({ id: e.id, label: e.nombre }))}
          selected={toIds(filters.equipoId)}
          onChange={(ids) => setFilters({ equipoId: ids.length ? ids.join(',') : undefined })}
        />

        <MultiSelectFilter
          label="Proyecto"
          options={(proyectos ?? []).map((p) => ({ id: p.id, label: p.nombre }))}
          selected={toIds(filters.proyectoId)}
          onChange={(ids) => setFilters({ proyectoId: ids.length ? ids.join(',') : undefined })}
        />

        <MultiSelectFilter
          label="Tipo Actividad"
          options={(tiposActividad ?? []).map((t) => ({ id: t.id, label: t.nombre }))}
          selected={toIds(filters.tipoActividadId)}
          onChange={(ids) => setFilters({ tipoActividadId: ids.length ? ids.join(',') : undefined })}
        />

        <MultiSelectFilter
          label="Recurso"
          options={(recursos ?? []).map((r) => ({
            id: r.id,
            label:
              `${r.nombre} ${r.apellido ?? ''}`.trim() +
              (r.tipo !== 'PERSONA'
                ? ` · ${TIPO_RECURSO_LABEL[r.tipo] ?? r.tipo}`
                : ''),
          }))}
          selected={toIds(filters.recursoId)}
          onChange={(ids) => setFilters({ recursoId: ids.length ? ids.join(',') : undefined })}
        />

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
