#!/usr/bin/env node
'use strict';

const path = require('path');

global.window = global;
global.toFa = function (n) { return String(n); };

function memoryStorage() {
  var bag = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null; },
    setItem: function (key, value) { bag[key] = String(value); },
    removeItem: function (key) { delete bag[key]; }
  };
}
global.localStorage = memoryStorage();

require(path.join(__dirname, '../src/core/pedagogy.js'));
require(path.join(__dirname, '../src/core/graph-data.js'));
require(path.join(__dirname, '../src/core/bottleneck.js'));
require(path.join(__dirname, '../src/core/utils.js'));

global.document = {
  addEventListener: function () {},
  getElementById: function () { return null; },
  createElement: function () { return { id: '', className: '', appendChild: function () {}, classList: { add: function () {} } }; },
  querySelectorAll: function () { return []; }
};
global.WorkshopCore = global.WorkshopCore || { create: function () { return { judge: { answer: function () { return {}; } }, presentation: { assisted: function () { return false; }, stays: function () { return false; }, afterWrong: function () { return ''; } }, session: { apply: function (s) { return s; } } }; } };

require(path.join(__dirname, '../src/games/multiplication-1x1/core-play.js'));
require(path.join(__dirname, './mastery-suite.js'));

var failed = global.runMasterySuite();
if (failed) {
  console.log('FAIL ' + failed);
  process.exit(1);
}
console.log('PASS 17');
process.exit(0);
