// GET /api/leaderboard — جدول قهرمانان کلاس بر پایهٔ دادهٔ جلسات ثبت‌شده

import { NextResponse } from 'next/server';
import { buildStudentSummary, groupSessionsByStudent, loadDashboardData } from '@/lib/dashboard/server';

export const dynamic = 'force-dynamic';

interface LeaderRow {
  rank: number;
  id: string;
  name: string;
  hero: string;
  progressPct: number;
  overallAccuracy: number | null;
  totalSessions: number;
  totalQuestions: number;
  lastActivity: string | null;
}

export async function GET() {
  const data = await loadDashboardData(30);
  const byStudent = groupSessionsByStudent(data.sessions);
  const rows = data.students.map((st) => buildStudentSummary(st, byStudent.get(st.id) ?? [], data.questions));

  // رتبه‌بندی: پیشرفت ایستگاه ← دقت کل ← تعداد سؤال
  const sorted = [...rows].sort(
    (a, b) =>
      b.progressPct - a.progressPct ||
      (b.overallAccuracy ?? -1) - (a.overallAccuracy ?? -1) ||
      b.totalQuestions - a.totalQuestions,
  );

  const leaders: LeaderRow[] = sorted.slice(0, 50).map((s, i) => ({
    rank: i + 1,
    id: s.id,
    name: s.name,
    hero: s.hero,
    progressPct: s.progressPct,
    overallAccuracy: s.overallAccuracy,
    totalSessions: s.totalSessions,
    totalQuestions: s.totalQuestions,
    lastActivity: s.lastActivity,
  }));

  return NextResponse.json({ leaders, totalStudents: data.students.length });
}
