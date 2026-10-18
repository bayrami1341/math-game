// ─────────────────────────────────────────────────────────────────────────────
// نردبان داربست ۷پله‌ای (CEAP §8) — راهنمای تدریجی ضرب برای کودک فارسی‌زبان
//
// فلسفه (§8): داربست یعنی «کمکِ بیشتر، فشارِ کمتر» — هر پله فقط یک قدم جلوتر
// می‌رود و حاصلِ نهایی مسئلهٔ اصلی هرگز به رقم گفته نمی‌شود (ممانعت از افشای پاسخ).
//   پلهٔ ۱ جلب توجه | پلهٔ ۲ دست‌ورزی ملموس | پلهٔ ۳ بازنمایی تصویری
//   پلهٔ ۴ پرسش راهبردی متاتحلیلی | پلهٔ ۵ اعلان گام میانی
//   پلهٔ ۶ تجزیهٔ ساختاری (لنگر ۵ یا ۱۰ یا ۲) | پلهٔ ۷ حل نمونهٔ موازی
// تنها پلهٔ ۷ عدد حاصل دارد — و آن حاصل مال مسئلهٔ «هم‌خانوادهٔ دیگری» است.
//
// ضدنشت اجباری (§8.2): assertNoLeak در پله‌ها بررسی می‌کند که حاصل f1×f2 به‌صورت
// «توکن عددی مستقل» (جدا با نویسهٔ غیررقمی، فاصله، ابتدا یا انتهای رشته) در متن
// پله‌های ۱ تا ۶ نیامده باشد — هم با ارقام فارسی و هم لاتین. پلهٔ ۷ هم باید
// نمونهٔ موازیِ متفاوتی از (f1,f2) و (f2,f1) داشته باشد. buildLadder در پایان
// خودش assertNoLeak را اجرا می‌کند و در صورت نقض null برمی‌گرداند تا UI به
// راهنمای یک‌پله‌ای قدیمی (createQuestionGuide) برگردد.
//
// این ماژول Pure است: هیچ وابستگی به DOM، صدا یا وضعیت بازی ندارد.
// ─────────────────────────────────────────────────────────────────────────────

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const toFa = num => String(num).replace(/\d/g, d => FA_DIGITS[Number(d)]);

// متن را به «توکن‌های عددی» تجزیه می‌کند: هر نویسهٔ غیررقمی جداکننده است،
// پس «۱۲۳» هرگز با جست‌وجوی «۱۲» اشتباه گرفته نمی‌شود (مقایسهٔ رشته‌ای دقیق).
const numericTokens = text => String(text || '').split(/[^0-9۰-۹]+/).filter(Boolean);

const isValidQuestion = q => {
  if (!q || typeof q !== 'object') return false;
  const { f1, f2 } = q;
  return Number.isInteger(f1) && Number.isInteger(f2)
    && f1 >= 2 && f2 >= 2 && f1 <= 12 && f2 <= 12;
};

// پلهٔ ۶ — تجزیهٔ ساختاری بر پایهٔ لنگر نزدیک؛ حاصل نهایی هرگز نوشته نمی‌شود:
//   f2 ≥ ۸   → لنگر ۱۰ (تفکیک دهگان با کم‌کردن اضافه)
//   f2 = ۶,۷ → لنگر ۵ (پنج + باقی)
//   f2 = ۳..۵ → لنگر ۲ (تقسیم به ۲ و باقی)
//   f2 = ۲   → دوبرابر کردن (تجزیهٔ بی‌معنا می‌شود)
function decompositionTextFa(f1, f2) {
  if (f2 >= 8) {
    return `${toFa(f1)}×${toFa(f2)} = ${toFa(f1)}×۱۰ − ${toFa(f1)}×${toFa(10 - f2)} — ده دستهٔ کامل را بشمار، بعد اضافه‌ها را بردار.`;
  }
  if (f2 > 5) {
    return `${toFa(f1)}×${toFa(f2)} = ${toFa(f1)}×۵ + ${toFa(f1)}×${toFa(f2 - 5)} — پنج دسته را که راحت‌تر می‌شماری، باقی را اضافه کن.`;
  }
  if (f2 === 2) {
    return `${toFa(f1)}×۲ یعنی دو تا از ${toFa(f1)}: یک ${toFa(f1)} و باز یک ${toFa(f1)} را با هم بشمار.`;
  }
  return `${toFa(f1)}×${toFa(f2)} = ${toFa(f1)}×۲ + ${toFa(f1)}×${toFa(f2 - 2)} — دو دسته را که بلدی، باقی را اضافه کن.`;
}

