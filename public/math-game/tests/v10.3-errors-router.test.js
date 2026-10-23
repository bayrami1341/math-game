// ─────────────────────────────────────────────────────────────────────────────
// تست قرارداد M09 + مسیریاب M10 (BP-022 — فرمان مالک trace 1a1681e84a8d3cad)
// قفل‌های اصلی:
//   ۱) جدول op→موتور در JSON و JS هم‌خوان (ضد واگرایی)
//   ۲) حدهای per-book/per-grade در JSON و JS هم‌خوان؛ بیرون بازه = بی‌الگو با دلیل
//   ۳) کدهای W8 همیشه «پیشنهادی» و تقاطع با اطلس رسمی همیشه تهی
//   ۴) مسیر میراثی ضرب (بدون op) عین رفتار امروز
//   ۵) آزمون از کارتریج واقعی تا تعامل: verdict → مسیریاب → رکورد تلاش‌نگار
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  OP_ENGINES,
  DEFAULT_BOOK_LIMITS,
  resolveEngineForOp,
  withinBookLimits,
  classifyCartridgeAttempt,
  atlasClaimForWrongOption,
  codeRegistryStatus,
  letterForIndex
} from '../src/v10/station/errors-router.js';
import { classifyAttempt } from '../src/v10/station/errors.js';
import { classifyV103 } from '../src/v10/station/errors-v103.js';
import { CODES_W8 } from '../src/v10/station/errors-w8.js';
import { checkCartridgeAnswer } from '../src/v10/station/answer-formats.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CONTRACT = JSON.parse(readFileSync(path.join(ROOT, 'authoring/OPERATION-CONTRACT.json'), 'utf8'));

// ── ۱) جدول مسیریابی ─────────────────────────────────────────────────────────
test('M09: جدول op→موتور — v103/w8/attempt و پیشوند کسری و ناشناخته', () => {
  assert.equal(resolveEngineForOp('sum'), 'v103');
  assert.equal(resolveEngineForOp('mulcol'), 'v103');
  assert.equal(resolveEngineForOp('divide_qr'), 'w8');
  assert.equal(resolveEngineForOp('frac_add'), 'w8');
  assert.equal(resolveEngineForOp('clock_elapsed'), 'w8');
  assert.equal(resolveEngineForOp('mult_fact'), 'attempt');
  assert.equal(resolveEngineForOp('frac_future_op'), 'w8'); // پیشوند کسری → خانوادهٔ w8
  assert.equal(resolveEngineForOp('bogus_op'), null);
  assert.equal(resolveEngineForOp(42), null);
});

test('M10: زنجیرهٔ v103 از مسیر زنده — جمع ستونی با جاافتادن گره', () => {
  const r = classifyCartridgeAttempt({ question: { op: 'sum', a: 47, b: 38 }, submitted: '75' });
  assert.equal(r.engine, 'v103');
  assert.equal(r.code, 'E_CARRY_MISS');
  assert.equal(r.reason, 'classified');
  assert.equal(r.code, classifyV103({ op: 'sum', a: 47, b: 38 }, 75));
});

test('M10: زنجیرهٔ w8 از مسیر زنده — کسر exact (BigInt) و تقسیم با باقیمانده', () => {
  // جزء از کل: ۳ خانهٔ سایه از ۴ → پاسخ «۱/۴» = مکمل (خطای کلاسیک E_FRAC_COMPLEMENT)
  const r1 = classifyCartridgeAttempt({
    question: { op: 'frac_part_whole', opSpec: { shaded: 3, total: 4 } },
    submitted: '1/4'
  });
  assert.equal(r1.engine, 'w8');
  assert.equal(r1.code, 'E_FRAC_COMPLEMENT');

  // وارون صورت/مخرج: پاسخ «۴/۳» → E_FRAC_NUM_DENOM_SWAP
  const r1b = classifyCartridgeAttempt({
    question: { op: 'frac_part_whole', opSpec: { shaded: 3, total: 4 } },
    submitted: '4/3'
  });
  assert.equal(r1b.code, 'E_FRAC_NUM_DENOM_SWAP');

  // پاسخ درست کسر (۳/۴) → null (خطا نیست — حساب exact)
  const r1c = classifyCartridgeAttempt({
    question: { op: 'frac_part_whole', opSpec: { shaded: 3, total: 4 } },
    submitted: '3/4'
  });
  assert.equal(r1c.code, null);

  // تقسیم با هدف خارج‌قسمت: ۱۷÷۵ → جواب باقیمانده به‌جای خارج‌قسمت
  const r2 = classifyCartridgeAttempt({
    question: { op: 'divide_qr', opSpec: { dividend: 17, divisor: 5, target: 'quotient' } },
    submitted: '2'
  });
  assert.equal(r2.engine, 'w8');
  assert.equal(r2.code, 'E_REMAINDER_QUOTIENT_SWAP');

  // پاسخ درست → null (خطا نیست)
  const r3 = classifyCartridgeAttempt({
    question: { op: 'divide_qr', opSpec: { dividend: 17, divisor: 5, target: 'quotient' } },
    submitted: '3'
  });
  assert.equal(r3.code, null);
  assert.equal(r3.reason, 'no-pattern');
});

