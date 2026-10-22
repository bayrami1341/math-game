// آزمون‌های موتور خانوادهٔ ۲و۳ (v10.3 — موج الف) — سبک v10.2-errors
// پوشش: ثبت ۸ کد، زنجیرهٔ اولویت، پنج تشخیص‌گر ستونی/تقسیم/چهاررقمی،
// دیسپچر و اولویت‌ها، گاردهای سخت، و فاز fuzz بدون استثنا
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODES_V103,
  CODE_SENTENCES_V103,
  PRIORITY_V103,
  classifyColumnSum,
  classifyColumnSub,
  classifyColumnMultiply,
  classifyDivisionAttempt,
  classifyFourDigit,
  classifyV103
} from '../src/v10/station/errors-v103.js';

test('1. ثبت ۱۱ کد خانوادهٔ ۲و۳: متادیتا کامل + زنجیرهٔ PRIORITY_V103', () => {
  const codes = Object.keys(CODES_V103);
  assert.equal(codes.length, 11);
  for (const code of codes) {
    const m = CODES_V103[code];
    assert.equal(typeof m.nameFa, 'string', `نام فارسی ${code}`);
    assert.ok(m.nameFa.length > 2, `نام فارسی کوتاه ${code}`);
    assert.ok([1, 2, 3].includes(m.family), `خانوادهٔ ${code}`);
    assert.ok(['مفهومی', 'راهبردی', 'محاسباتی'].includes(m.severity), `شدت ${code}`);
  }
  // خانواده‌ها: گره/قرض خانوادهٔ ۲، چهاررقمی/ارزش مکانی خانوادهٔ ۳
  assert.equal(CODES_V103.E_CARRY_MISS.family, 2);
  assert.equal(CODES_V103.E_BORROW_MISS.family, 2);
  assert.equal(CODES_V103.E_ZERO_PLACE_MISS.family, 3);
  // زنجیرهٔ برچسب‌گذاری: همهٔ ۱۱ کد، دقیقاً با همین ترتیب — سه کد تازه در انتها
  assert.deepEqual([...PRIORITY_V103], [
    'E_REMAINDER_DROP', 'E_OP_REVERSE', 'E_GROUP_VS_COUNT', 'E_FACT_CONFUSION',
    'E_CARRY_MISS', 'E_BORROW_MISS', 'E_ZERO_PLACE_MISS', 'E_UNEQUAL_GROUP',
    'E_ROUND_NEAREST', 'E_UNIT_VALUE_CONFUSION', 'E_APPROX_EXACT_CONFUSION'
  ]);
});

test('2. جمع ستونی: گرهٔ جاافتاده — ۳۵۸+۲۴۶ (نمونهٔ طلایی)', () => {
  assert.equal(classifyColumnSum(358, 246, 604), null); // درست
  assert.equal(classifyColumnSum(358, 246, 594), 'E_CARRY_MISS'); // جمعِ بدون‌گره
  // جمع بدون نیاز به گره — فقط درست/null
  assert.equal(classifyColumnSum(123, 234, 357), null);
  assert.equal(classifyColumnSum(123, 234, 356), null); // بی‌الگو
});

test('3. تفریق ستونی: قرض جاافتاده — ۵۲−۲۷ (نمونهٔ طلایی)', () => {
  assert.equal(classifyColumnSub(52, 27, 25), null); // درست
  assert.equal(classifyColumnSub(52, 27, 35), 'E_BORROW_MISS'); // تفریقِ بدون‌قرض
  assert.equal(classifyColumnSub(63, 48, 15), null); // درست
  assert.equal(classifyColumnSub(63, 48, 25), 'E_BORROW_MISS'); // بدون‌قرض (رقم منفی mod ۱۰)
});

