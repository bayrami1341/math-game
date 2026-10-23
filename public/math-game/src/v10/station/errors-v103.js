// ─────────────────────────────────────────────────────────────────────────────
// موتور تشخیص خطای خانوادهٔ ۲ (الگوریتم ستونی: گره/قرض) و خانوادهٔ ۳
// (ارزش مکانی/چهاررقمی) — نسخهٔ ۱۰.۳ موج الف (v10.3.0-beta)
//
// این ماژول کاملاً افزودنی است: هیچ فایلی از v10.2 تغییر نمی‌کند و هیچ کدی به
// ERROR_CODES در errors.js اضافه نمی‌شود. شش کد نخستِ این اطلس («پیشنهادی»)
// از پیش در اطلس خشاب cartridges/KH-G3-MATH.json ثبت‌اند و دو کد آخر
// (E_BORROW_MISS و E_ZERO_PLACE_MISS) کاندیدهای جدید موج الف‌اند که زیرعامل
// اطلس به اکسل اضافه می‌کند — اینجا فقط در موتور ثبت شده‌اند.
//
// قرارداد خروجی هم‌قرارداد classifyAttempt در errors.js است:
//   خروجی = رشتهٔ کد یا null (پاسخ درست / بی‌الگو) — هرگز استثنا نمی‌دهد.
// گارد ورودی همان سبک errors.js: Number.isInteger سخت‌گیرانه (بدون تبدیل
// رشته/اعشار)، خارج دامنه → null. دامنهٔ کتاب: ۰..۹۹۹۹.
//
// زنجیرهٔ برچسب‌گذاری این ماژول PRIORITY_V103 است. یک پاسخ می‌تواند همزمان با
// چند الگو بخواند (نمونه: ۴۲÷۶→۶ هم «خلط گروه» است هم «فکت همسایهٔ ۴۲÷۷=۶»؛
// یا ۵÷۳→۲ با فلگ totalDivision هم «باقیمانده ریخته» است هم «تفریق ۵−۳») —
// اولین کدِ این زنجیره برچسب می‌گیرد.
//
// امانت‌داری (اصل «صادقانه بی‌الگو»):
//   - تقسیم «چند جعبهٔ کامل؟» بدون فلگ totalDivision جواب floorش درست است → null.
//   - حذف صفرِ انتهایی چهاررقمی (۴۰۷۰→۴۰۷) خانوادهٔ ÷۱۰ است و به v10.2 می‌رسد → null.
//   - E_UNEQUAL_GROUP در موج الف فقط ثبت شده: تشخیص عددی خودکار از روی
//     سه‌تایی (ورودی، ورودی، پاسخ) ممکن نیست (نیازمند شواهد نمایشی/ترسیمی) —
//     بدون آشکارساز عددی مانده و برچسبش با شواهد کلاسی معلم زده می‌شود.
//
// این ماژول Pure است: هیچ وابستگی به DOM، FS، صدا یا وضعیت بازی ندارد.
// ─────────────────────────────────────────────────────────────────────────────

const isInt = n => Number.isInteger(n);
const MAX_BOOK = 9999; // دامنهٔ کتاب

// گره/قرض فقط در چهار جایگاهِ اعداد کتاب رخ می‌دهد (۰..۹۹۹۹)
const digitAt = (n, i) => Math.floor(n / 10 ** i) % 10;

// ── اطلس هشت‌کدی خانوادهٔ ۲و۳ ──
export const CODES_V103 = Object.freeze({
  E_CARRY_MISS:      { nameFa: 'جاافتادن گره', family: 2, severity: 'مفهومی' },
  E_BORROW_MISS:     { nameFa: 'جاافتادن قرض', family: 2, severity: 'مفهومی' },
  E_ZERO_PLACE_MISS: { nameFa: 'حذف صفر جایگاه', family: 3, severity: 'مفهومی' },
  E_REMAINDER_DROP:  { nameFa: 'مدیریت‌نشدن باقیمانده', family: 1, severity: 'مفهومی' },
  E_OP_REVERSE:      { nameFa: 'عمل جایگزین‌شده', family: 1, severity: 'راهبردی' },
  E_GROUP_VS_COUNT:  { nameFa: 'خلط گروه و شمارش', family: 1, severity: 'مفهومی' },
  E_FACT_CONFUSION:  { nameFa: 'خلط فکت جدول', family: 1, severity: 'محاسباتی' },
  E_UNEQUAL_GROUP:   { nameFa: 'دسته‌های نابرابر', family: 1, severity: 'مفهومی' },
  // موج الف — سه کد «پیشنهادِ» ثبت‌شده در خشاب‌های G2/G3 (Task 63 / BP-002):
  // متادیتا هم‌خوان با cartridges/KH-G2-MATH.json (category مفهومی/راهبردی).
  E_ROUND_NEAREST:         { nameFa: 'گردکردن به دهگان نادرست', family: 1, severity: 'مفهومی' },
  E_UNIT_VALUE_CONFUSION:  { nameFa: 'خلط تعداد بسته/سکه با ارزش ریالی یا مکانی', family: 3, severity: 'مفهومی' },
  E_APPROX_EXACT_CONFUSION: { nameFa: 'نوشتن مقدار دقیق به‌جای مقدار تقریبی', family: 1, severity: 'راهبردی' }
});

