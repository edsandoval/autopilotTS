@echo off
echo ========================================
echo   Starting AutopilotTS Desktop App
echo ========================================
echo.

REM Check if dist/ exists
if not exist "dist\electron-main.js" (
    echo ERROR: Application not built!
    echo Please run build.bat first.
    echo.
    pause
    exit /b 1
)

echo Launching Electron application...
echo Press Ctrl+C to stop the application
echo.

call npm run start

pause
