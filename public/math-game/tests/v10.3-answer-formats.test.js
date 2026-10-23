// آزمون‌های فاز الف موتور چند-قالبی (BP-016 T1)
// پوشش: پارسر کسر/مخلوط، تشخیص قالب، سنجش پاسخ سه‌قالب، پل کارتریج→نشست،
// و رفتار schema موتور برای قالب‌های مستقیم (عدد/کسر) — با گارد رگرسیون گزینه‌ای.
//
// اصل: خشاب میراثی (۹۲ سؤال G2 و ۲۰ سؤال G3) باید دقیقاً مثل قبل سبز بماند —
// هیچ رفتار قدیمی تغییر نکرده؛ همهٔ افزودنی‌ها opt-in با answerFormat هستند.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  parseUserFraction,
  parseUserNumber,
  effectiveFormat,
  isPlayable,
  checkCartridgeAnswer,
  adaptCartridgeQuestions,
  FORMAT_MCQ,
  FORMAT_NUMBER,
  FORMAT_FRACTION,
  FORMAT_NUMBER_LINE
} from '../src/v10/station/answer-formats.js';
import { validateCartridge } from '../src/v10/station/cartridge-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = rel => JSON.parse(readFileSync(path.join(__dirname, rel), 'utf-8'));

// ── ۱) پارسر کسر/مخلوط ───────────────────────────────────────────────────────

test('پارسر کسر: فارسی، ساده‌سازی، مخلوط و ردِ نامعتبر', () => {
  assert.deepEqual(parseUserFraction('۳/۴'), { num: 3, den: 4 });
  assert.deepEqual(parseUserFraction('۶/۸'), { num: 3, den: 4 }, '۶/۸ باید به ۳/۴ ساده شود');
  assert.deepEqual(parseUserFraction('2/4'), { num: 1, den: 2 });
  assert.deepEqual(parseUserFraction('۵'), { num: 5, den: 1 });
  assert.deepEqual(parseUserFraction('۱ ۱/۲'), { num: 3, den: 2 }, 'مخلوط ۱ ۱/۲ = ۳/۲');
  assert.deepEqual(parseUserFraction('۲ ۲/۴'), { num: 5, den: 2 });
  assert.equal(parseUserFraction('/۴'), null);
  assert.equal(parseUserFraction('۳/۰'), null, 'مخرج صفر ممنوع');
  assert.equal(parseUserFraction('abc'), null);
  assert.equal(parseUserFraction(''), null);
  assert.equal(parseUserFraction(null), null);
});

test('پارسر عدد: ارقام فارسی/عربی و ردِ اعشاری', () => {
  assert.equal(parseUserNumber('۱۲'), 12);
  assert.equal(parseUserNumber('٠٥'), 5);
  assert.equal(parseUserNumber('0'), 0);
  assert.equal(parseUserNumber('۱.۵'), null);
  assert.equal(parseUserNumber('abc'), null);
});

// ── ۲) تشخیص قالب و قابل‌بازی بودن ───────────────────────────────────────────

test('تشخیص قالب مؤثر — سازگاری پسین: بدون answerFormat با گزینه‌ها = گزینه‌ای', () => {
  assert.equal(effectiveFormat({ options: ['۱', '۲', '۳', '۴'], answerIndex: 0 }), FORMAT_MCQ);
  assert.equal(effectiveFormat({ answerFormat: 'عدد', answerValue: 7 }), FORMAT_NUMBER);
  assert.equal(effectiveFormat({ answerFormat: 'کسر', answerFrac: { num: 1, den: 2 } }), FORMAT_FRACTION);
  assert.equal(effectiveFormat({}), null);
  assert.equal(effectiveFormat({ answerFormat: 'قالبِ ناموجود' }), null);
});

