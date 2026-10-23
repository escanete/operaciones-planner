import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntityDialog, type FieldConfig } from './EntityDialog';
import {
  useRecursos,
  useDepartamentos,
  useEquipos,
  useCargos,
  useCreateRecurso,
  useUpdateRecurso,
  useDeleteRecurso,
} from '@/hooks/useApi';
import type { Recurso } from '@operaciones-planner/shared';

const TIPOS = [
  { value: 'PERSONA', label: 'Persona' },
  { value: 'VEHICULO', label: 'Vehículo / Camioneta' },
  { value: 'EQUIPO_TECNICO', label: 'Equipo técnico' },
  { value: 'HERRAMIENTA', label: 'Herramienta' },
  { value: 'OTRO', label: 'Otro' },
];

export function RecursosAdmin() {
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recurso | null>(null);

  const { data: recursos, isLoading } = useRecursos({
    activo: true,
    ...(tipo ? { tipo } : {}),
    ...(search ? { q: search } : {}),
  });
  const { data: departamentosResponse } = useDepartamentos();
  const { data: equipos } = useEquipos();
  const { data: cargos } = useCargos();

  const departamentos = departamentosResponse;

  const createMutation = useCreateRecurso();
  const updateMutation = useUpdateRecurso();
  const deleteMutation = useDeleteRecurso();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (r: Recurso) => {
    setEditing(r);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = confirm(
      '⚠️ ELIMINAR RECURSO (borrado real)\n\n' +
        'Se eliminarán también permanentemente:\n' +
        '• Todas sus asignaciones en la planificación\n' +
        '• Sus asignaciones a tareas del WBS\n' +
        '• Disponibilidades y ausencias\n\n' +
        'El usuario asociado (si tiene cuenta) NO se elimina, solo se desvincula.\n\n' +
        'Esta acción NO se puede deshacer. ¿Continuar?'
    );
    if (!ok) return;
    try {
      const res = (await deleteMutation.mutateAsync(id)) as {
        eliminado?: {
          asignaciones: number;
          disponibilidades: number;
          ausencias: number;
          tareasWbs: number;
        };
      };
      const e = res?.eliminado;
      if (e) {
        alert(
          `Recurso eliminado.\n\nAsignaciones eliminadas: ${e.asignaciones}\n` +
            `Asignaciones WBS eliminadas: ${e.tareasWbs}\n` +
            `Disponibilidades eliminadas: ${e.disponibilidades}\nAusencias eliminadas: ${e.ausencias}`
        );
      }
    } catch (err) {
      alert(`No se pudo eliminar: ${(err as Error).message}`);
    }
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const fields: FieldConfig[] = [
    { name: 'tipo', label: 'Tipo de recurso', type: 'select', required: true, options: TIPOS, defaultValue: 'PERSONA' },
    { name: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Juan' },
    { name: 'apellido', label: 'Apellido', type: 'text', placeholder: 'Ej: Pérez' },
    { name: 'codigo', label: 'Código interno', type: 'text', placeholder: 'EMP-013' },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'correo@empresa.cl' },
    { name: 'telefono', label: 'Teléfono', type: 'text', placeholder: '+56 9 ...' },
    {
      name: 'cargoId',
      label: 'Cargo',
      type: 'select',
      options: (cargos ?? []).map((c) => ({ value: c.id, label: c.nombre })),
    },
    {
      name: 'departamentoId',
      label: 'Departamento',
      type: 'select',
      required: true,
      options: (departamentos ?? []).map((d: { id: string; nombre: string }) => ({ value: d.id, label: d.nombre })),
    },
    {
      name: 'equipoId',
      label: 'Equipo',
      type: 'select',
      options: (equipos ?? []).map((e) => ({ value: e.id, label: e.nombre })),
    },
    // Jerarquía y área (decisiones a y b)
    {
      name: 'roleLevel',
      label: 'Nivel jerárquico (rol)',
      type: 'number',
      defaultValue: 0,
      helperText: '0=Sin nivel · 1=Operativo · 2=Técnico · 3=Profesional · 4=Supervisor · 5=Jefe de Área · 6=Gerente',
    },
    { name: 'areaId', label: 'Área / Zona', type: 'text', placeholder: 'Ej: NORTE, SUR, CENTRO...' },
    { name: 'colorCalendario', label: 'Color en planificación', type: 'color', defaultValue: '#00B050' },
    // Campos vehículo
    { name: 'patente', label: 'Patente (solo vehículos)', type: 'text', placeholder: 'ABCD-12' },
    { name: 'marca', label: 'Marca (solo vehículos)', type: 'text' },
    { name: 'modelo', label: 'Modelo (solo vehículos)', type: 'text' },
    { name: 'capacidad', label: 'Capacidad (ej: 4 personas)', type: 'text' },
  ];

  const getInitial = (r: Recurso): Record<string, unknown> => ({
    ...(r as unknown as Record<string, unknown>),
    departamentoId: r.departamentoId,
    equipoId: r.equipoId ?? undefined,
    cargoId: r.cargoId ?? undefined,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Recursos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Personas, camionetas, equipos técnicos y otros recursos asignables
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo recurso
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre, código, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Patente</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recursos?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {r.nombre} {r.apellido ?? ''}
                      </div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.tipo === 'PERSONA' ? 'default' : 'secondary'}>{r.tipo}</Badge>
                  </TableCell>
                  <TableCell>{r.equipo?.nombre ?? '-'}</TableCell>
                  <TableCell>{r.cargo?.nombre ?? '-'}</TableCell>
                  <TableCell>
                    {r.roleLevel > 0 ? (
                      <Badge variant={r.roleLevel >= 4 ? 'default' : 'secondary'}>N{r.roleLevel}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{r.areaId ?? '-'}</TableCell>
                  <TableCell>{r.patente ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {recursos?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    No hay recursos registrados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Editar recurso' : 'Nuevo recurso'}
        description="Completa los datos del recurso (persona, vehículo u otro)"
        fields={fields}
        initialData={editing ? getInitial(editing) : null}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Guardar cambios' : 'Crear recurso'}
      />
    </Card>
  );
}