// ── ۲) حدهای per-book/per-grade ──────────────────────────────────────────────
test('M09: گسترهٔ per-book — mulcol در G2 مسدود، در G3 باز؛ sum در G2 تا ۱۰۰', () => {
  const g2 = DEFAULT_BOOK_LIMITS['KH-G2-MATH'];
  const g3 = DEFAULT_BOOK_LIMITS['KH-G3-MATH'];
  assert.equal(withinBookLimits('mulcol', { op: 'mulcol', a: 1234, b: 56 }, g2), false);
  assert.equal(withinBookLimits('mulcol', { op: 'mulcol', a: 1234, b: 56 }, g3), true);
  assert.equal(withinBookLimits('sum', { op: 'sum', a: 5000, b: 20 }, g2), false);
  assert.equal(withinBookLimits('sum', { op: 'sum', a: 90, b: 7 }, g2), true);

  const r = classifyCartridgeAttempt({
    question: { op: 'mulcol', a: 1234, b: 56 },
    submitted: '0',
    bookLimits: g2
  });
  assert.equal(r.code, null);
  assert.equal(r.reason, 'out-of-book-range');
  assert.equal(r.engine, 'v103'); // مسیر مشخص شد ولی گارد کتابی بست
});

test('M09: گارد کسر per-book — مخرج بیش از سقف کتاب G2 رد می‌شود', () => {
  const g2 = DEFAULT_BOOK_LIMITS['KH-G2-MATH'];
  assert.equal(
    withinBookLimits('frac_add', { op: 'frac_add', f1: { num: 1, den: 16 }, f2: { num: 1, den: 2 } }, g2),
    false
  );
  assert.equal(
    withinBookLimits('frac_add', { op: 'frac_add', f1: { num: 1, den: 4 }, f2: { num: 1, den: 2 } }, g2),
    false // frac_add در opAllow کتاب G2 نیست
  );
  assert.equal(
    withinBookLimits('frac_compare', { op: 'frac_compare', f1: { num: 1, den: 2 }, f2: { num: 3, den: 4 } }, g2),
    true
  );
});

// ── ۳) حاکمیت کدهای W8 — پیشنهادی تا مُهر انسانی ─────────────────────────────
test('M09: کدهای مخصوص W8 «پیشنهادی» می‌مانند و به اطلس رسمی راه ندارند', () => {
  const w8Codes = Object.keys(CODES_W8);
  assert.ok(w8Codes.length >= 30, `تعداد کدهای W8 منطقی باشد (فعلاً ${w8Codes.length})`);

  // SSOT رسمی: اطلس دو کارتریج رسمی + کدهای ماژول‌های مرجع
  const atlasCodes = new Set();
  for (const fam of ['KH-G2-MATH', 'KH-G3-MATH']) {
    const cart = JSON.parse(readFileSync(path.join(ROOT, 'cartridges', `${fam}.json`), 'utf8'));
    for (const c of cart.errorAtlas || []) atlasCodes.add(c.code);
  }

  // فهرست صریحِ بازاستفادهٔ رسمی توسط W8 (کدهای رسمی که W8 به‌عنوان کاندید به‌کار می‌برد)
  const W8_REUSE_OFFICIAL = new Set(['E_PLACE_SWAP', 'E_SUB_CONFUSION', 'E_DOUBLE_OFF']);
  for (const c of W8_REUSE_OFFICIAL) assert.ok(atlasCodes.has(c), `${c} واقعاً رسمی باشد`);

  // کدهای «فقط W8» = کاندیدهای تازه تا مُهر انسانی
  const w8Only = w8Codes.filter(c => !atlasCodes.has(c));
  assert.ok(w8Only.length >= 20, `کدهای تازهٔ W8 باید پرتعداد باشند (${w8Only.length})`);
  for (const c of w8Only) {
    assert.equal(codeRegistryStatus(c, [...atlasCodes]), 'پیشنهادی', `${c} باید پیشنهادی بماند`);
  }

  // قفل BP-012: هر کد W8 داخل اطلس رسمی باید عضو فهرستِ صریحِ بازاستفاده باشد؛
  // اگر فردا کد تازهٔ W8 به اطلس رسمی سرایت کند، این assert قرمز می‌شود.
  const illegalInAtlas = [...atlasCodes].filter(c => w8Codes.includes(c) && !W8_REUSE_OFFICIAL.has(c));
  assert.deepEqual(illegalInAtlas, [], `کد تازهٔ W8 در اطلس رسمی مجاز نیست: ${illegalInAtlas.join(',')}`);
});

