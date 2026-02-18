@echo off
echo ========================================
echo   AutopilotTS - Production Build
echo   Platform: Windows (x64)
echo ========================================
echo.

REM Step 1: Clean previous builds
echo [1/4] Cleaning previous builds...
if exist "dist" (
    echo   Removing dist/ folder...
    rmdir /s /q dist
)
if exist "release" (
    echo   Removing release/ folder...
    rmdir /s /q release
)
echo   Done!
echo.

REM Step 2: Install/Update dependencies
echo [2/4] Checking dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)
echo   Done!
echo.

REM Step 3: Compile TypeScript
echo [3/4] Compiling TypeScript and copying assets...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: TypeScript compilation failed!
    pause
    exit /b 1
)
echo   Done!
echo.

REM Step 4: Package with Electron Builder
echo [4/4] Building Windows executable...
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
echo   Production Build COMPLETED!
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
