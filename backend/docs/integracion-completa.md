# Integración de Check-in con Auth, Entradas, Panel y Reseñas

Rama: `integracion-auth-entradas-panel-resenas`. Base: `integracion-con-auth` (`6c394c0`).
Esta entrega modifica únicamente el backend Check-in. No reemplaza TITEC, su frontend ni los repositorios de otros equipos.

## Estado y fuentes revisadas (16-11-2026)

| Fuente | Commit | Resultado |
|---|---|---|
| Check-in / feat/Integracion-entradas | 5a7c450 | Se adaptan recepción v2, alias v1, consulta a Entradas y estado de Panel; se conserva Auth y control de ingreso único. |
| Check-in / back-end-integracion-resena | c3909fa | Se implementa la consulta de asistencia cuyo método MySQL estaba comentado. |
| Entradas / main | fa38b83204a068f9d3d431a060f78ddf449c8251 | Su productor envía QR como texto y el ID de comprador; su GET básico omite id_evento. Se usa GET /detalle para sincronizar. El registro directo no requiere API key. |
| Panel / main | aba84eda3813ad5c46a99a86825e7dedb2660f14 | Su GET compartido exige cookie jwt y rol staff/organizador. Check-in reenvía la cookie STAFF después de validarla en Auth. |
| Reseñas / main | eca3ab1f2ff14b1cadfb5f66c1c4bb7275fc3db4 | Todavía usa asistencia_eventos en PostgreSQL; no llama a Check-in. Sus IDs de usuario son enteros, mientras Auth/Entradas usan UUID. Requiere cambios en el consumidor. |

Repositorios contrastados:
- https://github.com/Microservicios-Entradas-Inventario/arquitectura_ms_entradas_inventario
- https://github.com/marybaxmann/Equipo-1---Panel-Organizador
- https://github.com/Equipo6-Resenas/Equipo6-resenas

## Flujo implementado

1. Entradas registra un ticket con `POST /api/checkin/tickets` o `/api/v1/checkin/tickets`.
2. El frontend existente de TITEC conserva el login de Auth y reenvía la cookie al validar. Ambas rutas `/api/checkin/validaciones` y `/api/v1/checkin/validaciones` exigen sesión STAFF.
3. Si el ticket no está localmente, o le falta el ID de comprador, Check-in consulta `GET /api/v1/entradas/{id}/detalle`. Comprueba ID, evento, comprador, nombre y estado EMITIDA. No inventa evento ni identidad. 404, caída y respuesta incompatible son casos distintos.
4. Check-in consulta `GET /api/v1/panel/eventos/{id}` con la cookie del operador. Solo PUBLICADO permite el ingreso. Devuelve datos del evento bajo `evento`, sin exponer el ID del comprador al escáner.
5. Guarda una asistencia. En MySQL usa transacción y bloqueo del ticket (`FOR UPDATE`) para serializar escaneos del mismo ID. No limpia duplicados históricos; todos los escritores deben respetar esta operación.
6. Reseñas puede consultar la asistencia del **comprador**, nunca la del operador STAFF.

La copia local de tickets sigue siendo la fuente de validación una vez sincronizada. No se ha implementado propagación continua de anulaciones de Entradas ni consumo del tópico `panel.evento.checkin.v1`: esta rama utiliza la consulta HTTP a Panel. El frontend actual de TITEC sigue compatible, pero requiere una mejora visual posterior para mostrar el bloque `evento` en lugar de sus textos de respaldo.

## Contratos

Registro compatible:

```json
{
  "id_entrada": "tk-1",
  "id_evento": "evento-real",
  "id_usuario": "uuid-real-del-comprador",
  "nombre_usuario": "Asistente",
  "qr_data": { "id_entrada": "tk-1", "id_evento": "evento-real" }
}
```

