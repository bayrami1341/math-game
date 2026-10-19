'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
async function local() {
  const { openLocal } = await import('../src/v9/local.mjs');
  const factory = new IDBFactory();
  return { db: await openLocal(factory), factory, openLocal };
}
const state = { session: { sessionId: 'ses_test_001', answers: { 'q-1': { eventId: 'evt_local_001' } } } };
const command = { uid: 'student-one', input: { requestId: 'req_local_001', sessionId: 'ses_test_001', attempts: [{ eventId: 'evt_local_001', questionId: 'q-1', answer: 4 }] } };
const response = { sessionId: 'ses_test_001', receipts: [{ eventId: 'evt_local_001', status: 'ACKNOWLEDGED', revision: 2, correct: true }] };

test('answer state and outgoing command persist together across closing and reopening', async () => {
  const { db, factory, openLocal } = await local();
  await db.enqueue('profile:one', state, command); db.close();
  const reopened = await openLocal(factory);
  assert.deepEqual(await reopened.get('profile:one'), state);
  assert.equal((await reopened.pending('student-one')).length, 1);
  assert.equal((await reopened.pending('student-two')).length, 0); reopened.close();
});
test('duplicate command aborts the state change as well as the queue change', async () => {
  const { db } = await local(); await db.enqueue('profile:one', state, command);
  await assert.rejects(db.enqueue('profile:one', { changed: true }, command));
  assert.deepEqual(await db.get('profile:one'), state);
  assert.equal((await db.pending('student-one')).length, 1); db.close();
});
test('only a complete matching server receipt may remove the outgoing answer', async () => {
  const { db } = await local(); await db.enqueue('profile:one', state, command);
  const queued = (await db.pending('student-one'))[0];
  for (const invalid of [{ sessionId: 'wrong', receipts: response.receipts }, { sessionId: response.sessionId, receipts: [] }, { sessionId: response.sessionId, receipts: [{ ...response.receipts[0], eventId: 'other-event' }] }]) {
    await assert.rejects(db.acknowledge(queued, invalid, 'profile:one'));
    assert.equal((await db.pending('student-one')).length, 1);
  }
  await db.acknowledge(queued, response, 'profile:one');
  assert.equal((await db.pending('student-one')).length, 0);
  assert.equal((await db.get('profile:one')).session.receipts.evt_local_001.correct, true); db.close();
});
test('permanent errors remain in the queue and temporary errors retain retry state', async () => {
  const { db } = await local(); await db.enqueue('profile:one', state, command);
  const queued = (await db.pending('student-one'))[0];
  await db.retry(queued); const retry = (await db.pending('student-one'))[0];
  assert.equal(retry.retries, 1); assert.ok(retry.retryAt > Date.now());
  await db.block(retry, 'FORBIDDEN');
  assert.equal((await db.pending('student-one'))[0].blocked, 'FORBIDDEN'); db.close();
});
test('unavailable IndexedDB fails explicitly instead of pretending an answer was saved', async () => {
  const { openLocal } = await import('../src/v9/local.mjs');
  await assert.rejects(openLocal(null));
});

test('a late acknowledgement stays with its original child after switching profiles', async () => {
  const { db } = await local();
  await db.enqueue('student:device:one', state, command);
  const second = { session: { sessionId: 'ses_child_two', receipts: {} } };
  await db.put('student:device:two', second);
  const queued = (await db.pending('student-one'))[0];
  await db.acknowledge(queued, response, 'student:device:two');
  assert.equal((await db.get('student:device:one')).session.receipts.evt_local_001.correct, true);
  assert.deepEqual(await db.get('student:device:two'), second); db.close();
});

test('profile migration preserves the session and retargets old queued answers atomically', async () => {
  const { db } = await local();
  const legacy = { studentId: 'stu_old', session: state.session };
  await db.enqueue('profile:device', legacy, command);
  // Legacy rows did not record their storage key.
  const queued = (await db.pending('student-one'))[0];
  await db.retry({ ...queued, stateKey: undefined });
  await db.migrateProfile('profile:device', 'student:device:stu_old', 'student-one');
  assert.deepEqual(await db.get('student:device:stu_old'), legacy);
  const migrated = (await db.pending('student-one'))[0];
  assert.equal(migrated.stateKey, 'student:device:stu_old');
  await db.acknowledge(migrated, response, 'profile:device');
  await db.migrateProfile('profile:device', 'student:device:stu_old', 'student-one');
  assert.equal((await db.get('student:device:stu_old')).session.receipts.evt_local_001.correct, true); db.close();
});

test('concurrent operation preparation and reload retain the original request and name', async () => {
  const { db, factory, openLocal } = await local();
  const input = { requestId: 'req_create_001', displayName: 'مینا' };
  const [a, b] = await Promise.all([db.prepareOperation('create:uid', input), db.prepareOperation('create:uid', { requestId: 'req_create_002', displayName: 'دیگر' })]);
  assert.deepEqual(a, input); assert.deepEqual(b, input); db.close();
  const reopened = await openLocal(factory);
  assert.deepEqual(await reopened.prepareOperation('create:uid', {}), input); reopened.close();
});

test('entry selection never guesses among children or multiple classes', async () => {
  const { selectProfile, membershipContext } = await import('../src/v9/entry.mjs');
  const a = { studentId: 'one', displayName: 'مینا', memberships: [{ classId: 'a' }, { classId: 'b' }] };
  const b = { studentId: 'two', displayName: 'مینا' };
  assert.equal(selectProfile([a, b], null), null);
  assert.equal(selectProfile([a, b], 'two'), b);
  assert.equal(selectProfile([a], null), a);
  assert.equal(membershipContext(a, null), null);
  assert.equal(membershipContext(a, 'b').classId, 'b');
});
