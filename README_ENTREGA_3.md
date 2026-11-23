# Check-in — Entrega 3: integraciones en workstation

Rama de entrega: [integracion](https://github.com/Check-in-5/repositorio-de-microservicio/tree/integracion). Documentación preparada el 18 de noviembre de 2026.

## Qué contiene

- Backend Check-in y frontend propio con lector QR, autorización STAFF y consulta de asistencia.
- Compose de raíz para el módulo y su MySQL privado; frontend opcional mediante perfil `frontend`.
- Uso de Auth real y Gateway compartidos; no se clonan bases ni servicios de los otros equipos dentro del despliegue de Check-in.
- Contrato OpenAPI, esquema SQL, pruebas automatizadas y herramienta de comprobación por Gateway.
- Correcciones del lector: jsQR, una validación por lectura y pausa de tres segundos. Se probaron con una captura real y compilación; verificar cámara/dispositivo en workstation.

## Documentos operativos

1. [INSTALACION.md](INSTALACION.md): requisitos, variables, puertos, cuentas QA, comandos y flujo principal que puede seguir el ayudante.
2. [INTEGRACIONES.md](INTEGRACIONES.md): declaración AU1/GW1 y estado explícito de BR1; cómo y dónde obtener evidencia en workstation.
3. [OpenAPI](backend/docs/openapi.json): contrato de Check-in, también publicado en `/api/checkin/openapi.json` por Gateway.

## Arquitectura adoptada

```text
Navegador -> frontend propio (proxy Next.js) -> Gateway compartido
                                            -> Check-in:3005 -> MySQL privado
Entradas -> Gateway /api/checkin/tickets -----^
Check-in -> Auth interno (cookie + clave interna)
Check-in -> Gateway /api/entradas/{id}/detalle (si falta el ticket)
Check-in -> Panel (dependencia auxiliar configurada)
```

Referencia: Compose e instrucciones de [Entradas, commit ebbf4be](https://github.com/Microservicios-Entradas-Inventario/arquitectura_ms_entradas_inventario/tree/ebbf4bea265fa5f71805879cc8fa7f86ccaea67f). Se adopta su patrón de red compartida y módulo independiente, no sus credenciales fijas ni su base de datos MongoDB. Check-in utiliza MySQL y no lo publica al host.

El Gateway de referencia [FWizav/backendticketU, commit bea2c1c](https://github.com/FWizav/backendticketU/tree/bea2c1cbcd5d66836b18558e38c55d3bb59f88e0) mantiene `/api/checkin` sin reescritura. Las rutas de Panel no están publicadas con el prefijo que Check-in consume, por lo que no se afirma que esa dependencia atraviese el Gateway. La integración GW1 declarada es la recepción de tickets de Entradas.

## Arranque resumido

Tras completar los requisitos de plataforma y los secretos del `.env`:

```powershell
docker compose config --quiet
docker compose --profile frontend up --build -d
docker compose exec -T checkin-service node scripts/workstation.mjs comprobar
```

El frontend propio ocupa 3015 por defecto, Check-in 3005; la IP/dominio público se configura al instalar. `APP_ORIGIN` debe ser el origen real del navegador. Cámara remota requiere HTTPS. Para no depender de cámara, el flujo principal también admite ingreso manual por ID de entrada y evento reales.

## Flujo principal y cuentas

Iniciar sesión STAFF -> obtener ticket emitido por Entradas -> escanear o ingresar sus IDs -> acceso autorizado -> asistencia persistida -> reintento rechazado. Auth publica la cuenta QA `staff1@ticketu.test`; requisitos de seed y contraseña QA están referenciados en `INSTALACION.md`. Check-in no crea cuentas de Auth ni se asume que existan en toda instalación.

## Alcance de la evaluación

| Ítem | Preparación de esta rama | Comprobación pendiente |
|---|---|---|
| AU1 | Sesión real y autorización STAFF; rechazos sin cookie, token inválido y rol distinto | Ejecución con usuarios de Auth en workstation |
| GW1 | Tickets recibidos por Gateway, trazas y consultas SQL; consulta de respaldo por Gateway | Emitir desde Entradas instalado y comprobar las trazas de ambas llamadas |
| BR1 | Publicador heredado conservado; no se amplía por decisión de alcance solicitada | No corresponde para nuestro servicio |

La pauta incluye **tres tipos** de integración. La decisión de no ampliar el broker no lo elimina de la rúbrica. Este README no presenta BR1 como logrado ni sustituye la revisión en workstation.

La pauta proporcionada fija entrega del enlace el **18 de noviembre de 2026 a las 23:59**, instalación/verificación el **19 de noviembre** y correcciones hasta el **19 de noviembre a las 23:59**. La evaluación no incluye presentación: la versión final debe quedar instalada y funcional, y el ayudante debe poder revisar las evidencias sin el equipo presente. Confirmar cualquier cambio de calendario con el curso.

## Pruebas y límites

```powershell
npm.cmd ci --prefix backend
npm.cmd test --prefix backend
npm.cmd ci --prefix frontend
npm.cmd run build --prefix frontend
```

Las pruebas automatizadas usan también proveedores simulados y SQLite. La prueba MySQL real es opcional y requiere una base de pruebas. No habilitarla sobre los datos de demostración sin revisar su configuración. La herramienta `backend/scripts/workstation.mjs` verifica los servicios reales vía Gateway y no utiliza tokens reales fijos.

No se garantiza instalación remota sin verificar las credenciales, la red y el dominio del ambiente. No borrar volúmenes, ejecutar seeds de Auth ni reiniciar infraestructura de otros equipos desde este procedimiento.

Los archivos de entrega 2 y sus scripts se conservan como historial. Para esta entrega tienen prioridad el Compose de raíz y estos tres documentos; los ejemplos de URLs directas de entrega 2 no acreditan GW1.

## Validaciones locales realizadas el 18 de noviembre

- Compose resuelve tres servicios con el perfil frontend, MySQL sin puerto publicado y URLs de Gateway correctas. Se utilizaron valores ficticios para validar configuración, no credenciales del ambiente.
- Backend: 40 pruebas aprobadas, 0 fallidas y 1 prueba MySQL omitida.
- Frontend: compilación de producción con revisión de tipos aprobada; prueba del proxy de sesión/login/logout aprobada contra proveedor controlado.
- Enlaces locales y sintaxis de la herramienta de workstation verificados.
- Motor Docker no accesible en el entorno de preparación: no se afirma construcción de imágenes, arranque de contenedores ni prueba en workstation.
