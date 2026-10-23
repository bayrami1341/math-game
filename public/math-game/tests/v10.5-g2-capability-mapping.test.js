// ─────────────────────────────────────────────────────────────────────────────
// نگاشت ۹ سناریوی قابلیت G2 آرنا به قابلیت واقعی و نسخه‌دار موتور (BP-023)
// منبع سناریوها: آرنا — authoring/G2-ENGINE-CAPABILITY-REQUEST-v1.json
//   (شاخهٔ arena/6b8310f7 — ۹ سناریوی مصنوعی و غیرحق‌نشری، origin =
//    SYNTHETIC_INTERACTION_FIXTURES_NOT_PRINTED_EXERCISES؛ هیچ Q-ID تازه‌ای نمی‌سازد)
//
// قرارداد پاسخ (reply_contract آرنا): برای هر case_id:
//   engine_version_commit · engine_schema_version · capability_status
//   (SUPPORTED | NEEDS_IMPLEMENTATION | NOT_SUPPORTED) · mapping واقعی ·
//   لینک تست تعاملی (این فایل + CI) · محدودیت و اقدام بعدی
//
// قاعدهٔ صداقت: هر ادعا با رفتار واقعی ماژول‌ها در همین کامیت آزموده می‌شود.
// «دسته‌بندی» (taxonomy) و «قابلیت تعامل» دو چیز جدا هستند — این جدول هر دو را
// جدا گزارش می‌کند تا SUPPORTEDِ غلط‌عنوان اعلام نشود. W8 = «پیشنهادی» تا مُهر معلم.
// ─────────────────────────────────────────────────────────────────────────────

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { classifyV103 } from '../src/v10/station/errors-v103.js';
import { classifyW8, CODES_W8 } from '../src/v10/station/errors-w8.js';
import {
  FIGURE_SUBKINDS,
  PLAYABLE_FORMATS,
  isPlayable,
  parseUserFraction,
} from '../src/v10/station/answer-formats.js';
import {
  OP_ENGINES,
  DEFAULT_BOOK_LIMITS,
  withinBookLimits,
} from '../src/v10/station/errors-router.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'); // public/math-game
const REPO = path.join(ROOT, '..', '..'); // ریشهٔ مخزن
const CONTRACT = JSON.parse(
  readFileSync(path.join(ROOT, 'authoring', 'OPERATION-CONTRACT.json'), 'utf8')
);

let ENGINE_COMMIT = 'unknown';
try {
  ENGINE_COMMIT = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
} catch { /* بیرون Git: 'unknown' می‌ماند */ }

const G2 = DEFAULT_BOOK_LIMITS['KH-G2-MATH'];
const G3 = DEFAULT_BOOK_LIMITS['KH-G3-MATH'];

// جای‌نگهدار @GIT_HEAD@ در فایل پاسخ — چون کامیت و فایل با هم متولد می‌شوند
const commitOf = (v) => (v === '@GIT_HEAD@' ? ENGINE_COMMIT : v);

test('شناسهٔ موتور: نسخهٔ قرارداد و کامیت واقعی ثبت می‌شود (reply_contract)', () => {
  assert.equal(CONTRACT.schema, 'khshab.operation-contract/v1');
  assert.match(CONTRACT.version, /^\d+\.\d+\.\d+$/);
  assert.match(ENGINE_COMMIT, /^[0-9a-f]{7,40}$|^unknown$/);
});

