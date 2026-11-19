param([string]$CheckinUrl = 'http://localhost:3005')
. "$PSScriptRoot/comun.ps1"
Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.UseCookies = $false
$cliente = New-Object System.Net.Http.HttpClient($handler)
$cliente.Timeout = [TimeSpan]::FromSeconds(15)
try {
    $casos = @(
        @{nombre='Auth sin sesion'; ruta='/api/checkin/validaciones'; estado=401; codigo='SESSION_REQUIRED'},
        @{nombre='Asistencia sin parametros'; ruta='/checkin/asistencia'; estado=400; codigo='INVALID_REQUEST'}
    )
    foreach ($caso in $casos) {
        $contenido = New-Object System.Net.Http.StringContent('{}', [Text.Encoding]::UTF8, 'application/json')
        $respuesta = $cliente.PostAsync($CheckinUrl.TrimEnd('/') + $caso.ruta, $contenido).GetAwaiter().GetResult()
        try {
            $texto = $respuesta.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $body = $texto | ConvertFrom-Json
            Write-Host ("{0}: HTTP {1}" -f $caso.nombre, [int]$respuesta.StatusCode) -ForegroundColor Cyan
            Write-Host $texto
            Guardar-Evidencia 'caso-error' @{caso=$caso.nombre; estado=[int]$respuesta.StatusCode; respuesta=$body}
            if ([int]$respuesta.StatusCode -ne $caso.estado -or $body.error.code -ne $caso.codigo) { throw ('Resultado inesperado: ' + $caso.nombre) }
        } finally { $respuesta.Dispose(); $contenido.Dispose() }
    }
    Write-Host 'OK: ambos rechazos coinciden con lo esperado. No se registraron ingresos.' -ForegroundColor Green
} finally { $cliente.Dispose(); $handler.Dispose() }
