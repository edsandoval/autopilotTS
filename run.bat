@echo off
echo ========================================
echo   Starting AutopilotTS Web UI
echo ========================================
echo.

REM Check if dist/ exists
if not exist "dist\index.js" (
    echo ERROR: Application not built!
    echo Please run build.bat first.
    echo.
    pause
    exit /b 1
)

echo Opening Web UI on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

node dist\index.js ui

pause
