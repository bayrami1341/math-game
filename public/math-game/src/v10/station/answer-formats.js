// answer-formats.js — موتور قالب‌های پاسخ ۶-قالبی (BP-016 فاز الف + BP-017 فاز ب/ج)
//
// هر ۶ قالب واژه‌نامهٔ ANSWER_FORMAT_VALUES حالا قابل بازی‌اند:
//   فاز الف: گزینه‌ای / عدد / کسر (و مخلوط)
//   فاز ب:   محور عددی / زوج‌سازی
//   فاز ج:   شکل/نمودار (۴ زیرقالب: fraction-shape / area-cells / symmetry / bar-chart)
//
// اصول:
//   - خالص و بدون DOM — کاملاً تست‌پذیر با node --test
//   - سازگار با پارسر W8 (parseOptionValue) — همان قرارداد ارقام فارسی/عربی
//   - هیچ عدد جادویی دامنه‌ای جدید؛ مرز کتاب ۰..۹۹۹۹ همان T4/W8 است
//   - قرارداد renderHint (BP-017): رشتهٔ «key:value؛key:value» با جداکنندهٔ «;»
//     مثال: 'subkind:number-line;min:0;max:10;step:1;tolerance:0.001'
//     کلید «subkind» زیرقالب «شکل/نمودار» را تعیین می‌کند؛ renderHint غایب/بدشکل
//     هرگز قرمز نیست — فقط هشدار/رفتار پیش‌فرض (سازگاری با ۹۲+۲۰ سؤال میراثی).

import {
  parseOptionValue,
  isFracValue,
  makeFrac
} from './cartridge-schema.js';

export const FORMAT_MCQ = 'گزینه‌ای';
export const FORMAT_NUMBER = 'عدد';
export const FORMAT_FRACTION = 'کسر';
export const FORMAT_NUMBER_LINE = 'محور عددی';
export const FORMAT_MATCHING = 'زوج‌سازی';
export const FORMAT_FIGURE = 'شکل/نمودار';

/** قالب‌های قابل بازی (BP-017: همهٔ ۶ قالب واژه‌نامه) */
export const PLAYABLE_FORMATS = Object.freeze([
  FORMAT_MCQ, FORMAT_NUMBER, FORMAT_FRACTION,
  FORMAT_NUMBER_LINE, FORMAT_MATCHING, FORMAT_FIGURE
]);

/** همهٔ قالب‌های قانون ۶-قالبی */
export const ALL_FORMATS = Object.freeze([
  FORMAT_NUMBER, FORMAT_MCQ, FORMAT_MATCHING, FORMAT_FIGURE, FORMAT_NUMBER_LINE, FORMAT_FRACTION
]);

/** زیرقالب‌های مجاز «شکل/نمودار» (BP-017 T3) */
export const FIGURE_SUBKINDS = Object.freeze(['fraction-shape', 'area-cells', 'symmetry', 'bar-chart']);
export const FORMAT_HINT_FORMATS = Object.freeze([FORMAT_NUMBER_LINE, FORMAT_MATCHING, FORMAT_FIGURE]);

// ── ابزارهای نرمال‌سازی ──────────────────────────────────────────────────────

/** یک کسر را به ساده‌ترین صورت استاندارد می‌رساند (مخالف مثبت/مخرج مثبت + gcd) */
function normalizeFracPair(num, den) {
  const f = makeFrac(num, den);
  if (!f) return null;
  return { num: f.num, den: f.den };
}

/**
 * تحلیل ورودی آزاد کاربر به کسر استاندارد:
 *   «۳/۴» → {3,4}   «۶/۸» → {3,4}   «۲» → {2,1}
 *   «۱ ۱/۲» (مخلوط) → {3,2}        ارقام فارسی/عربی پذیرفته است
 * خروجی: {num, den} یا null (ورودی نامعتبر)
 */
