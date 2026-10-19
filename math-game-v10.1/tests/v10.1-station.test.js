import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RULES_VERSION,
  QUESTION_SET_VERSION,
  LEGACY_QUESTION_SET,
  ACCEPTED_QUESTION_SETS,
  LAYER_PASS_MARK,
  UNLOCK_THRESHOLDS,
  CORE_SECTORS,
  DEPTH_LAYERS,
  SIDE_MISSIONS,
  getCoreSectors,
  getDepthsForSector,
  getSideMissionsForSector,
  isUnlocked,
  sectorComplete,
  stationSystems,
  stationPower,
  nextDestination,
  keepStationRecord,
  migrateLegacyRecords
} from '../src/v9/experience.mjs';

// سازندهٔ رکورد لایهٔ v10.2
const layerRecord = (sectorId, depth, score, total, extras = {}) => ({
  activityId: `${sectorId}-${depth}`,
  type: depth === 1 ? 'core' : 'depth',
  sectorId,
  depth,
  rulesVersion: RULES_VERSION,
  questionSetVersion: QUESTION_SET_VERSION,
  score,
  total,
  percent: Math.round(100 * score / total),
  completedAt: new Date().toISOString(),
  ...extras
});

test('1. Core sectors: exactly 3 immutable sectors with orders 1, 2, 3', () => {
  const sectors = getCoreSectors();
  assert.equal(sectors.length, 3);
  assert.equal(sectors[0].sectorId, 1);
  assert.equal(sectors[0].key, 'power');
  assert.equal(sectors[1].sectorId, 2);
  assert.equal(sectors[1].key, 'tower');
  assert.equal(sectors[2].sectorId, 3);
  assert.equal(sectors[2].key, 'pad');

  // v10.2: نیروگاه و برج جدول، سکو دامنه‌های کتاب (صفحه‌های ۱۳۶–۱۴۴) — ×۱۱ و ×۱۲ حذف شده‌اند
  assert.deepEqual(sectors[0].focus.factors, [2, 3, 4, 5]);
  assert.deepEqual(sectors[1].focus.factors, [6, 7, 8, 9]);
  assert.deepEqual(sectors[2].focus.domains, ['x10', 'zero-one', 'multi-digit']);
  assert.equal(sectors[0].maxDepth, 3);
  assert.equal(sectors[1].maxDepth, 3);
  assert.equal(sectors[2].maxDepth, 3);

  // برج با تکمیل سه‌لایه‌ای نیروگاه باز می‌شود؛ سکو با تکمیل برج
  assert.equal(sectors[1].unlock.require, 'core-complete');
  assert.equal(sectors[1].unlock.sectorId, 1);
  assert.equal(sectors[2].unlock.require, 'core-complete');
  assert.equal(sectors[2].unlock.sectorId, 2);
});

