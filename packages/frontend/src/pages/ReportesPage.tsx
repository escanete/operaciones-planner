import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Download,
  FolderKanban,
  Loader2,
  PieChart as PieIcon,
  Timer,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useReporteUtilizacion,
  useReporteOcupacionProyectos,
  useReporteCargaEquipos,
  useReporteProximosVencer,
} from '@/hooks/useApi';
import { downloadCSV } from '@/lib/csv';
import { cn } from '@/lib/utils';

const COLOR_ALERTA: Record<string, string> = {
  NORMAL: '#00B050',
  ALERTA_80: '#FFC000',
  SOBRECARGA: '#FF6600',
  CRITICA_120: '#C00000',
  SIN_ASIGNAR: '#94A3B8',
};

const ETIQUETA_ALERTA: Record<string, string> = {
  NORMAL: 'Disponible',
  ALERTA_80: 'Alta carga',
  SOBRECARGA: 'Sobrecargado',
  CRITICA_120: 'Crítico',
  SIN_ASIGNAR: 'Sin asignar',
};

const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaCorta(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return `${d.getDate()}/${MESES_ABR[d.getMonth()]}`;
}

export function ReportesPage() {
  const hoy = new Date();
  const [desde, setDesde] = useState(format(hoy, 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(new Date(hoy.getTime() + 30 * 86400000), 'yyyy-MM-dd'));
  const [diasVencer, setDiasVencer] = useState(30);

  const { data: util, isLoading: loadingUtil } = useReporteUtilizacion(desde, hasta);
  const { data: ocup, isLoading: loadingOcup } = useReporteOcupacionProyectos(desde, hasta);
  const { data: equipos, isLoading: loadingEq } = useReporteCargaEquipos(desde, hasta);
  const { data: vencer, isLoading: loadingVencer } = useReporteProximosVencer(diasVencer);

  // ===== Datos derivados =====
  const recursos = util?.recursos ?? [];

  const kpis = useMemo(() => {
    const totalPersonas = recursos.length;
    const sobrecargados = recursos.filter((r) => r.porcentajeOcupacion >= 100).length;
    const sinAsignar = recursos.filter((r) => r.porcentajeOcupacion === 0).length;
    const horasAsignadas = Math.round(recursos.reduce((acc, r) => acc + r.horasAsignadas, 0));
    const proyectosActivos = (ocup?.proyectos ?? []).filter(
      (p) => p.horasTotales > 0
    ).length;
    return { totalPersonas, sobrecargados, sinAsignar, horasAsignadas, proyectosActivos };
  }, [recursos, ocup]);

  const dataUtil = useMemo(
    () =>
      [...recursos]
        .sort((a, b) => b.porcentajeOcupacion - a.porcentajeOcupacion)
        .slice(0, 15)
        .map((r) => ({
          nombre: r.recursoNombre,
          ocupacion: r.porcentajeOcupacion,
          color: COLOR_ALERTA[r.alerta] ?? '#94A3B8',
        })),
    [recursos]
  );

  const dataOcup = useMemo(
    () =>
      (ocup?.proyectos ?? [])
        .filter((p) => p.horasTotales > 0)
        .sort((a, b) => b.horasTotales - a.horasTotales)
        .slice(0, 12)
        .map((p) => ({ nombre: p.proyectoNombre, horas: p.horasTotales })),
    [ocup]
  );

  const dataEquipos = useMemo(
    () =>
      (equipos?.equipos ?? []).map((e) => ({
        nombre: e.equipoNombre,
        ocupacion: e.porcentajeOcupacion,
        asignadas: e.horasAsignadas,
        disponibles: e.horasDisponibles,
      })),
    [equipos]
  );

  const dataTipos = useMemo(() => {
    const agg = new Map<string, number>();
    recursos.forEach((r) =>
      r.detallePorTipoActividad.forEach((t) => {
        agg.set(t.nombre, (agg.get(t.nombre) ?? 0) + t.horas);
      })
    );
    return Array.from(agg.entries())
      .map(([nombre, horas]) => ({ nombre, horas: Math.round(horas) }))
      .sort((a, b) => b.horas - a.horas);
  }, [recursos]);

  const COLOR_PIE = ['#00B050', '#FFD966', '#4472C4', '#F4B183', '#C55A5A', '#9BC2E6', '#7030A0', '#92D050'];

  const exportarUtilizacion = () => {
    downloadCSV(
      `carga_recursos_${desde}_${hasta}`,
      ['Recurso', 'Equipo', 'Departamento', 'Horas asignadas', 'Horas disponibles', '% ocupación', 'Alerta'],
      recursos.map((r) => [
        r.recursoNombre,
        r.equipoNombre ?? '',
        r.departamentoNombre ?? '',
        r.horasAsignadas,
        r.horasDisponibles,
        r.porcentajeOcupacion,
        ETIQUETA_ALERTA[r.alerta] ?? r.alerta,
      ])
    );
  };

  const exportarProyectos = () => {
    downloadCSV(
      `ocupacion_proyectos_${desde}_${hasta}`,
      ['Proyecto', 'Cliente', 'Recursos asignados', 'Horas totales'],
      (ocup?.proyectos ?? []).map((p) => [
        p.proyectoNombre,
        p.clienteNombre ?? '',
        p.recursosAsignados,
        p.horasTotales,
      ])
    );
  };

  const exportarEquipos = () => {
    downloadCSV(
      `carga_equipos_${desde}_${hasta}`,
      ['Equipo', 'Departamento', 'Personas', 'Horas asignadas', 'Horas disponibles', '% ocupación', 'Sin asignar'],
      (equipos?.equipos ?? []).map((e) => [
        e.equipoNombre,
        e.departamentoNombre ?? '',
        e.totalRecursos,
        e.horasAsignadas,
        e.horasDisponibles,
        e.porcentajeOcupacion,
        e.recursosSinAsignar,
      ])
    );
  };

  const exportarProximos = () => {
    const filas: (string | number)[][] = [];
    (vencer?.proyectos ?? []).forEach((p) =>
      filas.push(['Proyecto', p.nombre, p.cliente ?? '', p.fechaFin ?? '', p.diasRestantes, `${p.percentComplete}%`])
    );
    (vencer?.asignaciones ?? []).forEach((a) =>
      filas.push(['Asignación', a.nombre, a.recurso, a.fechaFin, a.diasRestantes, a.proyectoNombre])
    );
    downloadCSV(`proximos_a_vencer_${diasVencer}dias`, ['Tipo', 'Nombre', 'Detalle', 'Fecha fin', 'Días restantes', 'Avance'], filas);
  };

  return (
    <div className="space-y-4 p-6">
      {/* ===== Header + período ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-muted-foreground">
            Cargas de trabajo, avances y plazos del equipo
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex gap-1 pb-0.5">
            {[30, 60, 90].map((d) => (
              <Button
                key={d}
                variant="outline"
                size="sm"
                onClick={() => {
                  setDesde(format(new Date(), 'yyyy-MM-dd'));
                  setHasta(format(new Date(Date.now() + d * 86400000), 'yyyy-MM-dd'));
                }}
              >
                {d} días
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== KPIs ===== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Personas activas" value={kpis.totalPersonas} color="text-blue-600" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Sobrecargadas (≥100%)" value={kpis.sobrecargados} color="text-red-600" />
        <KpiCard icon={<Timer className="h-4 w-4" />} label="Sin asignar" value={kpis.sinAsignar} color="text-slate-500" />
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Horas asignadas" value={kpis.horasAsignadas} color="text-green-600" />
        <KpiCard icon={<FolderKanban className="h-4 w-4" />} label="Proyectos con carga" value={kpis.proyectosActivos} color="text-purple-600" />
      </div>

      {/* ===== Carga por recurso ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Carga por recurso (% ocupación)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportarUtilizacion}>
            <Download className="mr-2 h-4 w-4" />
            Descargar CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingUtil ? (
            <Spinner />
          ) : dataUtil.length === 0 ? (
            <SinDatos />
          ) : (
            <>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataUtil} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, Math.max(120, ...dataUtil.map((d) => d.ocupacion))]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombre" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Ocupación']} />
                    <Bar dataKey="ocupacion" radius={[0, 3, 3, 0]}>
                      {dataUtil.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                    <ReferenceLine x={100} stroke="#C00000" strokeDasharray="4 4" label={{ value: '100%', fill: '#C00000', fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla detallada */}
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Equipo</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Disponibles</TableHead>
                      <TableHead className="text-right">% </TableHead>
                      <TableHead>Alerta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recursos.map((r) => (
                      <TableRow key={r.recursoId}>
                        <TableCell className="font-medium">{r.recursoNombre}</TableCell>
                        <TableCell className="text-muted-foreground">{r.equipoNombre ?? '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.horasAsignadas}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.horasDisponibles}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{r.porcentajeOcupacion}%</TableCell>
                        <TableCell>
                          <Badge
                            variant={r.alerta === 'CRITICA_120' || r.alerta === 'SOBRECARGA' ? 'destructive' : r.alerta === 'ALERTA_80' ? 'secondary' : 'outline'}
                            className="text-[10px]"
                          >
                            {ETIQUETA_ALERTA[r.alerta] ?? r.alerta}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ===== Ocupación por proyecto ===== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              Horas por proyecto
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportarProyectos}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </CardHeader>
          <CardContent>
            {loadingOcup ? (
              <Spinner />
            ) : dataOcup.length === 0 ? (
              <SinDatos />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataOcup}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nombre" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} h`, 'Horas asignadas']} />
                    <Bar dataKey="horas" fill="#4472C4" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== Distribución por tipo de actividad ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-4 w-4" />
              Distribución de horas por tipo de actividad
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUtil ? (
              <Spinner />
            ) : dataTipos.length === 0 ? (
              <SinDatos />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dataTipos} dataKey="horas" nameKey="nombre" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {dataTipos.map((_, i) => (
                        <Cell key={i} fill={COLOR_PIE[i % COLOR_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} h`, String(n)]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Carga por equipo ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Carga por equipo (% ocupación)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportarEquipos}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loadingEq ? (
            <Spinner />
          ) : dataEquipos.length === 0 ? (
            <SinDatos />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataEquipos}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Ocupación']} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ocupacion" name="Ocupación" radius={[3, 3, 0, 0]}>
                    {dataEquipos.map((e, i) => (
                      <Cell key={i} fill={e.ocupacion >= 100 ? '#C00000' : e.ocupacion >= 80 ? '#FFC000' : '#00B050'} />
                    ))}
                  </Bar>
                  <ReferenceLine y={100} stroke="#C00000" strokeDasharray="4 4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Próximos a vencer ===== */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            Próximos a vencer
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[7, 15, 30, 60].map((d) => (
                <Button
                  key={d}
                  variant={diasVencer === d ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiasVencer(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportarProximos}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingVencer ? (
            <Spinner />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Proyectos que cierran */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Proyectos que cierran ({vencer?.proyectos.length ?? 0})
                </h3>
                {(vencer?.proyectos.length ?? 0) === 0 ? (
                  <p className="rounded-md border p-4 text-sm text-muted-foreground">
                    Ningún proyecto termina en los próximos {diasVencer} días
                  </p>
                ) : (
                  (vencer?.proyectos ?? []).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-md border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.cliente ?? 'Sin cliente'} · termina {fechaCorta(p.fechaFin)}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', p.percentComplete >= 80 ? 'bg-green-600' : p.percentComplete >= 40 ? 'bg-amber-500' : 'bg-red-500')}
                            style={{ width: `${p.percentComplete}%` }}
                          />
                        </div>
                      </div>
                      <DiasRestantes dias={p.diasRestantes} />
                    </div>
                  ))
                )}
              </div>

              {/* Asignaciones que terminan */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Asignaciones que terminan ({vencer?.asignaciones.length ?? 0})
                </h3>
                {(vencer?.asignaciones.length ?? 0) === 0 ? (
                  <p className="rounded-md border p-4 text-sm text-muted-foreground">
                    Ninguna asignación termina en los próximos {diasVencer} días
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {(vencer?.asignaciones ?? []).map((a) => (
                      <div key={a.id} className="flex items-center gap-3 rounded-md border p-2.5">
                        <div
                          className="h-8 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: a.proyectoColor ?? '#94A3B8' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {a.nombre} · {a.proyectoNombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {a.recurso} · termina {fechaCorta(a.fechaFin)}
                          </p>
                        </div>
                        <DiasRestantes dias={a.diasRestantes} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Componentes de apoyo
// ============================================

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('rounded-md bg-muted p-2', color)}>{icon}</div>
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function SinDatos() {
  return (
    <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      Sin datos en el período seleccionado
    </p>
  );
}

function DiasRestantes({ dias }: { dias: number }) {
  const urgente = dias <= 7;
  const pronto = dias <= 15;
  return (
    <div className="shrink-0 text-right">
      <p className={cn('text-sm font-bold tabular-nums', urgente ? 'text-red-600' : pronto ? 'text-amber-600' : 'text-muted-foreground')}>
        {dias}d
      </p>
      <p className="text-[10px] text-muted-foreground">{dias === 0 ? 'hoy' : 'restantes'}</p>
    </div>
  );
}