// جملهٔ کارت معلم: یک جملهٔ تشخیصی + دو نمونهٔ رفتاری — بدون کودک‌ستیزی.
// (اصل errors.js: برچسب، نمره نیست؛ تصمیم نهایی با آموزگار است.)
export const CODE_SENTENCES_V103 = Object.freeze({
  E_CARRY_MISS: 'در جمع یا ضرب ستونی گره را جا انداخته — نمونه: ۳۵۸+۲۴۶ را ۵۹۴ نوشته و ۲۶×۳ را ۶۸ نوشته.',
  E_BORROW_MISS: 'در تفریق ستونی قرض گرفتن را جا انداخته — نمونه: ۵۲−۲۷ را ۳۵ نوشته و ۶۳−۴۸ را ۲۵ نوشته.',
  E_ZERO_PLACE_MISS: 'در خواندن و نوشتن چهاررقمی صفرِ میان عدد را حذف کرده — نمونه: ۴۰۷۰ را ۴۷۰ خوانده و ۳۰۰۵ را ۳۰۵ خوانده.',
  E_REMAINDER_DROP: 'باقیماندهٔ تقسیم را رها کرده یا در نتیجه ریخته — نمونه: در «۱۹÷۴ چند تا می‌شود؟» فقط ۴ یا ۵ گفته و به ۳ باقی‌مانده نرسیده.',
  E_OP_REVERSE: 'به‌جای تقسیم عمل دیگری به کار برده — نمونه: ۱۲÷۳ را ۹ (تفریق) یا ۱۵ (جمع) یا ۳۶ (ضرب) نوشته.',
  E_GROUP_VS_COUNT: 'اندازهٔ گروه و شمارش را با هم خلط کرده — نمونه: ۱۸÷۶ را ۶ (اندازهٔ گروه) یا ۱۸ (تعداد کل) نوشته.',
  E_FACT_CONFUSION: 'فکت جدول ضرب را با فکت همسایه خلط کرده — نمونه: ۲۴÷۴ را ۸ نوشته (فکت ۲۴÷۳) و ۶۰÷۵ را ۱۰ نوشته (فکت ۶۰÷۶).',
  E_UNEQUAL_GROUP: 'در دسته‌بندی گروه‌های هم‌اندازه نساخته — نمونه: ۱۲ شیء را در دسته‌هایی نابرابر چیده و شمارش جهشی را از دست داده.',
  E_ROUND_NEAREST: 'در پرسش دقیق، جواب را به دهگان/صدگان نزدیک گرد کرده — نمونه: ۲۶×۳ را ۷۸ دقیق نمی‌نویسد و ۸۰ می‌نویسد؛ یا حاصل ۴۷+۳۲ را ۸۰ (به‌جای ۷۹) ثبت کرده.',
  E_UNIT_VALUE_CONFUSION: 'تعداد سکه/دسته را با ارزشش یکی گرفته — نمونه: ۴ سکهٔ ۱۰ ریالی و ۵ سکهٔ ۱ ریالی را ۹ ریال (به‌جای ۴۵) نوشته و در ۸۰۹، رقم ۸ را به‌جای ۸۰۰ می‌خواند.',
  E_APPROX_EXACT_CONFUSION: 'پرسش تقریب و دقیق را با هم عوض کرده — نمونه: در «تقریب ۴۷ به دهگان» خودِ ۴۷ را نوشته و در پرسش دقیق، حذف‌رقمی (۴۸→۴۰) به‌جای محاسبهٔ دقیق آورده.'
});

