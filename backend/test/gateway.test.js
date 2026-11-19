import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { consultar_entrada } from '../src/integrations.js';

test('Entradas usa Gateway configurado y ruta publica; no cae a URL directa', async t => {
  const keys = ['API_GATEWAY_URL', 'ENTRADAS_SERVICE_URL', 'ENTRADAS_DETAIL_PATH'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  let calls = 0;
  let status = 200;
  const gateway = createServer((req, res) => {
    calls++;
    assert.equal(req.url, '/api/entradas/tk-demo/detalle');
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id_entrada:'tk-demo', id_evento:'ev-demo', id_usuario:'usuario', nombre_usuario:'Demo', estado_entrada:'EMITIDA' }));
  });
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve));
    for (const k of keys) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k]; }
  });
  process.env.API_GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.ENTRADAS_SERVICE_URL = 'http://127.0.0.1:1';
  process.env.ENTRADAS_DETAIL_PATH = '/api/entradas/{id}/detalle';
  assert.equal((await consultar_entrada('tk-demo')).id_evento, 'ev-demo');
  status = 404;
  assert.equal(await consultar_entrada('tk-demo'), null);
  status = 502;
  await assert.rejects(consultar_entrada('tk-demo'), error => error.codigo === 'ENTRADAS_UNAVAILABLE');
  assert.equal(calls, 3);
});
