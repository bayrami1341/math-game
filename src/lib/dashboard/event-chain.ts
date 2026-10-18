// موتور زنجیرهٔ رسید رویدادها (CEAP v2.1 §4) — Pure و بدون دسترسی دیتابیس
// receipt(n) = sha256( canonical(n) + prevReceipt )  → دستکاری هر رکورد زنجیره را می‌شکند.
// بازپخش قطعی (§4.3): مجموع Session.total/correct باید با کاهش رویدادهای QuestionResult برابر باشد.

import { createHash } from 'crypto';

export interface ChainEventInput {
  eventId: string | null;
  studentId: string;
  buildingId: string;
  layer: number;
  mode: string;
  total: number;
  correct: number;
  results: { a: number; b: number; correct: boolean; submitted?: number | null; timeSec?: number }[];
}

export interface ChainFields {
  lamportClock: number;
  prevReceipt: string | null;
  receipt: string;
}

/** نگاشت کانونی و پایدار رویداد — ترتیب کلیدها ثابت است (JSON key order مهم است) */
export function canonicalEventPayload(ev: ChainEventInput, prevReceipt: string | null): string {
  // دفاعی: هر فیلد جامانده به‌جای حذف‌شدن از payload، با null/0 کانونی می‌شود —
  // وگرنه JSON.stringify کلید undefined را می‌اندازد و هشِ verify با hash می‌شکند.
  return JSON.stringify({
    eventId: ev.eventId ?? null,
    studentId: ev.studentId ?? null,
    buildingId: ev.buildingId ?? 'unknown',
    layer: ev.layer ?? 0,
    mode: ev.mode ?? 'station',
    total: ev.total ?? 0,
    correct: ev.correct ?? 0,
    results: ev.results.map((r) => ({
      a: r.a,
      b: r.b,
      correct: r.correct,
      submitted: r.submitted ?? null,
      timeSec: r.timeSec ?? 0,
    })),
    prevReceipt,
  });
}

export function computeReceipt(ev: ChainEventInput, prevReceipt: string | null): string {
  return createHash('sha256').update(canonicalEventPayload(ev, prevReceipt), 'utf8').digest('hex');
}

/** راستی‌آزمایی رسید ذخیره‌شدهٔ یک رویداد */
export function verifyReceipt(
  ev: ChainEventInput & { receipt: string | null },
  prevReceipt: string | null
): boolean {
  if (!ev.receipt) return false;
  const expected = computeReceipt(ev, prevReceipt);
  return expected === ev.receipt;
}

// ─── بازپخش قطعی (§4.3): State = Reduce(Events, Genesis) ───

export interface ReplaySessionRow {
  id: string;
  total: number;
  correct: number;
  results: { correct: boolean }[];
}

export interface ReplayReport {
  replayMatch: boolean;
  mismatchedSessions: string[];
}

/** مجموع مقادیر ذخیره‌شدهٔ هر جلسه باید از کاهش تک‌تک نتایجش قابل بازتولید باشد */
export function replaySessions(sessions: ReplaySessionRow[]): ReplayReport {
  const mismatchedSessions: string[] = [];
  for (const s of sessions) {
    const replayedCorrect = s.results.filter((r) => r.correct).length;
    if (replayedCorrect !== s.correct || s.results.length !== s.total) {
      mismatchedSessions.push(s.id);
    }
  }
  return { replayMatch: mismatchedSessions.length === 0, mismatchedSessions };
}

// ─── راستی‌آزمایی زنجیرهٔ کامل یک دانش‌آموز ───

export interface ChainRow {
  id: string;
  eventId: string | null;
  studentId: string;
  buildingId: string;
  layer: number;
  mode: string;
  total: number;
  correct: number;
  lamportClock: number;
  prevReceipt: string | null;
  receipt: string | null;
  integrity: boolean;
  results: { a: number; b: number; correct: boolean; submitted: number | null; timeSec: number }[];
}

export interface ChainVerification {
  /** true = همهٔ رویدادهای زنجیره‌دار سالم‌اند (رویدادهای قدیمیِ فاقد زنجیره جدا شمرده می‌شوند) */
  valid: boolean;
  /** false = ناسازگاری submitted ↔ correct در حداقل یک جلسه */
  integrityOk: boolean;
  sessions: number;
  verified: number;
  legacyCount: number; // جلسات پیش از ساخت زنجیره (بدون receipt)
  brokenAt: string | null; // sessionId اولین حلقهٔ شکسته
  clockOrdered: boolean; // آیا ساعت لامپورت صعودی و بدون تکرار است
}

export function verifyChain(rows: ChainRow[]): ChainVerification {
  const clocked = rows.filter((r) => r.receipt !== null).sort((a, b) => a.lamportClock - b.lamportClock);
  const legacyCount = rows.length - clocked.length;

  let valid = true;
  let brokenAt: string | null = null;
  let expectedPrev: string | null = null;
  let clockOrdered = true;
  let lastClock = 0;

  for (const row of clocked) {
    if (row.lamportClock <= lastClock) clockOrdered = false;
    lastClock = row.lamportClock;

    const linked = row.prevReceipt === expectedPrev;
    const selfOk = verifyReceipt(row, row.prevReceipt);
    if (!linked || !selfOk) {
      valid = false;
      if (!brokenAt) brokenAt = row.id;
      // زنجیره از نقطهٔ شکست ادامه نمی‌یابد؛ ولی بقیهٔ حلقه‌ها همچنان خودآزما می‌شوند
      expectedPrev = row.receipt;
      continue;
    }
    expectedPrev = row.receipt;
  }

  const integrityOk = rows.every((r) => r.integrity);
  return {
    valid,
    integrityOk,
    sessions: rows.length,
    verified: clocked.length - (brokenAt ? 1 : 0),
    legacyCount,
    brokenAt,
    clockOrdered,
  };
}

/** تشخیص ناسازگاری معنایی بین پاسخ ثبت‌شده و درستی اعلام‌شده (ماتریس تهدید §3.2) */
export function semanticIntegrity(results: { a: number; b: number; correct: boolean; submitted?: number | null }[]): boolean {
  for (const r of results) {
    if (r.submitted === null || r.submitted === undefined) continue;
    const expected = r.a * r.b;
    if (r.correct && r.submitted !== expected) return false;
    if (!r.correct && r.submitted === expected) return false;
  }
  return true;
}
