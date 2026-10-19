// ─────────────────────────────────────────────────────────────────────────────
// اطلس تشخیصی خطاهای شناختی ۱۲گانه ضرب (سند پداگوژیک فصل ۳) — نسخهٔ ۱۰.۲
//
// هر پاسخ نادرست به یکی از این کدها برچسب می‌خورد. برچسب، نمره نیست.
// تصمیم نهایی با آموزگار است: کارت معلم سه دکمه دارد — تأیید تشخیص، لغزش موردی، رد تشخیص.
//
// اولویت کدها (نقد فنی نسخهٔ ۱.۲.۰ سند — نقد ۳): یک پاسخ می‌تواند همزمان با چند
// الگو بخواند (نمونه: «۵×۰ → ۵» هم صفر است هم جمع ۵+۰)؛ اولین الگوی این زنجیره
// برچسب می‌گیرد: ZERO > IDENTITY > ADD > PLACE_SHIFT > ANCHOR_DRIFT >
// DISTRIBUTIVE_LEAK > SKIP_OVERCOUNT > SKIP_UNDERCOUNT
// کدهای رفتاری (COMMUTATIVE، FATIGUE) جدا و در سطح تعامل تشخیص داده می‌شوند.
//
// نکتهٔ حمایتی: «بازی را برای همان کودک متوقف کن» اقدام معلم در کلاس است —
// این ماژول هیچ قفل یا توقف خودکاری برای کودک نمی‌سازد.
//
// این ماژول Pure است: هیچ وابستگی به DOM، صدا یا وضعیت بازی ندارد.
// ─────────────────────────────────────────────────────────────────────────────

const isInt = n => Number.isInteger(n);

export const ERROR_CODES = Object.freeze({
  // خطاهای مفهومی
  E_ADD_CONFUSION: 'جمع به جای ضرب',
  E_ZERO_PROPERTY: 'ضرب در صفر',
  E_IDENTITY_CONFUSION: 'ضرب در یک',
  E_COMMUTATIVE_FAIL: 'شکست جابه‌جایی',
  // خطاهای راهبرد
  E_SKIP_OVERCOUNT: 'بیش‌شماری جهش',
  E_SKIP_UNDERCOUNT: 'کم‌شماری جهش',
  E_ANCHOR_DRIFT: 'جا ماندن جزء دوم شکستن',
  E_DOUBLING_HALVING: 'دوبرابر کردن (اختیاری — فقط تمرین معلم)',
  E_PLACE_SHIFT: 'لغزش صفر (ارزش مکانی)',
  E_DISTRIBUTIVE_LEAK: 'جا ماندن یک جزء چندرقمی',
  // خطاهای توجه
  E_PERSISTENT_GUESSING: 'پاسخ‌های بی‌ربط',
  E_FATIGUE_SLIP: 'لغزش بعد از تسلط'
});

// ترتیب شدت برای انتخاب «کد غالب» کارت معلم — خطاهای مفهومیِ شدت بالا اول
export const CODE_SEVERITY_ORDER = Object.freeze([
  'E_ADD_CONFUSION',
  'E_ZERO_PROPERTY',
  'E_PLACE_SHIFT',
  'E_COMMUTATIVE_FAIL',
  'E_DISTRIBUTIVE_LEAK',
  'E_ANCHOR_DRIFT',
  'E_IDENTITY_CONFUSION',
  'E_SKIP_OVERCOUNT',
  'E_SKIP_UNDERCOUNT',
  'E_PERSISTENT_GUESSING',
  'E_FATIGUE_SLIP',
  'E_DOUBLING_HALVING'
]);

// جملهٔ کارت معلم: یک جمله + یک کد. درصد اطمینان، زمان واکنش و دستور درمان روی کارت نیست.
export const CODE_SENTENCES_FA = Object.freeze({
  E_ADD_CONFUSION: 'جمع را به جای ضرب گذاشته.',
  E_ZERO_PROPERTY: 'در ضرب در صفر، حاصل را خود عدد یا یک گذاشته.',
  E_IDENTITY_CONFUSION: 'در ضرب در یک، حاصل را یک گذاشته.',
  E_PLACE_SHIFT: 'صفرها را جا انداخته — ده‌تایی را یکی ندیده.',
  E_ANCHOR_DRIFT: 'جزء دوم شکستن را جا انداخته.',
  E_DISTRIBUTIVE_LEAK: 'بخشی از عددهای چندرقمی را در ضرب جا انداخته.',
  E_SKIP_OVERCOUNT: 'یک پرش اضافه برداشته.',
  E_SKIP_UNDERCOUNT: 'یک پرش کم گذاشته — زودتر توقف کرده.',
  E_COMMUTATIVE_FAIL: 'ترتیب تازه را مسئلهٔ تازه گرفته.',
  E_PERSISTENT_GUESSING: 'بی‌توجه پاسخ داده — سه پاسخ بی‌ربط پشت هم.',
  E_FATIGUE_SLIP: 'روی چیزی که بلد بود لغزش کرده.',
  E_DOUBLING_HALVING: 'در دوبرابر کردن لغزش دارد — فقط در تمرین اختیاری معلم.'
});

/**
 * طبقه‌بندی ساختاری یک پاسخ نادرست از روی خود سه‌تایی (f1, f2, پاسخ‌داده‌شده).
 * خروجی: کد خطا یا null (پاسخ درست / بی‌الگو).
 * بی‌الگو بودن خودش شاهد است: سه پاسخ بی‌الگو در یک جلسه = E_PERSISTENT_GUESSING.
 */