export function parseUserFraction(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // یکسان‌سازی جداکننده‌ها: ٫ ⁄ ⁄ ﹒ و ممیز فارسی → /
  s = s.replace(/[٫⁄ﻕ﹒]/g, '/').replace(/\s*\/\s*/g, '/').replace(/\u066B/g, '/');
  // ارقام فارسی/عربی → لاتین (هم‌راستا با model-figures.normalizeDigits)
  s = s.replace(/[۰-۹٠-٩]/g, d => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(d) % 10));
  // مخلوط: «w n/d» → (w*d+n)/d
  const mixed = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const w = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    if (d <= 0 || w < 0 || n >= d) return null; // مخلوط استاندارد: بخش صحیح ≥۰ و صورت < مخرج
    const sign = w < 0 ? -1 : 1;
    return normalizeFracPair(sign * (Math.abs(w) * d + n), d);
  }
  const frac = /^(-?\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    if (d <= 0) return null;
    return normalizeFracPair(n, d);
  }
  // عدد صحیح
  if (/^-?\d+$/.test(s)) {
    const v = Number(s);
    if (!Number.isSafeInteger(v)) return null;
    return normalizeFracPair(v, 1);
  }
  return null;
}

/** ورودی عددی کاربر → عدد امن یا null (ارقام فارسی/عربی هم پذیرفته می‌شود) */
export function parseUserNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/[۰-۹٠-٩]/g, d => String('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(d) % 10));
  if (!/^-?\d+$/.test(s)) return null;
  const v = Number(s);
  return Number.isSafeInteger(v) ? v : null;
}

// ── قرارداد renderHint (BP-017) ──────────────────────────────────────────────

/**
 * پارسر مینی-گرامر renderHint: «key:value;key:value»
 *   - مقدار عددی‌نما → Number؛ بقیه رشتهٔ خام (تریم‌شده)
 *   - کلید «subkind» جدا برمی‌گردد (زیرقالب شکل/نمودار)
 * خروجی: { subkind: string|null, params: object, raw: string } یا null (بدشکل/تهی)
 */
export function parseRenderHint(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const params = {};
  for (const chunk of text.split(';')) {
    const part = chunk.trim();
    if (!part) continue;
    const i = part.indexOf(':');
    if (i <= 0) return null; // تکهٔ بدون «key:value» → کل hint بدشکل
    const key = part.slice(0, i).trim();
    const valStr = part.slice(i + 1).trim();
    if (!key || !valStr) return null;
    params[key] = /^-?\d+(\.\d+)?$/.test(valStr) ? Number(valStr) : valStr;
  }
  const subkind = typeof params.subkind === 'string' ? params.subkind : null;
  return { subkind, params, raw: text };
}

/** استخراج زیرقالب «شکل/نمودار» — خارج از واژه‌نامه → null */
export function figureSubkind(q) {
  const hint = parseRenderHint(q?.renderHint);
  const sk = hint?.subkind ?? null;
  return sk && FIGURE_SUBKINDS.includes(sk) ? sk : null;
}

/**
 * پارامترهای محور عددی از renderHint — با پیش‌فرض‌های امن وقتی hint غایب است.
 * tolerance پیش‌فرض = نصف گام (پذیرش «نزدیک‌ترین درجه» حتی بدون hint).
 * خروجی null = پارامترها برای بازی نامعتبر (شبکهٔ درجه‌ها نمی‌بندد).
 */
export function numberLineParams(q) {
  const p = parseRenderHint(q?.renderHint)?.params ?? {};
  const min = Number.isFinite(Number(p.min)) ? Number(p.min) : 0;
  const max = Number.isFinite(Number(p.max)) ? Number(p.max) : 10;
  const step = Number.isFinite(Number(p.step)) && Number(p.step) > 0 ? Number(p.step) : 1;
  const tolerance = Number.isFinite(Number(p.tolerance)) && Number(p.tolerance) >= 0
    ? Number(p.tolerance)
    : step / 2;
  const ticks = (max - min) / step;
  if (!Number.isFinite(ticks) || ticks <= 0 || ticks > 60 || !Number.isInteger(ticks)) return null;
  return { min, max, step, tolerance, ticks };
}