test('M09: وضعیت رجیستری — رسمی برای اطلس ضرب/v103، پیشنهادی برای W8، null برای ناشناخته', () => {
  assert.equal(codeRegistryStatus('E_ADD_CONFUSION'), 'رسمی');
  assert.equal(codeRegistryStatus('E_CARRY_MISS'), 'رسمی');
  assert.equal(codeRegistryStatus('E_FRAC_NUM_DENOM_SWAP'), 'پیشنهادی');
  assert.equal(codeRegistryStatus('E_NOT_A_REAL_CODE'), null);
  assert.equal(codeRegistryStatus(42), null);
});

// ── ۴) سازگاری پسین — مسیر میراثی دست‌نخورده ────────────────────────────────
test('M10: سؤال بدون op با f1&f2 — عین classifyAttempt امروز', () => {
  const q = { f1: 3, f2: 4, prompt: '۳×۴ چند است؟' };
  const direct = classifyAttempt({ f1: 3, f2: 4, submitted: 7 });
  const viaRouter = classifyCartridgeAttempt({ question: q, submitted: '7' });
  assert.equal(viaRouter.engine, 'attempt');
  assert.equal(viaRouter.reason, 'legacy-mult');
  assert.equal(viaRouter.code, direct);

  // پاسخ غیرعددی (گزینه‌ای ضربی) → بی‌الگو، بدون استثنا (عین رفتار امروز: بدون طبقه‌بندی)
  const mcq = classifyCartridgeAttempt({ question: q, submitted: 'گزینهٔ ۲' });
  assert.equal(mcq.code, null);

  // سؤال بدون هیچ فرادادهٔ عملیاتی → صادقانه بی‌الگو
  const bare = classifyCartridgeAttempt({ question: { prompt: 'متن سؤال' }, submitted: '5' });
  assert.deepEqual(bare, { code: null, engine: null, reason: 'no-op-metadata' });

  // op ناشناخته → رد صادقانه با دلیل
  const unknown = classifyCartridgeAttempt({ question: { op: 'bogus_op' }, submitted: '5' });
  assert.deepEqual(unknown, { code: null, engine: null, reason: 'op-unknown' });
});

// ── ۵) قرارداد نسخه‌دار — ضد واگرایی JSON ↔ JS ──────────────────────────────
test('M09: OPERATION-CONTRACT.json با مسیریاب JS هم‌خوان است (ضد واگرایی)', () => {
  assert.equal(CONTRACT.schema, 'khshab.operation-contract/v1');
  assert.ok(CONTRACT.version);

  const jsonOps = Object.keys(CONTRACT.operations);
  const jsOps = Object.keys(OP_ENGINES);
  assert.deepEqual([...jsonOps].sort(), [...jsOps].sort(), 'مجموعهٔ عملیات JSON و JS یکی باشد');
  for (const op of jsOps) {
    assert.equal(CONTRACT.operations[op].engine, OP_ENGINES[op], `موتور ${op} در JSON و JS یکی باشد`);
  }

  const jsonBooks = Object.keys(CONTRACT.books);
  const jsBooks = Object.keys(DEFAULT_BOOK_LIMITS);
  assert.deepEqual([...jsonBooks].sort(), [...jsBooks].sort(), 'کتاب‌های JSON و JS یکی باشند');
  for (const b of jsBooks) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(CONTRACT.books[b].numberRange)),
      JSON.parse(JSON.stringify(DEFAULT_BOOK_LIMITS[b].numberRange)),
      `بازه‌های عددی ${b} هم‌خوان باشد`
    );
    assert.equal(CONTRACT.books[b].fraction.denMax, DEFAULT_BOOK_LIMITS[b].fraction.denMax, `سقف مخرج ${b}`);
    assert.equal(CONTRACT.books[b].fraction.numMax, DEFAULT_BOOK_LIMITS[b].fraction.numMax, `سقف صورت ${b}`);
  }
});

