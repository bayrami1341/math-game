// آزمون‌های فاز ب/ج موتور چند-قالبی (BP-017 T5)
// پوشش: محور عددی (تلورانس)، زوج‌سازی (جفت کامل/ناقص/غلط)، شکل/نمودار با ۴ زیرقالب،
// نردبان formatHint، پارسر renderHint، رفتار schema برای قالب‌های نو، پل adaptCartridgeQuestions
// بدون skip قالب‌های ۴..۶ + گارد رگرسیون قالب‌های فاز الف.
//
// اصل رگرسیون: خشاب میراثی (۹۲ سؤال G2 و ۲۰ سؤال G3) و رفتار فاز الف (گزینه‌ای/عدد/کسر)
// باید دقیقاً مثل قبل بمانند — همهٔ افزودنی‌ها opt-in با answerFormat/renderHint هستند.
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
  checkMatchingAnswer,
  checkFigureAnswer,
  parseRenderHint,
  numberLineParams,
  fractionShapeTarget,
  formatHint,
  adaptCartridgeQuestions,
  FORMAT_MCQ,
  FORMAT_NUMBER,
  FORMAT_FRACTION,
  FORMAT_NUMBER_LINE,
  FORMAT_MATCHING,
  FORMAT_FIGURE,
  PLAYABLE_FORMATS
} from '../src/v10/station/answer-formats.js';
import { validateCartridge } from '../src/v10/station/cartridge-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readJson = rel => JSON.parse(readFileSync(path.join(__dirname, rel), 'utf-8'));

// ── ۱) قالب مؤثر — هر ۶ قالب (BP-017: همه قابل بازی) ─────────────────────────

test('تشخیص قالب مؤثر: هر ۶ قالب واژه‌نامه شناسایی می‌شوند', () => {
  assert.equal(effectiveFormat({ options: ['۱', '۲', '۳', '۴'], answerIndex: 0 }), FORMAT_MCQ);
  assert.equal(effectiveFormat({ answerFormat: 'عدد', answerValue: 7 }), FORMAT_NUMBER);
  assert.equal(effectiveFormat({ answerFormat: 'کسر', answerFrac: { num: 1, den: 2 } }), FORMAT_FRACTION);
  assert.equal(effectiveFormat({ answerFormat: 'محور عددی', answerValue: 3 }), FORMAT_NUMBER_LINE);
  assert.equal(effectiveFormat({ answerFormat: 'زوج‌سازی', matches: [{ left: 'الف', right: '۱' }, { left: 'ب', right: '۲' }] }), FORMAT_MATCHING);
  assert.equal(effectiveFormat({ answerFormat: 'شکل/نمودار', renderHint: 'subkind:bar-chart' }), FORMAT_FIGURE);
  assert.equal(effectiveFormat({}), null);
  assert.equal(effectiveFormat({ answerFormat: 'قالبِ ناموجود' }), null);
  // PLAYABLE_FORMATS = هر ۶ قالب (معنای بازیپذیری، نه فقط فاز الف)
  assert.deepEqual([...PLAYABLE_FORMATS].sort(), ['زوج‌سازی', 'شکل/نمودار', 'عدد', 'کسر', 'گزینه‌ای', 'محور عددی'].sort());
});

// ── ۲) پارسر renderHint (مینی-گرامر BP-017) ──────────────────────────────────

test('parseRenderHint: کلید/مقدار با جداکنندهٔ ; — عددی‌نما به عدد، بقیه رشته', () => {
  const h = parseRenderHint('subkind:number-line;min:0;max:10;step:1;tolerance:0.001');
  assert.equal(h.subkind, 'number-line');
  assert.deepEqual(h.params, { subkind: 'number-line', min: 0, max: 10, step: 1, tolerance: 0.001 });
  assert.equal(h.raw, 'subkind:number-line;min:0;max:10;step:1;tolerance:0.001');
  const h2 = parseRenderHint('subkind:area-cells;shape:lshape6');
  assert.equal(h2.subkind, 'area-cells');
  assert.equal(h2.params.shape, 'lshape6');
  const h3 = parseRenderHint('subkind:fraction-shape;cells:4');
  assert.equal(h3.params.cells, 4);
});

