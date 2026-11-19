$ErrorActionPreference = 'Stop'
$carpetaDatos = Join-Path $PSScriptRoot 'resultados'
New-Item -ItemType Directory -Force $carpetaDatos | Out-Null
$archivoSesion = Join-Path $carpetaDatos 'ultima-emision.json'

function Guardar-Evidencia($Nombre, $Datos) {
    $registro = [ordered]@{ fecha = (Get-Date -Format o); datos = $Datos }
    $destino = Join-Path $carpetaDatos ((Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + $Nombre + '.json')
    $registro | ConvertTo-Json -Depth 15 | Set-Content -Encoding UTF8 $destino
    Write-Host "Evidencia: $destino" -ForegroundColor DarkGray
}

function Leer-Emision {
    if (-not (Test-Path $archivoSesion)) { throw 'Ejecuta primero 01-generar-entrada.ps1.' }
    return Get-Content -Raw $archivoSesion | ConvertFrom-Json
}

function Consultar-Asistencia($Sesion) {
    $body = @{ usuarioId = $Sesion.usuarioId; eventoId = $Sesion.ticket.idEvento } | ConvertTo-Json
    return Invoke-RestMethod -Method Post -Uri ($Sesion.checkinUrl + '/checkin/asistencia') -ContentType 'application/json' -Body $body -TimeoutSec 15
}
