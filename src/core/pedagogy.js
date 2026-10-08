/* pedagogy.js — منطق آموزشی خالص — v1.0 */
(function () {
  'use strict';

  // ============================================
  // سطوح تسلط
  // ============================================
  window.MASTERY = {
    NOVICE: { level: 0, name: 'نوآموز' },
    FAMILIAR: { level: 1, name: 'آشنا' },
    LEARNING: { level: 2, name: 'در حال یادگیری' },
    BASIC: { level: 3, name: 'تسلط پایه' },
    STABLE: { level: 4, name: 'تسلط پایدار' },
    FLUENT: { level: 5, name: 'تسلط سیال' }
  };

  window.LEITNER_BOXES = [
    { box: 1, delay: 2 },
    { box: 2, delay: 4 },
    { box: 3, delay: 8 },
    { box: 4, delay: 15 },
    { box: 5, delay: 25 }
  ];

  window.normalizeKey = function (f1, f2) {
    return Math.min(f1, f2) + '×' + Math.max(f1, f2);
  };

  // ============================================
  // ارزیابی تسلط
  // ============================================
  window.evaluateMastery = function (r) {
    if (!r || r.attempts === 0) return window.MASTERY.NOVICE;
    if (r.maxConsecutiveCorrect >= 3 && r.avgCorrectTimeMs > 0 && r.avgCorrectTimeMs < 4000) return window.MASTERY.FLUENT;
    if (r.maxConsecutiveCorrect >= 3) return window.MASTERY.STABLE;
    if (r.maxConsecutiveCorrect >= 2) return window.MASTERY.BASIC;
    if (r.correctCount >= 2) return window.MASTERY.LEARNING;
    if (r.correctCount >= 1) return window.MASTERY.FAMILIAR;
    return window.MASTERY.NOVICE;
  };

  // ============================================
  // طبقه‌بندی خطا
  // ============================================
  window.classifyError = function (f1, f2, c) {
    const corr = f1 * f2;
    if (c === corr) return null;
    if (c === f1 + f2) return 'SUM';
    if (c === (f1 - 1) * f2 || c === f1 * (f2 - 1)) return 'LESS';
    if (c === (f1 + 1) * f2 || c === f1 * (f2 + 1)) return 'MORE';
    const s = String(corr);
    if (s.length === 2 && s[0] !== s[1] && c === parseInt(s[1] + s[0], 10)) return 'SWAP';
    const isTable = [2, 3, 4, 5, 6, 7, 8, 9].some(n => (n !== f2 && n * f1 === c) || (n !== f1 && n * f2 === c));
    if (isTable) return 'TABLE';
    return 'OTHER';
  };

  // ============================================
  // پیام خطا
  // ============================================
  window.errorMessage = function (code, f1, f2) {
    switch (code) {
      case 'SUM': return 'تو ' + window.toFa(f1) + ' و ' + window.toFa(f2) + ' را جمع کردی. اما ضرب یعنی ' + window.toFa(f2) + ' را ' + window.toFa(f1) + ' بار کنار هم بچینی.';
      case 'LESS': return 'یک دسته کمتر شمردی. تو ' + window.toFa(f2) + ' دسته داری، نه ' + window.toFa(f2 - 1) + ' دسته. دوباره با دقت بشمار.';
      case 'MORE': return 'یک دسته بیشتر شمردی. تو ' + window.toFa(f2) + ' دسته داری، نه ' + window.toFa(f2 + 1) + ' دسته. دوباره با دقت بشمار.';
      case 'SWAP': return 'ارقام را جابه‌جا کردی. حاصل این ضرب ' + window.toFa(f1 * f2) + ' است. با دقت نگاه کن.';
      case 'TABLE': return 'این حاصلِ ضرب دیگری است. ' + window.toFa(f1) + '×' + window.toFa(f2) + ' یعنی ' + window.toFa(f2) + ' تا دستهٔ ' + window.toFa(f1) + 'تایی.';
      default: return 'بیا با هم دوباره بشماریم. ' + window.toFa(f1) + ' دستهٔ ' + window.toFa(f2) + 'تایی داری.';
    }
  };

  // ============================================
  // پیام راهنما
  // ============================================
  window.hintMessage = function (phase, f1, f2) {
    switch (phase) {
      case 'hint-group': return '👀 به یک دسته نگاه کن. ' + window.toFa(f2) + ' خانه در آن هست. پس هر دسته = ' + window.toFa(f2) + '.';
      case 'hint-sum': return '🧮 ' + window.toFa(f1) + ' دسته داری که در هرکدام ' + window.toFa(f2) + ' خانه هست. یعنی ' + Array(f1).fill(window.toFa(f2)).join(' + ') + '.';
      case 'count': return '👆 حالا همهٔ خانه‌ها را با انگشتت از ۱ تا آخر بشمار و جواب را وارد کن.';
      case 'reveal': return '✨ حاصل این ضرب ' + window.toFa(f1 * f2) + ' است. حالا ' + window.toFa(f1 * f2) + ' را وارد کن.';
      default: return '';
    }
  };

  // ============================================
  // تولید گزینه‌ها
  // ============================================
  window.generateChoices = function (f1, f2, correct) {
    const pool = new Set();
    if (f1 > 1) pool.add((f1 - 1) * f2);
    if (f1 < 9) pool.add((f1 + 1) * f2);
    if (f2 > 1) pool.add(f1 * (f2 - 1));
    if (f2 < 9) pool.add(f1 * (f2 + 1));
    pool.add(f1 + f2);
    [correct - 1, correct + 1, correct - 2, correct + 2, correct + 10, correct - 10, correct + 9, correct - 9].forEach(v => {
      if (v > 0 && v <= 81) pool.add(v);
    });
    if (Math.random() < 0.15) {
      const str = String(correct);
      if (str.length === 2 && str[0] !== str[1]) pool.add(parseInt(str[1] + str[0], 10));
    }
    const cand = Array.from(pool).filter(n => n > 0 && n <= 81 && n !== correct).sort(() => Math.random() - 0.5);
    const choices = [correct];
    for (let i = 0; i < cand.length && choices.length < 4; i++) {
      if (!choices.includes(cand[i])) choices.push(cand[i]);
    }
    let off = 3;
    while (choices.length < 4) {
      const f = correct + (Math.random() > 0.5 ? off : -off);
      if (f > 0 && f <= 81 && !choices.includes(f)) choices.push(f);
      off += 2;
      if (off > 40) break;
    }
    while (choices.length < 4) {
      const f = Math.floor(Math.random() * 81) + 1;
      if (!choices.includes(f)) choices.push(f);
    }
    return choices.sort(() => Math.random() - 0.5);
  };

  // ============================================
  // Leitner — مرور فاصله‌دار
  // ============================================
  window.Leitner = class Leitner {
    constructor() { this.facts = new Map(); this.questionIndex = 0; }
    reset() { this.facts.clear(); this.questionIndex = 0; }
    register(k) { if (!this.facts.has(k)) this.facts.set(k, { box: 1, nextDue: 0 }); }
    dueKeys() {
      const d = [];
      for (const [k, i] of this.facts) if (i.nextDue <= this.questionIndex) d.push(k);
      return d;
    }
    record(k, ok) {
      const i = this.facts.get(k) || { box: 1, nextDue: 0 };
      i.box = ok ? Math.min(5, i.box + 1) : 1;
      const b = window.LEITNER_BOXES[i.box - 1] || window.LEITNER_BOXES[0];
      i.nextDue = this.questionIndex + b.delay;
      this.facts.set(k, i);
    }
    advance() { this.questionIndex++; }
    hasPendingInSector(factors) {
      for (const [k, i] of this.facts) {
        const f1 = parseInt(k.split('×')[0], 10);
        if (factors.includes(f1) && i.box < 3) return true;
      }
      return false;
    }
  };

  // ============================================
  // PedagogyEngine — موتور آموزشی
  // ============================================
  window.PedagogyEngine = class PedagogyEngine {
    constructor() { this.history = new Map(); this.leitner = new window.Leitner(); }
    reset() { this.history.clear(); this.leitner.reset(); }
    keyOf(f1, f2) { return window.normalizeKey(f1, f2); }
    recordAttempt(f1, f2, chosen, ok, ms) {
      const key = this.keyOf(f1, f2);
      if (!this.history.has(key)) {
        this.history.set(key, {
          f1: Math.min(f1, f2), f2: Math.max(f1, f2), key,
          attempts: 0, correctCount: 0, wrongAnswers: [],
          history: [], errorCodes: [],
          maxConsecutiveCorrect: 0, consecutiveCorrect: 0,
          avgCorrectTimeMs: 0, _correctTimeSum: 0
        });
      }
      const r = this.history.get(key);
      r.attempts++;
      if (ok) {
        r.correctCount++; r.history.push('C'); r.consecutiveCorrect++;
        if (r.consecutiveCorrect > r.maxConsecutiveCorrect) r.maxConsecutiveCorrect = r.consecutiveCorrect;
        r._correctTimeSum += ms;
        r.avgCorrectTimeMs = r._correctTimeSum / r.correctCount;
      } else {
        r.history.push('W'); r.consecutiveCorrect = 0;
        if (!r.wrongAnswers.includes(chosen)) r.wrongAnswers.push(chosen);
        const c = window.classifyError(f1, f2, chosen);
        if (c && !r.errorCodes.includes(c)) r.errorCodes.push(c);
      }
      this.leitner.register(key);
      this.leitner.record(key, ok);
    }
    getReportData() {
      const o = [];
      for (const r of this.history.values()) {
        const m = window.evaluateMastery(r);
        o.push(Object.assign({}, r, { masteryLevel: m.level, masteryName: m.name, isPositive: m.level >= 3 }));
      }
      return o;
    }
    getDiagnosticInsights() {
      const data = this.getReportData(), fs = {};
      for (const d of data) {
        new Set([d.f1, d.f2]).forEach(f => {
          if (!fs[f]) fs[f] = { total: 0, wrong: 0 };
          fs[f].total++;
          if (d.wrongAnswers.length > 0) fs[f].wrong++;
        });
      }
      let weakest = null, maxR = 0, strong = [];
      Object.keys(fs).forEach(f => {
        const s = fs[f];
        if (s.total < 2) return;
        const fr = s.wrong / s.total;
        if (fr > maxR && s.wrong > 0) { maxR = fr; weakest = f; }
        if (fr === 0) strong.push(f);
      });
      return { weakestFactor: weakest, strongFactors: strong, totalEvaluated: data.length };
    }
  };

  // ============================================
  // نشان‌ها
  // ============================================
  window.BADGES = [
    { id: 'first_module', icon: '🔧', name: 'اولین قطعه', desc: 'اولین پاسخ درست', check: s => s.totalCorrect >= 1 },
    { id: 'explorer_2', icon: '🛸', name: 'کاوشگر ۲', desc: 'تسلط پایه در ضرب ۲', check: s => (s.factorMastery[2] || 0) >= 3 },
    { id: 'explorer_3', icon: '🚀', name: 'کاوشگر ۳', desc: 'تسلط پایه در ضرب ۳', check: s => (s.factorMastery[3] || 0) >= 3 },
    { id: 'explorer_4', icon: '🛰️', name: 'کاوشگر ۴', desc: 'تسلط پایه در ضرب ۴', check: s => (s.factorMastery[4] || 0) >= 3 },
    { id: 'energy_5', icon: '⚡', name: 'مهندس انرژی', desc: 'تسلط پایه در ضرب ۵', check: s => (s.factorMastery[5] || 0) >= 3 },
    { id: 'star_6', icon: '💫', name: 'ستارهٔ ۶', desc: 'تسلط پایه در ضرب ۶', check: s => (s.factorMastery[6] || 0) >= 3 },
    { id: 'star_7', icon: '✨', name: 'ستارهٔ ۷', desc: 'تسلط پایه در ضرب ۷', check: s => (s.factorMastery[7] || 0) >= 3 },
    { id: 'double_8', icon: '🌟', name: 'دوبرابر ۸', desc: 'تسلط پایه در ضرب ۸', check: s => (s.factorMastery[8] || 0) >= 3 },
    { id: 'digit_9', icon: '🌠', name: 'رقم ۹', desc: 'تسلط پایه در ضرب ۹', check: s => (s.factorMastery[9] || 0) >= 3 },
    { id: 'streak_3', icon: '🔥', name: 'سه پشت‌سرهم', desc: '۳ پاسخ درست پیاپی', check: s => s.maxStreak >= 3 },
    { id: 'streak_5', icon: '🔥', name: 'پنج پشت‌سرهم', desc: '۵ پاسخ درست پیاپی', check: s => s.maxStreak >= 5 },
    { id: 'careful', icon: '🎯', name: 'دقت مهندسی', desc: 'دقت بالای ۷۵٪', check: s => s.accuracy >= 75 && s.totalAttempts >= 6 },
    { id: 'patient', icon: '🌱', name: 'صبر و تمرکز', desc: 'یادگیری بعد از خطا', check: s => s.recoveredAfterWrong >= 1 },
    { id: 'station_done', icon: '🏆', name: 'مهندس ارشد', desc: 'تکمیل تمامی ۳ بخش', check: s => s.sectorsCompleted >= 3 }
  ];

  window.evaluateBadges = function (game, cur) {
    const data = game.pedagogy.getReportData();
    const fm = {}; let tc = 0, ta = 0, rec = 0;
    data.forEach(d => {
      tc += d.correctCount; ta += d.attempts;
      if (d.history.includes('W') && d.history[d.history.length - 1] === 'C') rec++;
      new Set([d.f1, d.f2]).forEach(f => { fm[f] = Math.max(fm[f] || 0, d.masteryLevel); });
    });
    const acc = ta > 0 ? Math.round(tc / ta * 100) : 0;
    const stats = { totalCorrect: tc, totalAttempts: ta, factorMastery: fm, accuracy: acc, maxStreak: game.maxStreakEver || 0, recoveredAfterWrong: rec, sectorsCompleted: game.sectorsCompleted || 0 };
    const owned = new Set(cur || []);
    const neu = [];
    window.BADGES.forEach(b => { if (!owned.has(b.id) && b.check(stats)) { owned.add(b.id); neu.push(b); } });
    return { all: Array.from(owned), newlyEarned: neu };
  };

})();