// زنجیرهٔ برچسب‌گذاری موج الف: اولین الگوی برنده، برچسب می‌گیرد.
// سه کد تازه در انتهای زنجیره‌اند تا هیچ برچسب موجودِ موج الف تغییر نکند.
export const PRIORITY_V103 = Object.freeze([
  'E_REMAINDER_DROP',
  'E_OP_REVERSE',
  'E_GROUP_VS_COUNT',
  'E_FACT_CONFUSION',
  'E_CARRY_MISS',
  'E_BORROW_MISS',
  'E_ZERO_PLACE_MISS',
  'E_UNEQUAL_GROUP',
  'E_ROUND_NEAREST',
  'E_UNIT_VALUE_CONFUSION',
  'E_APPROX_EXACT_CONFUSION'
]);

/** اولین کدِ زنده در زنجیرهٔ PRIORITY_V103 — بین کاندیدهای همزمان */
function pickByPriority(candidates) {
  for (const code of PRIORITY_V103) {
    if (candidates.includes(code)) return code;
  }
  return null;
}

/**
 * جمع ستونی دومرحله‌ای (دامنهٔ کتاب ۰..۹۹۹۹؛ حاصل تا ۱۹۹۹۸).
 * «جمع بدون گره»: رقم‌به‌رقم (a_i+b_i) % 10 در جایگاه خودش.
 * نمونهٔ طلایی: ۳۵۸+۲۴۶=۶۰۴ درست؛ بدون‌گره=۵۹۴ → E_CARRY_MISS.
 * خروجی: کد یا null (درست / بی‌الگو).
 */
export function classifyColumnSum(a, b, submitted) {
  if (!isInt(a) || !isInt(b) || !isInt(submitted)) return null;
  if (a < 0 || a > MAX_BOOK || b < 0 || b > MAX_BOOK) return null;
  if (submitted < 0 || submitted > 2 * MAX_BOOK) return null;
  if (submitted === a + b) return null; // درست — خطا نیست

  let noCarry = 0;
  let carryNeeded = false;
  for (let i = 0; i < 4; i++) {
    const s = digitAt(a, i) + digitAt(b, i);
    if (s >= 10) carryNeeded = true;
    noCarry += (s % 10) * 10 ** i;
  }
  if (carryNeeded && submitted === noCarry) return 'E_CARRY_MISS';
  return null; // صادقانه بی‌الگو
}

/**
 * تفریق ستونی a≥b (دامنهٔ کتاب ۰..۹۹۹۹).
 * «تفریق بدون قرض»: رقم‌به‌رقم (a_i−b_i) mod 10 — منفی هم mod می‌گیرد.
 * نمونهٔ طلایی: ۵۲−۲۷=۲۵ درست؛ بدون‌قرض=۳۵ → E_BORROW_MISS.
 */
export function classifyColumnSub(a, b, submitted) {
  if (!isInt(a) || !isInt(b) || !isInt(submitted)) return null;
  if (a < 0 || a > MAX_BOOK || b < 0 || b > MAX_BOOK) return null;
  if (a < b) return null; // قرارداد: تفریق ستونی a≥b — بیرون قرارداد بی‌الگو
  if (submitted < 0 || submitted > MAX_BOOK) return null;
  if (submitted === a - b) return null; // درست — خطا نیست

  let noBorrow = 0;
  let borrowNeeded = false;
  for (let i = 0; i < 4; i++) {
    const d = digitAt(a, i) - digitAt(b, i);
    if (d < 0) borrowNeeded = true;
    noBorrow += (((d % 10) + 10) % 10) * 10 ** i;
  }
  if (borrowNeeded && submitted === noBorrow) return 'E_BORROW_MISS';
  return null; // صادقانه بی‌الگو
}

/**
 * ضرب ستونی با ضریب تک‌رقمی (b از ۰ تا ۹؛ بیرونش null).
 * «بدون‌گره»: رقم‌های a × b به‌تفکیک، هر رقم % 10.
 * نمونهٔ طلایی (سناریوی Q-112): ۲۶×۳=۷۸ درست؛ بدون‌گره=۶۸ → E_CARRY_MISS.
 * b===۰ یا ۱ → هیچ گره‌ای ممکن نیست؛ فقط درست/null.
 */
