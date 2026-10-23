// آزمون‌های موتور W8 (BP-007 — رشتهٔ B1) — پورت ۵ خانوادهٔ حل‌گر آرنا
// مرجع: authoring/agent/solvers/*.py در arena/0eb22280-math-game
// اصول: (۱) پاسخ درست همیشه null (۲) هر الگوی کلاسیک مرجع پایتونی یک آزمون دارد
// (۳) هر حساب کسری exact است (۴) بیرون قرارداد → null (صادقانه بی‌الگو)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODES_W8,
  PRIORITY_W8,
  classifyW8,
  solveW8,
  classifyFracW8,
  classifyGeometryW8,
  classifyDataProbW8,
  classifyMultDivW8,
  classifyNumberOpsW8
} from '../src/v10/station/errors-w8.js';
import { parseOptionValue, isFracValue } from '../src/v10/station/cartridge-schema.js';
import { classifyAttempt } from '../src/v10/station/errors.js';

// ── ۱) خانوادهٔ کسر ──────────────────────────────────────────────────────────

test('W8/کسر: part_whole — جابه‌جایی، رنگ‌نشده، متمم، ±یک', () => {
  const spec = { op: 'frac_part_whole', shaded: 3, total: 8 };
  assert.equal(classifyFracW8(spec, { frac: true, num: 3, den: 8 }), null, 'درست');
  assert.equal(classifyFracW8(spec, { frac: true, num: 8, den: 3 }), 'E_FRAC_NUM_DENOM_SWAP');
  assert.equal(classifyFracW8(spec, { frac: true, num: 3, den: 5 }), 'E_FRAC_PART_TO_UNSHADED');
  assert.equal(classifyFracW8(spec, { frac: true, num: 5, den: 8 }), 'E_FRAC_COMPLEMENT');
  assert.equal(classifyFracW8({ ...spec, total: 7 }, { frac: true, num: 3, den: 6 }), 'E_DOUBLE_OFF');
});

test('W8/کسر: equivalent_numerator — هم‌ارزی جمعی (خطای کلاسیک)، صورت ثابت، وارونه', () => {
  const spec = { op: 'frac_equiv_num', num: 2, den: 5, target_den: 20 }; // ۲/۵ = ?/۲۰ → ۸
  assert.equal(classifyFracW8(spec, 8), null, 'درست');
  assert.equal(classifyFracW8(spec, 17), 'E_FRAC_ADDITIVE_EQUIVALENCE', '۲+(۲۰−۵)=۱۷');
  assert.equal(classifyFracW8(spec, 2), 'E_FRAC_UNCHANGED_NUMERATOR');
  assert.equal(classifyFracW8(spec, 20), 'E_FRAC_NUM_DENOM_SWAP');
});

test('W8/کسر: add/sub — جمع صورت‌ومخرج، تفریق‌آمیزی، جمع‌آمیزی', () => {
  const add = { op: 'frac_add', f1: [3, 8], f2: [1, 8] };
  assert.equal(classifyFracW8(add, { frac: true, num: 1, den: 2 }), null, '۳/۸+۱/۸=۱/۲ درست');
  assert.equal(classifyFracW8(add, { frac: true, num: 4, den: 16 }), 'E_FRAC_ADD_NUM_AND_DENOM', '(۳+۱)/(۸+۸)=۴/۱۶');
  const add2 = { op: 'frac_add', f1: [2, 5], f2: [1, 5] }; // بدون برخورد ارزش کاندیدها
  assert.equal(classifyFracW8(add2, { frac: true, num: 1, den: 5 }), 'E_SUB_CONFUSION', '(۲−۱)/۵');
  assert.equal(classifyFracW8(add2, { frac: true, num: 3, den: 10 }), 'E_FRAC_ADD_NUM_AND_DENOM', '(۲+۱)/(۵+۵)');
  const sub = { op: 'frac_sub', f1: [1, 2], f2: [1, 3] }; // ۱/۶
  assert.equal(classifyFracW8(sub, { frac: true, num: 1, den: 6 }), null, 'درست');
  assert.equal(classifyFracW8(sub, { frac: true, num: 5, den: 6 }), 'E_ADD_CONFUSION', '۱/۲+۱/۳=۵/۶');
});

