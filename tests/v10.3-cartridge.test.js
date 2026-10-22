// آزمون‌های سرتاسری خط تولید خشاب و یکپارچگی اجرایی (v10.3.2 — پوشش G3 + G2 v0.4/v0.5)
//
// شامل:
//   ۱) اعتبارسنجی خشاب منتشرشدهٔ G3 (۲۰ سؤال) و خشاب پرشدهٔ G2 نسخهٔ v0.5 (۶۲ درس، ۱۳ کد خطا، ۹۲ سؤال)
//   ۲) بازمحاسبهٔ ضد J12 هم برای ضرب G3 و هم برای ردپای لاتین G2 (دستکاری کلید Q-1069 -> مردود)
//   ۳) تطبیق دوطرفهٔ سلول‌به‌سلول اکسل ↔ JSON با صفر اختلاف (`diffExcelAndJson`)
//   ۴) اثبات مسدود شدن انتشار نهایی (`--mode release` -> `RELEASE_GATE_BLOCKED`) روی سطرهای زرد
//   ۵) آزمون واحد `classifyG2Attempt` برای کدهای جدید فصل ۴ (`E_UNIT_VALUE_CONFUSION`، `E_APPROX_EXACT_CONFUSION`)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
import { CODES_G2, CODE_SENTENCES_G2, classifyG2Attempt } from '../src/v10/station/errors-g2.js';
import { convertWorkbook } from '../tools/cartridge-converter/convert.mjs';
import { diffExcelAndJson } from '../tools/cartridge-converter/diff-excel-json.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const publishedG3 = JSON.parse(
  readFileSync(path.join(ROOT, 'cartridges', 'KH-G3-MATH.json'), 'utf8')
);
const publishedG2 = JSON.parse(
  readFileSync(path.join(ROOT, 'cartridges', 'KH-G2-MATH.json'), 'utf8')
);

test('1. خشاب G3 از دیسک، اعتبارسنجی کامل را می‌گذراند (گیت سبز)', () => {
  const v = validateCartridge(publishedG3);
  assert.equal(v.ok, true, 'خطاها: ' + v.errors.join(' | '));
  assert.equal(v.gate.red, 0);
  assert.equal(v.gate.verdict, 'مجاز');
  assert.equal(publishedG3.formatVersion, CARTRIDGE_FORMAT_VERSION);
  assert.equal(publishedG3.cartridgeId, CARTRIDGE_ID);
});

test('2. آمار خشاب G3 با حکم ممیزی AUD-01 هم‌خوان است', () => {
  const v = validateCartridge(publishedG3);
  assert.deepEqual(v.stats, {
    lessons: 16,
    lessonsConfirmed: 10,
    atlasReal: 12,
    atlasProposed: 8,
    questions: 20,
    questionsConfirmed: 13,
    questionsProposed: 7
  });
  assert.equal(v.gate.yellow, 7);
});

test('3. ضد J12 در G3: هر سؤال فرم خام a×b با حاصل بازحساب‌شده برابر است', () => {
  let checked = 0;
  for (const q of publishedG3.questionBank) {
    const plain = parsePlainMultiplication(q.prompt);
    if (!plain) continue;
    checked++;
    const v = parseOptionValue(q.options[q.answerIndex]);
    assert.equal(v, plain.f1 * plain.f2, `${q.id}: گزینهٔ پاسخ ≠ حاصل`);
  }
  assert.ok(checked >= 4);
});

test('4. مالکیت متقاطع نقشه ↔ بانک در هر دو خشاب G3 و G2 (T7)', () => {
  for (const cart of [publishedG3, publishedG2]) {
    const lessonIds = new Set(cart.bookMap.map(l => l.id));
    const bankIds = new Set(cart.questionBank.map(q => q.id));
    for (const q of cart.questionBank) {
      assert.ok(lessonIds.has(q.anchorId), `${cart.cartridgeId}/${q.id}: لنگر یتیم ${q.anchorId}`);
    }
    for (const l of cart.bookMap) {
      const refs = [...new Set(extractQRefs(l.anchorsRaw))].sort();
      const owners = cart.questionBank.filter(q => q.anchorId === l.id).map(q => q.id).sort();
      assert.deepEqual(refs, owners, `${cart.cartridgeId}/${l.id}: سلول لنگرها ≠ مالکان واقعی`);
      for (const r of refs) assert.ok(bankIds.has(r), `${l.id}: ارجاع ${r} در بانک نیست`);
    }
  }
});

test('5. fail-closed ضد J12: دستکاری کلید پاسخ در G3 (Q-113) و در G2 فصل ۴ (Q-1069) هر دو مردود می‌شوند', () => {
  const tamperedG3 = structuredClone(publishedG3);
  tamperedG3.questionBank.find(q => q.id === 'Q-113').answerIndex = 3;
  const v3 = validateCartridge(tamperedG3);
  assert.equal(v3.ok, false);
  assert.ok(v3.errors.some(e => e.includes('Q-113') && e.includes('ضد J12')));

  const tamperedG2 = structuredClone(publishedG2);
  const q1069 = tamperedG2.questionBank.find(q => q.id === 'Q-1069');
  assert.ok(q1069, 'Q-1069 باید در بانک سؤال v0.5 باشد');
  q1069.answerIndex = 1; // ۶۰ به‌جای ۶
  const v2 = validateCartridge(tamperedG2);
  assert.equal(v2.ok, false);
  assert.ok(v2.errors.some(e => e.includes('Q-1069') && e.includes('ضد J12')), v2.errors.join(' | '));
});

