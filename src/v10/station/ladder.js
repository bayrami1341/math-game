// ─────────────────────────────────────────────────────────────────────────────
// نردبان داربست ۷پله‌ای (سند پداگوژیک فصل ۴) — نسخهٔ ۱۰.۲
//
// v10.2: پوشش همهٔ دامنه‌های کتاب کد ۳۰۵:
//   table    → جدول ۲..۱۲ (نیروگاه ۶۴–۶۹ و برج ۷۰–۷۲)
//   identity → ضرب در یک (سکو، صفحهٔ ۱۳۶)
//   zero     → ضرب در صفر (سکو، صفحهٔ ۱۳۶)
//   x10      → ضرب در ده با دورقمی‌ها مثل ۱۴×۱۰ و ۴۲×۱۰ (صفحهٔ ۱۳۶–۱۳۸)
//   multi    → یک‌رقم در دورقمی/سه‌رقمی مثل ۲×۲۱۳ (صفحهٔ ۱۳۹–۱۴۴)
//
// سیاست لنگر پلهٔ ۶ (نقد فنی ۱ و ۲ — نسخهٔ ۱.۲.۰ سند):
//   فقط شکستن جمعی بر پایهٔ لنگرهای کتاب — ۵ برای ۶..۹ (نمونهٔ کتاب: ۷×۵ از ۵×۵ و ۲×۵)
//   و ۲ برای ۳ و ۴. لنگر ۱۰ به‌صورت تفریق حذف شد چون ×۱۰ در فصل ۸ (بعد از درس
//   شکستن) تدریس می‌شود و استفاده از آن وابستگی رو به جلو است.
//
// ضدنشت اجباری (فصل ۴ سند): assertNoLeak بررسی می‌کند که حاصل f1×f2 به‌صورت
// «توکن عددی مستقل» در متن پله‌های ۱ تا ۶ نیامده باشد — هم ارقام فارسی و هم لاتین.
// پلهٔ ۷ فقط حاصل «نمونهٔ موازی» را می‌نویسد که با مسئلهٔ اصلی هم‌خانوادهٔ اصلی نیست.
// buildLadder در پایان assertNoLeak را اجرا می‌کند و در صورت نقض null برمی‌گرداند.
//
// این ماژول Pure است: هیچ وابستگی به DOM، صدا یا وضعیت بازی ندارد.
// ─────────────────────────────────────────────────────────────────────────────

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const toFa = num => String(num).replace(/\d/g, d => FA_DIGITS[Number(d)]);

// متن را به «توکن‌های عددی» تجزیه می‌کند: هر نویسهٔ غیررقمی جداکننده است،
// پس «۱۲۳» هرگز با جست‌وجوی «۱۲» اشتباه گرفته نمی‌شود (مقایسهٔ رشته‌ای دقیق).
const numericTokens = text => String(text || '').split(/[^0-9۰-۹]+/).filter(Boolean);

/**
 * دامنهٔ سؤال را تعیین می‌کند — تنها دروازهٔ ورود نردبان.
 * خروجی: 'table' | 'identity' | 'zero' | 'x10' | 'multi' | null
 */
export function classifyQuestionDomain(input = {}) {
  const { f1, f2 } = input || {};
  if (!Number.isInteger(f1) || !Number.isInteger(f2)) return null;
  if (f1 < 0 || f2 < 0 || f1 > 999 || f2 > 999) return null;

  if (f1 === 0 || f2 === 0) {
    if (f1 + f2 === 0) return null; // ۰×۰ بی‌معنا
    const other = Math.max(f1, f2);
    return other >= 1 && other <= 10 ? 'zero' : null;
  }
  if (f1 === 1 || f2 === 1) {
    const other = Math.max(f1, f2);
    return other >= 2 && other <= 10 ? 'identity' : null;
  }
  // جدول کتاب: یک‌رقم در یک‌رقم تا ۱۰×۱۰ (صفحهٔ ۶۸) — ×۱۱ و ×۱۲ بیرون کتاب‌اند
  if (f1 >= 2 && f1 <= 10 && f2 >= 2 && f2 <= 10) return 'table';
  const p = f1 * f2;
  // ضرب در ده با دورقمی: ۱۴×۱۰، ۴۲×۱۰ (صفحهٔ ۱۳۷–۱۳۸)
  if (f1 === 10 || f2 === 10) {
    const other = f1 === 10 ? f2 : f1;
    return other >= 13 && other <= 99 && p <= 999 ? 'x10' : null;
  }
  // یک‌رقم در دورقمی/سه‌رقمی: ۲×۲۱۳ (صفحهٔ ۱۳۹–۱۴۴) — سقف حاصل ۹۹۹ (نقد ۹)
  const small = Math.min(f1, f2);
  const big = Math.max(f1, f2);
  if (small >= 2 && small <= 9 && big >= 13 && big <= 999 && p <= 999) return 'multi';
  return null;
}

