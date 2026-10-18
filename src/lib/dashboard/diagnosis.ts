// موتور تشخیص ۱۲خطای شناختی ضرب — لایهٔ بالینی داشبورد معلم (CEAP v2.1 §7.3 / §9.1)
// کاملاً Pure و قطعی: بدون دیتابیس، بدون fetch، بدون Date.now — با ورودی یکسان خروجی یکسان.
// ورودی: سطرهای خام QuestionResult یک دانش‌آموز؛ خروجی: حداکثر ۳ تشخیص قوی مرتب بر اساس confidence نزولی.
// اصل صداقت (§9.1): شواهد submitted مبنا هستند؛ بدون submitted فقط الگوهای آماری با اطمینان پایین‌تر صادر می‌شود.

import { CPA_LABELS, ERROR_CODES } from './error-model';
import type { DiagnosisItem } from './types';

/** سطر خام نتیجهٔ سؤال — همان شکل QuestionResult (فقط فیلدهای موردنیاز موتور) */
export interface DiagnosisQuestionRow {
  a: number;
  b: number;
  correct: boolean;
  timeSec: number;
  submitted: number | null;
  createdAt: Date;
}

// ─── ابزارهای محلی (ارقام فارسی، میانه، clamp) ───

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** ارقام لاتین → فارسی (تابع محلی؛ این ماژول عمداً وابستگی قالب‌بندی بیرونی ندارد) */
function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** قالب فاکت: «۷×۸» */
function factFa(a: number, b: number): string {
  return `${toFa(a)}×${toFa(b)}`;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clampConf(x: number): number {
  return Math.min(0.9, Math.max(0.35, Math.round(x * 100) / 100));
}

// ─── سطر نرمال‌شدهٔ داخلی ───

interface Row {
  a: number;
  b: number;
  correct: boolean;
  submitted: number | null;
  timeSec: number;
  t: number; // createdAt به میلی‌ثانیه (برای ترتیب سراسری)
  order: number; // ترتیب پایدار برای حالت تایم برابر
}

function timeOf(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function normalize(questions: DiagnosisQuestionRow[]): Row[] {
  const rows: Row[] = [];
  questions.forEach((q, i) => {
    if (!Number.isFinite(q.a) || !Number.isFinite(q.b)) return;
    rows.push({
      a: q.a,
      b: q.b,
      correct: !!q.correct,
      submitted: typeof q.submitted === 'number' && Number.isFinite(q.submitted) ? q.submitted : null,
      timeSec: Number.isFinite(q.timeSec) ? q.timeSec : 0,
      t: timeOf(q.createdAt),
      order: i,
    });
  });
  // ترتیب زمانی سراسری (پایدار؛ برای نیمه‌بندی خستگی)
  rows.sort((x, y) => x.t - y.t || x.order - y.order);
  return rows;
}

// ─── آمار زیرمجموعه‌ها ───

interface SubsetStats {
  attempts: number;
  errorRate: number;
  medianTimeSec: number;
}

function statsOf(subset: Row[]): SubsetStats {
  const wrongs = subset.filter((r) => !r.correct);
  return {
    attempts: subset.length,
    errorRate: subset.length > 0 ? wrongs.length / subset.length : 0,
    medianTimeSec: median(subset.map((r) => r.timeSec)),
  };
}

/** حداکثر ۳ فاکت غلطِ آخرِ شواهد (مرتب زمانی، بدون تکرار) */
function sampleFactsOf(wrongs: Row[], max = 3): string[] {
  const out: string[] = [];
  for (const r of wrongs.slice(-max * 2)) {
    const f = factFa(r.a, r.b);
    if (!out.includes(f)) out.push(f);
    if (out.length >= max) break;
  }
  return out;
}

function factKey(a: number, b: number): string {
  return `${Math.min(a, b)}|${Math.max(a, b)}`;
}

/** همهٔ تلاش‌های فاکت‌های مشخص‌شده (برای attempts/errorRate معنادار) */
function rowsOfFacts(rows: Row[], keys: Set<string>): Row[] {
  return rows.filter((r) => keys.has(factKey(r.a, r.b)));
}

function isTable(r: Row, t: number): boolean {
  return r.a === t || r.b === t;
}

function maxFactor(r: Row): number {
  return Math.max(r.a, r.b);
}

// ─── کاندیدای تشخیص ───

interface Candidate extends SubsetStats {
  code: string;
  confidence: number;
  sampleFacts: string[];
  patternFa: string;
}

function toDiagnosis(c: Candidate): DiagnosisItem {
  const meta = ERROR_CODES[c.code];
  const stage = meta?.cpaStage ?? 'Abstract';
  return {
    code: c.code,
    titleFa: meta?.titleFa ?? c.code,
    cpaStage: stage,
    cpaLabelFa: CPA_LABELS[stage],
    confidence: clampConf(c.confidence),
    attempts: c.attempts,
    errorRate: Math.round(c.errorRate * 100) / 100,
    medianTimeSec: Math.round(c.medianTimeSec * 10) / 10,
    sampleFacts: c.sampleFacts,
    patternFa: c.patternFa,
    actionFa: meta?.actionFa ?? '',
  };
}

// ─── قواعد تشخیص ───

/** E_COMMUTATIVE_FAIL — خطای جهت‌دار روی یک جفت بدون‌ترتیب (یک جهت خراب، جهت دیگر سالم) */
function detectCommutative(rows: Row[], push: (c: Candidate) => void): void {
  const pairs = new Map<string, { x: number; y: number }>();
  for (const r of rows) {
    const x = Math.min(r.a, r.b);
    const y = Math.max(r.a, r.b);
    if (x !== y) pairs.set(factKey(x, y), { x, y });
  }

  let best: Candidate | null = null;
  for (const { x, y } of pairs.values()) {
    const dir1 = rows.filter((r) => r.a === x && r.b === y); // جهت ۳×۸
    const dir2 = rows.filter((r) => r.a === y && r.b === x); // جهت ۸×۳
    if (dir1.length === 0 || dir2.length === 0) continue;
    const wrong1 = dir1.filter((r) => !r.correct);
    const wrong2 = dir2.filter((r) => !r.correct);

    let failing: Row[] | null = null;
    let healthy: Row[] | null = null;
    if (wrong1.length >= 2 && wrong2.length === 0) {
      failing = wrong1;
      healthy = dir2;
    } else if (wrong2.length >= 2 && wrong1.length === 0) {
      failing = wrong2;
      healthy = dir1;
    }
    if (!failing || !healthy) continue;

    const healthyCorrect = healthy.filter((r) => r.correct).length;
    const subset = [...dir1, ...dir2];
    const st = statsOf(subset);
    const confidence =
      0.55 + Math.min(0.15, (failing.length - 2) * 0.04 + Math.min(healthyCorrect, 6) * 0.01);
    const failDirFirst = failing[0];
    const c: Candidate = {
      code: 'E_COMMUTATIVE_FAIL',
      confidence,
      ...st,
      medianTimeSec: median(failing.map((r) => r.timeSec)),
      sampleFacts: sampleFactsOf(failing),
      patternFa: `در ضربِ ${factFa(failDirFirst.a, failDirFirst.b)} چند بار خطا زده شده، در حالی که همان ضرب با اعداد برعکس (${factFa(failDirFirst.b, failDirFirst.a)}) همیشه درست است — یعنی هنوز نمی‌داند عوض کردن ترتیب دو عدد، جواب را عوض نمی‌کند.`,
    };
    if (!best || c.confidence > best.confidence) best = c;
  }
  if (best) push(best);
}

/** E_ADD_CONFUSION — پاسخ غلطی که دقیقاً برابر جمع دو فاکتور است (یا بدون submitted: خطا در فاکت‌های خیلی آسان جدول ۲) */
function detectAddConfusion(rows: Row[], push: (c: Candidate) => void): void {
  const slips = rows.filter((r) => !r.correct && r.submitted !== null && r.submitted === r.a + r.b);
  if (slips.length >= 2) {
    const keys = new Set(slips.map((r) => factKey(r.a, r.b)));
    const subset = rowsOfFacts(rows, keys);
    const st = statsOf(subset);
    const ex = slips[0];
    push({
      code: 'E_ADD_CONFUSION',
      confidence: 0.6 + Math.min(0.09, (slips.length - 2) * 0.03),
      ...st,
      sampleFacts: sampleFactsOf(slips),
      patternFa: `در ${toFa(slips.length)} مورد، پاسخِ نوشته‌شده دقیقاً برابر جمعِ دو عدد است (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} نوشته) — ضرب با جمع قاطی شده است.`,
    });
    return;
  }
  // بدون شواهد submitted: فاکت‌های خیلی آسان (جدول ۲ تا ۴) که نباید غلط بزند
  const easy = rows.filter((r) => {
    const x = Math.min(r.a, r.b);
    const y = Math.max(r.a, r.b);
    return x === 2 && (y === 2 || y === 3 || y === 4);
  });
  const easyWrong = easy.filter((r) => !r.correct);
  if (easyWrong.length >= 2) {
    const st = statsOf(easy);
    push({
      code: 'E_ADD_CONFUSION',
      confidence: 0.4,
      ...st,
      sampleFacts: sampleFactsOf(easyWrong),
      patternFa: 'در ضرب‌های خیلی سادهٔ جدول ۲ هم خطا دارد؛ وقتی ساده‌ترین ضرب‌ها هم اشتباه می‌شوند، نشانهٔ آن است که مفهوم پایهٔ ضرب هنوز تثبیت نشده است.',
    });
  }
}

/** E_SKIP_OVERCOUNT / E_SKIP_UNDERCOUNT — فقط با submitted: جواب دقیقاً یک دستهٔ کامل بیشتر/کمتر (±a یا ±b) */
function detectSkipCounting(rows: Row[], push: (c: Candidate) => void): void {
  const over: Row[] = [];
  const under: Row[] = [];
  for (const r of rows) {
    if (r.correct || r.submitted === null) continue;
    const d = r.submitted - r.a * r.b;
    if (d === r.a || d === r.b) over.push(r);
    else if (d === -r.a || d === -r.b) under.push(r);
  }

  const build = (code: 'E_SKIP_OVERCOUNT' | 'E_SKIP_UNDERCOUNT', evidence: Row[]) => {
    if (evidence.length < 2) return;
    const onSmall = evidence.filter((r) => {
      const y = Math.max(r.a, r.b);
      return y >= 2 && y <= 5;
    }).length;
    const smallBonus = onSmall >= evidence.length / 2 ? 0.07 : 0;
    const keys = new Set(evidence.map((r) => factKey(r.a, r.b)));
    const subset = rowsOfFacts(rows, keys);
    const st = statsOf(subset);
    const ex = evidence[0];
    const isOver = code === 'E_SKIP_OVERCOUNT';
    push({
      code,
      confidence: 0.6 + smallBonus + Math.min(0.06, (evidence.length - 2) * 0.03),
      ...st,
      sampleFacts: sampleFactsOf(evidence),
      patternFa: isOver
        ? `در ${toFa(evidence.length)} مورد، جواب دقیقاً به‌اندازهٔ یک دستهٔ کامل بیشتر از جواب درست است (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} نوشته در حالی که جواب درست ${toFa(ex.a * ex.b)} است) — موقع شمارش دسته‌ها یک پرش اضافه می‌زند.`
        : `در ${toFa(evidence.length)} مورد، جواب دقیقاً به‌اندازهٔ یک دستهٔ کامل کمتر از جواب درست است (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} نوشته در حالی که جواب درست ${toFa(ex.a * ex.b)} است) — موقع شمارش دسته‌ها یک پرش جا می‌اندازد.`,
    });
  };
  build('E_SKIP_OVERCOUNT', over);
  build('E_SKIP_UNDERCOUNT', under);
}

/** E_PLACE_SHIFT — خطای تجمعی فقط روی جدول‌های ≥۱۰ در حالی که جدول‌های کوچک سالم‌اند */
function detectPlaceShift(rows: Row[], push: (c: Candidate) => void): void {
  const high = rows.filter((r) => maxFactor(r) >= 10);
  const low = rows.filter((r) => maxFactor(r) < 10);
  if (high.length < 3 || low.length < 3) return;
  const highSt = statsOf(high);
  const lowSt = statsOf(low);
  if (highSt.errorRate < 0.4 || lowSt.errorRate >= 0.2) return;

  const highWrong = high.filter((r) => !r.correct);
  const shifted = highWrong.filter((r) => {
    if (r.submitted === null) return false;
    const exp = r.a * r.b;
    return r.submitted === exp / 10 || r.submitted === exp * 10;
  });
  const ex = shifted[0] ?? highWrong[0];
  const patternFa = shifted.length >= 1
    ? `خطاها فقط در ضرب‌های بزرگ (جدول ${toFa(10)} به بالا) رخ می‌دهد و جواب ده برابر بزرگ‌تر یا کوچک‌تر از جواب درست نوشته می‌شود (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} نوشته) — صفرِ آخر و ارزش مکانی قاطی شده است.`
    : `خطاها فقط در ضرب‌های جدول ${toFa(10)} به بالا جمع شده است در حالی که ضرب‌های کوچک را خوب می‌زند — احتمالاً در شمردن دسته‌های ده‌تایی حساب جا می‌لغزد.`;
  push({
    code: 'E_PLACE_SHIFT',
    confidence: shifted.length >= 1 ? 0.75 : 0.5,
    ...highSt,
    sampleFacts: sampleFactsOf(highWrong),
    patternFa,
  });
}

/** E_DOUBLING_HALVING — خطا در جدول‌های ۴ و ۸ در حالی که جدول ۲ (پایهٔ دوبرابرکردن) سالم است */
function detectDoublingHalving(rows: Row[], push: (c: Candidate) => void): void {
  const d48 = rows.filter((r) => isTable(r, 4) || isTable(r, 8));
  const t2 = rows.filter((r) => isTable(r, 2));
  if (d48.length < 3 || t2.length < 2) return;
  const st48 = statsOf(d48);
  const st2 = statsOf(t2);
  if (st48.errorRate < 0.4 || st2.errorRate > 0.15) return;
  push({
    code: 'E_DOUBLING_HALVING',
    confidence: 0.6,
    ...st48,
    sampleFacts: sampleFactsOf(d48.filter((r) => !r.correct)),
    patternFa: 'در ضرب‌های جدول ۴ و ۸ خطای بالا دیده می‌شود در حالی که جدول ۲ را خوب می‌زند — راهبرد «دوبرابر کردن» (از ۲ به ۴ و از ۴ به ۸) هنوز برایش به تمرین نساخته است.',
  });
}

/** E_ANCHOR_DRIFT — خطا در جدول‌های ۶ تا ۹ در حالی که لنگرهای ۵ و ۱۰ سالم‌اند */
function detectAnchorDrift(rows: Row[], push: (c: Candidate) => void): void {
  const mid = rows.filter((r) => isTable(r, 6) || isTable(r, 7) || isTable(r, 8) || isTable(r, 9));
  const anchors = rows.filter((r) => isTable(r, 5) || isTable(r, 10));
  if (mid.length < 3 || anchors.length < 2) return;
  const stMid = statsOf(mid);
  const stAnchor = statsOf(anchors);
  if (stMid.errorRate < 0.35 || stAnchor.errorRate > 0.2) return;

  const midWrong = mid.filter((r) => !r.correct);
  const drifted = midWrong.filter((r) => {
    if (r.submitted === null) return false;
    const d = Math.abs(r.submitted - r.a * r.b);
    return d === r.a || d === r.b;
  });
  const ex = drifted[0] ?? midWrong[0];
  const patternFa = drifted.length >= 1
    ? `خطاها روی ضرب‌های جدول ${toFa(6)} تا ${toFa(9)} جمع شده است در حالی که ضرب‌های ${toFa(5)} و ${toFa(10)} را خوب می‌زند؛ جواب‌های اشتباهش هم دقیقاً یک دسته با جواب درست فاصله دارد (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} نوشته) — از جواب آسان شروع می‌کند ولی وسط راه یک دسته جا می‌اندازد یا اضافه می‌زند.`
    : `خطاها روی ضرب‌های جدول ${toFa(6)} تا ${toFa(9)} جمع شده است در حالی که ضرب‌های ${toFa(5)} و ${toFa(10)} را خوب می‌زند — یعنی راه آسان را بلد است ولی در ادامهٔ شمردن از مبنای آن جا می‌ماند.`;
  push({
    code: 'E_ANCHOR_DRIFT',
    confidence: drifted.length >= 1 ? 0.7 : 0.45,
    ...stMid,
    sampleFacts: sampleFactsOf(midWrong),
    patternFa,
  });
}

/** E_DISTRIBUTIVE_LEAK — فقط با submitted: جواب برابر یک نیمهٔ تجزیهٔ غلط (افتادن یک تکه) */
function detectDistributiveLeak(rows: Row[], push: (c: Candidate) => void): void {
  const leaks: Row[] = [];
  for (const r of rows) {
    if (r.correct || r.submitted === null) continue;
    const big = Math.max(r.a, r.b);
    const small = Math.min(r.a, r.b);
    if (big >= 6 && r.submitted === small * (big - 5)) leaks.push(r);
    else if (big >= 10 && big % 10 !== 0 && r.submitted === small * (big % 10)) leaks.push(r);
  }
  if (leaks.length < 2) return;
  const keys = new Set(leaks.map((r) => factKey(r.a, r.b)));
  const subset = rowsOfFacts(rows, keys);
  const st = statsOf(subset);
  const ex = leaks[0];
  const big = Math.max(ex.a, ex.b);
  const small = Math.min(ex.a, ex.b);
  const part = ex.submitted === small * (big - 5) ? big - 5 : big % 10;
  push({
    code: 'E_DISTRIBUTIVE_LEAK',
    confidence: 0.65 + Math.min(0.05, (leaks.length - 2) * 0.025),
    ...st,
    sampleFacts: sampleFactsOf(leaks),
    patternFa: `در ضرب‌های سخت، جوابِ نوشته‌شده دقیقاً برابر نتیجهٔ یک تکه از تجزیه است (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} نوشته که حاصل ${factFa(small, part)} است) — ضرب را می‌شکند ولی یک تکه‌اش را جا می‌اندازد.`,
  });
}

/** E_ZERO_PROPERTY — خطا در ضرب‌های ×۰ یا نوشتن صفر به‌جای جواب (≥۲ مورد) */
function detectZeroProperty(rows: Row[], push: (c: Candidate) => void): void {
  const zeroFacts = rows.filter((r) => r.a === 0 || r.b === 0);
  const zeroWrong = zeroFacts.filter((r) => !r.correct);
  const answeredZero = rows.filter(
    (r) => !r.correct && r.submitted === 0 && r.a !== 0 && r.b !== 0
  );
  const evidence = [...zeroWrong, ...answeredZero];
  if (evidence.length < 2) return;
  const subset = [...zeroFacts, ...answeredZero];
  const st = statsOf(subset);
  const ex = evidence[0];
  push({
    code: 'E_ZERO_PROPERTY',
    confidence: 0.8 + Math.min(0.06, (evidence.length - 2) * 0.02),
    ...st,
    sampleFacts: sampleFactsOf(evidence),
    patternFa: `${toFa(evidence.length)} بار در ضرب‌های صفر (یا هر ضربی) جواب را صفر نوشته (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? 0)} زده) — هنوز نگرفته که هر چیزی در صفر ضرب شود، صفر می‌شود.`,
  });
}

/** E_IDENTITY_CONFUSION — خطا در ضرب‌های ×۱ (≥۲ مورد) */
function detectIdentityConfusion(rows: Row[], push: (c: Candidate) => void): void {
  const oneRows = rows.filter((r) => r.a === 1 || r.b === 1);
  const oneWrong = oneRows.filter((r) => !r.correct);
  if (oneWrong.length < 2) return;
  const st = statsOf(oneRows);
  const ex = oneWrong[0];
  push({
    code: 'E_IDENTITY_CONFUSION',
    confidence: 0.75 + Math.min(0.05, (oneWrong.length - 2) * 0.02),
    ...st,
    sampleFacts: sampleFactsOf(oneWrong),
    patternFa: `${toFa(oneWrong.length)} بار در ضرب‌های «هر عدد در ${toFa(1)}» جواب اشتباه داده (مثلاً ${factFa(ex.a, ex.b)} را ${toFa(ex.submitted ?? ex.a * ex.b)} زده) — هنوز نگرفته که ضرب در ${toFa(1)} هیچ چیزی را عوض نمی‌کند.`,
  });
}

/** E_PERSISTENT_GUESSING — پاسخ‌های غلطِ خیلی سریع (میانهٔ زمان < ۲ ثانیه) با تعداد ≥۴ */
function detectPersistentGuessing(rows: Row[], push: (c: Candidate) => void): void {
  const wrongs = rows.filter((r) => !r.correct);
  if (wrongs.length < 4) return;
  const med = median(wrongs.map((r) => r.timeSec));
  if (med >= 2) return;

  // بونوس حدس‌مانند: چند مقدار تکراری غلط (مثلاً همه ۱۲)
  const counts = new Map<number, number>();
  for (const r of wrongs) {
    if (r.submitted !== null && r.submitted !== r.a * r.b) {
      counts.set(r.submitted, (counts.get(r.submitted) ?? 0) + 1);
    }
  }
  let modeVal = 0;
  let modeCount = 0;
  for (const [val, cnt] of counts) {
    if (cnt > modeCount) {
      modeVal = val;
      modeCount = cnt;
    }
  }
  const guessy = modeCount >= 3;
  const st = statsOf(rows);
  push({
    code: 'E_PERSISTENT_GUESSING',
    confidence: 0.6 + (guessy ? 0.1 : 0),
    attempts: st.attempts,
    errorRate: st.errorRate,
    medianTimeSec: med,
    sampleFacts: sampleFactsOf(wrongs),
    patternFa: guessy
      ? `${toFa(wrongs.length)} پاسخ نادرست در کمتر از دو ثانیه ثبت شده و چند بار یک عدد تکراری (${toFa(modeVal)}) نوشته شده است — پاسخ‌ها با حدس زدن و بدون فکر کردن داده می‌شوند.`
      : `${toFa(wrongs.length)} پاسخ نادرست با میانهٔ زمانِ کمتر از دو ثانیه ثبت شده است — پاسخ‌ها پیش از آنکه فضا برای فکر کردن باشد زده می‌شوند؛ نشانهٔ حدس زدن به‌جای حساب کردن.`,
  });
}

/** E_FATIGUE_SLIP — افت دقت نیمهٔ دوم تمرین همراه با کند شدن پاسخ‌ها */
function detectFatigueSlip(rows: Row[], push: (c: Candidate) => void): void {
  if (rows.length < 12) return; // حداقل ۶ تلاش در هر نیمه
  const half = Math.floor(rows.length / 2);
  const first = rows.slice(0, half);
  const second = rows.slice(half);
  const acc = (subset: Row[]) => subset.filter((r) => r.correct).length / subset.length;
  const accFirst = acc(first);
  const accSecond = acc(second);
  const medFirst = median(first.map((r) => r.timeSec));
  const medSecond = median(second.map((r) => r.timeSec));
  if (accFirst - accSecond < 0.2 || medSecond <= medFirst) return;

  const secondWrong = second.filter((r) => !r.correct);
  const st = statsOf(second);
  push({
    code: 'E_FATIGUE_SLIP',
    confidence: 0.55,
    ...st,
    sampleFacts: sampleFactsOf(secondWrong),
    patternFa: `در نیمهٔ دوم تمرین دقت افت می‌کند (حدود ٪${toFa(Math.round(accFirst * 100))} به ٪${toFa(Math.round(accSecond * 100))}) و پاسخ‌ها کندتر می‌شوند — این افت با ندانستن فرق دارد و با استراحت کوتاه برطرف می‌شود.`,
  });
}

// ─── نقطهٔ ورود موتور ───

/**
 * تشخیص ۱۲خطا برای یک دانش‌آموز — حداکثر ۳ تشخیص قوی، مرتب بر اساس confidence نزولی.
 * قطعی و Pure: بدون دسترسی به دیتابیس/شبکه/زمان سیستم.
 */
export function computeDiagnoses(questions: DiagnosisQuestionRow[]): DiagnosisItem[] {
  const rows = normalize(questions);
  if (rows.length === 0) return [];

  const candidates: Candidate[] = [];
  const push = (c: Candidate) => candidates.push(c);

  detectZeroProperty(rows, push);
  detectIdentityConfusion(rows, push);
  detectAddConfusion(rows, push);
  detectSkipCounting(rows, push);
  detectCommutative(rows, push);
  detectPlaceShift(rows, push);
  detectDoublingHalving(rows, push);
  detectAnchorDrift(rows, push);
  detectDistributiveLeak(rows, push);
  detectPersistentGuessing(rows, push);
  detectFatigueSlip(rows, push);

  // مرتب‌سازی قطعی: confidence نزولی، سپس شواهد بیشتر، سپس کد (برای پایداری ترتیب)
  candidates.sort(
    (p, q) =>
      q.confidence - p.confidence ||
      q.attempts - p.attempts ||
      p.code.localeCompare(q.code)
  );
  return candidates.slice(0, 3).map(toDiagnosis);
}
