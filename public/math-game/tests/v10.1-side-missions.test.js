// آزمون‌های اختصاصی اصلاحات ۱۰.۱ — مأموریت‌های جانبی و سؤال تطبیقی
// پوشش: تولید ۵ سؤال تطبیقی، قفل‌گشایی ۶۰٪ (v10.2)، اکشن شروع از شیپ، جداسازی از لیدربرد
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_MISSIONS,
  DEPTH_LAYERS,
  SIDE_F2_RANGE,
  generateSideMissionQuestions,
  stationSystems,
  keepStationRecord,
  RULES_VERSION,
  QUESTION_SET_VERSION
} from '../src/v9/experience.mjs';
import { toStationState } from '../src/v10/bridge.js';
import { createStationSheet } from '../src/v10/station/sheet.js';
import { createStationLayer } from '../src/v10/station/index.js';

const legacyRecord = (sectorId, score, total, extras = {}) => ({
  activityId: `legacy_${sectorId}_${score}`,
  type: 'core',
  sectorId,
  rulesVersion: RULES_VERSION,
  questionSetVersion: 'graph-v8.1',
  score,
  total,
  percent: Math.round(100 * score / total),
  completedAt: new Date().toISOString(),
  ...extras
});

test('1. هر مأموریت جانبی دقیقاً ۵ سؤال تطبیقی با فاکتورهای خودش تولید می‌کند', () => {
  for (const mission of Object.values(SIDE_MISSIONS)) {
    const questions = generateSideMissionQuestions(mission.id, 0);
    assert.equal(questions.length, mission.questionCount, `تعداد سؤال ${mission.id}`);
    assert.equal(mission.questionCount, 5);
    for (const q of questions) {
      assert.equal(q.missionId, mission.id);
      assert.ok(mission.focus.factors.includes(q.f1), `f1=${q.f1} باید در فاکتورهای ${mission.id} باشد`);
      assert.ok(q.f2 >= SIDE_F2_RANGE.min && q.f2 <= SIDE_F2_RANGE.max, `f2=${q.f2} خارج از بازه مجاز`);
      assert.ok(Number.isInteger(q.f1 * q.f2));
    }
  }
});

test('2. تولید سؤال: قطعیت با seed یکسان و تنوع واقعی با seed متفاوت (تطبیقی)', () => {
  const a = generateSideMissionQuestions('side-1-antenna', 0);
  const b = generateSideMissionQuestions('side-1-antenna', 0);
  assert.deepEqual(a, b, 'seed یکسان باید خروجی یکسان بدهد');

  const c = generateSideMissionQuestions('side-1-antenna', 1);
  assert.notDeepEqual(a, c, 'seed متفاوت باید سؤال متفاوت بسازد (تطبیقی)');
  assert.notEqual(a[0].f1, c[0].f1, 'اولین سؤال بین seedها باید تغییر کند');

  const negative = generateSideMissionQuestions('side-1-antenna', -3);
  assert.equal(negative.length, 5, 'seed منفی هم باید خروجی معتبر بدهد');

  assert.deepEqual(generateSideMissionQuestions('unknown-mission'), []);
});

test('3. استراتژی هر سؤال از گلوگاه‌های شناختی لایهٔ مفهومی سکتور مادر می‌آید', () => {
  for (const mission of Object.values(SIDE_MISSIONS)) {
    const parentBottlenecks = DEPTH_LAYERS[`${mission.parentSectorId}-3`].focus.bottleneckTypes;
    const questions = generateSideMissionQuestions(mission.id, 4);
    for (const q of questions) {
      assert.ok(parentBottlenecks.includes(q.strategy), `استراتژی ${q.strategy} باید از سکتور مادر باشد`);
    }
  }
  // v10.2: برج = جابه‌جایی و شکستن (صفحهٔ ۷۰–۷۲) — «ارزش مکانی» و «لنگر همسایه» از برج حذف شده‌اند
  const towerBottlenecks = DEPTH_LAYERS['2-3'].focus.bottleneckTypes;
  assert.ok(towerBottlenecks.includes('commutativity'));
  assert.ok(towerBottlenecks.includes('anchor-5'));
  // متادیتای تعویض‌پذیری باید واقعاً جابه‌جا شده باشد
  const padQuestions = generateSideMissionQuestions('side-3-fuel', 0);
  for (const q of padQuestions) {
    assert.ok(q.strategy === 'place-value' || q.strategy === 'distributive-part');
    if (q.meta?.tens !== undefined) {
      assert.equal(q.meta.tens, Math.floor(q.f2 / 10));
      assert.equal(q.meta.ones, q.f2 % 10);
    }
  }
});

test('4. قفل‌گشایی مأموریت جانبی دقیقاً در ۶۰٪ سکتور مادر رخ می‌دهد (v10.2)', () => {
  const below = stationSystems([legacyRecord(1, 59, 100)]);
  assert.deepEqual(below.find(s => s.sectorId === 1).availableSides, []);

  const at = stationSystems([legacyRecord(1, 60, 100)]);
  assert.deepEqual(at.find(s => s.sectorId === 1).availableSides, ['side-1-antenna']);

  // رکورد سکتور ۱ نباید مأموریت جانبی سکتور ۲ را باز کند
  const onlySector1 = stationSystems([legacyRecord(1, 100, 100)]);
  assert.ok(!onlySector1.find(s => s.sectorId === 2).availableSides.includes('side-2-backup'));
});

test('5. پل (bridge): availableSides اتحاد همهٔ سکتورهای واجد شرایط است', () => {
  const records = [legacyRecord(1, 75, 100), legacyRecord(2, 71, 100)];
  const state = toStationState(null, records);
  assert.ok(state.availableSides.includes('side-1-antenna'));
  assert.ok(state.availableSides.includes('side-2-backup'));
  assert.ok(!state.availableSides.includes('side-3-fuel'));
  // ترتیب: بر اساس سکتور مادر
  assert.equal(state.availableSides.indexOf('side-1-antenna'), 0);
});

