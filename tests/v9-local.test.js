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
