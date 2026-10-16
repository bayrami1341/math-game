'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Service, ApiError } = require('../server/service');
const { LocalStore } = require('../server/store');
const teacher = { uid: 'teacher-board', teacher: true }, child = { uid: 'child-board' };
let seq = 0;
const request = input => ({ schemaVersion: 1, requestId: 'req_board_' + ++seq, ...input });
const error = code => value => value instanceof ApiError && value.code === code;
async function fixture() {
  const store = new LocalStore(), service = new Service(store, { secret: 'board-test-secret-'.repeat(3) });
  const call = (op, input, actor = teacher) => service.call(op, input, actor);
  const classroom = await call('createClass', request({ name: 'کلاس آزمایش', policy: { membership: 'invite_open' } }));
  const classId = classroom.classId;
  const invite = await call('issueInvite', request({ classId }));
  const member = await call('redeemInvite', request({ token: invite.token, displayName: 'مینا' }), child);
  const studentId = member.studentId;
  const board = (actor = child, extra = {}) => call('getLeaderboard', { schemaVersion: 1, classId, studentId, sectorId: 1, ...extra }, actor);
  async function finish({ activity = 'mission', score = 4, sectorId = 1, actor = child, id = studentId, personal = false } = {}) {
    const session = await call('startActivity', request({ studentId: id, activity, sectorId, ...(personal ? {} : { classId }) }), actor);
    await call('submitAttempts', request({ sessionId: session.sessionId, writerEpoch: 1, attempts: session.questions.map((q, i) => ({ eventId: 'evt_board_' + ++seq, questionId: q.questionId, answer: i < score ? q.f1 * q.f2 : -1 })) }), actor);
    const input = request({ sessionId: session.sessionId, writerEpoch: 1 });
    await call('finalizeSession', input, actor);
    return { session, input };
  }
  return { store, call, classId, studentId, invite, board, finish };
}
test('board keeps finalized comparable class mission bests with equal ranks and no private identity fields', async () => {
  const f = await fixture(); await f.finish();
  assert.deepEqual((await f.board()).entries, []);
  await f.call('setClassPolicy', request({ classId: f.classId, revision: 1, leaderboard: 'on' }));
  await f.finish({ activity: 'practice', score: 7 }); await f.finish({ personal: true, score: 7 });
  await f.finish({ sectorId: 2, score: 8 }); await f.finish({ score: 2 });
  // Even an otherwise valid record from another rule version stays separate.
  await f.call('startActivity', request({ studentId: f.studentId, classId: f.classId, activity: 'mission', sectorId: 1 }), child);
  const first = await f.board(); assert.equal(first.entries.length, 1); assert.equal(first.entries[0].score, 4); assert.equal(first.entries[0].isMe, true);
  assert.deepEqual(Object.keys(first.entries[0]).sort(), ['displayName','isMe','rank','score','studentId','total'].sort());
  const second = { uid: 'board-second' };
  const member = await f.call('redeemInvite', request({ token: f.invite.token, displayName: 'مینا' }), second);
  await f.finish({ actor: second, id: member.studentId });
  assert.deepEqual((await f.board()).entries.map(row => row.rank), [1, 1]);
  await assert.rejects(f.board({ uid: 'stranger' }), error('FORBIDDEN'));
  await assert.rejects(f.board({ uid: 'other-teacher', teacher: true }), error('FORBIDDEN'));
  await f.call('setMembership', request({ classId: f.classId, studentId: member.studentId, status: 'revoked' }));
  assert.equal((await f.board()).entries.length, 1);
  await assert.rejects(f.board(second, { studentId: member.studentId }), error('FORBIDDEN'));
  await f.call('setClassPolicy', request({ classId: f.classId, revision: 2, leaderboard: 'off' }));
  assert.deepEqual((await f.board()).entries, []);
});
test('teacher class lists are private; stale policy updates fail and old retries never undo newer policy', async () => {
  const f = await fixture(), classId = f.classId;
  assert.equal((await f.call('getTeacherClasses', { schemaVersion: 1 })).classes[0].classId, classId);
  assert.deepEqual((await f.call('getTeacherClasses', { schemaVersion: 1 }, { uid: 'other', teacher: true })).classes, []);
  await assert.rejects(f.call('getTeacherClasses', { schemaVersion: 1 }, child), error('FORBIDDEN'));
  const on = request({ classId, revision: 1, leaderboard: 'on' }); await f.call('setClassPolicy', on);
  await assert.rejects(f.call('setClassPolicy', request({ classId, revision: 1, leaderboard: 'off' })), error('EVENT_CONFLICT'));
  await f.call('setClassPolicy', request({ classId, revision: 2, leaderboard: 'off' })); await f.call('setClassPolicy', on);
  assert.equal((await f.call('getClass', { schemaVersion: 1, classId })).policy.leaderboard, 'off');
  await assert.rejects(f.call('setClassPolicy', request({ classId, revision: 3, leaderboard: 'on' }), child), error('FORBIDDEN'));
  for (const extra of [{ sectorId: 4 }, { score: 100 }, { classId: '../other' }]) await assert.rejects(f.board(child, extra), error('INVALID_PAYLOAD'));
});
test('retrying finalization repairs interrupted board writes and bests outlive recent history', async () => {
  const f = await fixture(), original = f.store.transact.bind(f.store); let failOnce = true;
  f.store.transact = (key, updater) => { if (key.startsWith('classBoards/') && failOnce) { failOnce = false; throw new Error('Interrupted board write'); } return original(key, updater); };
  await assert.rejects(f.finish({ score: 7 }));
  const session = Object.values(f.store.data).find(item => item.sessionId && item.status === 'FINALIZED' && item.questions);
  await f.call('finalizeSession', request({ sessionId: session.sessionId, writerEpoch: 1 }), child);
  for (let i = 0; i < 22; i++) await f.finish({ score: 1 });
  await f.call('setClassPolicy', request({ classId: f.classId, revision: 1, leaderboard: 'on' }));
  assert.equal((await f.board()).entries[0].score, 7);
});

test('cold-start metadata retries are bounded and do not accept a different service or HTML response', async () => {
  const { connectApi } = await import('../src/v9/connection.mjs');
  let calls = 0, pauses = 0;
  const result = await connectApi('https://example.test', { fetcher: async url => {
    assert.equal(url, 'https://example.test/api/v9/meta');
    if (++calls < 3) return { ok: false };
    return { ok: true, json: async () => ({ ok: true, mode: 'production' }) };
  }, pause: async () => { pauses++; } });
  assert.equal(result.mode, 'production'); assert.equal(calls, 3); assert.equal(pauses, 2);
  calls = 0;
  await assert.rejects(connectApi('https://example.test', { fetcher: async () => { calls++; return { ok: true, json: async () => ({ ok: true, mode: 'unknown' }) }; }, pause: async () => {} }));
  assert.equal(calls, 5);
  calls = 0;
  await assert.rejects(connectApi('', { fetcher: async () => { calls++; throw new Error('offline'); } })); assert.equal(calls, 1);
});
