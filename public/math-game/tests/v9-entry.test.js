'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Service, ApiError, hash } = require('../server/service');
const { LocalStore } = require('../server/store');
const teacher = { uid: 'owner', teacher: true }, child = { uid: 'shared-device' }, outsider = { uid: 'other-device' };
let sequence = 0;
const request = values => ({ schemaVersion: 1, requestId: 'req_entry_' + ++sequence, ...values });
const denied = code => error => error instanceof ApiError && error.code === code;
async function setup() {
  const store = new LocalStore(); let now = Date.parse('2026-10-16T10:00:00Z');
  const service = new Service(store, { secret: 'entry-test-secret-'.repeat(3), now: () => now });
  const call = (op, input, actor = child) => service.call(op, input, actor);
  const create = (displayName = 'مینا') => call('createStudent', request({ displayName }));
  const invite = async (membership = 'invite_open') => {
    const classroom = await call('createClass', request({ name: 'کلاس آزمایش', policy: { membership } }), teacher);
    return call('issueInvite', request({ classId: classroom.classId, expiresInSeconds: 60, maxUses: 2 }), teacher);
  };
  return { store, call, create, invite, advance: () => { now += 61000; } };
}
test('story registration survives retries and permits two children with the same name', async () => {
  const f = await setup(), input = request({ displayName: ' مینا ', avatar: 'pilot' });
  const [a, replay] = await Promise.all([f.call('createStudent', input), f.call('createStudent', input)]);
  assert.deepEqual(a, replay);
  const b = await f.create(); assert.notEqual(a.studentId, b.studentId);
  const entry = await f.call('getEntry', { schemaVersion: 1 });
  assert.equal(entry.profiles.length, 2);
  assert.ok(entry.profiles.every(profile => profile.displayName === 'مینا'));
  assert.equal(entry.profiles[0].uid, undefined);
  await assert.rejects(f.call('createStudent', { ...input, displayName: 'حمید' }), denied('EVENT_CONFLICT'));
});
test('a failed index write is repaired by replaying the original story request', async () => {
  const f = await setup(), input = request({ displayName: 'قهرمان' });
  const transact = f.store.transact.bind(f.store); let interrupt = true;
  f.store.transact = (key, change) => {
    if (key.startsWith('studentIndex/') && interrupt) { interrupt = false; return Promise.reject(new Error('interrupted')); }
    return transact(key, change);
  };
  await assert.rejects(f.call('createStudent', input));
  const retry = await f.call('createStudent', input);
  const entry = await f.call('getEntry', { schemaVersion: 1 });
  assert.deepEqual(entry.profiles.map(profile => profile.studentId), [retry.studentId]);
});
test('entry schemas reject forged ownership, paths, names, roles and missing authentication', async () => {
  const f = await setup();
  for (const extra of [{ uid: 'other' }, { teacher: true }, { studentId: 'chosen-id' }, { displayName: '   ' }]) await assert.rejects(f.call('createStudent', request({ displayName: 'نام', ...extra })), denied('INVALID_PAYLOAD'));
  await assert.rejects(f.call('createStudent', request({ displayName: 'نام' }), teacher), denied('FORBIDDEN'));
  await assert.rejects(f.call('getEntry', { schemaVersion: 1 }, null), denied('UNAUTHENTICATED'));
  await assert.rejects(f.call('getEntry', { schemaVersion: 1, legacyMembership: { classId: '../class', studentId: 'x' } }), denied('INVALID_PAYLOAD'));
});
test('one story profile joins multiple classes without renaming or duplicating the child', async () => {
  const f = await setup(), profile = await f.create(), a = await f.invite(), b = await f.invite();
  for (const invite of [a, b]) {
    const joined = await f.call('joinStudentClass', request({ studentId: profile.studentId, token: invite.token }));
    assert.equal(joined.studentId, profile.studentId); assert.equal(joined.displayName, profile.displayName);
  }
  const entry = await f.call('getEntry', { schemaVersion: 1 });
  assert.equal(entry.profiles.length, 1); assert.equal(entry.profiles[0].memberships.length, 2);
});
test('repeated or concurrent joins consume one invite use for that child', async () => {
  const f = await setup(), profile = await f.create(), invite = await f.invite();
  const input = () => request({ studentId: profile.studentId, token: invite.token });
  const [a, b] = await Promise.all([f.call('joinStudentClass', input()), f.call('joinStudentClass', input())]);
  assert.deepEqual(a, b);
  assert.equal((await f.store.get('invites/' + hash(invite.token))).uses, 1);
  f.advance(); assert.deepEqual(await f.call('joinStudentClass', input()), a);
});
test('unrelated identities cannot list, join with, or adopt another child profile', async () => {
  const f = await setup(), profile = await f.create(), invite = await f.invite();
  await f.call('joinStudentClass', request({ studentId: profile.studentId, token: invite.token }));
  assert.deepEqual((await f.call('getEntry', { schemaVersion: 1 }, outsider)).profiles, []);
  await assert.rejects(f.call('joinStudentClass', request({ studentId: profile.studentId, token: invite.token }), outsider), denied('FORBIDDEN'));
  await assert.rejects(f.call('getEntry', { schemaVersion: 1, legacyMembership: { classId: invite.classId, studentId: profile.studentId } }, outsider), denied('FORBIDDEN'));
});
test('membership policy and later revocation cannot be bypassed by joining again', async () => {
  const f = await setup(), profile = await f.create(), invite = await f.invite('invite_confirm');
  const join = () => f.call('joinStudentClass', request({ studentId: profile.studentId, token: invite.token }));
  assert.equal((await join()).status, 'pending');
  const start = () => f.call('startSession', request({ studentId: profile.studentId, classId: invite.classId, goal: { type: 'sector', sectorId: 1 } }));
  await assert.rejects(start(), denied('FORBIDDEN'));
  await f.call('setMembership', request({ studentId: profile.studentId, classId: invite.classId, status: 'active' }), teacher);
  assert.equal((await join()).status, 'active'); await start();
  await f.call('setMembership', request({ studentId: profile.studentId, classId: invite.classId, status: 'revoked' }), teacher);
  assert.equal((await join()).status, 'revoked'); await assert.rejects(start(), denied('FORBIDDEN'));
});
test('join retries repair membership materialization after invite consumption and expiry', async () => {
  const f = await setup(), profile = await f.create(), invite = await f.invite(), input = request({ studentId: profile.studentId, token: invite.token });
  const transact = f.store.transact.bind(f.store); let interrupt = true;
  f.store.transact = (key, change) => {
    if (key.startsWith('memberships/') && interrupt) { interrupt = false; return Promise.reject(new Error('interrupted')); }
    return transact(key, change);
  };
  await assert.rejects(f.call('joinStudentClass', input)); f.advance();
  assert.equal((await f.call('joinStudentClass', input)).studentId, profile.studentId);
  assert.equal((await f.store.get('invites/' + hash(invite.token))).uses, 1);
});
test('a join request cannot be retried for a different child or token', async () => {
  const f = await setup(), a = await f.create(), b = await f.create(), invite = await f.invite();
  const input = request({ studentId: a.studentId, token: invite.token }); await f.call('joinStudentClass', input);
  await assert.rejects(f.call('joinStudentClass', { ...input, studentId: b.studentId }), denied('EVENT_CONFLICT'));
  await assert.rejects(f.call('joinStudentClass', { ...input, token: 'a'.repeat(32) }), denied('EVENT_CONFLICT'));
});
test('phase-one existing memberships can restore the same student ID without another registration', async () => {
  const f = await setup(), invite = await f.invite();
  const old = await f.call('redeemInvite', request({ token: invite.token, displayName: 'قدیمی' }));
  // Model a database written before entry indexes existed.
  for (const key of Object.keys(f.store.data)) if (/^(students|studentIndex|studentClasses)\//.test(key)) delete f.store.data[key];
  const input = { schemaVersion: 1, legacyMembership: { classId: old.classId, studentId: old.studentId } };
  const first = await f.call('getEntry', input), again = await f.call('getEntry', input);
  assert.deepEqual(first, again); assert.equal(first.profiles.length, 1);
  assert.equal(first.profiles[0].studentId, old.studentId); assert.equal(first.profiles[0].displayName, 'قدیمی');
});
