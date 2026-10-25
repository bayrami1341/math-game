'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const vm = require('node:vm');
const http = require('node:http');
const { Service, ApiError } = require('../server/service');
const { LocalStore, FirebaseStore } = require('../server/store');
const { createServer, localAccounts } = require('../server/http');
const teacher = { uid: 'teacher-one', teacher: true };
const otherTeacher = { uid: 'teacher-two', teacher: true };
const child = { uid: 'device-one', teacher: false };
let seq = 0;
const request = input => ({ schemaVersion: 1, requestId: 'req_test_' + (++seq), ...input });
const error = code => failure => failure instanceof ApiError && failure.code === code;
async function fixture(membership = 'invite_open', store = new LocalStore()) {
  let now = Date.parse('2026-10-16T08:00:00Z');
  const service = new Service(store, { secret: 'test-only-secret-that-is-at-least-32-characters', now: () => now });
  const call = (op, data, actor = teacher) => service.call(op, data, actor);
  const classroom = await call('createClass', request({ name: 'سوم الف', policy: { membership } }));
  const invite = await call('issueInvite', request({ classId: classroom.classId, expiresInSeconds: 60, maxUses: 2 }));
  const enrollment = await call('redeemInvite', request({ token: invite.token, displayName: 'مینا' }), child);
  const start = () => call('startSession', request({ classId: classroom.classId, studentId: enrollment.studentId, goal: { type: 'sector', sectorId: 1 } }), child);
  return { store, service, call, classroom, invite, enrollment, start, advance: ms => { now += ms; } };
}

test('shared pedagogy imports in Node without window and matches browser results', async () => {
  assert.equal(typeof global.window, 'undefined');
  const core = require('../src/core/pedagogy');
  assert.ok(core.errorMessage('SUM', 2, 3).includes('۲ و ۳'));
  assert.ok(core.hintMessage('reveal', 3, 4).includes('۱۲'));
  const source = await fs.readFile(path.join(__dirname, '../src/core/pedagogy.js'), 'utf8');
  const context = { window: {} }; vm.runInNewContext(source, context);
  for (const sequence of [[true], [true, true, true], [false, true, true], [true, false, true, true, true]]) {
    const node = core.createRow(), browser = context.window.createRow();
    for (const correct of sequence) { core.recordAttempt(node, correct, 2500); context.window.recordAttempt(browser, correct, 2500); }
    assert.deepEqual(JSON.parse(JSON.stringify(browser)), node);
    assert.equal(core.evaluateMastery(node).level, context.window.evaluateMastery(browser).level);
  }
});

test('valid Firebase identity alone cannot create a class or inspect another teacher class', async () => {
  const f = await fixture();
  await assert.rejects(f.call('createClass', request({ name: 'fake' }), child), error('FORBIDDEN'));
  await assert.rejects(f.call('getClass', { schemaVersion: 1, classId: f.classroom.classId }, otherTeacher), error('FORBIDDEN'));
  await assert.rejects(f.call('createClass', request({ name: 'fake' }), null), error('UNAUTHENTICATED'));
});

test('createClass request replay is stable and changed content conflicts', async () => {
  const f = await fixture(); const input = request({ name: 'کلاس جدید' });
  const a = await f.call('createClass', input), b = await f.call('createClass', input);
  assert.deepEqual(a, b);
  await assert.rejects(f.call('createClass', { ...input, name: 'changed' }), error('EVENT_CONFLICT'));
  const classroom = await f.store.get('classrooms/' + a.classId);
  assert.equal(classroom.policy.leaderboard, 'off');
});

test('pending membership cannot start, owner approval activates, revocation blocks later writes', async () => {
  const f = await fixture('invite_confirm');
  assert.equal(f.enrollment.status, 'pending');
  await assert.rejects(f.start(), error('FORBIDDEN'));
  await f.call('setMembership', request({ classId: f.classroom.classId, studentId: f.enrollment.studentId, status: 'active' }));
  const session = await f.start();
  await f.call('setMembership', request({ classId: f.classroom.classId, studentId: f.enrollment.studentId, status: 'revoked' }));
  await assert.rejects(f.call('submitAttempts', request({ sessionId: session.sessionId, writerEpoch: 1, attempts: [{ eventId: 'evt_valid_001', questionId: 'q-1', answer: 4 }] }), child), error('FORBIDDEN'));
});

