// ─────────────────────────────────────────────────────────────────────────────
// مسیریاب تشخیص خطا — قرارداد M09/M10 (BP-022، فرمان مالک trace 1a1681e84a8d3cad)
//
// یک دروازهٔ واحد برای زنجیرهٔ سه‌طبقهٔ تشخیص:
//   ۱) errors.js/classifyAttempt  → ضرب خام (مسیر میراثی؛ رفتار امروز دست‌نخورده)
//   ۲) errors-v103.js/classifyV103 → خانوادهٔ ۲/۳ (الگوریتم ستونی: گره/قرض، ارزش مکانی، تقسیم)
//   ۳) errors-w8.js/classifyW8     → پنج خانوادهٔ W8 (کسر، هندسه/اندازه‌گیری،
//                                    داده/احتمال، تقسیم با خارج‌قسمت/باقیمانده، عملیات عددی)
//
// قواعد فرمان مالک که این ماژول اجرا می‌کند:
//   • دامنه per-book/per-grade — نه گسترش بی‌قاعدهٔ سقف عمومی: هر عملیات فقط در
//     بازهٔ کتاب/پایهٔ خودش طبقه‌بندی می‌شود؛ بیرون بازه = بی‌الگو با دلیل صریح.
//   • کدهای W8 تا مُهر انسانی «پیشنهادی» می‌مانند — این ماژول هرگز کدی به اطلس
//     رسمی نمی‌نویسد؛ فقط برچسب وضعیت می‌دهد.
//   • سازگاری پسین کامل: سؤال بدون op مثل امروز فقط با f1&f2 ضربی طبقه‌بندی می‌شود.
//
// قرارداد خروجی: { code: string|null, engine: 'attempt'|'v103'|'w8'|null, reason: string }
// خالص است: هیچ وابستگی به DOM/FS/صدا/وضعیت بازی ندارد و هرگز استثنا نمی‌دهد.
// ─────────────────────────────────────────────────────────────────────────────

import { classifyAttempt, ERROR_CODES } from './errors.js';
import { classifyV103, CODES_V103 } from './errors-v103.js';
import { classifyW8, CODES_W8 } from './errors-w8.js';

// ── جدول اتصال عملیات → موتور (آینهٔ OPERATION-CONTRACT.json — تستِ ضد واگرایی دارد) ──
export const OP_ENGINES = Object.freeze({
  // ضرب خام (میراثی)
  mult_fact: 'attempt',
  // خانوادهٔ ۲/۳ — v103
  sum: 'v103',
  sub: 'v103',
  mulcol: 'v103',
  div: 'v103',
  read: 'v103',
  // پنج خانوادهٔ W8 — پیشوندها و عملیات صریح، عین classifyW8
  frac_part_whole: 'w8',
  frac_equiv_num: 'w8',
  frac_add: 'w8',
  frac_sub: 'w8',
  frac_compare: 'w8',
  frac_of_quantity: 'w8',
  perimeter_rect: 'w8',
  perimeter_square: 'w8',
  perimeter_polygon: 'w8',
  area_rect: 'w8',
  area_square: 'w8',
  compound_to_minor: 'w8',
  clock_to_24h: 'w8',
  clock_elapsed: 'w8',
  ruler_offset: 'w8',
  symmetry_axes: 'w8',
  probability: 'w8',
  pictograph_value: 'w8',
  table_query: 'w8',
  divide_qr: 'w8',
  place_value: 'w8',
  column_add: 'w8',
  column_sub: 'w8',
  round: 'w8'
});

const W8_CODE_SET = new Set(Object.keys(CODES_W8));
const V103_CODE_SET = new Set(Object.keys(CODES_V103));
const ATTEMPT_CODE_SET = new Set(Object.keys(ERROR_CODES));

export function resolveEngineForOp(op) {
  if (typeof op !== 'string') return null;
  const known = OP_ENGINES[op];
  if (known) return known;
  if (op.startsWith('frac_')) return 'w8'; // عملیات کسری آیندهٔ همین خانواده
  return null;
}

