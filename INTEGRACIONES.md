# Integraciones — Check-in, Entrega 3

**Rama:** `integracion`. **Entorno objetivo:** workstation compartida. Este archivo indica cómo obtener las evidencias en el entorno instalado; las pruebas locales o simuladas no acreditan por sí solas la integración en workstation.

| Integración | Tipo de la pauta E3 | Contraparte | Servicio, ruta o tópico | Cómo se evidencia | Dónde verificarlo |
|---|---|---|---|---|---|
| I1 | A. Autenticación (AU1) | Auth | `GET /internal/validar-sesion`, cookie original y clave interna; login por `/api/auth/login` | Login STAFF, validación exitosa y rechazo de sesión inválida/rol distinto | UI `/admin/login` y `/checkin`; `backend/src/auth.js`; logs Check-in; herramienta `workstation.mjs errores`; cuenta `staff1@ticketu.test` |
| I2 | B. API Gateway (GW1) | Entradas e Inventario | Servicio ofrecido `POST /api/checkin/tickets` a través de `ticketu-api-gateway:8080` | Emisión real desde Entradas, trazas de Gateway y ticket persistido antes del escaneo | Logs del Gateway y `docker compose logs checkin-service`; tabla `ticket`, luego `registro_asistencia`; OpenAPI `/api/checkin/openapi.json` |
| I3 | C. Broker (BR1) | Sin integración ampliada para esta entrega | Publicador histórico opcional `checkin.asistencia_final` | **Pendiente/no acreditado**: no se declara publicación/consumo real en workstation | Código histórico `backend/src/rabbitmq.js` y endpoint de finalización; no equivalen a evidencia de BR1 |

Se documenta una integración principal por tipo. A petición del equipo no se amplía el broker en este trabajo. La pauta sí exige BR1; no existe una exención verificada y este documento no afirma cumplimiento de ese ítem.

## I1 — Auth

El navegador conserva la cookie HttpOnly. En el frontend propio, las rutas Next.js reenvían la cookie por Gateway. Check-in consulta directamente al Auth interno configurado en `AUTH_SERVICE_URL` y adjunta `AUTH_INTERNAL_API_KEY` mediante `x-api-key`. No guarda contraseñas ni confía en un rol enviado en el cuerpo del escaneo.

Archivos: `backend/src/auth.js`, `backend/src/app.js`, `frontend/src/lib/server-proxy.ts` y `frontend/src/app/checkin/page.tsx`. Timeout de introspección: 5 segundos. Falta de cookie: 401; sesión inválida: 401; otro rol: 403; falta de configuración o fallo de Auth: 503 controlado. No se registra ingreso si falla el middleware.

### Verificación

1. Iniciar sesión STAFF y validar una entrada real desde la UI. No copiar JWT a mano.
2. Ejecutar `docker compose exec -T checkin-service node scripts/workstation.mjs errores`. Incluye una cookie deliberadamente inválida `jwt=token.invalido.firmamala`; se espera `401 INVALID_SESSION`. Sin cookie: `401 SESSION_REQUIRED`. Si Auth está caído puede aparecer 503: eso no cuenta como prueba aprobada del token inválido.
3. Iniciar sesión con una cuenta ORGANIZADOR en el login administrativo: `/checkin` debe mostrar acceso restringido. No cambiar `CHECKIN_ALLOWED_ROLES` para lograr el ingreso. La prueba de otro rol exige que Auth tenga esa cuenta instalada.