test('2. Depth layers: exactly 9 layers, thresholds 70/75/80, book domains, no doubling', () => {
  const allLayers = Object.values(DEPTH_LAYERS);
  assert.equal(allLayers.length, 9);

  for (const s of [1, 2, 3]) {
    const depths = getDepthsForSector(s);
    assert.equal(depths.length, 3);

    // لایهٔ ۱: پایه، ۸ سؤال، بدون آستانهٔ ورود
    assert.equal(depths[0].depth, 1);
    assert.equal(depths[0].difficulty, 'basic');
    assert.equal(depths[0].questionCount, 8);
    assert.equal(depths[0].unlock, null);

    // لایهٔ ۲: پایدار، ۱۰ سؤال، با ۷۰٪ لایهٔ ۱ باز می‌شود
    assert.equal(depths[1].depth, 2);
    assert.equal(depths[1].difficulty, 'stable');
    assert.equal(depths[1].questionCount, 10);
    assert.equal(depths[1].unlock.minPercent, UNLOCK_THRESHOLDS.layer1Pass);
    assert.equal(depths[1].unlock.minPercent, 70);

    // لایهٔ ۳: مفهومی، ۶ سؤال، با ۷۵٪ لایهٔ ۲ باز می‌شود
    assert.equal(depths[2].depth, 3);
    assert.equal(depths[2].difficulty, 'conceptual');
    assert.equal(depths[2].questionCount, 6);
    assert.equal(depths[2].unlock.minPercent, UNLOCK_THRESHOLDS.layer2Pass);
    assert.equal(depths[2].unlock.minPercent, 75);
  }

  // دامنه‌های سکو بر کتاب (سند فصل ۲)
  assert.equal(DEPTH_LAYERS['3-1'].domain, 'x10');
  assert.equal(DEPTH_LAYERS['3-2'].domain, 'zero-one');
  assert.equal(DEPTH_LAYERS['3-3'].domain, 'multi-digit');
  assert.equal(DEPTH_LAYERS['1-3'].paired, true);
  assert.equal(DEPTH_LAYERS['2-3'].paired, true);

  // گلوگاه‌های اجباری پوشش داده شده‌اند (لایه‌های ۳ + ۳–۲ صفر/یک) و «دوبرابر کردن» حذف شده است
  const b1 = DEPTH_LAYERS['1-3'].focus.bottleneckTypes;
  const b2 = DEPTH_LAYERS['2-3'].focus.bottleneckTypes;
  const b3 = DEPTH_LAYERS['3-3'].focus.bottleneckTypes;
  const b32 = DEPTH_LAYERS['3-2'].focus.bottleneckTypes;
  const covered = new Set([...b1, ...b2, ...b3, ...b32]);

  assert.equal(covered.has('equal-groups'), true);
  assert.equal(covered.has('skip-counting'), true);
  assert.equal(covered.has('commutativity'), true);
  assert.equal(covered.has('anchor-5'), true);
  assert.equal(covered.has('place-value'), true);
  assert.equal(covered.has('distributive-part'), true);
  assert.equal(covered.has('zero-property'), true);
  assert.equal(covered.has('identity'), true);
  // دوبرابر کردن گلوگاه اجباری کارگاه نیست (سند، گلوگاه ۵)
  assert.equal(covered.has('doubling'), false);
  // «ارزش مکانی» دیگر مال برج نیست — مال سکو است (صفحهٔ ۱۳۶+)
  assert.equal(DEPTH_LAYERS['2-3'].focus.bottleneckTypes.includes('place-value'), false);
  assert.equal(b3.includes('place-value'), true);
});

test('3. Side missions: 3 targeted missions, affectsLeaderboard === false, unlock at 60%', () => {
  const sides = Object.values(SIDE_MISSIONS);
  assert.equal(sides.length, 3);

  for (const side of sides) {
    assert.equal(side.type, 'side');
    assert.equal(side.questionCount, 5);
    assert.equal(side.affectsLeaderboard, false, 'Side missions must NEVER affect main leaderboard');
    assert.equal(side.unlock.minPercent, UNLOCK_THRESHOLDS.side);
    assert.equal(side.unlock.minPercent, 60);
  }
  // مأموریت جانبی سکو هم در دامنهٔ کتاب است (بدون ×۱۱ و ×۱۲)
  assert.deepEqual(SIDE_MISSIONS['side-3-fuel'].focus.factors, [10, 20, 30]);
});

