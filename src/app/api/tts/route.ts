// POST /api/tts — تبدیل متن فارسی به گفتار (WAV) برای خواندن سؤال‌های بازی
// بدنه: { text: string (≤۳۰۰ نویسه), speed?: number (۰٫۵ تا ۲) }

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_LEN = 300;
const CACHE_LIMIT = 40;

// کش درون‌حافظه‌ای: سؤال‌های تکراری بدون فراخوانی مجدد سرویس صوتی پاسخ می‌گیرند
const audioCache = new Map<string, Uint8Array>();

let zaiInstance: Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(req: Request) {
  let body: { text?: unknown; speed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'بدنهٔ JSON نامعتبر است' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  if (!text || text.length > MAX_LEN) {
    return NextResponse.json({ ok: false, error: `متن باید بین ۱ تا ${MAX_LEN} نویسه باشد` }, { status: 400 });
  }

  let speed = typeof body.speed === 'number' ? body.speed : 1.0;
  if (!Number.isFinite(speed)) speed = 1.0;
  speed = Math.min(2.0, Math.max(0.5, speed));

  const cacheKey = `${text}|${speed}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-Audio-Cache': 'hit' },
    });
  }

  try {
    const zai = await getZAI();
    const response = await zai.audio.tts.create({
      input: text,
      voice: 'tongtong',
      speed,
      response_format: 'wav',
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    if (buffer.length === 0) {
      return NextResponse.json({ ok: false, error: 'تولید صدا ناموفق بود' }, { status: 502 });
    }

    if (audioCache.size >= CACHE_LIMIT) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey !== undefined) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, buffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store', 'X-Audio-Cache': 'miss' },
    });
  } catch (error) {
    console.error('[tts] error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'سرویس گفتار در دسترس نیست' }, { status: 502 });
  }
}