// ── G2-CAP-01 · CH6_ADD_REGROUP · ۲۷۸+۱۵۶=۴۳۴ ────────────────────────────────
test('G2-CAP-01: جمع با انتقال — موتور v103 SUPPORTED؛ گارد per-book پیش‌نویس G2 مسدود است (تصمیم معلم)', () => {
  // ۱) جدول قرارداد: sum → v103
  assert.equal(OP_ENGINES.sum, 'v103');
  assert.equal(CONTRACT.operations.sum.engine, 'v103');
  // ۲) رفتار واقعی طبقه‌بند: جواب درست بی‌کد (پذیرش)، جواب غلط عمومی بی‌کد اختصاصی (صادقانه)
  assert.equal(classifyV103({ op: 'sum', a: 278, b: 156 }, 434), null);      // درست
  assert.equal(classifyV103({ op: 'sum', a: 278, b: 156 }, 424), null);      // کد ارزش-مکانی جمع در اطلس نیست — محدودیت ثبت‌شده
  // ۳) گارد per-book پیش‌نویس: G2 sum=[0,100] → 434 بیرون بازه = بی‌الگو با دلیل
  assert.equal(withinBookLimits('sum', { a: 278, b: 156 }, G2), false);
  assert.equal(withinBookLimits('sum', { a: 278, b: 156 }, G3), true);
  // حکم: SUPPORTED (موتور) + گارد کتاب مسدود — گسترش حد G2 فقط با مُهر معلم؛ هیچ سقفی بی‌اجازه باز نمی‌شود
});

// ── G2-CAP-02 · CH6_SUB_REGROUP · ۴۰۲−۱۸۷=۲۱۵ ────────────────────────────────
test('G2-CAP-02: تفریق با قرض از صفر — E_BORROW_MISS برای «بدون‌قرض» کار می‌کند؛ حد پیش‌نویس G2 مسدود', () => {
  assert.equal(OP_ENGINES.sub, 'v103');
  // پروب آرنا: «بدون قرض» باید با کد تفریق-بدون‌قرض رد شود (۳۲۵ = mod-10 رقم‌به‌رقم)
  assert.equal(classifyV103({ op: 'sub', a: 402, b: 187 }, 325), 'E_BORROW_MISS');
  // جواب درست: ۲۱۵ — بی‌کد (پذیرش)
  assert.equal(classifyV103({ op: 'sub', a: 402, b: 187 }, 215), null);
  // ۲۲۵ (پروب دوم آرنا): کد اختصاصی ندارد — صادقانه null، پذیرش/رد با حکم درستی عددی
  assert.equal(classifyV103({ op: 'sub', a: 402, b: 187 }, 225), null);
  // گارد per-book پیش‌نویس: G2 sub=[0,100] → 402−187 بیرون بازه (تصمیم معلم)
  assert.equal(withinBookLimits('sub', { a: 402, b: 187 }, G2), false);
});

// ── G2-CAP-03 · CH7_TENTHS_EQUAL_PARTS · ۱ از ۱۰ بخش مساوی ───────────────────
test('G2-CAP-03: دهم — قالب fraction-shape با ۱۰ خانه بازیپذیر؛ اعتبارسنجی مساحت نابرابر NEEDS_IMPLEMENTATION', () => {
  // قالب شکل/نمودار با زیرقالب کسر بازیپذیر است
  assert.ok(FIGURE_SUBKINDS.includes('fraction-shape'));
  const q = {
    answerFormat: 'شکل/نمودار',
    renderHint: 'subkind:fraction-shape;cells:10',
    answerFrac: { num: 1, den: 10 },
  };
  assert.equal(isPlayable(q), true);
  // پارس پاسخ کاربر 1/10
  const f = parseUserFraction('1/10');
  assert.deepEqual(f, { num: 1, den: 10 });
  // اما: حدهای پیش‌نویس G2 fraction.denMax=8 → den=10 بیرون بازهٔ پیش‌نویس (تصمیم معلم: دهم پایهٔ دوم است)
  assert.ok(G2.fraction.denMax < 10);
  // و: «۱۰ بخش نابرابر نباید ۱/۱۰ شمرده شود» — اعتبارسنجی مساحت سلول‌های نابرابر
  // در موتور فعلی پیاده نیست (سلول‌ها هم‌شمارش‌اند، نه هم‌مساحت) → NEEDS_IMPLEMENTATION
  //   اقدام بعدی: گیت authoring فقط شکل‌های مساوی صادر کند + ژنراتور نابرابر برای شاهد رد
});

