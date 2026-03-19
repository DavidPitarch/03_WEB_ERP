@echo off
setlocal

:: ═══════════════════════════════════════════════════════
::  ERP Siniestros - Autostart PWA Operarios (local)
::  Modo DEMO: no requiere Docker ni Supabase
:: ═══════════════════════════════════════════════════════

set "ROOT=%~dp0"
set "OP_APP=%ROOT%apps\operator-pwa"
set "PORT=5174"
set "TEST_USER=cualquier@email.com"
set "TEST_PASS=cualquier-password"

echo.
echo  ====================================================
echo   ERP Siniestros - PWA Operarios  [MODO DEMO]
echo  ====================================================
echo.
echo   Sin Docker. Sin Supabase. Datos de prueba incluidos.
echo.

:: ─── PASO 1: Liberar puerto ──────────────────────────────
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%PORT% "') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: ─── PASO 2: Vite dev server en modo demo ─────────────────
echo  [1/2] Iniciando servidor PWA Operarios...
start "Vite - PWA Operarios" cmd /k "cd /d "%OP_APP%" & set "VITE_DEMO_MODE=true" & set "VITE_SUPABASE_URL=http://localhost:54321" & set "VITE_SUPABASE_ANON_KEY=demo-anon-key" & pnpm dev"

:: ─── PASO 3: Esperar a que Vite responda ──────────────────
echo  [2/2] Esperando que Vite este listo...
set /a TRIES=0
:WAIT_VITE
set /a TRIES+=1
if %TRIES% gtr 30 (
    echo        Timeout. Abriendo navegador de todos modos...
    goto OPEN_BROWSER
)
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:%PORT%' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto WAIT_VITE
)

:OPEN_BROWSER
:: Abrir en modo movil simulado en Chrome (viewport iPhone 14 - 390x844)
start "" "chrome" "--new-window" "--window-size=430,932" "http://localhost:%PORT%"
:: Fallback: si Chrome no abre, abrir en navegador por defecto
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%"

:: ─── Resumen ─────────────────────────────────────────────
echo.
echo  ====================================================
echo   LISTO - PWA OPERARIOS [MODO DEMO]
echo.
echo   URL local:   http://localhost:%PORT%
echo.
echo   Login con cualquier email y password.
echo   Datos demo precargados:
echo     - 2 citas hoy  (Agua urgente + Cristales media)
echo     - 1 cita manana (Robo urgente)
echo.
echo   TEST EN MOVIL REAL:
echo   Conecta al mismo WiFi y accede desde el movil a:
echo   http://[TU-IP-LOCAL]:%PORT%
echo   (La IP aparece en la ventana de Vite)
echo  ====================================================
echo.
pause
