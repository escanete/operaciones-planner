import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { ApiError, api } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/* ============================================================
   Archivos del proyecto en SharePoint

   Cada usuario conecta su propia cuenta de Microsoft; SharePoint
   aplica los permisos reales sobre la carpeta del proyecto:
   Operaciones/Planner_Proyectos/{proyectoId}/
   ============================================================ */

interface ArchivoProyecto {
  id: string;
  nombre: string;
  tamano: number;
  modificado: string | null;
  creado: string | null;
  webUrl: string;
  tipoMime: string;
  subidoPor: string | null;
  esCarpeta: boolean;
}

interface CarpetaProyecto {
  folderId: string;
  folderPath: string;
  webUrl: string;
  driveId: string;
}

interface EstadoGraph {
  configurado: boolean;
  conectado: boolean;
  detalle?: string;
  error?: string;
  usuario?: { displayName: string | null; mail: string | null; userPrincipalName: string };
  sitio?: { nombre: string; webUrl: string; siteWebUrl: string };
}

const ROLES_ESCRITURA = ['SUPER_ADMIN', 'ADMIN_DEPTO', 'PLANIFICADOR', 'COMERCIAL'];

function formatearTamano(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ProjectFiles({ proyectoId }: { proyectoId: string }) {
  const { user } = useAuthStore();
  const [estado, setEstado] = useState<EstadoGraph | null>(null);
  const [archivos, setArchivos] = useState<ArchivoProyecto[]>([]);
  const [carpeta, setCarpeta] = useState<CarpetaProyecto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const puedeEscribir = ROLES_ESCRITURA.includes(user?.rol ?? '');
  const urlLogin = `/api/auth/msgraph/login?redirect=${encodeURIComponent(
    window.location.pathname
  )}`;

  const cargarArchivos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await api.get<{ carpeta: CarpetaProyecto; archivos: ArchivoProyecto[] }>(
        `/api/proyectos/${proyectoId}/archivos`
      );
      setArchivos(res.archivos);
      setCarpeta(res.carpeta);
      setEstado((prev) => ({ ...(prev ?? { configurado: true }), conectado: true }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEstado((prev) => ({ ...(prev ?? { configurado: true }), conectado: false }));
      } else {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los archivos');
      }
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const res = await api.get<EstadoGraph>('/api/auth/msgraph/estado');
        if (!activo) return;
        setEstado(res);
        if (res.conectado) {
          await cargarArchivos();
        } else {
          setCargando(false);
        }
      } catch (err) {
        if (!activo) return;
        setEstado({ configurado: true, conectado: false });
        setError(err instanceof Error ? err.message : 'No se pudo consultar SharePoint');
        setCargando(false);
      }
    })();

    // Mensajes del callback de Microsoft (?sharepoint=conectado|error)
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('sharepoint');
    if (resultado === 'conectado') {
      setAviso('Cuenta de Microsoft conectada. Ya puedes trabajar con los archivos.');
    } else if (resultado === 'error') {
      const motivo = params.get('motivo') ?? 'desconocido';
      setError(`No se pudo conectar con Microsoft: ${motivo}`);
    }
    if (resultado) {
      params.delete('sharepoint');
      params.delete('motivo');
      const query = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
      );
    }

    return () => {
      activo = false;
    };
  }, [cargarArchivos]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const subirArchivos = async (lista: FileList | File[]) => {
    if (!puedeEscribir) {
      setError('No tienes permisos para subir archivos a este proyecto.');
      return;
    }

    const pendientes = Array.from(lista);
    if (pendientes.length === 0) return;

    setError(null);
    for (const archivo of pendientes) {
      setSubiendo(archivo.name);
      try {
        const formData = new FormData();
        formData.append('archivo', archivo);
        await api.upload(`/api/proyectos/${proyectoId}/archivos`, formData);
      } catch (err) {
        const mensaje = err instanceof Error ? err.message : `No se pudo subir "${archivo.name}"`;
        setError(mensaje);
        break;
      }
    }
    setSubiendo(null);
    if (inputRef.current) inputRef.current.value = '';
    await cargarArchivos();
  };

  const eliminar = async (archivo: ArchivoProyecto) => {
    if (!window.confirm(`¿Eliminar "${archivo.nombre}" de SharePoint?`)) return;
    setEliminando(archivo.id);
    setError(null);
    try {
      await api.delete(`/api/proyectos/${proyectoId}/archivos/${archivo.id}`);
      setArchivos((prev) => prev.filter((a) => a.id !== archivo.id));
      setAviso(`"${archivo.nombre}" eliminado`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el archivo');
    } finally {
      setEliminando(null);
    }
  };

  const copiarEnlace = async (archivo: ArchivoProyecto, tipo: 'view' | 'edit') => {
    setError(null);
    try {
      const res = await api.get<{ enlace: { webUrl: string } }>(
        `/api/proyectos/${proyectoId}/archivos/${archivo.id}/enlace?tipo=${tipo}`
      );
      await navigator.clipboard.writeText(res.enlace.webUrl);
      setCopiado(archivo.id);
      setAviso(
        tipo === 'edit'
          ? 'Enlace de edición copiado al portapapeles'
          : 'Enlace de vista copiado al portapapeles'
      );
      window.setTimeout(() => setCopiado(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el enlace');
    }
  };

  const descargar = (archivo: ArchivoProyecto) => {
    window.open(`/api/proyectos/${proyectoId}/archivos/${archivo.id}/descarga`, '_blank');
  };

  const conectar = () => {
    window.location.href = urlLogin;
  };

  const desconectar = async () => {
    if (!window.confirm('¿Desconectar tu cuenta de Microsoft de esta sesión del navegador?')) {
      return;
    }
    try {
      await api.post('/api/auth/msgraph/logout', {});
    } catch {
      // Aunque falle en el servidor, recargamos para limpiar el estado local
    }
    setArchivos([]);
    setCarpeta(null);
    setEstado((prev) => ({ ...(prev ?? { configurado: true }), conectado: false }));
    setAviso('Cuenta de Microsoft desconectada');
  };

  /* ---------- SharePoint no configurado ---------- */
  if (estado && !estado.configurado) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Cloud className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">SharePoint no está configurado</p>
            <p className="max-w-lg text-sm text-muted-foreground">
              {estado.detalle ??
                'El administrador debe configurar la App Registration de Microsoft Graph en el servidor.'}
            </p>
            <Badge variant="outline">Modo local</Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {/* Cabecera */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              Archivos del proyecto
            </h3>
            <p className="text-sm text-muted-foreground">
              {carpeta
                ? carpeta.folderPath
                : 'Operaciones / Planner_Proyectos / ' + proyectoId}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {carpeta?.webUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={carpeta.webUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir carpeta en SharePoint
                </a>
              </Button>
            )}
            {estado?.conectado && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cargarArchivos()}
                  disabled={cargando || Boolean(subiendo)}
                  title="Actualizar"
                >
                  <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="ghost" size="sm" onClick={desconectar} title="Desconectar Microsoft">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Cuenta conectada */}
        {estado?.conectado && estado.usuario && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">Conectado como</span>
            <span className="font-medium">
              {estado.usuario.displayName ?? estado.usuario.userPrincipalName}
            </span>
            {estado.usuario.mail && (
              <span className="text-muted-foreground">({estado.usuario.mail})</span>
            )}
          </div>
        )}

        {/* Avisos y errores */}
        {aviso && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">{aviso}</span>
            <button className="text-xs underline" onClick={() => setAviso(null)}>
              Cerrar
            </button>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="text-xs underline" onClick={() => setError(null)}>
              Cerrar
            </button>
          </div>
        )}

        {/* Sin conexión */}
        {estado && !estado.conectado ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Cloud className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Conecta tu cuenta de Microsoft</p>
              <p className="max-w-lg text-sm text-muted-foreground">
                Los archivos se guardan en SharePoint con tu propia cuenta, así se respetan los
                permisos del sitio <strong>ScadatechRecursos</strong>. Solo se solicita acceso a
                archivos y a tu perfil.
              </p>
              <Button onClick={conectar} className="mt-1">
                <Cloud className="mr-2 h-4 w-4" />
                Conectar con Microsoft
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Zona de subida */}
            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                arrastrando
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/40'
              }`}
              onDragEnter={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setArrastrando(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                if (e.dataTransfer.files.length) void subirArchivos(e.dataTransfer.files);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && void subirArchivos(e.target.files)}
              />
              {subiendo ? (
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Subiendo “{subiendo}”…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm">
                    Arrastra archivos aquí o{' '}
                    <button
                      className="font-medium underline underline-offset-2 disabled:opacity-50"
                      onClick={() => inputRef.current?.click()}
                      disabled={!puedeEscribir}
                    >
                      selecciónalos
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Se guardan en la carpeta del proyecto en SharePoint
                    {puedeEscribir ? '' : ' · tu rol es de solo lectura'}
                  </p>
                </div>
              )}
            </div>

            {/* Lista */}
            <Card>
              <CardContent className="p-0">
                {cargando ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Cargando archivos…
                  </div>
                ) : archivos.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <FileText className="h-9 w-9 text-muted-foreground" />
                    <p className="font-medium">No hay archivos todavía</p>
                    <p className="text-sm text-muted-foreground">
                      Sube planos, informes, actas, protocolos o manuales.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {archivos.map((archivo) => (
                      <li
                        key={archivo.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-3"
                      >
                        <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <a
                            href={archivo.webUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate font-medium hover:underline"
                            title={archivo.nombre}
                          >
                            {archivo.nombre}
                          </a>
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span>{formatearTamano(archivo.tamano)}</span>
                            <span>·</span>
                            <span>{formatearFecha(archivo.modificado)}</span>
                            {archivo.subidoPor && (
                              <>
                                <span>·</span>
                                <span>{archivo.subidoPor}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Descargar"
                            onClick={() => descargar(archivo)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copiar enlace de vista"
                            onClick={() => copiarEnlace(archivo, 'view')}
                            disabled={!puedeEscribir}
                          >
                            {copiado === archivo.id ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" title="Abrir en SharePoint" asChild>
                            <a href={archivo.webUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Eliminar"
                            onClick={() => eliminar(archivo)}
                            disabled={!puedeEscribir || eliminando === archivo.id}
                          >
                            {eliminando === archivo.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
