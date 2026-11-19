. "$PSScriptRoot/comun.ps1"
$sesion = Leer-Emision
$respuesta = Consultar-Asistencia $sesion
Write-Host 'PASO 4: POST /checkin/asistencia despues del ingreso' -ForegroundColor Cyan
$respuesta | ConvertTo-Json
Guardar-Evidencia 'asistencia-despues' @{ ticket = $sesion.ticket.idEntrada; eventoId = $sesion.ticket.idEvento; usuarioId = $sesion.usuarioId; respuesta = $respuesta }
if ($respuesta.asistio -isnot [string] -or $respuesta.asistio -cne 'true') { throw 'Todavia no hay asistencia confirmada. Revisa la respuesta del escaneo; no declares la prueba aprobada.' }
Write-Host 'OK: asistencia disponible para consulta de Resenas.' -ForegroundColor Green
Write-Host 'Este script prueba el proveedor Check-in; no ejecuta el backend de Resenas.'
Write-Host 'Escanea otra vez el MISMO QR: debe rechazarlo con TICKET_ALREADY_USED.'