/**
 * تعداد خانه‌های شکلِ «کسر روی شکل» — از renderHint (cells) یا پیش‌فرض مخرج ساده‌شده.
 * پیش‌شرط بازی‌پذیری: مخرج ساده‌شده باید تعداد خانه‌ها را عادلانه تقسیم کند
 * (وگرنه رنگ‌آمیزی دقیقِ هدف روی شکل ممکن نیست → null).
 */
export function fractionShapeCells(q) {
  const f = q?.answerFrac ? normalizeFracPair(Number(q.answerFrac.num), Number(q.answerFrac.den)) : null;
  if (!f) return null;
  const hinted = parseRenderHint(q?.renderHint)?.params?.cells;
  const cells = Number.isFinite(Number(hinted)) && Number(hinted) >= 2 ? Math.floor(Number(hinted)) : f.den;
  if (cells > 36) return null; // سقف منطقی شبکه — شلوغی لمسی
  return cells % f.den === 0 ? cells : null;
}

/** هدفِ «کسر روی شکل»: تعداد خانه‌ای که باید رنگ شود (num × cells/den پس از ساده‌سازی) */
export function fractionShapeTarget(q) {
  const cells = fractionShapeCells(q);
  const f = q?.answerFrac ? normalizeFracPair(Number(q.answerFrac.num), Number(q.answerFrac.den)) : null;
  if (!cells || !f) return null;
  const perPart = cells / f.den;
  return { cells, num: f.num, den: f.den, shaded: f.num * perPart };
}

// ── تشخیص قالب و قابل‌بازی بودن ─────────────────────────────────────────────

/** قالب مؤثر سؤال: answerFormat معتبر؛ در غیاب آن، presence گزینه‌ها = گزینه‌ای (سازگاری پسین) */
export function effectiveFormat(q) {
  if (!q) return null;
  if (typeof q.answerFormat === 'string' && ALL_FORMATS.includes(q.answerFormat)) return q.answerFormat;
  if (Array.isArray(q.options) && q.options.length > 0) return FORMAT_MCQ;
  return null;
}

/** قاعدهٔ مشترک زوج‌ها — زوج‌سازی: آرایهٔ ۲..۵ جفتِ {left,right} رشته‌ایِ یکتا */
function validMatches(matches) {
  if (!Array.isArray(matches) || matches.length < 2 || matches.length > 5) return false;
  const lefts = new Set();
  const rights = new Set();
  for (const m of matches) {
    if (!m || typeof m.left !== 'string' || !m.left.trim() || typeof m.right !== 'string' || !m.right.trim()) return false;
    const l = m.left.trim();
    const r = m.right.trim();
    if (lefts.has(l) || rights.has(r)) return false; // چپ/راست تکراری → جفت‌سازی مبهم
    lefts.add(l);
    rights.add(r);
  }
  return true;
}

/** قاعدهٔ دادهٔ نمودار میله‌ای: آرایهٔ ۲..۸ {label رشته، value عدد متناهی} */
function validChartData(chartData) {
  if (!Array.isArray(chartData) || chartData.length < 2 || chartData.length > 8) return false;
  return chartData.every(d =>
    d && typeof d.label === 'string' && d.label.trim() && Number.isFinite(Number(d.value))
  );
}