test('isPlayable: فقط قالب‌های فاز الف قابل بازی‌اند', () => {
  assert.equal(isPlayable({ options: ['۱', '۲', '۳', '۴'], answerIndex: 2 }), true);
  assert.equal(isPlayable({ options: ['۱', '۲', '۳'] }), false, 'سه‌گزینه‌ای بازی نمی‌شود');
  assert.equal(isPlayable({ options: ['۱', '۲', '۳', '۴'] }), false, 'بدون پاسخ‌نام بازی نمی‌شود');
  assert.equal(isPlayable({ answerFormat: 'عدد', answerValue: 42 }), true);
  assert.equal(isPlayable({ answerFormat: 'عدد' }), false);
  assert.equal(isPlayable({ answerFormat: 'کسر', answerFrac: { num: 1, den: 2 } }), true);
  assert.equal(isPlayable({ answerFormat: 'کسر', answerFrac: { num: 1, den: 0 } }), false);
  assert.equal(isPlayable({ answerFormat: 'محور عددی' }), false, 'قالب فاز ب هنوز playable نیست');
});

// ── ۳) سنجش پاسخ سه‌قالب ─────────────────────────────────────────────────────

test('سنجش گزینه‌ای: شمارهٔ درست/غلط/بدشکل', () => {
  const q = { options: ['۶', '۷', '۸', '۹'], answerIndex: 2 };
  assert.equal(checkCartridgeAnswer(q, 2).correct, true);
  assert.equal(checkCartridgeAnswer(q, '2').correct, true);
  assert.equal(checkCartridgeAnswer(q, 0).correct, false);
  assert.equal(checkCartridgeAnswer(q, '۹').correct, false, '۹ شمارهٔ گزینه نیست');
  assert.equal(checkCartridgeAnswer(q, '').correct, false);
});

test('سنجش عددی: فارسی و لاتین، درست/غلط', () => {
  const q = { answerFormat: 'عدد', answerValue: 42 };
  assert.equal(checkCartridgeAnswer(q, '۴۲').correct, true);
  assert.equal(checkCartridgeAnswer(q, '42').correct, true);
  assert.equal(checkCartridgeAnswer(q, '۴۳').correct, false);
  assert.equal(checkCartridgeAnswer(q, '۴۲۰').correct, false);
  assert.equal(checkCartridgeAnswer(q, 'بیست‌ودو').correct, false);
});

test('سنجش کسر: هم‌ارزی ۳/۴=۶/۸، مخلوط و ردِ بدشکل', () => {
  const q = { answerFormat: 'کسر', answerFrac: { num: 3, den: 4 } };
  assert.equal(checkCartridgeAnswer(q, '۳/۴').correct, true);
  assert.equal(checkCartridgeAnswer(q, '۶/۸').correct, true, 'هم‌ارزی کسر باید پذیرفته شود');
  assert.equal(checkCartridgeAnswer(q, '۹/۱۲').correct, true);
  assert.equal(checkCartridgeAnswer(q, '۲/۴').correct, false);
  assert.equal(checkCartridgeAnswer(q, 'abc').correct, false);
  const mixed = { answerFormat: 'کسر', answerFrac: { num: 3, den: 2 } };
  assert.equal(checkCartridgeAnswer(mixed, '۱ ۱/۲').correct, true, 'مخلوط ۱ ۱/۲ = ۳/۲');
  assert.equal(checkCartridgeAnswer(mixed, '۱/۲').correct, false);
});

// ── ۴) پل کارتریج → نشست ────────────────────────────────────────────────────

