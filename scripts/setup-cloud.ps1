# =============================================================
# Preparar Neon PostgreSQL para el deploy en Vercel
# Ejecutar desde la raíz del repo: .\scripts\setup-cloud.ps1
#
# No escribe secretos en archivos: solo los usa en el proceso y
# te indica cuáles debes cargar en Vercel (Settings > Environment Variables).
# =============================================================

param(
    [string]$DatabaseUrl = '',
    [string]$VercelUrl = '',
    [string]$AdminPassword = ''
)

$ErrorActionPreference = 'Stop'

Write-Host '☁️  Configuración de la base de datos cloud (Neon + Vercel)' -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    $DatabaseUrl = Read-Host 'Connection string de Neon (postgresql://...)'
}
if (-not $DatabaseUrl.StartsWith('postgresql://') -and -not $DatabaseUrl.StartsWith('postgres://')) {
    throw 'La connection string debe empezar con postgresql:// (usa el pooler de Neon).'
}

if ([string]::IsNullOrWhiteSpace($VercelUrl)) {
    $VercelUrl = Read-Host 'URL de Vercel (https://xxx.vercel.app)'
}
if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
    $AdminPassword = Read-Host 'Contraseña del usuario demo admin (enter = admin123)'
    if ([string]::IsNullOrWhiteSpace($AdminPassword)) { $AdminPassword = 'admin123' }
}

# Secreto de Better-Auth: se genera aquí y se muestra para copiar a Vercel.
$authSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })

$env:DATABASE_URL = $DatabaseUrl
$env:DEMO_ADMIN_PASSWORD = $AdminPassword

Write-Host "`n📦 Aplicando migraciones PostgreSQL..." -ForegroundColor Yellow
pnpm --filter @operaciones-planner/backend exec prisma migrate deploy --schema prisma/postgres/schema.prisma

Write-Host "`n🌱 Cargando datos de demostración (sintéticos)..." -ForegroundColor Yellow
pnpm --filter @operaciones-planner/backend exec tsx prisma/seed-demo.ts

Write-Host "`n🔄 Restaurando el cliente Prisma local (SQLite)..." -ForegroundColor Yellow
pnpm --filter @operaciones-planner/backend exec prisma generate --schema prisma/schema.prisma

Write-Host "`n✅ Base de datos cloud lista." -ForegroundColor Green
Write-Host "`nCarga estas variables en Vercel > Settings > Environment Variables:" -ForegroundColor Cyan
Write-Host "  DATABASE_URL         = $DatabaseUrl"
Write-Host "  BETTER_AUTH_SECRET   = $authSecret"
Write-Host "  BETTER_AUTH_URL      = $VercelUrl"
Write-Host "  CORS_ORIGIN          = $VercelUrl"
Write-Host "  TRUSTED_ORIGINS      = $VercelUrl"
Write-Host "  FRONTEND_URL         = $VercelUrl"
Write-Host "  NODE_ENV             = production"
Write-Host "`nCredenciales de la maqueta: admin@operaciones.local / $AdminPassword" -ForegroundColor Cyan
Write-Host "Después de cargar las variables, haz un Redeploy en Vercel." -ForegroundColor Yellow
