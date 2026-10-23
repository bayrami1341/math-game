// آزمون‌های رندرر ۱۴مدلی (v10.3 — BP-003 / Task 64)
// پوشش: پارس گرامر رسمی ۷.۳ کتاب موتور، قالب فشرده M_XXX(۳×۴)، fallback متنی،
// و «قفل INC-09»: شمارش کلاس‌های mf-* در SVG = دقیقاً پارامتر عددی پارس‌شده.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDigits,
  parseVisualSpec,
  renderModelFigureSVG,
  renderVisualColumn
} from '../src/v10/station/model-figures.js';

// ── ابزار INC-09: شمارش المان‌های شمارش‌پذیر با کلاس mf-cls ──
function countClass(svg, cls) {
  const m = svg.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`, 'g'));
  return m ? m.length : 0;
}
function expectModel(svg, model) {
  assert.ok(svg, 'SVG تولید نشد (null)');
  assert.match(svg, new RegExp(`model-figure--${model}`), `کلاس مدل ${model}`);
}

test('1. نرمال‌سازی ارقام فارسی/عربی', () => {
  assert.equal(normalizeDigits('۳×۴'), '3×4');
  assert.equal(normalizeDigits('٠١٢'), '012');
  assert.equal(normalizeDigits('abc'), 'abc');
});

test('2. پارس گرامر رسمی: نمونه‌های ۷.۳ کتاب موتور', () => {
  const a = parseVisualSpec('نوع: M_ARRAY؛ سطر:۳؛ ستون:۴؛ نقطه؛ پرسش: «چند سطر؟ چند ستون؟ چند خانه؟»');
  assert.equal(a.model, 'M_ARRAY');
  assert.equal(a.params['سطر'], 3);
  assert.equal(a.params['ستون'], 4);
  assert.equal(a.question, 'چند سطر؟ چند ستون؟ چند خانه؟');

  const b = parseVisualSpec('نوع: M_BUNDLES؛ ده‌تایی:۲؛ تک:۵؛ پرسش: «این عدد چند است؟»');
  assert.equal(b.model, 'M_BUNDLES');
  assert.equal(b.params['ده‌تایی'], 2);
  assert.equal(b.params['تک'], 5);

  const c = parseVisualSpec('نوع: M_NUMBERLINE؛ از:۰؛ تا:۱۰۰؛ پرش:۲۵؛ جهت: عددی چپ‌به‌راستِ رو به بالا؛ پرسش: «۴ پرش تا کدام عدد می‌رسد؟»');
  assert.equal(c.params['از'], 0);
  assert.equal(c.params['تا'], 100);
  assert.equal(c.params['پرش'], 25);

  const d = parseVisualSpec('نوع: M_FRACTION؛ تقسیم:۴؛ رنگی:۱؛ شکل:نوار؛ پرسش: «یک چهارم کدام است؟»');
  assert.equal(d.params['تقسیم'], 4);
  assert.equal(d.params['رنگی'], 1);
  assert.equal(d.params['شکل'], 'نوار');

  const e = parseVisualSpec('نوع: M_CHART؛ نمودار:میله‌ای؛ رده‌ها: شنبه، یک‌شنبه، دوشنبه؛ مقادیر:۵،۸،۳؛ پرسش: «کدام روز بیشترین بود؟»');
  assert.deepEqual(e.params['رده‌ها'], 'شنبه، یک‌شنبه، دوشنبه');
  assert.deepEqual(e.params['مقادیر'], '5،8،3', 'مقادیر نرمال‌شدهٔ ارقام');
});

test('3. پارس قالب فشرده «M_ARRAY(۳×۴)» + نمونه‌های بدشکل → null', () => {
  const c = parseVisualSpec('چهارگزینه‌ای + M_ARRAY(۳×۴)');
  assert.equal(c.model, 'M_ARRAY');
  assert.equal(c.params['سطر'], 3);
  assert.equal(c.params['ستون'], 4);
  // بدشکل‌ها
  assert.equal(parseVisualSpec(null), null);
  assert.equal(parseVisualSpec(''), null);
  assert.equal(parseVisualSpec('—'), null);
  assert.equal(parseVisualSpec('متن عادی بدون گرامر'), null);
  assert.equal(parseVisualSpec('نوع: M_UNKNOWN؛ سطر:۳'), null);
});

test('4. INC-09 — M_ARRAY: تعداد mf-dot = سطر×ستون', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_ARRAY؛ سطر:۳؛ ستون:۴'));
  expectModel(s, 'M_ARRAY');
  assert.equal(countClass(s, 'mf-dot'), 12, 'INC-09: ۳×۴ = ۱۲ نقطه');
});

test('5. INC-09 — M_GROUPS: mf-group = گروه، mf-dot = گروه×اندازه', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_GROUPS؛ گروه:۳؛ اندازه:۴'));
  expectModel(s, 'M_GROUPS');
  assert.equal(countClass(s, 'mf-group'), 3);
  assert.equal(countClass(s, 'mf-dot'), 12);
});

test('6. INC-09 — M_NUMBERLINE: mf-tick = پرش‌ها+۱، mf-jump = پرش‌ها', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_NUMBERLINE؛ از:۰؛ تا:۱۰۰؛ پرش:۲۵'));
  expectModel(s, 'M_NUMBERLINE');
  assert.equal(countClass(s, 'mf-tick'), 5, '۰/۲۵/۵۰/۷۵/۱۰۰');
  assert.equal(countClass(s, 'mf-jump'), 4, '۴ پرش');
  // پرش ناقص → صادقانه null
  const bad = renderModelFigureSVG(parseVisualSpec('نوع: M_NUMBERLINE؛ از:۰؛ تا:۱۰۰؛ پرش:۳۰'));
  assert.equal(bad, null);
});

test('7. INC-09 — M_BUNDLES: mf-bundle = ده‌تایی، mf-dot = تک', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_BUNDLES؛ ده‌تایی:۲؛ تک:۵'));
  expectModel(s, 'M_BUNDLES');
  assert.equal(countClass(s, 'mf-bundle'), 2);
  assert.equal(countClass(s, 'mf-dot'), 5);
});

test('8. INC-09 — M_PLACEVALUE: mf-chip = مجموع مهره‌ها', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_PLACEVALUE؛ صد:۳؛ ده:۴؛ یک:۵'));
  expectModel(s, 'M_PLACEVALUE');
  assert.equal(countClass(s, 'mf-chip'), 12);
});

test('9. INC-09 — M_AREAMODEL: mf-part = قطع‌های جزئی', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_AREAMODEL؛ قطع_افقی:۳۰،۴؛ قطع_عمودی:۲۰،۵'));
  expectModel(s, 'M_AREAMODEL');
  assert.equal(countClass(s, 'mf-part'), 4, '۲ قطع × ۲ قطع = ۴ مستطیل');
});

test('10. INC-09 — M_BARS: mf-bar = نوارها، mf-seg = نوار×تقسیم', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_BARS؛ نوار:۲؛ تقسیم:۴'));
  expectModel(s, 'M_BARS');
  assert.equal(countClass(s, 'mf-bar'), 2);
  assert.equal(countClass(s, 'mf-seg'), 8);
});

test('11. INC-09 — M_FRACTION نوار و دیسک: mf-slice = تقسیم، mf-slice-filled = رنگی', () => {
  const bar = renderModelFigureSVG(parseVisualSpec('نوع: M_FRACTION؛ تقسیم:۴؛ رنگی:۱؛ شکل:نوار'));
  expectModel(bar, 'M_FRACTION');
  assert.equal(countClass(bar, 'mf-slice'), 4);
  assert.equal(countClass(bar, 'mf-slice-filled'), 1);
  const disc = renderModelFigureSVG(parseVisualSpec('نوع: M_FRACTION؛ تقسیم:۶؛ رنگی:۲؛ شکل:دیسک'));
  expectModel(disc, 'M_FRACTION');
  assert.equal(countClass(disc, 'mf-slice'), 6);
  assert.equal(countClass(disc, 'mf-slice-filled'), 2);
  // رنگی > تقسیم → صادقانه null
  const bad = renderModelFigureSVG(parseVisualSpec('نوع: M_FRACTION؛ تقسیم:۴؛ رنگی:۹'));
  assert.equal(bad, null);
});

test('12. INC-09 — نمونهٔ طلایی حادثهٔ ۱۳≠۱۶: M_GEO_SHAPES مثلث:۱۳ → دقیقاً ۱۳ شکل', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_GEO_SHAPES؛ مثلث:۱۳'));
  expectModel(s, 'M_GEO_SHAPES');
  assert.equal(countClass(s, 'mf-shape'), 13, 'INC-09: همان حادثهٔ شمارش ماشینی Q-1011');
  const mix = renderModelFigureSVG(parseVisualSpec('نوع: M_GEO_SHAPES؛ مثلث:۴؛ مربع:۳؛ دایره:۲'));
  assert.equal(countClass(mix, 'mf-shape'), 9);
});

test('13. INC-09 — M_CLOCK_TIME: دقیقاً دو عقربهٔ mf-hand', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_CLOCK_TIME؛ ساعت:۳؛ دقیقه:۳۰'));
  expectModel(s, 'M_CLOCK_TIME');
  assert.equal(countClass(s, 'mf-hand'), 2);
  assert.equal(countClass(s, 'mf-clock'), 1);
  // دامنهٔ بد: دقیقهٔ ۶۱ → null
  assert.equal(renderModelFigureSVG(parseVisualSpec('نوع: M_CLOCK_TIME؛ ساعت:۳؛ دقیقه:۶۱')), null);
});

test('14. INC-09 — M_BALANCE: mf-weight = چپ، mf-mystery = «؟»', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_BALANCE؛ چپ:۳؛ راست:؟'));
  expectModel(s, 'M_BALANCE');
  assert.equal(countClass(s, 'mf-weight'), 3);
  assert.equal(countClass(s, 'mf-mystery'), 1);
  assert.equal(countClass(s, 'mf-pan'), 2, 'دو کفهٔ ترازو');
});

test('15. INC-09 — M_MONEY: mf-bill = اسکناس‌ها، mf-coin = سکه‌ها', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_MONEY؛ هزار:۲؛ پانصد:۱؛ سکه:۴'));
  expectModel(s, 'M_MONEY');
  assert.equal(countClass(s, 'mf-bill'), 3);
  assert.equal(countClass(s, 'mf-coin'), 4);
});

test('16. INC-09 — M_CHART: mf-col = تعداد رده‌ها', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_CHART؛ نمودار:میله‌ای؛ رده‌ها: شنبه، یک‌شنبه، دوشنبه؛ مقادیر:۵،۸،۳'));
  expectModel(s, 'M_CHART');
  assert.equal(countClass(s, 'mf-col'), 3);
  // ناهم‌سنجی رده/مقدار → صادقانه null
  const bad = renderModelFigureSVG(parseVisualSpec('نوع: M_CHART؛ رده‌ها: شنبه، یک‌شنبه؛ مقادیر:۵،۸،۳'));
  assert.equal(bad, null);
});

test('17. INC-09 — M_PATTERN: mf-term = تعداد جمله‌ها (با «؟»)', () => {
  const s = renderModelFigureSVG(parseVisualSpec('نوع: M_PATTERN؛ جمله‌ها:۲،۴،۶،؟'));
  expectModel(s, 'M_PATTERN');
  assert.equal(countClass(s, 'mf-term'), 4);
  assert.equal(countClass(s, 'mf-term-question'), 1);
});

test('18. اتصال امن: renderVisualColumn — svg/فالبک متنی/خالی، هرگز استثنا', () => {
  const ok = renderVisualColumn('نوع: M_ARRAY؛ سطر:۲؛ ستون:۳');
  assert.equal(ok.kind, 'svg');
  assert.match(ok.svg, /mf-dot/);
  const fb = renderVisualColumn('توضیح متنی سادهٔ تصویر');
  assert.equal(fb.kind, 'text');
  assert.equal(fb.text, 'توضیح متنی سادهٔ تصویر');
  const dash = renderVisualColumn('—');
  assert.equal(dash.kind, 'text');
  assert.equal(dash.text, '');
  assert.equal(renderVisualColumn(null).kind, 'text');
  assert.equal(renderVisualColumn(undefined).kind, 'text');
});

test('19. پوشش هر ۱۴ مدل کاتالوگ بدون خطا + صفر استثنا در ورودی‌های بد', () => {
  const specs = {
    M_ARRAY: 'نوع: M_ARRAY؛ سطر:۲؛ ستون:۵',
    M_GROUPS: 'نوع: M_GROUPS؛ گروه:۲؛ اندازه:۳',
    M_NUMBERLINE: 'نوع: M_NUMBERLINE؛ از:۰؛ تا:۲۰؛ پرش:۵',
    M_BUNDLES: 'نوع: M_BUNDLES؛ ده‌تایی:۱؛ تک:۳',
    M_PLACEVALUE: 'نوع: M_PLACEVALUE؛ صد:۱؛ ده:۲؛ یک:۳',
    M_AREAMODEL: 'نوع: M_AREAMODEL؛ قطع_افقی:۳۰،۴؛ قطع_عمودی:۲۰،۵',
    M_BARS: 'نوع: M_BARS؛ نوار:۱؛ تقسیم:۳',
    M_FRACTION: 'نوع: M_FRACTION؛ تقسیم:۳؛ رنگی:۱؛ شکل:نوار',
    M_GEO_SHAPES: 'نوع: M_GEO_SHAPES؛ مربع:۵',
    M_CLOCK_TIME: 'نوع: M_CLOCK_TIME؛ ساعت:۱؛ دقیقه:۰',
    M_BALANCE: 'نوع: M_BALANCE؛ چپ:۲؛ راست:؟',
    M_MONEY: 'نوع: M_MONEY؛ هزار:۱؛ سکه:۲',
    M_CHART: 'نوع: M_CHART؛ رده‌ها: الف، ب؛ مقادیر:۲،۴',
    M_PATTERN: 'نوع: M_PATTERN؛ جمله‌ها:۱،۲،۳'
  };
  for (const [model, spec] of Object.entries(specs)) {
    const svg = renderModelFigureSVG(parseVisualSpec(spec));
    assert.ok(svg, `${model} رندر نشد`);
    assert.match(svg, new RegExp(`model-figure--${model}`));
  }
  // ورودی‌های بد به همهٔ لایه‌ها — هیچ استثنایی
  for (const bad of [null, undefined, '', '—', 42, {}, { model: 'M_ARRAY' }]) {
    assert.doesNotThrow(() => parseVisualSpec(bad));
    assert.doesNotThrow(() => renderModelFigureSVG(bad));
    assert.doesNotThrow(() => renderVisualColumn(bad));
  }
  assert.equal(renderModelFigureSVG({ model: 'M_ARRAY', params: null }), null);
});