test('4. sectorComplete: all three layers required (70/75/80); legacy 100% is honored', () => {
  assert.equal(LAYER_PASS_MARK[1], 70);
  assert.equal(LAYER_PASS_MARK[2], 75);
  assert.equal(LAYER_PASS_MARK[3], 80);

  // فقط لایهٔ ۱: بنا کامل نیست — حتی با ۱۰۰٪
  const onlyLayer1 = [layerRecord(1, 1, 8, 8)];
  assert.equal(sectorComplete(onlyLayer1, 1), false);

  // لایه‌های ۱ و ۲ گذرانده شده، لایهٔ ۳ نه
  const twoLayers = [layerRecord(1, 1, 6, 8), layerRecord(1, 2, 8, 10)];
  assert.equal(sectorComplete(twoLayers, 1), false);

  // لایهٔ ۲ زیر حد نصاب ۷۵٪
  const weakLayer2 = [layerRecord(1, 1, 6, 8), layerRecord(1, 2, 7, 10), layerRecord(1, 3, 5, 6)];
  assert.equal(sectorComplete(weakLayer2, 1), false);

  // هر سه لایه گذرانده شده: لایهٔ ۳ با ۸۰٪ بنا را کامل می‌کند
  const full = [layerRecord(1, 1, 6, 8), layerRecord(1, 2, 8, 10), layerRecord(1, 3, 5, 6)];
  assert.equal(sectorComplete(full, 1), true);

  // یک جلسهٔ کاملِ v10.2 هرگز به‌تنهایی بنا را کامل نمی‌کند
  const singlePerfect = [layerRecord(1, 1, 8, 8)];
  assert.equal(sectorComplete(singlePerfect, 1), false);

  // احترام به پیشرفت نسخه‌های ۱۰/۱۰.۱: جلسهٔ ۱۰۰٪ قدیمی بنا را کامل می‌شمارد
  const legacyFull = [{ sectorId: 1, score: 8, total: 8, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }];
  assert.equal(sectorComplete(legacyFull, 1), true);
  const legacyV8 = [{ sectorId: 1, score: 5, total: 5, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' }];
  assert.equal(sectorComplete(legacyV8, 1), true);

  // رکورد نسخه‌های ناشناخته نادیده گرفته می‌شود
  const unknownVersion = [{ sectorId: 1, score: 8, total: 8, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v0.9' }];
  assert.equal(sectorComplete(unknownVersion, 1), false);
});

test('5. isUnlocked: core-complete for buildings, depth 70/75, side 60', () => {
  // Core 1 همیشه باز است
  assert.equal(isUnlocked(null, []), true);

  // برج: با تکمیل سه‌لایه‌ای نیروگاه
  const powerLayers = [layerRecord(1, 1, 6, 8), layerRecord(1, 2, 8, 10), layerRecord(1, 3, 5, 6)];
  assert.equal(isUnlocked(CORE_SECTORS[2].unlock, powerLayers), true);

  const powerPartial = [layerRecord(1, 1, 6, 8), layerRecord(1, 2, 8, 10)];
  assert.equal(isUnlocked(CORE_SECTORS[2].unlock, powerPartial), false);

  // لایهٔ ۱–۲: با ۷۰٪ لایهٔ ۱
  const depth1Low = [layerRecord(1, 1, 5, 8)]; // ۶۳٪
  assert.equal(isUnlocked(DEPTH_LAYERS['1-2'].unlock, depth1Low), false);
  const depth1High = [layerRecord(1, 1, 6, 8)]; // ۷۵٪
  assert.equal(isUnlocked(DEPTH_LAYERS['1-2'].unlock, depth1High), true);
  const depth1Mid = [layerRecord(1, 1, 4, 8)]; // ۵۰٪ — زیر سقف مأموریت جانبی

  // مأموریت جانبی: با ۶۰٪ بهترین لایهٔ بنا
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, depth1Mid), false);
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, depth1Low), true);
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, depth1High), true);
});

test('6. stationSystems: 3-layer completion, pass-mark currentDepth, availableSides at 60%', () => {
  // هر سه لایهٔ نیروگاه گذرانده شده
  const records = [
    layerRecord(1, 1, 6, 8),
    layerRecord(1, 2, 8, 10),
    layerRecord(1, 3, 5, 6)
  ];

  const systems = stationSystems(records);
  assert.equal(systems.length, 3);
  assert.equal(systems[0].complete, true);
  assert.equal(systems[0].percent, 83); // بهترین جلسه (لایهٔ ۳: ۵ از ۶) برای نمایش
  assert.equal(systems[0].currentDepth, 3);
  assert.deepEqual(systems[0].availableSides, ['side-1-antenna']);

  assert.equal(systems[1].complete, false);
  assert.equal(systems[1].percent, 0);
  assert.equal(systems[1].currentDepth, 0);
  assert.deepEqual(systems[1].availableSides, []);

  // تکمیل نسخهٔ قدیمی هم معتبر است
  const legacyDone = stationSystems([{ sectorId: 1, score: 5, total: 5, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }]);
  assert.equal(legacyDone[0].complete, true);
});

