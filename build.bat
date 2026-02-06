@echo off
echo ========================================
echo   Building AutopilotTS
echo ========================================
echo.

echo [1/2] Compiling TypeScript...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Build completed successfully!
echo ========================================
echo   Output: dist/
echo ========================================
pause
