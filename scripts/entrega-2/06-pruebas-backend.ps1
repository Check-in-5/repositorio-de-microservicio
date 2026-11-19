. "$PSScriptRoot/comun.ps1"
$raiz = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$backend = Join-Path $raiz 'backend'
if (-not (Test-Path (Join-Path $backend 'node_modules'))) { throw "Faltan dependencias. Ejecuta: npm.cmd ci --prefix `"$backend`"" }
$salida = Join-Path $carpetaDatos ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-pruebas-backend.txt')
Get-Date -Format o | Set-Content -Encoding UTF8 $salida
Write-Host 'Suite automatizada: incluye proveedores simulados. No sustituye la demo real.' -ForegroundColor Cyan
& npm.cmd test --prefix $backend 2>&1 | Tee-Object -FilePath $salida -Append
if ($LASTEXITCODE -ne 0) { throw "Pruebas fallidas. Revisar $salida" }
Write-Host "Resultado guardado en $salida" -ForegroundColor Green