const isValidQuestion = q => classifyQuestionDomain(q) !== null;

// پلهٔ ۶ — تجزیهٔ ساختاری جمعی بر پایهٔ لنگر کتاب (صفحهٔ ۷۰)؛ حاصل نهایی هرگز نوشته نمی‌شود:
//   f2 = ۶..۹ → لنگر ۵ (پنج + باقی) — نمونهٔ کتاب: ۷×۵ از ۵×۵ و ۲×۵
//   f2 = ۳، ۴ → لنگر ۲ (دو + باقی)
//   f2 = ۵    → بدون شکستن (خودِ جدول پنج)
//   f2 = ۲    → زبان دو دسته
function decompositionTextFa(f1, f2) {
  if (f2 === 2) {
    return `${toFa(f1)}×۲ یعنی دو دسته: یک دستهٔ ${toFa(f1)}تایی و باز یک دستهٔ ${toFa(f1)}تایی را با هم بشمار.`;
  }
  if (f2 === 5) {
    return `این همان جدول پنج است: ${toFa(f1)} دستهٔ پنج‌تایی را پنج‌تا پنج‌تا بشمار.`;
  }
  if (f2 === 3) {
    return `${toFa(f1)}×${toFa(f2)} = ${toFa(f1)}×۲ + ${toFa(f1)}×۱ — دو دسته را که بلدی، دستهٔ یکی‌مانده را هم اضافه کن.`;
  }
  if (f2 === 4) {
    return `${toFa(f1)}×${toFa(f2)} = ${toFa(f1)}×۲ + ${toFa(f1)}×۲ — دو دستهٔ آشنا، بعد دو دستهٔ دیگر.`;
  }
  // f2 = ۶..۹ → لنگر ۵ (جمعی، مطابق کتاب — بدون لنگر ۱۰ و بدون تفریق)
  return `${toFa(f1)}×${toFa(f2)} = ${toFa(f1)}×۵ + ${toFa(f1)}×${toFa(f2 - 5)} — پنج دسته را که راحت‌تر می‌شماری، باقی دسته‌ها را هم اضافه کن.`;
}

// پلهٔ ۷ — مسئلهٔ هم‌خانوادهٔ موازی: هرگز برابر (f1,f2) یا (f2,f1) نیست.
function pickSibling(f1, f2) {
  const candidates = [
    { f1, f2: f2 === 3 ? 4 : 3 },
    { f1: 2, f2: 5 },
    { f1: 4, f2: 2 },
    { f1: 5, f2: 4 }
  ];
  for (const c of candidates) {
    const sameAsMain = (c.f1 === f1 && c.f2 === f2) || (c.f1 === f2 && c.f2 === f1);
    if (!sameAsMain) return c;
  }
  return { f1: 2, f2: 4 }; // از نظر ریاضی دست‌نیافتنی (محافظ نهایی)
}

/**
 * راستی‌آزمایی ضدنشت (فصل ۴ سند).
 * خروجی: true یعنی نردبان امن است؛ false یعنی نقض.
 * minFactor: برای دامنه‌های صفر (۰) و یک (۱) شل می‌شود.
 */
