// answer-formats.js — موتور قالب‌های پاسخ «فاز الف» (BP-016 T1)
//
// سه قالب قابل بازی در فاز الف: گزینه‌ای / عدد / کسر (و مخلوط)
// قالب‌های فاز ب/ج (محور عددی، زوج‌سازی، شکل/نمودار) اینجا فقط شناسایی می‌شوند — هنوز playable نیستند.
//
// اصول:
//   - خالص و بدون DOM — کاملاً تست‌پذیر با node --test
//   - سازگار با پارسر W8 (parseOptionValue) — همان قرارداد ارقام فارسی/عربی
//   - هیچ عدد جادویی دامنه‌ای جدید؛ مرز کتاب ۰..۹۹۹۹ همان T4/W8 است

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

/** قالب‌های قابل بازی در فاز الف (BP-016 T1) */
export const PLAYABLE_FORMATS = Object.freeze([FORMAT_MCQ, FORMAT_NUMBER, FORMAT_FRACTION]);

/** همهٔ قالب‌های قانون ۶-قالبی (فاز ب/ج بعداً اضافه می‌شوند) */
export const ALL_FORMATS = Object.freeze([
  FORMAT_NUMBER, FORMAT_MCQ, FORMAT_MATCHING, FORMAT_FIGURE, FORMAT_NUMBER_LINE, FORMAT_FRACTION
]);

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

// ── تشخیص قالب و قابل‌بازی بودن ─────────────────────────────────────────────

/** قالب مؤثر سؤال: answerFormat معتبر؛ در غیاب آن، presence گزینه‌ها = گزینه‌ای (سازگاری پسین) */
export function effectiveFormat(q) {
  if (!q) return null;
  if (typeof q.answerFormat === 'string' && ALL_FORMATS.includes(q.answerFormat)) return q.answerFormat;
  if (Array.isArray(q.options) && q.options.length > 0) return FORMAT_MCQ;
  return null;
}

/** آیا این سؤال با موتور فاز الف قابل بازی است؟ */
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
  return false;
}

// ── سنجش پاسخ ────────────────────────────────────────────────────────────────

/**
 * سنجش پاسخ سؤال کارتریجی.
 * userInput:
 *   - گزینه‌ای: شمارهٔ گزینه (۰..۳) به‌صورت عدد یا رشته
 *   - عدد: رشتهٔ آزاد کاربر («۱۲»)
 *   - کسر: رشتهٔ آزاد کاربر («۳/۴» یا «۱ ۱/۲»)
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
  return { correct: false, normalized: String(userInput ?? ''), reason: 'unplayable-format' };
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
 * تبدیل بانک سؤال کارتریج به سؤال‌های قابل بازی نشست (فاز الف).
 * سؤال‌های غیرقابل‌بازی (قالب‌های فاز ب/ج یا بدشکل) کنار گذاشته و شمرده می‌شوند.
 * خروجی: { questions: [...], skipped: n, total: n }
 */
export function adaptCartridgeQuestions(cartridge, { limit = 10, shuffle = true } = {}) {
  const bank = Array.isArray(cartridge?.questionBank) ? cartridge.questionBank : [];
  const picked = [];
  let skipped = 0;
  for (const q of bank) {
    if (!isPlayable(q)) { skipped++; continue; }
    const fmt = effectiveFormat(q);
    const { f1, f2 } = extractF1F2(q.prompt);
    picked.push({
      questionId: q.id,
      prompt: String(q.prompt ?? '').trim(),
      answerFormat: fmt,
      cpa: q.cpa ?? null,
      domainCode: q.domainCode ?? null,
      qType: q.qType ?? null,
      options: fmt === FORMAT_MCQ ? q.options.map(o => String(o)) : null,
      answerIndex: fmt === FORMAT_MCQ ? q.answerIndex : null,
      answerValue: fmt === FORMAT_NUMBER ? Number(q.answerValue) : null,
      answerFrac: fmt === FORMAT_FRACTION
        ? { num: Number(q.answerFrac.num), den: Number(q.answerFrac.den) }
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
  return { questions: list, skipped, total: bank.length };
}
