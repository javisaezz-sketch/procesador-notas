@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   Pipeline + Dashboard - Travelicius
echo ========================================
echo.

call npm.cmd install >nul 2>&1

echo [1/2] Ejecutando pipeline (email + IA)...
call node pipeline.js
if errorlevel 1 pause & exit /b 1

echo.
echo [2/2] Arrancando dashboard...
echo Abre http://127.0.0.1:3001
echo NO cierres esta ventana.
echo.

call npm.cmd run dev
