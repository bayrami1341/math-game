'use strict';

// Offline integration tests: real page/game code, isolated browser storage,
// and a shared in-memory Realtime Database. No production data is accessed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const inline = file => [...read(file).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).filter(code => code.trim()).join('\n');

function storage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
}

function element() {
  const el = {
    value: '', children: [], listeners: {}, style: {}, focus() {}, classList: { add() {}, remove() {} },
    appendChild(child) { this.children.push(child); },
    addEventListener(type, callback) { this.listeners[type] = callback; }
  };
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get: () => text,
    set(value) { text = String(value); this.children = []; }
  });
  Object.defineProperty(el, 'innerHTML', {
    set(value) { assert.equal(value, '', 'Dynamic content must use textContent'); this.children = []; }
  });
  return el;
}

function page(localStorage = storage()) {
  const elements = new Map();
  const events = new Map();
  const context = vm.createContext({
    localStorage, location: { href: '' }, console: { log() {}, warn() {}, error() {} },
    crypto: require('node:crypto').webcrypto,
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: element,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    addEventListener(type, callback) {
      if (!events.has(type)) events.set(type, []);
      events.get(type).push(callback);
    },
    sharedSound: null, setTimeout: () => 0
  });
  context.window = context;
  // Window.status is a string property in actual browsers, not a DOM element.
  let windowStatus = '';
  Object.defineProperty(context, 'status', {
    get: () => windowStatus,
    set: value => { windowStatus = String(value); }
  });
  return {
    context, elements,
    run(file) { vm.runInContext(read(file), context, { filename: file }); },
    inline(file) { vm.runInContext(inline(file), context, { filename: file }); },
    event(type) { (events.get(type) || []).forEach(callback => callback()); },
    el(id) { return context.document.getElementById(id); }
  };
}

function database() {
  const rooms = new Map();
  const listeners = new Map();
  let failWrites = false;
  let writes = 0;
  let connected = true;
  const connectionListeners = new Set();
  function snapshot(room) {
    return { val: () => Object.fromEntries(rooms.get(room) || []) };
  }
  const db = {
    ref(refPath) {
      if (refPath === '.info/connected') return {
        on(type, next) { connectionListeners.add(next); next({ val: () => connected }); },
        off(type, next) { connectionListeners.delete(next); }
      };
      const [, room, , playerId] = refPath.split('/');
      return {
        set(payload) {
          writes++;
          if (failWrites) return Promise.reject(new Error('PERMISSION_DENIED'));
          if (!rooms.has(room)) rooms.set(room, new Map());
          rooms.get(room).set(playerId, JSON.parse(JSON.stringify(payload)));
          (listeners.get(room) || []).forEach(item => item.next(snapshot(room)));
          return Promise.resolve();
        },
        on(type, next, error) {
          if (!listeners.has(room)) listeners.set(room, []);
          listeners.get(room).push({ next, error });
          next(snapshot(room));
        },
        off(type, next) {
          listeners.set(room, (listeners.get(room) || []).filter(item => item.next !== next));
        }
      };
    },
    denyReads(room) {
      (listeners.get(room) || []).forEach(item => item.error(new Error('PERMISSION_DENIED')));
    },
    set failWrites(value) { failWrites = value; },
    set connected(value) {
      connected = value;
      connectionListeners.forEach(next => next({ val: () => connected }));
    },
    get connectionListenerCount() { return connectionListeners.size; },
    get writes() { return writes; },
    listenerCount(room) { return (listeners.get(room) || []).length; }
  };
  return db;
}

function join(p, name = 'تینا', code = '123456') {
  p.inline('join.html');
  p.el('name').value = name;
  p.el('code').value = code;
  p.el('join-form').listeners.submit({ preventDefault() {} });
}

function board(db, localStorage) {
  const p = page(localStorage);
  p.context.fbDB = db;
  p.run('live-board.js');
  p.inline('leaderboard.html');
  p.event('pageshow');
  return p;
}

function game(db, localStorage) {
  const p = page(localStorage);
  p.context.fbDB = db;
  ['src/core/pedagogy.js', 'src/core/utils.js', 'live-board.js',
    'src/games/multiplication-1x1/core-play.js'].forEach(file => p.run(file));
  p.context.ProfileManager = { getActive: () => ({ profileId: 'old-profile', displayName: 'نام قدیمی' }) };
  p.context.HeroesCore = { checkAndAward: () => ({ newlyAwarded: [] }) };
  return p;
}