test('invite capacity is atomic under concurrent redemption and replay does not consume a use', async () => {
  const f = await fixture();
  const input = request({ token: f.invite.token, displayName: 'دوم' });
  const second = { uid: 'device-two', teacher: false };
  const [a, b] = await Promise.all([f.call('redeemInvite', input, second), f.call('redeemInvite', input, second)]);
  assert.deepEqual(a, b);
  await assert.rejects(f.call('redeemInvite', request({ token: f.invite.token, displayName: 'سوم' }), { uid: 'device-three' }), error('INVITE_EXPIRED'));
});

test('expired invite rejects new redemption without disclosing roster', async () => {
  const f = await fixture(); f.advance(61000);
  await assert.rejects(f.call('redeemInvite', request({ token: f.invite.token, displayName: 'بعدی' }), { uid: 'next-device' }), error('INVITE_EXPIRED'));
});

test('lost redemption response repairs membership materialization on retry', async () => {
  const f = await fixture('invite_confirm');
  const input = request({ token: f.invite.token, displayName: 'دوم' });
  const second = { uid: 'device-two' };
  const transact = f.store.transact.bind(f.store); let failOnce = true;
  f.store.transact = (key, updater) => {
    if (key.startsWith('memberships/') && failOnce) { failOnce = false; return Promise.reject(new Error('simulated interrupted write')); }
    return transact(key, updater);
  };
  await assert.rejects(f.call('redeemInvite', input, second));
  const result = await f.call('redeemInvite', input, second);
  const command = request({ classId: result.classId, studentId: result.studentId, status: 'active' });
  await f.call('setMembership', command);
  await f.call('redeemInvite', input, second);
  assert.equal((await f.call('getClass', { schemaVersion: 1, classId: result.classId, studentId: result.studentId }, second)).membershipStatus, 'active');
});

test('replaying an old approval cannot undo a newer revocation', async () => {
  const f = await fixture('invite_confirm');
  const approve = request({ classId: f.classroom.classId, studentId: f.enrollment.studentId, status: 'active' });
  await f.call('setMembership', approve);
  await f.call('setMembership', request({ ...approve, requestId: 'req_revoke_new', status: 'revoked' }));
  await f.call('setMembership', approve);
  await assert.rejects(f.start(), error('FORBIDDEN'));
});

test('a mixed valid/invalid batch has no partial commit', async () => {
  const f = await fixture(); const session = await f.start();
  await assert.rejects(f.call('submitAttempts', request({ sessionId: session.sessionId, writerEpoch: 1, attempts: [{ eventId: 'evt_first_001', questionId: 'q-1', answer: 4 }, { eventId: 'evt_second_002', questionId: 'unknown', answer: 8 }] }), child), error('INVALID_PAYLOAD'));
  const status = await f.call('getSyncStatus', { schemaVersion: 1, sessionId: session.sessionId }, child);
  assert.equal(status.answered, 0); assert.equal(status.revision, 1);
});

test('concurrent identical submissions have one effect and stable receipts', async () => {
  const f = await fixture(); const session = await f.start();
  const input = request({ sessionId: session.sessionId, writerEpoch: 1, attempts: [{ eventId: 'evt_repeat_001', questionId: 'q-1', answer: 4, responseMs: 2000 }] });
  const [a, b] = await Promise.all([f.call('submitAttempts', input, child), f.call('submitAttempts', input, child)]);
  assert.deepEqual(a, b);
  const newRequest = await f.call('submitAttempts', { ...input, requestId: 'req_repeat_new' }, child);
  assert.deepEqual(a.receipts, newRequest.receipts);
  const status = await f.call('getSyncStatus', { schemaVersion: 1, sessionId: session.sessionId }, child);
  assert.equal(status.score, 1); assert.equal(status.answered, 1);
  await assert.rejects(f.call('submitAttempts', { ...input, attempts: [{ ...input.attempts[0], answer: 5 }] }, child), error('EVENT_CONFLICT'));
});