// ── ۶) آزمون از کارتریج واقعی تا تعامل (خشاب DEMO شش‌قالبی) ─────────────────
test('M10: از کارتریج تا تعامل — verdict غلط گزینه‌ای → اطلس-لنگر رسمی در رکورد', () => {
  const demo = JSON.parse(readFileSync(path.join(ROOT, 'cartridges', 'KH-DEMO-MATH.json'), 'utf8'));
  const q = (demo.questionBank || []).find(x => (x.answerFormat || x.format) === 'گزینه‌ای');
  assert.ok(q, 'سؤال گزینه‌ای DEMO موجود باشد');

  // انتخاب گزینهٔ غلط (نخستین گزینهٔ نادرست)
  const wrongIdx = [0, 1, 2, 3].find(i => i !== q.answerIndex);
  const verdict = checkCartridgeAnswer(q, wrongIdx);
  assert.equal(verdict.correct, false);

  const routerVerdict = classifyCartridgeAttempt({ question: q, submitted: verdict.normalized });
  const mcqIdx = /گزینهٔ\s*(\d+)/.exec(String(verdict.normalized ?? ''));
  const atlasClaim = !routerVerdict.code && mcqIdx ? atlasClaimForWrongOption(q, Number(mcqIdx[1]) - 1) : null;

  // رکورد تلاش‌نگار — شکل جدیدِ فقط‌الحاقی
  const record = {
    questionId: q.id,
    code: routerVerdict.code || null,
    engine: routerVerdict.engine,
    routerReason: routerVerdict.reason,
    atlasCode: (!routerVerdict.code && atlasClaim) ? atlasClaim.code : null,
    codeStatus: routerVerdict.code ? codeRegistryStatus(routerVerdict.code) : (atlasClaim?.status || null)
  };
  assert.ok(record.code || record.atlasCode, 'یا کد ساختاری یا اطلس-لنگر باید ثبت شود');
  assert.ok(['رسمی', 'پیشنهادی'].includes(record.codeStatus), 'وضعیت کد باید صریح باشد');
});

test('M10: اطلس-لنگر — claims آرایه‌ای با نشانگر پیشنهادی و fallback optionErrorMap', () => {
  const q1 = { claims: [{ letter: 'ب', claim: 'E_TABLE_NEIGHBOUR' }] };
  assert.deepEqual(atlasClaimForWrongOption(q1, 1), { code: 'E_TABLE_NEIGHBOUR', status: 'رسمی' });

  const q2 = { claims: [{ letter: 'ج', claim: 'E_UNEQUAL_GROUP (پیشنهادی)' }] };
  assert.deepEqual(atlasClaimForWrongOption(q2, 2), { code: 'E_UNEQUAL_GROUP', status: 'پیشنهادی' });

  const q3 = { claims: [{ letter: 'الف', claim: 'E_FRAC_COMPLEMENT' }] }; // کد W8 در claims → پیشنهادی
  assert.deepEqual(atlasClaimForWrongOption(q3, 0), { code: 'E_FRAC_COMPLEMENT', status: 'پیشنهادی' });

  const q4 = { optionErrorMap: 'ب: جمع به‌جای ضرب (E_ADD_CONFUSION)؛ ج: چسباندن ارقام' };
  assert.deepEqual(atlasClaimForWrongOption(q4, 1), { code: 'E_ADD_CONFUSION', status: 'رسمی' });

  assert.equal(atlasClaimForWrongOption(q1, 9), null);
  assert.equal(atlasClaimForWrongOption(null, 1), null);
  assert.equal(letterForIndex(3), 'د');
});
