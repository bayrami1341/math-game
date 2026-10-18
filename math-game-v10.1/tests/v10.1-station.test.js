import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RULES_VERSION,
  QUESTION_SET_VERSION,
  LEGACY_QUESTION_SET,
  CORE_SECTORS,
  DEPTH_LAYERS,
  SIDE_MISSIONS,
  getCoreSectors,
  getDepthsForSector,
  getSideMissionsForSector,
  isUnlocked,
  stationSystems,
  stationPower,
  nextDestination,
  keepStationRecord,
  migrateLegacyRecords
} from '../src/v9/experience.mjs';

test('1. Core sectors: exactly 3 immutable sectors with orders 1, 2, 3', () => {
  const sectors = getCoreSectors();
  assert.equal(sectors.length, 3);
  assert.equal(sectors[0].sectorId, 1);
  assert.equal(sectors[0].key, 'power');
  assert.equal(sectors[1].sectorId, 2);
  assert.equal(sectors[1].key, 'tower');
  assert.equal(sectors[2].sectorId, 3);
  assert.equal(sectors[2].key, 'pad');

  // Verify factors and maxDepth
  assert.deepEqual(sectors[0].focus.factors, [2, 3, 4, 5]);
  assert.deepEqual(sectors[1].focus.factors, [6, 7, 8, 9]);
  assert.deepEqual(sectors[2].focus.factors, [10, 11, 12]);
  assert.equal(sectors[0].maxDepth, 3);
  assert.equal(sectors[1].maxDepth, 3);
  assert.equal(sectors[2].maxDepth, 3);
});

test('2. Depth layers: exactly 9 layers (3 per building) with locked question counts and difficulties', () => {
  const allLayers = Object.values(DEPTH_LAYERS);
  assert.equal(allLayers.length, 9);

  for (const s of [1, 2, 3]) {
    const depths = getDepthsForSector(s);
    assert.equal(depths.length, 3);

    // Depth 1: Basic, 8 questions
    assert.equal(depths[0].depth, 1);
    assert.equal(depths[0].difficulty, 'basic');
    assert.equal(depths[0].questionCount, 8);

    // Depth 2: Stable, 10 questions, unlock: 90% of depth 1
    assert.equal(depths[1].depth, 2);
    assert.equal(depths[1].difficulty, 'stable');
    assert.equal(depths[1].questionCount, 10);
    assert.equal(depths[1].unlock.minPercent, 90);

    // Depth 3: Conceptual, 6 questions, unlock: 85% of depth 2
    assert.equal(depths[2].depth, 3);
    assert.equal(depths[2].difficulty, 'conceptual');
    assert.equal(depths[2].questionCount, 6);
    assert.equal(depths[2].unlock.minPercent, 85);
  }

  // Verify the 6 mandatory bottlenecks are covered in depth 3
  const b1 = DEPTH_LAYERS['1-3'].focus.bottleneckTypes;
  const b2 = DEPTH_LAYERS['2-3'].focus.bottleneckTypes;
  const b3 = DEPTH_LAYERS['3-3'].focus.bottleneckTypes;
  const covered = new Set([...b1, ...b2, ...b3]);

  assert.equal(covered.has('equal-groups'), true);
  assert.equal(covered.has('skip-counting'), true);
  assert.equal(covered.has('neighbor-anchor'), true);
  assert.equal(covered.has('place-value'), true);
  assert.equal(covered.has('doubling'), true);
  assert.equal(covered.has('commutativity'), true);
  assert.equal(covered.size >= 6, true);
});

test('3. Side missions: 3 targeted missions, strictly affectsLeaderboard === false', () => {
  const sides = Object.values(SIDE_MISSIONS);
  assert.equal(sides.length, 3);

  for (const side of sides) {
    assert.equal(side.type, 'side');
    assert.equal(side.questionCount, 5);
    assert.equal(side.affectsLeaderboard, false, 'Side missions must NEVER affect main leaderboard');
    assert.equal(side.unlock.minPercent, 70);
  }
});

test('4. Pure unlock logic: core (80%), depth (90%, 85%), side (70%)', () => {
  // Core 1 is always unlocked
  assert.equal(isUnlocked(null, []), true);

  // Core 2 requires >= 80% on Core 1
  const recordsCore1Low = [{ sectorId: 1, type: 'core', score: 7, total: 10, percent: 70, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(CORE_SECTORS[2].unlock, recordsCore1Low), false);

  const recordsCore1High = [{ sectorId: 1, type: 'core', score: 8, total: 10, percent: 80, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(CORE_SECTORS[2].unlock, recordsCore1High), true);

  // Depth 1-2 requires >= 90% on 1-1
  const recordsDepth1Low = [{ sectorId: 1, depth: 1, type: 'depth', activityId: '1-1', percent: 85, score: 8, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(DEPTH_LAYERS['1-2'].unlock, recordsDepth1Low), false);

  const recordsDepth1High = [{ sectorId: 1, depth: 1, type: 'depth', activityId: '1-1', percent: 90, score: 9, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(DEPTH_LAYERS['1-2'].unlock, recordsDepth1High), true);

  // Side mission requires >= 70% on parent core
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, recordsCore1Low), true);
});

test('5. stationSystems: dynamic calculation with NO hardcoded 3 and exposes currentDepth & availableSides', () => {
  const records = [
    { sectorId: 1, type: 'core', percent: 100, score: 10, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 1, type: 'depth', activityId: '1-1', percent: 95, score: 8, total: 8, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 1, depth: 2, type: 'depth', activityId: '1-2', percent: 90, score: 10, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];

  const systems = stationSystems(records);
  assert.equal(systems.length, 3);
  assert.equal(systems[0].complete, true);
  assert.equal(systems[0].percent, 100);
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
    { sectorId: 1, type: 'core', percent: 100, score: 10, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, type: 'core', percent: 40, score: 4, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 3, type: 'core', percent: 80, score: 8, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];
  assert.equal(nextDestination(records), 2);

  // When all complete, returns null
  const allComplete = [
    { sectorId: 1, type: 'core', percent: 100, score: 10, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 2, type: 'core', percent: 100, score: 10, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION },
    { sectorId: 3, type: 'core', percent: 100, score: 10, total: 10, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }
  ];
  assert.equal(nextDestination(allComplete), null);
});

test('8. keepStationRecord: captures type, depth, missionId, bottleneckHits, fluentCount', () => {
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

  // Weaker replay preserves the better result
  const weaker = { status: 'FINALIZED', score: 4, total: 6 };
  const records2 = keepStationRecord(records, session, weaker);
  assert.equal(records2[0].percent, 100);
  assert.equal(records2[0].score, 6);
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

  // Idempotency: migrating already migrated records leaves them untouched
  const migratedTwice = migrateLegacyRecords(migrated);
  assert.deepEqual(migratedTwice, migrated);
});

test('10. Compatibility with legacy graph-v8.1 records and mixed records', () => {
  const mixedRecords = [
    { sectorId: 1, score: 5, total: 5, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' },
    { sectorId: 2, type: 'core', score: 8, total: 10, percent: 80, rulesVersion: 'rv1', questionSetVersion: 'graph-v10.1' }
  ];
  const systems = stationSystems(mixedRecords);
  assert.equal(systems[0].percent, 100);
  assert.equal(systems[0].complete, true);
  assert.equal(systems[1].percent, 80);
  assert.equal(systems[1].complete, false);
});
