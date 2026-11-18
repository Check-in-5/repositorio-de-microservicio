# Check-in — integración

Esta rama contiene las fuentes de Check-in utilizadas en TITEC-V2:

- **backend/**: API de Check-in con Auth, recepción/consulta de Entradas, consulta de Panel y endpoint de asistencia para Reseñas. Base local: commit `4a3737b` de Check-in-5/backend.
- **frontend/**: frontend de Auth integrado con la interfaz de escaneo e ingreso manual de Check-in que se utiliza en TITEC-V2.

Se conserva el código de esas carpetas. No se incluyen los repositorios externos, el Compose raíz de TITEC-V2, secretos, llaves, dependencias instaladas ni datos de Docker. Los Compose incluidos en cada subcarpeta no constituyen un despliegue de toda la plataforma.

## Configuración de la integración

La API requiere Auth y su clave de introspección. El registro de tickets, la consulta de asistencia y la finalización de eventos no requieren API key de Check-in. El frontend necesita variables de servidor `AUTH_SERVICE_URL`, `CHECKIN_SERVICE_URL`, `APP_ORIGIN` y `CHECKIN_ALLOWED_ROLES=STAFF`, como en el Compose raíz de TITEC-V2; nunca exponer las claves en variables NEXT_PUBLIC.

Ejemplo de URLs internas Docker usadas en TITEC-V2:

- AUTH_SERVICE_URL=http://auth-service:10000
- CHECKIN_SERVICE_URL=http://checkin-service:3000
- APP_ORIGIN=http://localhost:3000

Los archivos `.env.example` heredados son plantillas de sus proyectos y deben ajustarse al entorno. Para el detalle de contratos, consultar [la documentación del backend](backend/docs/integracion-completa.md).

## Estado y límites conocidos

- La validación requiere sesión STAFF; busca primero en MySQL y consulta Entradas si falta el ticket.
- La asistencia registrada impide el reingreso. No se actualiza `ticket.estado` a USADO.
- El ingreso manual recibe ID de entrada y evento. El lector QR todavía usa un evento predeterminado si el QR solo contiene el ID: queda pendiente seleccionar el evento de la puerta.
- Reseñas dispone de una API de asistencia en Check-in; su backend externo aún debe consumirla y coordinar la identidad de usuarios.
- El entorno local TITEC-V2 incluye un adaptador interno para que Panel envíe la clave de introspección exigida por Auth. Entradas se conecta directamente a Check-in. Ese adaptador no forma parte de estas dos carpetas.
- Publicar estas fuentes no implica que se haya verificado una compra completa ni la creación de reseñas entre todos los servicios.

## Comandos de desarrollo

En backend: `npm ci` y `npm test`. La prueba MySQL real requiere una base de pruebas y `TEST_MYSQL=1`.

En frontend: `npm ci`, `npm run build` y `npm run test:integration` (requiere compilación previa).