/** آیا این سؤال با موتور ۶-قالبی قابل بازی است؟ */
export function isPlayable(q) {
  const fmt = effectiveFormat(q);
  if (!PLAYABLE_FORMATS.includes(fmt)) return false;
  if (fmt === FORMAT_MCQ) {
    return Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answerIndex)
      && q.answerIndex >= 0 && q.answerIndex <= 3;
  }
  if (fmt === FORMAT_NUMBER) {
    return Number.isFinite(Number(q.answerValue));
  }
  if (fmt === FORMAT_FRACTION) {
    const f = q.answerFrac;
    return !!f && Number.isFinite(Number(f.num)) && Number.isFinite(Number(f.den)) && Number(f.den) > 0;
  }
  if (fmt === FORMAT_NUMBER_LINE) {
    const v = Number(q.answerValue);
    if (!Number.isFinite(v)) return false;
    const p = numberLineParams(q);
    if (!p) return false;
    return v >= p.min - p.tolerance && v <= p.max + p.tolerance;
  }
  if (fmt === FORMAT_MATCHING) {
    return validMatches(q.matches);
  }
  if (fmt === FORMAT_FIGURE) {
    const sk = figureSubkind(q);
    if (sk === 'fraction-shape') return fractionShapeTarget(q) !== null;
    if (sk === 'area-cells') return Number.isFinite(Number(q.answerValue));
    if (sk === 'symmetry') {
      return Array.isArray(q.figureOptions) && q.figureOptions.length >= 2
        && q.figureOptions.every(o => typeof o === 'string' && o.trim())
        && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.figureOptions.length;
    }
    if (sk === 'bar-chart') {
      return validChartData(q.chartData) && Number.isFinite(Number(q.answerValue));
    }
    return false; // بدون renderHint/زیرقالب ناشناخته → skip (هشدار در schema، نه قرمز)
  }
  return false;
}

// ── سنجش پاسخ ────────────────────────────────────────────────────────────────

/**
 * سنجش پاسخ زوج‌سازی — قرارداد خالص (BP-017 T2):
 * userInput = آرایهٔ جفت‌های [leftIdx, rightIdx] (ایندکس‌ها روی q.matches)
 * یا شیء {pairs: [[l,r], ...]}. ستون راست در UI شافل نمایشی می‌شود ولی
 * ایندکسِ اصلی حفظ می‌شود؛ پس جفتِ درست برای leftIdx همیشه rightIdx = همان i است.
 * خروجی: { correct, normalized, correctCount, total, reason? }
 */
export function checkMatchingAnswer(q, userInput) {
  const matches = Array.isArray(q?.matches) ? q.matches : null;
  const total = matches ? matches.length : 0;
  if (!total || !validMatches(matches)) {
    return { correct: false, normalized: '', correctCount: 0, total, reason: 'bad-question' };
  }
  const pairs = Array.isArray(userInput)
    ? userInput
    : (userInput && Array.isArray(userInput.pairs) ? userInput.pairs : null);
  if (!pairs) {
    return { correct: false, normalized: '', correctCount: 0, total, reason: 'bad-pairs-shape' };
  }
  const seenLefts = new Set();
  let correctCount = 0;
  let shapeOk = true;
  for (const pair of pairs) {
    const l = Array.isArray(pair) ? pair[0] : pair?.left;
    const r = Array.isArray(pair) ? pair[1] : pair?.right;
    if (!Number.isInteger(l) || !Number.isInteger(r) || l < 0 || r < 0 || l >= total || r >= total) {
      shapeOk = false;
      break;
    }
    if (seenLefts.has(l)) { shapeOk = false; break; } // هر آیتم چپ فقط یک جفت
    seenLefts.add(l);
    if (r === l) correctCount++;
  }
  if (!shapeOk) {
    return { correct: false, normalized: `${correctCount}/${total}`, correctCount, total, reason: 'bad-pairs-shape' };
  }
  const correct = correctCount === total;
  return {
    correct,
    normalized: `${correctCount}/${total}`,
    correctCount,
    total,
    reason: correct ? undefined : (pairs.length < total ? 'incomplete' : 'wrong-pairs')
  };
}

/**
 * سنجش پاسخ «شکل/نمودار» بر اساس زیرقالب (BP-017 T3):
 *   fraction-shape: userInput = تعداد خانه‌های رنگ‌شده (عدد یا رشتهٔ رقم)
 *   area-cells / bar-chart: userInput = عدد (پاسخ شمارشی)
 *   symmetry: userInput = ایندکس گزینهٔ شکل (۰..n-1)
 */
