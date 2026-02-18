:: ================================================================
::  AutopilotTS - Build Script Examples
::  Copy and paste these commands to get started quickly
:: ================================================================

:: ================================================================
:: EXAMPLE 1: First Production Build
:: ================================================================
:: Use this when building for the first time or after major changes
::
:: Steps:
:: 1. Cleans everything
:: 2. Installs dependencies  
:: 3. Compiles TypeScript
:: 4. Creates Windows installer
::
:: Time: ~8 minutes

build-production.bat

:: Output:
:: - release/AutopilotTS Setup 0.1.5.exe (installer)
:: - release/win-unpacked/ (portable version)

:: ================================================================
:: EXAMPLE 2: Quick Code Update
:: ================================================================
:: Use this after changing source code (no dependency changes)
::
:: Steps:
:: 1. Compiles TypeScript
:: 2. Creates Windows installer
::
:: Time: ~3 minutes

build-quick.bat

:: Output: Same as Example 1 but faster

:: ================================================================
:: EXAMPLE 3: Development Testing
:: ================================================================
:: Use this during active development
::
:: Step 1: Compile your changes
build.bat

:: Step 2: Run the app
run.bat

:: Repeat as many times as needed

:: ================================================================
:: EXAMPLE 4: After Updating Dependencies
:: ================================================================
:: Use this after running "npm install" or updating package.json

:: Always use full build after dependency changes
build-production.bat

:: ================================================================
:: EXAMPLE 5: Testing Different Builds
:: ================================================================

:: Build development version (no installer)
build.bat
run.bat

:: Build production version (with installer)
build-production.bat

:: Test the installer
cd release
:: Double-click: AutopilotTS Setup 0.1.5.exe

:: Test portable version
cd release\win-unpacked
:: Double-click: AutopilotTS.exe

:: ================================================================
:: TROUBLESHOOTING
:: ================================================================

:: If build fails, try this nuclear option:
rmdir /s /q node_modules
rmdir /s /q dist
rmdir /s /q release
npm install
build-production.bat

:: If TypeScript errors:
npm run build
:: (Look at console for error details)

:: If Electron packaging fails:
:: 1. Check antivirus (may block Electron Builder)
:: 2. Close all AutopilotTS instances
:: 3. Try build-production.bat again

:: ================================================================
:: QUICK REFERENCE
:: ================================================================
::
:: build.bat              → Dev: Compile only (~30s)
:: run.bat                → Dev: Run compiled app (<1s)
:: build-quick.bat        → Prod: Fast rebuild (~3min)
:: build-production.bat   → Prod: Full clean build (~8min)
::
:: ================================================================

:: For more info, see:
:: - BUILD_GUIDE.md (detailed guide)
:: - BUILD_QUICK_REFERENCE.md (cheat sheet)
:: - README.md (general documentation)