Cuentas, requisitos y clave QA documentados por Auth: [INSTALACION.md](https://github.com/equipo-auth/arquitectura/blob/54a5ae3d8f464259e0fae3b1edb084f9f176ca73/INSTALACION.md) y [QA_USUARIOS_Y_DESTINOS.md](https://github.com/equipo-auth/arquitectura/blob/54a5ae3d8f464259e0fae3b1edb084f9f176ca73/docs/QA_USUARIOS_Y_DESTINOS.md). Contrato implementado del consumidor descrito también en `backend/docs/integracion-auth.md` (documento histórico; la configuración E3 es la de la raíz).

## I2 — Entradas consume Check-in por API Gateway

Flujo:

```text
Emisión en Entradas
  -> POST Gateway /api/checkin/tickets
  -> Check-in valida payload y guarda en MySQL
  -> Entradas informa registradoEnCheckin=true
  -> Operador STAFF escanea desde UI
  -> Check-in registra asistencia
```

En el servicio Entradas, `CHECKIN_SERVICE_URL=http://ticketu-api-gateway:8080`. En el Gateway, `CHECKIN_SERVICE_URL=http://checkin-service:3005`. Configurar ambas variables al mismo destino Gateway produciría un bucle. La ruta pública conserva `/api/checkin`.

### Contrato ofrecido

OpenAPI de esta rama: [backend/docs/openapi.json](backend/docs/openapi.json). Descarga por Gateway: `GET /api/checkin/openapi.json`. Swagger directo del backend: `/api-docs` en el puerto publicado 3005; el Gateway oficial no publica esa ruta corta.

```http
POST /api/checkin/tickets
Content-Type: application/json
```

```json
{
  "id_entrada": "tk-ejemplo",
  "id_evento": "evento-real",
  "id_usuario": "usuario-real",
  "nombre_usuario": "Asistente",
  "qr_data": {"id_entrada":"tk-ejemplo","id_evento":"evento-real"}
}
```

No se exige API key de Check-in ni cookie de operador para el registro servidor-servidor. La validación de acceso sí exige sesión STAFF. Respuestas: 201 creado; 400 `INVALID_REQUEST`/`QR_MISMATCH`; 409 `TICKET_ALREADY_EXISTS` sin sobrescritura; 413 cuerpo mayor a 16 KiB; 500 fallo interno. OpenAPI incluye la compatibilidad con QR como texto y los campos requeridos. Las respuestas de negocio de validación usan HTTP 200 con `valido:false` para ticket usado/no encontrado; no confundirlas con un fallo HTTP del Gateway.

Referencia del proveedor Entradas para la consulta de respaldo: rama `main`, `docs/contratos/openapi.json`, `back-end/routers/entradas.py`, endpoint público `GET /api/entradas/{id}/detalle`. Código revisado en [ebbf4be](https://github.com/Microservicios-Entradas-Inventario/arquitectura_ms_entradas_inventario/tree/ebbf4bea265fa5f71805879cc8fa7f86ccaea67f). Su documento `docs/contratos/contrato-http-checkin.md` todavía menciona puerto 3001 y QR solo texto: esos ejemplos históricos no reemplazan nuestro puerto interno 3005 ni el payload estructurado que su emisor actual genera. Coordinar esa actualización documental con Entradas.

### Evidencia y resultados esperados

1. `workstation.mjs eventos`: lista inventario por Gateway.
2. `workstation.mjs emitir ID_EVENTO_REAL`: llama al endpoint real de Entradas por Gateway; comprobar `registradoEnCheckin:true`. Emite una entrada gratuita sintética y consume un cupo, no una compra pagada.
3. Consultar MySQL antes del escaneo: el ticket debe existir sin asistencia. Consultas en `INSTALACION.md`.
4. En logs del Gateway debe aparecer `POST /api/checkin/tickets` con fecha/hora de Docker. En logs de Check-in (`TRACE_HTTP=true`) debe observarse estado 201. El Gateway revisado propaga `x-request-id` y Check-in lo devuelve y registra; correlacionar los valores de esa llamada, no el ID de la llamada anterior de emisión.
5. Escanear desde UI o ingresar ambos IDs manualmente. Comprobar una asistencia y repetir para obtener `TICKET_ALREADY_USED`.

```powershell
docker compose logs --timestamps --tail=100 checkin-service
docker logs --timestamps --tail=100 ticketu-api-gateway
```

Si el nombre del contenedor Gateway difiere, obtenerlo de plataforma o `docker ps`; no se crea otro Gateway para las pruebas.

Los logs propios incluyen fecha UTC, ruta, estado, duración y request ID. No incluyen cookies, claves, cuerpos completos ni contraseñas. La tabla `ticket` conserva IDs y fecha de sincronización; `registro_asistencia` conserva IDs y fecha de ingreso.

### Manejo de errores

- La herramienta `errores` verifica 401 por sesión ausente/inválida, 400 por consulta incompleta y 404 de una ruta inexistente por Gateway.
- En `backend/src/integrations.js`, la consulta de respaldo a Entradas usa `API_GATEWAY_URL` y `ENTRADAS_DETAIL_PATH`, timeout de 3 segundos, sin redirecciones. Si el Gateway falla no se intenta saltarlo llamando directamente a Entradas. Un 404 se interpreta como ticket ausente; errores de disponibilidad producen 503 y respuestas malformadas 502.
- El proxy del frontend maneja conexión/timeout con 503 y no expone excepciones internas. Timeout: 10 segundos.
- `backend/test/gateway.test.js` prueba la selección del Gateway y errores con un servidor controlado. Es prueba automatizada de código, no evidencia de ejecución en workstation.

Si Entradas no está operativo en workstation, declarar esa indisponibilidad y verificar la parte proveedora con una petición de prueba a `POST /api/checkin/tickets` **por el Gateway**, contrastando 201/409 y SQL. Esto corresponde a la excepción de contraparte no disponible de la pauta; no describirlo como una emisión real desde Entradas.

## I3 — Broker: alcance explícito

Se mantiene, sin ampliarlo, el código heredado de publicación `checkin.asistencia_final` al invocar `POST /api/checkin/eventos/{id_evento}/finalizar`. No se dispara por escaneo ni por un cambio de estado en Panel. El exchange es `EVENT_EXCHANGE` (por defecto `ticketu.events`), y la conexión usa `BROKER_URL`.

No se ha acreditado acuerdo de consumo de ese tópico por Reseñas ni publicación/consumo en workstation. El contrato de Reseñas aportado se basa en HTTP. No se crea una cola de prueba para hacerla pasar por consumidor real. La pauta contempla la indisponibilidad de contraparte, pero requiere evidencia verificable de publicación y esquema acordado; no se afirma que exista esa evidencia.

BR1 queda pendiente y puede afectar la evaluación. Para cerrarlo se necesita confirmar aplicabilidad/acuerdo con el docente y las contrapartes, o implementar y verificar la integración correspondiente; no se modifica ese alcance en esta entrega solicitada.

## Dependencias adicionales

- Panel: aporta estado y datos del evento. Se mantiene consulta directa configurada porque el Gateway revisado no publica su ruta compatible. No se declara como GW1. La política `deny` no omite 401/403, y `allow` tampoco los elude.
- Reseñas: `POST /api/checkin/asistencia` por Gateway devuelve strings `"true"`/`"false"` para usuario y evento. GET devuelve booleanos. No se afirma consumo desde el backend de Reseñas. El 404 propuesto para identidades inexistentes no está implementado: sin registro se responde false.

## Estado de verificación

Esta rama prepara instalación y procedimientos. El ayudante debe comprobar red, credenciales, usuarios, evento, Gateway y flujo en workstation. La prueba local, el README o el healthcheck no acreditan por sí solos todos esos requisitos. Fechas y condiciones de la evaluación se resumen en `README_ENTREGA_3.md`.
