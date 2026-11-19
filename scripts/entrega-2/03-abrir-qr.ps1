. "$PSScriptRoot/comun.ps1"
$sesion = Leer-Emision
$qr = @{ id_entrada = $sesion.ticket.idEntrada; id_evento = $sesion.ticket.idEvento }
Write-Host 'PASO 3: escanear desde el frontend con sesion STAFF' -ForegroundColor Cyan
$qr | ConvertTo-Json
$url = [uri]$sesion.ticket.qrData
if ($url.Scheme -notin @('http', 'https')) { throw 'La respuesta no contiene una URL HTTP de imagen QR.' }
Start-Process $url.AbsoluteUri
Write-Host 'Muestra este QR en otra pantalla. Entra a http://localhost:3000/checkin con sesion STAFF.'
Write-Host 'Espera ACCESO AUTORIZADO. Luego ejecuta 04-asistencia-despues.ps1.'
Write-Host 'En Network > validaciones > Response puedes mostrar valido:true y el objeto evento de Panel.'