test('new event IDs cannot farm the same question; forged score and stale epochs are rejected', async () => {
  const f = await fixture(); const session = await f.start();
  const input = request({ sessionId: session.sessionId, writerEpoch: 1, attempts: [{ eventId: 'evt_first_001', questionId: 'q-1', answer: 4 }] });
  await f.call('submitAttempts', input, child);
  await assert.rejects(f.call('submitAttempts', request({ ...input, requestId: 'req_other_002', attempts: [{ ...input.attempts[0], eventId: 'evt_other_002' }] }), child), error('EVENT_CONFLICT'));
  await assert.rejects(f.call('submitAttempts', { ...input, writerEpoch: 2 }, child), error('STALE_WRITER'));
  await assert.rejects(f.call('submitAttempts', { ...input, score: 100 }, child), error('INVALID_PAYLOAD'));
  await assert.rejects(f.call('submitAttempts', input, { uid: 'someone-else' }), error('FORBIDDEN'));
});

test('finalization requires all questions, uses server correctness, and is repeat-safe', async () => {
  const f = await fixture(); const session = await f.start();
  const finish = request({ sessionId: session.sessionId, writerEpoch: 1 });
  await assert.rejects(f.call('finalizeSession', finish, child), error('INVALID_PAYLOAD'));
  const attempts = session.questions.map((question, i) => ({ eventId: 'evt_question_' + i, questionId: question.questionId, answer: i ? question.f1 * question.f2 : 0, responseMs: 2000 }));
  const input = request({ sessionId: session.sessionId, writerEpoch: 1, attempts });
  await f.call('submitAttempts', input, child);
  const a = await f.call('finalizeSession', finish, child), b = await f.call('finalizeSession', finish, child);
  assert.deepEqual(a, b); assert.equal(a.status, 'FINALIZED'); assert.equal(a.score, attempts.length - 1);
  const replay = await f.call('submitAttempts', input, child);
  assert.equal(replay.receipts.length, attempts.length);
});

test('teacher report excludes private membership grants and rejects another class owner', async () => {
  const f = await fixture(); await f.start();
  const view = await f.call('getClass', { schemaVersion: 1, classId: f.classroom.classId });
  assert.equal(view.members.length, 1); assert.equal(view.sessions.length, 1);
  assert.equal(view.members[0].uid, undefined); assert.equal(view.members[0].inputHash, undefined);
  const childView = await f.call('getClass', { schemaVersion: 1, classId: f.classroom.classId, studentId: f.enrollment.studentId }, child);
  assert.equal(childView.members, undefined); assert.equal(childView.sessions, undefined);
});

test('local file store survives reopen and does not mutate on rejected transaction', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'math-game-v9-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'data.json'), store = await new LocalStore(file).open();
  await store.transact('record', () => ({ value: 1 }));
  await assert.rejects(store.transact('record', current => { current.value = 2; throw new Error('rollback'); }));
  const reopened = await new LocalStore(file).open(); assert.deepEqual(await reopened.get('record'), { value: 1 });
});

test('Firebase adapter tolerates an initially empty SDK cache and retry callback', async () => {
  let value;
  const database = { ref: () => ({ transaction: async callback => {
    assert.equal(callback(null), null);
    value = callback({ value: 1 });
    return { committed: true, snapshot: { val: () => value } };
  } }) };
  const store = new FirebaseStore(database);
  assert.deepEqual(await store.transact('record', current => { if (!current) throw new Error('not found'); return { value: current.value + 1 }; }), { value: 2 });
});

