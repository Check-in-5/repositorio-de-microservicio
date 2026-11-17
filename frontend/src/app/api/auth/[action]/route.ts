import { NextResponse } from 'next/server';
import { reenviar } from '@/lib/server-proxy';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: { action: string } }) {
 if (!['login','logout','register','recover','validar-token','reset-password','update-password','cambiar-clave'].includes(params.action)) return NextResponse.json({message:'Ruta no encontrada'}, {status:404});
 return reenviar(request,process.env.AUTH_SERVICE_URL,'/api/auth/'+params.action,true);
}
export async function GET(request: Request, { params }: { params: { action: string } }) {
 if(params.action!=='validar-sesion') return NextResponse.json({message:'Ruta no encontrada'},{status:404});
 return reenviar(request,process.env.AUTH_SERVICE_URL,'/api/auth/validar-sesion');
}