function finish(p, correctCount, sector = 1) {
  p.context.corePlay = {
    core: {
      scheduler: { summarizeSector: () => [] },
      presentation: { report: () => ({ line: '' }) }
    },
    step: null, profileId: 'old-profile', sectorId: sector,
    session: { name: 'نام جلسه', events: Array.from({ length: correctCount + 1 }, (_, i) => ({
      f1: 2, f2: 3, correct: i < correctCount, ms: 1500, origin: 'core'
    })) }
  };
  p.context.paintCore(false);
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const scores = p => p.el('list').children.map(item => item.children.slice(0, 2).map(child => child.textContent));

for (const code of ['123456', '۱۲۳۴۵۶', '١٢٣٤٥٦', '۱2٣۴5٦']) {
  test('join normalizes classroom digits: ' + code, () => {
    const p = page();
    join(p, '  تینا  ', code);
    assert.equal(p.context.localStorage.getItem('demo_class_code'), '123456');
    assert.equal(p.context.localStorage.getItem('demo_student_name'), 'تینا');
    assert.match(p.context.localStorage.getItem('demo_player_id'), /^p_/);
    assert.equal(p.context.location.href, 'index.html');
  });
}

test('invalid classroom codes and blank names do not save or navigate', () => {
  for (const code of ['abcdef', '12/456', '12345', '1234567', '۱۲۳۴۵x']) {
    const p = page();
    join(p, 'تینا', code);
    assert.equal(p.context.location.href, '');
    assert.equal(p.context.localStorage.getItem('demo_player_id'), null);
  }
  const p = page();
  join(p, '   ');
  assert.equal(p.context.location.href, '');
});

test('player identity survives repeat joins and differs across independent browsers', () => {
  const first = page();
  join(first);
  const id = first.context.localStorage.getItem('demo_player_id');
  join(first, 'تینا', '654321');
  assert.equal(first.context.localStorage.getItem('demo_player_id'), id);
  const second = page();
  join(second);
  assert.notEqual(second.context.localStorage.getItem('demo_player_id'), id);
});

test('blocked local storage displays a useful join error', () => {
  const p = page({ getItem() { throw new Error('blocked'); } });
  join(p);
  assert.match(p.el('msg').textContent, /ذخیره/);
  assert.equal(p.context.location.href, '');
});

test('two independent players reach the same live board with actual sector scores', async () => {
  const db = database();
  const a = page(), b = page();
  join(a, 'علی', '۱۲۳۴۵۶');
  join(b, 'مینا', '123456');
  const boardA = board(db, a.context.localStorage);
  const boardB = board(db, b.context.localStorage);
  const otherStorage = storage();
  otherStorage.setItem('demo_class_code', '654321');
  const otherBoard = board(db, otherStorage);
  assert.match(boardA.el('status').textContent, /هنوز/);
  const gameA = game(db, a.context.localStorage);
  const gameB = game(db, b.context.localStorage);
  finish(gameA, 2);
  finish(gameB, 5);
  await settle();
  assert.deepEqual(scores(boardA), [['مینا', '5'], ['علی', '2']]);
  assert.deepEqual(scores(boardB), scores(boardA));
  assert.deepEqual(scores(otherBoard), []);
  assert.equal(gameA.context.AppStorage.getAll()[0].origin, 'core');
  assert.equal(gameA.context.AppStorage.getAll()[0].details[0].correctCount, 2);
  // Repainting the completion screen must not submit duplicate writes.
  gameA.context.paintCore(false);
  gameB.context.paintCore(false);
  await settle();
  assert.equal(db.writes, 2);
  // A new sector overwrites that player's previous result; it does not add it.
  finish(gameA, 1, 2);
  await settle();
  assert.deepEqual(scores(boardA), [['مینا', '5'], ['علی', '1']]);
});

test('pending score writes are not duplicated by repainting', async () => {
  let release;
  let count = 0;
  const db = { ref() { return { set() {
    count++;
    return new Promise(resolve => { release = resolve; });
  } }; } };
  const p = page();
  join(p);
  const g = game(db, p.context.localStorage);
  finish(g, 2);
  g.context.paintCore(false);
  assert.equal(count, 1);
  release();
  await settle();
  assert.equal(g.context.corePlay.liveScoreSent, true);
});

test('an unrelated SocialCore failure does not prevent live submission', async () => {
  const db = database();
  const p = page();
  join(p);
  const g = game(db, p.context.localStorage);
  g.context.AppStorage.setActiveClass('local-class');
  g.context.SocialCore = { classes: { submitScore() { throw new Error('local score failure'); } } };
  finish(g, 3);
  await settle();
  assert.equal(g.context.corePlay.liveScoreSent, true);
});

test('failed writes are reported as unsuccessful and allow a later retry', async () => {
  const db = database();
  db.failWrites = true;
  const p = page();
  join(p);
  const g = game(db, p.context.localStorage);
  finish(g, 2);
  await settle();
  assert.equal(g.context.corePlay.liveScoreSent, false);
  assert.equal(g.context.corePlay.liveScorePending, false);
  db.failWrites = false;
  g.context.paintCore(false);
  await settle();
  assert.equal(g.context.corePlay.liveScoreSent, true);
});

test('a player outside a live classroom does not submit to Firebase', () => {
  const db = database();
  finish(game(db, storage()), 2);
  assert.equal(db.writes, 0);
});

test('missing room, blocked storage, and missing Firebase show a visible message', () => {
  assert.match(board(database(), storage()).el('status').textContent, /کد کلاس نیست/);
  const s = storage();
  s.setItem('demo_class_code', '123456');
  assert.match(board(null, s).el('status').textContent, /Firebase آماده نیست/);
  const p = board(database(), { getItem() { throw new Error('blocked'); } });
  assert.match(p.el('status').textContent, /دریافت نتایج ممکن نشد/);
});

test('listener permission errors clear stale scores and display a visible error', async () => {
  const db = database();
  const p = page();
  join(p);
  const b = board(db, p.context.localStorage);
  const g = game(db, p.context.localStorage);
  finish(g, 2);
  await settle();
  assert.equal(scores(b).length, 1);
  db.denyReads('123456');
  assert.match(b.el('status').textContent, /دریافت نتایج ممکن نشد/);
  assert.deepEqual(scores(b), []);
});

test('leaving and restoring the leaderboard cleans up and reconnects listeners', () => {
  const db = database();
  const p = page();
  join(p);
  const b = board(db, p.context.localStorage);
  assert.equal(db.listenerCount('123456'), 1);
  b.event('pageshow');
  assert.equal(db.listenerCount('123456'), 1);
  b.event('pagehide');
  assert.equal(db.listenerCount('123456'), 0);
  b.event('pageshow');
  assert.equal(db.listenerCount('123456'), 1);
});

test('player names render as text rather than HTML', async () => {
  const db = database();
  const p = page();
  const name = '<img src=x onerror=alert(1)>';
  join(p, name);
  const b = board(db, p.context.localStorage);
  finish(game(db, p.context.localStorage), 0);
  await settle();
  assert.deepEqual(scores(b), [[name, '0']]);
});

test('Firebase is optional for local play and reports missing database to listeners', async () => {
  const p = page();
  p.run('live-board.js');
  assert.equal(await p.context.LiveBoard.submitScore('123456', { profileId: 'p_1' }), false);
  let reported = false;
  const stop = p.context.LiveBoard.listen('123456', () => assert.fail('No database'), () => { reported = true; });
  assert.equal(reported, true);
  stop();
});

test('Firebase scripts load exactly once before the game and demo scores are removed', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*>/g)].map(match => match[1].split('?')[0]);
  const required = ['https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js',
    'firebase-config.js', 'live-board.js', 'src/games/multiplication-1x1/core-play.js'];
  required.forEach((src, i) => {
    assert.equal(scripts.filter(item => item === src).length, 1);
    if (i) assert.ok(scripts.indexOf(required[i - 1]) < scripts.indexOf(src));
  });
  assert.ok(!html.includes('demo_scores'));
  assert.ok(!read('leaderboard.html').includes('demo_scores'));
});

