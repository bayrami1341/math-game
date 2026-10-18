// Seed دادهٔ واقع‌گرایانه برای داشبورد معلم — کارگاه ضرب
// اجرا: bun prisma/seed.ts
// داده‌ها deterministic هستند (RNG با seed ثابت) تا گزارش‌ها پایدار بمانند.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── RNG قطعی ───
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(140301);
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const chance = (p: number) => rnd() < p;

// ─── مدل ۹ لایهٔ عمق (هم‌راستا با v10.1) و استخر فاکتور هر لایه ───
const LAYER_POOL: Record<number, number[]> = {
  1: [2, 3],
  2: [2, 4],
  3: [5, 10],
  4: [5, 6],
  5: [6, 7],
  6: [7, 8],
  7: [8, 9],
  8: [6, 7, 8, 9],
  9: [2, 3, 4, 5, 6, 7, 8, 9],
};

const BUILDINGS: Record<number, string> = {
  1: 'station-power',
  2: 'station-power',
  3: 'station-power',
  4: 'station-antenna',
  5: 'station-antenna',
  6: 'station-antenna',
  7: 'station-launch',
  8: 'station-launch',
  9: 'station-launch',
};

// ─── پروفایل دانش‌آموزان کلاس ───
interface Profile {
  name: string;
  grade: number;
  hero: string;
  base: number; // نرخ خطای پایه
  weakFacts: string[]; // فاکتورهای ضعیف نرمال‌شده (مثل «7×8»)
  weakRate: number; // نرخ خطا در فاکتورهای ضعیف
  startLayer: number;
  sessions: number;
  trend: 'up' | 'flat' | 'down';
  today: boolean; // جلسهٔ امروز دارد؟
}

const PROFILES: Profile[] = [
  { name: 'آرش رضایی', grade: 4, hero: 'astronaut', base: 0.1, weakFacts: ['6×7', '7×7', '7×8', '7×9', '3×7'], weakRate: 0.5, startLayer: 3, sessions: 13, trend: 'up', today: true },
  { name: 'سارا محمدی', grade: 4, hero: 'scientist', base: 0.06, weakFacts: [], weakRate: 0, startLayer: 5, sessions: 13, trend: 'up', today: false },
  { name: 'امیر کاظمی', grade: 4, hero: 'pilot', base: 0.12, weakFacts: ['2×4', '3×4', '4×4', '4×5', '4×6'], weakRate: 0.5, startLayer: 2, sessions: 11, trend: 'flat', today: true },
  { name: 'نگار احمدی', grade: 5, hero: 'astronaut', base: 0.07, weakFacts: ['4×7', '5×7', '6×7', '7×8', '7×9'], weakRate: 0.45, startLayer: 4, sessions: 13, trend: 'up', today: true },
  { name: 'پارسا کریمی', grade: 5, hero: 'scientist', base: 0.05, weakFacts: [], weakRate: 0, startLayer: 6, sessions: 15, trend: 'up', today: false },
  { name: 'هستی موسوی', grade: 4, hero: 'pilot', base: 0.15, weakFacts: ['2×4', '3×4', '4×4', '4×5'], weakRate: 0.62, startLayer: 2, sessions: 11, trend: 'down', today: false },
  { name: 'کیان اکبری', grade: 5, hero: 'astronaut', base: 0.08, weakFacts: ['4×8', '6×8', '7×8', '8×8'], weakRate: 0.5, startLayer: 4, sessions: 12, trend: 'flat', today: true },
  { name: 'یاسنا صادقی', grade: 4, hero: 'scientist', base: 0.09, weakFacts: ['3×6', '4×6', '6×6', '6×7'], weakRate: 0.5, startLayer: 3, sessions: 12, trend: 'up', today: false },
  { name: 'سهیل مرادی', grade: 5, hero: 'pilot', base: 0.06, weakFacts: [], weakRate: 0, startLayer: 7, sessions: 15, trend: 'up', today: true },
  { name: 'درسا نادری', grade: 4, hero: 'astronaut', base: 0.11, weakFacts: ['3×6', '4×6', '5×6', '6×6', '6×7'], weakRate: 0.55, startLayer: 3, sessions: 12, trend: 'flat', today: false },
  { name: 'علی شریفی', grade: 5, hero: 'scientist', base: 0.08, weakFacts: ['3×6', '6×6', '6×7', '7×7', '7×8'], weakRate: 0.45, startLayer: 5, sessions: 13, trend: 'up', today: false },
  { name: 'باران قاسمی', grade: 4, hero: 'pilot', base: 0.22, weakFacts: ['2×2', '2×3', '2×4', '3×3', '3×4'], weakRate: 0.68, startLayer: 1, sessions: 9, trend: 'down', today: false },
];

