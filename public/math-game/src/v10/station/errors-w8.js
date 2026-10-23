// ─────────────────────────────────────────────────────────────────────────────
// موتور تشخیص خطای W8 — پورت ۵ خانوادهٔ حل‌گر پایتونی آرنا (BP-007، سرشاخه:
// authoring/agent/solvers/{base,fractions,geometry_measure,data_prob,mult_div,number_ops}.py
// در شاخهٔ arena/0eb22280-math-game) — نسخهٔ ۱۰.۳ رشتهٔ B1
//
// این ماژول کاملاً افزودنی است: هیچ فایل موجودی تغییر نمی‌کند (به‌جز انجمادِ
// هدفمندِ گاردهای classifyAttempt در errors.js با تأیید مالک) و هیچ کدی به
// ERROR_CODES یا CODES_V103 اضافه نمی‌شود. کدهای تازهٔ W8 همه «پیشنهادی»اند و
// تا مُهر واقعی معلم وارد اطلس رسمی خشاب نمی‌شوند (قاعدهٔ BP-012).
//
// قرارداد خروجی هم‌قرارداد classifyAttempt/classifyV103 است:
//   خروجی = رشتهٔ کد یا null (پاسخ درست / بی‌الگو / بیرون قرارداد) — هرگز استثنا نمی‌دهد.
// داوری مقادیر کسری با حساب گویای exact روی BigInt است (صفر خطای شناور) —
// عین سیاست «fractions.Fraction» در مرجع پایتونی آرنا.
//
// مرز مسئولیت:
//   - ضرب خام → errors.js (classifyAttempt)
//   - خانوادهٔ ۲و۳ (جمع/تفریق/ضرب ستونی چهاررقمی، تقسیم، چهاررقمی) → errors-v103.js
//   - پنج خانوادهٔ W8 (کسر، هندسه/اندازه‌گیری، داده/احتمال، تقسیم با هدف
//     خارج‌قسمت/باقیمانده/سقف، عملیات عددی چندپایه) → همین ماژول
// جمع/تفریق ستونی W8 عمومی است (تا ۱۰ رقم) و classifier چهاررقمی v103 را
// جایگزین نمی‌کند — کارتریج‌های رسمی G2/G3 با opهای v103 سر جای خود می‌مانند.
//
// این ماژول Pure است: هیچ وابستگی به DOM، FS، صدا یا وضعیت بازی ندارد.
// ─────────────────────────────────────────────────────────────────────────────

import { OPTION_VALUE_MAX_ABS } from './cartridge-schema.js';

const isInt = n => Number.isInteger(n);
/** گارد دامنهٔ رسمی W8 — هر پارامتر عددی spec */
const inW8Range = n => isInt(n) && Math.abs(n) <= OPTION_VALUE_MAX_ABS;

// ── حساب گویای exact (معادل Fraction پایتون) ────────────────────────────────
const BI = v => BigInt(v);
const ratMake = (n, d) => {
  if (d === 0n) return null;
  if (d < 0n) { n = -n; d = -d; }
  const g = ratGcd(n < 0n ? -n : n, d) || 1n;
  return { n: n / g, d: d / g };
};
function ratGcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }
const ratEq = (a, b) => !!a && !!b && a.n === b.n && a.d === b.d;
const ratAdd = (a, b) => ratMake(a.n * b.d + b.n * a.d, a.d * b.d);
const ratSub = (a, b) => ratMake(a.n * b.d - b.n * a.d, a.d * b.d);
const ratMul = (a, b) => ratMake(a.n * b.n, a.d * b.d);
const ratFromInt = v => ({ n: BI(v), d: 1n });

/**
 * نرمال‌سازی «پاسخ‌داده‌شده» به گویای exact. پذیرفته:
 *   عدد صحیح | شیء کسر cartridge-schema ({frac:true,num,den}) | رشتهٔ «a/b» لاتین
 * بقیه → null (بیرون قرارداد — صادقانه بی‌الگو).
 */
function toRat(v) {
  if (isInt(v)) {
    if (!inW8Range(v)) return null;
    return ratFromInt(v);
  }
  if (v && typeof v === 'object' && v.frac === true && isInt(v.num) && isInt(v.den)) {
    if (Math.abs(v.num) > OPTION_VALUE_MAX_ABS || v.den > OPTION_VALUE_MAX_ABS) return null;
    return ratMake(BI(v.num), BI(v.den));
  }
  if (typeof v === 'string') {
    const m = /^(-?\d+)\/(\d+)$/.exec(v.trim());
    if (m && m[2] !== '0') return ratMake(BI(m[1]), BI(m[2]));
    if (/^-?\d+$/.test(v.trim())) {
      const n = Number(v.trim());
      return inW8Range(n) ? ratFromInt(n) : null;
    }
  }
  return null;
}