export function classifyColumnMultiply(a, b, submitted) {
  if (!isInt(a) || !isInt(b) || !isInt(submitted)) return null;
  if (a < 0 || a > MAX_BOOK) return null;
  if (b < 0 || b > 9) return null; // ضریب تک‌رقمی
  if (submitted < 0 || submitted > MAX_BOOK * 9) return null;
  if (submitted === a * b) return null; // درست — خطا نیست
  if (b < 2) return null; // در ×۰ و ×۱ گره ممکن نیست — صادقانه بی‌الگو

  let noCarry = 0;
  let carryNeeded = false;
  for (let i = 0; i < 4; i++) {
    const p = digitAt(a, i) * b;
    if (p >= 10) carryNeeded = true;
    noCarry += (p % 10) * 10 ** i;
  }
  if (carryNeeded && submitted === noCarry) return 'E_CARRY_MISS';
  return null; // صادقانه بی‌الگو
}

/**
 * تقسیم: دقیق، باقیمانده، عمل جایگزین، خلط گروه/شمارش، خلط فکت.
 * گاردها: divisor>=1؛ همهٔ مقادیر ۰..۹۹۹۹؛ integers.
 *   - exact (r=0 و submitted=خارج‌قسمت) → null
 *   - opts.totalDivision===true (پرسش «چند تا می‌شود؟») و r>0 و
 *     submitted===floor یا floor+1 → E_REMAINDER_DROP؛
 *     بدون فلگ همین حالات null است (پرسش «چند جعبهٔ کامل؟» جواب floorش درست است — قرارداد Q-204)
 *   - عمل جایگزین: ÷ به جمع/تفریق/ضرب بدل شده → E_OP_REVERSE (سناریوی Q-201: ۱۲÷۳→۹/۱۵/۳۶)
 *   - خلط گروه/شمارش (فقط r=0): submitted===divisor (۱۸÷۶→۶) یا submitted===dividend (۱۸÷۶→۱۸)
 *   - خلط فکت (فقط r=0): submitted===dividend÷(divisor±۱) با تقسیم صحیح و همسایهٔ>=۲
 * چند الگوی همزمان با PRIORITY_V103 داوری می‌شود.
 */
export function classifyDivisionAttempt(dividend, divisor, submitted, opts = {}) {
  if (!isInt(dividend) || !isInt(divisor) || !isInt(submitted)) return null;
  if (dividend < 0 || dividend > MAX_BOOK) return null;
  if (divisor < 1 || divisor > MAX_BOOK) return null;
  if (submitted < 0 || submitted > MAX_BOOK) return null;
  const o = (opts && typeof opts === 'object') ? opts : {}; // گارد مضاعف — هرگز استثنا نمی‌دهد

  const r = dividend % divisor;
  const q = (dividend - r) / divisor; // خارج‌قسمت صحیح (floor)
  if (r === 0 && submitted === q) return null; // دقیق و درست — خطا نیست

  const candidates = [];

  // ۱. مدیریت‌نشدن باقیمانده — فقط با فلگ totalDivision (صدا: «چند تا می‌شود؟»)
  if (o.totalDivision === true && r > 0 && (submitted === q || submitted === q + 1)) {
    candidates.push('E_REMAINDER_DROP');
  }

  // ۲. عمل جایگزین‌شده: ÷ بدل به تفریق/جمع/ضرب شده
  if (submitted === dividend - divisor || submitted === dividend + divisor || submitted === dividend * divisor) {
    candidates.push('E_OP_REVERSE');
  }

  if (r === 0) {
    // ۳. خلط گروه و شمارش: نوشتن اندازهٔ گروه به‌جای تعداد گروه‌ها، یا بستن به تعداد کل
    if ((submitted === divisor && divisor !== q) || submitted === dividend) {
      candidates.push('E_GROUP_VS_COUNT');
    }
    // ۴. خلط فکت جدول: فکت همسایه (divisor−۱ یا divisor+۱)
    const prev = divisor - 1;
    if (prev >= 2 && dividend % prev === 0 && submitted === dividend / prev) {
      candidates.push('E_FACT_CONFUSION');
    }
    const next = divisor + 1;
    if (dividend % next === 0 && submitted === dividend / next) {
      candidates.push('E_FACT_CONFUSION');
    }
  }

  return pickByPriority(candidates);
}

/**
 * خواندن/نوشتن چهاررقمی (۱۰۰۰..۹۹۹۹).
 * حذف صفر جایگاه: با حذف «یک» صفرِ میانه از نمایش دهدهی target بتوان submitted
 * را ساخت (و submitted!==target) → E_ZERO_PLACE_MISS. نمونهٔ طلایی (سناریوی Q-205):
 * ۴۰۷۰→۴۷۰. حذف صفرِ انتهایی (۴۰۷۰→۴۰۷) خانوادهٔ ÷۱۰ است و اینجا صادقانه null
 * می‌ماند؛ حذفی که صفر پیشرو بسازد (۴۰۰۷→۰۷) هم بی‌الگو است.
 */
