// PATCH /api/assignments/[id] — به‌روزرسانی وضعیت مأموریت (seen توسط بازی، completed دستی یا خودکار)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { missionTitleOf } from '@/lib/dashboard/remediation';
import type { AssignmentItem } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['pending', 'seen', 'completed']),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'بدنهٔ JSON نامعتبر است' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'وضعیت نامعتبر است' }, { status: 400 });
  }

  const existing = await db.assignment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'مأموریت یافت نشد' }, { status: 404 });
  }

  const updated = await db.assignment.update({
    where: { id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === 'completed' ? (existing.completedAt ?? new Date()) : null,
    },
  });

  const item: AssignmentItem = {
    id: updated.id,
    studentId: updated.studentId,
    missionId: updated.missionId,
    missionTitle: missionTitleOf(updated.missionId),
    fact: updated.fact,
    note: updated.note,
    status: (updated.status as AssignmentItem['status']) ?? 'pending',
    createdAt: updated.createdAt.toISOString(),
    completedAt: updated.completedAt?.toISOString() ?? null,
  };
  return NextResponse.json({ ok: true, assignment: item });
}
