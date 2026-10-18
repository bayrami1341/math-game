// POST /api/sessions — ثبت جلسهٔ تمرین از بازی (پل بازی ↔ داشبورد)
// بدنه: { studentId? | studentName?, layer, results: [{a,b,correct,timeSec?}], ... }

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { layerName } from '@/lib/dashboard/constants';
import type { PostSessionResponse } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  studentId: z.string().min(1).max(64).optional(),
  studentName: z.string().min(2).max(60).optional(),
  grade: z.number().int().min(1).max(6).optional(),
  hero: z.enum(['astronaut', 'pilot', 'scientist']).optional(),
  buildingId: z
    .union([z.string().min(1).max(60), z.number().int().min(0).max(99)])
    .transform((v) => String(v))
    .optional(),
  layer: z.number().int().min(1).max(9),
  mode: z.enum(['station', 'online', 'side']).default('station'),
  durationSec: z.number().min(0).max(7200).optional(),
  results: z
    .array(
      z.object({
        a: z.number().int().min(0).max(20),
        b: z.number().int().min(0).max(20),
        correct: z.boolean(),
        timeSec: z.number().min(0).max(300).optional(),
      })
    )
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'بدنهٔ JSON نامعتبر است' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    console.error('[sessions] invalid payload:', JSON.stringify(body).slice(0, 600), '→', JSON.stringify(parsed.error.flatten().fieldErrors));
    return NextResponse.json(
      { ok: false, error: 'اعتبارسنجی ناموفق', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // یافتن یا ساخت دانش‌آموز
  let student = data.studentId ? await db.student.findUnique({ where: { id: data.studentId } }) : null;
  if (!student && data.studentName) {
    student = await db.student.findFirst({ where: { name: data.studentName } });
  }
  if (!student) {
    if (!data.studentName) {
      return NextResponse.json({ ok: false, error: 'studentId یا studentName لازم است' }, { status: 400 });
    }
    student = await db.student.create({
      data: { name: data.studentName, grade: data.grade ?? 4, hero: data.hero ?? 'astronaut' },
    });
  }

  const total = data.results.length;
  const correct = data.results.filter((r) => r.correct).length;

  const session = await db.session.create({
    data: {
      studentId: student.id,
      buildingId: data.buildingId ?? 'unknown',
      layer: data.layer,
      mode: data.mode,
      total,
      correct,
      durationSec: Math.round(data.durationSec ?? 0),
      results: {
        create: data.results.map((r) => ({
          studentId: student.id,
          a: r.a,
          b: r.b,
          correct: r.correct,
          timeSec: r.timeSec ?? 0,
          layer: data.layer,
        })),
      },
    },
  });

  const res: PostSessionResponse = {
    ok: true,
    sessionId: session.id,
    studentId: student.id,
    studentName: student.name,
    total,
    correct,
    accuracy: total > 0 ? correct / total : 0,
    layerName: layerName(data.layer),
  };
  return NextResponse.json(res, { status: 201 });
}