export function assertNoLeak(ladder, { f1, f2 } = {}, { minFactor = 2 } = {}) {
  if (!isValidQuestion({ f1, f2 })) return false;
  if (!Array.isArray(ladder) || ladder.length !== 7) return false;
  const product = f1 * f2;
  const forbidden = [toFa(product), String(product)];

  for (const step of ladder) {
    if (!step || typeof step.textFa !== 'string') return false;
    if (!Number.isInteger(step.level) || step.level < 1 || step.level > 7) return false;
    const tokens = numericTokens(step.textFa);
    // پله‌های ۱–۶: حاصل نهایی مطلقاً ممنوع
    // پلهٔ ۷: حاصل «نمونهٔ موازی» مجاز است — در دامنهٔ صفر برابر خودِ حاصل اصلی است (۰)
    // و همان‌جا از بررسی خواهر/برادر (sibling) عبور می‌کند.
    if (step.level <= 6 && tokens.some(t => forbidden.includes(t))) return false;
    if (step.visual === 'equal-groups' && step.level !== 3) return false;
  }

  // پلهٔ ۷ باید نمونهٔ موازیِ متفاوت با پاسخ درست داشته باشد
  const last = ladder[6];
  const sibling = last.sibling;
  if (!sibling || typeof sibling !== 'object') return false;
  const { f1: a, f2: b, answerFa } = sibling;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
  if (a < minFactor || b < minFactor) return false;
  if (a + b === 0) return false;
  if ((a === f1 && b === f2) || (a === f2 && b === f1)) return false;
  if (answerFa !== toFa(a * b)) return false;
  return true;
}

// ─── نردبان جدول (نیروگاه و برج) ───
function buildTableLadder(f1, f2) {
  const sibling = pickSibling(f1, f2);
  return [
    {
      level: 1,
      textFa: `به عددها خوب نگاه کن: ${toFa(f1)} دستهٔ ${toFa(f2)}تایی می‌خواهد بسازی.`,
      visual: null, sibling: null
    },
    {
      level: 2,
      textFa: `با چیزی واقعی بساز: ${toFa(f1)} دسته درست کن و در هر دسته ${toFa(f2)} تا بگذار — با دکمه، لوبیا یا انگشت‌هایت.`,
      visual: null, sibling: null
    },
    {
      level: 3,
      textFa: `این ${toFa(f1)} دستهٔ ${toFa(f2)}تایی را ببین و یکی‌یکی بشمار.`,
      visual: 'equal-groups', sibling: null
    },
    { level: 4, textFa: 'کدام ضربِ ساده‌تر چیزی شبیه به این است که بلد باشی؟', visual: null, sibling: null },
    { level: 5, textFa: 'نیمی از دسته‌ها را روشن کن و بعد ادامه بده.', visual: null, sibling: null },
    { level: 6, textFa: decompositionTextFa(f1, f2), visual: null, sibling: null },
    {
      level: 7,
      textFa: `${toFa(sibling.f1)}×${toFa(sibling.f2)} = ${toFa(sibling.f1 * sibling.f2)} چون ${toFa(sibling.f1)} دستهٔ ${toFa(sibling.f2)}تایی داریم. حالا خودت مسئلهٔ اصلی را امتحان کن.`,
      visual: null,
      sibling: { f1: sibling.f1, f2: sibling.f2, answerFa: toFa(sibling.f1 * sibling.f2) }
    }
  ];
}

// ─── نردبان ضرب در یک (صفحهٔ ۱۳۶) — بدون ذکر حاصل: حاصل = عامل دیگر، پس عدد دیگر هم ممنوع است ───
function buildIdentityLadder(f1, f2) {
  const other = Math.max(f1, f2);
  const m = other >= 12 ? other - 1 : other + 1; // نمونهٔ موازی با عامل دیگر
  const sibling = f1 === 1 ? { f1: 1, f2: m } : { f1: m, f2: 1 };
  return [
    { level: 1, textFa: 'به علامت ضرب نگاه کن: یکی از دو عددها یک است.', visual: null, sibling: null },
    { level: 2, textFa: 'یک دسته تصور کن؛ به اندازهٔ عددهای دیگر، عضو در آن بگذار.', visual: null, sibling: null },
    { level: 3, textFa: 'همین یک دسته را ببین و عضوهایش را یکی‌یکی بشمار.', visual: 'equal-groups', sibling: null },
    { level: 4, textFa: 'چند دسته ساختی؟ با زبان بگو، عدد ننویس.', visual: null, sibling: null },
    { level: 5, textFa: 'داخل هر دسته را بشمار؛ تعداد را روی صفحه ننویس.', visual: null, sibling: null },
    { level: 6, textFa: 'ضرب در یک، هیچ دسته‌ای اضافه یا کم نمی‌کند؛ همان تعداد می‌ماند. حاصل را خودت پیدا کن.', visual: null, sibling: null },
    {
      level: 7,
      textFa: `${toFa(sibling.f1)}×${toFa(sibling.f2)} = ${toFa(sibling.f1 * sibling.f2)} چون فقط یک دسته است. حالا خودت مسئلهٔ اصلی را امتحان کن.`,
      visual: null,
      sibling: { f1: sibling.f1, f2: sibling.f2, answerFa: toFa(sibling.f1 * sibling.f2) }
    }
  ];
}

