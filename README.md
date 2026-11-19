# Check-in — TicketU

Entrega 3: módulo Check-in para la plataforma compartida de workstation.

- [Instalación y flujo principal](INSTALACION.md)
- [Declaración de integraciones y cómo verificarlas](INTEGRACIONES.md)
- [README de la entrega 3](README_ENTREGA_3.md)
- [Contrato OpenAPI](backend/docs/openapi.json)

Usar el docker-compose.yml de la raíz. Instala Check-in y MySQL privado; el perfil frontend habilita la interfaz propia. Auth, API Gateway, Entradas y Panel pertenecen a los otros equipos y deben estar disponibles en la red plataforma-eventos-net.

El Gateway apunta a http://checkin-service:3005. Entradas envía los tickets al Gateway; la consulta de respaldo de Check-in también usa el Gateway configurado. El backend autentica operadores STAFF con Auth real.

El broker histórico no se amplía en este alcance y BR1 no se declara cumplido ni exento. La instalación en workstation y las credenciales deben comprobarse siguiendo INSTALACION.md.

La carpeta frontend es la variante propia con proxy Next.js; no es una copia completa del frontend unificado FWizav/FrontendTitec. Incluye los arreglos del lector QR.

## Desarrollo

```powershell
npm.cmd ci --prefix backend
npm.cmd test --prefix backend
npm.cmd ci --prefix frontend
npm.cmd run build --prefix frontend
```

## Historial

[README_ENTREGA_2.md](README_ENTREGA_2.md) y scripts/entrega-2 conservan la entrega anterior. Sus URLs directas y el stack TITEC-V2 no son las instrucciones de instalación de la entrega 3.
