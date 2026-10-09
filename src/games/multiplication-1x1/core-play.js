/* core-play.js — منطق Core Play (حالت یادگیری) — v1.0 */
(function () {
  'use strict';

  window.corePlay = null;

  function sliceStore(db) {
    var key = 'sw_core_v1';
    return {
      load: function () { try { var parsed = JSON.parse(db.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; } },
      save: function (rows) { db.setItem(key, JSON.stringify(rows)); }
    };
  }
  function slicePin(db) { var value = db.getItem('sw_pin_v1'); return value == null ? '' : String(value); }
  function sliceCore(db) { return WorkshopCore.create({ storage: sliceStore(db), pin: slicePin(db) }); }

  function reduceStep(core, state, given) {
    if (typeof given !== 'number' || !isFinite(given)) {
      return { session: state.session, step: state.step, phase: state.phase, message: state.message || '', docked: state.docked || null, finished: false, refused: true };
    }
    var judgment = core.judge.answer(state.step, given, core.presentation.assisted(state.phase));
    var session = core.session.apply(state.session, state.step, judgment);
    if (core.presentation.stays(state.phase, judgment)) {
      return { session: session, step: state.step, phase: core.presentation.afterWrong(state.phase), message: judgment.message, docked: state.docked || null, finished: false, refused: false };
    }
    var fact = core.scheduler.fold(session.events)[state.step.key];
    var fluent = !!(judgment.correct && fact && fact.fluent && !judgment.assisted);
    return {
      session: session,
      step: core.scheduler.next(session),
      phase: 'answer',
      message: judgment.correct
        ? (fluent ? 'این یکی روان شد.' : (judgment.assisted ? 'با راهنما جوش خورد؛ هنوز روان نیست.' : 'قطعه جوش خورد.'))
        : hintMessage(state.phase, state.step.f1, state.step.f2) || judgment.message,
      docked: judgment.correct ? { fluent: fluent, assisted: judgment.assisted, rows: state.step.f1, cols: state.step.f2 } : null,
      finished: false, refused: false
    };
  }

  function fluentCount(core, session, sectorId) {
    var facts = core.scheduler.summarizeSector(session, sectorId);
    var n = 0;
    facts.forEach(function (fact) { if (fact.fluent) n += 1; });
    return { n: n, total: facts.length, facts: facts };
  }

  function bridgeCoreToDossier(session, profileId, sectorId, accuracy, avgTime) {
    try {
      const list = AppStorage.getAll();
      const name = session.name || 'مهندس';
      const className = session.className || '';
      const id = 'CORE_' + (profileId || name) + '_s' + sectorId;
      const details = [];
      const eventByKey = {};
      (session.events || []).forEach(ev => {
        if (ev.filler) return;
        const key = Math.min(ev.f1, ev.f2) + '×' + Math.max(ev.f1, ev.f2);
        if (!eventByKey[key]) {
          eventByKey[key] = {
            f1: Math.min(ev.f1, ev.f2), f2: Math.max(ev.f1, ev.f2), key,
            attempts: 0, correctCount: 0, wrongAnswers: [], history: [],
            errorCodes: [], maxConsecutiveCorrect: 0, consecutiveCorrect: 0,
            avgCorrectTimeMs: 0, _correctTimeSum: 0
          };
        }
        const r = eventByKey[key];
        r.attempts++;
        if (ev.correct) {
          r.correctCount++; r.history.push('C'); r.consecutiveCorrect++;
          if (r.consecutiveCorrect > r.maxConsecutiveCorrect) r.maxConsecutiveCorrect = r.consecutiveCorrect;
        } else {
          r.history.push('W'); r.consecutiveCorrect = 0;
          if (ev.given != null && !r.wrongAnswers.includes(ev.given)) r.wrongAnswers.push(ev.given);
        }
      });
      Object.keys(eventByKey).forEach(k => {
        const r = eventByKey[k];
        const m = evaluateMastery(r);
        r.masteryLevel = m.level;
        r.masteryName = m.name;
        r.isPositive = m.level >= 3;
        details.push(r);
      });

      const record = {
        id, name, className,
        profileId: profileId || '',
        date: todayFa(), sector: sectorId,
        modulesAttached: (session.events || []).filter(e => e.correct).length,
        successRate: accuracy || 0,
        avgTime: avgTime || 0,
        details,
        fromCore: true
      };

      const at = list.findIndex(x => x.id === id);
      if (at >= 0) list[at] = record;
      else list.unshift(record);
      AppStorage.saveAll(list);
    } catch (e) { console.warn('bridgeCoreToDossier error:', e); }
  }

  function showCoreToast(type, text) {
    let toast = document.getElementById('core-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'core-toast';
      toast.className = 'core-toast';
      const main = document.getElementById('core-main');
      if (main) main.appendChild(toast);
    }
    let colorClass;
    if (type === 'correct') colorClass = 'correct-' + (Math.floor(Math.random() * 3) + 1);
    else colorClass = 'wrong';
    toast.textContent = text;
    toast.className = 'core-toast ' + colorClass;
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 900);
  }

  function animatePieceDock(rows, cols) {
    const main = document.getElementById('core-main');
    if (!main) return;
    const mainRect = main.getBoundingClientRect();
    const piece = document.createElement('div');
    piece.className = 'flying-piece';
    piece.style.gridTemplateColumns = 'repeat(' + cols + ', 24px)';
    const total = Math.min(rows * cols, 20);
    for (let i = 0; i < total; i++) {
      const cell = document.createElement('i');
      cell.className = 'slice-cell';
      piece.appendChild(cell);
    }
    const startX = mainRect.width / 2 - (cols * 24) / 2;
    const startY = mainRect.height / 2 - (rows * 24) / 2 - 30;
    piece.style.left = startX + 'px';
    piece.style.top = startY + 'px';
    piece.style.position = 'absolute';
    main.appendChild(piece);
    if (sharedSound) sharedSound.playDockSpark();
    setTimeout(() => {
      piece.style.top = (startY - 80) + 'px';
      piece.style.transform = 'scale(0.5) rotate(20deg)';
      piece.style.opacity = '0';
    }, 40);
    setTimeout(() => {
      piece.remove();
      if (sharedSound) sharedSound.playCelebration();
    }, 1100);
  }

  function pulseProgress() {
    const el = document.getElementById('core-progress');
    if (!el) return;
    el.classList.remove('core-progress-pulse');
    void el.offsetWidth;
    el.classList.add('core-progress-pulse');
  }

  function renderCoreChoices(choices, correct, onPick) {
    var box = document.getElementById('core-choices');
    if (!box) return;
    box.innerHTML = '';
    choices.forEach(function (val) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'core-choice';
      btn.textContent = toFa(val);
      btn.addEventListener('click', function () { onPick(val, btn); });
      box.appendChild(btn);
    });
  }

  function paintCore(speak) {
    var play = corePlay;
    if (!play) return;
    var counts = fluentCount(play.core, play.session, play.sectorId);
    var sectorEl = document.getElementById('core-sector');
    var progressEl = document.getElementById('core-progress');
    if (sectorEl) sectorEl.textContent = 'بخش ' + toFa(play.sectorId);
    var prevCount = play._lastFluentCount || 0;
    if (progressEl) progressEl.textContent = 'روان: ' + toFa(counts.n) + ' از ' + toFa(counts.total);
    if (counts.n > prevCount) pulseProgress();
    play._lastFluentCount = counts.n;

    var groups = document.getElementById('core-groups');
    var promptEl = document.getElementById('core-prompt');
    var companionEl = document.getElementById('core-companion-text');
    var choicesBox = document.getElementById('core-choices');
    var step = play.step;

    if (!step || step.type !== 'ask') {
      var report = play.core.presentation.report(counts.facts);
      var shaky = counts.facts.some(function (fact) { return fact.shaky; });
      if (promptEl) promptEl.textContent = '🎉 این بخش تمام شد!';
      if (companionEl) companionEl.textContent = shaky
        ? 'بعضی‌ها را بعداً دوباره می‌بینیم. ' + report.line
        : 'همهٔ ضرب‌های این زنگ محکم شد! ' + report.line;
      if (groups) groups.innerHTML = '';
      if (choicesBox) choicesBox.innerHTML = '';
      if (sharedSound) sharedSound.playSectorFanfare();

      try {
        const totalAtt = (play.session.events || []).length;
        const totalCorrect = (play.session.events || []).filter(e => e.correct).length;
        const accuracy = totalAtt > 0 ? Math.round(totalCorrect / totalAtt * 100) : 0;
        bridgeCoreToDossier(play.session, play.profileId, play.sectorId, accuracy, 0);
        const activeClassCode = AppStorage.getActiveClass();
        if (activeClassCode && window.SocialCore) {
          SocialCore.classes.submitScore(activeClassCode, play.profileId, totalCorrect);
        }
      } catch (e) {}

      try {
        const stats = buildHeroStats(play);
        const res = HeroesCore.checkAndAward(play.profileId, stats);
        if (res.newlyAwarded && res.newlyAwarded.length) {
          res.newlyAwarded.forEach(h => showHeroToast(h));
        }
      } catch (e) {}

      if (speak && companionEl) announceSr(promptEl.textContent + ' ' + companionEl.textContent);
      return;
    }

    var frame = play.core.presentation.frame(play.session, step, play.phase);
    if (promptEl) promptEl.textContent = frame.prompt;

    var note = play.message || '';
    if (companionEl) {
      var combined = [note, frame.hint].filter(Boolean).join(' ');
      companionEl.textContent = combined || 'سلام! بیا با هم بشماریم!';
    }

    if (groups) {
      groups.style.gridTemplateColumns = 'repeat(' + frame.cols + ', 32px)';
      groups.innerHTML = '';
      var total = frame.rows * frame.cols;
      for (var i = 0; i < total; i++) {
        var cell = document.createElement('i');
        cell.className = 'slice-cell';
        groups.appendChild(cell);
      }
    }

    play.locked = false;
    renderCoreChoices(play.currentChoices, frame.rows * frame.cols, function (val, btn) {
      if (play.locked) return;
      play.locked = true;
      var allBtns = document.querySelectorAll('#core-choices .core-choice');
      var correct = frame.rows * frame.cols;
      var rows = frame.rows;
      var cols = frame.cols;

      if (val === correct) {
        btn.classList.add('correct');
        if (sharedSound) sharedSound.playCorrectNote(1);
        var msgs = ['آفرین! 🌟', 'عالی بود! ✨', 'دمت گرم! 🔥', 'دقیق! 🎯', 'محشر! 💫'];
        showCoreToast('correct', msgs[Math.floor(Math.random() * msgs.length)]);
        animatePieceDock(rows, cols);
        play.streak = (play.streak || 0) + 1;
        setTimeout(function () { submitCoreChoice(val); }, 1100);
      } else {
        btn.classList.add('wrong');
        if (sharedSound) sharedSound.playReview();
        allBtns.forEach(function (b) {
          var bVal = parseInt(b.textContent.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }), 10);
          if (bVal === correct) b.classList.add('correct');
          b.disabled = true;
        });
        var wrongMsgs = ['دوباره تلاش کن 💪', 'نزدیک بود! 🎯', 'با دقت بشمار 🌱'];
        showCoreToast('wrong', wrongMsgs[Math.floor(Math.random() * wrongMsgs.length)]);
        play.streak = 0;
        setTimeout(function () { submitCoreChoice(val); }, 1500);
      }
    });

    if (speak) announceSr(frame.prompt);
  }

  function buildHeroStats(play) {
    const events = (play.session && play.session.events) || [];
    const stats = {
      currentStreak: play.maxStreak || 0,
      fluentInSession: 0, recoveryAfterWrong: 0, perfectSections: 0,
      assistedSuccess: 0, completedGames: 0, fastAnswers: 0,
      noHintSessions: 0, perfectTwenty: 0, girlRecords: 0,
      allFluentSections: 0, helpFriend: 0
    };
    const fluentKeys = new Set();
    let consecutiveCorrect = 0;
    let consecutiveWrong = 0;
    let recovered = 0;
    let perfect = true;
    let assistedSuccess = 0;
    events.forEach(ev => {
      if (ev.correct) {
        consecutiveCorrect++;
        if (consecutiveCorrect > stats.currentStreak) stats.currentStreak = consecutiveCorrect;
        consecutiveWrong = 0;
        if (consecutiveCorrect >= 3) fluentKeys.add(Math.min(ev.f1, ev.f2) + '×' + Math.max(ev.f1, ev.f2));
        if (ev.assisted) assistedSuccess++;
      } else {
        consecutiveWrong++;
        if (consecutiveCorrect > 0) recovered++;
        consecutiveCorrect = 0;
        perfect = false;
        if (consecutiveWrong >= 5) stats.recoveryAfterWrong = recovered;
      }
    });
    stats.fluentInSession = fluentKeys.size;
    stats.assistedSuccess = assistedSuccess;
    if (perfect && events.length > 0) stats.perfectSections = 1;
    return stats;
  }

  function openCore(sectorId) {
    if (typeof WorkshopCore === 'undefined') { alert('هسته در دسترس نیست.'); return; }
    window.workshopMode = 'core';
    document.getElementById('modal-start').classList.add('hidden');
    document.getElementById('modal-sector-picker').classList.add('hidden');
    document.getElementById('modal-classroom').classList.add('hidden');
    document.getElementById('core-board').classList.remove('hidden');
    var core = sliceCore(localStorage);
    var profile = ProfileManager.getActive();
    var name = profile ? profile.displayName : ((document.getElementById('player-name').value || '').trim() || 'مهندس');
    var className = (document.getElementById('player-class').value || '').trim();
    var session = core.session.start({
      id: 'core-s' + sectorId + '-' + (profile ? profile.profileId : name),
      name, className, sector: sectorId,
      focus: core.record.focusKeys(name, sectorId)
    });
    window.corePlay = {
      core, session, step: core.scheduler.next(session),
      phase: 'answer', entry: '', message: '', sectorId, docked: null,
      currentChoices: [], locked: false,
      _lastFluentCount: 0,
      profileId: profile ? profile.profileId : '',
      maxStreak: 0
    };
    prepareCoreStep();
    paintCore(true);
  }

  function prepareCoreStep() {
    if (!corePlay || !corePlay.step || corePlay.step.type !== 'ask') return;
    var f1 = corePlay.step.f1, f2 = corePlay.step.f2;
    var correct = f1 * f2;
    var choices = generateChoices(f1, f2, correct);
    corePlay.currentChoices = choices;
    corePlay.locked = false;
  }

  function closeCore() {
    window.workshopMode = 'legacy';
    window.corePlay = null;
    document.getElementById('core-board').classList.add('hidden');
    document.getElementById('modal-start').classList.remove('hidden');
  }

  function submitCoreChoice(given) {
    if (window.workshopMode !== 'core' || !corePlay || !corePlay.step || corePlay.step.type !== 'ask') return;
    var view = reduceStep(corePlay.core, corePlay, given);
    if (view.refused) return;
    corePlay.session = view.session;
    corePlay.phase = view.phase;
    corePlay.message = view.message;
    corePlay.docked = view.docked;
    corePlay.step = view.step;
    if (corePlay.streak && corePlay.streak > (corePlay.maxStreak || 0)) {
      corePlay.maxStreak = corePlay.streak;
    }
    if (!view.step || view.step.type !== 'ask') {
      corePlay.session = corePlay.core.session.finish(corePlay.session);
    }
    try { corePlay.core.record.save(corePlay.session); } catch (e) {}

    try {
      const totalAtt = (corePlay.session.events || []).length;
      const totalCorrect = (corePlay.session.events || []).filter(e => e.correct).length;
      const accuracy = totalAtt > 0 ? Math.round(totalCorrect / totalAtt * 100) : 0;
      bridgeCoreToDossier(corePlay.session, corePlay.profileId, corePlay.sectorId, accuracy, 0);
    } catch (e) {}

    prepareCoreStep();
    paintCore(true);
  }

  // افشا
  window.openCore = openCore;
  window.closeCore = closeCore;
  window.submitCoreChoice = submitCoreChoice;
  window.paintCore = paintCore;
})();
