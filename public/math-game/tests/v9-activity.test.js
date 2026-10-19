'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Service, ApiError } = require('../server/service');
const { LocalStore } = require('../server/store');
const child = { uid: 'hero-device' }, other = { uid: 'other-device' }, teacher = { uid: 'teacher', teacher: true };
let seq = 0;
const request = input => ({ schemaVersion: 1, requestId: 'req_activity_' + ++seq, ...input });
async function fixture() {
  const store = new LocalStore(), service = new Service(store, { secret: 'activity-test-secret-'.repeat(3) });
  const call = (op, input, actor = child) => service.call(op, input, actor);
  const profile = await call('createStudent', request({ displayName: 'قهرمان' }));
  const start = (activity = 'mission', extra = {}) => call('startActivity', request({ studentId: profile.studentId, activity, sectorId: 1, ...extra }));
  const finish = async (session, wrong = false) => {
    await call('submitAttempts', request({ sessionId: session.sessionId, writerEpoch: 1, attempts: session.questions.map((q, i) => ({ eventId: 'evt_activity_' + i, questionId: q.questionId, answer: wrong ? 0 : q.f1 * q.f2 })) }));
    return call('finalizeSession', request({ sessionId: session.sessionId, writerEpoch: 1 }));
  };
  const collection = () => call('getCollection', { schemaVersion: 1, studentId: profile.studentId });
  return { store, service, call, profile, start, finish, collection };
}
test('personal practice needs no invented classroom and cannot be inspected by teachers or other identities', async () => {
  const f = await fixture(), session = await f.start('practice');
  assert.equal(session.classId, null);
  const result = await f.finish(session); assert.equal(result.activity, 'practice');
  for (const actor of [teacher, other]) {
    await assert.rejects(f.call('getSyncStatus', { schemaVersion: 1, sessionId: session.sessionId }, actor), error => error instanceof ApiError && error.code === 'FORBIDDEN');
    await assert.rejects(f.call('getCollection', { schemaVersion: 1, studentId: f.profile.studentId }, actor), error => error.code === 'FORBIDDEN');
  }
  assert.equal((await f.collection()).best.length, 0);
  assert.deepEqual((await f.collection()).achievements.map(item => item.id), ['first-practice-v1']);
});
test('only finalized missions earn records; poorer results and request replay preserve the best', async () => {
  const f = await fixture(), session = await f.start();
  assert.deepEqual((await f.collection()).best, []);
  const result = await f.finish(session);
  const finish = request({ sessionId: session.sessionId, writerEpoch: 1 });
  await f.call('finalizeSession', finish); await f.call('finalizeSession', finish);
  await f.finish(await f.start(), true);
  const collection = await f.collection();
  assert.equal(collection.best.length, 1); assert.equal(collection.best[0].score, result.total);
  assert.deepEqual(collection.achievements.map(item => item.id).sort(), ['first-mission-v1', 'perfect-mission-v1']);
  assert.equal(collection.sessions.length, 2);
});
test('server records survive a bounded recent-history window', async () => {
  const f = await fixture(), session = await f.start(); await f.finish(session);
  for (let i = 0; i < 101; i++) await f.store.transact('studentSessions/' + f.profile.studentId + '/ses_later_' + i, () => ({ sessionId: 'missing-' + i, createdAt: '2999-01-01' }));
  const collection = await f.collection();
  assert.equal(collection.best[0].score, session.questions.length);
  assert.equal(collection.achievements.length, 2); assert.equal(collection.historyTruncated, true);
});
test('a failed collection write is repaired by retrying finalization without losing the award', async () => {
  const f = await fixture(), session = await f.start();
  const transact = f.store.transact.bind(f.store); let interrupt = true;
  f.store.transact = (key, change) => {
    if (key.startsWith('collections/') && interrupt) { interrupt = false; return Promise.reject(new Error('interrupted')); }
    return transact(key, change);
  };
  await assert.rejects(f.finish(session));
  await f.call('finalizeSession', request({ sessionId: session.sessionId, writerEpoch: 1 }));
  assert.equal((await f.collection()).achievements.length, 2);
});
test('class activity requires active membership and private practice stays out of teacher reports', async () => {
  const f = await fixture(); await f.finish(await f.start('practice'));
  const classroom = await f.call('createClass', request({ name: 'کلاس' }), teacher);
  const invite = await f.call('issueInvite', request({ classId: classroom.classId }), teacher);
  await f.call('joinStudentClass', request({ studentId: f.profile.studentId, token: invite.token }));
  await assert.rejects(f.start('mission', { classId: classroom.classId }), error => error.code === 'FORBIDDEN');
  await f.call('setMembership', request({ classId: classroom.classId, studentId: f.profile.studentId, status: 'active' }), teacher);
  await f.finish(await f.start('mission', { classId: classroom.classId }));
  const report = await f.call('getClass', { schemaVersion: 1, classId: classroom.classId }, teacher);
  assert.equal(report.sessions.length, 1); assert.equal(report.sessions[0].activity, 'mission');
});
test('activity type and classroom are immutable across retries; no forged score is accepted', async () => {
  const f = await fixture();
  const input = request({ studentId: f.profile.studentId, activity: 'mission', sectorId: 1 });
  const a = await f.call('startActivity', input), b = await f.call('startActivity', input);
  assert.deepEqual(a, b);
  await assert.rejects(f.call('startActivity', { ...input, activity: 'practice' }), error => error.code === 'EVENT_CONFLICT');
  await assert.rejects(f.call('startActivity', { ...input, score: 100 }), error => error.code === 'INVALID_PAYLOAD');
});
test('mission choice cards are unique, nonnegative and contain the actual product exactly once', async () => {
  const { missionChoices } = await import('../src/v9/mission.mjs');
  const { FACTS } = require('../src/core/graph-data');
  FACTS.forEach((fact, i) => {
    const values = missionChoices({ ...fact, questionId: 'q-' + (i + 1) });
    assert.equal(values.length, 4); assert.equal(new Set(values).size, 4);
    assert.ok(values.every(value => value >= 0)); assert.equal(values.filter(value => value === fact.f1 * fact.f2).length, 1);
  });
});