// ─── نردبان ضرب در صفر (صفحهٔ ۱۳۶) — «هیچ» با کلمه، رقم صفر در پله‌های ۱–۶ ممنوع ───
function buildZeroLadder(f1, f2) {
  const other = Math.max(f1, f2);
  const m = other >= 12 ? other - 1 : other + 1;
  const sibling = f1 === 0 ? { f1: 0, f2: m } : { f1: m, f2: 0 };
  const zeroSideIsFirst = f1 === 0;
  return [
    { level: 1, textFa: 'به علامت ضرب نگاه کن: یکی از دو عددها صفر است.', visual: null, sibling: null },
    {
      level: 2,
      textFa: zeroSideIsFirst
        ? 'هیچ دسته‌ای تصور نکن؛ هیچ‌کدام.'
        : `${toFa(f1)} دسته تصور کن؛ اما در هیچ‌کدام چیزی نگذار.`,
      visual: null, sibling: null
    },
    { level: 3, textFa: 'داخل دسته‌های خالی چه می‌بینی؟ چیزی برای شمردن هست؟', visual: null, sibling: null },
    { level: 4, textFa: 'با کلمه بگو: چند عضو در دسته‌های خالی می‌گذرد؟', visual: null, sibling: null },
    { level: 5, textFa: 'چیزی که نیست را نمی‌شود شمرد؛ همان «هیچ» می‌ماند.', visual: null, sibling: null },
    { level: 6, textFa: 'ضرب در صفر همیشه «هیچ» می‌دهد؛ حاصل را در ذهنت نگه دار و بنویس.', visual: null, sibling: null },
    {
      level: 7,
      textFa: `${toFa(sibling.f1)}×${toFa(sibling.f2)} = ${toFa(sibling.f1 * sibling.f2)} چون چیزی برای شمردن نیست. حالا خودت مسئلهٔ اصلی را امتحان کن.`,
      visual: null,
      sibling: { f1: sibling.f1, f2: sibling.f2, answerFa: toFa(sibling.f1 * sibling.f2) }
    }
  ];
}

// ─── نردبان ضرب در ده با دورقمی (صفحهٔ ۱۳۶–۱۳۸): ۱۴×۱۰، ۴۲×۱۰ ───
function buildX10Ladder(f1, f2) {
  const n = f1 === 10 ? f2 : f1;
  const tenFirst = f1 === 10;
  const m = n + 1 <= 99 ? n + 1 : n - 1;
  const sibling = tenFirst ? { f1: 10, f2: m } : { f1: m, f2: 10 };
  return [
    {
      level: 1,
      textFa: `به عددها نگاه کن: ${toFa(f1)} و ده.`,
      visual: null, sibling: null
    },
    {
      level: 2,
      textFa: tenFirst
        ? `ده دسته تصور کن؛ در هر دسته ${toFa(f2)} تا.`
        : `${toFa(f1)} دستهٔ ده‌تایی تصور کن.`,
      visual: null, sibling: null
    },
    {
      level: 3,
      textFa: 'روی محور، به اندازهٔ دسته‌ها پرشِ ده‌تایی بپر — شمردن را روی صفحه ننویس.',
      visual: null, sibling: null
    },
    { level: 4, textFa: 'هر یکی، یک ده‌تایی می‌شود؛ دسته‌های ده‌تایی را بشمار.', visual: null, sibling: null },
    { level: 5, textFa: 'ده‌تایی‌ها را با هم بگذار — حاصل را ننویس.', visual: null, sibling: null },
    { level: 6, textFa: 'عدد ده یعنی یک صفر در پایان؛ خودت ببین چند ده‌تایی داشتی و عدد را کامل کن.', visual: null, sibling: null },
    {
      level: 7,
      textFa: `${toFa(sibling.f1)}×${toFa(sibling.f2)} = ${toFa(sibling.f1 * sibling.f2)} چون ده‌تایی‌ها را شمردیم. حالا خودت مسئلهٔ اصلی را امتحان کن.`,
      visual: null,
      sibling: { f1: sibling.f1, f2: sibling.f2, answerFa: toFa(sibling.f1 * sibling.f2) }
    }
  ];
}