export function classifyFourDigit(target, submitted) {
  if (!isInt(target) || !isInt(submitted)) return null;
  if (target < 1000 || target > MAX_BOOK) return null;
  if (submitted < 0 || submitted > MAX_BOOK) return null;
  if (submitted === target) return null; // درست — خطا نیست

  const s = String(target);
  for (let i = 1; i < s.length - 1; i++) { // فقط صفرِ میانه — جایگاه آخر دست‌نخورده
    if (s[i] !== '0') continue;
    const t = s.slice(0, i) + s.slice(i + 1);
    if (t[0] === '0') continue; // حذف نباید صفر پیشرو بسازد
    if (Number(t) === submitted) return 'E_ZERO_PLACE_MISS';
  }
  return null; // صادقانه بی‌الگو
}

/**
 * دیسپچر موج الف با زنجیرهٔ PRIORITY_V103.
 * spec: { op: 'sum'|'sub'|'mulcol'|'div'|'read', a, b, totalDivision? }
 *   sum/sub/mulcol: a,b عملوند ستونی | div: a=dividend، b=divisor | read: a=چهاررقمی هدف
 * خروجی: اولین کد برندهٔ زنجیره یا null. op نامعلوم/بدشکل → null.
 */
export function classifyV103(spec, submitted) {
  if (!spec || typeof spec !== 'object') return null;
  const { op, a, b } = spec;
  switch (op) {
    case 'sum':    return classifyColumnSum(a, b, submitted);
    case 'sub':    return classifyColumnSub(a, b, submitted);
    case 'mulcol': return classifyColumnMultiply(a, b, submitted);
    case 'div':    return classifyDivisionAttempt(a, b, submitted, spec);
    case 'read':   return classifyFourDigit(a, submitted);
    case 'round':  return classifyRoundNearest(a, submitted);
    case 'unit':   return classifyUnitValue(a, submitted);
    case 'approx': return classifyApproxExact(a, submitted, spec);
    default:       return null; // op نامعلوم — صادقانه بی‌الگو
  }
}

// ── موج الف — سه آشکارساز تکمیلی (Task 63 / BP-002) ─────────────────────────
// قرارداد همان پنج آشکارساز بالا: Pure، گارد سخت، «صادقانه بی‌الگو» (null)،
// بدون هیچ وابستگی به DOM/FS. متادیتا و جمله‌ها هم‌خوان با خشاب رسمی G2.

/** نزدیک‌ترین دهگان (گرد کردن نیم‌بالا — سبک کتاب پایهٔ دوم) */
function nearestTen(n) { return Math.round(n / 10) * 10; }
/** نزدیک‌ترین صدگان (گرد کردن نیم‌بالا) */
function nearestHundred(n) { return Math.round(n / 100) * 100; }

/**
 * E_ROUND_NEAREST — در پرسشِ «دقیق»، پاسخِ گردشده به دهگان/صدگان نزدیک.
 * نمونهٔ طلایی: حاصل دقیق ۲۶×۳=۷۸ اما دانش‌آموز ۸۰ می‌نویسد (نزدیک‌ترین دهگان).
 * اگر خودِ مقدار دقیق از قبل گرد باشد (۴۰، ۳۰۰، …) هیچ گردکردنی الگو نیست — null.
 * خروجی: کد یا null (درست / بی‌الگو).
 */
export function classifyRoundNearest(trueValue, submitted) {
  if (!isInt(trueValue) || !isInt(submitted)) return null;
  if (trueValue < 0 || trueValue > MAX_BOOK || submitted < 0 || submitted > MAX_BOOK) return null;
  if (submitted === trueValue) return null; // دقیق و درست — خطا نیست

  for (const near of [nearestTen(trueValue), nearestHundred(trueValue)]) {
    if (near !== trueValue && submitted === near) return 'E_ROUND_NEAREST';
  }
  return null; // صادقانه بی‌الگو
}

