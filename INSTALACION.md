# Instalación de Check-in — Entrega 3

Esta guía instala **Check-in y su MySQL** en la plataforma compartida. Toma como referencia el despliegue del equipo de Entradas: Compose independiente por módulo, red externa `plataforma-eventos-net`, base privada y Gateway/Auth/RabbitMQ administrados por plataforma. No instala ni reinicia servicios de otros equipos.

## 1. Requisitos y límites

- Git, Docker y Docker Compose v2; acceso a imágenes Node 22 y MySQL 8 durante la construcción.
- Plataforma con `ticketu-api-gateway:8080` y `auth-service:10000` en `plataforma-eventos-net`.
- Entradas instalado y configurado para enviar tickets a través del Gateway.
- Panel Organizador accesible en `organizador-service:3000`; su ruta `GET /api/v1/panel/eventos/{id}` debe admitir STAFF. El flujo bloquea por defecto si Panel falla o rechaza la sesión.
- Cuentas QA creadas por Auth. No hay tokens fijos ni cuentas Auth creadas por este repositorio.
- Un evento publicado y con stock en Entradas, reconocido por Panel. No se inventa un evento local para sustituir a esos servicios.

La IP/dominio público de workstation aún no fue informado. Debe sustituirse al instalar: los nombres Docker de esta guía sí son valores operativos de la plataforma de referencia, pero no son direcciones que resuelva el navegador. No se afirma que el software ya esté instalado en workstation.

## 2. Descargar y configurar

```powershell
git clone --branch integracion https://github.com/Check-in-5/repositorio-de-microservicio.git checkin
cd checkin
Copy-Item .env.example .env
```

Editar **el `.env` de la raíz**. No copiar ni mostrar secretos en capturas:

| Variable | Valor o procedencia |
|---|---|
| `COMPOSE_PROJECT_NAME` | `checkin`, distinto de otros módulos |
| `CHECKIN_PORT` | `3005`, puerto publicado; interno siempre 3005 |
| `FRONTEND_PORT` | `3015`, frontend opcional propio; evita ocupar el 3000 del frontend unificado |
| `APP_ORIGIN` | Origen exacto del frontend propio, sin ruta ni barra final, por ejemplo `https://checkin.DOMINIO_WORKSTATION`; confirmar con plataforma. Para acceso HTTP desde el host usar su IP y `:3015`. |
| `API_GATEWAY_URL` | `http://ticketu-api-gateway:8080` |
| `AUTH_SERVICE_URL` | `http://auth-service:10000` |
| `AUTH_INTERNAL_API_KEY` | Mismo valor que `INTERNAL_API_KEY` del Auth de workstation; obtenerlo del responsable del entorno |
| `DB_PASSWORD` y `DB_ROOT_PASSWORD` | Secretos nuevos para MySQL de Check-in; no cambiar tras inicializar el volumen sin una migración de credenciales |
| `ENTRADAS_DETAIL_PATH` | `/api/entradas/{id}/detalle` |
| `PANEL_SERVICE_URL` | `http://organizador-service:3000` mientras plataforma no publique la ruta de integración por Gateway |
| `PANEL_EVENT_PATH` | `/api/v1/panel/eventos/{id}` |
| `BROKER_URL` | Vacío en el despliegue solicitado. No se declara BR1 como cumplido. |

El frontend propio usa proxy de Next.js: el navegador envía cookies al mismo origen, y el servidor reenvía Auth y las validaciones por el Gateway. Las direcciones son variables de ejecución; no se necesitan URLs públicas de microservicios dentro de JavaScript.

## 3. Preparación de plataforma — no duplicar infraestructura

```powershell
docker network inspect plataforma-eventos-net
```

Si la red no existe, coordinar con plataforma. Solo en una instalación nueva autorizada: `docker network create plataforma-eventos-net`. Todos los servicios compartidos deben conectarse a esa misma red.

El Gateway oficial debe tener:

```dotenv
CHECKIN_SERVICE_URL=http://checkin-service:3005
ENTRADAS_SERVICE_URL=http://entradas-service:3000
AUTH_SERVICE_URL=http://auth-service:10000
```