test('arcade sector and final completion publish each sector rather than cumulative points', async () => {
  const db = database();
  const p = page();
  join(p, 'بازیکن متحرک');
  const b = board(db, p.context.localStorage);
  const g = game(db, p.context.localStorage);
  ['src/games/multiplication-1x1/config.js', 'src/games/multiplication-1x1/game.js',
    'src/ui/ui-controller.js'].forEach(file => g.run(file));
  const controller = Object.create(g.context.UIController.prototype);
  const engine = Object.create(g.context.GameController.prototype);
  Object.assign(engine, {
    _listeners: {}, currentFact: {}, mainCount: 4, sectorIdx: 0, sectorsCompleted: 0,
    modulesAttached: 4, playerName: 'نام داستان',
    pedagogy: {
      leitner: { advance() {}, hasPendingInSector: () => false, reset() {} },
      getReportData: () => [], getDiagnosticInsights: () => []
    }
  });
  controller.game = engine;
  controller.sound = { playSectorFanfare() {} };
  // A local report error must not swallow the independent live write.
  g.context.AppStorage.addDossier = () => { throw new Error('local storage full'); };
  controller._bindGame();
  engine.proceed();
  await settle();
  assert.deepEqual(scores(b), [['بازیکن متحرک', '4']]);
  assert.equal(engine.liveSectorResults[1].liveSubmission.player.sector, 1);
  controller._renderS(g.context.SECTORS[1]);
  await settle();
  assert.equal(db.writes, 1);
  engine.mainCount = 4;
  engine.modulesAttached = 7;
  engine.proceed();
  await settle();
  assert.deepEqual(scores(b), [['بازیکن متحرک', '3']]);
  engine.mainCount = 7;
  engine.modulesAttached = 12;
  engine.proceed();
  await settle();
  assert.equal(engine.state, 'DONE');
  assert.equal(engine.liveSectorResults[3].liveScoreSent, true);
  assert.deepEqual(scores(b), [['بازیکن متحرک', '5']]);
  assert.equal(db.writes, 3);
});

