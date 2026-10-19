// GET /api/overview — نمای کلی کلاس (KPI + روند + فعالیت اخیر)

import { NextResponse } from 'next/server';
import {
  buildStudentSummary,
  groupSessionsByStudent,
  loadDashboardData,
} from '@/lib/dashboard/server';
import { computeBottlenecks, computeDailyTrend, computeTableHealth, startOfToday } from '@/lib/dashboard/stats';
import { layerName, statusFromAccuracy } from '@/lib/dashboard/constants';
import type { Kpis, SessionSummary } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadDashboardData(30);
  const { students, sessions, questions, studentsById } = data;

  const todayStart = startOfToday().getTime();
  const sessionsToday = sessions.filter((s) => s.createdAt.getTime() >= todayStart).length;

  const since7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSessions = sessions.filter((s) => s.createdAt.getTime() >= since7);
  const totalQ7 = recentSessions.reduce((sum, s) => sum + s.total, 0);
  const accuracy7d = totalQ7 > 0 ? recentSessions.reduce((sum, s) => sum + s.correct, 0) / totalQ7 : null;

  const bottlenecks = computeBottlenecks(questions, studentsById);

  const byStudent = groupSessionsByStudent(sessions);
  const summaries = students.map((st) => buildStudentSummary(st, byStudent.get(st.id) ?? [], questions));
  const attentionStudents = summaries.filter((s) => {
    const status = statusFromAccuracy(s.accuracy7d ?? s.overallAccuracy);
    return status === 'practice' || status === 'critical';
  }).length;

  const kpis: Kpis = {
    students: students.length,
    sessionsToday,
    accuracy7d,
    activeBottlenecks: bottlenecks.length,
    attentionStudents,
    totalQuestions: sessions.reduce((sum, s) => sum + s.total, 0),
    totalSessions: sessions.length,
  };

  const recent: SessionSummary[] = sessions.slice(0, 8).map((s) => ({
    id: s.id,
    studentId: s.studentId,
    studentName: studentsById.get(s.studentId)?.name ?? 'دانش‌آموز',
    layer: s.layer,
    layerName: layerName(s.layer),
    mode: s.mode,
    total: s.total,
    correct: s.correct,
    accuracy: s.total > 0 ? s.correct / s.total : 0,
    durationSec: s.durationSec,
    createdAt: s.createdAt.toISOString(),
  }));

  const heroCount = new Map<string, number>();
  for (const st of students) heroCount.set(st.hero, (heroCount.get(st.hero) ?? 0) + 1);

  return NextResponse.json({
    kpis,
    trend: computeDailyTrend(questions, sessions, 14),
    recentSessions: recent,
    heroDistribution: [...heroCount.entries()].map(([hero, count]) => ({ hero, count })),
    tableHealth: computeTableHealth(questions),
    generatedAt: new Date().toISOString(),
  });
}