/**
 * E_UNIT_VALUE_CONFUSION — شمردن «تعداد نماد» به‌جای محاسبهٔ «ارزش».
 * سه الگوی عددی روی ارزش هدف (مثل ۴۵ ریال از ۴ سکهٔ ده‌ریالی و ۵ یک‌ریالی):
 *   ۱. جمع ارقام ارزش هدف: ۴+۵=۹ (سکه‌ها شمرده شده، ارزش نه) — نمونهٔ ص ۵۷: ۳۴۰→۷
 *   ۲. نوشتن رقمِ لخت به‌جای ارزش جایگاه: ۸۰۹→۸ (رقم صدگان به‌جای ۸۰۰)
 *   ۳. افتادن یک ستون ارزش: ۳۴۰→۳۴ (خواندن ۳۴ به‌جای ۳۴۰ — همان «ستون نادرست» خشاب)
 * خروجی: کد یا null (درست / بی‌الگو).
 */
export function classifyUnitValue(targetValue, submitted) {
  if (!isInt(targetValue) || !isInt(submitted)) return null;
  if (targetValue < 0 || targetValue > MAX_BOOK || submitted < 0 || submitted > MAX_BOOK) return null;
  if (submitted === targetValue) return null; // درست — خطا نیست
  if (targetValue < 10) return null; // تک‌رقمی: ارزش = تعداد؛ خلط بی‌معنا

  // ۱. جمع ارقام
  let digitSum = 0;
  for (let t = targetValue; t > 0; t = Math.floor(t / 10)) digitSum += t % 10;
  if (submitted === digitSum) return 'E_UNIT_VALUE_CONFUSION';

  // ۲. رقم لخت به‌جای ارزش جایگاه (هر جایگاه غیرصفر)
  for (let i = 0; i < 4; i++) {
    const d = digitAt(targetValue, i);
    if (d !== 0 && submitted === d && d !== targetValue) return 'E_UNIT_VALUE_CONFUSION';
  }

  // ۳. افتادن یک ستون (تقسیم بر ۱۰ بی‌باقیمانده)
  if (targetValue % 10 === 0 && submitted === targetValue / 10) return 'E_UNIT_VALUE_CONFUSION';

  return null; // صادقانه بی‌الگو
}

/**
 * E_APPROX_EXACT_CONFUSION — جابه‌جایی «تقریب» و «دقیق».
 *   mode==='approx' (پرسش تقریب): خودِ عددِ غیرقابل‌گرد آورده شده → کد.
 *   mode==='exact'  (پرسش دقیق): حذف‌رقمی (برش به دهگان/صدگان که گردِ نزدیک
 *     «نیست») آورده شده → کد. اگر برش، نزدیک‌ترین گرد باشد، الگوی اختصاصی‌تر
 *     E_ROUND_NEAREST است و اینجا صادقانه null می‌ماند (تفکیک مسئولیت).
 * خروجی: کد یا null (درست / بی‌الگو / بیرون قرارداد mode).
 */
export function classifyApproxExact(trueValue, submitted, opts = {}) {
  if (!isInt(trueValue) || !isInt(submitted)) return null;
  if (trueValue < 0 || trueValue > MAX_BOOK || submitted < 0 || submitted > MAX_BOOK) return null;
  const o = (opts && typeof opts === 'object') ? opts : {}; // گارد مضاعف — هرگز استثنا نمی‌دهد

  if (o.mode === 'approx') {
    if (submitted === trueValue && nearestTen(trueValue) !== trueValue) return 'E_APPROX_EXACT_CONFUSION';
    return null; // تقریب درست یا عددِ از قبل گرد — بی‌الگو
  }

  if (o.mode === 'exact') {
    if (submitted === trueValue) return null; // دقیق و درست
    // برش به دهگان/صدگان (حذف رقم با جایگاه دست‌نخوردهٔ باقی‌مانده) — هر برش فقط
    // با نزدیک‌ترین گردِ «هم‌جایگاهِ» خودش مقایسه می‌شود؛ برشِ نزدیک = قلمرو E_ROUND_NEAREST.
    const trunc10 = Math.floor(trueValue / 10) * 10;
    const trunc100 = Math.floor(trueValue / 100) * 100;
    if (trunc10 !== trueValue && trunc10 > 0 && submitted === trunc10 && trunc10 !== nearestTen(trueValue)) {
      return 'E_APPROX_EXACT_CONFUSION';
    }
    if (trunc100 !== trueValue && trunc100 > 0 && submitted === trunc100 && trunc100 !== nearestHundred(trueValue)) {
      return 'E_APPROX_EXACT_CONFUSION';
    }
    return null; // گرد نزدیک → قلمرو E_ROUND_NEAREST؛ بقیه — بی‌الگو
  }

  return null; // mode نامعلوم — صادقانه بی‌الگو
}
