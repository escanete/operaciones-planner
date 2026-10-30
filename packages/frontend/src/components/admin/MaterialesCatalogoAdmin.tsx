import { useState } from 'react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntityDialog, type FieldConfig } from './EntityDialog';
import { useAuthStore } from '@/stores/authStore';
import {
  useMaterialesCatalogo,
  useCreateMaterialCatalogo,
  useUpdateMaterialCatalogo,
  useDeleteMaterialCatalogo,
  useRecursos,
} from '@/hooks/useApi';
import type { MaterialCatalogo } from '@operaciones-planner/shared';
import { simboloUnidad, UNIDADES_MEDIDA } from '@/lib/unidades';

// ============================================
// ADMIN CATÁLOGO DE MATERIALES
// Ítems reutilizables (nombre, categoría, unidad base) con vínculo
// opcional a un recurso-herramienta (base del futuro inventario).
// - Crear/editar: SUPER_ADMIN y ADMIN_DEPTO
// - Eliminar: solo SUPER_ADMIN (materiales de proyectos quedan libres)
// ============================================

const UNIDADES_SUGERIDAS = UNIDADES_MEDIDA.map((u) => ({ value: u.valor, label: u.etiqueta }));

export function MaterialesCatalogoAdmin() {
  const { user } = useAuthStore();
  const rol = user?.rol ?? '';
  const canManage = rol === 'SUPER_ADMIN' || rol === 'ADMIN_DEPTO';
  const canDelete = rol === 'SUPER_ADMIN';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialCatalogo | null>(null);

  const { data: items, isLoading } = useMaterialesCatalogo();
  // Activos no-persona para el vínculo con inventario (herramientas/equipos/vehículos)
  const { data: recursos } = useRecursos({ activo: true });
  const recursosActivos = (recursos ?? []).filter((r) => r.tipo !== 'PERSONA');

  const createMutation = useCreateMaterialCatalogo();
  const updateMutation = useUpdateMaterialCatalogo();
  const deleteMutation = useDeleteMaterialCatalogo();

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
      label: 'Nombre del material',
      type: 'text',
      required: true,
      placeholder: 'Ej: Cable coaxial RG6, Radio RTU, Tornillo autoperforante…',
    },
    {
      name: 'categoria',
      label: 'Categoría',
      type: 'text',
      placeholder: 'Ej: CABLE, ELECTRÓNICO, CONSUMIBLE, HERRAMIENTA…',
    },
    {
      name: 'unidadBase',
      label: 'Unidad de medida',
      type: 'select',
      options: UNIDADES_SUGERIDAS,
      helperText:
        'Unidad con la que se pide este material. Las unidades como kg, mt o lt admiten decimales; un, caja o rollo solo enteros.',
    },
    {
      name: 'cantidadSugerida',
      label: 'Cantidad de referencia (opcional)',
      type: 'number',
      placeholder: 'Ej: 250',
      helperText:
        'Cantidad típica que se propone al agregar el material a un proyecto (ej: 250 kg). Se puede ajustar en cada proyecto.',
    },
    {
      name: 'recursoId',
      label: 'Vincular a activo / herramienta (opcional)',
      type: 'select',
      options: recursosActivos.map((r) => ({
        value: r.id,
        label: `${r.nombre} ${r.apellido ?? ''} · ${r.tipo}`,
      })),
      helperText: 'Para el futuro módulo de inventario: material que corresponde a un activo del catálogo de recursos',
    },
    { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    { name: 'activo', label: 'Activo (disponible para usar en proyectos)', type: 'checkbox', defaultValue: true },
  ];

  const handleDelete = (item: MaterialCatalogo) => {
    const ok = confirm(
      `¿Eliminar "${item.nombre}" del catálogo?\n\n` +
        'Los materiales de proyectos que lo usaban quedarán como texto libre (no se borran).\n' +
        'Esta acción no se puede deshacer.'
    );
    if (ok) deleteMutation.mutate(item.id);
  };

  const nombreRecurso = (item: MaterialCatalogo) => {
    const r = recursosActivos.find((x) => x.id === item.recursoId);
    return r ? `${r.nombre} ${r.apellido ?? ''}`.trim() : null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de materiales
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ítems reutilizables para los materiales de los proyectos: nombre, categoría, unidad de
            medida y cantidad de referencia, con vínculo opcional a un activo del catálogo de recursos
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo material
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Cantidad ref.</TableHead>
                <TableHead>Activo vinculado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <span className="font-medium">{m.nombre}</span>
                    {m.descripcion && (
                      <p className="max-w-72 truncate text-xs text-muted-foreground">{m.descripcion}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.categoria ? (
                      <Badge variant="outline">{m.categoria}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{m.unidadBase ?? '—'}</TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {m.cantidadSugerida !== undefined && m.cantidadSugerida !== null ? (
                      <>
                        {m.cantidadSugerida}{' '}
                        <span className="text-xs text-muted-foreground">
                          {simboloUnidad(m.unidadBase)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{nombreRecurso(m) ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={m.activo ? 'default' : 'outline'}>
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar material"
                          onClick={() => {
                            setEditing(m);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Eliminar material"
                            onClick={() => handleDelete(m)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No hay materiales en el catálogo — crea el primero (ej: Cable coaxial RG6)
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
        title={editing ? `Editar material "${editing.nombre}"` : 'Nuevo material'}
        description="Define nombre, unidad de medida y cantidad de referencia; al agregar el material a un proyecto se proponen esos valores y puedes ajustarlos."
        fields={fields}
        initialData={editing ? (editing as unknown as Record<string, unknown>) : null}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Guardar cambios' : 'Crear material'}
      />
    </Card>
  );
}
