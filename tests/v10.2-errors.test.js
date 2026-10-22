// آزمون‌های اطلس تشخیصی ۱۲خطای ضرب (v10.2 — سند پداگوژیک فصل ۳ + نقد فنی ۱.۲.۰)
// پوشش: اولویت کدها، شاخص‌های ساختاری، کدهای رفتاری، حدس بی‌ربط، کد غالب
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ERROR_CODES,
  CODE_SEVERITY_ORDER,
  CODE_SENTENCES_FA,
  classifyAttempt,
  detectBehavioralCode,
  countIrrelevantAttempts,
  dominantCode
} from '../src/v10/station/errors.js';

test('1. اطلس ۱۴ کد دارد (۱۲ کد ضرب + ۲ کد تازهٔ خشاب G2 با پذیرش معلم) و هر کد جملهٔ کارت معلم و شدت دارد', () => {
  const codes = Object.keys(ERROR_CODES);
  assert.equal(codes.length, 14);
  for (const code of codes) {
    assert.equal(typeof CODE_SENTENCES_FA[code], 'string', `جملهٔ ${code}`);
    assert.ok(CODE_SENTENCES_FA[code].length > 5);
    assert.ok(CODE_SEVERITY_ORDER.includes(code), `${code} در ترتیب شدت`);
    assert.ok(!CODE_SENTENCES_FA[code].includes('اشتباه کردی'), 'جملهٔ کودک‌ستیز ممنوع');
  }
  assert.equal(CODE_SEVERITY_ORDER.length, 14);
});

test('2. E_ADD_CONFUSION: حاصل برابر جمع دو عامل (نمونهٔ سند: ۳×۶→۹، ۴×۵→۹)', () => {
  assert.equal(classifyAttempt({ f1: 3, f2: 6, submitted: 9 }), 'E_ADD_CONFUSION');
  assert.equal(classifyAttempt({ f1: 4, f2: 5, submitted: 9 }), 'E_ADD_CONFUSION');
  assert.equal(classifyAttempt({ f1: 7, f2: 8, submitted: 15 }), 'E_ADD_CONFUSION');
  // پاسخ درست خطا نیست
  assert.equal(classifyAttempt({ f1: 3, f2: 6, submitted: 18 }), null);
});

test('3. E_ZERO_PROPERTY: حاصل را خود عدد یا ۱ می‌نویسد — و بر E_ADD مقدم است (نقد ۳)', () => {
  assert.equal(classifyAttempt({ f1: 5, f2: 0, submitted: 5 }), 'E_ZERO_PROPERTY');
  assert.equal(classifyAttempt({ f1: 0, f2: 7, submitted: 7 }), 'E_ZERO_PROPERTY');
  assert.equal(classifyAttempt({ f1: 6, f2: 0, submitted: 1 }), 'E_ZERO_PROPERTY');
  // «۵×۰ → ۵» هم الگوی جمع است (۵+۰=۵) ولی اولویت با ZERO است
  assert.notEqual(classifyAttempt({ f1: 5, f2: 0, submitted: 5 }), 'E_ADD_CONFUSION');
});

test('4. E_IDENTITY_CONFUSION: در ضرب در یک، حاصل را ۱ می‌نویسد', () => {
  assert.equal(classifyAttempt({ f1: 8, f2: 1, submitted: 1 }), 'E_IDENTITY_CONFUSION');
  assert.equal(classifyAttempt({ f1: 1, f2: 9, submitted: 1 }), 'E_IDENTITY_CONFUSION');
  // نوشتن خود عدد در ضرب در یک پاسخ درست است، نه خطا
  assert.equal(classifyAttempt({ f1: 8, f2: 1, submitted: 8 }), null);
});

test('5. E_PLACE_SHIFT: حاصل ۱۰ برابر یا یک‌دهم (نمونهٔ سند: ۳×۲۰ → ۶ یا ۶۰۰)', () => {
  assert.equal(classifyAttempt({ f1: 3, f2: 20, submitted: 6 }), 'E_PLACE_SHIFT');
  assert.equal(classifyAttempt({ f1: 3, f2: 20, submitted: 600 }), 'E_PLACE_SHIFT');
  assert.equal(classifyAttempt({ f1: 4, f2: 5, submitted: 20 }), null); // درست
  assert.equal(classifyAttempt({ f1: 4, f2: 5, submitted: 200 }), 'E_PLACE_SHIFT');
});

test('6. E_ANCHOR_DRIFT: جا ماندن جزء دوم شکستن (لنگر ۵ — صفحهٔ ۷۰–۷۲)', () => {
  // ۷×۸ = ۷×۵ + ۷×۳ — نوشتن ۳۵ یعنی جزء دوم جا مانده
  assert.equal(classifyAttempt({ f1: 7, f2: 8, submitted: 35 }), 'E_ANCHOR_DRIFT');
  assert.equal(classifyAttempt({ f1: 7, f2: 8, submitted: 40 }), 'E_ANCHOR_DRIFT');
  // ۴×۷: ۴×۵ = ۲۰
  assert.equal(classifyAttempt({ f1: 4, f2: 7, submitted: 20 }), 'E_ANCHOR_DRIFT');
  // لنگر ۵ در ضرب در ۵ خودِ پاسخ درست است
  assert.equal(classifyAttempt({ f1: 5, f2: 7, submitted: 35 }), null);
});

