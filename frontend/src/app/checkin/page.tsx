import CheckinPlaceholder from "@/modules/checkin/components/CheckinPlaceholder";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SessionActions from '@/modules/checkin/components/SessionActions';

// Página de "Check-in" — GRUPO 5
//
// Este archivo debería ser corto: solo importa y compone componentes
// desde src/modules/checkin/. Toda la lógica (llamadas a la API,
// estado, formularios, etc.) vive en esa carpeta, NO acá.

export const dynamic = 'force-dynamic';
export default async function CheckinPage() {
  const jwt = cookies().get('jwt')?.value;
  if (!jwt) redirect('/admin/login');
  let res: Response;
  try {
    if (!process.env.AUTH_SERVICE_URL) throw new Error();
    res = await fetch(`${process.env.AUTH_SERVICE_URL.replace(/\/$/, '')}/api/auth/validar-sesion`, {
      headers: { Cookie: `jwt=${jwt}` }, cache: 'no-store', signal: AbortSignal.timeout(5000), redirect: 'error',
    });
  } catch { return <main><h1>Check-in no disponible</h1><p>No se pudo verificar la sesión. Intenta nuevamente en unos momentos.</p></main>; }
  if (res.status === 401) redirect('/admin/login');
  let sesion;
  try { if (!res.ok) throw new Error(); sesion = await res.json(); if (sesion.valido !== true || !sesion.usuario?.rol) throw new Error(); }
  catch { return <main><p>No se pudo verificar la sesión con Auth.</p></main>; }
  const roles = (process.env.CHECKIN_ALLOWED_ROLES || 'STAFF').split(',').map(rol => rol.trim().toLowerCase());
  if (!roles.includes(String(sesion.usuario.rol).toLowerCase())) return <main><h1>Acceso restringido</h1><p>Tu cuenta no tiene permiso para operar Check-in.</p><SessionActions nombre={sesion.usuario.nombre_completo} /></main>;
  return <><SessionActions nombre={sesion.usuario.nombre_completo} /><CheckinPlaceholder /></>;
}
