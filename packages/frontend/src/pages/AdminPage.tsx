import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RecursosAdmin } from '@/components/admin/RecursosAdmin';
import { ProyectosAdmin } from '@/components/admin/ProyectosAdmin';
import { ClientesAdmin } from '@/components/admin/ClientesAdmin';
import { CatalogosAdmin } from '@/components/admin/CatalogosAdmin';
import { UsuariosAdmin } from '@/components/admin/UsuariosAdmin';
import { AuditoriaAdmin } from '@/components/admin/AuditoriaAdmin';

export function AdminPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.rol === 'SUPER_ADMIN';
  const [tab, setTab] = useState('recursos');

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona recursos, proyectos, clientes, catálogos y usuarios del sistema
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="recursos">Recursos</TabsTrigger>
          <TabsTrigger value="proyectos">Proyectos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="usuarios">Usuarios</TabsTrigger>}
          {(isSuperAdmin || user?.rol === 'ADMIN_DEPTO') && (
            <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="recursos" className="mt-4">
          <RecursosAdmin />
        </TabsContent>
        <TabsContent value="proyectos" className="mt-4">
          <ProyectosAdmin />
        </TabsContent>
        <TabsContent value="clientes" className="mt-4">
          <ClientesAdmin />
        </TabsContent>
        <TabsContent value="catalogos" className="mt-4">
          <CatalogosAdmin />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="usuarios" className="mt-4">
            <UsuariosAdmin />
          </TabsContent>
        )}
        <TabsContent value="auditoria" className="mt-4">
          <AuditoriaAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
