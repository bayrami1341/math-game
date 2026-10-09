/* bottleneck.js — تشخیص گلوگاه، فاز ۱ نسخهٔ ۷ */
(function (root, factory) {
  var api = factory(root.GraphData);
  if (typeof module === 'object' && module) module.exports = api;
  if (root) root.Bottleneck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (GraphData) {
  'use strict';

  var CONFIG = {
    minFactsToName: 2,
    minStudentsToName: 3,
    minFactsPerStudent: 2,
    priority: ['G', 'P', 'N', 'D', 'A', 'S', 'C']
  };

  function keyOf(f1, f2) {
    var a = Number(f1);
    var b = Number(f2);
    if (!a || !b) return null;
    return Math.min(a, b) + '×' + Math.max(a, b);
  }

  function isTable(f1, f2, given) {
    var n;
    for (n = 2; n <= 9; n++) {
      if (n !== f2 && n * f1 === given) return true;
      if (n !== f1 && n * f2 === given) return true;
    }
    return false;
  }

  function classify(f1, f2, given) {
    var product = f1 * f2;
    var key = keyOf(f1, f2);
    var swap = GraphData.swapOf(key);
    if (given === product) return null;
    if (given === f1 + f2 && f1 + f2 !== product) return 'SUM';
    if (given === (f1 - 1) * f2 || given === f1 * (f2 - 1)) return 'LESS';
    if (given === (f1 + 1) * f2 || given === f1 * (f2 + 1)) return 'MORE';
    if (swap && given === swap.swapped) return 'SWAP';
    if (isTable(f1, f2, given)) return 'TABLE';
    return 'OTHER';
  }

  function emptyBag() {
    return { SUM: [], SWAP: [], TABLE: [], LESS: [], MORE: [], TRANSFER: [], SHAPE: [], OTHER: [] };
  }

  function knownHalf(facts, fromKey) {
    var row = facts[fromKey];
    return !!(row && row.unassistedCorrect > 0);
  }

  function doublingHits(facts) {
    var hits = [];
    GraphData.EDGES.forEach(function (edge) {
      if (edge.type !== 'doubling') return;
      if (!knownHalf(facts, edge.from)) return;
      var dest = facts[edge.to];
      var from = GraphData.factByKey(edge.from);
      if (!dest || !from || !dest.wrongs.length) return;
      var echoed = dest.wrongs.some(function (w) { return w.given === from.product; });
      if (echoed) hits.push(edge.to);
    });
    return hits;
  }

  function shapeHits(events) {
    var keys = {};
    events.forEach(function (event) {
      if (event.filler || event.representation !== 'swapped') return;
      var key = keyOf(event.f1, event.f2);
      if (!key) return;
      if (event.correct === false || event.sawAsNew === true) keys[key] = true;
    });
    return Object.keys(keys);
  }

  function diagnoseStudent(events, profileId) {
    var facts = {};
    var list = Array.isArray(events) ? events : [];
    list.forEach(function (event) {
      if (!event || event.filler) return;
      var f1 = Number(event.f1);
      var f2 = Number(event.f2);
      var key = keyOf(f1, f2);
      if (!key || !GraphData.factByKey(key)) return;
      if (!facts[key]) {
        facts[key] = { key: key, attempts: 0, unassistedCorrect: 0, assisted: 0, wrongs: [], codes: {} };
      }
      var row = facts[key];
      row.attempts += 1;
      if (event.assisted) row.assisted += 1;
      if (event.correct && !event.assisted) row.unassistedCorrect += 1;
      if (!event.correct) {
        var code = classify(f1, f2, Number(event.given));
        row.wrongs.push({ given: Number(event.given), code: code, assisted: !!event.assisted });
        row.codes[code] = (row.codes[code] || 0) + 1;
      }
    });
    var bag = emptyBag();
    Object.keys(facts).forEach(function (key) {
      var codes = facts[key].codes;
      if (codes.SUM) bag.SUM.push(key);
      if (codes.SWAP) bag.SWAP.push(key);
      if (codes.TABLE) bag.TABLE.push(key);
      if (codes.LESS) bag.LESS.push(key);
      if (codes.MORE) bag.MORE.push(key);
    });
    bag.TRANSFER = doublingHits(facts);
    bag.SHAPE = shapeHits(list);
    var skip = bag.LESS.concat(bag.MORE).filter(function (key) { return key.indexOf('2×') === 0; });
    var array = bag.LESS.filter(function (key) {
      var fact = GraphData.factByKey(key);
      return fact && fact.f1 >= 3 && !facts[key].codes.SUM;
    });
    var candidates = [
      { id: 'G', facts: unique(bag.SUM) },
      { id: 'P', facts: unique(bag.SWAP) },
      { id: 'N', facts: unique(bag.TABLE) },
      { id: 'D', facts: unique(bag.TRANSFER) },
      { id: 'A', facts: unique(array) },
      { id: 'S', facts: unique(skip) },
      { id: 'C', facts: unique(bag.SHAPE) }
    ].filter(function (item) { return item.facts.length >= CONFIG.minFactsToName; });
    candidates.sort(function (a, b) {
      return CONFIG.priority.indexOf(a.id) - CONFIG.priority.indexOf(b.id);
    });
    var primary = null;
    if (candidates.length) {
      var win = candidates[0];
      var meta = GraphData.bottleneckById(win.id);
      primary = { id: win.id, name: meta.name, facts: win.facts, tomorrow: meta.tomorrow, blocksSector: meta.blocksSector };
    }
    var dependent = [];
    if (primary) {
      GraphData.EDGES.forEach(function (edge) {
        if (primary.facts.indexOf(edge.from) !== -1) dependent.push(edge.to);
      });
    }
    return {
      profileId: profileId || null,
      primaryBottleneck: primary,
      candidates: candidates,
      facts: facts,
      dependent: unique(dependent),
      dataEnough: !!primary
    };
  }

  function diagnoseClass(studentsDiagnoses) {
    var rows = Array.isArray(studentsDiagnoses) ? studentsDiagnoses : [];
    var groups = {};
    rows.forEach(function (row) {
      if (!row || !row.primaryBottleneck) return;
      if (row.primaryBottleneck.facts.length < CONFIG.minFactsPerStudent) return;
      var id = row.primaryBottleneck.id;
      if (!groups[id]) groups[id] = [];
      groups[id].push({ profileId: row.profileId, facts: row.primaryBottleneck.facts.slice() });
    });
    var shared = Object.keys(groups).map(function (id) {
      var meta = GraphData.bottleneckById(id);
      var members = groups[id];
      return {
        id: id, name: meta.name, students: members, count: members.length,
        tomorrow: meta.tomorrow, named: members.length >= CONFIG.minStudentsToName
      };
    }).sort(function (a, b) { return b.count - a.count; });
    var named = shared.filter(function (item) { return item.named; });
    return { shared: shared, primaryBottleneck: named.length ? named[0] : null, noPattern: named.length === 0 };
  }

  function unique(list) {
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      if (!seen[item]) { seen[item] = true; out.push(item); }
    });
    return out;
  }

  return { CONFIG: CONFIG, classify: classify, diagnoseStudent: diagnoseStudent, diagnoseClass: diagnoseClass };
});
