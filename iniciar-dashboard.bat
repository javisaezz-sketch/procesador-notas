@echo off
cd /d "%~dp0"

echo ========================================
echo   Dashboard Editorial - Procesador Notas
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en el PATH.
  pause
  exit /b 1
)

echo Comprobando dependencias...
call npm.cmd install
if errorlevel 1 (
  echo ERROR al instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Arrancando servidor en http://127.0.0.1:3001
echo.
echo IMPORTANTE: NO cierres esta ventana mientras uses el dashboard.
echo Abre el navegador en: http://127.0.0.1:3001
echo.

call npm.cmd run dev

pause