// ─── نردبان یک‌رقم در چندرقمی (صفحهٔ ۱۳۹–۱۴۴): ارزش مکانی، بخش‌بخش، بدون حاصل بخش‌ها ───
function buildMultiLadder(f1, f2) {
  const small = Math.min(f1, f2);
  const big = Math.max(f1, f2);
  const hundreds = Math.floor(big / 100);
  const tens = Math.floor((big % 100) / 10);
  const ones = big % 10;
  const parts = [];
  if (hundreds > 0) parts.push(`${toFa(hundreds)} صدتایی`);
  if (tens > 0) parts.push(`${toFa(tens)} ده‌تایی`);
  if (ones > 0) parts.push(`${toFa(ones)} یکی`);
  const partsText = parts.join(' و ');
  // نمونهٔ موازی کوچک‌تر از همان خانواده (دورقمیِ کوچک)
  const candidates = [
    { f1: 2, f2: 23 }, { f1: 3, f2: 12 }, { f1: 4, f2: 21 }, { f1: 2, f2: 34 }, { f1: 5, f2: 12 }
  ];
  let sibling = { f1: 2, f2: 23 };
  for (const c of candidates) {
    const sameAsMain = (c.f1 === f1 && c.f2 === f2) || (c.f1 === f2 && c.f2 === f1);
    if (!sameAsMain && c.f1 * c.f2 <= 144) { sibling = c; break; }
  }
  return [
    { level: 1, textFa: `به عدد بزرگ‌تر نگاه کن: ${toFa(big)}. یک عددِ ضربدرِ ${toFa(small)}.`, visual: null, sibling: null },
    { level: 2, textFa: `${toFa(big)} را بشکن: ${partsText}.`, visual: null, sibling: null },
    { level: 3, textFa: `هر بخش را جداگانه در ${toFa(small)} ضرب کن — حاصل هیچ بخشی را ننویس.`, visual: null, sibling: null },
    { level: 4, textFa: 'بخش‌ها را با هم جمع کن — باز هم روی صفحه ننویس.', visual: null, sibling: null },
    { level: 5, textFa: 'صفرهای ده‌تایی و صدتایی را گم نکن؛ هر جایگاه جای خودش را می‌خواهد.', visual: null, sibling: null },
    { level: 6, textFa: 'یک بار دیگر بخش‌بخش مرور کن: اول صدتایی‌ها، بعد ده‌تایی‌ها، بعد یکی‌ها؛ بعد جمع.', visual: null, sibling: null },
    {
      level: 7,
      textFa: `${toFa(sibling.f1)}×${toFa(sibling.f2)} = ${toFa(sibling.f1 * sibling.f2)} — همین کار را بخش‌بخش کردیم. حالا خودت مسئلهٔ اصلی را امتحان کن.`,
      visual: null,
      sibling: { f1: sibling.f1, f2: sibling.f2, answerFa: toFa(sibling.f1 * sibling.f2) }
    }
  ];
}

/**
 * نردبان داربست ۷پله‌ای — Pure. همهٔ دامنه‌های کتاب کد ۳۰۵ را پوشش می‌دهد.
 * خروجی: آرایهٔ ۷ پلهٔ { level, textFa, visual, sibling } یا null (ورودی نامعتبر / نقض ضدنشت).
 */
export function buildLadder(question) {
  const { f1, f2 } = question || {};
  const domain = classifyQuestionDomain({ f1, f2 });
  if (!domain) return null;

  let ladder = null;
  if (domain === 'table') ladder = buildTableLadder(f1, f2);
  else if (domain === 'identity') ladder = buildIdentityLadder(f1, f2);
  else if (domain === 'zero') ladder = buildZeroLadder(f1, f2);
  else if (domain === 'x10') ladder = buildX10Ladder(f1, f2);
  else if (domain === 'multi') ladder = buildMultiLadder(f1, f2);

  if (!ladder) return null;
  const minFactor = (domain === 'zero') ? 0 : (domain === 'identity') ? 1 : 2;
  return assertNoLeak(ladder, { f1, f2 }, { minFactor }) ? ladder : null;
}