// ── حدهای per-book/per-grade (پیش‌نویس تا مُهر گام صفر معلم) ──────────────────
// null برای یک عملیات یعنی «در این کتاب پشتیبانی آموزشی ندارد» (NOT_SUPPORTED در قرارداد).
export const DEFAULT_BOOK_LIMITS = Object.freeze({
  'KH-G2-MATH': Object.freeze({
    label: 'ریاضی دوم دبستان — چاپ چهاردهم ۱۴۰۴',
    numberRange: Object.freeze({
      default: Object.freeze([0, 9999]),
      sum: Object.freeze([0, 100]),
      sub: Object.freeze([0, 100]),
      mulcol: null,           // ضرب ستونی در پایهٔ دوم نیست
      div: Object.freeze([0, 100]),
      read: Object.freeze([0, 9999])
    }),
    fraction: Object.freeze({
      denMax: 8,
      numMax: 8,
      opAllow: Object.freeze(['frac_part_whole', 'frac_compare', 'frac_of_quantity'])
    }),
    status: 'پیش‌نویس — نیاز به تأیید معلم'
  }),
  'KH-G3-MATH': Object.freeze({
    label: 'ریاضی سوم دبستان',
    numberRange: Object.freeze({
      default: Object.freeze([0, 9999]),
      sum: Object.freeze([0, 9999]),
      sub: Object.freeze([0, 9999]),
      mulcol: Object.freeze([0, 9999]),
      div: Object.freeze([0, 9999]),
      read: Object.freeze([0, 9999])
    }),
    fraction: Object.freeze({
      denMax: 12,
      numMax: 12,
      opAllow: Object.freeze(['frac_part_whole', 'frac_equiv_num', 'frac_add', 'frac_sub', 'frac_compare', 'frac_of_quantity'])
    }),
    status: 'پیش‌نویس — نیاز به تأیید معلم'
  })
});

const SPEC_INT_FIELDS = ['a', 'b', 'dividend', 'divisor', 'quantity', 'total', 'shaded', 'num', 'den', 'target_den'];
const SPEC_FRAC_FIELDS = ['f1', 'f2', 'fraction'];

const isInt = n => Number.isInteger(n);

/** وارسی بازهٔ کتاب برای یک spec — صادقانه: هر چیزی که قابل وارسی نیست، رد نمی‌شود، فقط گارد نمی‌گیرد. */
export function withinBookLimits(op, spec, bookLimits) {
  if (!op || !spec || typeof spec !== 'object' || !bookLimits) return true; // بدون حدها: فقط پشتوانهٔ ماژول‌ها
  const nr = bookLimits.numberRange || {};
  if (Object.prototype.hasOwnProperty.call(nr, op) && nr[op] === null) return false; // op بیرون کتاب
  const range = nr[op] || nr.default || null;
  if (range && (isInt(spec.a) && (spec.a < range[0] || spec.a > range[1]))) return false;
  if (range && (isInt(spec.b) && (spec.b < range[0] || spec.b > range[1]))) return false;

  const fr = bookLimits.fraction || null;
  if (fr) {
    if (fr.opAllow && typeof op === 'string' && op.startsWith('frac_') && !fr.opAllow.includes(op)) return false;
    for (const key of SPEC_FRAC_FIELDS) {
      const f = spec[key];
      if (f && isInt(f.num) && isInt(f.den)) {
        if (Math.abs(f.num) > fr.numMax || f.den <= 0 || f.den > fr.denMax) return false;
      }
    }
    if (isInt(spec.num) && isInt(spec.den) && (Math.abs(spec.num) > fr.numMax || spec.den > fr.denMax)) return false;
  }
  return true;
}

/** ساخت spec از سؤال: opSpec صریح (قرارداد آینده) یا {op,a,b} (حداقلی). */
function buildSpec(question) {
  const opSpec = question?.opSpec;
  if (opSpec && typeof opSpec === 'object' && !Array.isArray(opSpec)) {
    return { op: question.op, ...opSpec };
  }
  const spec = { op: question.op };
  if (question.a !== undefined) spec.a = question.a;
  if (question.b !== undefined) spec.b = question.b;
  return spec;
}

/**
 * مسیریاب یکنواخت برای سؤال کارتریجی.
 * ورودی: { question, submitted, bookLimits? }
 *   - submitted: مقدار نرمالِ verdict (عدد به‌صورت int یا رشتهٔ "a/b" کسر) — عین checkCartridgeAnswer
 * خروجی: { code, engine, reason } — code=null یعنی «درست / بی‌الگو / بیرون قرارداد» (هیچ‌وقت استثنا نمی‌دهد)
 */
