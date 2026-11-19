param([string]$CarpetaCompose = 'C:\Users\eduam\Desktop\TITEC-V2')
. "$PSScriptRoot/comun.ps1"
$sesion = Leer-Emision
$id = [string]$sesion.ticket.idEntrada
if ($id -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'ID no permitido en la consulta de demostracion.' }
$sql = "SELECT id_entrada,id_evento,id_usuario,fecha_sincronizacion FROM ticket WHERE id_entrada='$id'; SELECT id_asistencia,id_entrada,id_evento,id_usuario,fecha_checkin FROM registro_asistencia WHERE id_entrada='$id';"
Push-Location $CarpetaCompose
try {
    $salida = $sql | docker compose exec -T checkin-db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --table -u "$MYSQL_USER" checkin_db'
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar MySQL. Comprueba Docker y la carpeta de Compose.' }
    $salida | Out-Host
    Guardar-Evidencia 'mysql' @{ticket=$id; consulta=$sql; resultado=($salida -join "`n")}
} finally { Pop-Location }
