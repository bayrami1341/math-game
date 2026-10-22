// ─────────────────────────────────────────────────────────────────────────────
// اطلس و طبقه‌بند خطاهای شناختی ریاضی پایهٔ دوم دبستان (کد کتاب C205 — چاپ ۱۴۰۴)
//
// این ماژول کاملاً افزودنی و Pure است: هیچ وابستگی به DOM، فایل‌سیستم یا صدا ندارد
// و هیچ کلیدی در ERROR_CODES (نسخهٔ ۱۰.۲ ضرب) تغییر نمی‌دهد تا سازگاری پسین
// صددرصد حفظ شود.
//
// برچسب خطا نمره یا تنبیه نیست؛ تنها سرنخی برای آموزگار است و تصمیم نهایی با معلم است.
// ─────────────────────────────────────────────────────────────────────────────

const isInt = n => Number.isInteger(n);
const MAX_G2 = 9999;

/** ۶ کد هستهٔ پایهٔ دوم که در موج‌های ۱ تا ۴ به‌عنوان کدهای پایهٔ موتور ثبت شده‌اند */
export const CODES_G2_CONFIRMED = Object.freeze({
  E_PLACE_SWAP: 'جابه‌جایی ارزش مکانی (یکان/دهگان/صدگان)',
  E_ZERO_PLACE_MISS: 'حذف یا جابه‌جایی صفر جایگاه',
  E_ADD_CONFUSION: 'جمع به جای عمل خواسته یا جمع خام بدون دسته‌بندی',
  E_SUB_CONFUSION: 'تفریق به جای جمع یا وارونگی جهت روی محور',
  E_DOUBLE_OFF: 'لغزش شمارشی ±۱ یا ±گام الگو',
  E_SKIP_UNDERCOUNT: 'کم‌شماری در شمارش چندتایی یا محور'
});

/** ۷ کد پیشنهادی موج‌های ۲ تا ۴ پایهٔ دوم (نیازمند تأیید نهایی آموزگار برای ارتقا) */
export const CODES_G2_PROPOSED = Object.freeze({
  E_GROUPS: 'خطا در شمارش دسته‌های ده‌تایی و صدتایی',
  E_TABLE_NEIGHBOUR: 'لغزش به خانهٔ همسایه در جدول صدتایی یا محور',
  E_CARRY_MISS: 'فراموشی انتقال ده یکی به یک ده‌تایی (گره جمع)',
  E_BORROW_MISS: 'فراموشی باز کردن بستهٔ ده‌تایی در تفریق (قرض)',
  E_ROUND_NEAREST: 'گرد کردن در جهت نادرست به دهگان/صدگان همسایه',
  E_UNIT_VALUE_CONFUSION: 'خلط تعداد بسته/سکه با ارزش ریالی یا مکانی آن',
  E_APPROX_EXACT_CONFUSION: 'نوشتن حاصل دقیق به جای مقدار تقریبی خواسته‌شده'
});

export const CODES_G2 = Object.freeze({
  ...CODES_G2_CONFIRMED,
  ...CODES_G2_PROPOSED
});

export const CODE_SENTENCES_G2 = Object.freeze({
  E_PLACE_SWAP: 'جای رقم‌های یکان، دهگان یا صدگان را جابه‌جا دیده است.',
  E_ZERO_PLACE_MISS: 'صفر نگهبان جایگاه خالی را در نوشتن عدد جا انداخته است.',
  E_ADD_CONFUSION: 'به‌جای رابطهٔ خواسته‌شده، عددهای صورت مسئله را مستقیماً جمع بسته است.',
  E_SUB_CONFUSION: 'جهت حرکت یا عملگر را وارونه گرفته و تفریق انجام داده است.',
  E_DOUBLE_OFF: 'در گام آخر شمارش، یک واحد یا یک گام الگو جابه‌جا شده است.',
  E_SKIP_UNDERCOUNT: 'در شمارش چندتایی، یکی از پرش‌ها را کم شمرده است.',
  E_GROUPS: 'تعداد دسته‌های ده‌تایی یا صدتایی را ناتمام شمرده است.',
  E_TABLE_NEIGHBOUR: 'در جدول اعداد، یک ردیف یا یک ستون به خانهٔ همسایه لغزیده است.',
  E_CARRY_MISS: 'ده یکی را بستهٔ ده‌تایی نکرده و انتقال به دهگان را جا انداخته است.',
  E_BORROW_MISS: 'بدون باز کردن بستهٔ ده‌تایی، رقم‌ها را مستقیم کم کرده است.',
  E_ROUND_NEAREST: 'عدد را به دهگان یا صدگانِ دورتر گرد کرده است.',
  E_UNIT_VALUE_CONFUSION: 'تعداد سکه یا بسته را بدون درنظرگرفتن ارزش مکانیِ ۱۰ یا ۱۰۰ جمع زده است.',
  E_APPROX_EXACT_CONFUSION: 'به‌جای تقریب خواسته‌شده، خود عدد یا حاصل دقیق را نوشته است.'
});

const sortedDigits = n => String(Math.abs(n)).split('').sort().join('');
const digitSum = n => String(Math.abs(n)).split('').reduce((s, d) => s + Number(d), 0);

/**
 * طبقه‌بند Pure برای سؤالات فصل‌های ۱ تا ۴ پایهٔ دوم (ارزش مکانی، سکه، تقریب حذفی و گردکردن).
 * ورودی:
 *   spec = { mode: 'place3' | 'coins' | 'truncate10' | 'truncate100' | 'round10', target, exact? }
 * خروجی: رشتهٔ کد `E_...` یا `null` (پاسخ درست یا بی‌الگو؛ هرگز استثنا پرتاب نمی‌کند).
 */
export function classifyG2Attempt(spec, submitted) {
  if (!spec || typeof spec !== 'object' || !isInt(submitted)) return null;
  if (submitted < 0 || submitted > MAX_G2) return null;

  const { mode, target, exact } = spec;
  if (!isInt(target) || target < 0 || target > MAX_G2) return null;
  if (submitted === target) return null;

  if (mode === 'truncate10' || mode === 'truncate100' || mode === 'round10') {
    if (isInt(exact) && submitted === exact) return 'E_APPROX_EXACT_CONFUSION';
    const step = mode === 'truncate100' ? 100 : 10;
    if (submitted % step === 0 && Math.abs(submitted - target) <= 2 * step) return 'E_ROUND_NEAREST';
    if (Math.abs(submitted - target) === 1) return 'E_DOUBLE_OFF';
    return null;
  }

  // حذف صفر جایگاه (مثل ۴۰۵ -> ۴۵ یا ۳۴۰ -> ۳۴)
  const stripped = String(target).replace(/0/g, '');
  if (stripped && Number(stripped) === submitted) return 'E_ZERO_PLACE_MISS';

  // جابه‌جایی ارقام (جایگشت یکسان ارقام مثل ۳۲۶ -> ۳۶۲ یا ۶۴۳ -> ۶۳۴)
  if (String(target).length >= 2 && sortedDigits(target) === sortedDigits(submitted)) {
    return 'E_PLACE_SWAP';
  }

  // خلط تعداد و ارزش واحد (جمع ارقام بدون وزن مکانی مثل ۳۰۰+۲۰+۶ -> ۱۱ یا ۴۰۵ -> ۹)
  if (digitSum(target) === submitted) return 'E_UNIT_VALUE_CONFUSION';
  if (mode === 'coins' && isInt(exact) && submitted === exact) return 'E_UNIT_VALUE_CONFUSION';

  if (Math.abs(submitted - target) === 1) return 'E_DOUBLE_OFF';
  return null;
}
