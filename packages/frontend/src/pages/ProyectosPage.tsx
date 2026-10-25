import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProyectos } from '@/hooks/useApi';
import { api, ApiError } from '@/services/api';
import { FileUp, Loader2, Star } from 'lucide-react';
import type { MsProjectImportPreview, MsProjectImportResult } from '@operaciones-planner/shared';

export function ProyectosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: proyectos, isLoading } = useProyectos();

  // ===== Asistente de importación MS Project =====
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<MsProjectImportPreview | null>(null);
  const [crearRecursos, setCrearRecursos] = useState(true);
  const [importando, setImportando] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const resetImport = () => {
    setXmlContent(null);
    setPreviewData(null);
    setImportError(null);
    setCrearRecursos(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    const text = await file.text();
    setXmlContent(text);
    try {
      const res = await api.post<MsProjectImportPreview>('/api/proyectos/import-msproject', {
        xml: text,
        preview: true,
      });
      setPreviewData(res);
    } catch (err) {
      setPreviewData(null);
      setImportError(err instanceof Error ? err.message : 'No se pudo leer el archivo');
    }
  };

  const confirmImport = async () => {
    if (!xmlContent) return;
    setImportando(true);
    setImportError(null);
    try {
      const res = await api.post<MsProjectImportResult>('/api/proyectos/import-msproject', {
        xml: xmlContent,
        crearRecursos,
      });
      await queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      await queryClient.invalidateQueries({ queryKey: ['recursos'] });
      await queryClient.invalidateQueries({ queryKey: ['project-gantt'] });
      const detalle =
        `${res.actividades} actividades, ${res.tareas} tareas, ${res.subtareas} subtareas.\n` +
        `${res.asignaciones} asignaciones de personas a tareas.` +
        (res.recursosCreados.length > 0
          ? `\n\nRecursos creados automáticamente:\n${res.recursosCreados.map((r) => `• ${r}`).join('\n')}`
          : '');
      alert(`Proyecto "${res.nombre}" importado correctamente.\n\n${detalle}`);
      resetImport();
      navigate(`/proyectos/${res.proyectoId}`);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.data && typeof err.data === 'object' && 'error' in err.data
          ? String((err.data as { error: string }).error)
          : err instanceof Error
          ? err.message
          : 'Error al importar';
      setImportError(msg);
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestión de Proyectos</h1>
        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
          <FileUp className="mr-2 h-4 w-4" />
          Importar MS Project
        </Button>
        {/* Input de archivo oculto (acepta .xml) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Proyectos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Cargando...</p>
          ) : proyectos && proyectos.length > 0 ? (
            <div className="space-y-2">
              {proyectos.map((p) => (
                <div
                  key={p.id}
                  className="flex cursor-pointer items-center justify-between rounded border p-3 transition-colors hover:bg-accent"
                  onClick={() => navigate(`/proyectos/${p.id}`)}
                  title="Abrir detalle con actividades, tareas y subtareas"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {p.relevante && (
                      <Star className="h-4 w-4 shrink-0 text-amber-500" fill="currentColor" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.nombre}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {p.codigo} - {p.cliente?.nombre}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.percentComplete !== undefined && p.percentComplete !== null && (
                      <span className="text-sm font-medium tabular-nums">{p.percentComplete}%</span>
                    )}
                    <Badge variant={p.activo ? 'default' : 'secondary'}>{p.estado}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay proyectos todavía. Créalos desde Admin, o importa un archivo XML exportado
              desde Microsoft Project con el botón «Importar MS Project».
            </p>
          )}
        </CardContent>
      </Card>

      {/* ===== Diálogo de confirmación de importación ===== */}
      <Dialog
        open={!!previewData || !!importError}
        onOpenChange={(open) => {
          if (!open) resetImport();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar desde MS Project</DialogTitle>
            <DialogDescription>
              Revisa el contenido detectado en el archivo XML antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          {previewData ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="font-semibold">{previewData.nombreProyecto}</p>
                {previewData.fechaInicio && (
                  <p className="text-sm text-muted-foreground">
                    {previewData.fechaInicio} → {previewData.fechaFin}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2">
                  <p className="text-lg font-bold">{previewData.totalActividades}</p>
                  <p className="text-xs text-muted-foreground">Actividades</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-lg font-bold">{previewData.totalTareas}</p>
                  <p className="text-xs text-muted-foreground">Tareas</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-lg font-bold">{previewData.totalSubtareas}</p>
                  <p className="text-xs text-muted-foreground">Subtareas</p>
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <p>
                  <span className="font-medium">{previewData.recursosExistentes}</span> personas
                  coinciden con recursos ya registrados.
                </p>
                {previewData.recursosFaltantes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-muted-foreground">No encontrados en el sistema:</p>
                    <p className="text-xs text-muted-foreground">
                      {previewData.recursosFaltantes.join(', ')}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Checkbox
                        id="crear-recursos"
                        checked={crearRecursos}
                        onCheckedChange={(v) => setCrearRecursos(v === true)}
                      />
                      <Label htmlFor="crear-recursos" className="text-sm font-normal">
                        Crear automáticamente estas personas como recursos
                      </Label>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Se creará un proyecto nuevo en estado PLANIFICACIÓN con esta estructura. Las fechas
                y el avance (100%) se respetan; luego puedes ajustarlo con normalidad.
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">{importError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetImport} disabled={importando}>
              Cancelar
            </Button>
            <Button onClick={confirmImport} disabled={importando || !previewData}>
              {importando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                'Confirmar importación'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
