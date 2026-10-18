// POST /api/scan-paper — اسکن برگهٔ کاغذی دانش‌آموز با VLM و تبدیل به دادهٔ گلوگاه
// بدنه: { image: dataURL, studentId?: string, commit?: boolean }
// commit=false → فقط تحلیل (پیش‌نمایش) | commit=true → تحلیل + ثبت به‌عنوان جلسهٔ mode='paper'

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import type { FactStat, ScanPaperItem } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_CHARS = 8_000_000; // ~۶ مگابایت base64

const bodySchema = z.object({
  image: z.string().min(64).max(MAX_IMAGE_CHARS),
  studentId: z.string().min(1).max(64).optional(),
  commit: z.boolean().default(false),
});

const PROMPT = `تصویر یک برگهٔ تمرین ضربِ دانش‌آموز دبستانی است.
همهٔ مسئله‌های ضرب دوتایی (به شکل «a × b = پاسخ») را که روی برگه نوشته/چاپ شده استخراج کن.
فقط و فقط یک JSON معتبر با دقیقاً این ساختار برگردان، بدون هیچ متن اضافه یا بلوک کد:
{"items":[{"a":7,"b":8,"studentAnswer":56,"correct":true}],"unreadable":0,"notes":"یک جمله کوتاه فارسی دربارهٔ برگه"}
قوانین:
- a و b اعداد صحیح ۰ تا ۲۰ هستند (ترتیب عوامل مهم نیست).
- studentAnswer عددی است که دانش‌آموز نوشته؛ اگر پاسخی نوشته نشده null بگذار.
- correct را با محاسبهٔ دقیق a×b تعیین کن، نه به ظاهر دست‌خط اعتماد کن.
- هر مسئلهٔ ناخوانا یا مشکوک را در items نیاور و تعدادش را در unreadable بنویس.
- notes را حداکثر یک جملهٔ فارسی کوتاه بنویس.`;

let zaiInstance: Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>> | null = null;
async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/** استخراج tolerant JSON از پاسخ مدل (تحمل بلوک کد و متن اضافه) */
function extractJson(raw: string): { items?: unknown; unreadable?: unknown; notes?: unknown } | null {
  const cleaned = raw.replace(/```json/gi, '```').split('```').join('\n');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** درستی پاسخ را سرور بازمحاسبه می‌کند — به پرچم VLM اعتماد نمی‌شود */
function sanitizeItems(raw: unknown): { items: ScanPaperItem[]; unreadable: number } {
  const items: ScanPaperItem[] = [];
  let unreadable = 0;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (typeof row !== 'object' || row === null) continue;
      const r = row as Record<string, unknown>;
      const a = Number(r.a);
      const b = Number(r.b);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 20 || b > 20) {
        unreadable++;
        continue;
      }
      const ans = r.studentAnswer === null || r.studentAnswer === undefined ? null : Number(r.studentAnswer);
      const studentAnswer = ans !== null && Number.isInteger(ans) && ans >= 0 && ans <= 400 ? ans : null;
      items.push({ a, b, studentAnswer, correct: studentAnswer !== null && studentAnswer === a * b });
    }
  }
  return { items, unreadable };
}

function factStatsOf(items: ScanPaperItem[]): FactStat[] {
  const map = new Map<string, FactStat>();
  for (const it of items) {
    const x = Math.min(it.a, it.b);
    const y = Math.max(it.a, it.b);
    if (x < 2 || y > 12) continue;
    const key = `${x}×${y}`;
    const f = map.get(key) ?? { a: x, b: y, fact: key, attempts: 0, wrong: 0, errorRate: 0 };
    f.attempts++;
    if (!it.correct) f.wrong++;
    f.errorRate = f.attempts > 0 ? f.wrong / f.attempts : 0;
    map.set(key, f);
  }
  return [...map.values()].filter((f) => f.wrong > 0).sort((p, q) => q.errorRate - p.errorRate || q.attempts - p.attempts);
}

// نگاشت جدول → لایهٔ عمق (برای برچسب لایهٔ جلسهٔ paper) — هم‌راستا با DEPTH_LAYERS داشبورد
const TABLE_TO_LAYER: Record<number, number> = { 2: 2, 5: 3, 10: 3, 3: 4, 4: 4, 6: 5, 7: 5, 8: 6, 9: 7 };

function inferLayer(items: ScanPaperItem[]): number {
  const votes = new Map<number, number>();
  for (const it of items) {
    if (it.correct) continue;
    for (const t of [it.a, it.b]) {
      const layer = TABLE_TO_LAYER[t];
      if (layer) votes.set(layer, (votes.get(layer) ?? 0) + 1);
    }
  }
  let best = 4;
  let bestCount = 0;
  for (const [layer, count] of votes) {
    if (count > bestCount) {
      best = layer;
      bestCount = count;
    }
  }
  return best;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'بدنهٔ JSON نامعتبر است' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'تصویر یا پارامترها نامعتبر است', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { image, studentId, commit } = parsed.data;

  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(image)) {
    return NextResponse.json({ ok: false, error: 'تصویر باید Data URL با فرمت PNG/JPEG/WebP/GIF باشد' }, { status: 400 });
  }

  // تحلیل با VLM
  let raw: string;
  try {
    const zai = await getZAI();
    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });
    raw = completion.choices[0]?.message?.content ?? '';
  } catch (error) {
    console.error('[scan-paper] VLM error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: 'تحلیل تصویر ناموفق بود؛ دوباره تلاش کنید' }, { status: 502 });
  }

  const json = extractJson(raw);
  if (!json) {
    console.error('[scan-paper] unparsable VLM output:', raw.slice(0, 300));
    return NextResponse.json({ ok: false, error: 'پاسخ مدل قابل تفسیر نبود؛ دوباره تلاش کنید' }, { status: 502 });
  }

  const { items, unreadable } = sanitizeItems(json.items);
  const factStats = factStatsOf(items);
  const total = items.length;
  const correct = items.filter((i) => i.correct).length;
  const notes = typeof json.notes === 'string' ? json.notes.slice(0, 300) : '';

  // ثبت: فقط با studentId صریح — دادهٔ کاغذی وارد همان موتور گلوگاه می‌شود (mode='paper')
  let sessionId: string | undefined;
  let stored = 0;
  if (commit && studentId && items.length > 0) {
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return NextResponse.json({ ok: false, error: 'دانش‌آموز یافت نشد' }, { status: 404 });
    }
    const layer = inferLayer(items);
    const session = await db.session.create({
      data: {
        studentId,
        buildingId: 'paper-scan',
        layer,
        mode: 'paper',
        total,
        correct,
        durationSec: 0,
        results: {
          create: items.map((r) => ({
            studentId,
            a: r.a,
            b: r.b,
            correct: r.correct,
            timeSec: 0,
            layer,
          })),
        },
      },
    });
    sessionId = session.id;
    stored = items.length;
  }

  return NextResponse.json({ ok: true, items, unreadable, notes, factStats, total, correct, sessionId, stored });
}
