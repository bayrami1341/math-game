'use strict';
// Integration tests execute the actual UI controller against the real HTTP service
// and IndexedDB. This DOM fixture does not replace a visual browser review.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { IDBFactory } = require('fake-indexeddb');
const { Service } = require('../server/service');
const { LocalStore } = require('../server/store');
const { createServer, localAccounts } = require('../server/http');

async function app(t, options = {}) {
  const accounts = localAccounts(), store = new LocalStore();
  const service = new Service(store, { secret: 'ui-integration-test-'.repeat(3) });
  const server = createServer({ service, mode: 'local', root: path.resolve(__dirname, '..'), accounts, authenticate: async token => accounts.find(account => account.token === token) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const html = await fs.readFile(path.resolve(__dirname, '../v9.html'), 'utf8');
  const elements = [], ids = new Map();
  class Element {
    constructor(tag, id = '') { this.tag = tag; this.id = id; this.children = []; this.handlers = {}; this.dataset = {}; this.style = {}; this.value = ''; this.hidden = false; this.disabled = false; this.textContent = ''; elements.push(this); if (id) ids.set(id, this); }
    addEventListener(event, handler) { this.handlers[event] = handler; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    setAttribute(key, value) { this[key] = value; }
    focus() {} scrollIntoView() {}
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const element = new Element(match[1], match[3]); element.hidden = /\bhidden\b/.test(match[2]);
  }
  const nav = [...html.matchAll(/<button[^>]+data-screen="([^"]+)"/g)].map(match => { const button = new Element('button'); button.dataset.screen = match[1]; return button; });
  const sectors = [...html.matchAll(/<button[^>]+data-sector="([^"]+)"/g)].map(match => { const button = new Element('button'); button.dataset.sector = match[1]; return button; });
  Object.entries({ sector: '1', membership: 'invite_confirm', 'hero-avatar': 'astronaut', 'activity-context': 'personal' }).forEach(([id, value]) => { ids.get(id).value = value; });
  const document = {
    getElementById: id => { assert.ok(ids.has(id), 'Missing element ' + id); return ids.get(id); },
    createElement: tag => new Element(tag),
    querySelectorAll: selector => selector === '[data-screen]' ? nav : selector === '[data-sector]' ? sectors : elements.filter(element => element.tag === 'button'),
    addEventListener() {}, hidden: false
  };
  const storage = new Map();
  const localModule = await import('../src/v9/local.mjs');
  const entryModule = await import('../src/v9/entry.mjs');
  const missionModule = await import('../src/v9/mission.mjs');
  const experienceModule = await import('../src/v9/experience.mjs');
  const factory = new IDBFactory();
  const database = await localModule.openLocal(factory); t.after(() => database.close());
  const navigator = { onLine: true };
  const context = vm.createContext({ document, window: { MathGameV9Config: { apiBase: origin }, addEventListener() {} },
    openLocal: async () => database, ...entryModule, ...missionModule, ...experienceModule,
    navigator, location: new URL(origin + '/v9.html'), history: { replaceState() {} },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    URL, AbortSignal, fetch: options.fetch || fetch, crypto: webcrypto, structuredClone, performance, setInterval() {}, console });
  const source = (await fs.readFile(path.resolve(__dirname, '../src/v9/app.js'), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source, context);
  const settle = () => vm.runInContext('serial', context);
  await settle();
  const get = id => ids.get(id);
  const click = async element => { element.onclick(); await settle(); };
  const submit = async id => { get(id).handlers.submit({ preventDefault() {} }); await settle(); };
  const go = screen => click(nav.find(button => button.dataset.screen === screen));
  const state = () => vm.runInContext('state', context);
  const profileCount = () => Object.keys(store.data).filter(key => key.startsWith('students/')).length;
  const createHero = async (name = 'قهرمان آزمایشی') => {
    await click(get('story-skip')); get('hero-name').value = name; await submit('hero-introduction');
    assert.equal(get('notice').dataset.error, 'false', get('notice').textContent);
  };
  return { get, click, submit, go, state, profileCount, createHero, navigator, database, accounts, context, store, service, settle, sectors, origin };
}
test('story, personal practice, moving-card mission and shared collection form one working flow', async t => {
  const ui = await app(t);
  await ui.click(ui.get('account-buttons').children[1]);
  assert.equal(ui.get('hero-story').hidden, false);
  assert.equal(ui.get('hero-introduction').hidden, true);
  await ui.createHero(); assert.equal(ui.profileCount(), 1);
  assert.equal(ui.get('station-meter').value, 0);
  assert.equal(ui.get('station-home').dataset.phase, 'dark');
  assert.equal(ui.get('identity').textContent, 'قهرمان آزمایشی');
  await ui.click(ui.get('replay-story')); await ui.click(ui.get('story-skip'));
  assert.equal(ui.get('hero-introduction').hidden, true);
  await ui.click(ui.get('story-return')); assert.equal(ui.profileCount(), 1);
  for (const mode of ['practice', 'missions']) {
    await ui.go(mode); await ui.submit('start-session');
    assert.equal(ui.get('notice').dataset.error, 'false', ui.get('notice').textContent);
    const session = ui.state().session;
    assert.equal(session.classId, null);
    assert.equal(session.activity, mode === 'missions' ? 'mission' : 'practice');
    for (const question of session.questions) {
      const answer = question.f1 * question.f2;
      if (mode === 'practice') { ui.get('answer').value = String(answer); await ui.submit('answer-form'); }
      else {
        const fa = String(answer).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
        const button = ui.get('mission-choices').children.find(button => button.textContent === fa);
        assert.ok(button); await ui.click(button);
      }
    }
    assert.equal(ui.get('flight-meter').value, 100);
    assert.equal(ui.get('energy-cells').children.filter(cell => cell.dataset.lit === 'true').length, session.questions.length);
    assert.equal(ui.get('flight-result').hidden, true, 'No celebration of a final result before server finalization');
    assert.equal(ui.get('station-meter').value, 0, 'Practice or unfinished mission must not power the persistent station');
    await ui.click(ui.get('finalize'));
    assert.equal(ui.state().session.status, 'FINALIZED', ui.get('notice').textContent);
    assert.equal(ui.get('flight-result').hidden, false);
    assert.equal(ui.get('station-meter').value, mode === 'missions' ? 33 : 0);
    assert.equal(ui.get('station-home').dataset.phase, mode === 'missions' ? 'repairing' : 'dark');
  }
  await ui.go('collection');
  assert.equal(ui.get('achievements').children.length, 3);
  assert.equal(ui.get('personal-records').children.length, 1);
  assert.equal(ui.get('activity-history').children.length, 2);
  assert.equal(ui.profileCount(), 1);
  await ui.click(ui.get('next-destination'));
  assert.equal(ui.get('sector').value, '2');
  await ui.go('missions');
  assert.equal(ui.get('activity-settings').hidden, false, 'Completed missions can be played again');
  await ui.click(ui.sectors[1]); await ui.submit('start-session');
  assert.equal(ui.state().session.sectorId, 2);
  assert.match(ui.get('flight-title').textContent, /یک پیام تا زمین/);
  await ui.click(ui.get('back-station'));
  assert.equal(ui.get('station-home').hidden, false);
  await ui.click(ui.get('resume-activity'));
  assert.equal(ui.get('practice').hidden, false);
  await ui.click(ui.get('change-hero')); await ui.click(ui.get('new-hero')); await ui.createHero('قهرمان دوم');
  assert.equal(ui.get('station-meter').value, 0, 'Another child must not inherit station power');
});
test('switching children preserves offline answers and later receipts in the original profile', async t => {
  const ui = await app(t);
  await ui.click(ui.get('account-buttons').children[1]); await ui.createHero('مینا');
  await ui.go('practice'); await ui.submit('start-session');
  const firstId = ui.state().studentId;
  ui.navigator.onLine = false; ui.get('answer').value = '4'; await ui.submit('answer-form');
  assert.match(ui.get('flight-energy').textContent, /منتظر تأیید/);
  assert.equal(ui.get('flight-result').hidden, true);
  assert.equal((await ui.database.pending(ui.accounts[1].uid)).length, 1);
  await ui.click(ui.get('change-hero')); await ui.click(ui.get('new-hero')); await ui.createHero('مینا');
  const secondId = ui.state().studentId; assert.notEqual(secondId, firstId);
  assert.equal(ui.state().session, undefined);
  ui.navigator.onLine = true;
  await vm.runInContext('run(() => flush(true))', ui.context);
  const first = await ui.database.get('student:' + ui.accounts[1].uid + ':' + firstId);
  assert.equal(Object.keys(first.session.receipts).length, 1);
  assert.equal(ui.state().studentId, secondId); assert.equal(ui.state().session, undefined);
  await ui.click(ui.get('change-hero'));
  assert.equal(ui.get('profile-buttons').children.length, 2);
  await ui.click(ui.get('profile-buttons').children.find(button => button.textContent.endsWith('۱')) || ui.get('profile-buttons').children[0]);
  assert.equal(ui.get('hero-story').hidden, true);
});

test('unavailable optional audio never prevents answering or synchronization', async t => {
  const ui = await app(t);
  await ui.click(ui.get('account-buttons').children[1]); await ui.createHero();
  await ui.go('practice'); await ui.submit('start-session');
  await ui.click(ui.get('toggle-sound'));
  assert.equal(ui.get('toggle-sound')['aria-pressed'], 'false');
  const question = ui.state().session.questions[0];
  ui.get('answer').value = String(question.f1 * question.f2); await ui.submit('answer-form');
  assert.equal(Object.keys(ui.state().session.receipts).length, 1);
  assert.equal(ui.get('notice').dataset.error, 'false', ui.get('notice').textContent);
});

test('star help has two steps, saves no answer and resets before the next question or child', async t => {
  const ui = await app(t);
  await ui.click(ui.get('account-buttons').children[1]); await ui.createHero('مینا');
  await ui.go('practice'); await ui.submit('start-session');
  const question = ui.state().session.questions[0];
  assert.equal(ui.get('practice-help').hidden, false);
  assert.equal(ui.get('help-picture').hidden, true);
  await ui.click(ui.get('show-help'));
  assert.equal(ui.get('help-picture').hidden, false);
  assert.equal(ui.get('help-groups').children.length, question.f1);
  assert.ok(ui.get('help-groups').children.every(group => group.children.length === question.f2));
  assert.equal(ui.get('help-equation').textContent, '');
  assert.equal(Object.keys(ui.state().session.answers).length, 0);
  assert.equal((await ui.database.pending(ui.accounts[1].uid)).length, 0);
  await ui.click(ui.get('show-help'));
  assert.match(ui.get('help-equation').textContent, /=/);
  ui.get('answer').value = '0'; await ui.submit('answer-form');
  assert.equal(ui.get('help-picture').hidden, true);
  assert.match(ui.get('companion-message').textContent, /با هم پیدایش کردیم/);
  await ui.click(ui.get('back-station')); await ui.click(ui.get('resume-activity'));
  assert.match(ui.get('companion-message').textContent, /با هم پیدایش کردیم/, 'Review survives navigation');
  await ui.click(ui.get('show-help'));
  await ui.click(ui.get('change-hero')); await ui.click(ui.get('new-hero')); await ui.createHero('سارا');
  await ui.go('missions'); await ui.submit('start-session');
  assert.equal(ui.get('practice-help').hidden, true);
  assert.equal(ui.get('help-picture').hidden, true);
  await ui.click(ui.get('show-help'));
  assert.equal(ui.get('help-picture').hidden, true, 'Mission cannot reveal a practice hint');
  assert.equal(ui.get('station-meter').value, 0);
});

test('game requests do not exhaust registration quota and registration remains limited', async t => {
  const ui = await app(t);
  const call = (operation, input) => fetch(ui.origin + '/api/v9/' + operation, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ui.accounts[1].token }, body: JSON.stringify({ schemaVersion: 1, ...input }) });
  for (let index = 0; index < 21; index++) assert.equal((await call('getEntry', {})).status, 200);
  for (let index = 0; index < 20; index++) assert.equal((await call('createStudent', { requestId: 'req_quota_' + index, displayName: 'آزمایش' })).status, 200);
  assert.equal((await call('createStudent', { requestId: 'req_quota_blocked', displayName: 'آزمایش' })).status, 429);
  assert.equal((await call('getEntry', {})).status, 200);
});

test('lost registration response retries the same story operation without another child', async t => {
  let drop = true;
  const ui = await app(t, { fetch: async (url, options) => {
    const response = await fetch(url, options);
    if (drop && String(url).endsWith('/createStudent')) { drop = false; await response.text(); throw new Error('simulated lost response'); }
    return response;
  } });
  await ui.click(ui.get('account-buttons').children[1]);
  await ui.click(ui.get('story-skip')); ui.get('hero-name').value = 'مینا';
  await ui.submit('hero-introduction'); assert.equal(ui.profileCount(), 1);
  assert.equal(ui.get('hero-name').readOnly, true);
  await ui.submit('hero-introduction');
  assert.equal(ui.profileCount(), 1); assert.equal(ui.get('identity').textContent, 'مینا');
});

test('class joining reuses story identity and restores membership without asking for the name again', async t => {
  const ui = await app(t);
  const teacher = ui.accounts[0]; let seq = 0;
  const request = input => ({ schemaVersion: 1, requestId: 'req_ui_class_' + ++seq, ...input });
  const classroom = await ui.service.call('createClass', request({ name: 'کلاس مینا', policy: { membership: 'invite_open' } }), teacher);
  const invite = await ui.service.call('issueInvite', request({ classId: classroom.classId }), teacher);
  await ui.click(ui.get('account-buttons').children[1]); await ui.createHero('مینا');
  const id = ui.state().studentId;
  await ui.go('classes'); ui.get('student-invite').value = invite.token; await ui.submit('join-class');
  assert.equal(ui.state().classId, classroom.classId); assert.equal(ui.state().studentId, id);
  assert.equal(ui.get('join-class').hidden, true);
  assert.equal(ui.get('student-classes').children.length, 1);
  await ui.click(ui.get('logout')); await ui.click(ui.get('account-buttons').children[1]);
  assert.equal(ui.get('hero-story').hidden, true); assert.equal(ui.state().classId, classroom.classId);
  await ui.go('classes'); assert.equal(ui.get('join-class').hidden, true); assert.equal(ui.profileCount(), 1);
  await ui.click(ui.get('class-practice')); await ui.submit('start-session');
  assert.equal(ui.state().session.classId, classroom.classId);
});