export function checkFigureAnswer(q, userInput) {
  const sk = figureSubkind(q);
  const bad = normalized => ({ correct: false, normalized, reason: 'bad-answer' });
  if (sk === 'fraction-shape') {
    const target = fractionShapeTarget(q);
    if (!target) return { correct: false, normalized: String(userInput ?? ''), reason: 'bad-question' };
    const n = parseUserNumber(userInput);
    if (n === null) return bad(String(userInput ?? ''));
    return { correct: n === target.shaded, normalized: String(n) };
  }
  if (sk === 'area-cells' || sk === 'bar-chart') {
    const v = parseUserNumber(userInput);
    if (v === null) return bad(String(userInput ?? ''));
    const expected = Number(q.answerValue);
    return { correct: v === expected, normalized: String(v) };
  }
  if (sk === 'symmetry') {
    const idx = typeof userInput === 'number' ? userInput : parseUserNumber(userInput);
    if (idx === null || !Number.isInteger(idx) || idx < 0 || idx >= (q.figureOptions?.length ?? 0)) {
      return bad(String(userInput ?? ''));
    }
    return { correct: idx === q.correct, normalized: String(idx) };
  }
  return { correct: false, normalized: String(userInput ?? ''), reason: 'unknown-subkind' };
}

/**
 * سنجش پاسخ سؤال کارتریجی.
 * userInput:
 *   - گزینه‌ای: شمارهٔ گزینه (۰..۳) به‌صورت عدد یا رشته
 *   - عدد: رشتهٔ آزاد کاربر («۱۲»)
 *   - کسر: رشتهٔ آزاد کاربر («۳/۴» یا «۱ ۱/۲»)
 *   - محور عددی: مقدار نقطهٔ انتخاب‌شده (عدد یا رشتهٔ رقم) — پذیرش با تلورانس
 *   - زوج‌سازی: [[leftIdx, rightIdx], ...] یا {pairs: [...]}
 *   - شکل/نمودار: بسته به زیرقالب (تعداد خانه/عدد/ایندکس گزینه)
 * خروجی: { correct: boolean, normalized: string, reason?: string }
 */
export function checkCartridgeAnswer(q, userInput) {
  const fmt = effectiveFormat(q);
  if (fmt === FORMAT_MCQ) {
    const idx = typeof userInput === 'number' ? userInput : parseUserNumber(userInput);
    if (idx === null || idx < 0 || idx > 3) {
      return { correct: false, normalized: String(userInput ?? ''), reason: 'bad-index' };
    }
    return { correct: idx === q.answerIndex, normalized: `گزینهٔ ${idx + 1}` };
  }
  if (fmt === FORMAT_NUMBER) {
    const v = parseUserNumber(userInput);
    if (v === null) return { correct: false, normalized: String(userInput ?? ''), reason: 'bad-number' };
    const expected = Number(q.answerValue);
    return { correct: v === expected, normalized: String(v) };
  }
  if (fmt === FORMAT_FRACTION) {
    const got = parseUserFraction(userInput);
    if (!got) return { correct: false, normalized: String(userInput ?? ''), reason: 'bad-fraction' };
    const expected = normalizeFracPair(Number(q.answerFrac.num), Number(q.answerFrac.den));
    if (!expected) return { correct: false, normalized: `${got.num}/${got.den}`, reason: 'bad-expected' };
    const correct = got.num === expected.num && got.den === expected.den;
    return { correct, normalized: `${got.num}/${got.den}` };
  }
  if (fmt === FORMAT_NUMBER_LINE) {
    const clicked = typeof userInput === 'number' ? userInput : parseUserNumber(userInput);
    if (clicked === null) return { correct: false, normalized: String(userInput ?? ''), reason: 'bad-number' };
    const expected = Number(q.answerValue);
    const { tolerance } = numberLineParams(q) ?? { tolerance: 0.5 };
    const correct = Math.abs(clicked - expected) <= tolerance;
    return { correct, normalized: String(clicked) };
  }
  if (fmt === FORMAT_MATCHING) {
    const r = checkMatchingAnswer(q, userInput);
    return { correct: r.correct, normalized: r.normalized, reason: r.reason };
  }
  if (fmt === FORMAT_FIGURE) {
    return checkFigureAnswer(q, userInput);
  }
  return { correct: false, normalized: String(userInput ?? ''), reason: 'unplayable-format' };
}

