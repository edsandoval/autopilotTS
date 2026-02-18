@echo off
echo ========================================
echo   AutopilotTS - Quick Build (No Clean)
echo   Platform: Windows (x64)
echo ========================================
echo.

REM Step 1: Compile TypeScript
echo [1/2] Compiling TypeScript and copying assets...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: TypeScript compilation failed!
    pause
    exit /b 1
)
echo   Done!
echo.

REM Step 2: Package with Electron Builder
echo [2/2] Building Windows executable...
echo   This may take several minutes...
echo.
call npm run dist -- --win --x64
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Electron packaging failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Quick Build COMPLETED!
echo ========================================
echo.
echo   Output folder: release\
echo.
echo   Installer: release\AutopilotTS Setup [version].exe
echo   Portable:  release\win-unpacked\
echo.
echo ========================================

REM Open release folder
if exist "release" (
    echo Opening release folder...
    start "" explorer "release"
)

pause