test('W8/کسر: compare — وارونه‌گویی ترتیب مخرج (۱/۵ «بزرگ‌تر» از ۱/۳)', () => {
  const spec = { op: 'frac_compare', f1: [1, 3], f2: [1, 5], want: 'larger' };
  assert.equal(classifyFracW8(spec, { frac: true, num: 1, den: 3 }), null, 'درست');
  assert.equal(classifyFracW8(spec, { frac: true, num: 1, den: 5 }), 'E_FRAC_DENOM_ORDER_INVERT');
});

test('W8/کسر: of_quantity — وارونه، توقف گام واحدی، جمع/تفریق‌آمیزی', () => {
  const spec = { op: 'frac_of_quantity', fraction: [2, 5], quantity: 20 }; // ۸
  assert.equal(classifyFracW8(spec, 8), null, 'درست');
  assert.equal(classifyFracW8(spec, 50), 'E_FRAC_NUM_DENOM_SWAP', '۲۰×۵/۲');
  assert.equal(classifyFracW8(spec, 4), 'E_FRAC_UNIT_STEP_STOP', '۲۰÷۵');
  assert.equal(classifyFracW8(spec, 22), 'E_ADD_CONFUSION', '۲۰+۲');
  assert.equal(classifyFracW8(spec, 15), 'E_SUB_CONFUSION', '۲۰−۵');
});

test('W8/کسر: هم‌کنش‌پذیری با parseOptionValue — گزینهٔ مخلوط/رشته‌ای', () => {
  const mixed = parseOptionValue('۲ و ۱/۲');
  assert.ok(isFracValue(mixed));
  // ۵/۲ در مقایسهٔ ۱/۳ و ۱/۵ → نه درست است نه الگوی مقایسه‌ای → بی‌الگو
  assert.equal(
    classifyW8({ op: 'frac_compare', f1: [1, 3], f2: [1, 5], want: 'larger' }, mixed),
    null
  );
  // رشتهٔ لاتین '1/5' هم پذیرفته می‌شود
  assert.equal(
    classifyW8({ op: 'frac_compare', f1: [1, 3], f2: [1, 5], want: 'larger' }, '1/5'),
    'E_FRAC_DENOM_ORDER_INVERT'
  );
});

test('W8/حل‌گر کسر: solveFracW8 — کلید دقیق برای بازحساب مبدل', () => {
  assert.deepEqual(solveW8({ op: 'frac_add', f1: [1, 6], f2: [1, 3] }), { n: 1n, d: 2n });
  assert.deepEqual(solveW8({ op: 'frac_of_quantity', fraction: [3, 4], quantity: 20 }), { n: 15n, d: 1n });
  assert.equal(solveW8({ op: 'frac_sub', f1: [1, 3], f2: [1, 2] }), null, 'تفریق منفی — بیرون قرارداد ابتدایی');
  assert.equal(solveW8({ op: 'frac_equiv_num', num: 1, den: 3, target_den: 7 }), null, 'هم‌ارزی غیرصحیح — بیرون قرارداد');
});

// ── ۲) خانوادهٔ هندسه/اندازه‌گیری ─────────────────────────────────────────────

test('W8/هندسه: محیط مستطیل — خلط مساحت، نیم‌محیط، ضلع ناقص', () => {
  const spec = { op: 'perimeter_rect', width: 5, height: 3 }; // ۱۶
  assert.equal(classifyGeometryW8(spec, 16), null, 'درست');
  assert.equal(classifyGeometryW8(spec, 15), 'E_PERIMETER_AREA_CONFUSION');
  assert.equal(classifyGeometryW8(spec, 8), 'E_HALF_PERIMETER');
  assert.equal(classifyGeometryW8(spec, 13), 'E_INCOMPLETE_SIDES', '۲×۵+۳');
  assert.equal(classifyGeometryW8(spec, 11), 'E_INCOMPLETE_SIDES', '۵+۲×۳');
});