test('parseRenderHint: غایب/تهی/بدشکل → null (نرم — قرارداد هشدار نه خطا)', () => {
  assert.equal(parseRenderHint(null), null);
  assert.equal(parseRenderHint(undefined), null);
  assert.equal(parseRenderHint(''), null);
  assert.equal(parseRenderHint('   '), null);
  assert.equal(parseRenderHint('بدون-دونقطه'), null);
  assert.equal(parseRenderHint('a:1;b'), null, 'تکهٔ بدون : کل hint را بدشکل می‌کند');
  assert.equal(parseRenderHint('a:;b:2'), null, 'مقدار تهی کل hint را بدشکل می‌کند');
});

test('numberLineParams: پیش‌فرض امن بدون hint و رد شبکهٔ نابسته', () => {
  assert.deepEqual(numberLineParams({ renderHint: 'subkind:number-line;min:0;max:10;step:1;tolerance:0.001' }),
    { min: 0, max: 10, step: 1, tolerance: 0.001, ticks: 10 });
  const d = numberLineParams({}); // بدون hint → پیش‌فرض ۰..۱۰ گام ۱ + تلورانس نصف گام
  assert.deepEqual(d, { min: 0, max: 10, step: 1, tolerance: 0.5, ticks: 10 });
  assert.equal(numberLineParams({ renderHint: 'subkind:number-line;min:0;max:10;step:0.3' }), null,
    'شبکهٔ درجه‌ها باید عدد صحیح درجه ببندد');
  assert.equal(numberLineParams({ renderHint: 'subkind:number-line;min:0;max:1000;step:1' }), null,
    'بیش از ۶۰ درجه برای رابط لمسی سنگین است');
});

// ── ۳) قابل بازی بودن قالب‌های نو (نگهبان دادهٔ بدشکل) ────────────────────────

test('isPlayable: محور عددی به answerValue نیاز دارد — بدون آن false (رفتار تست فاز الف حفظ می‌شود)', () => {
  assert.equal(isPlayable({ answerFormat: 'محور عددی' }), false, 'بدون answerValue بازی نمی‌شود');
  assert.equal(isPlayable({ answerFormat: 'محور عددی', answerValue: 7 }), true);
  assert.equal(isPlayable({ answerFormat: 'محور عددی', answerValue: 7, renderHint: 'subkind:number-line;min:0;max:5;step:1' }), false,
    'پاسخ بیرون از بازهٔ محور بازی نمی‌شود');
});

test('isPlayable: زوج‌سازی — ۲..۵ جفت رشته‌ای یکتا؛ تکراری/کمتر/بیشتر رد می‌شود', () => {
  const ok = { answerFormat: 'زوج‌سازی', matches: [{ left: '۳×۴', right: '۱۲' }, { left: '۲×۵', right: '۱۰' }] };
  assert.equal(isPlayable(ok), true);
  assert.equal(isPlayable({ answerFormat: 'زوج‌سازی', matches: [{ left: 'a', right: '1' }] }), false, 'یک جفت کافی نیست');
  assert.equal(isPlayable({ answerFormat: 'زوج‌سازی', matches: [{ left: 'a', right: '1' }, { left: 'a', right: '2' }] }), false, 'چپ تکراری');
  assert.equal(isPlayable({ answerFormat: 'زوج‌سازی', matches: [{ left: 'a', right: '1' }, { left: 'b', right: '1' }] }), false, 'راست تکراری');
  assert.equal(isPlayable({ answerFormat: 'زوج‌سازی', matches: [{ left: 'a', right: '' }, { left: 'b', right: '2' }] }), false, 'راست تهی');
  const five = Array.from({ length: 5 }, (_, i) => ({ left: `L${i}`, right: `R${i}` }));
  const six = Array.from({ length: 6 }, (_, i) => ({ left: `L${i}`, right: `R${i}` }));
  assert.equal(isPlayable({ answerFormat: 'زوج‌سازی', matches: five }), true);
  assert.equal(isPlayable({ answerFormat: 'زوج‌سازی', matches: six }), false, 'سقف ۵ جفت');
});

