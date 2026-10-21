import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EntityDialog, type FieldConfig } from './EntityDialog';
import { api } from '@/services/api';
import { useUsuarios, useRecursos, useDepartamentos } from '@/hooks/useApi';

interface UsuarioRow {
  id: string;
  email: string;
  name: string;
  apellido: string;
  rol: string;
  activo: boolean;
  roleLevel?: number;
  departmentId?: string | null;
  areaId?: string | null;
  recurso?: { id: string; nombre: string; apellido?: string } | null;
}

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN_DEPTO', label: 'Admin Departamento' },
  { value: 'PLANIFICADOR', label: 'Planificador' },
  { value: 'OPERADOR', label: 'Operador' },
  { value: 'VISTA_SOLO', label: 'Solo lectura' },
];

export function UsuariosAdmin() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState<{ user: UsuarioRow } | null>(null);

  const queryClient = useQueryClient();
  const { data: usuarios, isLoading } = useUsuarios();
  const { data: recursos } = useRecursos({ tipo: 'PERSONA', activo: true });
  const { data: departamentos } = useDepartamentos();

  const handleCreate = async (data: Record<string, unknown>) => {
    await api.post('/api/usuarios', data);
    await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  };

  const handleRoleUpdate = async (data: Record<string, unknown>) => {
    if (!roleDialog) return;
    await api.put(`/api/usuarios/${roleDialog.user.id}/rol`, {
      rol: data.rol,
      ...(data.roleLevel !== undefined ? { roleLevel: data.roleLevel } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
      ...(data.areaId !== undefined ? { areaId: data.areaId || null } : {}),
    });
    await api.put(`/api/usuarios/${roleDialog.user.id}/activo`, { activo: data.activo ?? true });
    if (data.recursoId !== undefined) {
      await api.put(`/api/usuarios/${roleDialog.user.id}/recurso`, { recursoId: data.recursoId || null });
    }
    await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  };

  const createFields: FieldConfig[] = [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'password', label: 'Contraseña (mín 8 caracteres)', type: 'text', required: true },
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'apellido', label: 'Apellido', type: 'text', required: true },
    { name: 'rol', label: 'Rol', type: 'select', options: ROLES, defaultValue: 'OPERADOR', required: true },
    // Jerarquía y alcance (decisiones a y b)
    {
      name: 'roleLevel',
      label: 'Nivel jerárquico',
      type: 'number',
      defaultValue: 0,
      helperText: '0=Sin nivel · 1=Operativo · ... · 6=Gerente',
    },
    {
      name: 'departmentId',
      label: 'Departamento (alcance ADMIN_DEPTO)',
      type: 'select',
      options: (departamentos ?? []).map((d) => ({ value: d.id, label: d.nombre })),
    },
    { name: 'areaId', label: 'Área / Zona', type: 'text' },
    {
      name: 'recursoId',
      label: 'Vincular a recurso (opcional)',
      type: 'select',
      options: (recursos ?? []).map((r) => ({ value: r.id, label: `${r.nombre} ${r.apellido ?? ''}` })),
    },
  ];

  const editFields: FieldConfig[] = [
    { name: 'rol', label: 'Rol', type: 'select', options: ROLES, required: true },
    {
      name: 'roleLevel',
      label: 'Nivel jerárquico',
      type: 'number',
      helperText: '0=Sin nivel · 1=Operativo · ... · 6=Gerente',
    },
    {
      name: 'departmentId',
      label: 'Departamento (alcance ADMIN_DEPTO)',
      type: 'select',
      options: (departamentos ?? []).map((d) => ({ value: d.id, label: d.nombre })),
    },
    { name: 'areaId', label: 'Área / Zona', type: 'text' },
    { name: 'activo', label: 'Usuario activo', type: 'checkbox' },
    {
      name: 'recursoId',
      label: 'Vincular a recurso',
      type: 'select',
      options: (recursos ?? []).map((r) => ({ value: r.id, label: `${r.nombre} ${r.apellido ?? ''}` })),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Usuarios del sistema</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sólo Super Admin puede crear usuarios. Vincula a un recurso para que vea sus asignaciones.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Recurso vinculado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios?.map((u: UsuarioRow) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name} {u.apellido}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{u.rol}</Badge></TableCell>
                  <TableCell>
                    {(u.roleLevel ?? 0) > 0 ? (
                      <Badge variant={(u.roleLevel ?? 0) >= 4 ? 'default' : 'outline'}>N{u.roleLevel}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{u.recurso ? `${u.recurso.nombre} ${u.recurso.apellido ?? ''}` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={u.activo ? 'default' : 'outline'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setRoleDialog({ user: u })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nuevo usuario"
        description="El usuario podrá ingresar con su email y contraseña"
        fields={createFields}
        onSubmit={handleCreate}
        submitLabel="Crear usuario"
      />

      <EntityDialog
        open={!!roleDialog}
        onOpenChange={(open) => !open && setRoleDialog(null)}
        title={`Editar ${roleDialog?.user.email ?? ''}`}
        fields={editFields}
        initialData={roleDialog ? {
          rol: roleDialog.user.rol,
          roleLevel: roleDialog.user.roleLevel ?? 0,
          departmentId: roleDialog.user.departmentId ?? '',
          areaId: roleDialog.user.areaId ?? '',
          activo: roleDialog.user.activo,
          recursoId: roleDialog.user.recurso?.id ?? '',
        } : null}
        onSubmit={handleRoleUpdate}
        submitLabel="Guardar"
      />
    </Card>
  );
}
