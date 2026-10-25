import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RULES_VERSION,
  QUESTION_SET_VERSION,
  ACCEPTED_QUESTION_SETS,
  LAYER_PASS_MARK,
  UNLOCK_THRESHOLDS,
  CORE_SECTORS,
  DEPTH_LAYERS,
  SIDE_MISSIONS,
  getCoreSectors,
  getDepthsForSector,
  getSideMissionsForSector,
  sectorComplete,
  isUnlocked,
  stationSystems,
  stationPower,
  nextDestination,
  keepStationRecord,
  migrateLegacyRecords
} from '../src/v9/experience.mjs';

test('1. Core sectors: exactly 3 immutable sectors with orders 1, 2, 3 (v10.2: domains on textbook code 305)', () => {
  const sectors = getCoreSectors();
  assert.equal(sectors.length, 3);
  assert.equal(sectors[0].sectorId, 1);
  assert.equal(sectors[0].key, 'power');
  assert.equal(sectors[1].sectorId, 2);
  assert.equal(sectors[1].key, 'tower');
  assert.equal(sectors[2].sectorId, 3);
  assert.equal(sectors[2].key, 'pad');

  // Verify factors and domains
  assert.deepEqual(sectors[0].focus.factors, [2, 3, 4, 5]);
  assert.deepEqual(sectors[1].focus.factors, [6, 7, 8, 9]);
  // v10.2: ×11 and ×12 removed (outside textbook)
  assert.deepEqual(sectors[2].focus.domains, ['x10', 'zero-one', 'multi-digit']);
  assert.equal(sectors[2].focus.maxProduct, 999);
  assert.equal(sectors[0].maxDepth, 3);
  assert.equal(sectors[1].maxDepth, 3);
  assert.equal(sectors[2].maxDepth, 3);
});

test('2. Depth layers: exactly 9 layers (3 per building) with v10.2 pass marks 70, 75, 80', () => {
  const allLayers = Object.values(DEPTH_LAYERS);
  assert.equal(allLayers.length, 9);

  for (const s of [1, 2, 3]) {
    const depths = getDepthsForSector(s);
    assert.equal(depths.length, 3);

    // Depth 1: Basic, 6 questions — v10.2 (52387ba) DEPTH_LAYERS را صعودی ۶/۸/۱۰ کرد
    assert.equal(depths[0].depth, 1);
    assert.equal(depths[0].difficulty, 'basic');
    assert.equal(depths[0].questionCount, 6);

    // Depth 2: Stable, 8 questions, unlock: 70% of depth 1
    assert.equal(depths[1].depth, 2);
    assert.equal(depths[1].difficulty, 'stable');
    assert.equal(depths[1].questionCount, 8);
    assert.equal(depths[1].unlock.minPercent, LAYER_PASS_MARK[1]);

    // Depth 3: Conceptual, 10 questions, unlock: 75% of depth 2
    assert.equal(depths[2].depth, 3);
    assert.equal(depths[2].difficulty, 'conceptual');
    assert.equal(depths[2].questionCount, 10);
    assert.equal(depths[2].unlock.minPercent, LAYER_PASS_MARK[2]);
  }
});

test('3. Side missions: 3 targeted missions, strictly affectsLeaderboard === false', () => {
  const sides = Object.values(SIDE_MISSIONS);
  assert.equal(sides.length, 3);

  for (const side of sides) {
    assert.equal(side.type, 'side');
    assert.equal(side.questionCount, 5);
    assert.equal(side.affectsLeaderboard, false, 'Side missions must NEVER affect main leaderboard');
    assert.equal(side.unlock.minPercent, UNLOCK_THRESHOLDS.side);
  }
});