En el Compose de **Entradas**, su variable `CHECKIN_SERVICE_URL` debe ser `http://ticketu-api-gateway:8080`. Su Compose revisado ya utiliza ese valor. Esta distinción evita un bucle: Gateway apunta a Check-in; Entradas apunta al Gateway.

El Gateway mantiene el prefijo `/api/checkin` sin reescribirlo. Publica `/api/checkin/tickets`, `/api/checkin/validaciones`, `/api/checkin/asistencia`, `/api/checkin/health` y `/api/checkin/openapi.json`.

**Panel:** el Gateway revisado solo publica `/api/organizador`, no `/api/v1/panel`. No cambiar su URL al Gateway sin publicar antes la ruta correcta: el endpoint de organizador puede tener otro formato/seguridad. Panel es una dependencia auxiliar directa y no la integración declarada para GW1. Si plataforma publica `/api/v1/panel` hacia Panel, configurar `PANEL_SERVICE_URL` al Gateway y conservar la ruta. El Panel debe estar configurado para validar con Auth, incluida la clave interna cuando su cliente la requiera; el adaptador del antiguo TITEC-V2 no se despliega aquí.

## 4. Levantar el módulo

Desde la raíz del repositorio:

```powershell
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --tail=80 checkin-service
```

Esto levanta solo `checkin-service` y `checkin-db`. El volumen `checkin_mysql` persiste datos. `backend/init.sql` crea las tablas al primer arranque de un volumen vacío. MySQL no publica un puerto al host y solo participa en la red privada `checkin-interna`.

No ejecutar simultáneamente el Compose antiguo de `backend/` o el stack TITEC-V2 en el mismo puerto. Los Compose de subcarpetas son históricos; para la entrega 3 usar exclusivamente el de la raíz. No ejecutar `down -v`: elimina datos propios y no es una actualización.

### Frontend propio opcional

Si el frontend unificado no está disponible o no incluye estas correcciones:

```powershell
docker compose --profile frontend up --build -d
```

Acceder al origen definido en `APP_ORIGIN`. Rutas del frontend propio: `/admin/login`, `/checkin`. Incluye lector jsQR, una validación por lectura y pausa entre escaneos. Al cerrar sesión desde `SessionActions` se usa Auth.

La cámara desde un equipo remoto necesita HTTPS y permiso del navegador. HTTP sobre una IP de red normalmente no habilita `getUserMedia`; habilitar TLS en el proxy de plataforma o utilizar ingreso manual por código. No cambiar la seguridad del navegador para la evaluación. Si se usa el frontend unificado, su login puede estar en `/auth/admin/login`, y debe llamar al Gateway con `credentials: include` y CORS configurado para su origen.

## 5. Usuarios publicados por Auth

Fuente: `equipo-auth/arquitectura`, commit `54a5ae3`, archivos `INSTALACION.md` y `docs/QA_USUARIOS_Y_DESTINOS.md`.

| Uso | Usuario | Rol |
|---|---|---|
| Flujo principal | `staff1@ticketu.test` | STAFF |
| Alternativas | `staff2@ticketu.test`, `staff3@ticketu.test` | STAFF |
| Prueba de rechazo por rol | `comprador1@ticketu.test` o `organizador1@ticketu.test` | usuario / organizador |

`INSTALACION.md` de Auth publica la contraseña ficticia QA **`TicketuQA2026!`**. Su documentación también permite elegir un secreto distinto al ejecutar el seed. Usar la contraseña efectiva del seed de workstation, confirmada por Auth. Las cuentas no aparecen automáticamente al descargar una imagen; no ejecutar ni reiniciar el seed de otro equipo desde Check-in, porque puede revocar sesiones.

## 6. Flujo principal para el ayudante

