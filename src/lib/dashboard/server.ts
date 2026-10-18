// لودر و محاسبات سمت سرور داشبورد (فقط در API Routes استفاده شود)

import { db } from '@/lib/db';
import { computeLayerProgress, computeStudentFacts, daysAgo, type QRow, type SessRow } from './stats';
import { statusFromAccuracy } from './constants';
import type { StudentSummary } from './types';

export interface DashboardData {
  students: { id: string; name: string; grade: number; hero: string; createdAt: Date }[];
  sessions: SessRow[];
  questions: QRow[];
  studentsById: Map<string, { id: string; name: string }>;
}

export async function loadDashboardData(questionsSinceDays = 30): Promise<DashboardData> {
  const [students, sessions, questions] = await Promise.all([
    db.student.findMany({ orderBy: { name: 'asc' } }),
    db.session.findMany({ orderBy: { createdAt: 'desc' } }),
    db.questionResult.findMany({
      where: { createdAt: { gte: daysAgo(questionsSinceDays) } },
      select: { a: true, b: true, correct: true, studentId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  return {
    students,
    sessions,
    questions,
    studentsById: new Map(students.map((s) => [s.id, { id: s.id, name: s.name }])),
  };
}

export function groupSessionsByStudent(sessions: SessRow[]): Map<string, SessRow[]> {
  const map = new Map<string, SessRow[]>();
  for (const s of sessions) {
    const arr = map.get(s.studentId) ?? [];
    arr.push(s);
    map.set(s.studentId, arr);
  }
  return map;
}

function accuracyOf(sessions: SessRow[]): number | null {
  const total = sessions.reduce((sum, s) => sum + s.total, 0);
  if (total === 0) return null;
  const correct = sessions.reduce((sum, s) => sum + s.correct, 0);
  return correct / total;
}

export function buildStudentSummary(
  student: { id: string; name: string; grade: number; hero: string },
  sessions: SessRow[],
  allQuestions: QRow[]
): StudentSummary {
  const sorted = [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const currentLayer = sorted[0]?.layer ?? 1;
  const layers = computeLayerProgress(sessions);
  const masteredLayers = layers.filter((l) => l.mastered).length;

  const since7 = daysAgo(7).getTime();
  const recent = sorted.filter((s) => s.createdAt.getTime() >= since7);
  const accuracy7d = accuracyOf(recent);
  const overallAccuracy = accuracyOf(sessions);

  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    hero: student.hero,
    currentLayer,
    currentLayerName: layers.find((l) => l.isCurrent)?.name ?? `لایهٔ ${currentLayer}`,
    masteredLayers,
    progressPct: Math.round((masteredLayers / 9) * 100),
    accuracy7d,
    overallAccuracy,
    totalSessions: sessions.length,
    totalQuestions: sessions.reduce((sum, s) => sum + s.total, 0),
    lastActivity: sorted[0]?.createdAt.toISOString() ?? null,
    status: statusFromAccuracy(accuracy7d ?? overallAccuracy),
    weakestFact: computeStudentFacts(allQuestions, student.id)[0] ?? null,
  };
}

/** ترتیب نمایش: دانش‌آموزان نیازمند توجه اول */
export function sortStudents(list: StudentSummary[]): StudentSummary[] {
  const order: Record<string, number> = { critical: 0, practice: 1, good: 2, excellent: 3 };
  return [...list].sort((a, b) => {
    const d = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    if (d !== 0) return d;
    const aa = a.accuracy7d ?? a.overallAccuracy ?? 1;
    const bb = b.accuracy7d ?? b.overallAccuracy ?? 1;
    if (aa !== bb) return aa - bb;
    return a.name.localeCompare(b.name, 'fa');
  });
}
