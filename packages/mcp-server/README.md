# Operaciones Planner — MCP Server

Servidor **MCP local** que conecta Claude Desktop con Operaciones Planner usando
**la cuenta de cada persona**. Corre en el PC del usuario y habla con la API del
servidor de la empresa; no hay chat embebido en la plataforma ni se envían datos a
ningún servicio extra.

Con este servidor la IA puede:

- Consultar proyectos, clientes, recursos, etiquetas y materiales.
- Crear proyectos completos con actividades, tareas, subtareas y recursos asignados.
- Editar proyectos, tareas, subtareas y materiales.
- Crear asignaciones de planificación con fechas, detectar conflictos y consultar carga.
- Leer un Excel local aportado por el usuario y usar esos datos para crear el proyecto.

Todas las operaciones respetan los permisos y roles de la cuenta que inició sesión.

---

## Requisitos

- **Node.js 20 o superior** (https://nodejs.org/es/download).
- **Claude Desktop** instalado y con sesión iniciada.
- Acceso de red al servidor de Operaciones Planner (`http://192.168.25.7:3001`).

---

## Instalación (Windows)

1. Descarga el instalador desde el servidor de la empresa y ejecútalo:

   ```powershell
   Invoke-WebRequest http://192.168.25.7:3001/api/mcp/install.ps1 -OutFile install.ps1
   powershell -ExecutionPolicy Bypass -File install.ps1
   ```

2. Escribe tu email y contraseña de Operaciones Planner cuando se pidan.
3. Cierra y vuelve a abrir **Claude Desktop**.

El script descarga la última versión del servidor **desde el propio backend de la
empresa** (`{ApiUrl}/api/mcp/operaciones-planner-mcp.js`), inicia sesión y registra
el servidor en `claude_desktop_config.json` automáticamente (haciendo respaldo del
archivo anterior). No se necesita GitHub ni ninguna cuenta adicional.

Si el servidor de la empresa tiene otra URL:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -ApiUrl "http://192.168.25.7:3001"
```

Instalación desatendida (para TI, sin preguntas):

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Email "usuario@empresa.cl" -Password "..."
```

Usar un bundle local en vez de descargarlo (por ejemplo si la red lo bloquea):

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -BundleUrl "C:\ruta\operaciones-planner-mcp.js"
```

Desinstalar:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall
```

## Instalación (macOS / Linux)

```bash
curl -fsSL http://192.168.25.7:3001/api/mcp/install.sh -o install.sh
bash install.sh
# o con otra URL:
bash install.sh --api-url http://192.168.25.7:3001
# instalación desatendida:
bash install.sh --email usuario@empresa.cl --password "..."
```

---

## Uso con Claude Desktop

Después de reiniciar Claude, el servidor aparece como **operaciones-planner** en
los ajustes de conectores/MCP. Ejemplos de pedidos:

- «Lista los proyectos activos y el avance de cada uno.»
- «Muéstrame la carga de Esteban Cañete en las próximas dos semanas.»
- «Crea un proyecto llamado “Mantenimiento Planta Norte” para el cliente Transelec,
  del 1 al 30 de noviembre, con una actividad de preparación y una tarea de
  despliegue asignada a Esteban.»
- «Agrega el material “Cable 2.5 mm” al proyecto anterior, 100 metros.»
- «Lee el archivo `C:\Users\...\plan.xlsx` y crea el proyecto con esa jerarquía.»

### Fechas

Todas las fechas se usan en formato `YYYY-MM-DD` (por ejemplo `2026-11-15`).

### Jerarquía

`Proyecto → Actividad → Tarea → Subtarea`

- Los **recursos de una tarea** se asignan con el campo `recursos` al crear o
  editar la tarea.
- Las **asignaciones de planificación** (con fechas y tipo de actividad) se crean
  con `asignar_recurso` y se consultan con `consultar_carga`.

---

## Herramientas disponibles

| Herramienta | Qué hace |
| --- | --- |
| `listar_proyectos` | Busca/listas proyectos con cliente, estado y avance |
| `ver_proyecto` | Árbol WBS completo, materiales y asignaciones del proyecto |
| `crear_proyecto_completo` | Proyecto + actividades + tareas + subtareas + recursos + materiales |
| `actualizar_proyecto` | Nombre, fechas, estado, cliente o etiquetas |
| `crear_actividad` / `crear_tarea` / `crear_subtarea` | Agregan nodos al WBS |
| `actualizar_tarea` / `actualizar_subtarea` | Editan nodos y sus recursos/etiquetas |
| `listar_recursos` | Busca personas, vehículos, equipos y herramientas |
| `listar_clientes` / `crear_cliente` | Catálogo de clientes |
| `listar_etiquetas` / `crear_etiqueta` | Catálogo global de etiquetas |
| `listar_catalogo_materiales` / `crear_material_catalogo` | Catálogo global de materiales |
| `agregar_material` / `actualizar_material` | Materiales del proyecto |
| `listar_tipos_actividad` / `crear_tipo_actividad` | Tipos para planificación |
| `asignar_recurso` | Asignación con fechas (y vínculo a actividad/tarea/subtarea) |
| `mover_asignacion` / `cancelar_asignacion` | Mueve o cancela asignaciones |
| `validar_conflicto_asignacion` | Comprueba solapes, ausencias y vehículo ocupado |
| `consultar_carga` | Ocupación por recurso en un rango de fechas |
| `listar_asignaciones` | Asignaciones con filtros |
| `leer_excel` | Lee .xlsx/.xls/.csv locales y devuelve filas en JSON |

---

## Trabajar con un Excel

El Excel lo aporta el usuario; la plataforma no lo almacena. El flujo es:

1. El usuario indica la ruta del archivo (o la pega en el chat).
2. Claude llama a `leer_excel` y revisa columnas y filas.
3. Claude arma la jerarquía y llama a `crear_proyecto_completo` (o a las
   herramientas de nodo si el archivo es muy grande).

No hace falta una plantilla fija: el modelo interpreta los encabezados. Para
archivos grandes, `leer_excel` permite paginar con `desde` y `limite`.

---

## Sesión y seguridad

- La sesión es la **cookie de Better-Auth** del usuario, emitida por el servidor.
- Se guarda en:
  - Windows: `%APPDATA%\operaciones-planner-mcp\config.json`
  - macOS: `~/Library/Application Support/operaciones-planner-mcp/config.json`
  - Linux: `~/.config/operaciones-planner-mcp/config.json`
- En Windows la carpeta queda en el perfil del usuario; en macOS/Linux el archivo
  se crea con permisos `600`.
- La sesión dura **7 días**. Cuando expire, las herramientas avisan y hay que
  ejecutar `--login` de nuevo.
- `--logout` cierra la sesión en el servidor y borra la copia local.
- Cambiar de usuario = `--logout` y luego `--login` con la otra cuenta.

Comandos útiles (con la ruta donde quedó `index.js`):

```powershell
node "$env:LOCALAPPDATA\operaciones-planner-mcp\index.js" --status
node "$env:LOCALAPPDATA\operaciones-planner-mcp\index.js" --login
node "$env:LOCALAPPDATA\operaciones-planner-mcp\index.js" --logout
```

---

## Problemas frecuentes

**Claude no muestra el servidor**
- Cierra Claude por completo (incluida la bandeja del sistema) y vuelve a abrirlo.
- Verifica que `claude_desktop_config.json` tenga la entrada `operaciones-planner`.
- Revisa los logs de Claude Desktop: `%APPDATA%\Claude\logs\mcp-server-operaciones-planner.log`.

**«Sesión no válida o expirada»**
- Ejecuta `--login` otra vez. La sesión dura 7 días.

**«No se pudo conectar con http://...»**
- Verifica que el servidor de la empresa esté encendido y accesible desde tu PC
  (por ejemplo, abre `http://192.168.25.7:3001/api/health` en el navegador).

**«Sin permisos (403)»**
- Tu rol no permite esa operación. Pide a un administrador que revise tu rol.

**El instalador no descarga**
- El bundle se descarga del backend de la empresa, no de GitHub. Comprueba que
  `http://192.168.25.7:3001/api/mcp/operaciones-planner-mcp.js` abra o descargue
  un archivo (y que `/api/health` responda).
- Si el servidor aún no publica el MCP (responde 404 `MCP_NO_DISPONIBLE`), pide a
  TI que reconstruya el backend con `docker compose up -d --build`.
- Alternativa: pide a TI el archivo `operaciones-planner-mcp.js` y usa
  `install.ps1 -BundleUrl "C:\ruta\operaciones-planner-mcp.js"`.

---

## Desarrollo

Desde la raíz del repositorio:

```bash
pnpm install
pnpm --filter @operaciones-planner/mcp-server exec tsc --noEmit
pnpm --filter @operaciones-planner/mcp-server build   # genera dist/index.js
```

Probar el servidor contra el backend local:

```bash
# Windows PowerShell
$env:OPERACIONES_PLANNER_CONFIG_DIR="$env:TEMP\op-mcp-test"
node packages/mcp-server/dist/index.js --login --api-url http://localhost:3001 --no-install
node packages/mcp-server/dist/index.js --status
```

Variables de entorno útiles:

- `OPERACIONES_PLANNER_API_URL`: URL del backend.
- `OPERACIONES_PLANNER_CONFIG_DIR`: carpeta alternativa de configuración.
- `OPERACIONES_PLANNER_COOKIE`: cookie de sesión (para pruebas automatizadas).

### Publicar una versión

El bundle que descargan los usuarios lo sirve el backend, así que se actualiza al
desplegar:

```bash
# en el servidor 192.168.25.7
git pull
docker compose up -d --build
```

El `Dockerfile` del backend compila `packages/mcp-server` y copia el resultado a
`/app/public/operaciones-planner-mcp.js`; la ruta pública es
`/api/mcp/operaciones-planner-mcp.js`.

Además, el workflow `.github/workflows/mcp-release.yml` publica el mismo bundle en
GitHub Releases (útil para TI; el repositorio es privado, por lo que esa descarga
requiere credenciales de GitHub):

```bash
git tag mcp-v1.0.0
git push origin mcp-v1.0.0
```
