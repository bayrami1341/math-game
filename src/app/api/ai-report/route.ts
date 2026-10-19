// POST /api/ai-report — تولید گزارش متنی هوشمند کلاس با LLM
// z-ai-web-dev-sdk فقط در بک‌اند استفاده می‌شود.

import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { buildStudentSummary, groupSessionsByStudent, loadDashboardData } from '@/lib/dashboard/server';
import { computeBottlenecks, computeDailyTrend, trendDirection } from '@/lib/dashboard/stats';
import { STATUS_CONFIG, faPercent } from '@/lib/dashboard/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SYSTEM_PROMPT = `تو مشاور ارشد آموزش ریاضی دبستان هستی و برای معلم کلاس گزارش کوتاه و کاربردی می‌نویسی.
قواعد:
- فارسی روان و حرفه‌ای؛ حداکثر ۲۵۰ کلمه.
- ساختار دقیق با چهار تیتر: «وضعیت کلی کلاس»، «گلوگاه‌های اصلی یادگیری»، «دانش‌آموزان نیازمند توجه»، «پیشنهاد جلسهٔ بعد».
- تیترها را با علامت ## در ابتدای خط بنویس و زیر هر تیتر ۱ تا ۳ جمله یا فهرست کوتاه بنویس.
- فقط از اعداد داده‌شده استفاده کن؛ اعداد را با ارقام فارسی بنویس.
- بدون سلام، بدون تعارف، بدون نتیجه‌گیری اضافی.`;

export async function POST() {
  try {
    const data = await loadDashboardData(30);
    const { students, sessions, questions, studentsById } = data;

    const bottlenecks = computeBottlenecks(questions, studentsById).slice(0, 5);

    const byStudent = groupSessionsByStudent(sessions);
    const attention = students
      .map((st) => buildStudentSummary(st, byStudent.get(st.id) ?? [], questions))
      .filter((s) => s.status === 'practice' || s.status === 'critical')
      .sort((a, b) => (a.accuracy7d ?? a.overallAccuracy ?? 1) - (b.accuracy7d ?? b.overallAccuracy ?? 1))
      .slice(0, 4)
      .map((s) => ({
        name: s.name,
        status: STATUS_CONFIG[s.status].label,
        accuracy7d: s.accuracy7d === null ? null : faPercent(s.accuracy7d, 1),
        currentLayer: s.currentLayerName,
        weakestFact: s.weakestFact ? `${s.weakestFact.fact} (خطای ${faPercent(s.weakestFact.errorRate)})` : null,
        lastActivity: s.lastActivity,
      }));

    const trend = computeDailyTrend(questions, sessions, 14);
    const overallTrend = trendDirection(questions);

    const payload = {
      kpis: {
        تعداد_دانش_آموزان: students.length,
        جلسات_هفتهٔ_گذشته: sessions.filter((s) => Date.now() - s.createdAt.getTime() <= 7 * 24 * 3600 * 1000).length,
        مجموع_سؤال‌ها: sessions.reduce((sum, s) => sum + s.total, 0),
      },
      روند_۲_هفته: trend.map((t) => ({ روز: t.label, دقت: t.accuracy === null ? null : faPercent(t.accuracy, 1) })),
      روند_کلی: {
        نیمهٔ_اول: overallTrend.first === null ? null : faPercent(overallTrend.first, 1),
        نیمهٔ_دوم: overallTrend.last === null ? null : faPercent(overallTrend.last, 1),
        تغییر: overallTrend.delta === null ? null : faPercent(overallTrend.delta, 1),
      },
      گلوگاه‌ها: bottlenecks.map((b) => ({
        فاکتور: b.fact,
        نرخ_خطا: faPercent(b.errorRate, 1),
        تعداد_تلاش: b.attempts,
        دانش_آموزان_درگیر: b.students,
        پیشنهاد_پایگاه: b.recommendation,
      })),
      دانش_آموزان_نیازمند_توجه: attention,
    };

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload, null, 2) },
      ],
      thinking: { type: 'disabled' },
    });

    const report = completion.choices[0]?.message?.content?.trim();
    if (!report) {
      return NextResponse.json({ error: 'پاسخ خالی از مدل زبانی' }, { status: 502 });
    }
    return NextResponse.json({ report });
  } catch (err) {
    console.error('ai-report error:', err);
    return NextResponse.json({ error: 'تولید گزارش هوشمند ناموفق بود' }, { status: 500 });
  }
}