test('6. fail-closed: شناسهٔ بدشکل، لنگر یتیم و کد خطای ثبت‌نشده همگی قرمز می‌شوند', () => {
  const badId = structuredClone(publishedG2);
  badId.cartridgeId = 'WRONG-ID';
  assert.equal(validateCartridge(badId).ok, false);
  assert.equal(validateCartridge(publishedG2, 'KH-G3-MATH').ok, false);

  const badCode = structuredClone(publishedG2);
  badCode.questionBank.find(q => q.id === 'Q-1069').optionErrorMap = 'ب→E_TOTALLY_UNREGISTERED_FAKE';
  const vCode = validateCartridge(badCode);
  assert.equal(vCode.ok, false);
  assert.ok(vCode.errors.some(e => e.includes('E_TOTALLY_UNREGISTERED_FAKE')));
});

test('7. extractQRefs هر سه قالب بازه («تا»، خط‌تیره و «..» موج ۳ و ۴) را دقیق گسترش می‌دهد', () => {
  assert.deepEqual(extractQRefs('Q-101 تا Q-103'), ['Q-101', 'Q-102', 'Q-103']);
  assert.deepEqual(extractQRefs('E_TABLE_NEIGHBOUR (Q-1001-1004)'), ['Q-1001', 'Q-1002', 'Q-1003', 'Q-1004']);
  assert.deepEqual(extractQRefs('Q-1069..Q-1072'), ['Q-1069', 'Q-1070', 'Q-1071', 'Q-1072']);
  assert.deepEqual(extractQRefs('Q-105-103'), []);
  assert.deepEqual(extractQRefs('Q-101-200'), []);
});

test('8. خشاب پرشدهٔ پایهٔ دوم v0.5 (۹۲ سؤال، ۶۲ درس، ۱۳ کد خطا) و تطبیق دوطرفهٔ اکسل↔JSON بدون اختلاف', () => {
  const v = validateCartridge(publishedG2, 'KH-G2-MATH');
  assert.equal(v.ok, true, 'خطاها: ' + v.errors.join(' | '));
  assert.equal(v.gate.red, 0);
  assert.equal(v.stats.lessons, 62);
  assert.equal(v.stats.lessonsConfirmed, 8);
  assert.equal(v.stats.atlasReal + v.stats.atlasProposed, 13);
  assert.equal(v.stats.questions, 92);
  assert.equal(v.stats.questionsConfirmed, 0);
  assert.equal(v.stats.questionsProposed, 92);

  // اثبات عدم افتادگی یا تحریف داده در تبدیل Excel -> JSON
  const diff = diffExcelAndJson(
    path.join(ROOT, 'authoring', 'khshab-G2-MATH_v0.5.xlsx'),
    path.join(ROOT, 'cartridges', 'KH-G2-MATH.json')
  );
  assert.equal(diff.ok, true, JSON.stringify(diff.diffs));
  assert.deepEqual(diff.counts, { lessons: 62, errorAtlas: 13, questions: 92 });
});

test('9. حکمرانی انتشار در مبدل: حالت `--mode release` روی سطرهای تأییدنشده با کد 2 مسدود می‌شود', () => {
  const blocked = convertWorkbook(
    path.join(ROOT, 'authoring', 'khshab-G2-MATH_v0.5.xlsx'),
    {
      mode: 'release',
      outJson: '/tmp/must-never-be-written-release.json',
      outReport: '/tmp/convert-release-blocked-test.md'
    }
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.exitCode, 2);
  assert.equal(blocked.reason, 'RELEASE_GATE_BLOCKED');
  assert.ok(blocked.releaseBlockers.some(b => b.startsWith('ZERO_CONFIRMED_QUESTIONS')));
});

test('10. اطلس و طبقه‌بند Pure پایهٔ دوم (`errors-g2.js`): هر ۱۳ کد و تشخیص علّی فصل ۴', () => {
  assert.equal(Object.keys(CODES_G2).length, 13);
  assert.equal(Object.keys(CODE_SENTENCES_G2).length, 13);
  for (const s of Object.values(CODE_SENTENCES_G2)) {
    assert.ok(!s.includes('اشتباه کردی'), 'جملهٔ کودک‌ستیز ممنوع');
  }
  assert.equal(classifyG2Attempt({ mode: 'place3', target: 405 }, 45), 'E_ZERO_PLACE_MISS');
  assert.equal(classifyG2Attempt({ mode: 'place3', target: 643 }, 634), 'E_PLACE_SWAP');
  assert.equal(classifyG2Attempt({ mode: 'place3', target: 326 }, 11), 'E_UNIT_VALUE_CONFUSION');
  assert.equal(classifyG2Attempt({ mode: 'coins', target: 6, exact: 60 }, 60), 'E_UNIT_VALUE_CONFUSION');
  assert.equal(classifyG2Attempt({ mode: 'truncate10', target: 630, exact: 634 }, 634), 'E_APPROX_EXACT_CONFUSION');
  assert.equal(classifyG2Attempt({ mode: 'truncate10', target: 630, exact: 634 }, 640), 'E_ROUND_NEAREST');
  assert.equal(classifyG2Attempt({ mode: 'truncate10', target: 630, exact: 634 }, 630), null);
});

test('11. لودر و خلاصهٔ خشاب در حالت دسترس‌ناپذیر fail-closed می‌ماند', async () => {
  assert.equal(peekCartridge(), null);
  assert.equal(cartridgeSummary(null), null);
  assert.equal(cartridgeSummary(publishedG2).questions, 92);
  const out = await loadCartridge('http://127.0.0.1:9/cartridges/KH-G2-MATH.json');
  assert.equal(out.ok, false);
});
