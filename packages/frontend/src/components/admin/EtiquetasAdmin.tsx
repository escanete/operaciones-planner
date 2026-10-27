import { useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntityDialog, type FieldConfig } from './EntityDialog';
import { useAuthStore } from '@/stores/authStore';
import { useEtiquetas, useCreateEtiqueta, useUpdateEtiqueta, useDeleteEtiqueta } from '@/hooks/useApi';
import type { Etiqueta } from '@operaciones-planner/shared';

// ============================================
// ADMIN ETIQUETAS (catálogo global, estilo Zoho)
// - Crear/editar: SUPER_ADMIN y ADMIN_DEPTO
// - Eliminar: solo SUPER_ADMIN (como catálogos)
// ============================================

const COLOR_PRESETS = [
  '#3B82F6', // azul
  '#10B981', // verde
  '#F59E0B', // ámbar
  '#8B5CF6', // violeta
  '#EF4444', // rojo
  '#06B6D4', // cian
  '#EC4899', // rosa
  '#64748B', // gris azulado
];

export function EtiquetasAdmin() {
  const { user } = useAuthStore();
  const rol = user?.rol ?? '';
  const canManage = rol === 'SUPER_ADMIN' || rol === 'ADMIN_DEPTO';
  const canDelete = rol === 'SUPER_ADMIN';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Etiqueta | null>(null);

  const { data: etiquetas, isLoading } = useEtiquetas();
  const createMutation = useCreateEtiqueta();
  const updateMutation = useUpdateEtiqueta();
  const deleteMutation = useDeleteEtiqueta();

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
    {
      name: 'nombre',
      label: 'Nombre',
      type: 'text',
      required: true,
      placeholder: 'Ej: Suministros, Servicios de campo, Cotización…',
    },
    { name: 'color', label: 'Color', type: 'color', defaultValue: '#3B82F6' },
    { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    { name: 'activo', label: 'Activa (disponible para usar)', type: 'checkbox', defaultValue: true },
  ];

  const handleDelete = (etiqueta: Etiqueta) => {
    const ok = confirm(
      `¿Eliminar la etiqueta "${etiqueta.nombre}"?\n\n` +
        'Se quitará automáticamente de proyectos, actividades, tareas, subtareas y asignaciones.\n' +
        'Esta acción no se puede deshacer.'
    );
    if (ok) deleteMutation.mutate(etiqueta.id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Etiquetas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Categorías visuales (estilo Zoho) para clasificar proyectos, actividades WBS,
            tareas, subtareas y actividades de planificación
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva etiqueta
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <>
            {/* Paleta rápida de colores para referencia */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <Tags className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Colores sugeridos:</span>
              {COLOR_PRESETS.map((c) => (
                <span
                  key={c}
                  className="h-3.5 w-3.5 rounded-full border border-border"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {etiquetas?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `${e.color}22`,
                          color: e.color,
                          border: `1px solid ${e.color}55`,
                        }}
                      >
                        {e.nombre}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                      {e.descripcion ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.activo ? 'default' : 'outline'}>
                        {e.activo ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar etiqueta"
                            onClick={() => {
                              setEditing(e);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Eliminar etiqueta"
                              onClick={() => handleDelete(e)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {etiquetas?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No hay etiquetas — crea la primera (ej: Suministros, Servicios de campo, Cotización)
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? `Editar etiqueta "${editing.nombre}"` : 'Nueva etiqueta'}
        description="Las etiquetas se usan para clasificar el trabajo y filtrar la Vista Proyecto (Gantt)."
        fields={fields}
        initialData={editing ? (editing as unknown as Record<string, unknown>) : null}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Guardar cambios' : 'Crear etiqueta'}
      />
    </Card>
  );
}