También se admite `qr_data: "tk-1"` o su ausencia cuando se entrega id_usuario (productor actual de Entradas). Si se omite id_usuario, se exige QR objeto y se almacena temporalmente una cadena vacía: antes de admitir el acceso se debe resolver la identidad desde Entradas. Si no se puede, devuelve error; no registra una asistencia atribuida a un usuario ficticio.

Consulta de Reseñas, sin API key:

- `POST /api/checkin/asistencia` con `{ "eventoId": "...", "usuarioId": "..." }`: responde `{ "asistio": "true" }` o `{ "asistio": "false" }`, compatible con la rama de reseñas.
- `GET /api/checkin/asistencia?eventoId=...&usuarioId=...`: responde un **booleano** `{ "asistio": true }` o `{ "asistio": false }`, conforme a la propuesta del contrato general de Reseñas.
- Alias equivalentes: `/api/v1/checkin/asistencia` y `/checkin/asistencia`. POST admite query como alternativa al body.
- Ausencia de asistencia: 200 con false. Error de base: 500, nunca false.

Se conserva `POST /api/checkin/eventos/{id}/finalizar`, sin API key. Publica `checkin.asistencia_final` en `ticketu.events` con confirmación del broker. No modifica el estado de Panel. No asegura que Reseñas consuma el mensaje, ni entrega exactamente una vez; el consumidor debe tolerar reintentos. El repositorio actual de Reseñas no contiene ese consumidor. Si no hay asistentes, devuelve total cero sin publicar.

## Configuración

Copiar `.env.example` a `.env` y completar:

| Variable | Valor / propósito |
|---|---|
| AUTH_SERVICE_URL | URL alcanzable de Auth, p.ej. http://host.docker.internal:10000 si está publicado en Windows |
| AUTH_INTERNAL_API_KEY | Mismo INTERNAL_API_KEY que usa Auth; solo backend |
| CHECKIN_SERVICE_API_KEY | Clave compartida con productores Entradas y consumidor Reseñas |
| ENTRADAS_SERVICE_URL | http://entradas-service:3000 en red compartida; http://host.docker.internal:3003 si se accede por puerto publicado |
| PANEL_SERVICE_URL | URL real del backend Panel desde el contenedor; el hostname organizador-service requiere que ese servicio o alias exista |
| ENTRADAS_API_KEY / PANEL_API_KEY | Opcionales; no exigidas por los endpoints revisados. Panel requiere la cookie, que se reenvía automáticamente |
| PANEL_FAILURE_POLICY | deny por defecto. allow continúa solo ante error 503 de Panel; nunca omite su rechazo 401/403 o respuesta inválida |
| BROKER_URL / EVENT_EXCHANGE | Necesarios para finalizar con publicación; no para la consulta síncrona de asistencia |

Fuera de Compose, omitir ENTRADAS_SERVICE_URL o PANEL_SERVICE_URL desactiva la consulta correspondiente por compatibilidad con Auth standalone. El Compose de esta rama asigna URLs por defecto a ambos proveedores. El modo autónomo no mantiene caché del estado de Panel: si se elige allow se pierde esa comprobación durante una caída.

```powershell
# Desde este checkout. Usar puertos libres si TITEC ya está corriendo.
Copy-Item .env.example .env
# Editar .env antes de continuar. PORT=3015 y DB_PORT=3315 permiten evitar colisiones habituales.
docker network create plataforma-eventos-net  # Solo si no existe
docker compose config --quiet
docker compose up --build -d
```

Este Compose levanta **Check-in y MySQL**, no toda la plataforma. El Compose raíz de TITEC no se modificó. Panel tiene en su Compose revisado únicamente Mongo y mock-auth, por lo que su backend debe levantarse/configurarse según ese repositorio. Los Compose actuales de Panel y Entradas publican Mongo en 27017: no pueden usar simultáneamente ese puerto del host sin ajustar uno.

## Cambios pendientes en los consumidores

### Entradas

