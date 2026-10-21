import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntityDialog, type FieldConfig } from './EntityDialog';
import {
  useDepartamentos,
  useEquipos,
  useCargos,
  useTiposActividad,
  useCreateDepartamento,
  useUpdateDepartamento,
  useDeleteDepartamento,
  useCreateEquipo,
  useUpdateEquipo,
  useDeleteEquipo,
  useCreateCargo,
  useUpdateCargo,
  useDeleteCargo,
  useCreateTipoActividad,
  useUpdateTipoActividad,
  useDeleteTipoActividad,
} from '@/hooks/useApi';

export function CatalogosAdmin() {
  const [tab, setTab] = useState<'departamentos' | 'equipos' | 'cargos' | 'tipos'>('departamentos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const { data: departamentos } = useDepartamentos();
  const { data: equipos } = useEquipos();
  const { data: cargos } = useCargos();
  const { data: tipos } = useTiposActividad();

  const crearDepto = useCreateDepartamento();
  const updateDepto = useUpdateDepartamento();
  const deleteDepto = useDeleteDepartamento();
  const createEquipo = useCreateEquipo();
  const updateEquipo = useUpdateEquipo();
  const deleteEquipo = useDeleteEquipo();
  const createCargo = useCreateCargo();
  const updateCargo = useUpdateCargo();
  const deleteCargo = useDeleteCargo();
  const createTipo = useCreateTipoActividad();
  const updateTipo = useUpdateTipoActividad();
  const deleteTipo = useDeleteTipoActividad();

  const config: Record<
    string,
    {
      title: string;
      fields: FieldConfig[];
      create: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> };
      update: { mutateAsync: (args: { id: string; data: Record<string, unknown> }) => Promise<unknown> };
      delete: { mutateAsync: (id: string) => Promise<unknown> };
    }
  > = {
    departamentos: {
      title: 'Departamento',
      create: crearDepto,
      update: updateDepto,
      delete: deleteDepto,
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
        { name: 'color', label: 'Color', type: 'color', defaultValue: '#4472C4' },
        { name: 'orden', label: 'Orden', type: 'number', defaultValue: 0 },
      ],
    },
    equipos: {
      title: 'Equipo',
      create: createEquipo,
      update: updateEquipo,
      delete: deleteEquipo,
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        {
          name: 'departamentoId',
          label: 'Departamento',
          type: 'select',
          required: true,
          options: (departamentos ?? []).map((d) => ({ value: d.id, label: d.nombre })),
        },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
        { name: 'orden', label: 'Orden', type: 'number', defaultValue: 0 },
      ],
    },
    cargos: {
      title: 'Cargo',
      create: createCargo,
      update: updateCargo,
      delete: deleteCargo,
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
        { name: 'nivel', label: 'Nivel jerárquico', type: 'number', defaultValue: 1 },
        { name: 'color', label: 'Color', type: 'color', defaultValue: '#9BC2E6' },
      ],
    },
    tipos: {
      title: 'Tipo de Actividad',
      create: createTipo,
      update: updateTipo,
      delete: deleteTipo,
      fields: [
        { name: 'nombre', label: 'Nombre', type: 'text', required: true },
        { name: 'color', label: 'Color', type: 'color', defaultValue: '#00B050', required: true },
        { name: 'icono', label: 'Icono (lucide)', type: 'text' },
        { name: 'billable', label: 'Cuenta como carga de trabajo', type: 'checkbox', defaultValue: true },
        { name: 'requiereProyecto', label: 'Requiere proyecto asociado', type: 'checkbox', defaultValue: true },
        { name: 'orden', label: 'Orden', type: 'number', defaultValue: 0 },
      ],
    },
  };

  const current = config[tab];
  const rows =
    tab === 'departamentos'
      ? departamentos ?? []
      : tab === 'equipos'
        ? equipos ?? []
        : tab === 'cargos'
          ? cargos ?? []
          : tipos ?? [];

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await current.update.mutateAsync({ id: String(editing.id), data });
    } else {
      await current.create.mutateAsync(data);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Catálogos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Departamentos, equipos, cargos y tipos de actividad configurables
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo {current.title.toLowerCase()}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(['departamentos', 'equipos', 'cargos', 'tipos'] as const).map((key) => (
            <Button
              key={key}
              variant={tab === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(key)}
            >
              {key === 'tipos' ? 'Tipos de actividad' : key.charAt(0).toUpperCase() + key.slice(1)}
            </Button>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              {tab === 'equipos' && <TableHead>Departamento</TableHead>}
              {tab === 'cargos' && <TableHead>Nivel</TableHead>}
              {tab === 'tipos' && <TableHead>Color</TableHead>}
              <TableHead>Orden</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const row = r as unknown as Record<string, unknown>;
              return (
                <TableRow key={String(row.id)}>
                  <TableCell className="font-medium">{String(row.nombre ?? '')}</TableCell>
                  {tab === 'equipos' && (
                    <TableCell>{String((row.departamento as { nombre?: string } | undefined)?.nombre ?? '-')}</TableCell>
                  )}
                  {tab === 'cargos' && <TableCell>{String(row.nivel ?? 0)}</TableCell>}
                  {tab === 'tipos' && (
                    <TableCell>
                      <div className="h-4 w-8 rounded" style={{ backgroundColor: String(row.color ?? '#888') }} />
                    </TableCell>
                  )}
                  <TableCell>{String(row.orden ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(row as unknown as Record<string, unknown>);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (confirm(`¿Eliminar ${current.title.toLowerCase()}?`)) {
                            await current.delete.mutateAsync(String(row.id));
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No hay datos registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `Editar ${current.title.toLowerCase()}` : `Nuevo ${current.title.toLowerCase()}`}
        fields={current.fields}
        initialData={editing}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