function syntheticCartridge() {
  return {
    cartridgeId: 'KH-TEST-MATH',
    questionBank: [
      { id: 'Q-9001', prompt: '۳ × ۴ = ؟', options: ['۱۲', '۷', '۱۲۴', '۱'], answerIndex: 0,
        optionErrorMap: '', claims: '', status: 'تأییدشده', anchorId: 'L-T1', domain: 'CORE', cpa: 'علامتی' },
      { id: 'Q-9002', prompt: '۲ × ۵ = ؟', options: ['۲۵', '۱۰', '۷', '۵۲'], answerIndex: 1,
        status: 'تأییدشده', anchorId: 'L-T1', domain: 'CORE', cpa: 'علامتی' },
      { id: 'Q-9003', prompt: 'حاصل ۹ + ۶ چند است؟', answerFormat: 'عدد', answerValue: 15,
        status: 'تأییدشده', anchorId: 'L-T1', domain: 'CORE', cpa: 'علامتی' },
      { id: 'Q-9004', prompt: 'نصف شکل رنگ‌آمیزی‌شده چند از کل را می‌سازد؟', answerFormat: 'کسر', answerFrac: { num: 1, den: 2 },
        status: 'تأییدشده', anchorId: 'L-T1', domain: 'DEPTH', cpa: 'تصویری' },
      { id: 'Q-9005', prompt: 'نقطهٔ ۱۲ روی محور کجاست؟', answerFormat: 'محور عددی', renderHint: 'numberline-0-20',
        status: 'تأییدشده', anchorId: 'L-T1', domain: 'DEPTH', cpa: 'تصویری' }
    ],
    bookMap: [{ id: 'L-T1', title: 'درس آزمایشی', anchorsRaw: 'Q-9001 تا Q-9005', status: 'تأییدشده', source: 'تست' }]
  };
}

test('پل کارتریج: فقط قالب‌های فاز الف برمی‌گردند و ضرب برای اطلس استخراج می‌شود', () => {
  const cart = syntheticCartridge();
  const adapted = adaptCartridgeQuestions(cart, { limit: 0, shuffle: false });
  assert.equal(adapted.total, 5);
  assert.equal(adapted.skipped, 1, 'محور عددی (فاز ب) رد می‌شود');
  assert.equal(adapted.questions.length, 4);
  const mcq = adapted.questions.find(q => q.questionId === 'Q-9001');
  assert.equal(mcq.answerFormat, FORMAT_MCQ);
  assert.deepEqual(mcq.options, ['۱۲', '۷', '۱۲۴', '۱']);
  assert.deepEqual(mcq.f1, 3, 'عوامل ضرب برای کدهای خطا استخراج شده');
  assert.deepEqual(mcq.f2, 4);
  const num = adapted.questions.find(q => q.questionId === 'Q-9003');
  assert.equal(num.answerFormat, FORMAT_NUMBER);
  assert.equal(num.answerValue, 15);
  assert.equal(num.f1, null, 'سؤال جمعی عامل ضرب ندارد');
  const frac = adapted.questions.find(q => q.questionId === 'Q-9004');
  assert.equal(frac.answerFormat, FORMAT_FRACTION);
  assert.deepEqual(frac.answerFrac, { num: 1, den: 2 });
});

test('پل کارتریج: limit و shuffle کار می‌کند', () => {
  const cart = syntheticCartridge();
  const a = adaptCartridgeQuestions(cart, { limit: 2, shuffle: false });
  assert.equal(a.questions.length, 2);
  assert.equal(a.questions[0].questionId, 'Q-9001', 'بدون شافل ترتیب حفظ می‌شود');
  const b = adaptCartridgeQuestions(cart, { limit: 10, shuffle: true });
  assert.equal(b.questions.length, 4);
});

test('پل کارتریج روی خشاب واقعی G3: هر ۱۲۰ سؤال (۲۰ میراثی + ۱۰۰ بچ D4 ربات) قابل بازی‌اند', () => {
  const g3 = readJson('../cartridges/KH-G3-MATH.json');
  const adapted = adaptCartridgeQuestions(g3, { limit: 0, shuffle: false });
  // واقعیت پس از بچ اول D4-G3 (BP-019، seed 1404): ۱۲۰ سؤال — ۲۰ میراثی گزینه‌ای + ۱۰۰ دامنه‌دار (۶۱ گزینه‌ای + ۳۹ عدد)
  assert.equal(adapted.total, 120);
  assert.equal(adapted.skipped, 0);
  assert.equal(adapted.questions.length, 120);
  assert.equal(adapted.questions.filter(q => q.answerFormat === FORMAT_MCQ).length, 81);
  assert.equal(adapted.questions.filter(q => q.answerFormat === FORMAT_NUMBER).length, 39);
  // سؤال‌های «فرم خام a×b» عامل‌ها را برای اطلس خطا دارند؛ مسئله‌های متنی عمداً ندارند
  const withFactors = adapted.questions.filter(q => q.f1 !== null);
  assert.ok(withFactors.length >= 10, `انتظار حداقل ۱۰ سؤال با عامل صریح — یافت: ${withFactors.length}`);
});

