// Comprobaciones reales: no usa localhost, no genera sesiones ni imprime secretos.
import { randomUUID } from 'node:crypto';
const base = process.env.API_GATEWAY_URL?.replace(/\/$/, '');
if (!base) throw new Error('Configura API_GATEWAY_URL.');
async function call(path, body, cookie) {
  const requestId = randomUUID();
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': requestId, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: 'Respuesta no JSON' }; }
  console.log(JSON.stringify({ fecha: new Date().toISOString(), path, status: res.status, requestId, respuesta: data }));
  return { status: res.status, data };
}
const [mode = 'comprobar', id] = process.argv.slice(2);
if (mode === 'comprobar') {
  for (const path of ['/health', '/api/checkin/health', '/api/auth/.well-known/jwks.json']) {
    const r = await call(path); if (r.status !== 200) process.exitCode = 1;
  }
} else if (mode === 'errores') {
  const cases = [
    ['/api/checkin/validaciones', {}, undefined, 401, 'SESSION_REQUIRED'],
    ['/api/checkin/validaciones', {}, 'jwt=token.invalido.firmamala', 401, 'INVALID_SESSION'],
    ['/api/checkin/asistencia', {}, undefined, 400, 'INVALID_REQUEST'],
    ['/api/checkin/ruta-inexistente', undefined, undefined, 404, 'ROUTE_NOT_FOUND'],
  ];
  for (const [path, body, cookie, expected, code] of cases) {
    const r = await call(path, body, cookie);
    if (r.status !== expected || r.data.error?.code !== code) process.exitCode = 1;
  }
} else if (mode === 'eventos') {
  const r = await call('/api/entradas/eventos'); if (r.status !== 200) process.exitCode = 1;
} else if (mode === 'emitir') {
  if (!id) throw new Error('Uso: emitir ID_EVENTO_REAL (debe estar publicado y tener stock).');
  const usuarioId = randomUUID();
  const r = await call('/api/entradas/emision-directa', {id_evento:id,id_usuario:usuarioId,nombre_comprador:'QA Check-in Entrega 3',correo_comprador:'qa-checkin@example.test',cantidad_entradas:1,precio_final:0});
  console.log(JSON.stringify({usuarioId,eventoId:id}));
  if (r.status !== 200 || r.data.registradoEnCheckin !== true) process.exitCode = 1;
} else {
  throw new Error('Modos: comprobar, errores, eventos, emitir ID_EVENTO_REAL.');
}
