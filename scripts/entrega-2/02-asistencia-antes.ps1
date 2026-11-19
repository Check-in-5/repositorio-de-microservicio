. "$PSScriptRoot/comun.ps1"
$sesion = Leer-Emision
$respuesta = Consultar-Asistencia $sesion
Write-Host 'PASO 2: POST /checkin/asistencia antes del ingreso' -ForegroundColor Cyan
$respuesta | ConvertTo-Json
Guardar-Evidencia 'asistencia-antes' @{ ticket = $sesion.ticket.idEntrada; eventoId = $sesion.ticket.idEvento; usuarioId = $sesion.usuarioId; respuesta = $respuesta }
if ($respuesta.asistio -isnot [string] -or $respuesta.asistio -cne 'false') { throw 'Se esperaba el string false. Este usuario ya asistio o el contrato cambio. Genera una entrada nueva para repetir la demo.' }
Write-Host 'OK: aun no registra asistencia.' -ForegroundColor Green