// ── نردبان داربست دامنه‌ای (BP-017 T4) ───────────────────────────────────────

/**
 * نردبان راهنمای هر قالب — خالص و فارسی.
 * attemptNo از ۰: تعداد تلاش‌های ناموفق تا الان (۰ = نخستین راهنما بعد از خطا).
 * سیاست ضدنشت: هیچ پله‌ای پاسخ (توکن عددی مستقل یا تعداد دقیق خانه‌ها) را افشا نمی‌کند.
 * قالب‌های فاز الف (گزینه‌ای/عدد/کسر) → null (رفتار نردبان قدیمی دست‌نخورده).
 */
export function formatHint(format, question, attemptNo = 0) {
  if (!FORMAT_HINT_FORMATS.includes(format)) return null;
  const step = Math.max(0, Math.min(2, Number(attemptNo) || 0));
  if (format === FORMAT_NUMBER_LINE) {
    return [
      'روی محور به درجه‌ها نگاه کن؛ هر درجه یک قدم است.',
      'از صفر شروع کن و قدم‌به‌قدم بشمار؛ مقصد را بین درجه‌ها پیدا کن.',
      'نقطه را روی درجه‌ای بگذار که فاصله‌اش تا هدف کمترین است.'
    ][step];
  }
  if (format === FORMAT_MATCHING) {
    return [
      'یک آیتم از ستون چپ انتخاب کن، بعد جفتش را از ستون راست پیدا کن.',
      'آیتم‌هایی که جفت می‌شوند رابطهٔ خانوادهٔ ضرب‌وتقسیم دارند؛ حاصل را بشمار.',
      'هر آیتم فقط یک جفت دارد؛ اگر جفت غلط شد، دوباره آرام نگاه کن.'
    ][step];
  }
  if (format === FORMAT_FIGURE) {
    const sk = figureSubkind(question);
    if (sk === 'fraction-shape') {
      return [
        'اول بشمار شکل چند خانهٔ مساوی دارد.',
        'مخرج = کل خانه‌ها؛ صورت = خانه‌هایی که باید رنگ شوند.',
        'کسرهای هم‌ارز روی شکل رنگِ یکسانی دارند؛ به گروه‌بندی خانه‌ها نگاه کن.'
      ][step];
    }
    if (sk === 'area-cells') {
      return [
        'هر مربع کوچک یک خانهٔ واحد است؛ فقط خانه‌های کامل داخل شکل می‌شمارند.',
        'سطر به سطر بشمار تا چیزی از دستت نرود یا دوبار نشماری.',
        'می‌توانی ردیف‌ها را جمع بزنی: خانه‌های هر ردیف × تعداد ردیف‌های کامل.'
      ][step];
    }
    if (sk === 'symmetry') {
      return [
        'تصور کن شکل را تا می‌زنی؛ دو نیمه باید دقیقاً روی هم بیفتند.',
        'خط تقارن شکل را به دو قسمت آینه‌ای تقسیم می‌کند.',
        'به جهتهای عمودی و افقی جداگانه نگاه کن؛ بعضی شکل‌ها فقط از یک جهت متقارن‌اند.'
      ][step];
    }
    if (sk === 'bar-chart') {
      return [
        'ارتفاع هر میله مقدار آن را روی محور عمودی نشان می‌دهد.',
        'میله‌ها را با هم مقایسه کن؛ بلندترین میله بیشترین مقدار است.',
        'اندازهٔ میله را با درجه‌های محور بخوان؛ هر درجه یک قدم است.'
      ][step];
    }
    return null;
  }
  return null;
}