test('W8/هندسه: مساحت مربع — خلط محیط (۴s) و دوبرابر (۲s)', () => {
  const spec = { op: 'area_square', side: 6 }; // ۳۶
  assert.equal(classifyGeometryW8(spec, 36), null);
  assert.equal(classifyGeometryW8(spec, 24), 'E_PERIMETER_AREA_CONFUSION');
  assert.equal(classifyGeometryW8(spec, 12), 'E_DOUBLING_HALVING');
});

test('W8/هندسه: تبدیل مرکب — جمع لخت، توان نادرست ده، چسباندن لخت', () => {
  // مورد برخورد: minor=۲۵ → چسباندن (۳۲۵) با ۳×۱۰۰+۲۵ هم‌ارزش است؛
  // زنجیرهٔ PRIORITY_W8 به‌طور قطعی E_UNIT_FACTOR_WRONG_POWER را برمی‌گزیند.
  const specA = { op: 'compound_to_minor', unit_pair: 'kg_g', major: 3, minor: 25 }; // ۳۰۲۵
  assert.equal(classifyGeometryW8(specA, 3025), null, 'درست');
  assert.equal(classifyGeometryW8(specA, 28), 'E_UNIT_RAW_SUM', '۳+۲۵');
  assert.equal(classifyGeometryW8(specA, 55), 'E_UNIT_FACTOR_WRONG_POWER', '۳×۱۰+۲۵');
  assert.equal(classifyGeometryW8(specA, 325), 'E_UNIT_FACTOR_WRONG_POWER', 'برخورد دو مکانیزم هم‌ارزش — قطعیت زنجیره');
  // مورد تفکیک‌پذیر: minor=۲۵۰ (سه‌رقمی، kg) — چسباندن لخت خودِ پاسخ درست را می‌سازد (۳|۲۵۰=۳۲۵۰)
  const specB = { op: 'compound_to_minor', unit_pair: 'kg_g', major: 3, minor: 250 }; // ۳۲۵۰
  assert.equal(classifyGeometryW8(specB, 3250), null, 'درست');
  assert.equal(classifyGeometryW8(specB, 325), null, 'بی‌الگو — چسباندن اینجا برابرِ درست می‌سازد');
  assert.equal(classifyGeometryW8(specB, 550), 'E_UNIT_FACTOR_WRONG_POWER', '۳×۱۰۰+۲۵۰');
  assert.equal(classifyGeometryW8(specB, 280), 'E_UNIT_FACTOR_WRONG_POWER', '۳×۱۰+۲۵۰');
});

test('W8/هندسه: ساعت ۱۲→۲۴ — بعدازظهر، +۱۰ به‌جای +۱۲، ±یک (حالت صحیح و HH:MM)', () => {
  const hm = { op: 'clock_to_24h', hour_12: 4, minute: 0, period: 'pm' }; // '16:00'
  assert.equal(classifyGeometryW8(hm, '16:00'), null, 'درست');
  assert.equal(classifyGeometryW8(hm, '04:00'), 'E_CLOCK_12_24_CONFUSION');
  assert.equal(classifyGeometryW8(hm, '14:00'), 'E_CLOCK_PLUS_10_ERROR');
  const hourOnly = { op: 'clock_to_24h', hour_12: 4, period: 'pm', hour_only: true }; // ۱۶
  assert.equal(classifyGeometryW8(hourOnly, 16), null);
  assert.equal(classifyGeometryW8(hourOnly, 4), 'E_CLOCK_12_24_CONFUSION');
  assert.equal(classifyGeometryW8(hourOnly, 14), 'E_CLOCK_PLUS_10_ERROR');
  assert.equal(classifyGeometryW8(hourOnly, 15), 'E_DOUBLE_OFF');
});

