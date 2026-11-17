import { NextResponse } from 'next/server';
// El registro de tickets pertenece a la comunicación Entradas → Check-in.
export async function POST() {
  return NextResponse.json({ error: { message: 'Operación exclusiva entre servicios.' } }, { status: 403 });
}
