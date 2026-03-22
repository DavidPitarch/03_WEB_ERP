@echo off
setlocal

:: ═══════════════════════════════════════════════════════
::  ERP Siniestros - Autostart entorno de desarrollo
:: ═══════════════════════════════════════════════════════

set "ROOT=%~dp0"
set "WEB_APP=%ROOT%apps\backoffice-web"
set "API_APP=%ROOT%apps\edge-api"

:: Credenciales Supabase local (fijas para desarrollo local)
set "SUPA_URL=http://127.0.0.1:54321"
set "ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
set "SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0"

set "WEB_PORT=5173"
set "API_PORT=8787"
set "TEST_USER=admin@demo.com"
set "TEST_PASS=demo123456"

echo.
echo  ====================================================
echo   ERP Siniestros - Entorno de desarrollo local
echo  ====================================================
echo.

cd /d "%ROOT%"

:: ─── PASO 0: Dependencias ────────────────────────────────
echo  [1/6] Instalando dependencias ^(pnpm install^)...
pnpm install --frozen-lockfile >nul 2>&1
if errorlevel 1 (
    echo        Reintentando sin lockfile frozen...
    pnpm install >nul 2>&1
)
echo        OK - dependencias listas.
echo.

:: ─── PASO 1: Docker ──────────────────────────────────────
echo  [2/6] Verificando Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo        Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo        Esperando que arranque ^(60s^)...
    timeout /t 60 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        echo.
        echo  ERROR: Docker no arranco. Inicialo manualmente y vuelve a ejecutar.
        pause
        exit /b 1
    )
)
echo        OK - Docker corriendo.

:: ─── PASO 2: Supabase ────────────────────────────────────
echo.
echo  [3/6] Verificando Supabase local ^(puerto 54321^)...
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'http://127.0.0.1:54321/health' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }" ^
  >nul 2>&1
if errorlevel 1 (
    echo        No estaba corriendo. Arrancando contenedores Supabase...
    echo        ^(Primera vez: descarga imagenes Docker, puede tardar varios minutos^)
    pnpm exec supabase start
    if errorlevel 1 (
        echo.
        echo  ERROR: Supabase no pudo arrancar. Comprueba Docker y vuelve a intentar.
        pause
        exit /b 1
    )
    echo        Supabase arrancado.
) else (
    echo        OK - Supabase ya estaba corriendo.
)

:: ─── PASO 3: Ficheros de entorno ─────────────────────────
echo.
echo  [4/6] Creando ficheros de entorno para desarrollo...

:: .env.local para backoffice-web (Vite lo lee automaticamente)
(
    echo VITE_SUPABASE_URL=%SUPA_URL%
    echo VITE_SUPABASE_ANON_KEY=%ANON_KEY%
) > "%WEB_APP%\.env.local"
echo        OK - apps\backoffice-web\.env.local

:: .dev.vars para edge-api (Wrangler lo lee automaticamente en local)
(
    echo SUPABASE_URL=%SUPA_URL%
    echo SUPABASE_ANON_KEY=%ANON_KEY%
    echo SUPABASE_SERVICE_ROLE_KEY=%SERVICE_KEY%
) > "%API_APP%\.dev.vars"
echo        OK - apps\edge-api\.dev.vars

:: ─── PASO 4: Usuario de prueba ───────────────────────────
echo.
echo  [5/6] Creando usuario de prueba...
powershell -NoProfile -Command ^
  "try { Invoke-RestMethod -Uri '%SUPA_URL%/auth/v1/signup' -Method Post -Headers @{apikey='%ANON_KEY%'; 'Content-Type'='application/json'} -Body '{\"email\":\"%TEST_USER%\",\"password\":\"%TEST_PASS%\"}' | Out-Null } catch {}" ^
  >nul 2>&1
echo        OK - %TEST_USER% / %TEST_PASS%

:: ─── PASO 5: Servidores ──────────────────────────────────
echo.
echo  [6/6] Iniciando servidores de desarrollo...

:: Liberar puertos si estan ocupados
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%API_PORT% "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%WEB_PORT% "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul

:: Edge API: wrangler dev escucha en puerto 8787
echo        Abriendo Edge API ^(puerto %API_PORT%^)...
start "Edge API :8787" cmd /k "cd /d "%API_APP%" && pnpm dev"

:: Dar 2 segundos al API para arrancar antes del frontend
timeout /t 2 /nobreak >nul

:: Backoffice Web: vite escucha en puerto 5173 (configurado en vite.config.ts)
echo        Abriendo Backoffice Web ^(puerto %WEB_PORT%^)...
start "Vite Web :5173" cmd /k "cd /d "%WEB_APP%" && pnpm exec vite --host"

:: ─── Esperar a Vite ──────────────────────────────────────
echo.
echo        Esperando que Vite este listo...
set /a TRIES=0
:WAIT_VITE
set /a TRIES+=1
if %TRIES% gtr 60 (
    echo        ^[Timeout tras 60s^] Abriendo navegador de todos modos...
    goto OPEN_BROWSER
)
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'http://localhost:%WEB_PORT%' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" ^
  >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto WAIT_VITE
)

:OPEN_BROWSER
start "" "http://localhost:%WEB_PORT%"

:: ─── Listo ───────────────────────────────────────────────
echo.
echo  ====================================================
echo   ENTORNO LISTO
echo.
echo   Backoffice Web:  http://localhost:%WEB_PORT%
echo   Edge API:        http://localhost:%API_PORT%
echo   Supabase Studio: http://127.0.0.1:54323
echo   Mailpit:         http://127.0.0.1:54324
echo.
echo   Login:  %TEST_USER%
echo   Pass:   %TEST_PASS%
echo  ====================================================
echo.
echo  Cierra esta ventana cuando quieras detener el entorno.
pause
