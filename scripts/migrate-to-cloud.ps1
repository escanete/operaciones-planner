# Migración de Local a Cloud (Vercel + Neon)
# Ejecutar desde la raíz del proyecto: .\scripts\migrate-to-cloud.ps1

param(
    [Parameter(Mandatory=$false)]
    [string]$NeonDatabaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$VercelToken,
    
    [Parameter(Mandatory=$false)]
    [string]$VercelProjectName = "operaciones-planner"
)

Write-Host "🚀 Script de Migración a Cloud (Vercel + Neon)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Verificar dependencias
Write-Host "`n📦 Verificando dependencias..." -ForegroundColor Yellow
if (-not (Get-Command "vercel" -ErrorAction SilentlyContinue)) {
    Write-Host "Instalando Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

if (-not (Get-Command "neon" -ErrorAction SilentlyContinue)) {
    Write-Host "Instalando Neon CLI..." -ForegroundColor Yellow
    npm install -g neonctl
}

# 2. Crear proyecto Neon (si no se proporcionó URL)
if ([string]::IsNullOrEmpty($NeonDatabaseUrl)) {
    Write-Host "`n🌐 Creando proyecto en Neon..." -ForegroundColor Yellow
    Write-Host "Por favor, autentícate con: neonctl auth" -ForegroundColor Yellow
    neonctl auth
    
    Write-Host "Creando proyecto..." -ForegroundColor Yellow
    $NeonProjectName = "$VercelProjectName-$([guid]::NewGuid().ToString('N').Substring(0,6))"
    neonctl projects create --name $NeonProjectName
    
    # Obtener connection string
    $NeonDatabaseUrl = neonctl connection-string --project-name $NeonProjectName
    Write-Host "✅ Neon database creada: $NeonProjectName" -ForegroundColor Green
}

# 3. Actualizar schema Prisma para PostgreSQL
Write-Host "`n📝 Actualizando Prisma schema a PostgreSQL..." -ForegroundColor Yellow
$schemaPath = "packages/backend/prisma/schema.prisma"
$schema = Get-Content $schemaPath -Raw
$schema = $schema -replace 'provider = "sqlite"', 'provider = "postgresql"'

# Backup original
Copy-Item $schemaPath "$schemaPath.sqlite.backup"
Set-Content $schemaPath $schema

Write-Host "✅ Schema actualizado a PostgreSQL" -ForegroundColor Green

# 4. Crear archivo .env.production
$envContent = @"
DATABASE_URL="$NeonDatabaseUrl"
BETTER_AUTH_SECRET="$([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))"
BETTER_AUTH_URL="https://$VercelProjectName.vercel.app"
NODE_ENV="production"
"@

New-Item -ItemType Directory -Force -Path "packages/backend" | Out-Null
Set-Content "packages/backend/.env.production" $envContent
Write-Host "✅ .env.production creado" -ForegroundColor Green

# 5. Crear vercel.json
$vercelConfig = @{
    version = 2
    name = $VercelProjectName
    builds = @(
        @{ src = "packages/frontend/package.json"; use = "@vercel/static-build"; config = @{ distDir = "dist" } }
        @{ src = "packages/backend/package.json"; use = "@vercel/node" }
    )
    routes = @(
        @{ src = "/api/(.*)"; dest = "packages/backend/src/index.ts" }
        @{ src = "/(.*)"; dest = "packages/frontend/dist/`$1" }
    )
    env = @{
        DATABASE_URL = "@database_url"
        BETTER_AUTH_SECRET = "@better_auth_secret"
        BETTER_AUTH_URL = "@better_auth_url"
    }
} | ConvertTo-Json -Depth 10

Set-Content "vercel.json" $vercelConfig
Write-Host "✅ vercel.json creado" -ForegroundColor Green

# 6. Migrar base de datos a Neon
Write-Host "`n🗄️ Migrando datos a Neon PostgreSQL..." -ForegroundColor Yellow
Push-Location packages/backend

# Crear migración inicial si no existe
if (-not (Test-Path "prisma/migrations")) {
    npx prisma migrate dev --name init --create-only --skip-seed
}

# Ejecutar migraciones en Neon
npx prisma migrate deploy --schema prisma/schema.prisma

Pop-Location
Write-Host "✅ Migración a Neon completada" -ForegroundColor Green

# 7. Deploy a Vercel
Write-Host "`n🚀 Desplegando a Vercel..." -ForegroundColor Yellow
if (-not [string]::IsNullOrEmpty($VercelToken)) {
    vercel login $VercelToken
}

vercel --prod --yes

Write-Host "`n🎉 ¡Migración completada!" -ForegroundColor Green
Write-Host "URL: https://$VercelProjectName.vercel.app" -ForegroundColor Cyan
Write-Host "Neon DB: Configurada en Vercel Dashboard > Storage" -ForegroundColor Cyan

# 8. Restaurar schema SQLite para desarrollo local futuro
Write-Host "`n🔄 Restaurando schema SQLite para desarrollo local..." -ForegroundColor Yellow
if (Test-Path "$schemaPath.sqlite.backup") {
    Copy-Item "$schemaPath.sqlite.backup" $schemaPath
    Remove-Item "$schemaPath.sqlite.backup"
}
Write-Host "✅ Schema SQLite restaurado" -ForegroundColor Green

Write-Host "`n📋 Resumen:" -ForegroundColor Cyan
Write-Host "  - Local: http://localhost:5173 (frontend) + http://localhost:3001 (backend)" -ForegroundColor White
Write-Host "  - Cloud: https://$VercelProjectName.vercel.app" -ForegroundColor White
Write-Host "  - DB Cloud: Neon PostgreSQL (vergewijzer: dashboard.neon.tech)" -ForegroundColor White
