// موتور آماری داشبورد معلم — توابع Pure برای تشخیص گلوگاه و پیشرفت
// بدون وابستگی به Prisma؛ ورودی ردیف‌های خام است.

import type {
  BottleneckItem,
  FactStat,
  LayerProgress,
  Severity,
  TableHealth,
  TrendPoint,
} from './types';
import { TABLE_TIPS, layerName, layerShort } from './constants';

export interface QRow {
  a: number;
  b: number;
  correct: boolean;
  studentId: string;
  createdAt: Date;
}

export interface SessRow {
  id: string;
  studentId: string;
  layer: number;
  total: number;
  correct: number;
  durationSec: number;
  createdAt: Date;
}

const DAY = 24 * 60 * 60 * 1000;

// آستانه‌های تشخیص گلوگاه کلاس
export const BOTTLENECK_MIN_ATTEMPTS = 5;
export const BOTTLENECK_MIN_ERROR = 0.25;
// آستانهٔ تسلط بر لایه (هم‌راستا با آستانه‌های بازی ۸۵٪)
export const MASTERY_ACCURACY = 0.85;
export const MASTERY_MIN_ATTEMPTS = 8;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n: number): Date {
  return new Date(startOfToday().getTime() - n * DAY);
}

// ─── تجمیع فاکتورها ───

interface FactAgg {
  a: number;
  b: number;
  attempts: number;
  wrong: number;
  perStudent: Map<string, { attempts: number; wrong: number }>;
}

/** فاکتورها را به‌صورت جابه‌جایی‌ناپذیر (۷×۸ ≡ ۸×۷) تجمیع می‌کند */
export function aggregateFacts(rows: QRow[]): Map<string, FactAgg> {
  const map = new Map<string, FactAgg>();
  for (const r of rows) {
    const x = Math.min(r.a, r.b);
    const y = Math.max(r.a, r.b);
    if (x < 2 || y > 12) continue; // فقط جدول‌های ۲ تا ۱۲
    const key = `${x}×${y}`;
    let agg = map.get(key);
    if (!agg) {
      agg = { a: x, b: y, attempts: 0, wrong: 0, perStudent: new Map() };
      map.set(key, agg);
    }
    agg.attempts++;
    if (!r.correct) agg.wrong++;
    const ps = agg.perStudent.get(r.studentId) ?? { attempts: 0, wrong: 0 };
    ps.attempts++;
    if (!r.correct) ps.wrong++;
    agg.perStudent.set(r.studentId, ps);
  }
  return map;
}

function factToStat(agg: FactAgg): FactStat {
  return {
    a: agg.a,
    b: agg.b,
    fact: `${agg.a}×${agg.b}`,
    attempts: agg.attempts,
    wrong: agg.wrong,
    errorRate: agg.attempts > 0 ? agg.wrong / agg.attempts : 0,
  };
}

// ─── سلامت جدول‌های ضرب (۲ تا ۱۲) ───

export function computeTableHealth(rows: QRow[]): TableHealth[] {
  const byTable = new Map<number, { attempts: number; wrong: number; students: Set<string>; facts: Map<string, { a: number; b: number; attempts: number; wrong: number }> }>();
  for (const r of rows) {
    const x = Math.min(r.a, r.b);
    const y = Math.max(r.a, r.b);
    if (x < 2 || y > 12) continue;
    for (const t of new Set([x, y])) {
      let t0 = byTable.get(t);
      if (!t0) {
        t0 = { attempts: 0, wrong: 0, students: new Set(), facts: new Map() };
        byTable.set(t, t0);
      }
      t0.attempts++;
      if (!r.correct) t0.wrong++;
      t0.students.add(r.studentId);
      const fk = `${x}×${y}`;
      const f = t0.facts.get(fk) ?? { a: x, b: y, attempts: 0, wrong: 0 };
      f.attempts++;
      if (!r.correct) f.wrong++;
      t0.facts.set(fk, f);
    }
  }
  const out: TableHealth[] = [];
  for (const [table, t0] of byTable) {
    let worst: { fact: string; rate: number } | null = null;
    for (const f of t0.facts.values()) {
      if (f.attempts < 3) continue;
      const rate = f.wrong / f.attempts;
      if (!worst || rate > worst.rate) worst = { fact: `${f.a}×${f.b}`, rate };
    }
    out.push({
      table,
      attempts: t0.attempts,
      errorRate: t0.attempts > 0 ? t0.wrong / t0.attempts : 0,
      worstFact: worst?.fact ?? null,
      affectedStudents: t0.students.size,
    });
  }
  return out.sort((p, q) => p.table - q.table);
}

function severityOf(errorRate: number): Severity {
  if (errorRate >= 0.4) return 'critical';
  if (errorRate >= 0.32) return 'high';
  return 'medium';
}

// ─── گلوگاه‌های کلاس ───

