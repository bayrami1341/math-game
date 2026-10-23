// آزمون‌های خط تولید خشاب (v10.3 — گیت تکمیل گام ۱)
// پوشش: اعتبارسنجی خشاب منتشرشده از دیسک، آمار هم‌خوان با ممیزی AUD، ضد J12،
// مالکیت متقاطع نقشه↔بانک (T7)، رفتار fail-closed اعتبارسنج و لودر، واحد راهنما
//
// اصل: خشاب نامعتبر هرگز وارد موتور نمی‌شود (cartridge.js fail-closed) —
// این فایل همان قاعده را در سطح CI قفل می‌کند.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  validateCartridge,
  parseOptionValue,
  parsePlainMultiplication,
  parseClaims,
  extractQRefs,
  CARTRIDGE_FORMAT_VERSION,
  CARTRIDGE_ID
} from '../src/v10/station/cartridge-schema.js';
import { cartridgeSummary, peekCartridge, loadCartridge } from '../src/v10/station/cartridge.js';

const published = JSON.parse(
  readFileSync(fileURLToPath(new URL('../cartridges/KH-G3-MATH.json', import.meta.url)), 'utf8')
);

test('1. خشاب منتشرشده از دیسک، اعتبارسنجی کامل را می‌گذراند (گیت سبز)', () => {
  const v = validateCartridge(published);
  assert.equal(v.ok, true, 'خطاها: ' + v.errors.join(' | '));
  assert.equal(v.gate.red, 0);
  assert.equal(v.gate.verdict, 'مجاز');
  assert.equal(published.formatVersion, CARTRIDGE_FORMAT_VERSION);
  assert.equal(published.cartridgeId, CARTRIDGE_ID);
  assert.ok(published.source?.tool?.includes('cartridge-converter'), 'ابزار مبدل در source ثبت باشد');
});

test('2. آمار خشاب منتشرشده با حکم ممیزی AUD-01 هم‌خوان است', () => {
  const v = validateCartridge(published);
  assert.deepEqual(v.stats, {
    lessons: 16, lessonsConfirmed: 10,
    // atlasProposed: 8 = ۶ پیشنهاد AUD-01 + ۲ کد پیشنهادی خانوادهٔ ۲/۳ موج الف v0.7 (E_BORROW_MISS، E_ZERO_PLACE_MISS)
    atlasReal: 12, atlasProposed: 8,
    questions: 20, questionsConfirmed: 13, questionsProposed: 7
  });
  assert.equal(v.gate.yellow, 7);
  assert.equal(v.warnings.length, 7);
  // ترکیب رسمی زردها: ۴×AUD-07 + ۲×AUD-06 + ۱×AUD-12 — هیچ زردِ تازه‌ای قاچاق نشده باشد
  assert.equal(v.warnings.filter(w => w.includes('AUD-07')).length, 4);
  assert.equal(v.warnings.filter(w => w.includes('AUD-06')).length, 2);
  assert.equal(v.warnings.filter(w => w.includes('AUD-12')).length, 1);
});

test('3. ضد J12: هر سؤالِ فرم خام a×b، پاسخ‌نامش با حاصل بازحساب‌شده برابر است', () => {
  let checked = 0;
  for (const q of published.questionBank) {
    const plain = parsePlainMultiplication(q.prompt);
    if (!plain) continue;
    checked++;
    const v = parseOptionValue(q.options[q.answerIndex]);
    assert.equal(v, plain.f1 * plain.f2, `${q.id}: گزینهٔ پاسخ ≠ حاصل`);
    if (typeof q.answerValue === 'number') assert.equal(q.answerValue, plain.f1 * plain.f2, `${q.id}: answerValue`);
  }
  assert.ok(checked >= 4, `انتظار حداقل ۴ سؤال فرم خام — یافت: ${checked}`);
});

test('4. مالکیت متقاطع نقشه ↔ بانک (T7 — بستن AUD-04/05)', () => {
  const lessonIds = new Set(published.bookMap.map(l => l.id));
  const bankIds = new Set(published.questionBank.map(q => q.id));
  for (const q of published.questionBank) {
    assert.ok(lessonIds.has(q.anchorId), `${q.id}: لنگر یتیم ${q.anchorId}`);
  }
  for (const l of published.bookMap) {
    const refs = [...new Set(extractQRefs(l.anchorsRaw))].sort();
    const owners = published.questionBank.filter(q => q.anchorId === l.id).map(q => q.id).sort();
    assert.deepEqual(refs, owners, `درس ${l.id}: سلول لنگرها ≠ مالکان واقعی`);
    for (const r of refs) assert.ok(bankIds.has(r), `${l.id}: ارجاع ${r} در بانک نیست`);
  }
});

