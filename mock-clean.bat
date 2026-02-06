@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   🧹 Mock Tickets Cleaner
echo ========================================
echo.

REM Get autopilot directory (~/.autopilot)
set AUTOPILOT_DIR=%USERPROFILE%\.autopilot
set TICKETS_FILE=%AUTOPILOT_DIR%\tickets.json

if not exist "%TICKETS_FILE%" (
    echo ⚠️  No tickets file found
    echo.
    pause
    exit /b 0
)

echo 📁 Storage: %AUTOPILOT_DIR%
echo.

REM Use PowerShell to clean mock tickets
powershell -Command "& {
    $ticketsFile = '%TICKETS_FILE%'
    $json = Get-Content $ticketsFile -Raw | ConvertFrom-Json
    
    # Find mock tickets
    $mockTickets = $json.tickets | Where-Object { $_.id -like 'MOCK-*' }
    
    if ($mockTickets.Count -eq 0) {
        Write-Host '✓ No mock tickets found. Nothing to clean.' -ForegroundColor Green
        Write-Host ''
        exit 0
    }
    
    Write-Host \"Found $($mockTickets.Count) mock ticket(s):\" -ForegroundColor Cyan
    Write-Host ''
    $mockTickets | ForEach-Object {
        Write-Host \"   - $($_.id): $($_.status)\" -ForegroundColor Gray
    }
    Write-Host ''
    
    $response = Read-Host 'Delete all mock tickets? (y/N)'
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host ''
        
        # Remove mock tickets
        $json.tickets = $json.tickets | Where-Object { $_.id -notlike 'MOCK-*' }
        
        # Save
        $jsonString = $json | ConvertTo-Json -Depth 10 -Compress:$false
        [System.IO.File]::WriteAllText($ticketsFile, $jsonString, [System.Text.UTF8Encoding]::new($false))
        
        Write-Host '✅ All mock tickets deleted successfully!' -ForegroundColor Green
        Write-Host ''
        Write-Host \"Remaining tickets: $($json.tickets.Count)\" -ForegroundColor Cyan
        Write-Host ''
    } else {
        Write-Host ''
        Write-Host 'Operation cancelled.' -ForegroundColor Yellow
        Write-Host ''
    }
}"

pause
