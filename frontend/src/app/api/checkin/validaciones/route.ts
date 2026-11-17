import { reenviar } from '@/lib/server-proxy';
export async function POST(request: Request) {
  return reenviar(request, process.env.CHECKIN_SERVICE_URL, '/api/checkin/validaciones');
}