test('4. ضرب ستونی تک‌رقمی: ۲۶×۳ (سناریوی Q-112) و ضرایب ۰ و ۱', () => {
  assert.equal(classifyColumnMultiply(26, 3, 78), null); // درست
  assert.equal(classifyColumnMultiply(26, 3, 68), 'E_CARRY_MISS'); // بدون‌گره
  assert.equal(classifyColumnMultiply(26, 1, 26), null); // درست
  assert.equal(classifyColumnMultiply(26, 1, 68), null); // گره ناممکن — صادقانه بی‌الگو
  assert.equal(classifyColumnMultiply(26, 0, 0), null); // درست
  assert.equal(classifyColumnMultiply(26, 0, 26), null); // گره ناممکن — صادقانه بی‌الگو
});

test('5. تقسیم دقیق: ۱۸÷۶=۳ بی‌الگو', () => {
  assert.equal(classifyDivisionAttempt(18, 6, 3), null);
  assert.equal(classifyDivisionAttempt(42, 7, 6), null);
  assert.equal(classifyV103({ op: 'div', a: 18, b: 6 }, 3), null);
});

test('6. مدیریت‌نشدن باقیمانده: ۱۹÷۴ — فقط با فلگ totalDivision (قرارداد Q-204)', () => {
  assert.equal(classifyDivisionAttempt(19, 4, 4, { totalDivision: true }), 'E_REMAINDER_DROP');
  assert.equal(classifyDivisionAttempt(19, 4, 5, { totalDivision: true }), 'E_REMAINDER_DROP');
  // بدون فلگ: «چند جعبهٔ کامل؟» جواب ۴ درست است — صادقانه null
  assert.equal(classifyDivisionAttempt(19, 4, 4), null);
  assert.equal(classifyDivisionAttempt(19, 4, 5), null);
  assert.equal(classifyDivisionAttempt(19, 4, 4, { totalDivision: false }), null);
});

test('7. عمل جایگزین‌شده: ۱۲÷۳ → ۹/۱۵/۳۶ (سناریوی Q-201)', () => {
  assert.equal(classifyDivisionAttempt(12, 3, 9), 'E_OP_REVERSE');  // تفریق
  assert.equal(classifyDivisionAttempt(12, 3, 15), 'E_OP_REVERSE'); // جمع
  assert.equal(classifyDivisionAttempt(12, 3, 36), 'E_OP_REVERSE'); // ضرب
  assert.equal(classifyDivisionAttempt(12, 3, 4), null); // درست
});

test('8. خلط گروه و شمارش: ۱۸÷۶ → ۶ و ۱۸', () => {
  assert.equal(classifyDivisionAttempt(18, 6, 6), 'E_GROUP_VS_COUNT'); // اندازهٔ گروه
  assert.equal(classifyDivisionAttempt(18, 6, 18), 'E_GROUP_VS_COUNT'); // تعداد کل
  assert.equal(classifyDivisionAttempt(18, 6, 2), null); // بی‌الگو
});

test('9. خلط فکت جدول: فکت همسایه — و صداقت با پاسخ درست', () => {
  // ۴۲÷۷=۶ و ۴۲÷۶=۷ هر دو درست‌اند — بی‌الگو (تسک خودش اصلاح کرد: «درست ۴۲÷۷=۶ است»)
  assert.equal(classifyDivisionAttempt(42, 7, 6), null);
  assert.equal(classifyDivisionAttempt(42, 6, 7), null);
  // فکت همسایهٔ پایین: ۲۴÷۴ → ۸ یعنی فکت ۲۴÷۳=۸
  assert.equal(classifyDivisionAttempt(24, 4, 8), 'E_FACT_CONFUSION');
  // ۴۰÷۵ → ۱۰ یعنی فکت ۴۰÷۴=۱۰
  assert.equal(classifyDivisionAttempt(40, 5, 10), 'E_FACT_CONFUSION');
  // فکت همسایهٔ بالا: ۶۰÷۵ → ۱۰ یعنی فکت ۶۰÷۶=۱۰
  assert.equal(classifyDivisionAttempt(60, 5, 10), 'E_FACT_CONFUSION');
  // همسایهٔ کوچک‌تر از ۲ (÷۱) «فکت» نیست — نوشتن تعداد کل، خودش الگوی گروه است
  assert.equal(classifyDivisionAttempt(18, 2, 18), 'E_GROUP_VS_COUNT');
});

