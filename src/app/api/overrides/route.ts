// POST /api/overrides — ثبت بازنویسی تشخیص معلم (CEAP §9.2 — TEACHER_OVERRIDE فقط‌الحاقی؛ تشخیص الگوریتم هرگز حذف/ویرایش نمی‌شود)
// GET  /api/overrides?studentId= — ۱۰ بازنویسی آخر یک دانش‌آموز برای نمایش در داشبورد

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ERROR_CODES } from '@/lib/dashboard/error-model';
import type { OverrideItem } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const codeSchema = z
  .string()
  .refine((c) => c in ERROR_CODES, { message: 'کد تشخیص باید یکی از ۱۲ کد شناخته‌شده باشد' });

const postSchema = z.object({
  studentId: z.string().min(1).max(64),
  originalCode: codeSchema,
  overrideCode: codeSchema,
  note: z.string().max(500).optional(),
});

function toItem(o: {
  id: string;
  originalCode: string;
  overrideCode: string;
  note: string | null;
  createdAt: Date;
}): OverrideItem {
  return {
    id: o.id,
    originalCode: o.originalCode,
    overrideCode: o.overrideCode,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
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

  const student = await db.student.findUnique({ where: { id: data.studentId } });
  if (!student) {
    return NextResponse.json({ ok: false, error: 'دانش‌آموز یافت نشد' }, { status: 404 });
  }

  const created = await db.teacherOverride.create({
    data: {
      studentId: data.studentId,
      originalCode: data.originalCode,
      overrideCode: data.overrideCode,
      note: data.note,
    },
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const studentId = url.searchParams.get('studentId');
  if (!studentId) {
    return NextResponse.json({ ok: true, overrides: [] });
  }

  const rows = await db.teacherOverride.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return NextResponse.json({ ok: true, overrides: rows.map(toItem) });
}