// توزیع مضرب دوم با وزن بیشتر برای ۶ تا ۹ (مثل کاربرگ‌های واقعی)
const WEIGHTED_B = [2, 3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 9];

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  console.log('🧹 پاک‌سازی داده‌های قبلی ...');
  await prisma.questionResult.deleteMany();
  await prisma.session.deleteMany();
  await prisma.student.deleteMany();

  const now = Date.now();
  const startOfToday = new Date(new Date().setHours(9, 0, 0, 0)).getTime();

  let totalSessions = 0;
  let totalQuestions = 0;

  for (const p of PROFILES) {
    const student = await prisma.student.create({
      data: { name: p.name, grade: p.grade, hero: p.hero },
    });

    // پخش جلسات روی ۱۸ روز گذشته (جدیدترین جلسهٔ غیرامروزی: ۲ تا ۳ روز پیش)
    const dayOffsets: number[] = [];
    const usable = p.sessions - (p.today ? 1 : 0);
    for (let k = 0; k < usable; k++) {
      const base = 2 + Math.round((14 * k) / Math.max(1, usable - 1));
      dayOffsets.push(Math.min(17, base + randInt(0, 1)));
    }
    if (p.today) dayOffsets.push(0);
    dayOffsets.sort((a, b) => b - a); // از قدیمی به جدید

    let layer = p.startLayer;
    let sinceAdvance = 0;

    // مجموعهٔ فاکتورهای ضعیف + نقشهٔ شریک هر جدول (برای تمرکز سؤال‌ها روی گلوگاه)
    const weakSet = new Set(p.weakFacts);
    const partners = new Map<number, number[]>();
    for (const wf of p.weakFacts) {
      const [x, y] = wf.split('×').map(Number);
      if (x >= 2 && x <= 12) {
        const arr = [...(partners.get(x) ?? []), y];
        partners.set(x, [...new Set(arr)]);
      }
      if (y >= 2 && y <= 12) {
        const arr = [...(partners.get(y) ?? []), x];
        partners.set(y, [...new Set(arr)]);
      }
    }

    for (let s = 0; s < dayOffsets.length; s++) {
      const dayOffset = dayOffsets[s];
      const progress = s / Math.max(1, dayOffsets.length - 1); // 0..1
      const createdAt = new Date(startOfToday - dayOffset * DAY + randInt(0, 5) * 60 * 60 * 1000 + randInt(0, 59) * 60 * 1000);

      // ۱۰ سؤال از استخر لایهٔ جاری
      const pool = LAYER_POOL[layer] ?? [2, 3, 4, 5, 6, 7, 8, 9];
      const results: { a: number; b: number; correct: boolean; timeSec: number }[] = [];
      for (let q = 0; q < 10; q++) {
        const table = pool[randInt(0, pool.length - 1)];
        let a = table;
        let b: number;
        if (partners.has(table) && chance(0.6)) {
          const ps = partners.get(table)!;
          b = ps[randInt(0, ps.length - 1)];
        } else if (table === 10) {
          b = randInt(2, 9);
        } else {
          b = WEIGHTED_B[randInt(0, WEIGHTED_B.length - 1)];
        }
        if (chance(0.25)) [a, b] = [b, a]; // تمرین جابه‌جایی

        // نرخ خطا: فاکتور ضعیف یا پایه (با روند بهبود برای trend=up)
        const improving = p.trend === 'up' ? 0.35 * progress : p.trend === 'down' ? -0.2 * progress : 0;
        const nx = Math.min(a, b);
        const ny = Math.max(a, b);
        const isWeak = weakSet.has(`${nx}×${ny}`);
        let errorRate = isWeak ? p.weakRate : p.base;
        errorRate = Math.max(0.02, Math.min(0.85, errorRate - improving * (isWeak ? 0.5 : 1)));
        const correct = !chance(errorRate);

        const timeSec = correct ? 2.5 + rnd() * 5 : 6 + rnd() * 8;
        results.push({ a, b, correct, timeSec: Math.round(timeSec * 10) / 10 });
      }

      const total = results.length;
      const correct = results.filter((r) => r.correct).length;
      const durationSec = Math.round(results.reduce((s, r) => s + r.timeSec, 0));

      await prisma.session.create({
        data: {
          studentId: student.id,
          buildingId: BUILDINGS[layer] ?? 'station-power',
          layer,
          mode: 'station',
          total,
          correct,
          durationSec,
          createdAt,
          results: {
            create: results.map((r) => ({
              studentId: student.id,
              a: r.a,
              b: r.b,
              correct: r.correct,
              timeSec: r.timeSec,
              layer,
              createdAt,
            })),
          },
        },
      });
      totalSessions++;
      totalQuestions += total;

      // پیشرفت لایه: قوی‌ها هر ۴ جلسه، متوسط هر ۵، ضعیف هر ۷ (و سقف پایین‌تر)
      sinceAdvance++;
      const advanceEvery = p.trend === 'up' ? 4 : p.trend === 'flat' ? 5 : 7;
      const cap = p.trend === 'down' ? p.startLayer + 1 : 9;
      if (sinceAdvance >= advanceEvery && layer < cap) {
        layer++;
        sinceAdvance = 0;
      }
    }
  }

  const students = await prisma.student.count();
  console.log(`✅ Seed کامل شد:`);
  console.log(`   دانش‌آموزان: ${students}`);
  console.log(`   جلسات: ${totalSessions}`);
  console.log(`   سؤال‌ها: ${totalQuestions}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
