const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('Next producción: cookie, login/logout, guard de página y protección de origen', { timeout: 30000 }, async () => {
  let rol = 'staff';
  let consultas = 0;
  const upstream = createServer((req,res) => {
    consultas++;
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/auth/login') {
      let body = ''; req.on('data', b => body += b); req.on('end', () => {
        assert.equal(JSON.parse(body).admin, true);
        res.setHeader('Set-Cookie', 'jwt=prueba; Path=/; HttpOnly; SameSite=Strict');
        res.end(JSON.stringify({ message: 'OK' }));
      }); return;
    }
    if (req.url === '/api/auth/logout') {
      res.setHeader('Set-Cookie', 'jwt=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict'); res.end('{}'); return;
    }
    if (req.headers.cookie !== 'jwt=prueba') { res.writeHead(401).end('{}'); return; }
    if (req.url === '/api/auth/validar-sesion') {
      if (rol === 'revocada') { res.writeHead(401).end('{}'); return; }
      res.end(JSON.stringify({ valido:true, usuario: { id_usuario:'staff-1', nombre_completo:'Personal de prueba', rol } })); return;
    }
    res.end(JSON.stringify({ valido:true, motivo:'TICKET_FOUND' }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const reserva = createServer(); await new Promise(resolve => reserva.listen(0, '127.0.0.1', resolve));
  const port = reserva.address().port; await new Promise(resolve => reserva.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const urlUpstream = `http://127.0.0.1:${upstream.address().port}`;
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED:'1', APP_ORIGIN:base, AUTH_SERVICE_URL:urlUpstream, CHECKIN_SERVICE_URL:urlUpstream },
    stdio: ['ignore','pipe','pipe'],
  });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  const post = (path, cookie = '', origin = base) => fetch(base + path, {
    method:'POST', headers:{ Origin:origin, Cookie:cookie, 'Content-Type':'application/json' },
    body:JSON.stringify({ email:'staff@example.test', password:'solo-prueba', admin:true }), redirect:'manual',
  });
  try {
    let ready = false;
    for (let i=0;i<100;i++) {
      try { const res = await fetch(base + '/admin/login'); if (res.ok) { ready = true; break; } } catch {}
      if (child.exitCode !== null) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, output);
    const loginHtml = await (await fetch(base + '/admin/login')).text();
    assert.match(loginHtml, /Organizadores y Staff/);
    assert.equal((await fetch(base + '/crear-clave?token=prueba')).status, 200);
    const legacy = await fetch(base + '/checkin/login', { redirect:'manual' });
    assert.match(legacy.headers.get('location'), /admin\/login/);
    assert.equal((await fetch(base + '/checkin', { redirect:'manual' })).status, 307);
    const before = consultas;
    assert.equal((await post('/api/auth/login', '', 'https://otro.test')).status, 403);
    assert.equal(consultas, before);
    const login = await post('/api/auth/login');
    assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie'), /jwt=prueba.*HttpOnly/);
    const sesion = await fetch(base + '/api/auth/validar-sesion', { headers:{ Cookie:'jwt=prueba' } });
    assert.equal(sesion.status, 200); assert.equal((await sesion.json()).usuario.rol, 'staff');
    assert.equal((await post('/api/checkin/validaciones','jwt=prueba')).status, 200);
    assert.equal((await post('/api/checkin/tickets','jwt=prueba')).status, 403);
    const pagina = await fetch(base + '/checkin', { headers:{ Cookie:'jwt=prueba' } });
    assert.match(await pagina.text(), /Cerrar sesi/);
    rol = 'usuario';
    const denegada = await fetch(base + '/checkin', { headers:{ Cookie:'jwt=prueba' } });
    assert.match(await denegada.text(), /Acceso restringido/);
    rol = 'revocada';
    assert.equal((await fetch(base + '/checkin', { headers:{ Cookie:'jwt=prueba' }, redirect:'manual' })).status, 307);
    const logout = await post('/api/auth/logout', 'jwt=prueba');
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
    assert.equal((await post('/api/checkin/validaciones','jwt=prueba')).status, 503);
  } finally {
    child.kill(); await once(child,'exit');
    if (upstream.listening) { upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve)); }
  }
});