// ── G2-CAP-04 · CH7_BAG_CHANCE · احتمال کیسه ────────────────────────────────
test('G2-CAP-04: احتمال کیسه — طبقه‌بندی probability در خانوادهٔ W8 (پیشنهادی)؛ گزینه‌ای بازیپذیر؛ شبیه‌سازی بذر-دار NOT_SUPPORTED', () => {
  // ۱) طبقه‌بندی: op=probability در قرارداد و جدول موتور هست
  assert.equal(OP_ENGINES.probability, 'w8');
  assert.equal(CONTRACT.operations.probability.engine, 'w8');
  // کدهای تشخیصی احتمال در taxonomy W8 هست (پیشنهادی): جزء-به-باقی / مکمل / جابجایی صورت-مخرج
  assert.ok(
    'E_PROB_PART_TO_REST' in CODES_W8 &&
    'E_PROB_COMPLEMENT_CONFUSION' in CODES_W8 &&
    'E_PROB_NUM_DENOM_SWAP' in CODES_W8
  );
  // ۲) تعامل «انتخاب» با قالب گزینه‌ای واقعاً بازیپذیر است (۴ گزینه + answerIndex)
  assert.ok(PLAYABLE_FORMATS.includes('گزینه‌ای'));
  assert.equal(
    isPlayable({ answerFormat: 'گزینه‌ای', options: ['قرمز', 'آبی', 'سبز', 'زرد'], answerIndex: 0 }),
    true
  );
  // ۳) شبیه‌سازی بذر-دار با جایگزینی + ثبت فراوانی: هیچ ماژول/زیرقالبی ندارد
  assert.ok(!FIGURE_SUBKINDS.includes('spinner') && !FIGURE_SUBKINDS.includes('simulation'));
  // حکم: انتخاب=SUPPORTED؛ شبیه‌سازی=NOT_SUPPORTED (نیاز به قرارداد تازه + نسخهٔ پروتکل جدید)
});

// ── G2-CAP-05 · CH7_SPINNER_CHANCE · گردونه ─────────────────────────────────
test('G2-CAP-05: گردونه — همان حکم CAP-04؛ زیرقالب گردونه وجود ندارد (NOT_SUPPORTED برای رندر بومی)', () => {
  assert.equal(OP_ENGINES.probability, 'w8');
  assert.ok(!FIGURE_SUBKINDS.includes('spinner'));
  // «۳/۴ آبی vs ۱/۴ قرمز» به‌صورت گزینه‌ای قابل بازی است؛ رندر بومی گردونه پیاده نیست
  assert.equal(
    isPlayable({ answerFormat: 'گزینه‌ای', options: ['آبی', 'قرمز', 'هر دو مساوی', 'نمی‌دانم'], answerIndex: 0 }),
    true
  );
});

// ── G2-CAP-06 · CH8_BAR_CHART · خواندن نمودار ستونی ─────────────────────────
test('G2-CAP-06: نمودار ستونی — زیرقالب bar-chart بازیپذیر (SUPPORTED)؛ پاسخ عددی ۵ با موتور عددی', () => {
  assert.ok(FIGURE_SUBKINDS.includes('bar-chart'));
  const q = {
    answerFormat: 'شکل/نمودار',
    renderHint: 'subkind:bar-chart',
    answerValue: 5,
    chartData: [
      { label: 'گروه ۱', value: 3 },
      { label: 'گروه ۲', value: 5 },
      { label: 'گروه ۳', value: 2 },
    ],
  };
  assert.equal(isPlayable(q), true);
  // طبقه‌بندی پاسخ عددی از خانوادهٔ داده: op=table_query → w8 (پیشنهادی) برای تشخیص خطا
  assert.equal(OP_ENGINES.table_query, 'w8');
  // قید آرنا (برچسب محور/مقیاس واحد/خط پایه صفر): اعتبارسنجی نویسه‌نگار در گیت مبدل/authoring
  // اعمال می‌شود، نه در رندر زنده — ثبت به‌عنوان محدودیت قرارداد رندر
});