test('HTTP two-client flow enforces authentication, membership, and trusted scoring', async t => {
  const store = new LocalStore(), service = new Service(store, { secret: 's'.repeat(32) }), accounts = localAccounts();
  const server = createServer({ service, mode: 'local', root: path.resolve(__dirname, '..'), accounts, authenticate: async token => accounts.find(account => account.token === token) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = async (op, data, account = accounts[0], extra = {}) => {
    const response = await fetch(origin + '/api/v9/' + op, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.token, ...extra }, body: JSON.stringify(data) });
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await post('createClass', request({ name: 'A' }), { token: 'forged' })).status, 401);
  assert.equal((await post('createClass', request({ name: 'A' }), accounts[1])).status, 403);
  assert.equal((await post('createClass', request({ name: 'A' }), accounts[0], { Origin: 'https://evil.example' })).status, 403);
  const classroom = (await post('createClass', request({ name: 'A', policy: { membership: 'invite_open' } }))).data;
  const invite = (await post('issueInvite', request({ classId: classroom.classId }))).data;
  const results = [];
  for (const [index, account] of accounts.slice(1).entries()) {
    const member = (await post('redeemInvite', request({ token: invite.token, displayName: 'کودک ' + index }), account)).data;
    const session = (await post('startSession', request({ classId: classroom.classId, studentId: member.studentId, goal: { type: 'sector', sectorId: 1 } }), account)).data;
    const question = session.questions[0];
    const response = await post('submitAttempts', request({ sessionId: session.sessionId, writerEpoch: 1, attempts: [{ eventId: 'evt_http_' + index, questionId: question.questionId, answer: index ? 0 : question.f1 * question.f2 }] }), account);
    assert.equal(response.status, 200); results.push(response.data.receipts[0].correct);
  }
  assert.deepEqual(results, [true, false]);
  const report = (await post('getClass', { schemaVersion: 1, classId: classroom.classId })).data;
  assert.equal(report.members.length, 2); assert.equal(report.sessions.length, 2);
  for (const file of ['/.git/config', '/server/service.js', '/.local/v9/data.json', '/package-lock.json']) assert.equal((await fetch(origin + file)).status, 404);
  assert.equal((await fetch(origin + '/v9.html')).status, 200);
  assert.equal((await fetch(origin + '/src/v9/local.mjs')).status, 200);
});

test('production cannot expose development accounts', async t => {
  assert.throws(() => createServer({ mode: 'production', accounts: localAccounts() }));
  const server = createServer({ mode: 'production', root: path.resolve(__dirname, '..'), authenticate: async () => null, service: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/dev/accounts`)).status, 404);
});

// درخواست خام با Header میزبان دلخواه — undici/fetch ممکن است Host را بازنویسی/حذف کند.
const ask = (port, hostHeader, pathname = '/api/v9/meta') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path: pathname, headers: { host: hostHeader } }, res => {
    let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject); req.end();
});

test('local mode serves the same-origin config to browsers and keeps the LAN locked until the teacher opts in', async t => {
  const accounts = localAccounts();
  const server = createServer({ service: {}, mode: 'local', root: path.resolve(__dirname, '..'), accounts, authenticate: async token => accounts.find(account => account.token === token) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const config = await ask(port, `127.0.0.1:${port}`, '/v9-config.js');
  assert.equal(config.status, 200);
  assert.ok(config.body.includes("apiBase: ''"), 'local browsers must receive the same-origin apiBase');
  assert.ok(config.body.includes('localMode: true'));
  assert.equal((await ask(port, `192.168.1.20:${port}`)).status, 403, 'classroom LAN host stays FORBIDDEN without opt-in');
  assert.equal((await ask(port, `evil.example:${port}`)).status, 403, 'public hostnames stay FORBIDDEN without opt-in');
});

test('explicit LAN opt-in admits only private classroom ranges, never public names', async t => {
  const accounts = localAccounts();
  const server = createServer({ service: {}, mode: 'local', root: path.resolve(__dirname, '..'), accounts, allowLocalNetwork: true, authenticate: async token => accounts.find(account => account.token === token) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  for (const lan of ['192.168.1.20', '10.0.0.5', '172.16.9.9', '172.31.255.255']) assert.equal((await ask(port, `${lan}:${port}`)).status, 200, lan);
  const config = await ask(port, '192.168.1.20:' + port, '/v9-config.js');
  assert.equal(config.status, 200); assert.ok(config.body.includes("apiBase: ''"), 'LAN students must get the working same-origin config too');
  for (const outside of ['evil.example', '172.32.0.1', '8.8.8.8']) assert.equal((await ask(port, `${outside}:${port}`)).status, 403, outside);
});

test('production never receives the local config override and is not host-gated (reverse proxy owns that)', async t => {
  const server = createServer({ mode: 'production', root: path.resolve(__dirname, '..'), authenticate: async () => null, service: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const config = await ask(port, `127.0.0.1:${port}`, '/v9-config.js');
  assert.equal(config.status, 200); assert.ok(!config.body.includes('localMode'), 'public config must stay the untouched public file');
  assert.equal((await ask(port, `192.168.1.20:${port}`)).status, 200);
});
