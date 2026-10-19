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

test('1. classifyAttempt: E_ZERO_PROPERTY (حاصل را خود عدد یا یک می‌نویسد)', () => {
  assert.equal(classifyAttempt({ f1: 5, f2: 0, submitted: 5 }), 'E_ZERO_PROPERTY');
  assert.equal(classifyAttempt({ f1: 0, f2: 8, submitted: 8 }), 'E_ZERO_PROPERTY');
  assert.equal(classifyAttempt({ f1: 4, f2: 0, submitted: 1 }), 'E_ZERO_PROPERTY');
});

test('2. classifyAttempt: E_IDENTITY_CONFUSION (در ضرب در یک، حاصل را ۱ می‌نویسد)', () => {
  assert.equal(classifyAttempt({ f1: 7, f2: 1, submitted: 1 }), 'E_IDENTITY_CONFUSION');
  assert.equal(classifyAttempt({ f1: 1, f2: 9, submitted: 1 }), 'E_IDENTITY_CONFUSION');
});

test('3. classifyAttempt: E_ADD_CONFUSION (جمع به جای ضرب)', () => {
  assert.equal(classifyAttempt({ f1: 3, f2: 6, submitted: 9 }), 'E_ADD_CONFUSION');
  assert.equal(classifyAttempt({ f1: 4, f2: 5, submitted: 9 }), 'E_ADD_CONFUSION');
  assert.equal(classifyAttempt({ f1: 2, f2: 4, submitted: 6 }), 'E_ADD_CONFUSION');
});

test('4. classifyAttempt: E_PLACE_SHIFT (لغزش صفر — ارزش مکانی)', () => {
  assert.equal(classifyAttempt({ f1: 3, f2: 20, submitted: 6 }), 'E_PLACE_SHIFT');
  assert.equal(classifyAttempt({ f1: 3, f2: 20, submitted: 600 }), 'E_PLACE_SHIFT');
  assert.equal(classifyAttempt({ f1: 4, f2: 10, submitted: 4 }), 'E_PLACE_SHIFT');
});

test('5. classifyAttempt: E_ANCHOR_DRIFT (جا ماندن جزء دوم شکستن با لنگر ۵)', () => {
  assert.equal(classifyAttempt({ f1: 7, f2: 6, submitted: 35 }), 'E_ANCHOR_DRIFT');
  assert.equal(classifyAttempt({ f1: 8, f2: 7, submitted: 40 }), 'E_ANCHOR_DRIFT');
});

test('6. classifyAttempt: E_DISTRIBUTIVE_LEAK (جا ماندن یک جزء چندرقمی)', () => {
  assert.equal(classifyAttempt({ f1: 3, f2: 24, submitted: 12 }), 'E_DISTRIBUTIVE_LEAK'); // 3 * 4
  assert.equal(classifyAttempt({ f1: 2, f2: 213, submitted: 6 }), 'E_DISTRIBUTIVE_LEAK');  // 2 * 3
});

test('7. classifyAttempt: E_SKIP_OVERCOUNT & E_SKIP_UNDERCOUNT', () => {
  assert.equal(classifyAttempt({ f1: 4, f2: 6, submitted: 30 }), 'E_SKIP_OVERCOUNT');
  assert.equal(classifyAttempt({ f1: 4, f2: 6, submitted: 18 }), 'E_SKIP_UNDERCOUNT');
});

test('8. اولویت کدها: ZERO قبل از ADD قرار دارد', () => {
  // ۵×۰ = ۵ هم جمع ۵+۰ است و هم خطای صفر؛ اولویت با ZERO است
  assert.equal(classifyAttempt({ f1: 5, f2: 0, submitted: 5 }), 'E_ZERO_PROPERTY');
});

test('9. detectBehavioralCode: E_COMMUTATIVE_FAIL (شکست جابه‌جایی پس از پذیرش)', () => {
  const acceptedFacts = [{ f1: 8, f2: 3 }];
  // سوال جاری ۳×۸ است
  const code = detectBehavioralCode({ f1: 3, f2: 8, acceptedFacts });
  assert.equal(code, 'E_COMMUTATIVE_FAIL');
});

test('10. detectBehavioralCode: E_FATIGUE_SLIP (لغزش بعد از تسلط روی همان عبارت)', () => {
  const acceptedFacts = [{ f1: 4, f2: 4 }];
  const code = detectBehavioralCode({ f1: 4, f2: 4, acceptedFacts });
  assert.equal(code, 'E_FATIGUE_SLIP');
});

test('11. countIrrelevantAttempts و کاندید E_PERSISTENT_GUESSING', () => {
  const attempts = [
    { f1: 3, f2: 4, submitted: 99 }, // unclassified
    { f1: 3, f2: 4, submitted: 77 }, // unclassified
    { f1: 3, f2: 4, submitted: 7, code: 'E_ADD_CONFUSION' },
    { f1: 3, f2: 4, submitted: 55 }  // unclassified
  ];
  assert.equal(countIrrelevantAttempts(attempts), 3);
});

test('12. dominantCode و ایمنی ورودی (NaN, منفی، بدون خطا)', () => {
  assert.equal(dominantCode({ E_ADD_CONFUSION: 2, E_SKIP_OVERCOUNT: 5 }), 'E_ADD_CONFUSION');
  assert.equal(dominantCode({ E_SKIP_OVERCOUNT: 2 }), 'E_SKIP_OVERCOUNT');
  assert.equal(dominantCode({}), null);
  assert.equal(dominantCode(null), null);

  // ایمنی ورودی
  assert.equal(classifyAttempt(null), null);
  assert.equal(classifyAttempt({ f1: -2, f2: 4, submitted: 8 }), null);
  assert.equal(classifyAttempt({ f1: 3, f2: 4, submitted: 12 }), null); // پاسخ درست خطا نیست
});