test('W8/هندسه: سپری‌شدهٔ ساعت — دقیقه بر پایهٔ ۱۰۰ و گره ازدست‌رفته', () => {
  const spec = { op: 'clock_elapsed', hour: 14, minute: 40, delta_minutes: 30 }; // '15:10'
  assert.equal(classifyGeometryW8(spec, '15:10'), null, 'درست');
  assert.equal(classifyGeometryW8(spec, '14:70'), 'E_CLOCK_BASE100_CARRY');
  assert.equal(classifyGeometryW8(spec, '14:10'), 'E_CARRY_MISS');
});

test('W8/هندسه: خط‌کش با شروع غیرصفر + محورهای تقارن', () => {
  const ruler = { op: 'ruler_offset', start: 3, end: 7 }; // ۴
  assert.equal(classifyGeometryW8(ruler, 4), null, 'درست');
  assert.equal(classifyGeometryW8(ruler, 7), 'E_RULER_NONZERO_START');
  assert.equal(classifyGeometryW8(ruler, 10), 'E_ADD_CONFUSION');
  assert.equal(classifyW8({ op: 'symmetry_axes', shape: 'square' }, 4), null, 'مربع=۴ درست');
  assert.equal(classifyW8({ op: 'symmetry_axes', shape: 'square' }, 2), 'E_SYM_AXIS_MISCOUNT');
  assert.equal(classifyW8({ op: 'symmetry_axes', shape: 'equilateral' }, 2), 'E_POLYGON_SIDE_CONFUSION', 'مثلث: ۲ در {۴،۲}');
});

// ── ۳) خانوادهٔ داده/احتمال ───────────────────────────────────────────────────

test('W8/داده: احتمال — بخش به بقیه، متمم، وارونه', () => {
  const spec = { op: 'probability', favorable: 3, total: 8 };
  assert.equal(classifyDataProbW8(spec, { frac: true, num: 3, den: 8 }), null, 'درست');
  assert.equal(classifyDataProbW8(spec, { frac: true, num: 3, den: 5 }), 'E_PROB_PART_TO_REST');
  assert.equal(classifyDataProbW8(spec, { frac: true, num: 5, den: 8 }), 'E_PROB_COMPLEMENT_CONFUSION');
  assert.equal(classifyDataProbW8(spec, { frac: true, num: 8, den: 3 }), 'E_PROB_NUM_DENOM_SWAP');
});

test('W8/داده: نمودار تصویری — نادیده‌گرفتن مقیاس، جمع‌آمیزی، نیم‌نماد کامل', () => {
  const spec = { op: 'pictograph_value', symbol_count: 4, scale_per_symbol: 6, half_symbol_count: 2 }; // ۳۰
  assert.equal(classifyDataProbW8(spec, 30), null, 'درست');
  assert.equal(classifyDataProbW8(spec, 6), 'E_SCALE_IGNORED', '۴+۲ نماد لخت');
  assert.equal(classifyDataProbW8(spec, 10), 'E_ADD_CONFUSION');
  assert.equal(classifyDataProbW8(spec, 36), 'E_HALF_SYMBOL_AS_FULL');
});

test('W8/داده: جدول دوطرفه — جابه‌جایی سطر/ستون، همسایه، توقف گام partial', () => {
  const cell = { op: 'table_query', rows: { الف: [2, 5], ب: [7, 1] }, row: 'الف', col_index: 0 }; // ۲
  assert.equal(classifyDataProbW8(cell, 2), null, 'درست');
  assert.equal(classifyDataProbW8(cell, 7), 'E_TABLE_ROW_COL_SWAP');
  assert.equal(classifyDataProbW8(cell, 5), 'E_TABLE_NEIGHBOUR');
  const rowSum = { op: 'table_query', rows: { الف: [2, 5], ب: [7, 1] }, row: 'الف', mode: 'row_sum' }; // ۷
  assert.equal(classifyDataProbW8(rowSum, 7), null, 'درست');
  assert.equal(classifyDataProbW8(rowSum, 8), 'E_TABLE_ROW_COL_SWAP', 'جمع سطر ب');
  assert.equal(classifyDataProbW8(rowSum, 2), 'E_PARTIAL_STEP_STOP', 'بدون ۵');
});