Configurar CHECKIN_SERVICE_URL=http://checkin-service:3005 en la red Docker. El POST requiere Content-Type: application/json y el cuerpo del contrato; no requiere API key. Su timeout actual es de 0.5 s: sigue pendiente acordar reintentos ante errores transitorios.

### Reseñas

Su `code/backend/src/services/resenas.service.js` llama a `repositories/asistencia.repo.js`, que consulta una tabla local. Para integración real debe sustituir esa verificación por el GET de Check-in con timeout y validación estricta de `asistio === true`. En error debe impedir publicar y responder 503, sin convertir el error en falta de asistencia.

Además debe definir una relación persistente entre `usuarios.id` (entero local) y el UUID canónico de Auth, o migrar su modelo a ese UUID. **No convertir el número local a texto esperando que coincida con un UUID, ni inventar correspondencias.** Sus validadores también restringen evento a `evt-*`, mientras Panel emite IDs Mongo como texto. Requiere adaptar validación/identidad en Reseñas, no modificar los IDs reales de Check-in.

Se detectó además que crearResena usa `eventoCatalogo.fecha` sin definir eventoCatalogo: esa asignación debe corregirse en su backend para que una reseña creada no termine en error de respuesta. No se modificó ni publicó código en los repositorios de los otros equipos.

## Pruebas y límites de verificación

- `npm test`: incluye regresión Auth y pruebas HTTP de Entradas, Panel y asistencia, con servidores controlados y SQLite.
- `TEST_MYSQL=1 npm test`: activa la prueba opcional contra una **base de pruebas** MySQL. Comprueba registro, ocho ingresos concurrentes, asistencia y limpieza de sus datos. No usar una base productiva.
- En esta sesión no se pudo acceder al daemon Docker: MySQL real, RabbitMQ real y los servicios completos no fueron ejecutados. La rama es una integración verificable del lado Check-in, no una certificación de funcionamiento de toda la plataforma.
- El frontend no se fusionó ni publicó en esta rama de backend. La interfaz de TITEC conserva compatibilidad con /api/checkin/validaciones y su cookie.

## Alineación con infraestructura FWizav/backendticketU

Fuente: https://github.com/FWizav/backendticketU (README, api-gateway/.env.example y Compose de Gateway/Broker).

- Red externa: `plataforma-eventos-net`; servicio estable: `checkin-service`.
- Check-in en Docker escucha en 3005; Compose publica `3005:3005` por defecto. PORT en el .env elige el puerto del host. La ejecución nativa con npm conserva PORT=3005.
- Gateway público: localhost:8080. Su CHECKIN_SERVICE_URL debe ser http://checkin-service:3005.
- El prefijo público de Check-in es /api/checkin; el Gateway no reescribe rutas ni publica nuestros alias /api/v1/checkin o /checkin.
- Entradas y Reseñas deben dirigirse a http://checkin-service:3005 en la red Docker. Si acceden desde Windows: http://localhost:3005. El frontend de TITEC solo cambia su CHECKIN_SERVICE_URL si se conecta directamente a esta nueva instancia; TITEC no se modificó.
- Entradas: http://entradas-service:3000. Panel: http://organizador-service:3000 cuando ese nombre exista en la red compartida.
- RabbitMQ: ticketu-rabbitmq:5672; administración localhost:15672. Exchange ticketu.events.
- La plantilla del Gateway supone todos los backends en 3000. Auth real escucha en 10000: configurar AUTH_SERVICE_URL=http://auth-service:10000 en el Gateway y Check-in cuando Auth tenga ese nombre en la red. No cambiar el puerto real de Auth basándose solo en la plantilla.
- Panel expone /api/v1/panel/eventos/{id}, pero el Gateway solo enruta /api/organizador. Por eso Check-in consulta directamente al backend Panel dentro de Docker; no usar el Gateway como PANEL_SERVICE_URL sin acordar rutas adicionales.

No se modificó el repositorio de infraestructura ni los servicios de otros equipos.