test('5. fail-closed: کلید پاسخ دستکاری‌شده → مردود (ضد J12 در موتور هم)', () => {
  const tampered = structuredClone(published);
  const q113 = tampered.questionBank.find(q => q.id === 'Q-113');
  assert.ok(q113, 'Q-113 (وصلهٔ L-43) باید در بانک باشد');
  q113.answerIndex = 3; // گزینهٔ انحرافی ۶۳
  const v = validateCartridge(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.gate.verdict, 'مردود');
  assert.ok(v.errors.some(e => e.includes('Q-113') && e.includes('ضد J12')), v.errors.join(' | '));
});

test('6. fail-closed: شناسهٔ بدشکل → قرمز (T4) — و ناهم‌خوانی با expectedId صریح هم قرمز', () => {
  // الف) قرارداد چندخشابی (بدون expectedId): هر شناسهٔ خوش‌قالب KH-… مجاز است،
  //     ولی شناسهٔ بدشکل مردود می‌شود.
  const bad = structuredClone(published);
  bad.cartridgeId = 'WRONG-ID';
  const vBad = validateCartridge(bad);
  assert.equal(vBad.ok, false);
  assert.ok(vBad.errors.some(e => e.includes('cartridgeId')));
  // ب) رفتار مبدل/سرور: با expectedId صریح، حتی شناسهٔ خوش‌قالبِ غیرمنتظره هم مردود است.
  const other = structuredClone(published);
  other.cartridgeId = 'KH-G2-MATH';
  const vOther = validateCartridge(other, 'KH-G3-MATH');
  assert.equal(vOther.ok, false);
  assert.ok(vOther.errors.some(e => e.includes('cartridgeId')));
});

test('7. fail-closed: لنگر یتیم → قرمز (AUD-04)', () => {
  const tampered = structuredClone(published);
  tampered.questionBank[0].anchorId = 'L-GHOST';
  const v = validateCartridge(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.includes('در نقشهٔ کتاب نیست')));
});

test('8. fail-closed: برچسب گزینه→خطای ناسازگار با موتور → قرمز (T6)', () => {
  const tampered = structuredClone(published);
  const q113 = tampered.questionBank.find(q => q.id === 'Q-113');
  q113.optionErrorMap = 'د→E_ZERO_PROPERTY'; // ۷×۸ با ۶۳ صفر زده نمی‌شود
  const v = validateCartridge(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.includes('Q-113') && e.includes('ناسازگاری')), v.errors.join(' | '));
});

test('9. خشاب تهی و بدشکل → مردود با پیام روشن (نه استثنا)', () => {
  assert.equal(validateCartridge(null).ok, false);
  assert.equal(validateCartridge({}).ok, false);
  assert.ok(validateCartridge({}).errors.length > 0);
});

test('10. واحد راهنما: parseOptionValue و parseClaims', () => {
  assert.equal(parseOptionValue('۳+۴'), 7);
  assert.equal(parseOptionValue('۴×۵'), 20);
  assert.equal(parseOptionValue('همان ۲۸'), 28);
  assert.equal(parseOptionValue('—'), null);
  const claims = parseClaims('الف→E_ADD_CONFUSION؛ ب→E_ZERO_PROPERTY (پیشنهادی)؛ د→چسباندن رقم (بی‌الگو)');
  assert.deepEqual(claims.map(c => c.letter), ['الف', 'ب', 'د']);
  assert.equal(claims[0].claim, 'E_ADD_CONFUSION');
});