test('isPlayable: شکل/نمودار — هر ۴ زیرقالب با دادهٔ کامل، و گاردهای بدشکل', () => {
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:fraction-shape;cells:4', answerFrac: { num: 2, den: 4 }
  }), true, '۲/۴ روی ۴ خانه — مخرج ساده‌شده ۲، بخش‌پذیر');
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:fraction-shape;cells:4'
  }), false, 'بدون answerFrac بازی نمی‌شود');
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:fraction-shape;cells:3', answerFrac: { num: 1, den: 2 }
  }), false, 'cells=3 بر مخرج ۲ بخش‌پذیر نیست');
  assert.equal(isPlayable({ answerFormat: 'شکل/نمودار', renderHint: 'subkind:area-cells', answerValue: 6 }), true);
  assert.equal(isPlayable({ answerFormat: 'شکل/نمودار', renderHint: 'subkind:area-cells' }), false, 'بدون تعداد خانه‌ها');
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:symmetry',
    figureOptions: ['قلب', 'F'], correct: 0
  }), true);
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:symmetry',
    figureOptions: ['قلب', 'F'], correct: 5
  }), false, 'پاسخ‌نام بیرون از بازه');
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:bar-chart',
    chartData: [{ label: 'مهر', value: 4 }, { label: 'آبان', value: 6 }], answerValue: 6
  }), true);
  assert.equal(isPlayable({
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:bar-chart',
    chartData: [{ label: 'مهر', value: 'x' }, { label: 'آبان', value: 6 }], answerValue: 6
  }), false, 'مقدار غیرعددی در نمودار');
  assert.equal(isPlayable({ answerFormat: 'شکل/نمودار' }), false, 'بدون renderHint — زیرقالب نامشخص (هشدار در schema، نه قرمز)');
  assert.equal(isPlayable({ answerFormat: 'شکل/نمودار', renderHint: 'subkind:namaeloom' }), false, 'زیرقالب ناشناخته');
});

// ── ۴) سنجش پاسخ: محور عددی (تلورانس) ────────────────────────────────────────

test('سنجش محور عددی: برخورد با تلورانس و خطا بیرون تلورانس + ورودی بدشکل', () => {
  const q = { answerFormat: 'محور عددی', answerValue: 6, renderHint: 'subkind:number-line;min:0;max:10;step:1;tolerance:0.001' };
  assert.equal(checkCartridgeAnswer(q, 6).correct, true);
  assert.equal(checkCartridgeAnswer(q, '۶').correct, true, 'ارقام فارسی');
  assert.equal(checkCartridgeAnswer(q, 5).correct, false);
  assert.equal(checkCartridgeAnswer(q, 7).correct, false);
  const tol = { answerFormat: 'محور عددی', answerValue: 6, renderHint: 'subkind:number-line;min:0;max:10;step:1;tolerance:0.5' };
  assert.equal(checkCartridgeAnswer(tol, 5.5).correct, true, 'مرز تلورانس (شمول)');
  assert.equal(checkCartridgeAnswer(tol, 5.49).correct, false);
  assert.equal(checkCartridgeAnswer(q, 'کجا؟').correct, false);
  assert.equal(checkCartridgeAnswer(q, '').correct, false);
});

// ── ۵) سنجش پاسخ: زوج‌سازی (کامل/ناقص/غلط/بدشکل) ─────────────────────────────

function matchingQuestion() {
  return {
    answerFormat: 'زوج‌سازی',
    matches: [
      { left: '۳ × ۴', right: '۱۲' },
      { left: '۲ × ۵', right: '۱۰' },
      { left: '۲ × ۲', right: '۴' }
    ]
  };
}

test('سنجش زوج‌سازی: کامل درست = درست؛ جفت غلط/ناقص = غلط با شمارش', () => {
  const q = matchingQuestion();
  const full = checkMatchingAnswer(q, [[0, 0], [1, 1], [2, 2]]);
  assert.equal(full.correct, true);
  assert.equal(full.correctCount, 3);
  assert.equal(full.total, 3);
  // قرارداد {pairs: ...}
  assert.equal(checkMatchingAnswer(q, { pairs: [[2, 2], [0, 0], [1, 1]] }).correct, true, 'ترتیب تشکیل مهم نیست');
  const wrong = checkMatchingAnswer(q, [[0, 1], [1, 1], [2, 2]]);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.correctCount, 2);
  assert.equal(wrong.reason, 'wrong-pairs');
  const partial = checkMatchingAnswer(q, [[0, 0]]);
  assert.equal(partial.correct, false);
  assert.equal(partial.correctCount, 1);
  assert.equal(partial.reason, 'incomplete');
  assert.equal(checkMatchingAnswer(q, [[0, 0], [0, 0], [1, 1]]).reason, 'bad-pairs-shape', 'چپ تکراری مجاز نیست');
  assert.equal(checkMatchingAnswer(q, [[0, 9]]).reason, 'bad-pairs-shape', 'ایندکس بیرون بازه');
  assert.equal(checkMatchingAnswer(q, '۱۲').reason, 'bad-pairs-shape');
  // از مسیر عمومی checkCartridgeAnswer هم باید همان قرارداد بخواند
  assert.equal(checkCartridgeAnswer(q, [[0, 0], [1, 1], [2, 2]]).correct, true);
  assert.equal(checkCartridgeAnswer(q, [[0, 1], [1, 1], [2, 2]]).correct, false);
});

