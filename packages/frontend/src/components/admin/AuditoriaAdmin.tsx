import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { format } from 'date-fns';

interface AuditoriaEntry {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  createdAt: string;
  user?: { name: string; email: string };
}

export function AuditoriaAdmin() {
  const [hasta, setHasta] = useState('');
  const [desde, setDesde] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['auditoria', desde, hasta],
    queryFn: () => {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      return api.get<{ data: AuditoriaEntry[] }>(`/api/auditoria?${params.toString()}`);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoría</CardTitle>
        <p className="text-sm text-muted-foreground">Historial de cambios del sistema</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-44" />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-44" />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{format(new Date(a.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>{a.user?.name ?? 'Sistema'}</TableCell>
                  <TableCell>{a.accion}</TableCell>
                  <TableCell className="text-xs">{a.entidad}</TableCell>
                </TableRow>
              ))}
              {data?.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Sin entradas para el período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