test('10-الف. W8 (BP-007): مرزهای parseOptionValue — کسر، مخلوط، بازهٔ ±۱۰^۹، سازگاری گذشته', () => {
  // ── کسر دقیق «a/b» ──
  assert.deepEqual({ ...parseOptionValue('۳/۴') }, { frac: true, num: 3, den: 4 });
  assert.deepEqual({ ...parseOptionValue('۴/۸') }, { frac: true, num: 1, den: 2 }, 'ساده‌سازی');
  assert.deepEqual({ ...parseOptionValue('-۲/۴') }, { frac: true, num: -1, den: 2 }, 'علامت منفی روی صورت');
  assert.equal(parseOptionValue('۲/−۴'), null, 'مخرج منفی بیرون قرارداد (هم‌رفتار مبدل آرنا)');
  assert.equal(parseOptionValue('۳/۰'), null, 'مخرج صفر ممنوع');
  assert.equal(parseOptionValue('۰/۵'), 0, 'کسر صفر → عدد خام');
  // ── کسر صحیح‌ارزش → عدد خام (هم‌قرارداد گذشته) ──
  assert.equal(parseOptionValue('۶/۳'), 2);
  assert.equal(parseOptionValue('۸/۲'), 4);
  // ── عدد مخلوط «k و a/b» ──
  assert.deepEqual({ ...parseOptionValue('۲ و ۱/۲') }, { frac: true, num: 5, den: 2 });
  assert.deepEqual({ ...parseOptionValue('۱و۳/۴') }, { frac: true, num: 7, den: 4 }, 'بدون فاصله');
  assert.deepEqual({ ...parseOptionValue('−۲ و ۱/۲') }, { frac: true, num: -5, den: 2 }, 'علامت بر کل مخلوط');
  assert.equal(parseOptionValue('۲ و ۱/۰'), null, 'مخرج صفر مخلوط ممنوع');
  // ── بازهٔ رسمی ±۱٬۰۰۰٬۰۰۰٬۰۰۰ ──
  assert.equal(parseOptionValue('۱۰۰۰۰۰۰۰۰۰'), 1_000_000_000);
  assert.equal(parseOptionValue('-۱۰۰۰۰۰۰۰۰۰'), -1_000_000_000);
  assert.equal(parseOptionValue('۱۰۰۰۰۰۰۰۰۱'), null, 'فراتر از سقف W8 → null');
  assert.equal(parseOptionValue('۹۹۹۹۹۹۹۹۹۹۹۹۹'), null);
  // ── ارقام عربی-هندی (هم‌راستا با مبدل آرنا) ──
  assert.equal(parseOptionValue('٥'), 5);
  assert.equal(parseOptionValue('٢٤'), 24);
  // ── سازگاری گذشته: هیچ رفتار رسمی قبلی تغییر نکند (آزمون معکوس T3) ──
  assert.equal(parseOptionValue('۳+۴'), 7);
  assert.equal(parseOptionValue('۴×۵'), 20);
  assert.equal(parseOptionValue('همان ۲۸'), 28);
  assert.equal(parseOptionValue('—'), null);
  assert.equal(parseOptionValue('۷'), 7);
  assert.equal(parseOptionValue('۰'), 0);
  assert.equal(parseOptionValue(null), null);
  assert.equal(parseOptionValue(undefined), null);
  // ورودی عددی
  assert.equal(parseOptionValue(42), 42);
  assert.equal(parseOptionValue(1_000_000_000), 1_000_000_000);
  assert.equal(parseOptionValue(1_000_000_001), null);
  assert.equal(parseOptionValue(3.5), null, 'اعشار هرگز در قرارداد نبود');
});

test('10-ب. extractQRefs: دو قالب بازه («تا» و خط‌تیره) + ارجاع تنها', () => {
  assert.deepEqual(extractQRefs('Q-101 تا Q-103'), ['Q-101', 'Q-102', 'Q-103']);
  assert.deepEqual(extractQRefs('E_TABLE_NEIGHBOUR (Q-1001-1004)'), ['Q-1001', 'Q-1002', 'Q-1003', 'Q-1004']);
  assert.deepEqual(
    extractQRefs('E_GROUPS (Q-1025-1028)؛ E_DOUBLE_OFF (Q-1029-1032)'),
    ['Q-1025', 'Q-1026', 'Q-1027', 'Q-1028', 'Q-1029', 'Q-1030', 'Q-1031', 'Q-1032']
  );
  assert.deepEqual(extractQRefs('Q-101'), ['Q-101']);
  assert.deepEqual(extractQRefs('E_ZERO_PLACE_MISS، E_ADD_CONFUSION (مرور)'), []);
  // بازهٔ نامعتبر: گسترش نمی‌یابد (fail-closed — T7 فریاد می‌زند)
  assert.deepEqual(extractQRefs('Q-105-103'), []);
  assert.deepEqual(extractQRefs('Q-101-200'), []);
});

