import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateScaffoldingLadder,
  assertNoLeak
} from '../src/v10/station/ladder.js';
import { renderEqualGroupsSVG } from '../src/v10/station/visuals.js';
import { DEPTH_LAYERS, CORE_SECTORS } from '../src/v9/experience.mjs';

test('1. نردبان دامنهٔ جدول (ضرب پایه): ۷ پله، شکستن با لنگر ۵، بدون نشت پاسخ', () => {
  const ladder = generateScaffoldingLadder({ f1: 7, f2: 6 });
  assert.equal(ladder.length, 7);
  assert.equal(ladder[0].visual, 'equal-groups');
  assert.ok(ladder[2].text.includes('۵')); // پلهٔ ۳ لنگر ۵
  assertNoLeak({ f1: 7, f2: 6 }, ladder);
});

test('2. نردبان دامنهٔ یک (عنصر بی‌اثر): ۷ پله، بدون نشت', () => {
  const ladder = generateScaffoldingLadder({ f1: 8, f2: 1 });
  assert.equal(ladder.length, 7);
  assert.ok(ladder[0].text.includes('دسته‌بندی') || ladder[0].text.includes('دسته‌ها'));
  assert.ok(ladder[2].text.includes('تغییری نمی‌کند') || ladder[2].text.includes('بی‌اثر'));
  assertNoLeak({ f1: 8, f2: 1 }, ladder);
});

test('3. نردبان دامنهٔ صفر (عنصر خنثی‌کننده/جاذب): ۷ پله، بدون نشت', () => {
  const ladder = generateScaffoldingLadder({ f1: 6, f2: 0 });
  assert.equal(ladder.length, 7);
  assert.ok(ladder[1].text.includes('هیچ عضوی'));
  assertNoLeak({ f1: 6, f2: 0 }, ladder);
});

test('4. نردبان دامنهٔ ضرب در ۱۰ (صفحهٔ ۱۳۶–۱۳۸ کتاب): ۷ پله، بدون نشت', () => {
  const ladder = generateScaffoldingLadder({ f1: 7, f2: 10 });
  assert.equal(ladder.length, 7);
  assert.ok(ladder[2].text.includes('ده‌تایی') || ladder[2].text.includes('۱۰'));
  assert.ok(ladder[3].text.includes('سمت راست') || ladder[3].text.includes('یکان'));
  assertNoLeak({ f1: 7, f2: 10 }, ladder);
});

test('5. نردبان دامنهٔ چندرقمی (صفحهٔ ۱۴۰–۱۴۳ کتاب): ۷ پله، گسترده‌نویسی، بدون نشت', () => {
  const ladder = generateScaffoldingLadder({ f1: 3, f2: 24 });
  assert.equal(ladder.length, 7);
  assert.ok(ladder[1].text.includes('گسترده'));
  assert.ok(ladder[2].text.includes('۲۰') && ladder[2].text.includes('۴'));
  assertNoLeak({ f1: 3, f2: 24 }, ladder);
});

test('6. گارد بصری: عاملهای بزرگتر از ۱۲ یا سقف ۶۰ تصویر نمی‌دهند', () => {
  assert.equal(renderEqualGroupsSVG(13, 2), null);
  assert.equal(renderEqualGroupsSVG(3, 24), null);
  assert.equal(renderEqualGroupsSVG(8, 8), null); // 64 > 60
  assert.notEqual(renderEqualGroupsSVG(3, 4), null);
});

test('7. assertNoLeak نشت پاسخ نهایی یا پاسخ جزئی را شناسایی می‌کند و خطا می‌دهد', () => {
  const leakingLadder = [
    { step: 1, text: 'پله یک' },
    { step: 2, text: 'حاصل ۲۴ می‌شود' } // نشت ۲۴
  ];
  assert.throws(() => {
    assertNoLeak({ f1: 4, f2: 6 }, leakingLadder);
  }, /نشت پاسخ/);
});

test('8. نردبان در همهٔ دامنه‌ها متن فارسی غیرخالی و معنادار تولید می‌کند', () => {
  const testCases = [
    { f1: 2, f2: 4 },
    { f1: 5, f2: 0 },
    { f1: 1, f2: 7 },
    { f1: 9, f2: 10 },
    { f1: 2, f2: 45 }
  ];
  for (const tc of testCases) {
    const ladder = generateScaffoldingLadder(tc);
    assert.equal(ladder.length, 7);
    ladder.forEach((st, idx) => {
      assert.equal(st.step, idx + 1);
      assert.ok(st.text && st.text.length > 5);
    });
  }
});

test('9. دامنه‌های ۹ لایهٔ عمق با اهداف کتاب درسی کد ۳۰۵ منطبق است', () => {
  assert.equal(DEPTH_LAYERS['1-1'].domain, 'table');
  assert.equal(DEPTH_LAYERS['2-3'].domain, 'paired');
  assert.equal(DEPTH_LAYERS['3-1'].domain, 'x10');
  assert.equal(DEPTH_LAYERS['3-2'].domain, 'zero-one');
  assert.equal(DEPTH_LAYERS['3-3'].domain, 'multi-digit');
  assert.equal(CORE_SECTORS[3].focus.maxProduct, 999);
});
