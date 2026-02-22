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
    description = 'Agregar un boton flotante verde con un icono de refresh en la esquina inferior derecha de la pantalla, al presionar el boton, debemos llamar a la logica de obtener los nuevos sismos'
    status = 'pending'
    type = 'bug'
    createdAt = $now
}

# Mock Ticket 2 - Shorten button text
$ticket2 = @{
    id = 'MOCK-002'
    name = 'MOCK-002'
    description = 'Cambiar el color de fondo de la tarjeta segun la maganitud del sismo, si es menor a 4.0, color verde claro, si es entre 4.0 y 6.0, color amarillo claro, si es mayor a 6.0, color rojo claro'
    status = 'pending'
    type = 'bug'
    createdAt = $now
}

# Mock Ticket 3 - Change another button text
$ticket3 = @{
    id = 'MOCK-003'
    name = 'MOCK-003'
    description = 'Mostrar en cada card la distancias del sismo a cordoba capital, Argentina'
    status = 'pending'
    type = 'bug'
    createdAt = $now
}

# Add a new feature ticket for testing
 $ticket4 = @{
    id = 'MOCK-004'
    name = 'MOCK-004'
    description = 'Agregar una nueva pantalla de detalles que muestre información adicional del sismo, como la profundidad, la ubicación exacta y un mapa con el epicentro. Esta nueva pantalla debe ser accesible al hacer clic en una tarjeta de sismo en la pantalla principal, y debe mostrar la información de manera clara y organizada para mejorar la experiencia del usuario'
    status = 'pending'
    type = 'feature'
    createdAt = $now
}

# Add a enhancement ticket for testing
$ticket5 = @{
    id = 'MOCK-005'
    name = 'MOCK-005'
    description = 'Mejorar el rendimiento de la aplicación optimizando la carga de datos y utilizando técnicas de caching para reducir el consumo de recursos y mejorar la experiencia del usuario'
    status = 'pending'
    type = 'enhancement'
    createdAt = $now
}

# Add a code review ticket for testing
$ticket6 = @{
    id = 'MOCK-006'
    name = 'MOCK-006'
    description = 'Realizar una revisión de código para identificar posibles mejoras en la estructura y legibilidad del código, así como para asegurar que se sigan las mejores prácticas de desarrollo'
    status = 'pending'
    type = 'code review'
    createdAt = $now
}

# Add tickets
$json.tickets += $ticket1
$json.tickets += $ticket2
$json.tickets += $ticket3
$json.tickets += $ticket4
$json.tickets += $ticket5
$json.tickets += $ticket6

# Save with proper formatting
$jsonString = $json | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($TICKETS_FILE, $jsonString, [System.Text.UTF8Encoding]::new($false))

Write-Host 'Tickets created successfully!' -ForegroundColor Green
Write-Host ''
Write-Host 'Created tickets:' -ForegroundColor Cyan
Write-Host ''
Write-Host '   1. MOCK-001' -ForegroundColor White
Write-Host ''
Write-Host '   2. MOCK-002' -ForegroundColor White
Write-Host ''
Write-Host '   3. MOCK-003' -ForegroundColor White
Write-Host ''
Write-Host '   4. MOCK-004' -ForegroundColor White
Write-Host ''
Write-Host '   5. MOCK-005' -ForegroundColor White
Write-Host ''
Write-Host '   6. MOCK-006' -ForegroundColor White
Write-Host ''
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SUCCESS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ''
Write-Host '      .\mock-clean.ps1'
Write-Host ''
Write-Host 'These tickets are simple and won''t consume many tokens'
Write-Host '   Estimated: ~1,500 tokens total'
Write-Host ''