test('11. cartridgeSummary فقط فیلدهای پنل معلم را نگاشت می‌کند', () => {
  assert.equal(peekCartridge(), null, 'پیش از بارگذاری، کش تهی است');
  const fake = {
    validation: {
      stats: { questions: 20, questionsConfirmed: 13, questionsProposed: 7, lessons: 16, lessonsConfirmed: 10, atlasReal: 12, atlasProposed: 6 },
      gate: { red: 0, yellow: 7 }
    }
  };
  assert.deepEqual(cartridgeSummary(fake), {
    questions: 20, questionsConfirmed: 13, questionsProposed: 7,
    lessons: 16, lessonsConfirmed: 10, atlasReal: 12, atlasProposed: 6,
    red: 0, yellow: 7
  });
  assert.equal(cartridgeSummary(null), null);
});

// آخرین آزمون — لودر کش می‌کند؛ نباید نتیجهٔ این آزمون روی بقیه اثر بگذارد
test('12. لودر fail-closed: URL در دسترس‌ناپذیر → ok:false بدون استثنا', async () => {
  const out = await loadCartridge('http://127.0.0.1:9/cartridges/KH-G3-MATH.json');
  assert.equal(out.ok, false);
  assert.equal(typeof out.error, 'string');
  assert.ok(out.error.length > 5);
});