1. Iniciar sesión con `staff1@ticketu.test` desde `/admin/login` del frontend propio (o el login administrativo del unificado).
2. Emitir una entrada gratuita real desde Entradas por Gateway para un evento publicado. El QR debe contener `id_entrada` e `id_evento` válidos.
3. Entrar a `/checkin` y escanear el QR. Alternativamente seleccionar ingreso manual e introducir los dos IDs recibidos.
4. Verificar acceso autorizado y una fila nueva en `registro_asistencia`.
5. Repetir el mismo ticket: acceso rechazado por `TICKET_ALREADY_USED`, sin segunda asistencia.

El nombre y horario de un evento no prueban por sí solos su consulta: el objeto `evento` de la respuesta de validaciones contiene los datos obtenidos de Panel. Los identificadores de compradores de las herramientas de QA son sintéticos y no sustituyen el login del operador STAFF.

## 7. Comandos de comprobación reales por Gateway

Dentro del contenedor, usando su configuración (sin depender de la IP pública):

```powershell
docker compose exec -T checkin-service node scripts/workstation.mjs comprobar
docker compose exec -T checkin-service node scripts/workstation.mjs errores
docker compose exec -T checkin-service node scripts/workstation.mjs eventos
```

Seleccionar un ID real del listado, cuyo evento también exista publicado en Panel:

```powershell
docker compose exec -T checkin-service node scripts/workstation.mjs emitir ID_EVENTO_REAL
```

`emitir` consume un cupo y crea una entrada gratuita, una sola vez por ejecución. Devuelve el QR, el usuario de prueba y `registradoEnCheckin`. Comprobar `true`. No reintentar automáticamente si el registro no se confirma: puede haber persistencia parcial en Entradas.

Estas herramientas no registran asistencia; el escaneo o ingreso manual desde la UI realiza esa operación. Todas las llamadas de la herramienta llegan al Gateway. Sus respuestas muestran fecha, estado y `requestId`, sin tokens ni claves.

### Verificación de MySQL

```powershell
docker compose exec checkin-db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" checkin_db'
```

En el cliente SQL, sustituir `ID_REAL` por el ticket recién emitido:

```sql
SELECT id_entrada,id_evento,id_usuario,fecha_sincronizacion
FROM ticket WHERE id_entrada='ID_REAL';
SELECT id_entrada,id_evento,id_usuario,fecha_checkin
FROM registro_asistencia WHERE id_entrada='ID_REAL';
```

Comprobar ticket presente **antes** de escanear, ninguna asistencia antes, una después y una tras repetir. El estado `ticket.estado` no cambia a USADO: la reutilización se controla con la tabla de asistencia.

## 8. Actualización y diagnóstico

```powershell
git pull --ff-only origin integracion
docker compose --profile frontend up --build -d
docker compose logs --tail=100 checkin-service
```

| Resultado | Revisar |
|---|---|
| Gateway 503 `SERVICE_NOT_CONFIGURED` | Variable del destino en Gateway; recrearlo mediante el procedimiento de plataforma |
| Gateway 502 | Red compartida, nombre `checkin-service`, puerto interno 3005, healthcheck |
| `SESSION_REQUIRED` | Cookie no enviada por frontend/proxy |
| `INVALID_SESSION` | Token inválido, vencido o revocado en Auth |
| `ROLE_FORBIDDEN` | Cuenta sin rol STAFF |
| `AUTH_UNAVAILABLE` | Auth, clave interna o contrato de introspección |
| `PANEL_FORBIDDEN` | Endpoint/versión de Panel debe admitir STAFF, no solo ORGANIZADOR |
| `ENTRADAS_UNAVAILABLE` | Ruta pública y destino de Entradas en Gateway |
| Cámara sin permiso | HTTPS, permiso y disponibilidad del dispositivo; usar ingreso manual si corresponde |

Los scripts `scripts/entrega-2` se conservan como material histórico local. No utilizarlos como evidencia de GW1: sus URLs directas no demuestran tráfico a través del Gateway de workstation.

## 9. Broker y alcance solicitado

Se conserva el publicador histórico y su variable opcional, pero no se instala un broker, no se agrega un consumidor y no se declara una integración BR1 lograda. La pauta de entrega 3 incluye ese ítem para los módulos; esta decisión de alcance no constituye una exención del docente. Ver la declaración explícita en `INTEGRACIONES.md`.
