'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const experience = import('../src/v9/experience.mjs');

test('flight movement tracks effort while receipts override provisional energy', async () => {
  const { flightProgress } = await experience;
  const session = { questions: [{ questionId: 'q1', f1: 2, f2: 3 }, { questionId: 'q2', f1: 3, f2: 3 }], answers: { q1: { eventId: 'e1', answer: 6 }, q2: { eventId: 'e2', answer: 0 } } };
  let view = flightProgress(session);
  assert.equal(view.percent, 100); assert.equal(view.lit, 1); assert.equal(view.pending, 2);
  session.receipts = { e1: { eventId: 'e1', status: 'ACKNOWLEDGED', correct: false } };
  view = flightProgress(session);
  assert.equal(view.lit, 0); assert.equal(view.pending, 1); assert.equal(view.confirmed, 1);
  session.status = 'FINALIZED'; session.score = 2;
  assert.equal(flightProgress(session).lit, 2, 'Final server score is authoritative');
});

test('only confirmed mission bests power the station and a lower replay preserves power', async () => {
  const { keepStationRecord, stationPower } = await experience;
  const session = { activity: 'mission', activityId: 'mission-sector-1', sectorId: 1, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1' };
  let records = keepStationRecord([], session, { status: 'ACTIVE', score: 7, total: 7 });
  assert.equal(stationPower(records), 0);
  records = keepStationRecord(records, { ...session, activity: 'practice' }, { status: 'FINALIZED', score: 7, total: 7 });
  assert.equal(stationPower(records), 0);
  records = keepStationRecord(records, session, { status: 'FINALIZED', score: 7, total: 7 });
  records = keepStationRecord(records, session, { status: 'FINALIZED', score: 2, total: 7 });
  assert.equal(stationPower(records), 33); assert.equal(records.length, 1); assert.equal(records[0].score, 7);
  assert.equal(stationPower([{ ...records[0], rulesVersion: 'future' }]), 0, 'Different scoring rules must not mix');
});

test('unsupported or suspended audio fails safely without an unhandled rejection', async () => {
  const { createSoundPlayer } = await experience;
  assert.equal(await createSoundPlayer(() => { throw new Error('unsupported'); })('correct'), false);
  assert.equal(await createSoundPlayer(() => ({ state: 'suspended', resume: async () => { throw new Error('blocked'); } }))('finish'), false);
});

test('station recommendation follows compatible best records without locking other routes', async () => {
  const { stationSystems, nextDestination } = await experience;
  const record = { activityId: 'mission-sector-1', sectorId: 1, rulesVersion: 'rv1', questionSetVersion: 'graph-v8.1', score: 7, total: 7 };
  assert.equal(nextDestination([]), 1);
  assert.equal(nextDestination([record]), 2);
  const systems = stationSystems([record, { ...record, score: 1 }, { ...record, sectorId: 2, rulesVersion: 'future' }]);
  assert.equal(systems[0].complete, true); assert.equal(systems[0].percent, 100);
  assert.equal(systems[1].started, false);
  assert.equal(nextDestination([record, { ...record, sectorId: 2, score: 4, total: 8 }]), 3);
});

test('visual multiplication groups model equal groups and reject unbounded input', async () => {
  const { multiplicationModel } = await experience;
  for (let f1 = 1; f1 <= 12; f1++) for (let f2 = 1; f2 <= 12; f2++) {
    const model = multiplicationModel({ f1, f2 });
    assert.equal(model.addends.length, f1);
    assert.equal(model.addends.reduce((sum, term) => sum + term, 0), f1 * f2);
    assert.equal(model.total, model.groups * model.each);
  }
  for (const bad of [null, { f1: 0, f2: 2 }, { f1: 50000, f2: 2 }, { f1: 2.5, f2: 3 }]) assert.equal(multiplicationModel(bad), null);
});

test('companion resumes the latest answer and respects server correctness', async () => {
  const { companionLine } = await experience;
  const session = { questions: [{ questionId: 'q1', f1: 2, f2: 3 }, { questionId: 'q2', f1: 3, f2: 3 }], answers: {} };
  const first = companionLine(session);
  session.answers.q1 = { eventId: 'e1', answer: 6 };
  const correct = companionLine(session);
  assert.notEqual(correct, first);
  session.receipts = { e1: { eventId: 'e1', status: 'ACKNOWLEDGED', correct: false } };
  assert.match(companionLine(session), /2 × 3 = 6/);
  session.answers.q2 = { eventId: 'e2', answer: 9 };
  assert.notEqual(companionLine(session), correct);
});