// ── ۶) سنجش پاسخ: شکل/نمودار — ۴ زیرقالب ─────────────────────────────────────

test('سنجش کسر روی شکل: هم‌ارزی ۲/۴ ≡ ۱/۲ با cells=4 → رنگ ۲ خانه', () => {
  const q = { answerFormat: 'شکل/نمودار', answerFrac: { num: 2, den: 4 }, renderHint: 'subkind:fraction-shape;cells:4' };
  const target = fractionShapeTarget(q);
  assert.deepEqual(target, { cells: 4, num: 1, den: 2, shaded: 2 }, '۲/۴ ساده می‌شود به ۱/۲؛ ۱×(۴/۲)=۲ خانه');
  assert.equal(checkCartridgeAnswer(q, 2).correct, true);
  assert.equal(checkCartridgeAnswer(q, '۲').correct, true);
  assert.equal(checkCartridgeAnswer(q, 1).correct, false);
  assert.equal(checkCartridgeAnswer(q, 3).correct, false);
  assert.equal(checkCartridgeAnswer(q, 4).correct, false);
  const q12 = { answerFormat: 'شکل/نمودار', answerFrac: { num: 1, den: 2 }, renderHint: 'subkind:fraction-shape;cells:4' };
  assert.equal(checkCartridgeAnswer(q12, 2).correct, true);
  // بدون cells → پیش‌فرض مخرج ساده‌شده
  const qDef = { answerFormat: 'شکل/نمودار', answerFrac: { num: 3, den: 4 }, renderHint: 'subkind:fraction-shape' };
  assert.equal(checkCartridgeAnswer(qDef, 3).correct, true);
  assert.equal(checkFigureAnswer(qDef, 2).correct, false);
});

test('سنجش خانه‌شمار مساحت و نمودار میله‌ای: همان سنجش عددی کتاب', () => {
  const area = { answerFormat: 'شکل/نمودار', renderHint: 'subkind:area-cells;shape:lshape6', answerValue: 6 };
  assert.equal(checkCartridgeAnswer(area, 6).correct, true);
  assert.equal(checkCartridgeAnswer(area, '۶').correct, true);
  assert.equal(checkCartridgeAnswer(area, 5).correct, false);
  const bar = {
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:bar-chart',
    chartData: [{ label: 'مهر', value: 4 }, { label: 'آبان', value: 6 }, { label: 'آذر', value: 2 }],
    answerValue: 6
  };
  assert.equal(checkCartridgeAnswer(bar, 6).correct, true);
  assert.equal(checkCartridgeAnswer(bar, '۴').correct, false, 'مقدار میلهٔ دیگر');
  assert.equal(checkCartridgeAnswer(bar, 'شش').correct, false);
});

test('سنجش تقارن: گزینه‌ای تصویری — پاسخ‌نام درست/غلط/بدشکل', () => {
  const q = {
    answerFormat: 'شکل/نمودار', renderHint: 'subkind:symmetry',
    figureOptions: ['heart', 'flag-f'], correct: 0
  };
  assert.equal(checkCartridgeAnswer(q, 0).correct, true);
  assert.equal(checkCartridgeAnswer(q, '۰').correct, true);
  assert.equal(checkCartridgeAnswer(q, 1).correct, false);
  assert.equal(checkCartridgeAnswer(q, 9).correct, false, 'ایندکس بیرون بازه');
  assert.equal(checkFigureAnswer({ answerFormat: 'شکل/نمودار', renderHint: 'subkind:namoloom' }, 1).reason, 'unknown-subkind');
});

// ── ۷) نردبان داربست formatHint (BP-017 T4) ──────────────────────────────────

