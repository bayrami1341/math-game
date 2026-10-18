// GET /api/students — فهرست خلاصهٔ پیشرفت تک‌تک دانش‌آموزان

import { NextResponse } from 'next/server';
import { buildStudentSummary, groupSessionsByStudent, loadDashboardData, sortStudents } from '@/lib/dashboard/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await loadDashboardData(30);
  const byStudent = groupSessionsByStudent(data.sessions);
  const summaries = data.students.map((st) => buildStudentSummary(st, byStudent.get(st.id) ?? [], data.questions));
  return NextResponse.json({ students: sortStudents(summaries) });
}
