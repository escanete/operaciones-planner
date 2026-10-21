@echo off
title Planificador de Recursos - Operaciones
cd /d "%~dp0"

echo ============================================
echo   Planificador de Recursos - Operaciones
echo ============================================
echo.

:: Verificar si pnpm está instalado
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm no encontrado. Instalando...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo instalar pnpm
        pause
        exit /b 1
    )
)

:: Verificar si es primera vez (no existe node_modules en backend)
if not exist "packages\backend\node_modules" (
    echo [INFO] Primera ejecucion. Instalando dependencias...
    pnpm install
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo la instalacion de dependencias
        pause
        exit /b 1
    )
)

:: Verificar si existe la base de datos
if not exist "packages\backend\prisma\data\dev.db" (
    echo [INFO] Base de datos no encontrada. Creando...
    cd packages\backend
    call pnpm db:migrate
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo la migracion de base de datos
        pause
        exit /b 1
    )
    call pnpm db:seed
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo el seed de datos
        pause
        exit /b 1
    )
    cd ..\..
    echo [OK] Base de datos creada con datos de ejemplo
)

:: Cargar variables de entorno
if exist ".env.local" (
    echo [INFO] Cargando configuracion local...
    for /f "tokens=1,2 delims==" %%a in (.env.local) do (
        set "%%a=%%b"
    )
)

echo.
echo [INFO] Iniciando servicios...
echo        - Backend:  http://localhost:3001
echo        - Frontend: http://localhost:5173
echo.

:: Iniciar backend en segundo plano
start "Backend Server" cmd /c "cd packages\backend && pnpm dev"

:: Esperar 5 segundos para que backend arranque
echo [INFO] Esperando que backend inicie...
timeout /t 5 /nobreak >nul

:: Verificar que backend responde
:wait_backend
powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:3001/api/health' -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Backend aun no listo, esperando...
    timeout /t 2 /nobreak >nul
    goto wait_backend
)
echo [OK] Backend iniciado correctamente

:: Iniciar frontend en segundo plano
start "Frontend Server" cmd /c "cd packages\frontend && pnpm dev"

:: Esperar a que frontend responda
echo [INFO] Esperando que frontend inicie...
:wait_frontend
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_frontend
)
echo [OK] Frontend iniciado correctamente

:: Abrir navegador
echo.
echo [INFO] Abriendo navegador...
start "" "http://localhost:5173"

echo.
echo ============================================
echo   SERVICIOS EJECUTANDOSE
echo ============================================
echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo.
echo   Credenciales de prueba:
echo     Email:    admin@operaciones.local
echo     Password: admin123
echo.
echo ============================================
echo.
echo Presiona Ctrl+C y luego 'S' para detener todo
echo.

:menu
set /p "input= > "
if /i "%input%"=="s" goto stop
if /i "%input%"=="y" goto stop
goto menu

:stop
echo.
echo [INFO] Deteniendo servicios...
taskkill /F /FI "WINDOWTITLE eq Backend Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Frontend Server*" >nul 2>&1
:: Matar procesos node relacionados con los puertos
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /PID %%a /F >nul 2>&1
echo [OK] Servicios detenidos
timeout /t 2 >nul
exit /b 0