// ── ۴) خانوادهٔ تقسیم با هدف ──────────────────────────────────────────────────

test('W8/تقسیم: هدف خارج‌قسمت — جابه‌جایی باقیمانده، ریزش باقیمانده، عمل جایگزین', () => {
  const spec = { op: 'divide_qr', dividend: 19, divisor: 4, target: 'quotient' }; // ۴ باقی ۳
  assert.equal(classifyMultDivW8(spec, 4), null, 'درست');
  assert.equal(classifyMultDivW8(spec, 3), 'E_REMAINDER_QUOTIENT_SWAP');
  assert.equal(classifyMultDivW8(spec, 5), 'E_REMAINDER_DROP');
  assert.equal(classifyMultDivW8(spec, 23), 'E_OP_REVERSE', '۱۹+۴');
  assert.equal(classifyMultDivW8(spec, 76), 'E_OP_REVERSE', '۱۹×۴');
  // ۱۵÷۴: q=۳ r=۳ — پاسخ ۲ فقط با q−۱ می‌خواند (بدون برخورد با اندازهٔ گروه)
  assert.equal(
    classifyMultDivW8({ op: 'divide_qr', dividend: 15, divisor: 4, target: 'quotient' }, 2),
    'E_REMAINDER_GE_DIVISOR',
    'q−۱ — یک گروه کمتر'
  );
});

test('W8/تقسیم: هدف باقیمانده — وارونه، صفر، باقیماندهٔ ≥ مقسوم‌علیه', () => {
  const spec = { op: 'divide_qr', dividend: 19, divisor: 5, target: 'remainder' }; // ۳ باقی ۴
  assert.equal(classifyMultDivW8(spec, 4), null, 'درست');
  assert.equal(classifyMultDivW8(spec, 3), 'E_REMAINDER_QUOTIENT_SWAP', 'خارج‌قسمت به‌جای باقیمانده');
  assert.equal(classifyMultDivW8(spec, 0), 'E_REMAINDER_DROP');
  assert.equal(classifyMultDivW8(spec, 9), 'E_REMAINDER_GE_DIVISOR', '۴+۵ — یک گروه زودتر توقف');
});

test('W8/تقسیم: هدف جعبهٔ کامل (سقف) — floor به‌جای سقف', () => {
  const spec = { op: 'divide_qr', dividend: 19, divisor: 5, target: 'ceiling_containers' }; // ۴
  assert.equal(classifyMultDivW8(spec, 4), null, 'درست');
  assert.equal(classifyMultDivW8(spec, 3), 'E_REMAINDER_DROP', 'floor به‌جای سقف');
});

// ── ۵) خانوادهٔ عملیات عددی ───────────────────────────────────────────────────

test('W8/عددی: ارزش مکانی چندپایه — رقم لخت، حذف صفر، لغزش، وارونه‌نویسی، جمع ارقام', () => {
  const spec = { op: 'place_value', number: 809, place_power: 2 }; // ۸۰۰
  assert.equal(classifyNumberOpsW8(spec, 800), null, 'درست');
  assert.equal(classifyNumberOpsW8(spec, 8), 'E_UNIT_VALUE_CONFUSION');
  assert.equal(classifyNumberOpsW8(spec, 80), 'E_ZERO_PLACE_MISS');
  assert.equal(classifyNumberOpsW8(spec, 8000), 'E_PLACE_SHIFT');
  assert.equal(classifyNumberOpsW8(spec, 908), 'E_PLACE_SWAP');
  assert.equal(classifyNumberOpsW8(spec, 17), 'E_UNIT_VALUE_CONFUSION', '۸+۰+۹');
});