// ── ۵) schema موتور: قالب‌های مستقیم + گارد رگرسیون ─────────────────────────

function baseCartridge(questions = []) {
  return {
    formatVersion: '1.0',
    cartridgeId: 'KH-TEST-MATH',
    bookMap: [{ id: 'L-T1', title: 'درس آزمایشی', anchorsRaw: questions.map(q => q.id).join(' '), status: 'نیاز به تأیید' }],
    errorAtlas: [],
    questionBank: questions,
    glossary: []
  };
}

test('schema: قالب عددی بدون گزینه سبز است', () => {
  const c = baseCartridge([{ id: 'Q-9001', prompt: '۹ + ۶ چند است؟', answerFormat: 'عدد', answerValue: 15, status: 'نیاز به تأیید', anchorId: 'L-T1' }]);
  const v = validateCartridge(c);
  assert.equal(v.ok, true, v.errors.join(' | '));
});

test('schema: قالب کسر با answerFrac معتبر سبز است', () => {
  const c = baseCartridge([{ id: 'Q-9001', prompt: 'نصف شکل؟', answerFormat: 'کسر', answerFrac: { num: 3, den: 4 }, status: 'نیاز به تأیید', anchorId: 'L-T1' }]);
  const v = validateCartridge(c);
  assert.equal(v.ok, true, v.errors.join(' | '));
});

test('schema: کسر بی‌مخرج/مخرج صفر و عدد خارج از دامنه قرمز است (BP-016)', () => {
  const c = baseCartridge([
    { id: 'Q-9001', prompt: '؟', answerFormat: 'کسر', answerFrac: { num: 1, den: 0 }, status: 'نیاز به تأیید', anchorId: 'L-T1' },
    { id: 'Q-9002', prompt: '؟', answerFormat: 'عدد', answerValue: 99999, status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]);
  const v = validateCartridge(c);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.includes('Q-9001') && e.includes('BP-016')), v.errors.join(' | '));
  assert.ok(v.errors.some(e => e.includes('Q-9002') && e.includes('BP-016')), v.errors.join(' | '));
});

test('schema: ضد J12 برای قالب مستقیم — ۳۰×۴ با پاسخ ۱۲۰ سبز، پاسخ ۱۲۱ قرمز', () => {
  const okCart = baseCartridge([{ id: 'Q-9001', prompt: '۳۰ × ۴ = ؟', answerFormat: 'عدد', answerValue: 120, status: 'تأییدشده', source: 'تست', anchorId: 'L-T1' }]);
  assert.equal(validateCartridge(okCart).ok, true);
  const badCart = baseCartridge([{ id: 'Q-9001', prompt: '۳۰ × ۴ = ؟', answerFormat: 'عدد', answerValue: 121, status: 'تأییدشده', source: 'تست', anchorId: 'L-T1' }]);
  const vBad = validateCartridge(badCart);
  assert.equal(vBad.ok, false);
  assert.ok(vBad.errors.some(e => e.includes('Q-9001') && e.includes('ضد J12')), vBad.errors.join(' | '));
});

test('گارد رگرسیون: سؤال گزینه‌ایِ بی‌گزینه هنوز قرمز است (رفتار قدیمی)', () => {
  const c = baseCartridge([{ id: 'Q-9001', prompt: '۳ × ۴ = ؟', status: 'نیاز به تأیید', anchorId: 'L-T1' }]);
  const v = validateCartridge(c);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.includes('Q-9001') && e.includes('گزینه‌ها')), v.errors.join(' | '));
});

test('گارد رگرسیون: خشاب‌های رسمی G2 و G3 مثل قبل سبز می‌مانند', () => {
  for (const rel of ['../cartridges/KH-G2-MATH.json', '../cartridges/KH-G3-MATH.json']) {
    const c = readJson(rel);
    const v = validateCartridge(c);
    assert.equal(v.ok, true, `${rel}: ${v.errors.join(' | ')}`);
  }
});