test('7. E_DISTRIBUTIVE_LEAK: فقط یکی‌ها یا فقط ده‌تایی‌ها (صفحهٔ ۱۳۹ به بعد)', () => {
  // ۳×۲۴ = ۳×۲۰ + ۳×۴ — نوشتن ۱۲ (فقط یکی‌ها) یا ۶۰ (فقط ده‌تایی‌ها)
  assert.equal(classifyAttempt({ f1: 3, f2: 24, submitted: 12 }), 'E_DISTRIBUTIVE_LEAK');
  assert.equal(classifyAttempt({ f1: 3, f2: 24, submitted: 60 }), 'E_DISTRIBUTIVE_LEAK');
  // پاسخ درست خطا نیست
  assert.equal(classifyAttempt({ f1: 3, f2: 24, submitted: 72 }), null);
});

test('8. E_SKIP_OVER/UNDERCOUNT: یک پرش کمتر یا بیشتر (± عامل)', () => {
  // ۵×۸ = ۴۰ — یک پرش ۸تایی اضافه/کم
  assert.equal(classifyAttempt({ f1: 5, f2: 8, submitted: 48 }), 'E_SKIP_OVERCOUNT');
  assert.equal(classifyAttempt({ f1: 5, f2: 8, submitted: 32 }), 'E_SKIP_UNDERCOUNT');
  // پرش با عامل دیگر (شمارش ۵تا۵تا) — ۴۵ نه لنگر است نه حاصل
  assert.equal(classifyAttempt({ f1: 5, f2: 8, submitted: 45 }), 'E_SKIP_OVERCOUNT');
  // ۳۵ در ۶×۷ لنگر است نه کم‌شماری (تقدم ANCHOR — نقد ۳)
  assert.equal(classifyAttempt({ f1: 6, f2: 7, submitted: 35 }), 'E_ANCHOR_DRIFT');
});

test('9. کدهای رفتاری: جابه‌جایی و لغزش بعد از تسلط (سطح تعامل)', () => {
  // ۷×۴ پذیرفته شده؛ حالا ۴×۷ غلط — شکست جابه‌جایی
  const accepted = [{ f1: 7, f2: 4 }];
  assert.equal(detectBehavioralCode({ f1: 4, f2: 7, acceptedFacts: accepted }), 'E_COMMUTATIVE_FAIL');
  // ۶×۶ پذیرفته؛ دوباره ۶×۶ غلط — لغزش بعد از تسلط
  assert.equal(detectBehavioralCode({ f1: 6, f2: 6, acceptedFacts: [{ f1: 6, f2: 6 }] }), 'E_FATIGUE_SLIP');
  // بدون تاریخچه هیچ کدام
  assert.equal(detectBehavioralCode({ f1: 4, f2: 7, acceptedFacts: [] }), null);
  assert.equal(detectBehavioralCode({ f1: 4, f2: 7, acceptedFacts: null }), null);
});

test('10. E_PERSISTENT_GUESSING: سه پاسخ بی‌الگو — زمان معیار نیست (تعریف عملیاتی نقد ۱۰)', () => {
  const wrongs = [
    { f1: 7, f2: 8, submitted: 100, code: null, behavioral: null },
    { f1: 9, f2: 6, submitted: 77, code: null, behavioral: null },
    { f1: 4, f2: 9, submitted: 50, code: null, behavioral: null }
  ];
  assert.equal(countIrrelevantAttempts(wrongs), 3);
  // دو پاسخ بی‌الگو هنوز پرچم نیست (حد نصاب: سه)
  assert.equal(countIrrelevantAttempts(wrongs.slice(0, 2)), 2);
  // پاسخ‌های الگودار شمرده نمی‌شوند
  assert.equal(countIrrelevantAttempts([{ f1: 3, f2: 6, submitted: 9, code: 'E_ADD_CONFUSION' }]), 0);
});

test('11. dominantCode: شدت و تکرار — خطای مفهومی شدت‌بالا بر کدهای جزئی مقدم است', () => {
  assert.equal(dominantCode({ E_ADD_CONFUSION: 1, E_SKIP_OVERCOUNT: 3 }), 'E_ADD_CONFUSION');
  assert.equal(dominantCode({ E_SKIP_UNDERCOUNT: 2, E_SKIP_OVERCOUNT: 1 }), 'E_SKIP_OVERCOUNT');
  assert.equal(dominantCode({ UNCLASSIFIED: 3 }), null); // UNCLASSIFIED کد نمایشی نیست
  assert.equal(dominantCode({}), null);
  assert.equal(dominantCode(null), null);
});

test('12. ایمنی ورودی:classifyAttempt با ورودی‌های ناقص استثنا نمی‌دهد', () => {
  assert.equal(classifyAttempt({}), null);
  assert.equal(classifyAttempt(null), null);
  assert.equal(classifyAttempt({ f1: 3, f2: 4 }), null);
  assert.equal(classifyAttempt({ f1: 3.5, f2: 4, submitted: 14 }), null);
  assert.equal(classifyAttempt({ f1: 3, f2: 4, submitted: '12' }), null);
  assert.doesNotThrow(() => classifyAttempt({ f1: 999, f2: 999, submitted: 999 }));
});