test('W8/عددی: جمع ستونی عمومی — تک‌گره، جایگاه نادرست گره، ریزش همزمان چندگره', () => {
  const spec = { op: 'column_add', operands: [358, 246] }; // ۶۰۴
  assert.equal(classifyNumberOpsW8(spec, 604), null, 'درست');
  assert.equal(classifyNumberOpsW8(spec, 594), 'E_CARRY_MISS', 'بدون گره');
  assert.equal(classifyNumberOpsW8(spec, 694), 'E_CARRY_WRONG_PLACE', '۶۰۴+۹۰');
  assert.equal(classifyNumberOpsW8(spec, 112), 'E_SUB_CONFUSION', '|۳۵۸−۲۴۶|');
  assert.equal(classifyNumberOpsW8(spec, 605), 'E_DOUBLE_OFF');
  const multi = { op: 'column_add', operands: [456, 387] }; // ۸۴۳
  assert.equal(classifyNumberOpsW8(multi, 733), 'E_CARRY_MISS', 'ریزش همزمان هر سه ستون');
  assert.equal(classifyNumberOpsW8(multi, 743), 'E_CARRY_MISS', 'ریزش گره صدگان');
});

test('W8/عددی: تفریق ستونی عمومی — قرض، کوچک‌ازبزرگ رقم‌به‌رقم، جمع‌آمیزی', () => {
  const spec = { op: 'column_sub', a: 412, b: 178 }; // ۲۳۴
  assert.equal(classifyNumberOpsW8(spec, 234), null, 'درست');
  assert.equal(classifyNumberOpsW8(spec, 334), 'E_BORROW_MISS', '۲۳۴+۱۰۰ (ستون دهگان)');
  assert.equal(classifyNumberOpsW8(spec, 244), 'E_BORROW_MISS', '۲۳۴+۱۰ (ستون یکان)');
  assert.equal(classifyNumberOpsW8(spec, 366), 'E_SMALLER_FROM_LARGER', '|۴−۱||۱−۷||۲−۸|');
  assert.equal(classifyNumberOpsW8(spec, 590), 'E_ADD_CONFUSION', '۴۱۲+۱۷۸');
});

test('W8/عددی: گردکردن — خودِ عدد، گردِ دیگر همان جایگاه، حذف رقم', () => {
  const spec = { op: 'round', number: 47, place_power: 1 }; // ۵۰ (نیم‌بالا)
  assert.equal(classifyNumberOpsW8(spec, 50), null, 'درست');
  assert.equal(classifyNumberOpsW8(spec, 47), 'E_APPROX_EXACT_CONFUSION');
  assert.equal(classifyNumberOpsW8(spec, 40), 'E_ROUND_NEAREST');
  assert.equal(classifyNumberOpsW8(spec, 5), 'E_ZERO_PLACE_MISS');
  const trunc = { op: 'round', number: 47, place_power: 1, mode: 'truncate' }; // ۴۰
  assert.equal(classifyNumberOpsW8(trunc, 40), null, 'truncate درست');
  assert.equal(classifyNumberOpsW8(trunc, 50), 'E_ROUND_NEAREST');
});

// ── ۶) دروازهٔ classifyAttempt (errors.js) — تعمیم W8 + حفظ رفتار گذشته ──────

test('W8/classifyAttempt: دامنهٔ گسترش‌یافته — عوامل ۶رقمی exact می‌مانند', () => {
  const big = { f1: 999999, f2: 999999, submitted: 999998000001 };
  assert.equal(classifyAttempt(big), null, 'حاصل دقیق بزرگ — درست');
  assert.equal(
    classifyAttempt({ ...big, submitted: 999998000001 + 999999 }),
    'E_SKIP_OVERCOUNT',
    'یک پرش اضافه در ابعاد بزرگ'
  );
  assert.equal(
    classifyAttempt({ f1: 12000, f2: 30, submitted: 36000 }),
    'E_PLACE_SHIFT',
    'یک‌دهمِ حاصل ۳۶۰۰۰۰'
  );
  assert.equal(
    classifyAttempt({ f1: 3, f2: 4, submitted: { frac: true, num: 3, den: 4 } }),
    null,
    'کسر به classifyAttempt ضربی هرگز وارد نمی‌شود — صادقانه بی‌الگو'
  );
  assert.equal(classifyAttempt({ f1: 1000000, f2: 2, submitted: 5 }), null, 'فراتر از دامنهٔ W8 — null');
});

