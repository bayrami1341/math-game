/* کارگاه ایستگاه — هستهٔ شش‌بافتی
 * بدون DOM، بدون localStorage، بدون Canvas.
 * تنها محل اتصال بافت‌ها تابع create است.
 *
 *   برنامه  → فهرست هدف و کلید ضرب
 *   داوری   → درست / غلط و نوع خطا
 *   جلسه    → دفتر رویداد، بدون سیاست
 *   نوبت    → سؤال بعدی، فقط با خواندن دفتر
 *   بیان    → مدل دید، نه رسم
 *   پرونده  → عکس جلسه برای معلم
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkshopCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BETWEEN = 3;
  var RETURN_GAP = 3;
  var ATTEMPT_CAP = 6;
  var FOCUS_CAP = 3;

  var SECTORS = [
    { id: 1, title: 'دسته‌های کوچک', facts: [[2, 2], [2, 3], [2, 4], [2, 5], [3, 3], [3, 4], [3, 5]] },
    { id: 2, title: 'دو، چهار و پنج', facts: [[2, 6], [2, 7], [2, 8], [2, 9], [3, 6], [4, 4], [4, 5], [5, 5]] },
    { id: 3, title: 'دسته‌های شلوغ‌تر', facts: [[3, 7], [3, 8], [3, 9], [4, 6], [5, 6], [6, 6], [6, 7], [7, 7]] }
  ];

  var ERRORS = ['SUM', 'LESS', 'MORE', 'SWAP', 'TABLE', 'OTHER'];

  function assertCurriculum() {
    var seen = {};
    SECTORS.forEach(function (sector) {
      sector.facts.forEach(function (pair) {
        if (pair[0] > pair[1]) throw new Error('عدد کوچک‌تر باید اول باشد: ' + pair.join('×'));
        if (pair[0] < 2 || pair[1] > 9) throw new Error('خارج از محدوده: ' + pair.join('×'));
        var k = pair[0] + '×' + pair[1];
        if (seen[k]) throw new Error('ضرب تکراری: ' + k);
        seen[k] = sector.id;
      });
    });
  }

  function fa(n) {
    return String(n).replace(/[0-9]/g, function (d) {
      return '۰۱۲۳۴۵۶۷۸۹'[d];
    });
  }

  function keyOf(a, b) {
    var lo = Math.min(a, b);
    var hi = Math.max(a, b);
    return lo + '×' + hi;
  }

  function pairFromKey(key) {
    var parts = String(key).split('×');
    if (parts.length !== 2) return null;
    var a = Number(parts[0]);
    var b = Number(parts[1]);
    if (!a || !b) return null;
    return a <= b ? [a, b] : [b, a];
  }

  function sectorIdOf(key) {
    var pair = pairFromKey(key);
    if (!pair) return null;
    var canonical = pair[0] + '×' + pair[1];
    for (var i = 0; i < SECTORS.length; i++) {
      for (var j = 0; j < SECTORS[i].facts.length; j++) {
        var stored = SECTORS[i].facts[j];
        if (stored[0] + '×' + stored[1] === canonical) return SECTORS[i].id;
      }
    }
    return null;
  }

  function emptyErrors() {
    var out = {};
    ERRORS.forEach(function (code) { out[code] = 0; });
    return out;
  }

  function targetsFor(session) {
    var sector = SECTORS[session.sector - 1];
    var base = sector.facts.map(function (pair) { return [pair[0], pair[1]]; });
    if (session.sector !== 1) return base;
    var inSector = {};
    base.forEach(function (pair) { inSector[pair[0] + '×' + pair[1]] = true; });
    var focus = (session.focus || []).map(pairFromKey).filter(function (pair) {
      return pair && inSector[pair[0] + '×' + pair[1]];
    });
    var focusKeys = {};
    focus.forEach(function (pair) { focusKeys[pair[0] + '×' + pair[1]] = true; });
    var rest = base.filter(function (pair) { return !focusKeys[pair[0] + '×' + pair[1]]; });
    return focus.concat(rest);
  }

  function classify(f1, f2, given) {
    if (typeof given !== 'number') return 'OTHER';
    var product = f1 * f2;
    if (given === product) return null;
    if (given === f1 + f2) return 'SUM';
    if (given === (f1 - 1) * f2 || given === f1 * (f2 - 1)) return 'LESS';
    if (given === (f1 + 1) * f2 || given === f1 * (f2 + 1)) return 'MORE';
    var text = String(product);
    if (text.length === 2 && text[0] !== text[1] && given === parseInt(text[1] + text[0], 10)) return 'SWAP';
    var onTable = [2, 3, 4, 5, 6, 7, 8, 9].some(function (n) {
      return (n !== f2 && n * f1 === given) || (n !== f1 && n * f2 === given);
    });
    return onTable ? 'TABLE' : 'OTHER';
  }

  function errorText(code, f1, f2) {
    if (code === 'SUM') return fa(f1) + ' و ' + fa(f2) + ' را جمع کردی. اینجا ' + fa(f2) + ' را ' + fa(f1) + ' بار داریم.';
    if (code === 'LESS') return 'یک دسته کم شمردی.';
    if (code === 'MORE') return 'یک دسته زیاد شمردی.';
    if (code === 'SWAP') return 'دهگان و یکان جابه‌جا شده.';
    if (code === 'TABLE') return 'این حاصلِ ضرب دیگری است.';
    return 'دوباره دسته‌ها را بشمار.';
  }

  function isFluent(marks) {
    for (var i = 0; i < marks.length; i++) {
      for (var j = i + 1; j < marks.length; j++) {
        if (marks[j] - marks[i] >= BETWEEN + 1) return true;
      }
    }
    return false;
  }

  function fold(events) {
    var facts = {};
    events.forEach(function (event, index) {
      if (event.filler) return;
      var key = keyOf(event.f1, event.f2);
      var fact = facts[key];
      if (!fact) {
        fact = {
          key: key,
          f1: Math.min(event.f1, event.f2),
          f2: Math.max(event.f1, event.f2),
          attempts: 0,
          lastAskedAt: -1,
          unassistedAt: [],
          fluent: false,
          shaky: false,
          errors: emptyErrors()
        };
      }
      fact.attempts += 1;
      fact.lastAskedAt = index;
      if (event.correct && !event.assisted) fact.unassistedAt.push(index);
      if (!event.correct && fact.errors[event.error] != null) fact.errors[event.error] += 1;
      fact.fluent = isFluent(fact.unassistedAt);
      fact.shaky = fact.attempts >= ATTEMPT_CAP && !fact.fluent;
      facts[key] = fact;
    });
    return facts;
  }

  function gapMet(events, fact) {
    if (!fact || fact.attempts === 0) return false;
    return events.length - fact.lastAskedAt - 1 >= RETURN_GAP;
  }

  function ask(pair, eventsLength, reason) {
    var f1 = pair[0];
    var f2 = pair[1];
    if (f1 !== f2 && eventsLength % 2 === 1) {
      f1 = pair[1];
      f2 = pair[0];
    }
    return { type: 'ask', f1: f1, f2: f2, key: pair[0] + '×' + pair[1], reason: reason };
  }

  function pendingOf(pairs, stats) {
    return pairs.filter(function (pair) {
      var fact = stats[pair[0] + '×' + pair[1]];
      return !fact || (!fact.fluent && !fact.shaky);
    });
  }

  function curriculumApi() {
    return {
      sectors: SECTORS.map(function (sector) {
        return { id: sector.id, title: sector.title, facts: sector.facts.map(function (pair) { return pair.slice(); }) };
      }),
      count: SECTORS.length,
      key: keyOf,
      sectorOf: sectorIdOf,
      targets: function (sectorId) {
        var sector = SECTORS[sectorId - 1];
        return sector ? sector.facts.map(function (pair) { return [pair[0], pair[1]]; }) : [];
      }
    };
  }

  function judgeApi() {
    return {
      answer: function (step, given, assisted) {
        var numeric = typeof given === 'number' && isFinite(given) ? given : null;
        var code = classify(step.f1, step.f2, numeric);
        var correct = code === null && numeric === step.f1 * step.f2;
        return {
          given: numeric,
          correct: correct,
          error: correct ? null : (code || 'OTHER'),
          assisted: Boolean(assisted),
          message: correct ? '' : errorText(code || 'OTHER', step.f1, step.f2)
        };
      }
    };
  }

  function sessionApi() {
    return {
      start: function (input) {
        var focus = (Array.isArray(input.focus) ? input.focus : []).filter(function (key) {
          return sectorIdOf(key);
        }).slice(0, FOCUS_CAP);
        var sector = Number(input.sector);
        if (!sector || sector < 1 || sector > SECTORS.length) sector = 1;
        return {
          id: String(input.id || ''),
          name: String(input.name || ''),
          className: String(input.className || ''),
          sector: sector,
          status: 'playing',
          focus: focus,
          events: []
        };
      },
      apply: function (session, step, judgment) {
        if (!step || step.type !== 'ask') return session;
        var events = session.events.concat([{
          f1: step.f1,
          f2: step.f2,
          given: judgment.given,
          correct: judgment.correct,
          error: judgment.error,
          assisted: judgment.assisted,
          filler: step.reason === 'filler'
        }]);
        return {
          id: session.id,
          name: session.name,
          className: session.className,
          sector: session.sector,
          status: session.status,
          focus: session.focus.slice(),
          events: events
        };
      },
      completeSector: function (session, isLast) {
        if (isLast) {
          return Object.assign({}, session, { status: 'done', focus: session.focus.slice(), events: session.events });
        }
        return Object.assign({}, session, {
          sector: session.sector + 1,
          status: 'playing',
          focus: session.focus.slice(),
          events: session.events
        });
      },
      abandon: function (session) {
        return Object.assign({}, session, { status: 'partial', focus: session.focus.slice(), events: session.events });
      },
      finish: function (session) {
        return Object.assign({}, session, { status: 'done', focus: session.focus.slice(), events: session.events });
      }
    };
  }

  function schedulerApi() {
    function summarizeSector(session, sectorId) {
      var stats = fold(session.events);
      var sector = SECTORS[sectorId - 1];
      return sector.facts.map(function (pair) {
        var key = pair[0] + '×' + pair[1];
        var fact = stats[key];
        if (!fact) {
          return { key: key, f1: pair[0], f2: pair[1], attempts: 0, fluent: false, shaky: false, errors: emptyErrors() };
        }
        return {
          key: key, f1: fact.f1, f2: fact.f2, attempts: fact.attempts,
          fluent: fact.fluent, shaky: fact.shaky, errors: Object.assign({}, fact.errors)
        };
      });
    }

    function next(session) {
      if (!session || session.status !== 'playing') return { type: 'done' };
      var stats = fold(session.events);
      var targets = targetsFor(session);
      var pending = pendingOf(targets, stats);
      if (!pending.length) {
        return {
          type: 'sector-done',
          sector: session.sector,
          isLast: session.sector >= SECTORS.length,
          title: SECTORS[session.sector - 1].title,
          facts: summarizeSector(session, session.sector)
        };
      }
      var due = pending.filter(function (pair) { return gapMet(session.events, stats[pair[0] + '×' + pair[1]]); });
      if (due.length) return ask(due[0], session.events.length, 'return');
      var fresh = pending.filter(function (pair) {
        var fact = stats[pair[0] + '×' + pair[1]];
        return !fact || fact.attempts === 0;
      });
      if (fresh.length) return ask(fresh[0], session.events.length, 'new');
      var pendingKeys = {};
      pending.forEach(function (pair) { pendingKeys[pair[0] + '×' + pair[1]] = true; });
      var fillers = targets.filter(function (pair) {
        var key = pair[0] + '×' + pair[1];
        return !pendingKeys[key] && stats[key] && stats[key].fluent;
      });
      if (!fillers.length) {
        fillers = targets.filter(function (pair) { return !pendingKeys[pair[0] + '×' + pair[1]]; });
      }
      if (!fillers.length) fillers = pending.slice();
      return ask(fillers[0], session.events.length, 'filler');
    }

    return { next: next, summarizeSector: summarizeSector, fold: fold };
  }

  var PHASES = ['answer', 'hint-group', 'hint-sum', 'count', 'reveal'];

  function presentationApi(scheduler) {
    function hint(phase, f1, f2) {
      if (phase === 'hint-group') return 'یک دسته را بشمار: ' + fa(f2) + ' تا.';
      if (phase === 'hint-sum') return Array(f1).fill(fa(f2)).join(' + ');
      if (phase === 'count') return 'حالا همهٔ خانه‌ها را با هم بشمار.';
      if (phase === 'reveal') return 'حاصل ' + fa(f1 * f2) + ' است. تو هم همان را وارد کن.';
      return '';
    }

    return {
      assisted: function (phase) { return phase !== 'answer'; },
      stays: function (phase, judgment) {
        if (judgment.correct) return false;
        return phase !== 'reveal';
      },
      afterWrong: function (phase) {
        var at = PHASES.indexOf(phase);
        if (at < 0) return 'answer';
        return PHASES[Math.min(at + 1, PHASES.length - 1)];
      },
      frame: function (session, step, phase) {
        if (!step || step.type === 'done') return { screen: 'done' };
        if (step.type === 'sector-done') {
          return { screen: 'sector', title: step.title, isLast: step.isLast, facts: step.facts };
        }
        var stats = scheduler.fold(session.events);
        var pieces = [];
        Object.keys(stats).forEach(function (key) {
          if (stats[key].fluent) pieces.push({ key: key, rows: stats[key].f1, cols: stats[key].f2 });
        });
        return {
          screen: 'question',
          phase: phase,
          prompt: fa(step.f1) + ' دستهٔ ' + fa(step.f2) + 'تایی',
          equation: fa(step.f1) + ' × ' + fa(step.f2),
          rows: step.f1,
          cols: step.f2,
          hint: hint(phase, step.f1, step.f2),
          showGroups: true,
          canEnter: true,
          pieces: pieces
        };
      },
      report: function (facts) {
        var firm = [];
        var weak = [];
        facts.forEach(function (fact) {
          var label = fa(fact.f1) + '×' + fa(fact.f2);
          if (fact.fluent) firm.push(label);
          else weak.push(label);
        });
        return {
          firm: firm,
          weak: weak,
          line: weak.length
            ? 'هنوز تمرین می‌خواهد: ' + weak.join('، ')
            : 'همهٔ ضرب‌های این زنگ محکم شد.'
        };
      }
    };
  }

  function escapeCsv(value) {
    var text = String(value == null ? '' : value);
    var dangerous = /^[=+\-@\t\r]/.test(text);
    var escaped = text.replace(/"/g, '""');
    return dangerous ? '"' + "'" + escaped + '"' : '"' + escaped + '"';
  }

  function recordApi(scheduler, storage, pin, now) {
    function snapshot(session) {
      var facts = [];
      for (var id = 1; id <= SECTORS.length; id++) {
        facts = facts.concat(scheduler.summarizeSector(session, id));
      }
      return {
        id: session.id,
        name: session.name,
        className: session.className,
        status: session.status,
        sector: session.sector,
        savedAt: now(),
        facts: facts
      };
    }

    function load() {
      var rows = storage.load();
      return Array.isArray(rows) ? rows.slice() : [];
    }

    return {
      save: function (session) {
        var snap = snapshot(session);
        var rows = load();
        var at = -1;
        for (var i = 0; i < rows.length; i++) if (rows[i].id === snap.id) at = i;
        if (at >= 0) rows[at] = snap;
        else rows.unshift(snap);
        storage.save(rows.slice(0, 200));
        return snap;
      },
      all: load,
      latestPerName: function () {
        var seen = {};
        var out = [];
        load().forEach(function (row) {
          if (seen[row.name]) return;
          seen[row.name] = true;
          out.push(row);
        });
        return out;
      },
      focusKeys: function (name, sectorId) {
        var rows = load();
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].name !== name) continue;
          return (rows[i].facts || []).filter(function (fact) {
            if (!fact || fact.fluent || !fact.attempts) return false;
            if (sectorId && sectorIdOf(fact.key) !== Number(sectorId)) return false;
            return true;
          }).map(function (fact) { return fact.key; });
        }
        return [];
      },
      csv: function () {
        var header = ['نام', 'کلاس', 'وضعیت', 'بخش', 'روان', 'لرزان', 'جمع', 'کم', 'زیاد', 'جابه‌جایی'];
        var lines = [header.map(escapeCsv).join(',')];
        load().forEach(function (row) {
          var firm = 0;
          var shaky = 0;
          var sum = 0;
          var less = 0;
          var more = 0;
          var swap = 0;
          (row.facts || []).forEach(function (fact) {
            if (fact.fluent) firm += 1;
            if (fact.shaky) shaky += 1;
            var errors = fact.errors || {};
            sum += errors.SUM || 0;
            less += errors.LESS || 0;
            more += errors.MORE || 0;
            swap += errors.SWAP || 0;
          });
          lines.push([
            row.name, row.className, row.status, row.sector, firm, shaky, sum, less, more, swap
          ].map(escapeCsv).join(','));
        });
        return '\uFEFF' + lines.join('\n');
      },
      pinOk: function (input) {
        return Boolean(pin) && String(input) === String(pin);
      }
    };
  }

  function memoryStorage(seed) {
    var rows = Array.isArray(seed) ? seed.slice() : [];
    return {
      load: function () { return rows.slice(); },
      save: function (next) { rows = next.slice(); }
    };
  }

  function create(options) {
    assertCurriculum();
    var opts = options || {};
    var scheduler = schedulerApi();
    return {
      curriculum: curriculumApi(),
      judge: judgeApi(),
      session: sessionApi(),
      scheduler: scheduler,
      presentation: presentationApi(scheduler),
      record: recordApi(scheduler, opts.storage || memoryStorage(), opts.pin || '', opts.now || function () { return new Date().toISOString(); })
    };
  }

  return { create: create, memoryStorage: memoryStorage };
});