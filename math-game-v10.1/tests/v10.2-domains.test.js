// آزمون‌های دامنه‌های v10.2 — تولید سؤال، نردبان همهٔ دامنه‌ها، ضدنشت، سقف ۹۹۹
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CORE_SECTORS,
  DEPTH_LAYERS,
  SIDE_MISSIONS,
  generateSideMissionQuestions,
  RULES_VERSION,
  QUESTION_SET_VERSION
} from '../src/v9/experience.mjs';

import {
  classifyQuestionDomain,
  buildLadder,
  assertNoLeak
} from '../src/v10/station/ladder.js';

import { createQuestionGuide } from '../src/v10/station/guide.js';

// ─── دامنه‌شناسی سؤال ───

test('1. classifyQuestionDomain: هر دامنهٔ کتاب را می‌شناسد و بیرون کتاب را رد می‌کند', () => {
  assert.equal(classifyQuestionDomain({ f1: 3, f2: 4 }), 'table');
  assert.equal(classifyQuestionDomain({ f1: 10, f2: 10 }), 'table'); // جدول تا ۱۰×۱۰
  assert.equal(classifyQuestionDomain({ f1: 14, f2: 10 }), 'x10');
  assert.equal(classifyQuestionDomain({ f1: 10, f2: 42 }), 'x10');
  assert.equal(classifyQuestionDomain({ f1: 6, f2: 0 }), 'zero');
  assert.equal(classifyQuestionDomain({ f1: 0, f2: 7 }), 'zero');
  assert.equal(classifyQuestionDomain({ f1: 8, f2: 1 }), 'identity');
  assert.equal(classifyQuestionDomain({ f1: 1, f2: 9 }), 'identity');
  assert.equal(classifyQuestionDomain({ f1: 3, f2: 24 }), 'multi');
  assert.equal(classifyQuestionDomain({ f1: 2, f2: 213 }), 'multi');
  // بیرون کتاب: ×۱۱ و ×۱۲ در جدول نچسبند و به دامنهٔ چندرقمی هم نروند (کتاب تا ×۱۰)
  assert.equal(classifyQuestionDomain({ f1: 11, f2: 5 }), null);
  assert.equal(classifyQuestionDomain({ f1: 12, f2: 12 }), null);
  // سقف حاصل ۹۹۹ (نقد ۹) — ۹×۹۸۷ مجاز نیست
  assert.equal(classifyQuestionDomain({ f1: 9, f2: 987 }), null);
  assert.equal(classifyQuestionDomain({ f1: 9, f2: 111 }), 'multi'); // ۹۹۹ مرز
  // ۰×۰ و ورودی نامعتبر
  assert.equal(classifyQuestionDomain({ f1: 0, f2: 0 }), null);
  assert.equal(classifyQuestionDomain({ f1: 1.5, f2: 3 }), null);
  assert.equal(classifyQuestionDomain(null), null);
});

// ─── نردبان همهٔ دامنه‌ها ───

test('2. نردبان جدول با سیاست لنگر کتاب: برای ۸ و ۹ جمعیِ لنگر-۵، بدون لنگر-۱۰ تفریقی (نقد ۱)', () => {
  const ladder = buildLadder({ f1: 7, f2: 8 });
  assert.ok(Array.isArray(ladder) && ladder.length === 7);
  // ۷×۸ = ۷×۵ + ۷×۳ — جمعی، نه «۷×۱۰ منهای ۷×۲»
  assert.ok(ladder[5].textFa.includes('۷×۵ + ۷×۳'), `پلهٔ ۶: ${ladder[5].textFa}`);
  assert.ok(!ladder[5].textFa.includes('−'), 'تفریق لنگر-۱۰ حذف شده باشد');
  const ladder9 = buildLadder({ f1: 4, f2: 9 });
  assert.ok(ladder9[5].textFa.includes('۴×۵ + ۴×۴'));
  // ۳ → لنگر ۲، ۵ → بدون شکستن
  assert.ok(buildLadder({ f1: 5, f2: 3 })[5].textFa.includes('۵×۲ + ۵×۱'));
  assert.ok(buildLadder({ f1: 6, f2: 5 })[5].textFa.includes('جدول پنج'));
  assert.ok(buildLadder({ f1: 3, f2: 2 })[5].textFa.includes('دو دسته'));
});

