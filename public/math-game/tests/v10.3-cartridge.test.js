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
  // موج ۲ ادغام شد: ۸ اسکلت سبز + ۱۸ ردیف صفحه‌ای زرد فصل ۱
  assert.equal(v.stats.lessons, 26);
  assert.equal(v.stats.lessonsConfirmed, 8);
  assert.equal(v.stats.atlasReal + v.stats.atlasProposed, 8);
  // بانک سؤال موج ۲: ۴۰ سؤال همه زرد «نیاز به تأیید»
  assert.equal(v.stats.questions, 40);
  assert.equal(v.stats.questionsConfirmed, 0);
  assert.equal(v.stats.questionsProposed, 40);
  assert.equal(v.gate.red, 0, 'هیچ قرمزی مجاز نیست');
  // خشاب G2 با expectedId خودش هم دقیقاً سازگار است (رفتار لودر مرورگر)
  assert.equal(validateCartridge(g2, 'KH-G2-MATH').ok, true);
});
