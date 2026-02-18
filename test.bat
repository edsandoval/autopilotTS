@echo off
REM AutopilotTS - Test Runner
REM Ejecuta los tests unitarios del proyecto

echo.
echo ========================================
echo   AutopilotTS - Test Suite
echo ========================================
echo.

REM Ejecutar tests
echo Running tests...
call npm test

REM Verificar resultado
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Tests PASSED! ✓
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
