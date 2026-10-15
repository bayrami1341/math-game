/* mastery-suite.js — T1..T16. هم در Node و هم در مرورگر. */
(function () {
  'use strict';

  function check(name, ok, detail) {
    var line = (ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : ' — ' + detail);
    if (typeof console !== 'undefined') console.log(line);
    return ok ? 0 : 1;
  }

  function runMasterySuite() {
    var failed = 0;
    var keyName = window.STORAGE_KEYS.RECORDS;

    failed += check('T1', (function () {
      localStorage.removeItem(keyName);
      var rows = window.AppStorage.getAll();
      return Array.isArray(rows) && rows.length === 0;
    })(), 'getAll');

    failed += check('T2', (function () {
      localStorage.setItem(keyName, '{خراب');
      var bad = window.AppStorage.getAll();
      localStorage.setItem(keyName, '{"not":"array"}');
      var obj = window.AppStorage.getAll();
      localStorage.removeItem(keyName);
      return Array.isArray(bad) && bad.length === 0 && Array.isArray(obj) && obj.length === 0;
    })(), 'json');

    failed += check('T3', (function () {
      var row = { attempts: 1, correctCount: 1, maxConsecutiveCorrect: 1, f1: 2, f2: 3 };
      window.migrateRow(row);
      return Array.isArray(row.history) && Array.isArray(row.wrongAnswers) && Array.isArray(row.errorCodes);
    })(), 'fields');

    failed += check('T4', (function () {
      var source = { attempts: 2, correctCount: 2, maxConsecutiveCorrect: 2, avgCorrectTimeMs: '1800', f1: 3, f2: 3 };
      var once = JSON.parse(JSON.stringify(source));
      var twice = JSON.parse(JSON.stringify(source));
      window.migrateRow(once);
      window.migrateRow(window.migrateRow(twice));
      var same = window.migrateRow(window.migrateRow(twice)) === twice;
      return same && JSON.stringify(once) === JSON.stringify(twice);
    })(), 'idempotent');

    failed += check('T5', (function () {
      var row = window.createRow();
      window.recordAttempt(row, true, '1200');
      return row.avgCorrectTimeMs === 1200 && row._correctTimeSum === 1200 && row.hasTiming === true;
    })(), 'string ms');

    failed += check('T6', (function () {
      var row = window.createRow();
      [null, undefined, NaN, -5, Infinity].forEach(function (ms) { window.recordAttempt(row, true, ms); });
      return row.hasTiming === false && row.avgCorrectTimeMs === 0 && row.correctCount === 5
        && window.evaluateMastery(row).level === 4;
    })(), 'inert ms');

    failed += check('T7', (function () {
      var row = window.createRow();
      window.recordAttempt(row, true, 99999999);
      var shown = window.formatCorrectTime(row);
      return shown === 99999999 && String(shown).indexOf('e') === -1 && String(shown).indexOf('E') === -1;
    })(), 'big ms');

    failed += check('T8', (function () {
      var basic = window.createRow();
      window.recordAttempt(basic, true, 1000);
      window.recordAttempt(basic, true, 1000);
      var familiar = window.createRow();
      window.recordAttempt(familiar, true, 1000);
      var basicLevel = window.evaluateMastery(basic).level;
      var familiarLevel = window.evaluateMastery(familiar).level;
      return basicLevel === 3 && window.isPositiveMastery(basic) === true
        && familiarLevel === 1 && window.isPositiveMastery(familiar) === false
        && window.isPositiveMastery(basic) === (basicLevel >= 3);
    })(), 'boundary');

    failed += check('T9', (function () {
      var threw = false;
      try { window.MASTERY.FLUENT.level = 0; } catch (err) { threw = true; }
      var threwObj = false;
      try { window.MASTERY.EXTRA = { level: 9 }; } catch (err) { threwObj = true; }
      return threw && threwObj && window.MASTERY.FLUENT.level === 5 && Object.isFrozen(window.MASTERY);
    })(), 'freeze');

    failed += check('T10', (function () {
      var leaked = false;
      try { leaked = typeof RULES !== 'undefined'; } catch (err) { leaked = false; }
      var threw = false;
      try { window.MASTERY_RULES.MIN_CONSECUTIVE = 9; } catch (err) { threw = true; }
      return leaked === false && threw && window.MASTERY_RULES.MIN_CONSECUTIVE === 3
        && window.MASTERY_RULES.FLUENT_MAX_MS_EXCLUSIVE === 4000
        && Object.isFrozen(window.MASTERY_RULES);
    })(), 'rules');

    failed += check('T11', (function () {
      var row = { attempts: 3, correctCount: 3, maxConsecutiveCorrect: 3, avgCorrectTimeMs: 2500, f1: 2, f2: 5 };
      window.migrateRow(row);
      var mastery = window.evaluateMastery(row);
      row.masteryLevel = mastery.level;
      var game = {
        pedagogy: { getReportData: function () { return [row]; } },
        maxStreakEver: 0,
        sectorsCompleted: 0
      };
      var result = window.evaluateBadges(game, []);
      return !!result && Array.isArray(result.all) && Array.isArray(row.history);
    })(), 'badges');

    failed += check('T12', (function () {
      var blank = {};
      window.migrateEventOrigin(blank);
      var kept = { origin: 'core' };
      window.migrateEventOrigin(kept);
      window.migrateEventOrigin(kept);
      var unknown = { origin: 'import' };
      window.migrateEventOrigin(unknown);
      return blank.origin === 'legacy' && kept.origin === 'core' && unknown.origin === 'import';
    })(), 'origin');

    failed += check('T13', (function () {
      var key = window.normalizeKey(4, 2);
      var parts = key.split('×');
      return key === '2×4' && parts[0] === '2' && parts[1] === '4'
        && key.indexOf('\u00d7') !== -1 && key.indexOf('\u2715') === -1;
    })(), 'times');

    failed += check('T14', (function () {
      var diagnosis = window.Bottleneck.diagnoseStudent([], 'x');
      return !!diagnosis && diagnosis.dataEnough === false && diagnosis.primaryBottleneck === null
        && Array.isArray(diagnosis.candidates) && diagnosis.facts !== null
        && Array.isArray(diagnosis.dependent) && diagnosis.profileId === 'x';
    })(), 'bottleneck');

    failed += check('T15', (function () {
      var a = { attempts: 1, correctCount: 1 };
      var b = { attempts: 1, correctCount: 1 };
      window.migrateRow(a);
      window.migrateRow(b);
      var freshA = window.createRow();
      var freshB = window.createRow();
      return a.history !== b.history && a.wrongAnswers !== b.wrongAnswers
        && freshA.history !== freshB.history && Array.isArray(a.history) && Array.isArray(a.wrongAnswers);
    })(), 'copies');

    failed += check('T16', (function () {
      var live = new window.PedagogyEngine();
      live.recordAttempt(2, 4, 8, true, 1500);
      var liveRow = live.getReportData()[0];
      var coreRow = window.rowsFromCoreEvents([{ f1: 4, f2: 2, given: 8, correct: true, ms: 1500 }])[0];
      var liveKeys = Object.keys(liveRow).sort().join(',');
      var coreKeys = Object.keys(coreRow).sort().join(',');
      return liveKeys === coreKeys && liveRow.avgCorrectTimeMs === 1500 && coreRow.avgCorrectTimeMs === 1500
        && liveRow.origin === 'legacy' && coreRow.origin === 'core';
    })(), 'paths');


    // T17: bridgeCoreToDossier avgTime from details, not from argument
    failed += check('T17', (function () {
      if (typeof window.bridgeCoreToDossier !== 'function') {
        return false;
      }
      var fn = window.bridgeCoreToDossier;
      var events = [
        { f1: 2, f2: 3, given: 6, correct: true, ms: 1500 },
        { f1: 2, f2: 3, given: 6, correct: true, ms: 2500 }
      ];
      var session = { name: 'test', className: 'c', events: events };
      if (window.AppStorage && window.AppStorage.saveAll) window.AppStorage.saveAll([]);
      fn(session, 'pid', 1, 100, 0);
      var all = window.AppStorage ? window.AppStorage.getAll() : [];
      if (!all.length) return false;
      var rec = all[0];
      var fromDetails = rec.details && rec.details.some(function (d) { return d.hasTiming && d.avgCorrectTimeMs > 0; });
      return fromDetails && rec.avgTime > 0 && rec.avgTime !== 0 && Math.abs(rec.avgTime - 2000) < 1;
    })(), 'avgTime from details');

    return failed;
  }

  window.runMasterySuite = runMasterySuite;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var failed = runMasterySuite();
      var host = document.getElementById('mastery-results');
      if (host) host.textContent = failed ? ('FAIL ' + failed) : 'PASS 17';
    });
  }
})();