test('4. Pure unlock logic: core-complete, depth (70%, 75%), side (60%)', () => {
  // Core 1 is always unlocked
  assert.equal(isUnlocked(null, []), true);

  // Core 2 requires completion of all 3 layers of Core 1
  const recordsIncomplete = [
    { sectorId: 1, depth: 1, type: 'depth', score: 8, total: 8, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 2, type: 'depth', score: 8, total: 10, percent: 80, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
    // depth 3 missing
  ];
  assert.equal(isUnlocked(CORE_SECTORS[2].unlock, recordsIncomplete), false);

  const recordsComplete = [
    ...recordsIncomplete,
    { sectorId: 1, depth: 3, type: 'depth', score: 5, total: 6, percent: 83, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];
  assert.equal(isUnlocked(CORE_SECTORS[2].unlock, recordsComplete), true);

  // Depth 1-2 requires >= 70% on 1-1
  const recordsDepth1Low = [{ sectorId: 1, depth: 1, type: 'depth', activityId: '1-1', percent: 65, score: 5, total: 8, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(DEPTH_LAYERS['1-2'].unlock, recordsDepth1Low), false);

  const recordsDepth1Pass = [{ sectorId: 1, depth: 1, type: 'depth', activityId: '1-1', percent: 70, score: 7, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(DEPTH_LAYERS['1-2'].unlock, recordsDepth1Pass), true);

  // Side mission requires >= 60% on parent core
  const recordsSideLow = [{ sectorId: 1, type: 'core', percent: 55, score: 5, total: 9, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, recordsSideLow), false);
  const recordsSidePass = [{ sectorId: 1, type: 'core', percent: 60, score: 6, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, recordsSidePass), true);
});

test('5. stationSystems: dynamic calculation with NO hardcoded 3 and exposes currentDepth & availableSides', () => {
  const records = [
    { sectorId: 1, depth: 1, type: 'depth', activityId: '1-1', percent: 75, score: 6, total: 8, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 2, type: 'depth', activityId: '1-2', percent: 80, score: 8, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];

  const systems = stationSystems(records);
  assert.equal(systems.length, 3);
  assert.equal(systems[0].complete, false);
  assert.equal(systems[0].percent, 80);
  assert.equal(systems[0].currentDepth, 2);
  assert.deepEqual(systems[0].availableSides, ['side-1-antenna']);

  assert.equal(systems[1].complete, false);
  assert.equal(systems[1].percent, 0);
  assert.equal(systems[1].currentDepth, 0);
  assert.deepEqual(systems[1].availableSides, []);
});

test('6. stationPower: purely averages across core sectors dynamically', () => {
  assert.equal(stationPower([]), 0);

  const records = [
    { sectorId: 1, type: 'core', percent: 90, score: 9, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, type: 'core', percent: 60, score: 6, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];
  // (90 + 60 + 0) / 3 = 50%
  assert.equal(stationPower(records), 50);
});

test('7. nextDestination: finds lowest incomplete sector dynamically', () => {
  const records = [
    { sectorId: 1, depth: 1, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 2, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 3, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, depth: 1, percent: 40, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 3, depth: 1, percent: 80, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];
  assert.equal(nextDestination(records), 2);

  // When all complete, returns null
  const allComplete = [
    { sectorId: 1, depth: 1, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 2, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 3, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, depth: 1, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, depth: 2, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, depth: 3, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 3, depth: 1, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 3, depth: 2, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 3, depth: 3, percent: 100, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];
  assert.equal(nextDestination(allComplete), null);
});

test('8. keepStationRecord: captures type, depth, missionId, bottleneckHits, fluentCount', () => {
  const session = {
    activity: 'mission',
    activityId: 'station-1-depth-3',
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
});

test('9. migrateLegacyRecords: idempotently upgrades legacy records without type', () => {
  const legacy = [
    { sectorId: 1, score: 8, total: 10, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 2, type: 'depth', depth: 1, percent: 90, score: 9, total: 10, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }
  ];

  const migrated = migrateLegacyRecords(legacy);
  assert.equal(migrated[0].type, 'core');
  assert.equal(migrated[0].percent, 80);
  assert.equal(migrated[1].type, 'depth');
  assert.equal(migrated[1].depth, 1);

  const migratedTwice = migrateLegacyRecords(migrated);
  assert.deepEqual(migratedTwice, migrated);
});

test('10. Compatibility with legacy graph-v8.1 and graph-v10.1 records (preserves child progress)', () => {
  const legacy100 = [
    { sectorId: 1, score: 8, total: 8, percent: 100, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }
  ];
  assert.equal(sectorComplete(legacy100, 1), true, 'جلسه ۱۰۰٪ قدیمی بنا را کامل می‌شمارد');

  const legacyLower = [
    { sectorId: 1, score: 6, total: 8, percent: 75, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }
  ];
  assert.equal(sectorComplete(legacyLower, 1), false, 'جلسه ناقص قدیمی بنا را کامل نمی‌شمارد');
});

test('11. Regression test P0 bug: layer 1 record with type "core" correctly unlocks layer 2', () => {
  // باگ P0: جلسه لایه ۱ قبلاً با type: 'core' ذخیره می‌شد و فیلتر فقط type: 'depth' بود
  const layer1AsCore = [
    { sectorId: 1, depth: 1, type: 'core', activityId: '1-1', percent: 75, score: 6, total: 8, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];

  const canUnlockDepth2 = isUnlocked(DEPTH_LAYERS['1-2'].unlock, layer1AsCore);
  assert.equal(canUnlockDepth2, true, 'لایه ۱ با type core باید لایه ۲ را باز کند');
});
