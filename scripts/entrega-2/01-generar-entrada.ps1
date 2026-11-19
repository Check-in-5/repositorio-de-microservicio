param(
    [string]$EventoId = '66fff0000000000000000001',
    [string]$EntradasUrl = 'http://localhost:3003',
    [string]$CheckinUrl = 'http://localhost:3005'
)
. "$PSScriptRoot/comun.ps1"
Write-Host 'PASO 1: emitir una entrada desde el backend real de Entradas' -ForegroundColor Cyan
$disponibilidad = Invoke-RestMethod -Uri ($EntradasUrl.TrimEnd('/') + '/api/entradas/eventos/' + [uri]::EscapeDataString($EventoId) + '/disponibilidad') -TimeoutSec 15
if ($disponibilidad.stockDisponible -lt 1) { throw 'El evento no tiene stock. Selecciona otro evento publicado con inventario.' }
$usuario = [guid]::NewGuid().ToString()
$datos = @{ id_evento = $EventoId; id_usuario = $usuario; nombre_comprador = 'Asistente demo Entrega 2'; correo_comprador = 'demo-checkin@example.test'; cantidad_entradas = 1; precio_final = 0 }
$ticket = Invoke-RestMethod -Method Post -Uri ($EntradasUrl.TrimEnd('/') + '/api/entradas/emision-directa') -ContentType 'application/json' -Body ($datos | ConvertTo-Json) -TimeoutSec 30
$sesion = [ordered]@{ fecha = (Get-Date -Format o); usuarioId = $usuario; checkinUrl = $CheckinUrl.TrimEnd('/'); ticket = $ticket }
$sesion | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 $archivoSesion
Guardar-Evidencia 'emision-entradas' $sesion
$ticket | Select-Object idEntrada, idEvento, nombreComprador, registradoEnCheckin | Format-List
if ($ticket.registradoEnCheckin -ne $true) { throw 'La entrada se emitio, pero Entradas NO confirmo el registro en Check-in. No continuar ni reemitir automaticamente.' }
Write-Host 'OK: Entradas confirma el registro. Ahora ejecuta el paso 02 SIN escanear todavia.' -ForegroundColor Green
