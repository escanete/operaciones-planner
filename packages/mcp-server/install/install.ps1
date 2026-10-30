# Instalador del MCP de Operaciones Planner para Claude Desktop (Windows)
#
# Uso normal (doble clic o PowerShell):
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# Con otra URL de servidor:
#   powershell -ExecutionPolicy Bypass -File install.ps1 -ApiUrl "http://192.168.25.7:3001"
#
# Desinstalar:
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall

param(
  [string]$ApiUrl = "http://192.168.25.7:3001",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$installDir = Join-Path $env:LOCALAPPDATA "operaciones-planner-mcp"
$entry = Join-Path $installDir "index.js"
$downloadUrl = "https://github.com/Kohwal/operaciones-planner/releases/latest/download/operaciones-planner-mcp.js"

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

Write-Host "Descargando servidor MCP..." -ForegroundColor Cyan
try {
  Invoke-WebRequest -Uri $downloadUrl -OutFile $entry -UseBasicParsing
} catch {
  Write-Host ""
  Write-Host "No se pudo descargar el servidor desde GitHub." -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host "Verifica tu conexion a internet o pide soporte de TI."
  exit 1
}

Write-Host ""
Write-Host "Iniciando sesion con tu cuenta de Operaciones Planner..." -ForegroundColor Cyan
& node $entry --login --api-url $ApiUrl

Write-Host ""
Write-Host "Listo. Cierra y vuelve a abrir Claude Desktop para usar el servidor 'operaciones-planner'." -ForegroundColor Green
Write-Host "Puedes comprobar la sesion con:" -ForegroundColor Gray
Write-Host "  node `"$entry`" --status" -ForegroundColor Gray