export function classifyCartridgeAttempt({ question, submitted, bookLimits } = {}) {
  try {
    const op = question?.op;
    if (typeof op === 'string' && op.length > 0) {
      const engine = resolveEngineForOp(op);
      if (!engine) return { code: null, engine: null, reason: 'op-unknown' };
      const spec = buildSpec(question);
      if (bookLimits && !withinBookLimits(op, spec, bookLimits)) {
        return { code: null, engine, reason: 'out-of-book-range' };
      }
      let code = null;
      // v103 و attempt گارد isInt سخت‌گیرانه دارند — ورودی نرمالِ رشته‌ای عددی به int تبدیل می‌شود؛
      // w8 رشتهٔ «a/b» کسر را خودش با حساب exact می‌پذیرد — دست‌نخورده می‌رود.
      const numSubmitted = typeof submitted === 'string' ? Number(submitted.trim()) : submitted;
      if (engine === 'v103') code = classifyV103(spec, numSubmitted);
      else if (engine === 'w8') code = classifyW8(spec, submitted);
      else code = classifyAttempt({ f1: spec.a ?? question.f1, f2: spec.b ?? question.f2, submitted: numSubmitted });
      return { code: code || null, engine, reason: code ? 'classified' : 'no-pattern' };
    }
    // مسیر میراثی — سؤال بدون op: فقط ضرب با f1&f2 (عین رفتار امروز)
    const f1 = question?.f1;
    const f2 = question?.f2;
    const num = typeof submitted === 'string' ? Number(submitted) : submitted;
    if (f1 != null && f2 != null && isInt(num)) {
      return { code: classifyAttempt({ f1, f2, submitted: num }) || null, engine: 'attempt', reason: 'legacy-mult' };
    }
    return { code: null, engine: null, reason: 'no-op-metadata' };
  } catch {
    return { code: null, engine: null, reason: 'router-guard' };
  }
}

// ── اطلس-لنگر برای گزینهٔ غلط (بدون «طبقه‌بندی» — فقط خواندن ادعای ثبت‌شدهٔ اطلس) ──
const OPTION_LETTERS = ['الف', 'ب', 'ج', 'د'];
export function letterForIndex(i) {
  return OPTION_LETTERS[i] || null;
}

/**
 * کدِ اطلسِ ادعاشده برای یک گزینهٔ غلط — از claims/optionErrorMap کارتریج.
 * وضعیت: «پیشنهادی» اگر نشانگر پیشنهادی داشته باشد یا کد متعلق به CODES_W8 باشد؛
 * در غیر این صورت «رسمی». خروجی: { code, status } | null
 */
export function atlasClaimForWrongOption(question, wrongIndex) {
  if (!question || !isInt(wrongIndex) || wrongIndex < 0 || wrongIndex > 3) return null;
  const letter = letterForIndex(wrongIndex);
  if (!letter) return null;

  const claims = Array.isArray(question.claims) ? question.claims : [];
  const hit = claims.find(c => c && c.letter === letter && typeof c.claim === 'string' && c.claim.trim());
  let codeText = hit ? hit.claim : null;

  if (!codeText && typeof question.optionErrorMap === 'string' && question.optionErrorMap) {
    const m = new RegExp(`${letter}\\s*[→:؛-]\\s*([A-Z][A-Z0-9_]*)`).exec(question.optionErrorMap);
    if (m) codeText = m[1];
    else {
      const m2 = new RegExp(`${letter}\\s*[→:]\\s*([^؛]+)`).exec(question.optionErrorMap);
      if (m2) codeText = m2[1];
    }
  }
  if (!codeText) return null;

  const suggested = /پیشنهادی/.test(codeText);
  const code = (/[A-Z][A-Z0-9_]*/.exec(codeText) || [null])[0];
  if (!code) return null;
  const status = suggested || W8_CODE_SET.has(code) ? 'پیشنهادی' : 'رسمی';
  return { code, status };
}

/**
 * وضعیت رجیستری یک کد (دربارهٔ خودِ کد، نه موتور کاشف):
 *   کد رسمی اطلس ضرب/v103 → «رسمی»
 *   کد مخصوص W8 → «پیشنهادی» (تا مُهر انسانی — قاعدهٔ BP-012)
 *   officialExtra (اختیاری): کدهای رسمی اطلس همان کارتریج — همان‌ها هم «رسمی»اند
 *   ناشناخته → null (صادقانه؛ هرگز رسمیِ ساختگی نیست)
 */
export function codeRegistryStatus(code, officialExtra = null) {
  if (typeof code !== 'string') return null;
  if (ATTEMPT_CODE_SET.has(code) || V103_CODE_SET.has(code)) return 'رسمی';
  if (officialExtra) {
    const extra = officialExtra instanceof Set ? officialExtra : new Set(officialExtra);
    if (extra.has(code)) return 'رسمی';
  }
  if (W8_CODE_SET.has(code)) return 'پیشنهادی';
  return null;
}