export function classifyAttempt(input = {}) {
  const { f1, f2, submitted } = input || {};
  if (!isInt(f1) || !isInt(f2) || !isInt(submitted)) return null;
  if (f1 < 0 || f2 < 0 || f1 > 999 || f2 > 999) return null;
  if (submitted < 0 || submitted > 9999) return null;

  const p = f1 * f2;
  if (submitted === p) return null; // پاسخ درست — خطا نیست

  // ۱. ضرب در صفر (صفحهٔ ۱۳۶): حاصل را خود عدد یا یک می‌نویسد
  if (f1 === 0 || f2 === 0) {
    const other = Math.max(f1, f2);
    if (submitted === other || submitted === 1) return 'E_ZERO_PROPERTY';
    return null;
  }

  // ۲. ضرب در یک (صفحهٔ ۱۳۶): حاصل را یک می‌نویسد
  if (f1 === 1 || f2 === 1) {
    if (submitted === 1) return 'E_IDENTITY_CONFUSION';
  }

  // ۳. جمع به جای ضرب: حاصل برابر جمع دو عامل
  if (f1 >= 2 && f2 >= 2 && submitted === f1 + f2) return 'E_ADD_CONFUSION';

  // ۴. لغزش صفر (ارزش مکانی): ۱۰ برابر یا یک‌دهمِ مقدار درست
  if (p > 0 && (submitted === p * 10 || (p % 10 === 0 && submitted === p / 10))) {
    return 'E_PLACE_SHIFT';
  }

  // ۵. جا ماندن جزء دوم شکستن (صفحهٔ ۷۰–۷۲، لنگر ۵): یک جزء درست، جزء دوم نیامده
  if (f2 > 5 && submitted === f1 * 5) return 'E_ANCHOR_DRIFT';
  if (f1 > 5 && submitted === f2 * 5) return 'E_ANCHOR_DRIFT';

  // ۶. جا ماندن یک جزء چندرقمی (صفحهٔ ۱۳۹ به بعد): فقط یکی‌ها یا فقط ده‌تایی/صدتایی‌ها
  if (f2 >= 11 && f1 >= 2 && f1 <= 9) {
    const tens = Math.floor(f2 / 10);
    const ones = f2 % 10;
    if (ones > 0 && submitted === f1 * ones) return 'E_DISTRIBUTIVE_LEAK';
    if (tens > 0 && (submitted === f1 * tens || submitted === f1 * tens * 10)) return 'E_DISTRIBUTIVE_LEAK';
  }
  if (f1 >= 11 && f2 >= 2 && f2 <= 9) {
    const tens = Math.floor(f1 / 10);
    const ones = f1 % 10;
    if (ones > 0 && submitted === f2 * ones) return 'E_DISTRIBUTIVE_LEAK';
    if (tens > 0 && (submitted === f2 * tens || submitted === f2 * tens * 10)) return 'E_DISTRIBUTIVE_LEAK';
  }

  // ۷ و ۸. بیش/کم‌شماری جهش: یک پرش کامل کمتر یا بیشتر (± عامل شمارنده)
  if (f2 >= 2 && submitted === p + f2) return 'E_SKIP_OVERCOUNT';
  if (f2 >= 2 && submitted === p - f2) return 'E_SKIP_UNDERCOUNT';
  if (f1 >= 2 && submitted === p + f1) return 'E_SKIP_OVERCOUNT';
  if (f1 >= 2 && submitted === p - f1) return 'E_SKIP_UNDERCOUNT';

  return null;
}

/**
 * کدهای رفتاری — در سطح تعامل، با تاریخچهٔ پذیرش‌های همان جلسه:
 *   E_COMMUTATIVE_FAIL: پس از پذیرش a×b، جابه‌جای آن (b×a) غلط پاسخ داده شد.
 *   E_FATIGUE_SLIP: پس از پذیرش همین عبارت، دوباره غلط پاسخ داده شد (لغزش، برچسب معلم است نه نمره).
 * خروجی: کد یا null.
 */
export function detectBehavioralCode({ f1, f2, acceptedFacts } = {}) {
  if (!isInt(f1) || !isInt(f2) || !Array.isArray(acceptedFacts)) return null;
  const swapped = acceptedFacts.some(f =>
    f && f.f1 === f2 && f.f2 === f1 && !(f.f1 === f1 && f.f2 === f2));
  if (swapped) return 'E_COMMUTATIVE_FAIL';
  const same = acceptedFacts.some(f => f && f.f1 === f1 && f.f2 === f2);
  if (same) return 'E_FATIGUE_SLIP';
  return null;
}

/**
 * شمار پاسخ‌های بی‌الگو (کاندید E_PERSISTENT_GUESSING) در یک جلسه.
 * «بی‌ربط» (نقد ۱۰ — تعریف عملیاتی): پاسخی که با هیچ الگوی شناخته‌شدهٔ
 * classifyAttempt نمی‌خواند و نه یک پرش کمتر/بیشترِ شناخته‌شده است.
 * زمان به‌تنهایی معیار نیست.
 */
export function countIrrelevantAttempts(wrongAttempts = []) {
  if (!Array.isArray(wrongAttempts)) return 0;
  return wrongAttempts.filter(w => w && !w.code && !w.behavioral).length;
}

/**
 * کد غالب یک جلسه برای کارت معلم — بر پایهٔ شدت و تکرار.
 * ورودی: نگاشت کد → تعداد (خروجی شمارش تلاش‌نگار).
 * خروجی: کد غالب یا null.
 */
export function dominantCode(wrongCodes) {
  if (!wrongCodes || typeof wrongCodes !== 'object') return null;
  for (const code of CODE_SEVERITY_ORDER) {
    if ((wrongCodes[code] || 0) > 0) return code;
  }
  return null;
}
