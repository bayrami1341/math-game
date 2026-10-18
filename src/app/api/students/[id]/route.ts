// GET /api/students/[id] — جزئیات کامل یک دانش‌آموز

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildStudentSummary, loadDashboardData } from '@/lib/dashboard/server';
import { computeDiagnoses } from '@/lib/dashboard/diagnosis';
import { computeDailyTrend, computeLayerProgress, computeStudentFacts, computeTableHealth, daysAgo } from '@/lib/dashboard/stats';
import { TABLE_TIPS, faNum, faPercent, statusFromAccuracy } from '@/lib/dashboard/constants';
import { remedyForFact } from '@/lib/dashboard/remediation';
import { buildChainReport } from '@/lib/dashboard/chain-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const data = await loadDashboardData(30);
  const student = data.students.find((s) => s.id === id);
  if (!student) {
    return NextResponse.json({ error: 'دانش‌آموز یافت نشد' }, { status: 404 });
  }

  const sessions = data.sessions.filter((s) => s.studentId === id);
  const questions = data.questions.filter((q) => q.studentId === id);

  const summary = buildStudentSummary(student, sessions, data.questions);
  const layers = computeLayerProgress(sessions);
  const bottlenecks = computeStudentFacts(questions, id);

  // پیشنهادهای آموزشی
  const recommendations: string[] = [];
  const classTableError = new Map(computeTableHealth(data.questions).map((t) => [t.table, t.errorRate]));
  for (const f of bottlenecks.slice(0, 3)) {
    const refTable = [f.a, f.b].reduce((best, t) => ((classTableError.get(t) ?? 0) > (classTableError.get(best) ?? 0) ? t : best), f.a);
    const tip = TABLE_TIPS[refTable] ?? 'تمرین هدفمند با کشف الگو';
    recommendations.push(`فاکتور ${f.fact} (خطای ${faPercent(f.errorRate)}): ${tip}`);
  }
  const currentLayer = layers.find((l) => l.isCurrent);
  if (currentLayer && !currentLayer.mastered) {
    recommendations.push(`تسلط بر لایهٔ ${currentLayer.layer} — «${currentLayer.name}»: دقت آخرین جلسه ${faPercent(currentLayer.accuracy, 1)} است؛ حداقل ${faPercent(0.85)} لازم است.`);
  }

  // حلقهٔ گزارش ← اقدام: ماموریت درمانی بازی بر اساس ضعیف‌ترین فاکتور
  const weakestFact = bottlenecks[0] ?? null;
  const recommendedRemedy = weakestFact ? remedyForFact(weakestFact.a, weakestFact.b) : null;
  if (recommendedRemedy && weakestFact) {
    recommendations.push(
      `ماموریت درمانی پیشنهادی در بازی: «${recommendedRemedy.title}» در ${recommendedRemedy.sectorHint} — این ماموریت جدول‌های ${recommendedRemedy.tablesCovered.map((t) => faNum(t)).join('، ')} را تمرین می‌دهد.`
    );
  }
  const status = statusFromAccuracy(summary.accuracy7d ?? summary.overallAccuracy);
  if (status === 'critical') {
    recommendations.push('جلسهٔ کوتاه روزانه (۵ دقیقه) با بناکردهای لایهٔ جاری؛ از ساختمان‌های آسان برای بازیابی اعتماد شروع شود.');
  }
  if (summary.lastActivity) {
    const inactiveDays = Math.floor((Date.now() - new Date(summary.lastActivity).getTime()) / (24 * 3600 * 1000));
    if (inactiveDays >= 3) {
      recommendations.push(`${inactiveDays} روز از آخرین فعالیت گذشته است؛ یک جلسهٔ سبک برای بازگشت پیشنهاد کنید.`);
    }
  }

  // Task 11-a: تاریخچهٔ بازنویسی معلم (فقط‌الحاقی) — آخرین ۱۰ رکورد
  const [{ chain, replay }, overrideRows] = await Promise.all([
    buildChainReport(id),
    db.teacherOverride.findMany({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    student: summary,
    layers,
    trend: computeDailyTrend(questions, sessions, 14),
    bottlenecks,
    recommendations,
    recommendedRemedy,
    // لایهٔ بالینی: موتور ۱۲خطا (CEAP §7.3) + تاریخچهٔ بازنویسی معلم (§9.2)
    diagnoses: computeDiagnoses(questions),
    overrides: overrideRows.map((o) => ({
      id: o.id,
      originalCode: o.originalCode,
      overrideCode: o.overrideCode,
      note: o.note,
      createdAt: o.createdAt.toISOString(),
    })),
    chain: {
      ...chain,
      replayMatch: replay.replayMatch,
      mismatchedSessions: replay.mismatchedSessions,
    },
    recentSessions: sessions.slice(0, 6).map((s) => ({
      id: s.id,
      studentId: s.studentId,
      studentName: student.name,
      layer: s.layer,
      layerName: layers.find((l) => l.layer === s.layer)?.name ?? `لایهٔ ${s.layer}`,
      mode: s.mode,
      total: s.total,
      correct: s.correct,
      accuracy: s.total > 0 ? s.correct / s.total : 0,
      durationSec: s.durationSec,
      createdAt: s.createdAt.toISOString(),
    })),
  });
}
