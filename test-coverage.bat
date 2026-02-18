@echo off
REM AutopilotTS - Test with Coverage
REM Ejecuta tests y genera reporte de cobertura

echo.
echo ========================================
echo   AutopilotTS - Test Coverage
echo ========================================
echo.

REM Ejecutar tests con coverage
echo Running tests with coverage...
call npm run test -- --coverage

REM Verificar resultado
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Coverage Report Generated! ✓
    echo   Check ./coverage folder for details
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   Tests FAILED! ✗
    echo ========================================
    exit /b 1
)

echo.
pause
