import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ReportesPage() {
  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Reportes</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Utilización de Recursos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Reporte de % ocupación por persona/equipo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ocupación por Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Horas asignadas por proyecto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Carga por Equipo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Comparativa de carga entre equipos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Logística</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Camionetas, hospedaje, vuelos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
