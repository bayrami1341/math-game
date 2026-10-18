// POST /api/assignments — معلم مأموریت درمانی به دانش‌آموز می‌دهد
// GET  /api/assignments — داشبورد (studentId) یا بازی (studentName) مأموریت‌ها را می‌خواند

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { SIDE_MISSION_REMEDIES, missionTitleOf } from '@/lib/dashboard/remediation';
import type { AssignmentItem, AssignmentsResponse } from '@/lib/dashboard/types';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  studentId: z.string().min(1).max(64),
  missionId: z.string().min(3).max(60),
  fact: z.string().max(20).optional(),
  note: z.string().max(300).optional(),
});

type AssignmentWithStudent = Prisma.AssignmentGetPayload<{ include: { student: true } }>;

function toItem(a: AssignmentWithStudent): AssignmentItem {
  return {
    id: a.id,
    studentId: a.studentId,
    studentName: a.student.name,
    missionId: a.missionId,
    missionTitle: missionTitleOf(a.missionId),
    fact: a.fact,
    note: a.note,
    status: (a.status as AssignmentItem['status']) ?? 'pending',
    sessionId: a.sessionId,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'بدنهٔ JSON نامعتبر است' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'اعتبارسنجی ناموفق', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (!SIDE_MISSION_REMEDIES[data.missionId]) {
    return NextResponse.json({ ok: false, error: 'شناسهٔ مأموریت شناخته‌شده نیست' }, { status: 400 });
  }

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) {
    return NextResponse.json({ ok: false, error: 'دانش‌آموز یافت نشد' }, { status: 404 });
  }

  // جلوگیری از اسپم: اگر همان مأموریت در انتظار انجام است، همان را برگردان
  const existingPending = await db.assignment.findFirst({
    where: { studentId: data.studentId, missionId: data.missionId, status: 'pending' },
    include: { student: true },
  });
  if (existingPending) {
    return NextResponse.json({ ok: true, duplicate: true, assignment: toItem(existingPending) }, { status: 200 });
  }

  const assignment = await db.assignment.create({
    data: {
      studentId: data.studentId,
      missionId: data.missionId,
      fact: data.fact,
      note: data.note,
    },
    include: { student: true },
  });

  return NextResponse.json({ ok: true, assignment: toItem(assignment) }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId');
  const studentName = url.searchParams.get('studentName');
  const status = url.searchParams.get('status');

  const where: Prisma.AssignmentWhereInput = {};
  if (studentId) {
    where.studentId = studentId;
  } else if (studentName) {
    // برداشت توسط بازی ایستگاه: تطبیق با نام پروفایل — دانش‌آموز ناشناخته یعنی فهرست خالی
    const student = await db.student.findFirst({ where: { name: studentName } });
    if (!student) {
      const res: AssignmentsResponse = { assignments: [] };
      return NextResponse.json(res);
    }
    where.studentId = student.id;
  } else {
    const res: AssignmentsResponse = { assignments: [] };
    return NextResponse.json(res);
  }

  if (status && ['pending', 'seen', 'completed'].includes(status)) {
    where.status = status;
  }

  const rows = await db.assignment.findMany({
    where,
    include: { student: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const res: AssignmentsResponse = { assignments: rows.map(toItem) };
  return NextResponse.json(res);
}