// ─── چندخشابی (v10.3.1): پلتفرم با هر خشاب خوش‌قالب KH-… کار می‌کند ───
test('13. چندخشابی: خشاب G2 منتشرشده با قرارداد پیش‌فرض (بدون expectedId) پذیرفته می‌شود', () => {
  const g2 = JSON.parse(
    readFileSync(fileURLToPath(new URL('../cartridges/KH-G2-MATH.json', import.meta.url)), 'utf8')
  );
  assert.equal(g2.cartridgeId, 'KH-G2-MATH');
  const v = validateCartridge(g2);
  assert.equal(v.ok, true, 'خطاها: ' + v.errors.join(' | '));
  // موج ۴ ادغام شد: ۸ اسکلت سبز + ۱۸ ردیف فصل ۱ + ۱۸ فصل ۲ (ص ۱۹–۳۶) + ۱۸ فصل ۴ (ص ۵۵–۷۲)
  assert.equal(v.stats.lessons, 62);
  assert.equal(v.stats.lessonsConfirmed, 8);
  assert.equal(v.stats.atlasReal + v.stats.atlasProposed, 13);
  // بانک سؤال موج ۴: ۹۲ سؤال (۴۰ فصل ۱ + ۲۸ فصل ۲ + ۲۴ فصل ۴) همه زرد «نیاز به تأیید»
  assert.equal(v.stats.questions, 92);
  assert.equal(v.stats.questionsConfirmed, 0);
  assert.equal(v.stats.questionsProposed, 92);
  // رگرسیون تاریخی: Q-1011 باید «۱۳ مثلث» باشد (شمارش ماشینی PDF — حادثهٔ ۱۳≠۱۶)
  const q1011 = g2.questionBank.find(q => q.id === 'Q-1011');
  assert.ok(q1011, 'Q-1011 باید در بانک باشد');
  assert.match(q1011.prompt || q1011.text || '', /۱۳/, 'Q-1011 باید ۱۳ مثلث بگوید نه ۱۶');
  assert.equal(v.gate.red, 0, 'هیچ قرمزی مجاز نیست');
  // خشاب G2 با expectedId خودش هم دقیقاً سازگار است (رفتار لودر مرورگر)
  assert.equal(validateCartridge(g2, 'KH-G2-MATH').ok, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// BP-002 / Task 63 — سه آشکارساز تکمیلی errors-v103 (E_ROUND_NEAREST،
// E_UNIT_VALUE_CONFUSION، E_APPROX_EXACT_CONFUSION)
// پوشش: نمونه‌های طلایی خشاب G2، مرزها و دامنهٔ ۰..۹۹۹۹، گاردهای سخت،
// تفکیک مسئولیت با E_ROUND_NEAREST، عدم تداخل PRIORITY_V103، فاز fuzz بی‌استثنا
// ─────────────────────────────────────────────────────────────────────────────
import {
  CODES_V103,
  PRIORITY_V103,
  classifyColumnSum,
  classifyDivisionAttempt,
  classifyFourDigit,
  classifyRoundNearest,
  classifyUnitValue,
  classifyApproxExact,
  classifyV103
} from '../src/v10/station/errors-v103.js';

test('BP-002 الف) ثبت سه کد جدید: متادیتا هم‌خوان خشاب G2 + جملهٔ کارت معلم', () => {
  for (const code of ['E_ROUND_NEAREST', 'E_UNIT_VALUE_CONFUSION', 'E_APPROX_EXACT_CONFUSION']) {
    const m = CODES_V103[code];
    assert.ok(m, `${code} در CODES_V103 ثبت نیست`);
    assert.ok(m.nameFa.length > 5, `نام فارسی ${code}`);
    assert.ok(['مفهومی', 'راهبردی'].includes(m.severity), `شدت ${code} — هم‌خوان category خشاب`);
  }
  // خانواده‌ها: گردکردن/تقریب خانوادهٔ عملیات (۱)؛ ارزش مکانی خانوادهٔ ۳
  assert.equal(CODES_V103.E_ROUND_NEAREST.family, 1);
  assert.equal(CODES_V103.E_APPROX_EXACT_CONFUSION.family, 1);
  assert.equal(CODES_V103.E_UNIT_VALUE_CONFUSION.family, 3);
  // هر سه در انتهای زنجیرهٔ اولویت‌اند — هیچ برچسب قبلی جابه‌جا نشده
  const head = PRIORITY_V103.slice(0, 8);
  assert.deepEqual(head, [
    'E_REMAINDER_DROP', 'E_OP_REVERSE', 'E_GROUP_VS_COUNT', 'E_FACT_CONFUSION',
    'E_CARRY_MISS', 'E_BORROW_MISS', 'E_ZERO_PLACE_MISS', 'E_UNEQUAL_GROUP'
  ]);
  assert.deepEqual(PRIORITY_V103.slice(8), [
    'E_ROUND_NEAREST', 'E_UNIT_VALUE_CONFUSION', 'E_APPROX_EXACT_CONFUSION'
  ]);
});

test('BP-002 ب) E_ROUND_NEAREST — نمونهٔ طلایی ۲۶×۳=۷۸→۸۰ + مرزها', () => {
  // طلایی: پاسخ دقیق ۷۸، گردشدهٔ دهگانی ۸۰
  assert.equal(classifyRoundNearest(78, 78), null, 'پاسخ دقیق — خطا نیست');
  assert.equal(classifyRoundNearest(78, 80), 'E_ROUND_NEAREST', 'گرد به دهگان');
  assert.equal(classifyRoundNearest(78, 100), 'E_ROUND_NEAREST', 'گرد به صدگان');
  assert.equal(classifyRoundNearest(47, 50), 'E_ROUND_NEAREST', 'نیم‌بالا: ۴۷→۵۰');
  assert.equal(classifyRoundNearest(43, 40), 'E_ROUND_NEAREST', 'نیم‌پایین: ۴۳→۴۰');
  // خودِ عدد از قبل گرد است — هیچ «گردکردنی» ممکن نیست
  assert.equal(classifyRoundNearest(80, 90), null, '۸۰ گرد است؛ ۹۰ الگوی گردکردن به نزدیک‌ترین نیست');
  assert.equal(classifyRoundNearest(300, 300), null);
  // بی‌الگو: پاسخ اشتباهِ غیرگرد
  assert.equal(classifyRoundNearest(78, 79), null);
  // گاردهای سخت: بیرون دامنهٔ کتاب، اعشار، رشته
  assert.equal(classifyRoundNearest(78, 80.5), null);
  assert.equal(classifyRoundNearest(78, '۸۰'), null);
  assert.equal(classifyRoundNearest(99999, 100000), null);
  assert.equal(classifyRoundNearest(-4, -10), null);
  assert.equal(classifyRoundNearest(78, 10000), null, 'سقف دامنهٔ پاسخ ۹۹۹۹');
  // دیسپچر
  assert.equal(classifyV103({ op: 'round', a: 78 }, 80), 'E_ROUND_NEAREST');
});

test('BP-002 ج) E_UNIT_VALUE_CONFUSION — سه الگو: جمع ارقام، رقم لخت، افتادن ستون', () => {
  // الگوی ۱ — جمع ارقام (نمونهٔ ص ۵۷: ۳ صدتایی+۴ دهتایی → ۷ به‌جای ۳۴۰)
  assert.equal(classifyUnitValue(340, 7), 'E_UNIT_VALUE_CONFUSION');
  assert.equal(classifyUnitValue(45, 9), 'E_UNIT_VALUE_CONFUSION', '۴ ده‌ریالی+۵ یک‌ریالی → ۹ ریال');
  // الگوی ۲ — رقم لخت به‌جای ارزش جایگاه (۸۰۹ → ۸)
  assert.equal(classifyUnitValue(809, 8), 'E_UNIT_VALUE_CONFUSION');
  assert.equal(classifyUnitValue(45, 4), 'E_UNIT_VALUE_CONFUSION', 'رقم دهگان به‌جای ۴۰');
  // الگوی ۳ — افتادن یک ستون ارزش (۳۴۰ → ۳۴)
  assert.equal(classifyUnitValue(340, 34), 'E_UNIT_VALUE_CONFUSION');
  assert.equal(classifyUnitValue(700, 70), 'E_UNIT_VALUE_CONFUSION');
  // درست/بی‌الگو
  assert.equal(classifyUnitValue(340, 340), null, 'ارزش درست');
  assert.equal(classifyUnitValue(809, 17), 'E_UNIT_VALUE_CONFUSION', '۸+۰+۹=۱۷ — شمردن رقم‌ها به‌جای ارزش');
  // گاردها
  assert.equal(classifyUnitValue(5, 5), null);
  assert.equal(classifyUnitValue(5, 9), null, 'تک‌رقمی — خلط بی‌معنا');
  assert.equal(classifyUnitValue(340, '۳۴'), null);
  assert.equal(classifyUnitValue(340, 3.4), null);
  assert.equal(classifyUnitValue(34000, 3400), null, 'بیرون دامنهٔ کتاب');
  // دیسپچر
  assert.equal(classifyV103({ op: 'unit', a: 340 }, 7), 'E_UNIT_VALUE_CONFUSION');
});

test('BP-002 چ) E_APPROX_EXACT_CONFUSION — جابه‌جایی تقریب/دقیق + تفکیک از E_ROUND_NEAREST', () => {
  // mode='approx': پرسش تقریب، خودِ عدد آورده شده
  assert.equal(classifyApproxExact(47, 47, { mode: 'approx' }), 'E_APPROX_EXACT_CONFUSION');
  assert.equal(classifyApproxExact(47, 50, { mode: 'approx' }), null, 'تقریب درست به دهگان');
  assert.equal(classifyApproxExact(47, 0, { mode: 'approx' }), null, 'تقریبِ خیلی دور — بی‌الگو');
  // عدد از قبل گرد: «تقریب ۴۰» = ۴۰ بی‌الگوست
  assert.equal(classifyApproxExact(40, 40, { mode: 'approx' }), null);
  // mode='exact': برشِ غیرنزدیک (حذف رقم) — ۴۸ برش=۴۰ ولی نزدیک=۵۰
  assert.equal(classifyApproxExact(48, 40, { mode: 'exact' }), 'E_APPROX_EXACT_CONFUSION');
  assert.equal(classifyApproxExact(48, 50, { mode: 'exact' }), null, '۵۰ گرد نزدیک است → قلمرو E_ROUND_NEAREST');
  assert.equal(classifyRoundNearest(48, 50), 'E_ROUND_NEAREST', 'تفکیک مسئولیت تأیید شد');
  assert.equal(classifyApproxExact(248, 240, { mode: 'exact' }), 'E_APPROX_EXACT_CONFUSION', '۲۴۰ برش دهگانی است (نزدیک ۲۵۰) → حذف رقم');
  assert.equal(classifyApproxExact(242, 240, { mode: 'exact' }), null, '۲۴۰ گردِ نزدیک ۲۴۲ است → قلمرو E_ROUND_NEAREST');
  assert.equal(classifyRoundNearest(242, 240), 'E_ROUND_NEAREST', 'تفکیک مسئولیت در حالت مرزی');
  assert.equal(classifyApproxExact(360, 300, { mode: 'exact' }), 'E_APPROX_EXACT_CONFUSION', 'برش صدگانیِ دور: نزدیک ۳۶۰، ۴۰۰ است نه ۳۰۰');
  assert.equal(classifyApproxExact(248, 200, { mode: 'exact' }), null, '۲۰۰ گردِ نزدیک ۲۴۸ است → قلمرو E_ROUND_NEAREST');
  assert.equal(classifyRoundNearest(248, 200), 'E_ROUND_NEAREST');
  // درست
  assert.equal(classifyApproxExact(48, 48, { mode: 'exact' }), null);
  // mode نامعلوم/گاردها
  assert.equal(classifyApproxExact(48, 40, {}), null);
  assert.equal(classifyApproxExact(48, 40, null), null, 'بدون opts هم هرگز استثنا نمی‌دهد');
  assert.equal(classifyApproxExact(48, '۴۰', { mode: 'exact' }), null);
  assert.equal(classifyApproxExact(48, 40.5, { mode: 'exact' }), null);
  // دیسپچر
  assert.equal(classifyV103({ op: 'approx', a: 47, mode: 'approx' }, 47), 'E_APPROX_EXACT_CONFUSION');
});

test('BP-002 ح) عدم تداخل اولویت: آشکارسازهای جدید هرگز برچسب کدهای موج الف قبلی را نمی‌دوزند', () => {
  // ورودی‌های متنوع به سه آشکارساز جدید — هرگز کدی بیرون از سه‌تایی جدید برنمی‌گردد
  const NEW = new Set(['E_ROUND_NEAREST', 'E_UNIT_VALUE_CONFUSION', 'E_APPROX_EXACT_CONFUSION']);
  const OLD_FIRST8 = PRIORITY_V103.slice(0, 8);
  const samples = [
    [classifyRoundNearest(78, 80)],
    [classifyUnitValue(340, 7)],
    [classifyApproxExact(47, 47, { mode: 'approx' })],
    [classifyRoundNearest(9999, 10000)],
    [classifyUnitValue(0, 0)],
    [classifyApproxExact(0, 0, { mode: 'exact' })]
  ].flat();
  for (const code of samples) {
    if (code !== null) assert.ok(NEW.has(code), `کد ناشناخته برگشت: ${code}`);
  }
  // و برعکس: آشکارسازهای قدیمی هرگز سه کد جدید را برنمی‌گردانند
  assert.equal(classifyColumnSum(358, 246, 594), 'E_CARRY_MISS');
  assert.ok(!NEW.has(classifyColumnSum(358, 246, 594)));
  assert.equal(classifyDivisionAttempt(19, 4, 5, { totalDivision: true }), 'E_REMAINDER_DROP');
  assert.equal(classifyFourDigit(4070, 470), 'E_ZERO_PLACE_MISS');
});

test('BP-002 خ) فاز fuzz — ۲۰٬۰۰۰ ورودی تصادفی/مرزی، صفر استثنا، خروجی همیشه کد شناخته یا null', () => {
  const all = new Set([...Object.keys(CODES_V103)]);
  let seed = 20260101;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 20000; i++) {
    const a = rnd(12000) - 1000;               // شامل خارج دامنه
    const b = rnd(2) === 0 ? rnd(10000) : 'x'; // شامل نوع بد
    const s = rnd(3) === 0 ? rnd(10500) : 1.5; // شامل اعشار
    const mode = rnd(3) === 0 ? 'approx' : rnd(2) === 0 ? 'exact' : '؟';
    let r1, r2, r3;
    assert.doesNotThrow(() => { r1 = classifyRoundNearest(a, s); });
    assert.doesNotThrow(() => { r2 = classifyUnitValue(a, s); });
    assert.doesNotThrow(() => { r3 = classifyApproxExact(a, s, { mode }); });
    for (const r of [r1, r2, r3]) {
      if (r !== null) assert.ok(all.has(r), `خروجی ناشناخته: ${r}`);
    }
    assert.doesNotThrow(() => classifyV103({ op: 'round', a }, s));
    assert.doesNotThrow(() => classifyV103({ op: 'unit', a }, s));
    assert.doesNotThrow(() => classifyV103({ op: 'approx', a, mode }, s));
  }
});