test('formatHint: پله‌های پیشروندهٔ فارسی برای قالب‌های نو؛ بدون نشت پاسخ؛ فاز الف null', () => {
  const nl = { answerFormat: 'محور عددی', answerValue: 6 };
  assert.equal(typeof formatHint(FORMAT_NUMBER_LINE, nl, 0), 'string');
  assert.notEqual(formatHint(FORMAT_NUMBER_LINE, nl, 0), formatHint(FORMAT_NUMBER_LINE, nl, 1), 'پلهٔ ۰ و ۱ متفاوت');
  assert.equal(formatHint(FORMAT_NUMBER_LINE, nl, 9), formatHint(FORMAT_NUMBER_LINE, nl, 2), 'سقف پله‌ها');
  const figFrac = { answerFormat: 'شکل/نمودار', renderHint: 'subkind:fraction-shape;cells:4', answerFrac: { num: 2, den: 4 } };
  assert.ok(formatHint(FORMAT_FIGURE, figFrac, 0).includes('بشمار'), 'پلهٔ نخست: شمارش خانه‌ها');
  const figBar = { answerFormat: 'شکل/نمودار', renderHint: 'subkind:bar-chart' };
  assert.ok(formatHint(FORMAT_FIGURE, figBar, 0).includes('میله'), 'زیرقالب نمودار: اشاره به میله‌ها');
  const match = { answerFormat: 'زوج‌سازی', matches: [] };
  assert.equal(typeof formatHint(FORMAT_MATCHING, match, 0), 'string');
  assert.equal(formatHint(FORMAT_MCQ, {}, 0), null, 'گزینه‌ای مسیر نردبان قدیمی');
  assert.equal(formatHint(FORMAT_NUMBER, {}, 0), null);
  assert.equal(formatHint(FORMAT_FRACTION, {}, 0), null);
  // ضدنشت: پله‌های راهنما نباید پاسخ ۶ را به‌صورت توکن عددی مستقل داشته باشند
  for (let s = 0; s < 3; s++) {
    const h = formatHint(FORMAT_NUMBER_LINE, nl, s) || '';
    assert.ok(!/(^|[^۰-۹0-9])۶([^۰-۹0-9]|$)/.test(h), `پلهٔ ${s} نباید پاسخ را افشا کند`);
  }
});

// ── ۸) schema موتور: قالب‌های نو — داده سخت، renderHint نرم ──────────────────

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

test('schema: محور عددی بدون answerValue قرمز؛ بدون renderHint زرد (نه قرمز)', () => {
  const vBad = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: '؟', answerFormat: 'محور عددی', renderHint: 'subkind:number-line;min:0;max:10;step:1', status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vBad.ok, false);
  assert.ok(vBad.errors.some(e => e.includes('Q-9001') && e.includes('BP-017')), vBad.errors.join(' | '));
  const vWarn = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: '؟', answerFormat: 'محور عددی', answerValue: 5, status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vWarn.ok, true, vWarn.errors.join(' | '));
  assert.ok(vWarn.warnings.some(w => w.includes('Q-9001') && w.includes('renderHint')), vWarn.warnings.join(' | '));
});

