# Instalador del MCP de Operaciones Planner para Claude Desktop (Windows)
#
# Uso normal (doble clic o PowerShell):
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# Con otra URL de servidor:
#   powershell -ExecutionPolicy Bypass -File install.ps1 -ApiUrl "http://192.168.25.7:3001"
#
# Forzar un bundle distinto (por ejemplo un archivo local de TI):
#   powershell -ExecutionPolicy Bypass -File install.ps1 -BundleUrl "C:\ruta\operaciones-planner-mcp.js"
#
# Instalacion desatendida (para TI):
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Email "usuario@empresa.cl" -Password "..."
#
# Desinstalar:
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall

param(
  [string]$ApiUrl = "http://192.168.25.7:3001",
  [string]$BundleUrl = "",
  [string]$Email = "",
  [string]$Password = "",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "operaciones-planner-mcp"
$entry = Join-Path $installDir "index.js"
$servidor = $ApiUrl.TrimEnd("/")

# El bundle lo sirve el propio backend de la empresa: no requiere GitHub.
if ([string]::IsNullOrWhiteSpace($BundleUrl)) {
  $downloadUrl = "$servidor/api/mcp/operaciones-planner-mcp.js"
} else {
  $downloadUrl = $BundleUrl
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host ""
  Write-Host "Falta Node.js. Instala la version LTS desde https://nodejs.org/es/download" -ForegroundColor Yellow
  Write-Host "Despues de instalarlo, vuelve a ejecutar este script."
  Write-Host ""
  exit 1
}

$nodeVersion = (& node --version).TrimStart("v")
if ([int]($nodeVersion.Split(".")[0]) -lt 20) {
  Write-Host "Node.js $nodeVersion es demasiado antiguo. Se requiere Node.js 20 o superior." -ForegroundColor Yellow
  exit 1
}

if ($Uninstall) {
  if (Test-Path $entry) {
    & node $entry --uninstall
  }
  if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
  }
  Write-Host "MCP de Operaciones Planner desinstalado. Reinicia Claude Desktop." -ForegroundColor Green
  exit 0
}

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "Descargando servidor MCP desde $downloadUrl ..." -ForegroundColor Cyan
try {
  if ($downloadUrl -match '^https?://') {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $entry -UseBasicParsing
  } else {
    Copy-Item -Path $downloadUrl -Destination $entry -Force
  }
} catch {
  Write-Host ""
  Write-Host "No se pudo descargar el servidor MCP." -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host "Verifica que el servidor $servidor este encendido y accesible desde tu PC"
  Write-Host "(abre $servidor/api/health en el navegador). Si sigue fallando, pide soporte de TI."
  exit 1
}

# Comprobacion rapida de que el archivo descargado es el servidor MCP
$primerasLineas = Get-Content $entry -TotalCount 5 -ErrorAction SilentlyContinue
if (-not ($primerasLineas -match "node")) {
  Write-Host "El archivo descargado no parece un servidor MCP valido. Pide soporte de TI." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Iniciando sesion con tu cuenta de Operaciones Planner..." -ForegroundColor Cyan
if ($Email -and $Password) {
  & node $entry --login --api-url $servidor --email $Email --password $Password
} else {
  & node $entry --login --api-url $servidor
}

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "El login no se completo. Puedes intentarlo de nuevo con:" -ForegroundColor Yellow
  Write-Host "  node `"$entry`" --login --api-url $servidor" -ForegroundColor Gray
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Listo. Cierra y vuelve a abrir Claude Desktop para usar el servidor 'operaciones-planner'." -ForegroundColor Green
Write-Host "Puedes comprobar la sesion con:" -ForegroundColor Gray
Write-Host "  node `"$entry`" --status" -ForegroundColor Gray