// پلهٔ ۷ — مسئلهٔ هم‌خانوادهٔ موازی: هرگز برابر (f1,f2) یا (f2,f1) نیست.
// کاندید اول مطابق دستور: (f1, f2===3 ? 4 : 3)؛ کاندیدهای بعدی صرفاً محافظ‌اند.
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
 * راستی‌آزمایی ضدنشت (CEAP §8.2).
 * خروجی: true یعنی نردبان امن است؛ false یعنی نقض (leak یا نمونهٔ موازی نامعتبر).
 */
export function assertNoLeak(ladder, { f1, f2 } = {}) {
  if (!isValidQuestion({ f1, f2 })) return false;
  if (!Array.isArray(ladder) || ladder.length !== 7) return false;
  const product = f1 * f2;
  const forbidden = [toFa(product), String(product)];

  for (const step of ladder) {
    if (!step || typeof step.textFa !== 'string') return false;
    if (!Number.isInteger(step.level) || step.level < 1 || step.level > 7) return false;
    const tokens = numericTokens(step.textFa);
    // پله‌های ۱–۶: حاصل نهایی مطلقاً ممنوع | پلهٔ ۷: فقط حاصل مسئلهٔ موازی مجاز است
    if (tokens.some(t => forbidden.includes(t))) return false;
    if (step.level <= 6 && step.visual === 'equal-groups' && step.level !== 3) return false;
  }

  // پلهٔ ۷ باید نمونهٔ موازیِ متفاوت با پاسخ فارسی درست داشته باشد
  const last = ladder[6];
  const sibling = last.sibling;
  if (!sibling || typeof sibling !== 'object') return false;
  const { f1: a, f2: b, answerFa } = sibling;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 2 || b < 2) return false;
  if ((a === f1 && b === f2) || (a === f2 && b === f1)) return false;
  if (answerFa !== toFa(a * b)) return false;
  return true;
}

/**
 * نردبان داربست ۷پله‌ای — Pure.
 * خروجی: آرایهٔ ۷ پلهٔ { level, textFa, visual, sibling } یا null (ورودی نامعتبر / نقض ضدنشت).
 */
export function buildLadder(question) {
  const { f1, f2 } = question || {};
  if (!isValidQuestion({ f1, f2 })) return null;

  const sibling = pickSibling(f1, f2);

  const ladder = [
    {
      // پلهٔ ۱ — جلب توجه: فقط نگاه به عددهای خود مسئله
      level: 1,
      textFa: `به عددها خوب نگاه کن: ${toFa(f1)} دستهٔ ${toFa(f2)}تایی می‌خواهد بسازی.`,
      visual: null,
      sibling: null
    },
    {
      // پلهٔ ۲ — دست‌ورزی ملموس: ساختن با اشیای واقعی یا انگشت‌ها
      level: 2,
      textFa: `با چیزی واقعی بساز: ${toFa(f1)} دسته درست کن و در هر دسته ${toFa(f2)} تا بگذار — با دکمه، لوبیا یا انگشت‌هایت.`,
      visual: null,
      sibling: null
    },
    {
      // پلهٔ ۳ — بازنمایی تصویری: دسته‌های مساوی (UI همان renderEqualGroupsSVG(f1,f2) را رندر می‌کند)
      level: 3,
      textFa: `این ${toFa(f1)} دستهٔ ${toFa(f2)}تایی را ببین و یکی‌یکی بشمار.`,
      visual: 'equal-groups',
      sibling: null
    },
    {
      // پلهٔ ۴ — پرسش راهبردی متاتحلیلی (هیچ عددی نمی‌گوید)
      level: 4,
      textFa: 'کدام ضربِ ساده‌تر چیزی شبیه به این است که بلد باشی؟',
      visual: null,
      sibling: null
    },
    {
      // پلهٔ ۵ — اعلان گام میانی: نیمه‌راه، بدون هیچ عددی از حاصل
      level: 5,
      textFa: 'نیمی از دسته‌ها را روشن کن و بعد ادامه بده.',
      visual: null,
      sibling: null
    },
    {
      // پلهٔ ۶ — تجزیهٔ ساختاری با لنگر نزدیک (حاصل نهایی نوشته نمی‌شود)
      level: 6,
      textFa: decompositionTextFa(f1, f2),
      visual: null,
      sibling: null
    },
    {
      // پلهٔ ۷ — حل نمونهٔ مشابه موازی (فقط اینجا حاصل — برای مسئلهٔ دیگر)
      level: 7,
      textFa: `${toFa(sibling.f1)}×${toFa(sibling.f2)} = ${toFa(sibling.f1 * sibling.f2)} چون ${toFa(sibling.f1)} دستهٔ ${toFa(sibling.f2)}تایی داریم. حالا خودت مسئلهٔ اصلی را امتحان کن.`,
      visual: null,
      sibling: { f1: sibling.f1, f2: sibling.f2, answerFa: toFa(sibling.f1 * sibling.f2) }
    }
  ];

  return assertNoLeak(ladder, { f1, f2 }) ? ladder : null;
}
