# Guion PowerShell para la presentacion

Abre PowerShell y entra a `C:\Users\eduam\Desktop\TITEC-V2\scripts\entrega-2`.
Si Windows bloquea scripts, ejecuta `Set-ExecutionPolicy -Scope Process Bypass` en esa ventana. No cambia la politica permanente.

Los scripts guardan el ticket en `resultados/ultima-emision.json`: puedes continuar incluso desde otra ventana. Una nueva ejecucion de 01 emite otro ticket, consume un cupo y cambia la sesion activa; las evidencias anteriores se conservan.

## Orden durante la demo

1. Inicia sesion STAFF en el frontend unificado: http://localhost:3000/auth/admin/login. En la variante de frontend del repo Check-in, la ruta es `/admin/login`.
2. `./01-generar-entrada.ps1`: emite desde Entradas. Mostrar `registradoEnCheckin: True`.
3. `./07-datos-mysql.ps1`: mostrar ticket en MySQL ANTES del escaneo; aun no debe haber asistencia.
4. `./02-asistencia-antes.ps1`: mostrar `{"asistio":"false"}`.
5. `./03-abrir-qr.ps1`: abrir QR; mostrar en otra pantalla y escanear en http://localhost:3000/checkin. Esperar acceso autorizado.
6. `./04-asistencia-despues.ps1`: mostrar `{"asistio":"true"}`.
7. `./07-datos-mysql.ps1`: mostrar la asistencia persistida con fecha.
8. Reescanear el mismo QR: rechazo por `TICKET_ALREADY_USED`.
9. `./05-casos-error.ps1`: mostrar 401 sin sesion y 400 por consulta incompleta.
10. `./06-pruebas-backend.ps1`: ejecutar suite y guardar resultado.

## Que decir

- Auth: Check-in delega la validacion de sesion y exige rol STAFF. El script sin cookie muestra el caso negativo; el login y escaneo muestran el positivo.
- Entradas: este script llama a Entradas. Entradas crea y envia el ticket a Check-in; la consulta MySQL prueba que llego antes de escanear.
- Resenas: Check-in ofrece el contrato POST de asistencia. PowerShell simula al consumidor y muestra que la respuesta cambia al registrar ingreso. No afirmar que estos scripts prueban el consumo desde la aplicacion de Resenas.
- Panel: si se desea mostrar, en Network > validaciones > Response, el objeto `evento` procede de Panel.

## Requisitos

Servicios reales activos, STAFF habilitado y evento `66fff0000000000000000001` publicado en Panel, con inventario y cupos en Entradas. Para otro evento: `./01-generar-entrada.ps1 -EventoId 'ID_REAL'`. Los usuarios compradores de estos scripts son identificadores sinteticos; no se crean cuentas Auth. Se emite una entrada gratuita por ejecucion.

La base no se borra ni se reinicia. No ejecutar 01 repetidamente si la emision fallo: revisar primero la respuesta, porque puede haberse creado la entrada sin confirmacion de Check-in. El script conserva esa respuesta.

Las evidencias locales quedan en `resultados/`, ignorado por Git. Revisar y seleccionar los archivos para adjuntarlos al repositorio de la entrega; no estan publicados automaticamente. El paso SQL necesita acceso al motor Docker. La suite utiliza simulaciones HTTP y omite MySQL real salvo configuracion explicita de pruebas.
