# Check-in — Entrega 2: Interoperabilidad

**Proyecto:** TicketU · Taller de Integración Tecnológica 2026-2  
**Equipo:** Check-in  
**Fecha de documentación:** 18 de noviembre de 2026  
**Repositorio:** [Check-in-5/repositorio-de-microservicio](https://github.com/Check-in-5/repositorio-de-microservicio/tree/integracion) · rama `integracion`

Este documento describe las integraciones de Check-in con Auth, Entradas e Inventario y Reseñas, sus contratos, persistencia y procedimientos de demostración. Distingue las verificaciones realizadas en el entorno local de las evidencias que deben adjuntarse al repositorio para la evaluación.

La referencia es **TITEC — Especificación Evaluación 2: Interoperabilidad**, entregada por el curso. Esa pauta exige dos integraciones de tipos distintos, contraparte real, contratos, evidencia de datos, pruebas e ítems de gestión. La fecha de este documento no reemplaza las fechas de cierre de la pauta ni acredita una entrega dentro de plazo.

## 1. Integraciones declaradas

Las dos integraciones principales para evaluar son **I1 Auth** e **I2 Entradas**. Reseñas se documenta como servicio adicional ofrecido cuyo consumo por la aplicación contraparte está pendiente de demostrar.

| Identificador | Tipo según la pauta | Contraparte y operación | Estado documentado |
|---|---|---|---|
| I1 | C — Autenticación | Check-in consume `GET /internal/validar-sesion` de Auth antes de validar una entrada. | Implementada; utilizada en el flujo local con sesión STAFF. |
| I2 | B — Servicio ofrecido | Entradas consume `POST /api/checkin/tickets` y Check-in persiste la entrada. | Implementada; se emitió una entrada desde la API real de Entradas con `registradoEnCheckin: true`. |
| Adicional | B — Servicio ofrecido | Reseñas puede consumir `POST /checkin/asistencia` por usuario y evento. | Endpoint implementado y procedimiento de prueba disponible. El backend de Reseñas revisado aún consulta su propia tabla de asistencia. |

Recibir una petición de Entradas corresponde al tipo **B**, porque Check-in ofrece el servicio. La consulta de respaldo que Check-in hace a Entradas cuando falta un ticket es un consumo tipo A, pero no se declara como una tercera integración evaluada en este documento.

PowerShell permite verificar el contrato de asistencia; no sustituye la evidencia de consumo real por Reseñas que exige la pauta para considerar lograda una integración tipo B.

## 2. Responsabilidades y alcance

Check-in registra tickets emitidos por Entradas, autoriza operaciones de puerta mediante Auth, registra una asistencia por ticket y permite consultar asistencia por usuario y evento. No emite entradas comerciales, no administra contraseñas y no decide si existe una reseña previa.

El flujo también consulta a Panel Organizador para permitir el ingreso únicamente a eventos publicados. Esta dependencia debe estar disponible durante la demostración, aunque no forma parte de las dos integraciones principales declaradas aquí.

| Rol | Ítem de evaluación | Responsable |
|---|---|---|
| Back End | BE1 | Pendiente de completar por el equipo |
| Base de Datos | BD1 | Pendiente de completar por el equipo |
| UI/UX | UI1 | Pendiente de completar por el equipo |
| Gestión | GE1 | Pendiente de completar por el equipo |
| Calidad | CA1 | Pendiente de completar por el equipo |

No se inventan nombres ni enlaces de gestión. Antes de entregar, cada rol debe tener responsable y cada integrante debe tener al menos un rol.

## 3. Entorno de ejecución

El entorno integrado local está en `C:\Users\eduam\Desktop\TITEC-V2`. Su Compose reúne los servicios externos; el repositorio de Check-in contiene las carpetas `backend/` y `frontend/`, no todo ese entorno.

| Componente | URL desde Windows | Dirección interna en TITEC-V2 |
|---|---|---|
| Frontend unificado | `http://localhost:3000` | `frontend:3000` |
| API Gateway | `http://localhost:8090` | `gateway:8080` |
| Auth | `http://localhost:3001` | `auth-service:10000` |
| Entradas | `http://localhost:3003` | `entradas-service:3000` |
| Check-in | `http://localhost:3005` | `checkin-service:3005` |
| Reseñas | `http://localhost:3006` | `resenas-service:3000` |
| Panel | `http://localhost:3007` | `organizador-service:3000` |

Check-in escucha en **3005 dentro y fuera del contenedor**. El navegador usa `localhost`; las llamadas entre contenedores usan los nombres internos. Usar el mismo host durante login y escaneo para conservar la cookie.

Configuración relevante del backend:

```dotenv
PORT=3005
AUTH_SERVICE_URL=http://auth-service:10000
AUTH_INTERNAL_API_KEY=<misma INTERNAL_API_KEY configurada en Auth>
CHECKIN_ALLOWED_ROLES=STAFF
ENTRADAS_SERVICE_URL=http://entradas-service:3000
PANEL_SERVICE_URL=http://organizador-service:3000
PANEL_FAILURE_POLICY=deny
```

Configurar también `DB_*` para MySQL. Las claves y archivos `.env` no se publican. La clave interna pertenece a la consulta de Check-in hacia Auth; los endpoints de tickets y asistencia de Check-in no exigen `x-api-key`.

Hay dos variantes de frontend: TITEC-V2 utiliza el frontend unificado de `FWizav/FrontendTitec` con Gateway; la carpeta `frontend/` de este repositorio conserva el frontend integrado de Check-in con proxy del mismo origen. No son copias idénticas. En el unificado, el login STAFF es `/auth/admin/login`; en la copia de este repositorio es `/admin/login`. Ambos requieren reenviar la sesión al validar.

## 4. I1 — Integración con Auth

### Flujo y contrato

1. El operador inicia sesión mediante la interfaz de Auth.
2. Al escanear, el frontend envía `POST /api/checkin/validaciones` con la cookie de sesión.
3. El middleware de Check-in reenvía la cookie original y la clave interna a Auth.
4. Solo una sesión válida con rol permitido puede ejecutar la validación de negocio.

```http
GET /internal/validar-sesion
Cookie: <cookie original de la sesión>
x-api-key: <AUTH_INTERNAL_API_KEY>
```

Respuesta de Auth utilizada por Check-in, con identificadores ilustrativos:

```json
{"valido":true,"usuario":{"id_usuario":"operador-uuid","rol":"STAFF"}}
```

Check-in no acepta el rol enviado en el cuerpo de una validación ni requiere que el operador copie un token manualmente. Normaliza los roles para compararlos. El tiempo máximo configurado para la consulta a Auth es 5 segundos.

| Situación | Respuesta de Check-in |
|---|---|
| Sin cookie | `401 SESSION_REQUIRED` |
| Auth rechaza la sesión | `401 INVALID_SESSION` |
| Rol no permitido | `403 ROLE_FORBIDDEN` |
| Configuración incompleta | `503 AUTH_NOT_CONFIGURED` |
| Auth no disponible, timeout o respuesta inesperada | `503 AUTH_UNAVAILABLE` |

Código: [middleware de Auth](backend/src/auth.js), [rutas HTTP](backend/src/app.js). Los errores bloquean la validación; no deben registrar asistencia.

### Evidencia funcional y de datos

Mostrar login STAFF, una validación exitosa y una petición sin sesión rechazada. Check-in no almacena contraseñas ni tokens. `registro_asistencia.id_usuario` identifica al **comprador de la entrada**, no al operador STAFF. El modelo actual no persiste el identificador del operador como auditoría; no debe presentarse esa tabla como un registro de sesión de Auth. Para la evidencia de datos de I1 se debe complementar con los registros pertinentes de Auth, sin mostrar secretos.

## 5. I2 — Recepción de tickets desde Entradas

### Flujo y contrato

Entradas emite y guarda una entrada en su MongoDB. A continuación llama al endpoint de Check-in, que guarda el ticket en MySQL antes del escaneo.

```http
POST /api/checkin/tickets
Content-Type: application/json
```

```json
{
  "id_entrada": "tk-ejemplo",
  "id_evento": "evento-ejemplo",
  "id_usuario": "comprador-uuid",
  "nombre_usuario": "Asistente de prueba",
  "qr_data": {
    "id_entrada": "tk-ejemplo",
    "id_evento": "evento-ejemplo"
  }
}
```

La versión de Entradas revisada (`e289c43`) genera imágenes QR cuyo contenido es un JSON con `id_entrada` e `id_evento`. Check-in acepta ese objeto y conserva compatibilidad con `qr_data` como texto igual a `id_entrada`, cuando se proporciona el usuario. Los identificadores del QR deben coincidir con los del ticket. El contrato actual también permite un QR estructurado sin usuario, pero la identidad debe completarse desde Entradas antes de registrar asistencia.

| Situación | HTTP / código |
|---|---|
| Registro correcto | `201`, mensaje de registro exitoso |
| Datos inválidos o QR inconsistente | `400 INVALID_REQUEST` / `QR_MISMATCH` |
| Ticket repetido | `409 TICKET_ALREADY_EXISTS`; no sobrescribe |
| Cuerpo superior a 16 KiB | `413 PAYLOAD_TOO_LARGE` |
| Fallo interno | `500 INTERNAL_ERROR` |

El endpoint no requiere sesión STAFF ni API key. La validación en puerta sí requiere sesión STAFF. Existe también el alias `/api/v1/checkin/tickets`.

Código: [rutas](backend/src/app.js), [reglas de negocio](backend/src/service.js), [persistencia MySQL](backend/src/repository-mysql.js), [OpenAPI](backend/docs/openapi.json).

### Validación en puerta

Check-in consulta primero su base local. Si el ticket no existe, o requiere completar el usuario, consulta `GET /api/v1/entradas/{id}/detalle` del servicio de Entradas. Si no existe en ninguno, rechaza con `TICKET_NOT_FOUND`. La consulta de respaldo distingue entrada ausente, servicio no disponible y respuesta inválida.

Después contrasta el evento y consulta su estado en Panel. Si las condiciones permiten el ingreso, registra asistencia en una transacción. Los escaneos posteriores del mismo ticket devuelven `TICKET_ALREADY_USED`. El uso se determina por `registro_asistencia`: no se actualiza `ticket.estado` a `USADO`.

Para demostrar la recepción inicial desde Entradas, mostrar el registro en MySQL **antes del escaneo**: de otro modo la consulta de respaldo podría ocultar un fallo del envío inicial.

## 6. Servicio ofrecido para Reseñas

### Contrato de verificación de asistencia

La operación acordada en el contrato Reseñas ↔ Check-in v1.1 confirma si un usuario asistió a un evento. No devuelve nombres, datos personales ni la lista completa.

```http
POST /checkin/asistencia?usuarioId={id}&eventoId={id}
```

También acepta los parámetros en el cuerpo JSON:

```json
{"usuarioId":"comprador-uuid","eventoId":"evento-ejemplo"}
```

Respuesta antes de registrar asistencia:

```json
{"asistio":"false"}
```

Respuesta después de un ingreso aceptado:

```json
{"asistio":"true"}
```

`asistio` es **string en POST**, conforme al contrato. Los alias POST `/api/checkin/asistencia` y `/api/v1/checkin/asistencia` ofrecen el mismo comportamiento. GET también está disponible, pero devuelve un booleano; para la demostración contractual se utiliza POST. El Gateway enruta `/api/checkin`; la ruta corta `/checkin/asistencia` de estos ejemplos se consulta directamente en el puerto 3005.

| Situación | Comportamiento actual |
|---|---|
| Combinación con asistencia | `200 {"asistio":"true"}` |
| Combinación sin asistencia | `200 {"asistio":"false"}` |
| Parámetros faltantes o inválidos | `400 INVALID_REQUEST` |
| Error interno de consulta | `500 INTERNAL_ERROR` |

**Diferencia pendiente con el contrato:** se propone `404` para usuario o evento inexistente. Actualmente Check-in no consulta esos catálogos en esta operación y responde `"false"` cuando no hay asistencia. Debe acordarse este comportamiento o implementarse la distinción. El SLA propuesto menor a 300 ms no tiene medición registrada en esta entrega.

El backend de Reseñas revisado en `master`, commit `bac6c22`, consulta su propia tabla `asistencia_eventos`; no se verificó consumo de esta API. Por ello se documenta la disponibilidad del proveedor, no una integración completa dentro de Reseñas.

### Publicación opcional de un lote

Existe además `POST /api/checkin/eventos/{id_evento}/finalizar`. Obtiene los asistentes y publica `checkin.asistencia_final` en un exchange topic (`EVENT_EXCHANGE`, por defecto `ticketu.events`) mediante RabbitMQ. El mensaje contiene `id_evento`, `total_asistentes`, `asistentes` con identificadores de usuario y entrada, y `fecha_emision`.

No se ejecuta automáticamente al escanear ni al cambiar el estado del evento en Panel. Si no hay asistentes, no publica. La confirmación del broker no acredita consumo por Reseñas. Este mecanismo no sustituye el contrato HTTP v1.1 ni se declara como integración evaluada. Código: [publicador](backend/src/rabbitmq.js).

## 7. Persistencia y trazabilidad

El esquema está en [backend/init.sql](backend/init.sql).

| Tabla | Datos y función |
|---|---|
| `ticket` | Identificadores de entrada, evento y comprador, nombre del comprador, QR, estado inicial y fecha de sincronización. |
| `registro_asistencia` | Identificadores de entrada, evento y comprador, con fecha del ingreso. Referencia al ticket mediante clave foránea. |

La transacción bloquea el ticket con `SELECT ... FOR UPDATE` antes de comprobar e insertar asistencia, para serializar escaneos concurrentes por esa ruta de escritura.

Consultas de evidencia: sustituir `ID_DEL_TICKET_EMITIDO` por el identificador devuelto por Entradas y ejecutarlas en MySQL antes y después del escaneo.

```sql
SELECT id_entrada, id_evento, id_usuario, nombre_usuario,
       qr_data, estado, fecha_sincronizacion
FROM ticket
WHERE id_entrada = 'ID_DEL_TICKET_EMITIDO';

SELECT id_asistencia, id_entrada, id_evento, id_usuario, fecha_checkin
FROM registro_asistencia
WHERE id_entrada = 'ID_DEL_TICKET_EMITIDO';
```

Antes: ticket presente y ninguna asistencia. Después: mismo ticket y una asistencia. Tras repetir el escaneo: continúa una sola asistencia.

**Observación BD1:** el modelo conserva `nombre_usuario` y `qr_data` recibidos de Entradas, además de identificadores. Por tanto, no se afirma cumplimiento íntegro del criterio de guardar únicamente referencias de otros módulos; debe revisarse o justificarse con el contrato y la pauta.

## 8. Demostración reproducible en PowerShell

Requisitos: servicios reales de Auth, Entradas, Check-in y Panel activos; MySQL y MongoDB disponibles; usuario STAFF habilitado; evento de prueba `66fff0000000000000000001` publicado en Panel y con stock en Entradas. Ese ID pertenece al fixture local, no a un evento que exista en toda instalación. La emisión gratuita por API evita depender de la pantalla de catálogo, que requiere el servicio Catálogo.

Usar la misma terminal para conservar las variables. No escanear antes de consultar la asistencia inicial.

### Paso 1 — Emitir desde Entradas

```powershell
$ErrorActionPreference = 'Stop'
$eventoId = '66fff0000000000000000001'
$usuarioId = [guid]::NewGuid().ToString()
$datos = @{
    id_evento = $eventoId
    id_usuario = $usuarioId
    nombre_comprador = 'Asistente demostracion Entrega 2'
    correo_comprador = 'demo-checkin@example.test'
    cantidad_entradas = 1
    precio_final = 0
} | ConvertTo-Json

$ticket = Invoke-RestMethod -Method Post `
    -Uri 'http://localhost:3003/api/entradas/emision-directa' `
    -ContentType 'application/json' -Body $datos

$ticket | Select-Object idEntrada, idEvento, registradoEnCheckin | Format-List
if ($ticket.registradoEnCheckin -ne $true) {
    throw 'Entradas no confirmo el registro en Check-in.'
}
```

Mostrar `registradoEnCheckin: True` y comprobar con SQL que el ticket ya existe. La llamada a Check-in la realiza Entradas, no este script. El comprador es sintético para la prueba; no se está creando una cuenta en Auth.

### Paso 2 — Consultar asistencia inicial

```powershell
$consulta = @{usuarioId=$usuarioId; eventoId=$eventoId} | ConvertTo-Json
$antes = Invoke-RestMethod -Method Post `
    -Uri 'http://localhost:3005/checkin/asistencia' `
    -ContentType 'application/json' -Body $consulta
$antes | ConvertTo-Json
```

Esperado: `{"asistio":"false"}`.

### Paso 3 — Escanear con sesión STAFF

```powershell
Start-Process $ticket.qrData
```

Mostrar el QR en otra pantalla. Iniciar sesión STAFF desde el frontend y entrar a `/checkin`. Escanear una vez: esperado `valido: true`, `motivo: TICKET_FOUND`. El objeto `evento` en la respuesta proviene de Panel. Consultar MySQL para mostrar la nueva asistencia.

### Paso 4 — Consultar asistencia posterior

```powershell
$despues = Invoke-RestMethod -Method Post `
    -Uri 'http://localhost:3005/checkin/asistencia' `
    -ContentType 'application/json' -Body $consulta
$despues | ConvertTo-Json

@(
    [pscustomobject]@{Momento='Antes'; Entrada=$ticket.idEntrada; Asistio=$antes.asistio}
    [pscustomobject]@{Momento='Despues'; Entrada=$ticket.idEntrada; Asistio=$despues.asistio}
) | Format-Table -AutoSize
```

Esperado: `"false"` antes y `"true"` después. PowerShell actúa como cliente de prueba del contrato de Reseñas; no demuestra que la aplicación de Reseñas consulte el endpoint.

### Paso 5 — Casos de error

Reescanear el mismo QR: esperado `valido: false`, `motivo: TICKET_ALREADY_USED` y ninguna asistencia adicional.

Petición sin sesión a la operación protegida:

```powershell
curl.exe -i -X POST 'http://localhost:3005/api/checkin/validaciones' `
    -H 'Content-Type: application/json' --data-raw '{}'
```

Esperado: HTTP `401`, código `SESSION_REQUIRED`. El middleware se ejecuta antes de la validación del cuerpo.

Consulta de asistencia sin parámetros:

```powershell
curl.exe -i -X POST 'http://localhost:3005/checkin/asistencia' `
    -H 'Content-Type: application/json' --data-raw '{}'
```

Esperado: HTTP `400`, código `INVALID_REQUEST`.

## 9. Pruebas automatizadas y evidencia

Desde la raíz del repositorio de Check-in:

```powershell
npm.cmd ci --prefix backend
npm.cmd test --prefix backend
```

La ejecución revisada durante la preparación obtuvo **39 pruebas aprobadas, 0 fallidas y 1 omitida**. La omitida es la prueba opcional de MySQL real. Se debe adjuntar una nueva salida fechada al repositorio; este resumen no reemplaza el reporte de ejecución.

| Archivo | Cobertura |
|---|---|
| `backend/test/auth.test.js` | Sesión, roles, fallos de Auth y acceso a endpoints entre servicios. |
| `backend/test/checkin.test.js` | Registro, duplicados, QR, errores de entrada, persistencia SQLite y rechazo por reutilización. |
| `backend/test/integrations.test.js` | Contratos HTTP de Auth, Entradas, Panel y asistencia; fallos de proveedores y concurrencia. |
| `backend/test/mysql.test.js` | Prueba opcional contra MySQL, habilitada con `TEST_MYSQL=1` y configuración de una base de pruebas. |

Las pruebas HTTP automatizadas usan contrapartes controladas y parte de la suite utiliza SQLite. No son evidencia de ejecución contra todos los microservicios reales. Complementarlas con la demostración, SQL, capturas y respuestas reales.

Ejemplo para guardar la salida de pruebas sin incluir credenciales:

```powershell
New-Item -ItemType Directory -Force 'evidencias/entrega-2' | Out-Null
Get-Date -Format o | Set-Content 'evidencias/entrega-2/backend-tests.txt'
npm.cmd test --prefix backend 2>&1 |
    Tee-Object -FilePath 'evidencias/entrega-2/backend-tests.txt' -Append
```

Evidencias que deben adjuntarse con fecha: login y autorización; rechazo sin sesión; respuesta de emisión de Entradas; ticket en MySQL antes del escaneo; ingreso aceptado; asistencia persistida; rechazo por segundo ingreso; consulta de asistencia antes y después. No incluir cookies, claves ni contraseñas en capturas o logs.

## 10. Gestión y criterios de aceptación

| Integración | Ítem de GitHub | Criterios de aceptación a vincular |
|---|---|---|
| I1 Auth | Pendiente: agregar enlace real | STAFF autorizado; ausencia o invalidez de sesión rechazada; rol no permitido rechazado; caída de Auth bloquea sin registrar ingreso. |
| I2 Entradas | Pendiente: agregar enlace real | Emisión desde Entradas registra ticket; QR coincide con IDs; ticket persiste antes del escaneo; duplicado no sobrescribe; ingreso válido registra una sola asistencia. |
| Reseñas adicional | Pendiente: agregar enlace real | Consulta devuelve strings true/false según asistencia; parámetros inválidos producen 400; resolver diferencia de 404 y coordinar consumidor. |

Los ítems deben incluir responsable, contraparte, contrato, criterios de aceptación, commits o PR relacionados y estado consistente con la evidencia. Incorporar o vincular esta declaración en `INTEGRACIONES.md` y la tabla de responsables en `RESPONSABLES.md` según la organización del repositorio; este documento no acredita que esos archivos o issues ya existan.

## 11. Estado de la entrega y pendientes

- Auth y la recepción desde Entradas constituyen las dos integraciones principales de tipos distintos.
- Se verificó una emisión real desde Entradas (`tk-5c4b79b6`) con confirmación de registro en Check-in. Es una referencia histórica de prueba; generar un ticket nuevo para cada presentación.
- Se observó una validación exitosa con datos de Panel en la respuesta. La persistencia del ingreso y la recepción previa deben evidenciarse también mediante SQL.
- El lector utiliza ZXing para no depender de `BarcodeDetector` del navegador. Las correcciones del frontend unificado y de la copia de Check-in se mantienen en repositorios distintos.
- La consulta para Reseñas está disponible; no se declara consumo real desde su backend. Falta acordar el caso 404 y medir el SLA.
- Adjuntar evidencias fechadas, completar responsables e issues y confirmar que los cambios están publicados en la rama evaluada. Un archivo local no constituye evidencia entregada en GitHub.
- La emisión por PowerShell demuestra la llamada backend real, pero no por sí sola todo el criterio UI/UX de la pauta. Mostrar además login, lectura y resultado desde la aplicación; la copia del frontend unificado todavía puede mostrar identificadores, JSON u otros detalles técnicos que deben revisarse frente a UI1.

## 12. Referencias

- [Repositorio de Check-in, rama integracion](https://github.com/Check-in-5/repositorio-de-microservicio/tree/integracion).
- [Auth](https://github.com/equipo-auth/arquitectura).
- [Entradas e Inventario](https://github.com/Microservicios-Entradas-Inventario/arquitectura_ms_entradas_inventario).
- [Reseñas, rama master revisada](https://github.com/Equipo6-Resenas/Equipo6-resenas/tree/master).
- [Contrato Reseñas ↔ Check-in en main](https://github.com/Equipo6-Resenas/Equipo6-resenas/blob/main/contract/Contrato%20Check-in.md): contenido v1.1 proporcionado para esta documentación; la rama del contrato difiere de la rama del backend revisado.
- [OpenAPI de Check-in](backend/docs/openapi.json). Swagger local: `http://localhost:3005/api-docs`.

Los documentos históricos del repositorio pueden contener ejemplos anteriores de puertos, credenciales o publicación de mensajes. Contrastar con el código y el entorno descritos aquí; mantener alineadas esas referencias antes de cerrar la entrega.