test('3. نردبان ضرب در صفر و یک: قاعده با کلمه، رقم حاصل در پله‌های ۱–۶ ممنوع', () => {
  const zero = buildLadder({ f1: 6, f2: 0 });
  assert.ok(Array.isArray(zero) && zero.length === 7);
  // حاصل ۰ به‌صورت رقم در پله‌های ۱–۶ نیامده باشد (توکن ۰ ممنوع)
  for (const step of zero.slice(0, 6)) {
    const tokens = step.textFa.split(/[^0-9۰-۹]+/).filter(Boolean);
    assert.ok(!tokens.includes('۰') && !tokens.includes('0'), `پلهٔ ${step.level} صفر ندارد: ${step.textFa}`);
  }
  assert.ok(zero[5].textFa.includes('هیچ'));
  // نمونهٔ موازی پلهٔ ۷
  assert.equal(zero[6].sibling.answerFa, '۰');

  const identity = buildLadder({ f1: 8, f2: 1 });
  assert.ok(Array.isArray(identity) && identity.length === 7);
  // حاصل ۸ (برابر عامل دیگر) نباید در پله‌های ۱–۶ به‌صورت توکن بیاید
  for (const step of identity.slice(0, 6)) {
    const tokens = step.textFa.split(/[^0-9۰-۹]+/).filter(Boolean);
    assert.ok(!tokens.includes('۸') && !tokens.includes('8'), `پلهٔ ${step.level} نشت دارد: ${step.textFa}`);
  }
  assert.equal(identity[6].sibling.answerFa, '۹');
});

test('4. نردبان ×۱۰ و چندرقمی: ارزش مکانی بخش‌بخش، بدون حاصل بخش‌ها', () => {
  const x10 = buildLadder({ f1: 14, f2: 10 });
  assert.ok(Array.isArray(x10) && x10.length === 7);
  assert.ok(x10[0].textFa.includes('۱۴'));
  // حاصل ۱۴۰ در هیچ پله‌ای از ۱–۶ نیست
  for (const step of x10.slice(0, 6)) {
    const tokens = step.textFa.split(/[^0-9۰-۹]+/).filter(Boolean);
    assert.ok(!tokens.includes('۱۴۰'), `پلهٔ ${step.level} نشت ۱۴۰`);
  }
  assert.equal(x10[6].sibling.answerFa, '۱۵۰');

  const multi = buildLadder({ f1: 3, f2: 213 });
  assert.ok(Array.isArray(multi) && multi.length === 7);
  // تجزیهٔ ارزش مکانی ۲۱۳ آمده باشد
  assert.ok(multi[1].textFa.includes('۲ صدتایی'), multi[1].textFa);
  assert.ok(multi[1].textFa.includes('۳ یکی'));
  // حاصل ۴۲۶ در پله‌های ۱–۶ نیست
  for (const step of multi.slice(0, 6)) {
    const tokens = step.textFa.split(/[^0-9۰-۹]+/).filter(Boolean);
    assert.ok(!tokens.includes('۴۲۶'), `پلهٔ ${step.level} نشت ۴۲۶`);
  }
  // نمونهٔ موازی کوچک‌تر با حاصل
  assert.equal(multi[6].sibling.f1 * multi[6].sibling.f2, 46);
});