test('10. چهاررقمی: حذف صفر جایگاه — ۴۰۷۰ (سناریوی Q-205)', () => {
  assert.equal(classifyFourDigit(4070, 470), 'E_ZERO_PLACE_MISS'); // صفر میانه حذف شد
  assert.equal(classifyFourDigit(4070, 407), null); // خانوادهٔ ÷۱۰ — صادقانه بی‌الگو
  assert.equal(classifyFourDigit(4070, 4070), null); // درست
  assert.equal(classifyFourDigit(4007, 407), 'E_ZERO_PLACE_MISS'); // صفر میانهٔ دوم
  assert.equal(classifyFourDigit(4007, 7), null); // حذفی که صفر پیشرو بسازد — بی‌الگو
  assert.equal(classifyFourDigit(4070, 47), null); // دو حذف — بی‌الگو
});

test('11. دیسپچر classifyV103: اولویت‌ها و op نامعلوم', () => {
  // دو کد همزمان: ۴۲÷۶→۶ هم «خلط گروه» است (۶=مقسوم‌علیه) هم «فکت همسایه» (۴۲÷۷=۶) — گروه مقدم است
  assert.equal(classifyV103({ op: 'div', a: 42, b: 6 }, 6), 'E_GROUP_VS_COUNT');
  // دو کد همزمان: ۵÷۳→۲ با فلگ هم «باقیمانده ریخته» است (۱+۱) هم «تفریق» (۵−۳) — باقیمانده مقدم است
  assert.equal(classifyV103({ op: 'div', a: 5, b: 3, totalDivision: true }, 2), 'E_REMAINDER_DROP');
  // همان پاسخ بدون فلگ → عمل جایگزین
  assert.equal(classifyV103({ op: 'div', a: 5, b: 3 }, 2), 'E_OP_REVERSE');
  // مسیرهای دیگر دیسپچر
  assert.equal(classifyV103({ op: 'sum', a: 358, b: 246 }, 594), 'E_CARRY_MISS');
  assert.equal(classifyV103({ op: 'sub', a: 52, b: 27 }, 35), 'E_BORROW_MISS');
  assert.equal(classifyV103({ op: 'mulcol', a: 26, b: 3 }, 68), 'E_CARRY_MISS');
  assert.equal(classifyV103({ op: 'read', a: 4070 }, 470), 'E_ZERO_PLACE_MISS');
  // op نامعلوم / گمشده
  assert.equal(classifyV103({ op: 'modulo', a: 12, b: 3 }, 9), null);
  assert.equal(classifyV103({ a: 12, b: 3 }, 9), null);
});

