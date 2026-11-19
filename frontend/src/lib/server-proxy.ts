import 'server-only';
import { NextResponse } from 'next/server';

export function validarOrigen(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const esperado = process.env.APP_ORIGIN || new URL(request.url).origin;
  return origin === esperado;
}

export async function exigirPersonal(request: Request): Promise<NextResponse | null> {
  const base = process.env.AUTH_SERVICE_URL;
  if (!base) return NextResponse.json({ error: { message: 'Auth no configurado.' } }, { status: 503 });
  const cookie = request.headers.get('cookie');
  if (!cookie) return NextResponse.json({ error: { message: 'Debes iniciar sesión.' } }, { status: 401 });
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/auth/validar-sesion`, {
      headers: { Cookie: cookie }, cache: 'no-store', signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    if (res.status === 401) return NextResponse.json({ error: { message: 'Sesión inválida.' } }, { status: 401 });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.valido !== true || !data.usuario?.rol) throw new Error();
    const roles = (process.env.CHECKIN_ALLOWED_ROLES || 'STAFF').split(',').map(rol => rol.trim().toLowerCase());
    if (!roles.includes(String(data.usuario.rol).toLowerCase())) return NextResponse.json({ error: { message: 'Acceso restringido.' } }, { status: 403 });
    return null;
  } catch { return NextResponse.json({ error: { message: 'No se pudo verificar la sesión.' } }, { status: 503 }); }
}

export async function reenviar(request: Request, base: string | undefined, path: string, copiarCookie = false) {
  if (request.method !== 'GET' && !validarOrigen(request)) {
    return NextResponse.json({ error: { message: 'Origen no permitido.' } }, { status: 403 });
  }
  if (!base) return NextResponse.json({ error: { message: 'Servicio no configurado.' } }, { status: 503 });
  try {
    const headers = new Headers({ Accept: 'application/json' });
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('Cookie', cookie);
    let body: string | undefined;
    if (request.method !== 'GET') {
      try { body = JSON.stringify(await request.json()); }
      catch { return NextResponse.json({ error: { message: 'JSON inválido.' } }, { status: 400 }); }
      headers.set('Content-Type', 'application/json');
    }
    const upstream = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: request.method, headers, body, cache: 'no-store',
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    const response = new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
    });
    if (copiarCookie) {
      for (const cookie of upstream.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);
    }
    return response;
  } catch {
    return NextResponse.json({ error: { message: 'Servicio no disponible. Intenta nuevamente.' } }, { status: 503 });
  }
}
