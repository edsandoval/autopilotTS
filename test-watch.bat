@echo off
REM AutopilotTS - Test Watch Mode
REM Ejecuta tests en modo watch (se re-ejecutan al cambiar archivos)

echo.
echo ========================================
echo   AutopilotTS - Test Watch Mode
echo ========================================
echo.
echo Tests will re-run automatically when files change
echo Press Ctrl+C to stop
echo.

call npm run test:watch
