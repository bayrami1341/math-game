// لایهٔ سرور زنجیرهٔ رویداد — دسترسی دیتابیس برای ساخت و راستی‌آزمایی زنجیرهٔ رسید

import { db } from '@/lib/db';
import {
  computeReceipt,
  semanticIntegrity,
  verifyChain,
  type ChainEventInput,
  type ChainFields,
  type ChainRow,
  type ChainVerification,
  type ReplayReport,
  replaySessions,
} from './event-chain';

/** فیلدهای زنجیرهٔ رویداد بعدی یک دانش‌آموز را محاسبه می‌کند (ساعت لامپورت + پیوند رسید) */
export async function nextChainFields(studentId: string, ev: ChainEventInput): Promise<ChainFields> {
  const last = await db.session.findFirst({
    where: { studentId, receipt: { not: null } },
    orderBy: { lamportClock: 'desc' },
    select: { lamportClock: true, receipt: true },
  });
  const lamportClock = (last?.lamportClock ?? 0) + 1;
  const prevReceipt = last?.receipt ?? null;
  return { lamportClock, prevReceipt, receipt: computeReceipt(ev, prevReceipt) };
}

/** گزارش کامل زنجیرهٔ یک دانش‌آموز: رسیدها + بازپخش قطعی + integrity */
export async function buildChainReport(studentId: string): Promise<{
  chain: ChainVerification;
  replay: ReplayReport;
}> {
  const sessions = await db.session.findMany({
    where: { studentId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      eventId: true,
      studentId: true,
      buildingId: true,
      layer: true,
      mode: true,
      total: true,
      correct: true,
      lamportClock: true,
      prevReceipt: true,
      receipt: true,
      integrity: true,
      results: { select: { a: true, b: true, correct: true, submitted: true, timeSec: true } },
    },
  });

  const rows: ChainRow[] = sessions.map((s) => ({
    ...s,
    results: s.results.map((r) => ({
      a: r.a,
      b: r.b,
      correct: r.correct,
      submitted: r.submitted,
      timeSec: r.timeSec,
    })),
  }));

  const chain = verifyChain(rows);
  const replay = replaySessions(
    rows.map((r) => ({ id: r.id, total: r.total, correct: r.correct, results: r.results }))
  );
  return { chain, replay };
}

/** بررسی integrity معنایی بدنهٔ ورودی قبل از ثبت */
export function integrityOfResults(results: { a: number; b: number; correct: boolean; submitted?: number | null }[]): boolean {
  return semanticIntegrity(results);
}
