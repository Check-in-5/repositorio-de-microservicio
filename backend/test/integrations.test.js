import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { crear_app } from '../src/app.js';
import { crear_repositorio } from '../src/repository.js';

// Servidores HTTP controlados con los contratos observados en los repositorios proveedores.
test('integración HTTP: Auth, Entradas, Panel y contrato de asistencia para Reseñas', async t => {
  const anteriores = { ...process.env };
  let estadoPanel = 'PUBLICADO', statusPanel = 200, statusEntradas = 200;
  let remoto = { id_entrada: 'remote', id_evento: 'evento', id_usuario: 'comprador-uuid', nombre_usuario: 'Persona', estado_entrada: 'EMITIDA' };
  let llamadasPanel = 0;
  let panelInvalido = false;
  const upstream = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/internal/validar-sesion') {
      assert.equal(req.headers.cookie, 'jwt=staff');
      assert.equal(req.headers['x-api-key'], 'auth-secret');
      res.end(JSON.stringify({ valido: true, usuario: { id_usuario: 'operador-uuid', rol: 'staff' } }));
    } else if (req.url.startsWith('/api/v1/entradas/')) {
      assert.ok(req.url.endsWith('/detalle'));
      assert.equal(req.headers.cookie, undefined, 'No enviar la cookie a Entradas');
      res.writeHead(statusEntradas).end(JSON.stringify(remoto));
    } else if (req.url === '/api/v1/panel/eventos/evento') {
      llamadasPanel++;
      if (panelInvalido) { res.end('no-json'); return; }
      assert.equal(req.headers.cookie, 'jwt=staff');
      res.writeHead(statusPanel).end(JSON.stringify({ id_evento: 'evento', estado_gestion: estadoPanel, nombre_evento: 'Evento real' }));
    } else res.writeHead(404).end('{}');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${upstream.address().port}`;
  Object.assign(process.env, { AUTH_SERVICE_URL: base, AUTH_INTERNAL_API_KEY: 'auth-secret', ENTRADAS_SERVICE_URL: base, PANEL_SERVICE_URL: base, PANEL_FAILURE_POLICY: 'deny', CHECKIN_ALLOWED_ROLES: 'STAFF' });
  const repositorio = crear_repositorio(':memory:');
  const app = crear_app({ repositorio });
  const servidor = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const request = async (ruta, body, headers = {}) => {
    const res = await fetch(url + ruta, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const scan = id => request('/api/v1/checkin/validaciones', { id_entrada: id, id_evento: 'evento' }, { Cookie: 'jwt=staff' });
  const clave = {}; // Los endpoints entre servicios no requieren API key.
  const alta = async (id, usuario = 'comprador-uuid') => request('/api/v1/checkin/tickets', { id_entrada: id, id_evento: 'evento', nombre_usuario: 'Persona', ...(usuario ? { id_usuario: usuario } : {}), qr_data: { id_entrada: id, id_evento: 'evento' } }, clave);
  try {
    await t.test('validaciones exigen sesión; tickets y asistencia aceptan solicitudes sin API key', async () => {
      for (const prefijo of ['/api/checkin', '/api/v1/checkin']) {
        assert.equal((await request(prefijo + '/tickets', {})).status, 400);
        assert.equal((await request(prefijo + '/validaciones', {})).status, 401);
      }
      for (const prefijo of ['/api/checkin', '/api/v1/checkin', '/checkin']) {
        assert.equal((await request(prefijo + '/asistencia', {})).status, 400);
        assert.equal((await request(prefijo + '/asistencia?eventoId=evento&usuarioId=comprador-uuid')).status, 200);
      }
    });
    await t.test('QR estructurado, datos reales de Panel y asistencia del comprador', async () => {
      assert.equal((await alta('local')).status, 201);
      assert.deepEqual((await request('/checkin/asistencia?eventoId=evento&usuarioId=comprador-uuid', undefined, clave)).body, { asistio: false });
      const resultado = await scan('local');
      assert.equal(resultado.body.valido, true);
      assert.equal(resultado.body.evento.nombre_evento, 'Evento real');
      assert.equal(resultado.body.ticket.id_usuario, undefined);
      assert.deepEqual((await request('/api/checkin/asistencia', { eventoId: 'evento', usuarioId: 'comprador-uuid' }, clave)).body, { asistio: 'true' });
      assert.deepEqual((await request('/checkin/asistencia?eventoId=evento&usuarioId=comprador-uuid', undefined, clave)).body, { asistio: true });
      assert.deepEqual((await request('/api/checkin/asistencia', { eventoId: 'evento', usuarioId: 'operador-uuid' }, clave)).body, { asistio: 'false' });
      assert.equal((await scan('local')).body.motivo, 'TICKET_ALREADY_USED');
    });
    await t.test('ticket remoto se sincroniza sin inventar evento ni comprador', async () => {
      assert.equal((await scan('remote')).body.valido, true);
      assert.equal((await repositorio.buscar_por_id('remote')).id_usuario, 'comprador-uuid');
    });
    await t.test('ticket precargado sin usuario se completa desde Entradas', async () => {
      remoto.id_entrada = 'sin-usuario';
      assert.equal((await alta('sin-usuario', '')).status, 201);
      assert.equal((await scan('sin-usuario')).body.valido, true);
    });
    await t.test('evento remoto distinto se rechaza en la primera consulta', async () => {
      remoto.id_entrada = 'cruzado'; remoto.id_evento = 'otro';
      assert.equal((await scan('cruzado')).body.motivo, 'EVENT_MISMATCH');
      assert.equal(await repositorio.buscar_por_id('cruzado'), null);
      remoto.id_evento = 'evento';
    });
    await t.test('404, caída y contrato incompleto de Entradas son distintos', async () => {
      remoto.id_entrada = 'desconocido';
      statusEntradas = 404; assert.equal((await scan('desconocido')).body.motivo, 'TICKET_NOT_FOUND');
      statusEntradas = 503; assert.equal((await scan('desconocido')).status, 503);
      statusEntradas = 200; const idEvento = remoto.id_evento; delete remoto.id_evento;
      assert.equal((await scan('desconocido')).status, 502);
      remoto.id_evento = idEvento;
    });
    await t.test('entrada anulada no registra asistencia', async () => {
      remoto.id_entrada = 'anulada'; remoto.estado_entrada = 'ANULADA';
      assert.equal((await scan('anulada')).body.error.code, 'TICKET_NOT_ACTIVE');
      assert.equal(await repositorio.buscar_por_id('anulada'), null);
      remoto.estado_entrada = 'EMITIDA';
    });
    await t.test('Panel cancelado, finalizado o desconocido no consume el ticket', async () => {
      await alta('estado');
      for (const estado of ['CANCELADO', 'FINALIZADO', 'BORRADOR']) {
        estadoPanel = estado; assert.equal((await scan('estado')).body.valido, false);
      }
      estadoPanel = 'PUBLICADO'; assert.equal((await scan('estado')).body.valido, true);
    });
    await t.test('Panel indisponible bloquea por defecto; modo autónomo es explícito', async () => {
      await alta('panel-offline'); statusPanel = 503;
      assert.equal((await scan('panel-offline')).status, 503);
      process.env.PANEL_FAILURE_POLICY = 'allow';
      assert.equal((await scan('panel-offline')).body.valido, true);
      statusPanel = 200; process.env.PANEL_FAILURE_POLICY = 'deny';
    });
    await t.test('modo autónomo no omite rechazo de sesión de Panel', async () => {
      await alta('sesion-panel'); process.env.PANEL_FAILURE_POLICY = 'allow';
      for (const status of [401, 403]) { statusPanel = status; assert.equal((await scan('sesion-panel')).status, status); }
      statusPanel = 200; process.env.PANEL_FAILURE_POLICY = 'deny';
    });
    await t.test('Panel JSON malformado nunca habilita modo autónomo', async () => {
      await alta('panel-json'); panelInvalido = true; process.env.PANEL_FAILURE_POLICY = 'allow';
      assert.equal((await scan('panel-json')).status, 502);
      panelInvalido = false; process.env.PANEL_FAILURE_POLICY = 'deny';
      assert.equal((await scan('panel-json')).body.valido, true);
    });
    await t.test('asistencia valida parámetros y separa eventos', async () => {
      assert.equal((await request('/api/checkin/asistencia', { eventoId: ' ', usuarioId: 'comprador-uuid' }, clave)).status, 400);
      assert.deepEqual((await request('/api/checkin/asistencia', { eventoId: 'otro', usuarioId: 'comprador-uuid' }, clave)).body, { asistio: 'false' });
    });
    await t.test('ocho escaneos simultáneos producen un ingreso', async () => {
      await alta('concurrente');
      const resultados = await Promise.all(Array.from({ length: 8 }, () => scan('concurrente')));
      assert.equal(resultados.filter(r => r.body.valido).length, 1);
      assert.equal(resultados.filter(r => r.body.motivo === 'TICKET_ALREADY_USED').length, 7);
    });
    await t.test('finalizar no anuncia publicación sin broker', async () => {
      delete process.env.BROKER_URL;
      assert.equal((await request('/api/checkin/eventos/evento/finalizar', {}, clave)).body.error.code, 'BROKER_NOT_CONFIGURED');
    });
    assert.ok(llamadasPanel > 0);
  } finally {
    for (const server of [servidor, upstream]) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    repositorio.cerrar();
    for (const key of Object.keys(process.env)) if (!(key in anteriores)) delete process.env[key];
    Object.assign(process.env, anteriores);
  }
});
