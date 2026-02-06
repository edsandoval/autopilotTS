#!/usr/bin/env pwsh
# Mock Tickets Creator for autopilotTS
# Creates 3 simple test tickets in ~/.autopilot/tickets.json

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mock Tickets Creator" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Creating 3 simple mock tickets for testing..."
Write-Host "Target: Android/Jetpack Compose app"
Write-Host ""

# Get autopilot directory (~/.autopilot)
$AUTOPILOT_DIR = Join-Path $env:USERPROFILE ".autopilot"
$TICKETS_FILE = Join-Path $AUTOPILOT_DIR "tickets.json"

if (-not (Test-Path $AUTOPILOT_DIR)) {
    Write-Host "Creating autopilot directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $AUTOPILOT_DIR | Out-Null
}

if (-not (Test-Path $TICKETS_FILE)) {
    Write-Host "Creating new tickets file..." -ForegroundColor Yellow
    $emptyJson = @{
        lastId = 0
        tickets = @()
    }
    $emptyJson | ConvertTo-Json -Depth 10 | Set-Content $TICKETS_FILE -Encoding UTF8
}

Write-Host "Adding tickets to: $TICKETS_FILE" -ForegroundColor Cyan
Write-Host ""

# Read existing file
if (Test-Path $TICKETS_FILE) {
    $json = Get-Content $TICKETS_FILE -Raw | ConvertFrom-Json
} else {
    $json = @{
        lastId = 0
        tickets = @()
    }
}

$now = (Get-Date).ToString('o')

# Check if mock tickets already exist
$existingMocks = $json.tickets | Where-Object { $_.id -like 'MOCK-*' }
if ($existingMocks.Count -gt 0) {
    Write-Host 'WARNING: Mock tickets already exist!' -ForegroundColor Yellow
    Write-Host ''
    $existingMocks | ForEach-Object {
        Write-Host "   - $($_.id): $($_.status)" -ForegroundColor Gray
    }
    Write-Host ''
    $response = Read-Host 'Do you want to add more mock tickets? (y/N)'
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host ''
        Write-Host 'Operation cancelled.' -ForegroundColor Yellow
        exit 1
    }
    Write-Host ''
}

# Mock Ticket 1 - Change button color to red
$ticket1 = @{
    id = 'MOCK-001'
    name = 'MOCK-001'
    description = 'Cambiar el color de fondo (backgroundColor) de los dos botones que dicen "Sincronizar" a Color.Red en el archivo donde se encuentren'
    status = 'pending'
    createdAt = $now
}

# Mock Ticket 2 - Shorten button text
$ticket2 = @{
    id = 'MOCK-002'
    name = 'MOCK-002'
    description = 'Cambiar el texto del botón "Descargar visitas" a solo "Descargar" en el componente donde se defina'
    status = 'pending'
    createdAt = $now
}

# Mock Ticket 3 - Change another button text
$ticket3 = @{
    id = 'MOCK-003'
    name = 'MOCK-003'
    description = 'Cambiar el texto del botón "Ver tutorial" a "Ver guía" en el archivo donde esté definido'
    status = 'pending'
    createdAt = $now
}

# Add tickets
$json.tickets += $ticket1
$json.tickets += $ticket2
$json.tickets += $ticket3

# Save with proper formatting
$jsonString = $json | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($TICKETS_FILE, $jsonString, [System.Text.UTF8Encoding]::new($false))

Write-Host 'Tickets created successfully!' -ForegroundColor Green
Write-Host ''
Write-Host 'Created tickets:' -ForegroundColor Cyan
Write-Host ''
Write-Host '   1. MOCK-001' -ForegroundColor White
Write-Host '      └─ Cambiar color de botones "Sincronizar" a rojo' -ForegroundColor Gray
Write-Host ''
Write-Host '   2. MOCK-002' -ForegroundColor White
Write-Host '      └─ Cambiar "Descargar visitas" a "Descargar"' -ForegroundColor Gray
Write-Host ''
Write-Host '   3. MOCK-003' -ForegroundColor White
Write-Host '      └─ Cambiar "Ver tutorial" a "Ver guía"' -ForegroundColor Gray
Write-Host ''
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SUCCESS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host ''
Write-Host '   1. View tickets:'
Write-Host '      autopilot list'
Write-Host ''
Write-Host '   2. Test autopilot mode:'
Write-Host '      autopilot ui'
Write-Host "      Then click ""Autopilot Mode"""
Write-Host ''
Write-Host '   3. Delete after testing:'
Write-Host '      .\mock-clean.ps1'
Write-Host ''
Write-Host 'These tickets are simple and won''t consume many tokens'
Write-Host '   Estimated: ~1,500 tokens total'
Write-Host ''