test('schema: زوج‌سازی — matches معتبر سبز؛ جفت تکراری/کمتر از ۲ قرمز', () => {
  const okCart = baseCartridge([
    { id: 'Q-9001', prompt: 'وصل کن', answerFormat: 'زوج‌سازی', matches: [{ left: '۳×۴', right: '۱۲' }, { left: '۲×۵', right: '۱۰' }], status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]);
  const vOk = validateCartridge(okCart);
  assert.equal(vOk.ok, true, vOk.errors.join(' | '));
  const badCart = baseCartridge([
    { id: 'Q-9001', prompt: 'وصل کن', answerFormat: 'زوج‌سازی', matches: [{ left: 'a', right: '1' }], status: 'نیاز به تأیید', anchorId: 'L-T1' },
    { id: 'Q-9002', prompt: 'وصل کن', answerFormat: 'زوج‌سازی', matches: [{ left: 'a', right: '1' }, { left: 'a', right: '2' }], status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]);
  const vBad = validateCartridge(badCart);
  assert.equal(vBad.ok, false);
  assert.ok(vBad.errors.some(e => e.includes('Q-9001') && e.includes('BP-017')), vBad.errors.join(' | '));
  assert.ok(vBad.errors.some(e => e.includes('Q-9002') && e.includes('BP-017')), vBad.errors.join(' | '));
});

test('schema: شکل/نمودار — renderHint غایب زرد (سبز می‌ماند)؛ زیرقالب شناخته سخت‌گیرانه چک می‌شود', () => {
  const vWarn = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: '؟', answerFormat: 'شکل/نمودار', answerValue: 3, status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vWarn.ok, true, 'renderHint غایب = هشدار نه خطا (سازگاری میراث)');
  assert.ok(vWarn.warnings.some(w => w.includes('Q-9001')), vWarn.warnings.join(' | '));
  const vBadFrac = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: 'رنگ کن', answerFormat: 'شکل/نمودار', renderHint: 'subkind:fraction-shape;cells:4', status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vBadFrac.ok, false, 'کسر روی شکل بدون answerFrac قرمز است');
  assert.ok(vBadFrac.errors.some(e => e.includes('Q-9001') && e.includes('BP-017')), vBadFrac.errors.join(' | '));
  const vBadSym = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: 'کدام متقارن است؟', answerFormat: 'شکل/نمودار', renderHint: 'subkind:symmetry', figureOptions: ['قلب'], correct: 0, status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vBadSym.ok, false, 'یک گزینه برای تقارن کافی نیست');
  const vBadBar = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: '؟', answerFormat: 'شکل/نمودار', renderHint: 'subkind:bar-chart', chartData: [{ label: 'مهر' }], answerValue: 1, status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vBadBar.ok, false, 'chartData بدون value قرمز است');
  const vBadArea = validateCartridge(baseCartridge([
    { id: 'Q-9001', prompt: '؟', answerFormat: 'شکل/نمودار', renderHint: 'subkind:area-cells', status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]));
  assert.equal(vBadArea.ok, false, 'خانه‌شمار بدون answerValue قرمز است');
});

test('schema: سؤال میراثی بدون answerFormat — ذره‌ای تغییر نمی‌کند (گارد رگرسیون قالبی)', () => {
  const legacy = baseCartridge([
    { id: 'Q-9001', prompt: '۳ × ۴ = ؟', options: ['۱۲', '۷', '۱۲۴', '۱'], answerIndex: 0, status: 'نیاز به تأیید', anchorId: 'L-T1' }
  ]);
  const v = validateCartridge(legacy);
  assert.equal(v.ok, true, v.errors.join(' | '));
  assert.equal(v.warnings.length, 0, 'هیچ هشدار BP-017 برای میراثی صادر نشود');
});

// ── ۹) پل adaptCartridgeQuestions: بدون skip قالب‌های ۴..۶ + شمارش skippedInvalid ──

function multiformatCartridge() {
  return {
    cartridgeId: 'KH-TEST-MATH',
    questionBank: [
      { id: 'Q-9101', prompt: '۳ × ۴ = ؟', options: ['۱۲', '۷', '۱۲۴', '۱'], answerIndex: 0, status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9102', prompt: '۹ + ۶ چند است؟', answerFormat: 'عدد', answerValue: 15, status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9103', prompt: 'نصف شکل؟', answerFormat: 'کسر', answerFrac: { num: 1, den: 2 }, status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9104', prompt: 'پایان پرش‌ها؟', answerFormat: 'محور عددی', answerValue: 6,
        renderHint: 'subkind:number-line;min:0;max:10;step:1;tolerance:0.001', status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9105', prompt: 'وصل کن', answerFormat: 'زوج‌سازی',
        matches: [{ left: '۳ × ۴', right: '۱۲' }, { left: '۲ × ۵', right: '۱۰' }, { left: '۲ × ۲', right: '۴' }],
        status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9106', prompt: 'رنگ کن', answerFormat: 'شکل/نمودار', answerFrac: { num: 2, den: 4 },
        renderHint: 'subkind:fraction-shape;cells:4', status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9107', prompt: 'چند خانه؟', answerFormat: 'شکل/نمودار', answerValue: 6,
        renderHint: 'subkind:area-cells;shape:lshape6', status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9108', prompt: 'بیشترین فروش؟', answerFormat: 'شکل/نمودار', answerValue: 6,
        renderHint: 'subkind:bar-chart',
        chartData: [{ label: 'مهر', value: 4 }, { label: 'آبان', value: 6 }, { label: 'آذر', value: 2 }],
        status: 'نیاز به تأیید', anchorId: 'L-T1' },
      { id: 'Q-9109', prompt: 'کدام متقارن است؟', answerFormat: 'شکل/نمودار',
        renderHint: 'subkind:symmetry', figureOptions: ['heart', 'flag-f'], correct: 0,
        status: 'نیاز به تأیید', anchorId: 'L-T1' }
    ],
    bookMap: [{ id: 'L-T1', title: 'درس آزمایشی', anchorsRaw: 'Q-9101 تا Q-9109', status: 'نیاز به تأیید' }]
  };
}

