import { readMeter, changeMeterTariff } from '@/lib/server/meter';
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (process.env.COURTYARD_LOCAL !== '1' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return Response.json({ error: '电表接入仅在本机服务中启用。' }, { status: 403 });
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  try { return Response.json(await readMeter(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ error: '电表读取失败，请检查本机配置或稍后重试。' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (process.env.COURTYARD_LOCAL !== '1' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  try {
    const input = await request.json() as { pricePerKwh?: unknown; roomName?: unknown };
    if (input.roomName !== '研发办公室' || typeof input.pricePerKwh !== 'number' || !Number.isFinite(input.pricePerKwh)
      || input.pricePerKwh < 0 || input.pricePerKwh > 100000) return Response.json({ error: '电价或房间无效' }, { status: 400 });
    return Response.json(await changeMeterTariff(input.pricePerKwh), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: '电价同步失败，请检查电表读数后重试；原计费价格保留。' }, { status: 503 }); }
}
