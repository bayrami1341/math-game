import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_MISSIONS,
  SIDE_F2_RANGE,
  generateSideMissionQuestions,
  isUnlocked,
  stationPower,
  RULES_VERSION,
  QUESTION_SET_VERSION
} from '../src/v9/experience.mjs';
import { toStationState } from '../src/v10/bridge.js';

test('1. Side missions: exactly 3 missions with correct parent sectors', () => {
  const missions = Object.values(SIDE_MISSIONS);
  assert.equal(missions.length, 3);
  assert.equal(SIDE_MISSIONS['side-1-antenna'].parentSectorId, 1);
  assert.equal(SIDE_MISSIONS['side-2-backup'].parentSectorId, 2);
  assert.equal(SIDE_MISSIONS['side-3-fuel'].parentSectorId, 3);
});

test('2. Side mission question count is locked at exactly 5 questions', () => {
  for (const id of ['side-1-antenna', 'side-2-backup', 'side-3-fuel']) {
    const questions = generateSideMissionQuestions(id, 0);
    assert.equal(questions.length, 5, `Mission ${id} must produce exactly 5 questions`);
  }
});

test('3. Deterministic generation with seed input', () => {
  const qA1 = generateSideMissionQuestions('side-1-antenna', 42);
  const qA2 = generateSideMissionQuestions('side-1-antenna', 42);
  assert.deepEqual(qA1, qA2, 'Identical seed must produce identical questions');

  const qB = generateSideMissionQuestions('side-1-antenna', 43);
  assert.notDeepEqual(qA1, qB, 'Different seed produces different questions');
});

test('4. Factors obey SIDE_F2_RANGE [2, 9]', () => {
  for (let s = 0; s < 10; s++) {
    const q = generateSideMissionQuestions('side-1-antenna', s);
    for (const item of q) {
      assert.ok(item.f2 >= SIDE_F2_RANGE.min && item.f2 <= SIDE_F2_RANGE.max);
    }
  }
});

test('5. Avoids identical factors (f1 !== f2) when possible', () => {
  const q = generateSideMissionQuestions('side-1-antenna', 0);
  for (const item of q) {
    if (item.f1 >= SIDE_F2_RANGE.min && item.f1 <= SIDE_F2_RANGE.max) {
      assert.notEqual(item.f1, item.f2);
    }
  }
});

test('6. Strategy mapping from parent sector bottlenecks', () => {
  const q1 = generateSideMissionQuestions('side-1-antenna', 0);
  assert.ok(q1.some(q => q.strategy === 'equal-groups' || q.strategy === 'commutativity' || q.strategy === 'skip-counting'));

  const q2 = generateSideMissionQuestions('side-2-backup', 0);
  assert.ok(q2.some(q => q.strategy === 'commutativity' || q.strategy === 'anchor-5'));
});

test('7. Side 3 fuel factors are [10, 20, 30] without ×11 or ×12', () => {
  const mission = SIDE_MISSIONS['side-3-fuel'];
  assert.deepEqual(mission.focus.factors, [10, 20, 30]);
  const questions = generateSideMissionQuestions('side-3-fuel', 0);
  for (const q of questions) {
    assert.ok([10, 20, 30].includes(q.f1));
    assert.ok(q.f2 <= 9);
  }
});

test('8. affectsLeaderboard is strictly false for all side missions', () => {
  for (const id in SIDE_MISSIONS) {
    assert.equal(SIDE_MISSIONS[id].affectsLeaderboard, false);
  }
});

test('9. Side mission sessions do not feed core cells in toStationState', () => {
  const sideSession = {
    activity: 'mission',
    activityType: 'side',
    sectorId: 1,
    questions: [{ questionId: 'q1', f1: 3, f2: 4 }],
    answers: { q1: { answer: 12, eventId: 'e1' } },
    receipts: { e1: { eventId: 'e1', correct: true, status: 'ACKNOWLEDGED' } }
  };
  const state = toStationState(sideSession, []);
  assert.equal(state.cells[1], 0, 'Side mission session must never add core energy cells');
});

test('10. Unlock requirement: parent sector >= 60%', () => {
  const recLow = [{ sectorId: 1, percent: 59, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, recLow), false);

  const recPass = [{ sectorId: 1, percent: 60, rulesVersion: RULES_VERSION, questionSetVersion: QUESTION_SET_VERSION }];
  assert.equal(isUnlocked(SIDE_MISSIONS['side-1-antenna'].unlock, recPass), true);
});

test('11. Invalid missionId returns empty array', () => {
  assert.deepEqual(generateSideMissionQuestions('unknown-mission'), []);
  assert.deepEqual(generateSideMissionQuestions(null), []);
});