test('پل کارتریج: هر ۶ قالب برمی‌گردند — صفر skip برای دادهٔ سالم + فیلدهای نو حمل می‌شوند', () => {
  const adapted = adaptCartridgeQuestions(multiformatCartridge(), { limit: 0, shuffle: false });
  assert.equal(adapted.total, 9);
  assert.equal(adapted.skipped, 0, 'هیچ قالبی صرفاً به‌خاطر «فاز ب/ج» رد نمی‌شود');
  assert.equal(adapted.skippedInvalid, 0);
  assert.equal(adapted.questions.length, 9);
  const fmts = Object.fromEntries(adapted.questions.map(q => [q.questionId, q.answerFormat]));
  assert.equal(fmts['Q-9101'], FORMAT_MCQ);
  assert.equal(fmts['Q-9104'], FORMAT_NUMBER_LINE);
  assert.equal(fmts['Q-9105'], FORMAT_MATCHING);
  assert.equal(fmts['Q-9106'], FORMAT_FIGURE);
  const nl = adapted.questions.find(q => q.questionId === 'Q-9104');
  assert.deepEqual(nl.numberLine, { min: 0, max: 10, step: 1, tolerance: 0.001, ticks: 10 }, 'پارامترهای محور حمل می‌شود');
  const match = adapted.questions.find(q => q.questionId === 'Q-9105');
  assert.deepEqual(match.matches, [{ left: '۳ × ۴', right: '۱۲' }, { left: '۲ × ۵', right: '۱۰' }, { left: '۲ × ۲', right: '۴' }]);
  const frac = adapted.questions.find(q => q.questionId === 'Q-9106');
  assert.equal(frac.subkind, 'fraction-shape');
  assert.equal(frac.cells, 4);
  assert.deepEqual(frac.answerFrac, { num: 2, den: 4 });
  const area = adapted.questions.find(q => q.questionId === 'Q-9107');
  assert.equal(area.subkind, 'area-cells');
  assert.equal(area.figureShape, 'lshape6');
  const bar = adapted.questions.find(q => q.questionId === 'Q-9108');
  assert.equal(bar.subkind, 'bar-chart');
  assert.deepEqual(bar.chartData, [{ label: 'مهر', value: 4 }, { label: 'آبان', value: 6 }, { label: 'آذر', value: 2 }]);
  const sym = adapted.questions.find(q => q.questionId === 'Q-9109');
  assert.equal(sym.subkind, 'symmetry');
  assert.deepEqual(sym.figureOptions, ['heart', 'flag-f']);
  assert.equal(sym.correct, 0);
});

test('پل کارتریج: دادهٔ بدشکل → skippedInvalid شمرده می‌شود (نگهبان)', () => {
  const cart = multiformatCartridge();
  cart.questionBank.push(
    { id: 'Q-9110', prompt: '؟', answerFormat: 'محور عددی', status: 'نیاز به تأیید', anchorId: 'L-T1' }, // بدون answerValue
    { id: 'Q-9111', prompt: '؟', answerFormat: 'زوج‌سازی', matches: 'بدشکل', status: 'نیاز به تأیید', anchorId: 'L-T1' },
    { id: 'Q-9112', prompt: '؟', answerFormat: 'شکل/نمودار', status: 'نیاز به تأیید', anchorId: 'L-T1' } // بدون renderHint
  );
  const adapted = adaptCartridgeQuestions(cart, { limit: 0, shuffle: false });
  assert.equal(adapted.total, 12);
  assert.equal(adapted.skipped, 3);
  assert.equal(adapted.skippedInvalid, 3);
  assert.equal(adapted.questions.length, 9);
});

