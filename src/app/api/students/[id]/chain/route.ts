// GET /api/students/[id]/chain — راستی‌آزمایی زنجیرهٔ رسید و بازپخش قطعی رویدادهای دانش‌آموز
// (CEAP v2.1 §4 — Append-Only Event Store Verifier)

import { NextResponse } from 'next/server';
import { buildChainReport } from '@/lib/dashboard/chain-server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { chain, replay } = await buildChainReport(id);
  return NextResponse.json({
    ...chain,
    replayMatch: replay.replayMatch,
    mismatchedSessions: replay.mismatchedSessions,
  });
}