// ── پل کارتریج → نشست بازی ───────────────────────────────────────────────────

function extractF1F2(prompt) {
  // برای دسته‌بندی خطا (اطلس ۱۲خطا) — فقط اگر صورت مسئله صریحاً a×b باشد
  try {
    const m = /(\d+)\s*[×✕x]\s*(\d+)/.exec(String(prompt || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
    if (m) return { f1: Number(m[1]), f2: Number(m[2]) };
  } catch { /* بی‌خطر */ }
  return { f1: null, f2: null };
}

/**
 * تبدیل بانک سؤال کارتریج به سؤال‌های قابل بازی نشست (BP-017: هر ۶ قالب).
 * سؤال‌های بدشکل/ناشناخته (دادهٔ ناقص در همان قالب) کنار گذاشته و در
 * skippedInvalid شمرده می‌شوند — دیگر قالبی صرفاً به‌خاطر «فاز ب/ج» رد نمی‌شود.
 * خروجی: { questions: [...], skipped, skippedInvalid, total }
 */
export function adaptCartridgeQuestions(cartridge, { limit = 10, shuffle = true } = {}) {
  const bank = Array.isArray(cartridge?.questionBank) ? cartridge.questionBank : [];
  const picked = [];
  let skipped = 0;
  let skippedInvalid = 0;
  for (const q of bank) {
    if (!isPlayable(q)) { skipped++; skippedInvalid++; continue; }
    const fmt = effectiveFormat(q);
    const { f1, f2 } = extractF1F2(q.prompt);
    const subkind = fmt === FORMAT_FIGURE ? figureSubkind(q) : null;
    picked.push({
      questionId: q.id,
      prompt: String(q.prompt ?? '').trim(),
      answerFormat: fmt,
      cpa: q.cpa ?? null,
      domainCode: q.domainCode ?? null,
      qType: q.qType ?? null,
      renderHint: typeof q.renderHint === 'string' ? q.renderHint : null,
      subkind,
      options: fmt === FORMAT_MCQ ? q.options.map(o => String(o)) : null,
      answerIndex: fmt === FORMAT_MCQ ? q.answerIndex : null,
      answerValue: (fmt === FORMAT_NUMBER || fmt === FORMAT_NUMBER_LINE
        || (fmt === FORMAT_FIGURE && (subkind === 'area-cells' || subkind === 'bar-chart')))
        ? Number(q.answerValue) : null,
      answerFrac: (fmt === FORMAT_FRACTION || (fmt === FORMAT_FIGURE && subkind === 'fraction-shape'))
        ? { num: Number(q.answerFrac.num), den: Number(q.answerFrac.den) } : null,
      numberLine: fmt === FORMAT_NUMBER_LINE ? numberLineParams(q) : null,
      matches: fmt === FORMAT_MATCHING
        ? q.matches.map(m => ({ left: String(m.left).trim(), right: String(m.right).trim() }))
        : null,
      cells: fmt === FORMAT_FIGURE && subkind === 'fraction-shape' ? fractionShapeCells(q) : null,
      figureShape: fmt === FORMAT_FIGURE && subkind === 'area-cells'
        ? (parseRenderHint(q.renderHint)?.params?.shape ?? null)
        : null,
      figureOptions: fmt === FORMAT_FIGURE && subkind === 'symmetry'
        ? q.figureOptions.map(o => String(o)) : null,
      correct: fmt === FORMAT_FIGURE && subkind === 'symmetry' ? q.correct : null,
      chartData: fmt === FORMAT_FIGURE && subkind === 'bar-chart'
        ? q.chartData.map(d => ({ label: String(d.label), value: Number(d.value) }))
        : null,
      f1, f2
    });
  }
  let list = picked;
  if (shuffle && picked.length > 1) {
    list = picked.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  if (limit && limit > 0) list = list.slice(0, limit);
  return { questions: list, skipped, skippedInvalid, total: bank.length };
}