test('گارد رگرسیون فاز الف: گزینه‌ای/عدد/کسر دقیقاً مثل قبل پل می‌شوند', () => {
  const adapted = adaptCartridgeQuestions(multiformatCartridge(), { limit: 0, shuffle: false });
  const mcq = adapted.questions.find(q => q.questionId === 'Q-9101');
  assert.deepEqual(mcq.options, ['۱۲', '۷', '۱۲۴', '۱']);
  assert.equal(mcq.answerIndex, 0);
  assert.deepEqual(mcq.f1, 3, 'استخراج عوامل ضرب برای اطلس — رفتار فاز الف');
  assert.deepEqual(mcq.f2, 4);
  const num = adapted.questions.find(q => q.questionId === 'Q-9102');
  assert.equal(num.answerValue, 15);
  assert.equal(num.f1, null, 'سؤال جمعی عامل ضرب ندارد');
  const frac = adapted.questions.find(q => q.questionId === 'Q-9103');
  assert.deepEqual(frac.answerFrac, { num: 1, den: 2 });
  // سنجش سه‌قالب قدیمی هم عین قبل
  assert.equal(checkCartridgeAnswer({ options: ['۱۲', '۷', '۱۲۴', '۱'], answerIndex: 0 }, 0).correct, true);
  assert.equal(checkCartridgeAnswer({ answerFormat: 'عدد', answerValue: 15 }, '۱۵').correct, true);
  assert.equal(checkCartridgeAnswer({ answerFormat: 'کسر', answerFrac: { num: 3, den: 4 } }, '۲/۴').correct, false, '۳/۴ ≠ ۲/۴ پس از ساده‌سازی (عین تست فاز الف)');
  assert.equal(parseUserFraction('۶/۸').num, 3);
  assert.equal(parseUserNumber('۱۲'), 12);
});

test('پل کارتریج روی خشاب واقعی G2: هر ۹۲ سؤال گزینه‌ای قابل بازی می‌ماند (رگرسیون کامل)', () => {
  const g2 = readJson('../cartridges/KH-G2-MATH.json');
  const adapted = adaptCartridgeQuestions(g2, { limit: 0, shuffle: false });
  assert.equal(adapted.total, 92);
  assert.equal(adapted.skipped, 0);
  assert.equal(adapted.skippedInvalid, 0);
  assert.equal(adapted.questions.length, 92);
  assert.ok(adapted.questions.every(q => q.answerFormat === FORMAT_MCQ));
});

// ── ۱۰) خشاب نمایشی گسترش‌یافته KH-DEMO-MATH (۵ سؤال نو) ─────────────────────

test('KH-DEMO-MATH: ۸ سؤال شش‌قالبی — validate سبز و adapt با صفر skip', () => {
  const demo = readJson('../cartridges/KH-DEMO-MATH.json');
  const v = validateCartridge(demo);
  assert.equal(v.ok, true, v.errors.join(' | '));
  const adapted = adaptCartridgeQuestions(demo, { limit: 0, shuffle: false });
  assert.equal(adapted.total, 8);
  assert.equal(adapted.skipped, 0);
  assert.equal(adapted.skippedInvalid, 0);
  const fmts = adapted.questions.map(q => q.answerFormat);
  assert.ok(fmts.includes(FORMAT_NUMBER_LINE), 'محور عددی در دمو هست');
  assert.ok(fmts.includes(FORMAT_MATCHING), 'زوج‌سازی در دمو هست');
  assert.equal(fmts.filter(f => f === FORMAT_FIGURE).length, 3, 'سه زیرقالب شکل/نمودار در دمو (fraction-shape/area-cells/bar-chart)');
  // سنجش هر ۵ سؤال نو دمو با پاسخ درستشان
  const byId = Object.fromEntries(adapted.questions.map(q => [q.questionId, q]));
  assert.equal(checkCartridgeAnswer(byId['Q-9904'], 6).correct, true, 'محور: پایان ۳ پرش ۲تایی = ۶');
  assert.equal(checkCartridgeAnswer(byId['Q-9905'], [[0, 0], [1, 1], [2, 2]]).correct, true, 'زوج‌سازی کامل');
  assert.equal(checkCartridgeAnswer(byId['Q-9906'], 2).correct, true, '۲/۴ روی ۴ خانه = ۲ خانه رنگ');
  assert.equal(checkCartridgeAnswer(byId['Q-9907'], 6).correct, true, 'خانه‌شمار = ۶');
  assert.equal(checkCartridgeAnswer(byId['Q-9908'], 6).correct, true, 'بیشترین فروش = ۶');
});
