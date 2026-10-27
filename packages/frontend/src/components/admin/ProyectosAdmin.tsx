import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntityDialog, type FieldConfig } from './EntityDialog';
import { EtiquetaChips } from '@/components/etiquetas';
import {
  useProyectos,
  useClientes,
  useCreateProyecto,
  useUpdateProyecto,
  useDeleteProyecto,
} from '@/hooks/useApi';
import type { Proyecto } from '@operaciones-planner/shared';

const ESTADOS = [
  { value: 'PLANIFICACION', label: 'Planificación' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'EN_PAUSA', label: 'En pausa' },
  { value: 'FINALIZADO', label: 'Finalizado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export function ProyectosAdmin() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Proyecto | null>(null);

  const { data: proyectos, isLoading } = useProyectos();
  const { data: clientes } = useClientes();

  const createMutation = useCreateProyecto();
  const updateMutation = useUpdateProyecto();
  const deleteMutation = useDeleteProyecto();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const fields: FieldConfig[] = [
    { name: 'nombre', label: 'Nombre del proyecto', type: 'text', required: true },
    { name: 'codigo', label: 'Código', type: 'text', placeholder: 'PRY-003' },
    {
      name: 'clienteId',
      label: 'Cliente',
      type: 'select',
      options: (clientes ?? []).map((c) => ({ value: c.id, label: c.nombre })),
    },
    { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    { name: 'fechaInicio', label: 'Fecha de inicio', type: 'date' },
    { name: 'fechaFin', label: 'Fecha de fin', type: 'date' },
    {
      name: 'estado',
      label: 'Estado',
      type: 'select',
      options: ESTADOS,
      defaultValue: 'PLANIFICACION',
      required: true,
    },
    // Planificación tipo MS Project (decisión c)
    { name: 'percentComplete', label: '% de avance', type: 'number', defaultValue: 0, helperText: '0-100' },
    {
      name: 'subprojectId',
      label: 'Sub-proyecto de',
      type: 'select',
      options: (proyectos ?? [])
        .filter((p) => p.id !== editing?.id)
        .map((p) => ({ value: p.id, label: p.nombre })),
      helperText: 'Define la jerarquía de proyectos (vista Gantt)',
    },
    { name: 'color', label: 'Color (hex)', type: 'color', defaultValue: '#00B050' },
    {
      name: 'etiquetas',
      label: 'Etiquetas',
      type: 'etiquetas',
      helperText: 'Categorías visuales (se gestionan en Admin → Etiquetas)',
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Proyectos</CardTitle>
          <p className="text-sm text-muted-foreground">Trabajos o iniciativas a las que se asignan recursos</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo proyecto
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proyecto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyectos?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color ?? '#888' }} />
                      <div className="min-w-0">
                        <div className="font-medium">{p.nombre}</div>
                        <div className="flex items-center gap-1">
                          {p.codigo && <div className="text-xs text-muted-foreground">{p.codigo}</div>}
                          {p.etiquetas && p.etiquetas.length > 0 && (
                            <EtiquetaChips size="xs" etiquetas={p.etiquetas} />
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{p.cliente?.nombre ?? '-'}</TableCell>
                  <TableCell>
                    {p.fechaInicio ? format(new Date(p.fechaInicio), 'dd/MM/yyyy') : '-'}
                    {' → '}
                    {p.fechaFin ? format(new Date(p.fechaFin), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.estado === 'ACTIVO' ? 'default' : 'secondary'}>{p.estado}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.percentComplete !== undefined && p.percentComplete !== null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-green-600"
                            style={{ width: `${p.percentComplete}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{p.percentComplete}%</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Eliminar proyecto (borrado real)"
                        onClick={async () => {
                          const ok = confirm(
                            `¿ELIMINAR el proyecto "${p.nombre}"?\n\n` +
                              'Se borrarán PERMANENTEMENTE:\n' +
                              '• Sus actividades, tareas y subtareas\n' +
                              '• Todas las asignaciones de planificación\n\n' +
                              'Las personas y vehículos NO se eliminan: quedan libres.\n' +
                              'Esta acción NO se puede deshacer.'
                          );
                          if (!ok) return;
                          try {
                            const res = (await deleteMutation.mutateAsync(p.id)) as {
                              eliminado?: {
                                actividades: number;
                                tareas: number;
                                subtareas: number;
                                asignaciones: number;
                              };
                            };
                            const r = res?.eliminado;
                            if (r) {
                              alert(
                                `Proyecto eliminado.\n\nActividades: ${r.actividades}\nTareas: ${r.tareas}\nSubtareas: ${r.subtareas}\nAsignaciones: ${r.asignaciones}`
                              );
                            }
                          } catch (err) {
                            alert(
                              'No se pudo eliminar: ' +
                                (err instanceof Error ? err.message : String(err))
                            );
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {proyectos?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No hay proyectos registrados
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
        title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}
        fields={fields}
        initialData={editing ? (editing as unknown as Record<string, unknown>) : null}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Guardar cambios' : 'Crear proyecto'}
      />
    </Card>
  );
}