// ── G2-CAP-07 · CH8_PICTOGRAPH · نمودار تصویری با کلید ──────────────────────
test('G2-CAP-07: نمودار تصویری — طبقه‌بندی pictograph_value هست (W8)؛ رندر بومی NEEDS_IMPLEMENTATION', () => {
  assert.equal(OP_ENGINES.pictograph_value, 'w8');
  // کدهای نمودار تصویری در taxonomy W8 هست (پیشنهادی): نادیده‌گرفتن مقیاس کلید / نصف‌نماد=کامل
  assert.ok('E_SCALE_IGNORED' in CODES_W8 && 'E_HALF_SYMBOL_AS_FULL' in CODES_W8);
  // هیچ زیرقالب رندر نمودار تصویری وجود ندارد — کلید نماد → جمع ۳×۲=۶ باید ساخته شود
  assert.ok(!FIGURE_SUBKINDS.includes('pictograph'));
  // اقدام بعدی: زیرقالب pictograph با فیلد الزامی key (بدون key = بی‌الگو، عین پروب آرنا)
});

// ── G2-CAP-08 · CH8_SELECT_REPRESENTATION · انتخاب نمایش + توضیح ────────────
test('G2-CAP-08: انتخاب نمایش — گزینه‌ای بازیپذیر؛ توضیح آزاد NOT_SUPPORTED؛ صف بازبینی معلم قرارداد کارگاهی است نه موتور', () => {
  assert.ok(PLAYABLE_FORMATS.includes('گزینه‌ای'));
  // نوع پاسخ «توضیح آزاد» در قرارداد تعریف نشده — عمداً: ارزیابی متن آزاد حکم انسانی می‌خواهد
  const responseTypes = Object.keys(CONTRACT.responseTypes);
  assert.ok(!responseTypes.includes('توضیح آزاد'));
  // مسیر درست: سؤال گزینه‌ای + توضیح در note → صف بازبینی معلم (M12)؛ هیچ خودتأییدی نیست
});

// ── G2-CAP-09 · CH8_SYMMETRY_TILING · بازتاب روی محور ───────────────────────
test('G2-CAP-09: تقارن — طبقه‌بندی symmetry_axes هست (W8)؛ تعامل فعلی «انتخاب تصویری» است؛ کشیدن بازتاب شبکه‌ای NEEDS_IMPLEMENTATION', () => {
  assert.equal(OP_ENGINES.symmetry_axes, 'w8');
  assert.ok('E_SYM_AXIS_MISCOUNT' in CODES_W8);
  // زیرقالب تقارن فعلی = انتخاب شکل درست از میان گزینه‌های SVG (سنجش گزینه‌ای)
  assert.ok(FIGURE_SUBKINDS.includes('symmetry'));
  assert.equal(
    isPlayable({
      answerFormat: 'شکل/نمودار',
      renderHint: 'subkind:symmetry',
      figureOptions: ['منعکس‌شده', 'چرخیده'],
      correct: 0,
    }),
    true
  );
  // «کشیدن سلول روی شبکه + بازتاب حول x=0 + ردِ چرخش» پیاده نیست → NEEDS_IMPLEMENTATION
  // هیچ ادعایی از «بازتاب شبکه‌ای پشتیبانی می‌شود» نمی‌کنیم.
});

test('قفل صداقت جدول نگاشت: هر ۹ case در فایل پاسخ JSON با همین حکم ثبت باشند', () => {
  const reply = JSON.parse(
    readFileSync(path.join(REPO, 'reports', 'g2-capability-reply-v1.json'), 'utf8')
  );
  assert.equal(reply.schema, 'g2-engine-capability-replies/v1');
  assert.equal(reply.cases.length, 9);
  assert.equal(commitOf(reply.engine_version_commit), ENGINE_COMMIT);
  assert.equal(reply.engine_schema_version, `khshab.operation-contract/v1@${CONTRACT.version}`);
  const ids = reply.cases.map((c) => c.case_id);
  assert.deepEqual(ids, Array.from({ length: 9 }, (_, i) => `G2-CAP-0${i + 1}`));
  for (const c of reply.cases) {
    assert.ok(['SUPPORTED', 'NEEDS_IMPLEMENTATION', 'NOT_SUPPORTED', 'SUPPORTED_WITH_LIMITS'].includes(c.capability_status));
    assert.ok(c.limitations_and_next_action.length > 5, 'محدودیت/اقدام بعدی برای هر case الزامی است');
    assert.equal(commitOf(c.engine_version_commit), ENGINE_COMMIT);
  }
});