test('6. جلسهٔ جانبی هرگز شمارش سلول‌های اصلی پل را آلوده نمی‌کند', () => {
  const sideSession = {
    sectorId: 1,
    activityType: 'side',
    missionId: 'side-1-antenna',
    status: 'IN_PROGRESS',
    questions: [{ questionId: 'q1', f1: 2, f2: 3 }],
    answers: { q1: { eventId: 'e1', questionId: 'q1', answer: 6 } },
    receipts: { e1: { eventId: 'e1', questionId: 'q1', correct: true, status: 'ACKNOWLEDGED' } }
  };
  const state = toStationState(sideSession, []);
  assert.deepEqual(state.cells, { 1: 0, 2: 0, 3: 0 });

  // در مقابل، جلسهٔ اصلی همان رفتار قبلی را دارد
  const coreSession = { ...sideSession, activityType: 'depth' };
  const coreState = toStationState(coreSession, []);
  assert.equal(coreState.cells[1], 1);
});

test('7. رکورد جلسهٔ جانبی با missionId ذخیره می‌شود اما درصد سکتور را تغییر نمی‌دهد', () => {
  const records = [legacyRecord(1, 80, 100)];
  const before = stationSystems(records).find(s => s.sectorId === 1).percent;

  const sideSession = {
    sessionId: 'sess_side',
    sectorId: 1,
    activity: 'mission',
    activityType: 'side',
    depth: null,
    missionId: 'side-1-antenna',
    rulesVersion: RULES_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    status: 'FINALIZED',
    score: 5,
    total: 5,
    questions: generateSideMissionQuestions('side-1-antenna', 0),
    answers: {},
    receipts: {},
    bottleneckHits: ['equal-groups'],
    fluentCount: 0
  };
  const next = keepStationRecord(records, sideSession, { status: 'FINALIZED', score: 5, total: 5 });
  const sideRecord = next.find(r => r.type === 'side');
  assert.ok(sideRecord, 'رکورد side باید ذخیره شود');
  assert.equal(sideRecord.missionId, 'side-1-antenna');
  assert.equal(sideRecord.percent, 100);

  const after = stationSystems(next).find(s => s.sectorId === 1).percent;
  assert.equal(after, before, 'درصد سکتور نباید از رکورد جانبی تغییر کند (affectsLeaderboard: false)');
});

test('8. شیپ: دکمه‌های مأموریت جانبی اکشن start-side-mission را حمل می‌کنند', () => {
  const sheet = createStationSheet({
    currentBuilding: 1,
    isFinished: false,
    completedBuildings: [],
    availableSides: ['side-1-antenna'],
    currentDepth: 1
  });

  const buttons = sheet.getSideMissionButtons();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].missionId, 'side-1-antenna');
  assert.equal(buttons[0].action, 'start-side-mission');
  assert.equal(buttons[0].canProceed, true);
  assert.equal(buttons[0].questionCount, 5);

  const outcome = sheet.onSideMissionButton('side-1-antenna');
  assert.equal(outcome.action, 'start-side-mission');
  assert.equal(outcome.canProceed, true);

  const invalid = sheet.onSideMissionButton('hack-id');
  assert.equal(invalid.canProceed, false);
});

test('9. لایهٔ ایستگاه: availableSides از stationState به شیپ می‌رسد (اتصال کامل)', () => {
  const records = [legacyRecord(1, 85, 100)];
  const stationState = toStationState(null, records);
  const layer = createStationLayer({ stationState, session: null });

  const sides = layer.sheet.getAvailableSides();
  assert.equal(sides.length, 1);
  assert.equal(sides[0].id, 'side-1-antenna');
  assert.ok(layer.sheet.getSideMissionButtons().length === 1);
});

test('10. تولیدکننده با ورودی ناقص ایمن می‌ماند (Pure و بدون استثنا)', () => {
  assert.deepEqual(generateSideMissionQuestions(null), []);
  assert.deepEqual(generateSideMissionQuestions(undefined, 'NaN-input'), []);
  assert.doesNotThrow(() => generateSideMissionQuestions('side-3-fuel', 1e9));
});

test('11. جلسهٔ اصلی بدون activityId نباید رکورد جانبی را بلعیده باشد (رفع باگ activityId)', () => {
  // شبیه‌سازی سناریوی واقعی مرورگر: رکورد اصلی با activityId تعریف‌نشده (بستهٔ ۱۰.۱ پیش از اصلاح)
  const legacyCoreRecord = {
    activityId: undefined,
    type: 'core',
    sectorId: 1,
    rulesVersion: RULES_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    score: 8, total: 8, percent: 100
  };
  const sideSession = {
    sessionId: 'sess_side',
    activityId: 'side-1-antenna', // پس از اصلاح، جلسهٔ جانبی هویت مستقل دارد
    sectorId: 1,
    activity: 'mission',
    activityType: 'side',
    depth: null,
    missionId: 'side-1-antenna',
    rulesVersion: RULES_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    status: 'FINALIZED',
    questions: generateSideMissionQuestions('side-1-antenna', 0),
    answers: {}, receipts: {}
  };
  const next = keepStationRecord([legacyCoreRecord], sideSession, { status: 'FINALIZED', score: 5, total: 5 });
  assert.ok(next.some(r => r.type === 'side'), 'رکورد جانبی باید جدا از رکورد اصلی بماند');
  assert.equal(next.length, 2, 'هر دو رکورد باید موجود باشند');
});