export function computeBottlenecks(
  rows: QRow[],
  studentsById: Map<string, { id: string; name: string }>,
  opts?: { minAttempts?: number; minError?: number }
): BottleneckItem[] {
  const minAttempts = opts?.minAttempts ?? BOTTLENECK_MIN_ATTEMPTS;
  const minError = opts?.minError ?? BOTTLENECK_MIN_ERROR;

  const tableHealth = computeTableHealth(rows);
  const tableError = new Map(tableHealth.map((t) => [t.table, t.errorRate]));

  const agg = aggregateFacts(rows);
  const items: BottleneckItem[] = [];
  for (const f of agg.values()) {
    if (f.attempts < minAttempts) continue;
    const errorRate = f.wrong / f.attempts;
    if (errorRate < minError) continue;

    // جدولِ مرجع برای پیشنهاد: جدولی که خطای کلاس در آن بالاتر است
    const tables = [...new Set([f.a, f.b])];
    const refTable = tables.reduce((best, t) => ((tableError.get(t) ?? 0) > (tableError.get(best) ?? 0) ? t : best), tables[0]);

    const affected = [...f.perStudent.entries()]
      .filter(([, s]) => s.attempts >= 2)
      .map(([id, s]) => {
        const st = studentsById.get(id);
        return {
          id,
          name: st?.name ?? 'دانش‌آموز',
          attempts: s.attempts,
          errorRate: s.wrong / s.attempts,
        };
      })
      .sort((p, q) => q.errorRate - p.errorRate)
      .slice(0, 12);

    items.push({
      ...factToStat(f),
      severity: severityOf(errorRate),
      students: f.perStudent.size,
      tables,
      recommendation: TABLE_TIPS[refTable] ?? 'تمرین هدفمند با دسته‌بندی اشیاء و کشف الگو',
      affected,
    });
  }
  return items.sort((p, q) => q.errorRate - p.errorRate || q.attempts - p.attempts);
}

// ─── فاکتورهای ضعیف یک دانش‌آموز ───

export function computeStudentFacts(rows: QRow[], studentId: string, opts?: { minAttempts?: number; minError?: number }): FactStat[] {
  const minAttempts = opts?.minAttempts ?? 3;
  const minError = opts?.minError ?? 0.3;
  const own = rows.filter((r) => r.studentId === studentId);
  const agg = aggregateFacts(own);
  const out: FactStat[] = [];
  for (const f of agg.values()) {
    if (f.attempts < minAttempts) continue;
    const errorRate = f.wrong / f.attempts;
    if (errorRate < minError) continue;
    out.push(factToStat(f));
  }
  return out.sort((p, q) => q.errorRate - p.errorRate || q.attempts - p.attempts).slice(0, 8);
}

// ─── روند روزانه ───

export function computeDailyTrend(questions: QRow[], sessions: SessRow[], days = 14): TrendPoint[] {
  const fmtWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' });
  const fmtDay = new Intl.DateTimeFormat('fa-IR', { day: 'numeric' });
  const out: TrendPoint[] = [];
  const today = startOfToday();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today.getTime() - i * DAY);
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const inDay = questions.filter((q) => q.createdAt >= dayStart && q.createdAt < dayEnd);
    const sess = sessions.filter((s) => s.createdAt >= dayStart && s.createdAt < dayEnd);
    const correct = inDay.filter((q) => q.correct).length;
    out.push({
      date: dayStart.toISOString().slice(0, 10),
      label: `${fmtWeekday.format(dayStart)} ${fmtDay.format(dayStart)}`,
      accuracy: inDay.length > 0 ? correct / inDay.length : null,
      questions: inDay.length,
      sessions: sess.length,
    });
  }
  return out;
}

// ─── پیشرفت لایه‌ای یک دانش‌آموز ───

export function computeLayerProgress(sessions: SessRow[]): LayerProgress[] {
  const byLayer = new Map<number, SessRow[]>();
  for (const s of sessions) {
    const arr = byLayer.get(s.layer) ?? [];
    arr.push(s);
    byLayer.set(s.layer, arr);
  }
  // لایهٔ جاری = لایهٔ جدیدترین جلسه
  const latest = [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const currentLayer = latest?.layer ?? 1;

  const out: LayerProgress[] = [];
  for (let layer = 1; layer <= 9; layer++) {
    const sess = (byLayer.get(layer) ?? []).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const last = sess[sess.length - 1];
    const accuracy = last && last.total > 0 ? last.correct / last.total : null;
    const attempts = sess.reduce((sum, s) => sum + s.total, 0);
    const mastered = accuracy !== null && accuracy >= MASTERY_ACCURACY && attempts >= MASTERY_MIN_ATTEMPTS;
    out.push({
      layer,
      name: layerName(layer),
      short: layerShort(layer),
      sessions: sess.length,
      attempts,
      accuracy,
      mastered,
      isCurrent: layer === currentLayer,
    });
  }
  return out;
}

// ─── محاسبهٔ روند کلی (برای گزارش هوشمند) ───

export function trendDirection(rows: QRow[]): { first: number | null; last: number | null; delta: number | null } {
  if (rows.length === 0) return { first: null, last: null, delta: null };
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const mid = Math.floor(sorted.length / 2);
  const acc = (arr: QRow[]) => (arr.length ? arr.filter((q) => q.correct).length / arr.length : null);
  const first = acc(sorted.slice(0, mid));
  const last = acc(sorted.slice(mid));
  const delta = first !== null && last !== null ? last - first : null;
  return { first, last, delta };
}