test('12. گاردهای سخت: NaN/رشته/اعشار/منفی/صفرِ تقسیم/خارج دامنه → null و بدون استثنا', () => {
  // NaN و رشته و اعشار
  assert.equal(classifyColumnSum(NaN, 246, 594), null);
  assert.equal(classifyColumnSum('358', 246, 594), null);
  assert.equal(classifyColumnSum(358, 246, '594'), null);
  assert.equal(classifyColumnSum(358.5, 246, 604), null);
  assert.equal(classifyColumnSub(52, NaN, 35), null);
  assert.equal(classifyColumnMultiply('26', 3, 68), null);
  assert.equal(classifyColumnMultiply(26, 3.5, 68), null);
  assert.equal(classifyDivisionAttempt(12, 3, NaN), null);
  assert.equal(classifyFourDigit(4070, '470'), null);
  // منفی
  assert.equal(classifyColumnSum(358, 246, -1), null);
  assert.equal(classifyColumnSub(-52, 27, 35), null);
  assert.equal(classifyDivisionAttempt(-12, 3, 9), null);
  assert.equal(classifyFourDigit(-4070, 470), null);
  // صفرِ تقسیم (مخرج نامعتبر)
  assert.equal(classifyDivisionAttempt(12, 0, 9), null);
  assert.equal(classifyDivisionAttempt(12, -3, 9), null);
  // خارج دامنهٔ کتاب (۹۹۹۹+)
  assert.equal(classifyColumnSum(10000, 246, 10246), null);
  assert.equal(classifyColumnSum(9999, 9999, 19999), null);
  assert.equal(classifyColumnSub(52, 27, 10000), null);
  assert.equal(classifyColumnMultiply(26, 10, 68), null); // ضریب دومرقمی بیرون قرارداد
  assert.equal(classifyDivisionAttempt(12, 3, 10000), null);
  assert.equal(classifyFourDigit(407, 470), null); // سه‌رقمی بیرون قرارداد چهاررقمی
  assert.equal(classifyFourDigit(10000, 1000), null);
  // ورودی‌های بدشکل — هرگز استثنا نمی‌دهد
  assert.equal(classifyDivisionAttempt(19, 4, 4, null), null); // opts بدشکل
  assert.equal(classifyDivisionAttempt(19, 4, 4, 42), null);
  assert.equal(classifyV103(null, 5), null);
  assert.equal(classifyV103('sum', 5), null);
  assert.equal(classifyV103({ op: 'sum' }, 5), null);
  assert.doesNotThrow(() => {
    classifyColumnSum(undefined, undefined, undefined);
    classifyColumnSub({}, {}, {});
    classifyColumnMultiply([], [], []);
    classifyDivisionAttempt(12, 3, 9, { totalDivision: 'yes' });
    classifyFourDigit(4070, Infinity);
  });
});

test('13. همهٔ جمله‌های CODE_SENTENCES_V103 برای ۸ کد موجود', () => {
  const codes = Object.keys(CODES_V103);
  assert.equal(Object.keys(CODE_SENTENCES_V103).length, codes.length);
  for (const code of codes) {
    const s = CODE_SENTENCES_V103[code];
    assert.equal(typeof s, 'string', `جملهٔ ${code} موجود است`);
    assert.ok(s.length > 5, `جملهٔ ${code} طولانی‌تر از ۵ کاراکتر`);
    assert.ok(!s.includes('اشتباه کردی'), 'جملهٔ کودک‌ستیز ممنوع');
  }
});

test('14. فاز fuzz: ۳۰۰ ورودی تصادفی به هر ۵ تابع — هیچ استثنایی و خروجی هم‌قرارداد', () => {
  // مولد شبه‌تصادفی با seed ثابت — آزمون قطعی می‌ماند
  const mulberry32 = seed => () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rnd = mulberry32(1033);
  const junk = [null, undefined, NaN, '۳', 1.5, -1, 1e15, Infinity, {}, true];
  const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const any = () => (rnd() < 0.15 ? junk[ri(0, junk.length - 1)] : ri(0, 10050));
  const CODE_SET = new Set(Object.keys(CODES_V103));
  const OPS = ['sum', 'sub', 'mulcol', 'div', 'read', '؟'];

  let throws = 0;
  const offContract = [];
  const check = fn => {
    let out;
    try { out = fn(); } catch { throws++; return; }
    if (out !== null && !(typeof out === 'string' && CODE_SET.has(out))) {
      offContract.push(String(out));
    }
  };

  for (let i = 0; i < 300; i++) {
    const a = any(); const b = any(); const s = any();
    const j = junk[ri(0, junk.length - 1)];
    check(() => classifyColumnSum(a, b, s));
    check(() => classifyColumnSub(a, b, s));
    check(() => classifyColumnMultiply(a, b, s));
    check(() => classifyDivisionAttempt(a, b, s, rnd() < 0.5 ? { totalDivision: rnd() < 0.5 } : j));
    check(() => classifyFourDigit(a, s));
    check(() => classifyV103(rnd() < 0.2 ? j : { op: OPS[ri(0, OPS.length - 1)], a, b, totalDivision: rnd() < 0.5 }, s));
  }

  assert.equal(throws, 0, 'هیچ استثنایی در فاز fuzz');
  assert.deepEqual(offContract, [], 'همهٔ خروجی‌ها کد شناخته‌شده یا null');
});
