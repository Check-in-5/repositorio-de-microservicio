import { error_api } from './errors.js';

async function consultar(base, ruta, clave, servicio, cookie) {
  try {
    const respuesta = await fetch(`${base.replace(/\/$/, '')}${ruta}`, {
      headers: { Accept: 'application/json', ...(clave ? { 'x-api-key': clave } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      signal: AbortSignal.timeout(3000), redirect: 'error', cache: 'no-store',
    });
    if (respuesta.status === 404) return null;
    if (servicio === 'PANEL' && [401, 403].includes(respuesta.status)) throw new error_api(respuesta.status, 'PANEL_FORBIDDEN', 'Panel rechazó la sesión del operador.');
    if (!respuesta.ok) throw new Error('Respuesta no disponible');
    try {
      const datos = await respuesta.json();
      if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Objeto esperado');
      return datos;
    } catch {
      throw new error_api(502, servicio + '_INVALID_RESPONSE', 'Respuesta JSON incompatible del proveedor.');
    }
  } catch (error) {
    if (error instanceof error_api) throw error;
    throw new error_api(503, `${servicio}_UNAVAILABLE`, `No se pudo consultar ${servicio}.`);
  }
}
const texto = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && v.trim() === v;

export async function consultar_entrada(id) {
  const base = process.env.API_GATEWAY_URL || process.env.ENTRADAS_SERVICE_URL;
  if (!base) return null;
  const ruta = (process.env.ENTRADAS_DETAIL_PATH || '/api/v1/entradas/{id}/detalle').replace('{id}', encodeURIComponent(id));
  const datos = await consultar(base, ruta, process.env.ENTRADAS_API_KEY, 'ENTRADAS');
  if (datos === null) return null;
  const id_remoto = datos?.id_entrada ?? datos?.id_ticket;
  const usuario = datos?.id_usuario ?? datos?.usuario?.id_usuario;
  if (id_remoto !== id || !texto(datos?.id_evento, 128) || !texto(usuario, 255) || !texto(datos?.nombre_usuario, 200)) {
    throw new error_api(502, 'ENTRADAS_INVALID_RESPONSE', 'Entradas no entregó la identidad y el evento del ticket en el formato esperado.');
  }
  if (datos.estado_entrada !== 'EMITIDA') throw new error_api(409, 'TICKET_NOT_ACTIVE', 'La entrada no está emitida o fue anulada.');
  return { id_entrada: id, id_evento: datos.id_evento, id_usuario: usuario, nombre_usuario: datos.nombre_usuario };
}

export async function consultar_evento(id, cookie) {
  if (!process.env.PANEL_SERVICE_URL) return null;
  let datos;
  try {
    datos = await consultar(process.env.PANEL_SERVICE_URL, (process.env.PANEL_EVENT_PATH || '/api/v1/panel/eventos/{id}').replace('{id}', encodeURIComponent(id)), process.env.PANEL_API_KEY, 'PANEL', cookie);
  } catch (error) {
    // Modo autónomo del contrato Panel, únicamente si el despliegue lo habilita explícitamente.
    if (error.estado === 503 && process.env.PANEL_FAILURE_POLICY === 'allow') return null;
    throw error;
  }
  if (!datos || !texto(datos.estado_gestion, 50) || (datos.id_evento !== undefined && datos.id_evento !== id)) {
    throw new error_api(502, 'PANEL_INVALID_RESPONSE', 'Panel no entregó un estado válido para este evento.');
  }
  const evento = { estado_gestion: datos.estado_gestion };
  for (const campo of ['nombre_evento', 'direccion_evento', 'fecha_evento', 'hora_evento', 'hora_fin_evento']) {
    if (typeof datos[campo] === 'string') evento[campo] = datos[campo];
  }
  return evento;
}