test('7. stationPower: purely averages across core sectors dynamically', () => {
  assert.equal(stationPower([]), 0);

  const records = [
    layerRecord(1, 1, 9, 10),
    layerRecord(2, 1, 6, 10)
  ];
  // (90 + 60 + 0) / 3 = 50%
  assert.equal(stationPower(records), 50);
});

test('8. nextDestination: finds lowest incomplete sector dynamically', () => {
  const records = [
    layerRecord(1, 1, 10, 10),
    layerRecord(2, 1, 4, 10),
    layerRecord(3, 1, 8, 10)
  ];
  assert.equal(nextDestination(records), 2);

  // همه کامل (نسخهٔ قدیمی ۱۰۰٪) → null
  const allComplete = [
    { sectorId: 1, score: 5, total: 5, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' },
    { sectorId: 2, score: 5, total: 5, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' },
    { sectorId: 3, score: 5, total: 5, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }
  ];
  assert.equal(nextDestination(allComplete), null);
});

test('9. keepStationRecord: captures type, depth, missionId, bottleneckHits, fluentCount', () => {
  const session = {
    activity: 'mission',
    activityId: 'mission-depth-1-3',
    activityType: 'depth',
    sectorId: 1,
    depth: 3,
    rulesVersion: RULES_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    bottleneckHits: ['equal-groups'],
    fluentCount: 5
  };
  const result = { status: 'FINALIZED', score: 6, total: 6 };

  const records = keepStationRecord([], session, result);
  assert.equal(records.length, 1);
  assert.equal(records[0].type, 'depth');
  assert.equal(records[0].depth, 3);
  assert.equal(records[0].percent, 100);
  assert.deepEqual(records[0].bottleneckHits, ['equal-groups']);
  assert.equal(records[0].fluentCount, 5);

  // تلاش ضعیف‌تر بهترین نتیجه را حفظ می‌کند
  const weaker = { status: 'FINALIZED', score: 4, total: 6 };
  const records2 = keepStationRecord(records, session, weaker);
  assert.equal(records2[0].percent, 100);
  assert.equal(records2[0].score, 6);
});

test('10. migrateLegacyRecords: idempotently upgrades legacy records without type', () => {
  const legacy = [
    { sectorId: 1, score: 8, total: 10, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 2, type: 'depth', depth: 1, percent: 90, score: 9, total: 10, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }
  ];

  const migrated = migrateLegacyRecords(legacy);
  assert.equal(migrated[0].type, 'core');
  assert.equal(migrated[0].percent, 80);
  assert.equal(migrated[1].type, 'depth');
  assert.equal(migrated[1].depth, 1);

  // idempotency
  const migratedTwice = migrateLegacyRecords(migrated);
  assert.deepEqual(migratedTwice, migrated);
});

test('11. Migration: graph-v10.1 and graph-v8.1 records stay accepted alongside graph-v10.2', () => {
  assert.deepEqual([...ACCEPTED_QUESTION_SETS], ['graph-v10.2', 'graph-v10.1', 'graph-v8.1']);
  assert.equal(QUESTION_SET_VERSION, 'graph-v10.2');
  assert.equal(LEGACY_QUESTION_SET, 'graph-v8.1');

  const mixedRecords = [
    { sectorId: 1, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 2, type: 'core', depth: 1, score: 8, total: 10, percent: 80, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' },
    { sectorId: 3, type: 'core', depth: 1, score: 7, total: 8, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.2' }
  ];
  const systems = stationSystems(mixedRecords);
  assert.equal(systems[0].percent, 100);
  assert.equal(systems[0].complete, true); // کاملِ نسخهٔ قدیمی محترم است
  assert.equal(systems[1].percent, 80);
  assert.equal(systems[1].complete, false);
  assert.equal(systems[2].percent, Math.round(100 * 7 / 8));
  assert.equal(getSideMissionsForSector(3).length, 1);
});