test('5. ضدنشت روی همهٔ دامنه‌ها: buildLadder هرگز حاصل را در پله‌های ۱–۶ نمی‌نویسد', () => {
  const cases = [
    { f1: 4, f2: 7 }, { f1: 9, f2: 9 }, { f1: 2, f2: 3 }, { f1: 10, f2: 10 },
    { f1: 7, f2: 0 }, { f1: 0, f2: 3 }, { f1: 5, f2: 1 }, { f1: 1, f2: 10 },
    { f1: 42, f2: 10 }, { f1: 25, f2: 10 },
    { f1: 4, f2: 13 }, { f1: 2, f2: 45 }, { f1: 5, f2: 32 }
  ];
  for (const q of cases) {
    const ladder = buildLadder(q);
    assert.ok(Array.isArray(ladder), `نردبان ${q.f1}×${q.f2} باید ساخته شود`);
    assert.equal(assertNoLeak(ladder, q, { minFactor: q.f1 === 0 || q.f2 === 0 ? 0 : (q.f1 === 1 || q.f2 === 1 ? 1 : 2) }), true, `ضدنشت ${q.f1}×${q.f2}`);
    const p = q.f1 * q.f2;
    const faP = String(p).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    for (const step of ladder.slice(0, 6)) {
      const tokens = step.textFa.split(/[^0-9۰-۹]+/).filter(Boolean);
      assert.ok(!tokens.includes(faP) && !tokens.includes(String(p)), `نشت ${p} در ${q.f1}×${q.f2} پلهٔ ${step.level}`);
    }
  }
  // سؤال بیرون دامنه: null
  assert.equal(buildLadder({ f1: 11, f2: 7 }), null);
  assert.equal(buildLadder({ f1: 9, f2: 987 }), null);
  assert.equal(buildLadder(null), null);
});

// ─── تولید سؤال دامنه‌محور (ثابت‌های همان تولیدکنندهٔ app — از طریق DEPTH_LAYERS بازبینی می‌شود) ───

test('6. لایه‌های سکو دامنهٔ کتاب را حمل می‌کنند و تعداد سؤال‌ها ثابت است', () => {
  assert.equal(DEPTH_LAYERS['3-1'].questionCount, 8);
  assert.equal(DEPTH_LAYERS['3-2'].questionCount, 10);
  assert.equal(DEPTH_LAYERS['3-3'].questionCount, 6);
  assert.equal(DEPTH_LAYERS['3-1'].domain, 'x10');
  assert.equal(DEPTH_LAYERS['3-2'].domain, 'zero-one');
  assert.equal(DEPTH_LAYERS['3-3'].domain, 'multi-digit');
});

test('7. مأموریت جانبی سکو در دامنهٔ کتاب و زیر سقف ۹۹۹ می‌ماند', () => {
  for (let seed = 0; seed < 10; seed++) {
    const qs = generateSideMissionQuestions('side-3-fuel', seed);
    assert.equal(qs.length, 5);
    for (const q of qs) {
      assert.ok(CORE_SECTORS[3].focus.domains.length > 0);
      assert.ok([10, 20, 30].includes(q.f1), `f1=${q.f1} در دامنهٔ ×۱۰/دورقمی`);
      assert.ok(q.f1 * q.f2 <= 999, `حاصل ${q.f1}×${q.f2} ≤ ۹۹۹`);
      assert.ok(![11, 12].includes(q.f1) && ![11, 12].includes(q.f2), '×۱۱ و ×۱۲ بیرون کتاب');
    }
  }
});

test('8. راهنمای یک‌پله‌ای قدیمی برای دامنه‌های تازه امن می‌ماند (بدون تصویر ناممکن)', () => {
  // صفر و چندرقمی: تصویر دسته‌ها معنا ندارد → null
  assert.equal(createQuestionGuide({ f1: 6, f2: 0 }), null);
  assert.equal(createQuestionGuide({ f1: 3, f2: 24 }), null);
  assert.equal(createQuestionGuide({ f1: 2, f2: 213 }), null);
  // جدول: همان رفتار قبل
  const guide = createQuestionGuide({ f1: 4, f2: 3 });
  assert.equal(guide.groupsCount, 4);
  // ۱۴×۱۰: ۱۴۰ خانه کشیدنی نیست → null
  assert.equal(createQuestionGuide({ f1: 14, f2: 10 }), null);
});

test('9. نسخهٔ مجموعه‌سؤال graph-v10.2 است (مهاجرت در آزمون‌های ۱۰.۱ پوشش داده شده)', () => {
  assert.equal(QUESTION_SET_VERSION, 'graph-v10.2');
  assert.equal(RULES_VERSION, 'rv1');
});