// ── اطلس کدهای W8 (همه «پیشنهادی» — پذیرش با مُهر معلم، قاعدهٔ BP-012) ───────
export const CODES_W8 = Object.freeze({
  // خانوادهٔ کسر (fractions.py)
  E_FRAC_NUM_DENOM_SWAP:      { nameFa: 'جابه‌جایی صورت و مخرج', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_PART_TO_UNSHADED:    { nameFa: 'بخش رنگ‌شده به‌جای رنگ‌نشده', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_COMPLEMENT:          { nameFa: 'متمم کسر به‌جای خود کسر', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_ADDITIVE_EQUIVALENCE:{ nameFa: 'هم‌ارزی جمعی به‌جای ضربی', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_UNCHANGED_NUMERATOR: { nameFa: 'صورت دست‌نخورده در هم‌ارزی', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_ADD_NUM_AND_DENOM:   { nameFa: 'جمع صورت‌ها و مخرج‌ها', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_DENOM_ORDER_INVERT:  { nameFa: 'وارونه‌گویی ترتیب مخرج در مقایسه', family: 'fractions', severity: 'مفهومی' },
  E_FRAC_UNIT_STEP_STOP:      { nameFa: 'توقف در گام واحدی کسر', family: 'fractions', severity: 'راهبردی' },
  // خانوادهٔ هندسه/اندازه‌گیری (geometry_measure.py)
  E_PERIMETER_AREA_CONFUSION: { nameFa: 'خلط محیط و مساحت', family: 'geometry', severity: 'مفهومی' },
  E_HALF_PERIMETER:           { nameFa: 'نیم‌محیط به‌جای محیط', family: 'geometry', severity: 'مفهومی' },
  E_INCOMPLETE_SIDES:         { nameFa: 'جا ماندن یک ضلع در محیط', family: 'geometry', severity: 'راهبردی' },
  E_UNIT_RAW_SUM:             { nameFa: 'جمع لخت واحدهای ناهم‌سنجه', family: 'geometry', severity: 'مفهومی' },
  E_UNIT_FACTOR_WRONG_POWER:  { nameFa: 'ضریب تبدیل با توان نادرست ده', family: 'geometry', severity: 'مفهومی' },
  E_CLOCK_12_24_CONFUSION:    { nameFa: 'خلط ساعت ۱۲ و ۲۴', family: 'geometry', severity: 'مفهومی' },
  E_CLOCK_PLUS_10_ERROR:      { nameFa: 'افزودن ۱۰ به‌جای ۱۲ در ساعت', family: 'geometry', severity: 'محاسباتی' },
  E_CLOCK_BASE100_CARRY:      { nameFa: 'دقیقه بر پایهٔ ۱۰۰ به‌جای ۶۰', family: 'geometry', severity: 'مفهومی' },
  E_RULER_NONZERO_START:      { nameFa: 'فراموشی شروع غیرصفر خط‌کش', family: 'geometry', severity: 'مفهومی' },
  E_SYM_AXIS_MISCOUNT:        { nameFa: 'شمارش نادرست محور تقارن', family: 'geometry', severity: 'مفهومی' },
  E_POLYGON_SIDE_CONFUSION:   { nameFa: 'خلط تعداد ضلع و محور تقارن', family: 'geometry', severity: 'مفهومی' },
  // خانوادهٔ داده/احتمال (data_prob.py)
  E_PROB_PART_TO_REST:        { nameFa: 'نسبت بخش به بقیه به‌جای بخش به کل', family: 'data_prob', severity: 'مفهومی' },
  E_PROB_COMPLEMENT_CONFUSION:{ nameFa: 'احتمال متمم به‌جای احتمال اصلی', family: 'data_prob', severity: 'مفهومی' },
  E_PROB_NUM_DENOM_SWAP:      { nameFa: 'وارونه‌گیری احتمال', family: 'data_prob', severity: 'مفهومی' },
  E_SCALE_IGNORED:            { nameFa: 'بی‌توجهی به مقیاس نمودار', family: 'data_prob', severity: 'مفهومی' },
  E_HALF_SYMBOL_AS_FULL:      { nameFa: 'شمارش نیم‌نماد به‌جانماد کامل', family: 'data_prob', severity: 'محاسباتی' },
  E_TABLE_ROW_COL_SWAP:       { nameFa: 'جابه‌جایی سطر و ستون جدول', family: 'data_prob', severity: 'توجهی' },
  E_PARTIAL_STEP_STOP:        { nameFa: 'توقف یک گام پیش از پایان جمع', family: 'data_prob', severity: 'راهبردی' },
  // خانوادهٔ تقسیم با هدف (mult_div.py)
  E_REMAINDER_QUOTIENT_SWAP:  { nameFa: 'جابه‌جایی باقیمانده و خارج‌قسمت', family: 'mult_div', severity: 'مفهومی' },
  E_REMAINDER_GE_DIVISOR:     { nameFa: 'باقیماندهٔ بزرگ‌تر از مقسوم‌علیه', family: 'mult_div', severity: 'مفهومی' },
  // خانوادهٔ عملیات عددی (number_ops.py)
  E_PLACE_SWAP:               { nameFa: 'وارونه‌نویسی رقم‌های عدد', family: 'number_ops', severity: 'توجهی' },
  E_SMALLER_FROM_LARGER:      { nameFa: 'کوچک‌تر از بزرگ‌تر رقم‌به‌رقم', family: 'number_ops', severity: 'مفهومی' },
  E_CARRY_WRONG_PLACE:        { nameFa: 'گره در جایگاه نادرست', family: 'number_ops', severity: 'محاسباتی' },
  E_SUB_CONFUSION:            { nameFa: 'تفریق به‌جای عمل دیگر', family: 'number_ops', severity: 'راهبردی' },
  E_DOUBLE_OFF:               { nameFa: 'خطای ±یک (لغزش شمارش)', family: 'number_ops', severity: 'محاسباتی' }
});

// زنجیرهٔ برچسب‌گذاری W8 — اولین الگوی زنده برنده است (سبک PRIORITY_V103).
// کدهای مشترک با v10.2/v10.3 (E_ADD_CONFUSION، E_PLACE_SHIFT، E_ZERO_PLACE_MISS،
// E_UNIT_VALUE_CONFUSION، E_CARRY_MISS، E_BORROW_MISS، E_TABLE_NEIGHBOUR،
// E_DOUBLING_HALVING، E_ROUND_NEAREST، E_APPROX_EXACT_CONFUSION) اینجا هم
// مجازند — ماژول W8 هرگز برای ضرب خام فراخوانی نمی‌شود تا با errors.js تداخل نکند.
export const PRIORITY_W8 = Object.freeze([
  // کسر — مفهومی‌ها اول
  'E_FRAC_NUM_DENOM_SWAP', 'E_FRAC_PART_TO_UNSHADED', 'E_FRAC_COMPLEMENT',
  'E_FRAC_ADDITIVE_EQUIVALENCE', 'E_FRAC_UNCHANGED_NUMERATOR', 'E_FRAC_ADD_NUM_AND_DENOM',
  'E_FRAC_DENOM_ORDER_INVERT', 'E_FRAC_UNIT_STEP_STOP',
  // هندسه/اندازه‌گیری
  'E_PERIMETER_AREA_CONFUSION', 'E_HALF_PERIMETER', 'E_INCOMPLETE_SIDES',
  'E_UNIT_RAW_SUM', 'E_UNIT_FACTOR_WRONG_POWER',
  'E_CLOCK_12_24_CONFUSION', 'E_CLOCK_PLUS_10_ERROR', 'E_CLOCK_BASE100_CARRY',
  'E_RULER_NONZERO_START', 'E_SYM_AXIS_MISCOUNT', 'E_POLYGON_SIDE_CONFUSION',
  // داده/احتمال
  'E_PROB_PART_TO_REST', 'E_PROB_COMPLEMENT_CONFUSION', 'E_PROB_NUM_DENOM_SWAP',
  'E_SCALE_IGNORED', 'E_HALF_SYMBOL_AS_FULL', 'E_TABLE_ROW_COL_SWAP', 'E_PARTIAL_STEP_STOP',
  // تقسیم با هدف
  'E_OP_REVERSE', 'E_GROUP_VS_COUNT', 'E_REMAINDER_QUOTIENT_SWAP', 'E_REMAINDER_GE_DIVISOR', 'E_REMAINDER_DROP',
  // عملیات عددی
  'E_PLACE_SWAP', 'E_SMALLER_FROM_LARGER', 'E_CARRY_MISS', 'E_CARRY_WRONG_PLACE',
  'E_BORROW_MISS', 'E_ZERO_PLACE_MISS', 'E_UNIT_VALUE_CONFUSION', 'E_PLACE_SHIFT',
  'E_TABLE_NEIGHBOUR', 'E_DOUBLING_HALVING', 'E_ROUND_NEAREST', 'E_APPROX_EXACT_CONFUSION',
  // کدهای راهبردی مشترک — انتهای زنجیره
  'E_SUB_CONFUSION', 'E_ADD_CONFUSION', 'E_DOUBLE_OFF'
]);

/** اولین کدِ زنده در زنجیرهٔ PRIORITY_W8 — بین کاندیدهای همزمان */
function pickByPriorityW8(candidates) {
  for (const code of PRIORITY_W8) {
    if (candidates.includes(code)) return code;
  }
  return null;
}

// ── حل‌گرهای exact (برای بازحساب کلید پاسخ در مبدل — معادل solve پایتون) ────

/** کسرها: f پارامترها [صورت، مخرج] یا گویای داخلی */
function toRatSpec(f) {
  if (Array.isArray(f) && f.length === 2 && isInt(f[0]) && isInt(f[1]) && f[1] !== 0) {
    return ratMake(BI(f[0]), BI(f[1]));
  }
  if (f && typeof f === 'object' && f.frac === true) return ratMake(BI(f.num), BI(f.den));
  return null;
}

export function solveFracW8(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const { op } = spec;
  const g = (v) => { const r = toRatSpec(v); return (r && r.d <= BigInt(OPTION_VALUE_MAX_ABS)) ? r : null; };
  switch (op) {
    case 'frac_part_whole': {
      const { shaded, total } = spec;
      if (!inW8Range(shaded) || !inW8Range(total) || total <= 0 || shaded < 0 || shaded > total) return null;
      return ratMake(BI(shaded), BI(total));
    }
    case 'frac_equiv_num': {
      const { num, den, target_den } = spec;
      if (!inW8Range(num) || !inW8Range(den) || !inW8Range(target_den) || den <= 0 || target_den <= 0) return null;
      const val = ratMul(ratMake(BI(num), BI(den)), ratFromInt(target_den));
      return (val && val.d === 1n) ? val : null; // هم‌ارزی باید صحیح بماند
    }
    case 'frac_add':
    case 'frac_sub': {
      const f1 = g(spec.f1), f2 = g(spec.f2);
      if (!f1 || !f2) return null;
      const res = op === 'frac_add' ? ratAdd(f1, f2) : ratSub(f1, f2);
      return (res && res.n >= 0n) ? res : null; // تفریق منفی در ابتدایی — بیرون قرارداد
    }
    case 'frac_compare': {
      const f1 = g(spec.f1), f2 = g(spec.f2);
      if (!f1 || !f2) return null;
      const want = spec.want === 'smaller' ? 'smaller' : 'larger';
      const cmp = f1.n * f2.d - f2.n * f1.d;
      return cmp > 0n ? (want === 'larger' ? f1 : f2) : (want === 'larger' ? f2 : f1);
    }
    case 'frac_of_quantity': {
      const f = g(spec.fraction);
      if (!f || !inW8Range(spec.quantity) || spec.quantity < 0) return null;
      const res = ratMul(f, ratFromInt(spec.quantity));
      return res; // صحیح یا کسر — هر دو دقیق
    }
    default:
      return null;
  }
}

const W8_UNIT_FACTORS = Object.freeze({ km_m: 1000, kg_g: 1000, L_mL: 1000, m_cm: 100, cm_mm: 10 });

export function solveGeometryW8(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const { op } = spec;
  const ok = (...vs) => vs.every(inW8Range);
  switch (op) {
    case 'perimeter_rect':  return ok(spec.width, spec.height) && spec.width >= 0 && spec.height >= 0 ? 2 * (spec.width + spec.height) : null;
    case 'perimeter_square':return ok(spec.side) && spec.side >= 0 ? 4 * spec.side : null;
    case 'perimeter_polygon':return Array.isArray(spec.sides) && spec.sides.length > 0 && spec.sides.every(s => inW8Range(s) && s >= 0) ? spec.sides.reduce((a, b) => a + b, 0) : null;
    case 'area_rect':       return ok(spec.width, spec.height) && spec.width >= 0 && spec.height >= 0 ? spec.width * spec.height : null;
    case 'area_square':     return ok(spec.side) && spec.side >= 0 ? spec.side * spec.side : null;
    case 'compound_to_minor': {
      const f = W8_UNIT_FACTORS[spec.unit_pair];
      if (!f || !ok(spec.major) || spec.major < 0) return null;
      const minor = spec.minor ?? 0;
      if (!inW8Range(minor) || minor < 0) return null; // مرجع پایتونی: بدون سقفِ جزئی — سقف فقط بازهٔ W8
      return spec.major * f + minor;
    }
    case 'clock_to_24h': {
      const h = spec.hour_12, m = spec.minute ?? 0;
      if (!ok(h, m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
      const period = spec.period === 'am' ? 'am' : 'pm';
      const h24 = period === 'pm' ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
      if (spec.hour_only === true) return h24;
      return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    case 'clock_elapsed': {
      const { hour, delta_minutes } = spec;
      const minute = spec.minute ?? 0;
      if (!ok(hour, minute, delta_minutes) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
      const total = hour * 60 + minute + delta_minutes;
      const hOut = (Math.floor(total / 60) % 24 + 24) % 24;
      const mOut = ((total % 60) + 60) % 60;
      return `${String(hOut).padStart(2, '0')}:${String(mOut).padStart(2, '0')}`;
    }
    case 'ruler_offset': {
      if (!ok(spec.start, spec.end)) return null;
      const a = Math.min(spec.start, spec.end), b = Math.max(spec.start, spec.end);
      return b - a;
    }
    case 'symmetry_axes': {
      const axes = { square: 4, rectangle: 2, equilateral: 3 };
      return axes[spec.shape] ?? null;
    }
    default:
      return null;
  }
}

export function solveDataProbW8(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const { op } = spec;
  switch (op) {
    case 'probability': {
      const { favorable, total } = spec;
      if (!inW8Range(favorable) || !inW8Range(total) || total <= 0 || favorable < 0 || favorable > total) return null;
      return ratMake(BI(favorable), BI(total));
    }
    case 'pictograph_value': {
      const { symbol_count, scale_per_symbol } = spec;
      const half = spec.half_symbol_count ?? 0;
      if (!inW8Range(symbol_count) || !inW8Range(scale_per_symbol) || !inW8Range(half)) return null;
      if (symbol_count < 0 || scale_per_symbol <= 0 || half < 0) return null;
      if (half > 0 && scale_per_symbol % 2 !== 0) return null; // نیم‌نماد با مقیاس فرد — بیرون قرارداد
      return symbol_count * scale_per_symbol + half * Math.floor(scale_per_symbol / 2);
    }
    case 'table_query': {
      const rows = spec.rows;
      if (!rows || typeof rows !== 'object' || typeof spec.row !== 'string') return null;
      const vals = rows[spec.row];
      if (!Array.isArray(vals) || !vals.every(v => inW8Range(v))) return null;
      if (spec.mode === 'row_sum') return vals.reduce((a, b) => a + b, 0);
      if (!inW8Range(spec.col_index) || spec.col_index < 0 || spec.col_index >= vals.length) return null;
      return vals[spec.col_index];
    }
    default:
      return null;
  }
}

export function solveMultDivW8(spec) {
  if (!spec || typeof spec !== 'object') return null;
  if (spec.op !== 'divide_qr') return null;
  const { dividend, divisor } = spec;
  if (!inW8Range(dividend) || !inW8Range(divisor) || dividend < 0 || divisor <= 0) return null;
  const q = Math.floor(dividend / divisor);
  const r = dividend - q * divisor;
  const target = spec.target === 'remainder' ? 'remainder'
    : spec.target === 'ceiling_containers' ? 'ceiling_containers' : 'quotient';
  if (target === 'remainder') return r;
  if (target === 'ceiling_containers') return q + (r > 0 ? 1 : 0);
  return q;
}

export function solveNumberOpsW8(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const { op } = spec;
  const digitsOf = n => String(Math.abs(n)).split('').map(Number);
  switch (op) {
    case 'place_value': {
      const { number, place_power } = spec;
      if (!inW8Range(number) || !isInt(place_power) || place_power < 0 || place_power > 9) return null;
      const digit = Math.floor(Math.abs(number) / 10 ** place_power) % 10;
      return spec.digit_only === true ? digit : digit * 10 ** place_power;
    }
    case 'column_add': {
      if (!Array.isArray(spec.operands) || spec.operands.length !== 2) return null;
      const [a, b] = spec.operands;
      if (!inW8Range(a) || !inW8Range(b) || a < 0 || b < 0) return null;
      return a + b;
    }
    case 'column_sub': {
      const { a, b } = spec;
      if (!inW8Range(a) || !inW8Range(b) || a < b) return null; // قرارداد: a≥b
      return a - b;
    }
    case 'round': {
      const n = spec.number;
      const power = spec.place_power ?? 1;
      if (!inW8Range(n) || !isInt(power) || power < 1 || power > 9) return null;
      const unit = 10 ** power;
      const base = Math.floor(Math.abs(n) / unit) * unit;
      const rem = Math.abs(n) - base;
      const mode = spec.mode === 'truncate' ? 'truncate' : 'half_up';
      const rounded = mode === 'truncate' ? base : (rem * 2 >= unit ? base + unit : base);
      return n < 0 ? -rounded : rounded;
    }
    case 'digit_reverse': { // کمکی برای E_PLACE_SWAP
      if (!inW8Range(spec.number)) return null;
      const s = String(Math.abs(spec.number));
      return Number(s.split('').reverse().join(''));
    }
    case 'digit_sum': {
      if (!inW8Range(spec.number)) return null;
      return digitsOf(spec.number).reduce((a, b) => a + b, 0);
    }
    default:
      return null;
  }
}

/** دیسپچر حل‌گر W8 — معادل solve_with_plugins (فقط مسیر ساختاریافته، بدون پارس NL) */
export function solveW8(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const { op } = spec;
  if (op.startsWith('frac_')) return solveFracW8(spec);
  if (['perimeter_rect', 'perimeter_square', 'perimeter_polygon', 'area_rect', 'area_square',
       'compound_to_minor', 'clock_to_24h', 'clock_elapsed', 'ruler_offset', 'symmetry_axes'].includes(op)) {
    return solveGeometryW8(spec);
  }
  if (['probability', 'pictograph_value', 'table_query'].includes(op)) return solveDataProbW8(spec);
  if (op === 'divide_qr') return solveMultDivW8(spec);
  if (['place_value', 'column_add', 'column_sub', 'round'].includes(op)) return solveNumberOpsW8(spec);
  return null;
}

// ── آشکارسازهای علّی (معادل generate_causal_distractors وارونه‌شده) ──────────
// الگو: گارد spec → حل exact → کاندیدهای [کد، مقدار] به ترتیب مرجع پایتونی →
// تطبیق دقیق با submitted → انتخاب با PRIORITY_W8 → کد | null.

function candidatesHit(cands, submittedRat) {
  if (!submittedRat) return [];
  return cands.filter(([, val]) => ratEq(val, submittedRat)).map(([code]) => code);
}

/** خانوادهٔ کسر — ops: frac_part_whole | frac_equiv_num | frac_add | frac_sub | frac_compare | frac_of_quantity */
export function classifyFracW8(spec, submitted) {
  const sub = toRat(submitted);
  if (!sub) return null;
  const { op } = spec;
  const cands = [];

  if (op === 'frac_part_whole') {
    const truth = solveFracW8(spec);
    if (!truth) return null;
    if (ratEq(sub, truth)) return null; // درست — خطا نیست
    const sh = BI(spec.shaded), tot = BI(spec.total);
    if (sh > 0n) cands.push(['E_FRAC_NUM_DENOM_SWAP', ratMake(tot, sh)]);
    if (tot - sh > 0n) {
      cands.push(['E_FRAC_PART_TO_UNSHADED', ratMake(sh, tot - sh)]);
      cands.push(['E_FRAC_COMPLEMENT', ratMake(tot - sh, tot)]);
    }
    if (tot > 1n) {
      cands.push(['E_DOUBLE_OFF', ratMake(sh, tot - 1n)]);
      cands.push(['E_DOUBLE_OFF', ratMake(sh, tot + 1n)]);
    }
  } else if (op === 'frac_equiv_num') {
    const truth = solveFracW8(spec);
    if (!truth) return null;
    if (ratEq(sub, truth)) return null;
    const { num, den, target_den } = spec;
    const additive = num + (target_den - den); // خطای کلاسیک: مقیاس جمعی به‌جای ضربی
    if (additive >= 0) cands.push(['E_FRAC_ADDITIVE_EQUIVALENCE', ratFromInt(additive)]);
    cands.push(['E_FRAC_UNCHANGED_NUMERATOR', ratFromInt(num)]);
    cands.push(['E_FRAC_NUM_DENOM_SWAP', ratFromInt(target_den)]);
  } else if (op === 'frac_add' || op === 'frac_sub') {
    const truth = solveFracW8(spec);
    if (!truth) return null;
    if (ratEq(sub, truth)) return null;
    const f1 = toRatSpec(spec.f1), f2 = toRatSpec(spec.f2);
    if (!f1 || !f2) return null;
    if (op === 'frac_add') {
      cands.push(['E_FRAC_ADD_NUM_AND_DENOM', ratMake(f1.n + f2.n, f1.d + f2.d)]);
      if (f1.n >= f2.n) {
        const dNew = f1.d === f2.d ? f1.d : f1.d * f2.d;
        cands.push(['E_SUB_CONFUSION', ratMake(f1.n - f2.n, dNew)]);
      }
    } else {
      cands.push(['E_ADD_CONFUSION', ratAdd(f1, f2)]);
      if (f1.d !== f2.d && f1.n >= f2.n) {
        cands.push(['E_FRAC_ADD_NUM_AND_DENOM', ratMake(f1.n - f2.n, f1.d > f2.d ? f1.d - f2.d : f2.d - f1.d)]);
      }
    }
  } else if (op === 'frac_compare') {
    const truth = solveFracW8(spec);
    if (!truth) return null;
    if (ratEq(sub, truth)) return null;
    const f1 = toRatSpec(spec.f1), f2 = toRatSpec(spec.f2);
    if (!f1 || !f2) return null;
    const other = ratEq(truth, f1) ? f2 : f1; // خطای کلاسیک ۱/۵ > ۱/۳ چون ۵ > ۳
    cands.push(['E_FRAC_DENOM_ORDER_INVERT', other]);
  } else if (op === 'frac_of_quantity') {
    const truth = solveFracW8(spec);
    if (!truth) return null;
    if (ratEq(sub, truth)) return null;
    const f = toRatSpec(spec.fraction);
    const qty = spec.quantity;
    if (!f || !inW8Range(qty)) return null;
    if (f.n > 0n) cands.push(['E_FRAC_NUM_DENOM_SWAP', ratMake(BI(qty) * f.d, f.n)]);
    if (f.n > 1n && qty % Number(f.d) === 0) cands.push(['E_FRAC_UNIT_STEP_STOP', ratFromInt(Math.floor(qty / Number(f.d)))]);
    cands.push(['E_ADD_CONFUSION', ratFromInt(qty + Number(f.n))]);
    if (qty >= Number(f.d)) cands.push(['E_SUB_CONFUSION', ratFromInt(qty - Number(f.d))]);
  } else {
    return null;
  }
  return pickByPriorityW8(candidatesHit(cands, sub));
}

/** خانوادهٔ هندسه/اندازه‌گیری */
export function classifyGeometryW8(spec, submitted) {
  const { op } = spec;
  const truth = solveGeometryW8(spec);
  if (truth === null || truth === undefined) return null;
  if (typeof truth === 'string') {
    // مسیر ساعت — مقایسهٔ رشته‌ای 'HH:MM' (ارقام لاتین/فارسی)
    const norm = s => String(s ?? '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
    if (norm(submitted) === truth) return null;
    if (op === 'clock_to_24h') {
      const h = spec.hour_12, m = spec.minute ?? 0;
      const hm = (x) => `${String(x).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (norm(submitted) === hm(h)) return 'E_CLOCK_12_24_CONFUSION';
      if (norm(submitted) === hm(h + 10)) return 'E_CLOCK_PLUS_10_ERROR';
    }
    if (op === 'clock_elapsed') {
      const m0 = spec.minute ?? 0, dm = spec.delta_minutes;
      if (m0 + dm >= 60) {
        if (norm(submitted) === `${String(spec.hour).padStart(2, '0')}:${String((m0 + dm) % 100).padStart(2, '0')}`) return 'E_CLOCK_BASE100_CARRY';
        if (norm(submitted) === `${String(spec.hour).padStart(2, '0')}:${String(m0 + dm - 60).padStart(2, '0')}`) return 'E_CARRY_MISS';
      }
    }
    return null;
  }
  const sub = toRat(submitted);
  if (!sub || sub.d !== 1n) return null;
  const s = Number(sub.n);
  if (s === truth) return null; // درست — خطا نیست
  const cands = [];
  const push = (code, val) => { if (isInt(val)) cands.push([code, ratFromInt(val)]); };

  if (op === 'perimeter_rect') {
    push('E_PERIMETER_AREA_CONFUSION', spec.width * spec.height);
    push('E_HALF_PERIMETER', spec.width + spec.height);
    push('E_INCOMPLETE_SIDES', 2 * spec.width + spec.height);
    push('E_INCOMPLETE_SIDES', spec.width + 2 * spec.height);
  } else if (op === 'perimeter_square') {
    push('E_PERIMETER_AREA_CONFUSION', spec.side * spec.side);
    push('E_HALF_PERIMETER', 2 * spec.side);
    push('E_ADD_CONFUSION', spec.side + 4);
  } else if (op === 'perimeter_polygon') {
    // مرجع پایتونی برای چندضلعی آشکارساز علّی ندارد — صادقانه بی‌الگو
  } else if (op === 'area_rect') {
    push('E_PERIMETER_AREA_CONFUSION', 2 * (spec.width + spec.height));
    push('E_ADD_CONFUSION', spec.width + spec.height);
  } else if (op === 'area_square') {
    push('E_PERIMETER_AREA_CONFUSION', 4 * spec.side);
    push('E_DOUBLING_HALVING', 2 * spec.side);
  } else if (op === 'compound_to_minor') {
    const f = W8_UNIT_FACTORS[spec.unit_pair];
    const minor = spec.minor ?? 0;
    push('E_UNIT_RAW_SUM', spec.major + minor);
    for (const wf of [10, 100, 1000]) {
      if (wf !== f) push('E_UNIT_FACTOR_WRONG_POWER', spec.major * wf + minor);
    }
    if (minor > 0) {
      const glued = Number(String(spec.major) + String(minor)); // چسباندن لخت دو جزء
      push('E_ZERO_PLACE_MISS', glued);
    }
  } else if (op === 'clock_to_24h') {
    const h = spec.hour_12;
    push('E_CLOCK_12_24_CONFUSION', h);
    push('E_CLOCK_PLUS_10_ERROR', h + 10);
    push('E_DOUBLE_OFF', truth - 1);
    push('E_DOUBLE_OFF', truth + 1);
  } else if (op === 'ruler_offset') {
    push('E_RULER_NONZERO_START', Math.max(spec.start, spec.end));
    push('E_ADD_CONFUSION', spec.start + spec.end);
    push('E_DOUBLE_OFF', truth + 1);
    push('E_DOUBLE_OFF', truth - 1);
  } else if (op === 'symmetry_axes') {
    push('E_SYM_AXIS_MISCOUNT', Math.floor(truth / 2));
    push('E_SYM_AXIS_MISCOUNT', truth * 2);
    if (s === 4 || s === 2) push('E_POLYGON_SIDE_CONFUSION', s);
    push('E_DOUBLE_OFF', truth + 1);
    push('E_DOUBLE_OFF', truth - 1);
  }
  return pickByPriorityW8(candidatesHit(cands, sub));
}

/** خانوادهٔ داده/احتمال */
export function classifyDataProbW8(spec, submitted) {
  const sub = toRat(submitted);
  if (!sub) return null;
  const { op } = spec;
  const truth = solveDataProbW8(spec);
  if (truth === null) return null;
  const truthRat = typeof truth === 'object' ? truth : ratFromInt(truth);
  if (ratEq(sub, truthRat)) return null;
  const cands = [];

  if (op === 'probability') {
    const fav = BI(spec.favorable), tot = BI(spec.total);
    const rest = tot - fav;
    if (rest > 0n) cands.push(['E_PROB_PART_TO_REST', ratMake(fav, rest)]);
    cands.push(['E_PROB_COMPLEMENT_CONFUSION', ratMake(rest, tot)]);
    if (fav > 0n) cands.push(['E_PROB_NUM_DENOM_SWAP', ratMake(tot, fav)]);
  } else if (op === 'pictograph_value') {
    const sym = spec.symbol_count, sc = spec.scale_per_symbol;
    const half = spec.half_symbol_count ?? 0;
    cands.push(['E_SCALE_IGNORED', ratFromInt(sym + half)]);
    cands.push(['E_ADD_CONFUSION', ratFromInt(sym + sc)]);
    if (half > 0) cands.push(['E_HALF_SYMBOL_AS_FULL', ratFromInt((sym + half) * sc)]);
  } else if (op === 'table_query') {
    const rows = spec.rows;
    const vals = rows?.[spec.row];
    if (!Array.isArray(vals)) return null;
    if (spec.mode === 'row_sum') {
      for (const [k, other] of Object.entries(rows)) {
        if (k !== spec.row && Array.isArray(other)) cands.push(['E_TABLE_ROW_COL_SWAP', ratFromInt(other.reduce((a, b) => a + b, 0))]);
      }
      if (vals.length >= 2) cands.push(['E_PARTIAL_STEP_STOP', ratFromInt(vals.slice(0, -1).reduce((a, b) => a + b, 0))]);
    } else {
      const col = spec.col_index;
      for (const [k, other] of Object.entries(rows)) {
        if (k !== spec.row && Array.isArray(other) && col < other.length) cands.push(['E_TABLE_ROW_COL_SWAP', ratFromInt(other[col])]);
      }
      vals.forEach((v, j) => { if (j !== col) cands.push(['E_TABLE_NEIGHBOUR', ratFromInt(v)]); });
    }
  }
  return pickByPriorityW8(candidatesHit(cands, sub));
}

/** خانوادهٔ تقسیم با هدف (خارج‌قسمت/باقیمانده/جعبهٔ کامل) */
export function classifyMultDivW8(spec, submitted) {
  const sub = toRat(submitted);
  if (!sub || sub.d !== 1n) return null;
  const s = Number(sub.n);
  const truth = solveMultDivW8(spec);
  if (truth === null) return null;
  if (s === truth) return null;
  const { dividend, divisor } = spec;
  const q = Math.floor(dividend / divisor);
  const r = dividend - q * divisor;
  const target = spec.target === 'remainder' ? 'remainder'
    : spec.target === 'ceiling_containers' ? 'ceiling_containers' : 'quotient';
  const cands = [];
  const push = (code, val) => { if (isInt(val) && val >= 0) cands.push([code, ratFromInt(val)]); };

  push('E_OP_REVERSE', Math.abs(dividend - divisor));
  push('E_OP_REVERSE', dividend + divisor);
  push('E_OP_REVERSE', dividend * divisor);
  push('E_GROUP_VS_COUNT', divisor);
  if (target === 'quotient') {
    push('E_REMAINDER_QUOTIENT_SWAP', r);
    push('E_REMAINDER_DROP', q + 1);
    if (q > 0) push('E_REMAINDER_GE_DIVISOR', q - 1);
    push('E_DOUBLE_OFF', q + 1);
    if (q > 0) push('E_DOUBLE_OFF', q - 1);
  } else if (target === 'remainder') {
    push('E_REMAINDER_QUOTIENT_SWAP', q);
    push('E_REMAINDER_DROP', 0);
    push('E_REMAINDER_GE_DIVISOR', r + divisor); // یک گروه زودتر توقف
    push('E_DOUBLE_OFF', r + 1);
    if (r > 0) push('E_DOUBLE_OFF', r - 1);
  } else {
    push('E_REMAINDER_DROP', q);
    push('E_REMAINDER_QUOTIENT_SWAP', r);
  }
  return pickByPriorityW8(candidatesHit(cands, sub));
}

/** خانوادهٔ عملیات عددی — جمع/تفریق ستونی عمومی (تا ۱۰ رقم)، ارزش مکانی، گردکردن */
export function classifyNumberOpsW8(spec, submitted) {
  const sub = toRat(submitted);
  if (!sub || sub.d !== 1n) return null;
  const s = Number(sub.n);
  const { op } = spec;
  const truth = solveNumberOpsW8(spec);
  if (truth === null) return null;
  if (s === truth) return null;
  const cands = [];
  const push = (code, val) => { if (isInt(val) && val >= 0) cands.push([code, ratFromInt(val)]); };

  if (op === 'place_value') {
    const digit = Math.floor(Math.abs(spec.number) / 10 ** spec.place_power) % 10;
    const p = spec.place_power;
    push('E_UNIT_VALUE_CONFUSION', digit);
    if (p > 0) push('E_ZERO_PLACE_MISS', digit * 10 ** (p - 1));
    push('E_PLACE_SHIFT', digit * 10 ** (p + 1));
    const rev = solveNumberOpsW8({ op: 'digit_reverse', number: spec.number });
    if (rev !== null) push('E_PLACE_SWAP', rev);
    const dsum = solveNumberOpsW8({ op: 'digit_sum', number: spec.number });
    if (dsum !== null) push('E_UNIT_VALUE_CONFUSION', dsum);
  } else if (op === 'column_add') {
    const [a, b] = spec.operands;
    push('E_SUB_CONFUSION', Math.abs(a - b));
    const maxLen = Math.max(String(a).length, String(b).length);
    let noCarry = 0;
    let anyCarry = false;
    for (let col = 0; col < maxLen; col++) {
      const da = Math.floor(a / 10 ** col) % 10;
      const db = Math.floor(b / 10 ** col) % 10;
      if (da + db >= 10) {
        anyCarry = true;
        push('E_CARRY_MISS', truth - 10 ** (col + 1));
        push('E_CARRY_WRONG_PLACE', truth + 9 * 10 ** (col + 1));
      }
      noCarry += ((da + db) % 10) * 10 ** col;
    }
    if (anyCarry) push('E_CARRY_MISS', noCarry); // ریزش همزمان همهٔ گره‌ها
    push('E_DOUBLE_OFF', truth + 1);
    push('E_DOUBLE_OFF', truth - 1);
  } else if (op === 'column_sub') {
    const { a, b } = spec;
    push('E_ADD_CONFUSION', a + b);
    const maxLen = Math.max(String(a).length, String(b).length);
    let sfl = 0;
    for (let col = 0; col < maxLen; col++) {
      const da = Math.floor(a / 10 ** col) % 10;
      const db = Math.floor(b / 10 ** col) % 10;
      sfl += Math.abs(da - db) * 10 ** col;
      if (da < db) push('E_BORROW_MISS', truth + 10 ** (col + 1));
    }
    push('E_SMALLER_FROM_LARGER', sfl);
    push('E_DOUBLE_OFF', truth + 1);
    push('E_DOUBLE_OFF', truth - 1);
  } else if (op === 'round') {
    const n = spec.number;
    const power = spec.place_power ?? 1;
    const unit = 10 ** power;
    const base = Math.floor(Math.abs(n) / unit) * unit;
    const hi = base + unit;
    const mode = spec.mode === 'truncate' ? 'truncate' : 'half_up';
    push('E_APPROX_EXACT_CONFUSION', Math.abs(n)); // خودِ عدد به‌جای گردشده
    push('E_ROUND_NEAREST', mode === 'truncate' ? hi : base); // گردِ «دیگر» همان جایگاه
    if (Math.abs(truth) >= 10) push('E_ZERO_PLACE_MISS', Math.floor(Math.abs(truth) / 10));
  }
  return pickByPriorityW8(candidatesHit(cands, sub));
}

/**
 * دیسپچر موج W8 با زنجیرهٔ PRIORITY_W8.
 * spec: { op: 'frac_*' | 'perimeter_*' | 'area_*' | 'compound_to_minor' | 'clock_*' |
 *              'ruler_offset' | 'symmetry_axes' | 'probability' | 'pictograph_value' |
 *              'table_query' | 'divide_qr' | 'place_value' | 'column_add' | 'column_sub' | 'round', … }
 * submitted: عدد صحیح | شیء کسر cartridge-schema | رشتهٔ 'a/b' (یا 'HH:MM' برای ساعت)
 * خروجی: اولین کد برندهٔ زنجیره یا null. op نامعلوم/بدشکل → null (صادقانه بی‌الگو).
 */
export function classifyW8(spec, submitted) {
  if (!spec || typeof spec !== 'object') return null;
  const { op } = spec;
  if (typeof op !== 'string') return null;
  if (op.startsWith('frac_')) return classifyFracW8(spec, submitted);
  if (['perimeter_rect', 'perimeter_square', 'perimeter_polygon', 'area_rect', 'area_square',
       'compound_to_minor', 'clock_to_24h', 'clock_elapsed', 'ruler_offset', 'symmetry_axes'].includes(op)) {
    return classifyGeometryW8(spec, submitted);
  }
  if (op === 'probability' || op === 'pictograph_value' || op === 'table_query') return classifyDataProbW8(spec, submitted);
  if (op === 'divide_qr') return classifyMultDivW8(spec, submitted);
  if (op === 'place_value' || op === 'column_add' || op === 'column_sub' || op === 'round') return classifyNumberOpsW8(spec, submitted);
  return null; // op نامعلوم — صادقانه بی‌الگو
}