test('W8/classifyAttempt: رفتار گذشته (۰..۹۹۹) ذره‌ای تغییر نکرده — نمونه‌های طلایی', () => {
  assert.equal(classifyAttempt({ f1: 5, f2: 3, submitted: 8 }), 'E_ADD_CONFUSION');
  assert.equal(classifyAttempt({ f1: 5, f2: 0, submitted: 5 }), 'E_ZERO_PROPERTY');
  assert.equal(classifyAttempt({ f1: 7, f2: 1, submitted: 1 }), 'E_IDENTITY_CONFUSION');
  assert.equal(classifyAttempt({ f1: 26, f2: 3, submitted: 78 }), null);
  assert.equal(classifyAttempt({ f1: 7, f2: 8, submitted: 35 }), 'E_ANCHOR_DRIFT');
  assert.equal(classifyAttempt({ f1: 2, f2: 13, submitted: 6 }), 'E_DISTRIBUTIVE_LEAK', 'فقط جزء یکی‌ها: ۲×۳');
  assert.equal(classifyAttempt({ f1: 5, f2: 4, submitted: 25 }), 'E_SKIP_OVERCOUNT');
  assert.equal(classifyAttempt({ f1: 5, f2: 4, submitted: 15 }), 'E_SKIP_UNDERCOUNT', '۵×۴→۱۵ (بدون برخورد با لنگر ۵)');
});

// ── ۷) دروازهٔ دیسپچر و متادیتا ───────────────────────────────────────────────

test('W8/دیسپچر: مسیریابی op و گاردهای بدشکل — هرگز استثنا نمی‌دهد', () => {
  assert.equal(classifyW8(null, 5), null);
  assert.equal(classifyW8({ op: 'unknown_op' }, 5), null);
  assert.equal(classifyW8({}, 5), null);
  assert.equal(classifyW8({ op: 'probability' }, 'ورودی بدشکل'), null);
  assert.equal(solveW8({ op: 'unknown_op' }), null);
  assert.equal(solveW8(null), null);
  // مسیریابی واقعی از طریق دیسپچر
  assert.equal(
    classifyW8({ op: 'frac_part_whole', shaded: 3, total: 8 }, { frac: true, num: 5, den: 8 }),
    'E_FRAC_COMPLEMENT'
  );
  assert.equal(classifyW8({ op: 'round', number: 47, place_power: 1 }, 40), 'E_ROUND_NEAREST');
});

test('W8/متادیتا: زنجیرهٔ اولویت یکتا و همهٔ کدها دارای جملهٔ تعریف', () => {
  assert.equal(new Set(PRIORITY_W8).size, PRIORITY_W8.length, 'کد تکراری در زنجیره ممنوع');
  for (const code of PRIORITY_W8) {
    assert.ok(CODES_W8[code] || code === 'E_ADD_CONFUSION' || code === 'E_PLACE_SHIFT'
      || code === 'E_ZERO_PLACE_MISS' || code === 'E_UNIT_VALUE_CONFUSION' || code === 'E_CARRY_MISS'
      || code === 'E_BORROW_MISS' || code === 'E_TABLE_NEIGHBOUR' || code === 'E_DOUBLING_HALVING'
      || code === 'E_ROUND_NEAREST' || code === 'E_APPROX_EXACT_CONFUSION' || code === 'E_OP_REVERSE'
      || code === 'E_GROUP_VS_COUNT' || code === 'E_REMAINDER_DROP',
      `کد ${code} نه در CODES_W8 است نه کد شناخته‌شدهٔ v10.2/v10.3`);
  }
  for (const [code, meta] of Object.entries(CODES_W8)) {
    assert.ok(meta.nameFa && meta.family && meta.severity, `${code}: متادیتای ناقص`);
    assert.ok(/^E_[A-Z0-9_]+$/.test(code), `${code}: قالب کد نامعتبر`);
  }
});
