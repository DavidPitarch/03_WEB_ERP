@echo off
setlocal

:: ═══════════════════════════════════════════════════════
::  ERP Siniestros - Autostart entorno de desarrollo
:: ═══════════════════════════════════════════════════════

set "ROOT=%~dp0"
set "WEB_APP=%ROOT%apps\backoffice-web"
set "SUPABASE_WORKDIR=%USERPROFILE%"
set "SUPABASE_URL=http://127.0.0.1:54321"
set "ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
set "PORT=5173"
set "TEST_USER=admin@demo.com"
set "TEST_PASS=demo123456"

echo.
echo  ====================================================
echo   ERP Siniestros - Entorno de desarrollo local
echo  ====================================================
echo.

:: ─── PASO 1: Docker ─────────────────────────────────────
echo  [1/4] Verificando Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo        Docker no esta corriendo. Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo        Esperando 60 segundos...
    timeout /t 60 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        echo.
        echo  ERROR: Docker Desktop no arranco correctamente.
        echo  Por favor inicialo manualmente y vuelve a ejecutar este script.
        echo.
        pause
        exit /b 1
    )
)
echo        Docker OK.

:: ─── PASO 2: Supabase ────────────────────────────────────
echo.
echo  [2/4] Verificando Supabase local...
npx supabase --workdir "%SUPABASE_WORKDIR%" status >nul 2>&1
if errorlevel 1 (
    echo        No estaba corriendo. Arrancando contenedores...
    npx supabase --workdir "%SUPABASE_WORKDIR%" start
    if errorlevel 1 (
        echo.
        echo  ERROR: Supabase no pudo arrancar.
        pause
        exit /b 1
    )
) else (
    echo        Supabase ya estaba corriendo.
)
echo        Supabase OK.

:: ─── PASO 3: Usuario de prueba ───────────────────────────
echo.
echo  [3/4] Verificando usuario de prueba...
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri '%SUPABASE_URL%/auth/v1/signup' -Method Post -Headers @{apikey='%ANON_KEY%'; 'Content-Type'='application/json'} -Body ('{\"email\":\"%TEST_USER%\",\"password\":\"%TEST_PASS%\"}') | Out-Null } catch {}" >nul 2>&1
echo        Usuario listo: %TEST_USER% / %TEST_PASS%

:: ─── PASO 4: Vite dev server ─────────────────────────────
echo.
echo  [4/4] Iniciando servidor web (Vite)...

:: Liberar puerto si esta ocupado
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%PORT% "') do (
    taskkill /F /PID %%a >nul 2>&1
)

start "Vite - ERP Dev" cmd /k "cd /d "%WEB_APP%" & set "VITE_SUPABASE_URL=%SUPABASE_URL%" & set "VITE_SUPABASE_ANON_KEY=%ANON_KEY%" & npx vite --host --port %PORT%"

:: Esperar hasta que Vite responda en el puerto (max 30 intentos x 1s = 30s)
echo        Esperando que Vite este listo...
set /a TRIES=0
:WAIT_VITE
set /a TRIES+=1
if %TRIES% gtr 30 (
    echo        Timeout. Abriendo navegador de todos modos...
    goto OPEN_BROWSER
)
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%PORT%' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto WAIT_VITE
)

:OPEN_BROWSER
start "" "http://localhost:%PORT%"

:: ─── Resumen ─────────────────────────────────────────────
echo.
echo  ====================================================
echo   ENTORNO LISTO
echo.
echo   Backoffice Web:  http://localhost:%PORT%
echo   Supabase Studio: http://127.0.0.1:54323
echo   Mailpit:         http://127.0.0.1:54324
echo.
echo   Usuario demo:    %TEST_USER%
echo   Password:        %TEST_PASS%
echo  ====================================================
echo.
pause
