@echo off
echo ========================================
echo   Building AutopilotTS Desktop App
echo ========================================
echo.

echo [1/1] Compiling TypeScript and copying assets...
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