test('completion shows failure and retry button sends the same result after recovery', async () => {
  const db = database();
  db.failWrites = true;
  const p = page();
  join(p);
  const g = game(db, p.context.localStorage);
  finish(g, 3);
  await settle();
  const status = g.el('core-live-status');
  assert.match(status.textContent, /ارسال نشد/);
  assert.equal(status.children[0].textContent, 'تلاش دوباره');
  db.failWrites = false;
  status.children[0].listeners.click();
  await settle();
  assert.match(status.textContent, /امتیاز 3.*123456.*ثبت شد/);
  assert.equal(status.children.length, 0);
});

test('local dossier failure cannot prevent the learning game live write', async () => {
  const db = database();
  const p = page();
  join(p);
  const g = game(db, p.context.localStorage);
  g.context.AppStorage.getActiveClass = () => { throw new Error('broken local class'); };
  finish(g, 2);
  await settle();
  assert.equal(g.context.corePlay.liveScoreSent, true);
});

test('a missing or incompatible old player id is replaced by a stable valid Firebase id', async () => {
  const db = database();
  for (const oldId of ['', 'old-profile']) {
    const s = storage();
    s.setItem('demo_class_code', '123456');
    s.setItem('demo_player_id', oldId);
    const g = game(db, s);
    finish(g, 2);
    await settle();
    const id = s.getItem('demo_player_id');
    assert.match(id, /^p_[A-Za-z0-9-]{8,100}$/);
    finish(g, 3, 2);
    await settle();
    assert.equal(s.getItem('demo_player_id'), id);
  }
});

test('disconnected leaderboard labels stale rows and reconnect does not leak listeners', async () => {
  const db = database();
  const p = page();
  join(p);
  const b = board(db, p.context.localStorage);
  finish(game(db, p.context.localStorage), 2);
  await settle();
  db.connected = false;
  assert.match(b.el('status').textContent, /ممکن است قدیمی/);
  assert.equal(scores(b).length, 1);
  db.connected = true;
  assert.match(b.el('status').textContent, /نتایج زنده/);
  b.el('refresh').listeners.click();
  assert.equal(db.listenerCount('123456'), 1);
  assert.equal(db.connectionListenerCount, 1);
  b.event('pagehide');
  assert.equal(db.connectionListenerCount, 0);
});
