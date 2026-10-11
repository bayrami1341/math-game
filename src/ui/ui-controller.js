/* ui-controller.js — کنترلر اصلی رابط کاربری — v1.0 */
(function () {
  'use strict';

  // ============================================
  // شروع بازی legacy
  // ============================================
  function legacyStart() {
    const profile = ProfileManager.getActive();
    const name = profile ? profile.displayName : ((document.getElementById('player-name').value || '').trim() || 'مهندس');
    const className = (document.getElementById('player-class').value || '').trim();
    AppStorage.saveIdentity(name, className);
    document.getElementById('modal-start').classList.add('hidden');
    document.getElementById('modal-group').classList.add('hidden');
    document.getElementById('modal-sector-picker').classList.add('hidden');
    document.getElementById('modal-classroom').classList.add('hidden');
    if (window.legacyGame) {
      window.legacyGame.state = 'IDLE';
      window.legacyGame.start(name, className);
    }
  }
  window.legacyStart = legacyStart;

  // ============================================
  // UIController
  // ============================================
  class UIController {
    constructor(g) {
      this.game = g;
      window.legacyGame = g;
      this.sound = new SoundSystem();
      window.sharedSound = this.sound;
      this.earnedBadges = [];
      this.lastReport = null;
      this.hasGreeted = false;
      this._isAdvancing = false;
      this._bindGame();
      this._bindUI();
    }

    _bindGame() {
      this.game.on('question', f => this._renderQ(f));
      this.game.on('answer', r => this._renderA(r));
      this.game.on('sector', s => this._renderS(s));
      this.game.on('done', r => this._renderR(r));
      this.game.on('docked', () => { this.sound.playDock && this.sound.playDock(); this._updHUD(); });
    }

    _renderQ(f) {
      const q = document.getElementById('question-text');
      if (q) q.textContent = 'ساخت قطعه: ' + toFa(f.f1) + ' × ' + toFa(f.f2) + (f.isRetry ? ' (مرور)' : '');
      const p = document.getElementById('question-panel');
      if (p) p.style.borderColor = f.isRetry ? 'var(--gold)' : 'var(--cyan)';
      const sorted = this.game.ships.slice().sort((a, b) => a.keyNumber - b.keyNumber);
      announceSr('سؤال: ' + f.f1 + ' ضربدر ' + f.f2 + '. گزینه‌ها: ' + sorted.map((s, i) => (i + 1) + ': ' + s.val).join('، '));
      if (!this.hasGreeted) { this.hasGreeted = true; }
      this._updHUD();
    }

    _renderA(r) {
      if (r.correct) {
        this.sound.playCorrectNote(this.game.streak);
        const msg = SUCCESS_MSGS[Math.floor(Math.random() * SUCCESS_MSGS.length)];
        showFeedbackBar(msg, 'زمان: ' + toFa((r.timeMs / 1000).toFixed(1)) + ' ث', 1700);
        this._chkBadges();
        setTimeout(() => this._adv(), 720);
      } else {
        this.sound.playReview();
        this._showCorr(r);
      }
      this._updHUD();
    }

    _chkBadges() {
      const cur = AppStorage.getBadges(this.game.playerName);
      const res = evaluateBadges(this.game, cur);
      if (res.newlyEarned.length) {
        this.earnedBadges = res.all;
        AppStorage.saveBadges(this.game.playerName, res.all);
        res.newlyEarned.forEach(b => showBadgeToast(b));
      }
      try {
        const profile = ProfileManager.getActive();
        if (profile) {
          const stats = {
            currentStreak: this.game.maxStreakEver || 0,
            fluentInSession: 0, recoveryAfterWrong: 0, perfectSections: 0,
            assistedSuccess: 0, completedGames: 0, fastAnswers: 0,
            noHintSessions: 0, perfectTwenty: 0, girlRecords: 0,
            allFluentSections: 0, helpFriend: 0
          };
          const heroRes = HeroesCore.checkAndAward(profile.profileId, stats);
          if (heroRes.newlyAwarded && heroRes.newlyAwarded.length) {
            heroRes.newlyAwarded.forEach(h => showHeroToast(h));
          }
        }
      } catch (e) {}
    }

    _showCorr(r) {
      const m = document.getElementById('modal-correct');
      const b = document.getElementById('correct-body');
      const { f1, f2, correctValue, chosen } = r;
      const code = classifyError(f1, f2, chosen);
      const msg = errorMessage(code, f1, f2);
      const sz = correctValue <= 30 ? 14 : 8;
      const gp = correctValue <= 30 ? 5 : 3;
      let g = '<div style="display:grid;grid-template-columns:repeat(' + f2 + ',' + sz + 'px);gap:' + gp + 'px;justify-content:center;margin:12px 0">';
      for (let i = 0; i < correctValue; i++) g += '<div style="width:' + sz + 'px;height:' + sz + 'px;background:var(--gold);border-radius:50%"></div>';
      g += '</div>';
      if (b) b.innerHTML = '<p>' + toFa(f1) + ' دستهٔ ' + toFa(f2) + ' تایی = <b style="color:var(--gold);font-size:1.1rem">' + toFa(correctValue) + '</b></p>' + g + '<p style="color:#cbd5e1;line-height:1.7;font-size:0.88rem;margin-top:8px">' + escapeHtml(msg) + '</p>';
      m.classList.remove('hidden');
      setTimeout(() => { const btn = document.getElementById('btn-continue'); if (btn) btn.focus(); }, 50);
    }

    _renderS(s) {
      document.getElementById('sector-title').textContent = s.title;
      document.getElementById('sector-desc').textContent = s.desc;
      document.getElementById('progress-fill').style.width = '0%';
      this.sound.playSectorFanfare();
      try {
        const rep = this.game.getFinalReport();
        AppStorage.addDossier({
          name: rep.name, className: rep.className,
          modulesAttached: rep.modulesAttached, successRate: rep.successRate,
          details: rep.details, insights: rep.insights,
          partial: true, note: 'ذخیره میانی — پایان بخش'
        });
        const profile = ProfileManager.getActive();
        if (profile) {
          const activeClass = AppStorage.getActiveClass();
          if (activeClass) SocialCore.classes.submitScore(activeClass, profile.profileId, rep.modulesAttached);
          const activeGroup = AppStorage.getActiveGroup();
          if (activeGroup) SocialCore.groups.submitScore(activeGroup, profile.profileId, rep.modulesAttached, rep.avgTime);
        }
      } catch (e) {}
      document.getElementById('modal-sector').classList.remove('hidden');
      setTimeout(() => document.getElementById('btn-sector-next').focus(), 50);
    }

    _renderR(rep) {
      const sum = document.getElementById('report-summary');
      const bg = document.getElementById('report-badges');
      if (sum) sum.innerHTML = '<p>مهندس: <b style="color:var(--gold)">' + escapeHtml(rep.name) + '</b>' + (rep.className ? ' (کلاس: ' + escapeHtml(rep.className) + ')' : '') + '</p><p>قطعه‌های متصل‌شده: <b style="color:var(--cyan)">' + toFa(rep.modulesAttached) + '</b></p><p>درصد تسلط پایه: <b style="color:var(--green)">' + toFa(rep.successRate) + '٪</b></p>';
      this.earnedBadges = AppStorage.getBadges(rep.name);
      const ev = evaluateBadges(this.game, this.earnedBadges);
      this.earnedBadges = ev.all;
      AppStorage.saveBadges(rep.name, ev.all);
      if (bg) {
        bg.innerHTML = '';
        BADGES.forEach(b => {
          const o = this.earnedBadges.includes(b.id);
          const d = document.createElement('div');
          d.className = 'badge-card' + (o ? ' owned' : '');
          d.innerHTML = '<span class="badge-icon">' + b.icon + '</span><span class="badge-name">' + escapeHtml(b.name) + '</span>';
          bg.appendChild(d);
        });
      }
      AppStorage.addDossier({
        name: rep.name, className: rep.className,
        modulesAttached: rep.modulesAttached, successRate: rep.successRate,
        details: rep.details, insights: rep.insights
      });
      try {
        const profile = ProfileManager.getActive();
        if (profile) {
          const owned = HeroesCore.getForProfile(profile.profileId);
          const heroesEl = document.getElementById('report-heroes');
          if (heroesEl && owned.length > 0) {
            let hh = '<div style="text-align:center; color:var(--gold); font-weight:800; margin-bottom:8px;">🏆 پهلوانان تو (' + toFa(owned.length) + ')</div>';
            hh += '<div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center;">';
            owned.forEach(o => {
              const hero = HeroesCore.getById(o.id);
              if (hero) hh += '<div style="font-size:1.4rem; background:rgba(0,0,0,0.3); border-radius:6px; padding:4px 8px;" title="' + escapeHtml(hero.name) + '">' + hero.emoji + '</div>';
            });
            hh += '</div>';
            heroesEl.innerHTML = hh;
          }
        }
      } catch (e) {}
      this.lastReport = rep;
      document.getElementById('modal-report').classList.remove('hidden');
    }

    _updHUD() {
      const g = this.game;
      const w = window.WAVES_PER_SECTOR[g.sectorIdx] || 4;
      document.getElementById('hud-player').textContent = 'مهندس: ' + escapeHtml(g.playerName || '—');
      document.getElementById('hud-progress').textContent = 'بخش ' + toFa(g.sectorIdx + 1) + ' از ' + toFa(window.SECTORS.length);
      document.getElementById('hud-modules').textContent = 'قطعه: ' + toFa(g.modulesAttached);
      document.getElementById('hud-streak').textContent = 'پشت‌سرهم: ' + toFa(g.streak);
      document.getElementById('progress-fill').style.width = Math.min(100, g.mainCount / w * 100) + '%';
    }

    _adv() {
      if (this._isAdvancing) return;
      this._isAdvancing = true;
      try { this.game.proceed(); } finally { setTimeout(() => { this._isAdvancing = false; }, 280); }
    }

    _bindUI() {
      const c = document.getElementById('stage');

      c.addEventListener('pointerdown', e => {
        const hiddenIds = ['modal-teacher-login','modal-teacher-v2','modal-correct','modal-sector','modal-report','core-board','modal-sector-picker','story-app','modal-group','modal-group-board','modal-class-join','modal-classroom','modal-messages','modal-heroes','modal-hero-detail','modal-start','modal-create-group','modal-join-group'];
        for (const id of hiddenIds) {
          const el = document.getElementById(id);
          if (el && !el.classList.contains('hidden')) return;
        }
        this.sound.init();
        const r = c.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        this.game.setHeroX(x);
        const s = this._pick(x, y);
        if (s) this.game.shoot(s);
      });

      c.addEventListener('pointermove', e => {
        const t = document.getElementById('modal-teacher-login');
        if (t && !t.classList.contains('hidden')) return;
        const r = c.getBoundingClientRect();
        this.game.setHeroX(e.clientX - r.left);
      });

      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') { this._esc(); return; }
        const coreHidden = document.getElementById('core-board').classList.contains('hidden');
        const storyHidden = document.getElementById('story-app').classList.contains('hidden');

        if (!coreHidden) {
          if (e.key >= '1' && e.key <= '4') {
            const idx = parseInt(e.key, 10) - 1;
            const btns = document.querySelectorAll('#core-choices .core-choice');
            if (btns[idx] && !btns[idx].disabled) btns[idx].click();
          }
          return;
        }
        if (!storyHidden) {
          if (e.key === 'ArrowLeft' || e.key === ' ') { e.preventDefault(); document.getElementById('story-next').click(); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); document.getElementById('story-prev').click(); }
          return;
        }
        const t1 = document.getElementById('modal-teacher-login');
        const t2 = document.getElementById('modal-teacher-v2');
        if ((t1 && !t1.classList.contains('hidden')) || (t2 && !t2.classList.contains('hidden'))) return;
        if (this.game.state !== 'QUESTION' || this.game.isInputLocked) return;
        this.sound.init();
        const fd = { '۱': 1, '۲': 2, '۳': 3, '۴': 4, '1': 1, '2': 2, '3': 3, '4': 4 };
        let k = fd[e.key];
        if (!k && e.code) {
          if (e.code === 'Digit1' || e.code === 'Numpad1') k = 1;
          else if (e.code === 'Digit2' || e.code === 'Numpad2') k = 2;
          else if (e.code === 'Digit3' || e.code === 'Numpad3') k = 3;
          else if (e.code === 'Digit4' || e.code === 'Numpad4') k = 4;
        }
        if (k >= 1 && k <= 4) {
          const s = this.game.ships.find(x => x.keyNumber === k);
          if (s) this.game.shoot(s);
        }
      });

      document.getElementById('btn-sound').addEventListener('click', () => {
        this.sound.init();
        document.getElementById('btn-sound').textContent = this.sound.toggleMute() ? '🔇' : '🔊';
      });

      document.getElementById('btn-heroes').addEventListener('click', () => HeroesUI.open());
      document.getElementById('btn-heroes-close').addEventListener('click', () => HeroesUI.close());
      document.getElementById('btn-hero-detail-close').addEventListener('click', () => HeroesUI.closeDetail());

      document.getElementById('btn-inbox').addEventListener('click', () => {
        const profile = ProfileManager.getActive();
        if (!profile) return;
        MessagesUI._currentTeacher = 'teacher';
        MessagesUI._currentClassCode = AppStorage.getActiveClass() || null;
        document.getElementById('messages-subtitle').textContent = 'گفتگو با معلم';
        MessagesUI.render();
        document.getElementById('modal-messages').classList.remove('hidden');
      });
      document.getElementById('btn-messages-close').addEventListener('click', () => MessagesUI.close());
      document.getElementById('btn-chat-send').addEventListener('click', () => MessagesUI.send());
      document.getElementById('chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); MessagesUI.send(); }
      });
      document.getElementById('btn-teacher-chat-send').addEventListener('click', () => {
        const input = document.getElementById('teacher-chat-input');
        if (!input) return;
        const text = (input.value || '').trim();
        if (!text) return;
        if (!TeacherV3.currentChatStudent) { alert('ابتدا یک دانش‌آموز را انتخاب کنید.'); return; }
        const activeClass = AppStorage.getActiveClass();
        const teacherId = activeClass ? ('teacher_' + activeClass) : 'teacher';
        SocialCore.messages.send(teacherId, TeacherV3.currentChatStudent, text, {
          classCode: activeClass || '',
          fromTeacher: true
        });
        input.value = '';
        TeacherV3.renderMessages();
      });
      document.getElementById('teacher-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-teacher-chat-send').click(); }
      });

      document.getElementById('btn-exit').addEventListener('click', () => {
        if (!confirm('از کارگاه خارج می‌شوی؟ پیشرفتت ذخیره می‌شود.')) return;
        try {
          if (this.game && this.game.playerName && this.game.state !== 'IDLE') {
            const rep = this.game.getFinalReport();
            AppStorage.addDossier({
              name: rep.name, className: rep.className,
              modulesAttached: rep.modulesAttached, successRate: rep.successRate,
              details: rep.details, insights: rep.insights,
              partial: true, note: 'خروج میانی'
            });
          }
        } catch (err) {}
        this.game.state = 'IDLE';
        ['modal-correct','modal-sector','modal-report','modal-teacher-login','modal-teacher-v2','core-board','modal-sector-picker','story-app','modal-group','modal-group-board','modal-class-join','modal-classroom','modal-messages','modal-heroes','modal-hero-detail','modal-create-group','modal-join-group'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.classList.add('hidden');
        });
        document.getElementById('modal-start').classList.remove('hidden');
        this.hasGreeted = false;
      });

      document.getElementById('btn-teacher').addEventListener('click', () => TeacherV3.openLogin());
      document.getElementById('btn-teacher-hud').addEventListener('click', () => TeacherV3.openLogin());
      document.getElementById('btn-teacher-login-ok').addEventListener('click', () => TeacherV3.submitLogin());
      document.getElementById('btn-teacher-login-cancel').addEventListener('click', () => document.getElementById('modal-teacher-login').classList.add('hidden'));
      document.getElementById('teacher-pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') TeacherV3.submitLogin(); });
      document.getElementById('teacher-close-v2').addEventListener('click', () => TeacherV3.close());
      document.getElementById('teacher-back-v2').addEventListener('click', () => {
        document.querySelectorAll('#teacher-nav .teacher-nav-btn').forEach(b => b.classList.remove('active'));
        const todayTab = document.querySelector('[data-tpage="today"]');
        if (todayTab) todayTab.classList.add('active');
        TeacherV3.goTo('today');
      });
      document.getElementById('btn-teacher-create-class').addEventListener('click', () => {
        const name = prompt('نام کلاس را وارد کنید:', 'کلاس سوم');
        if (!name) return;
        const teacherName = prompt('نام معلم:', 'معلم');
        if (!teacherName) return;
        const cls = SocialCore.classes.create(name, teacherName);
        alert('کلاس ساخته شد!\nکد کلاس: ' + toFa(cls.code) + '\n\nاین کد را به دانش‌آموزان بدهید.');
        TeacherV3.renderClasses();
      });
      document.getElementById('btn-export-csv').addEventListener('click', () => {
        const list = AppStorage.getAll();
        if (!list.length) { alert('پرونده‌ای نیست.'); return; }
        let csv = '\uFEFFنام,کلاس,تاریخ,قطعه,تسلط\n';
        list.forEach(i => {
          csv += [escapeCsv(i.name), escapeCsv(i.className), escapeCsv(i.date), escapeCsv(i.modulesAttached || 0), escapeCsv((i.successRate || 0) + '%')].join(',') + '\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'کارگاه_فضایی_' + todayFa() + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
      document.getElementById('btn-export-json').addEventListener('click', () => {
        const data = {
          records: AppStorage.getAll(),
          groups: SocialCore.groups.getAll(),
          classes: SocialCore.classes.getAll(),
          messages: SocialCore.messages.getAll(),
          profiles: ProfileManager.getAll(),
          heroes: localStorage.getItem('sw_heroes_v1'),
          badges: localStorage.getItem(STORAGE_KEYS.BADGES),
          exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'backup_' + todayISO() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });

      document.getElementById('btn-solo').addEventListener('click', () => {
        const active = ProfileManager.getActive();
        if (!active) {
          document.getElementById('modal-start').classList.add('hidden');
          document.getElementById('modal-profile').classList.remove('hidden');
          return;
        }
        if (!AppStorage.hasSeenStory()) {
          document.getElementById('modal-start').classList.add('hidden');
          Story.open(() => {
            const greetEl = document.getElementById('picker-greeting');
            if (greetEl) greetEl.textContent = 'سلام ' + active.avatar + ' ' + active.displayName + '!';
            document.getElementById('modal-sector-picker').classList.remove('hidden');
          });
        } else {
          const greetEl = document.getElementById('picker-greeting');
          if (greetEl) greetEl.textContent = 'سلام ' + active.avatar + ' ' + active.displayName + '!';
          document.getElementById('modal-start').classList.add('hidden');
          document.getElementById('modal-sector-picker').classList.remove('hidden');
        }
      });

      let selectedAvatar = '🦊';
      document.querySelectorAll('#profile-avatars .hero-card').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#profile-avatars .hero-card').forEach(b => b.classList.remove('owned'));
          btn.classList.add('owned');
          selectedAvatar = btn.dataset.avatar;
        });
      });
      document.querySelector('#profile-avatars .hero-card').classList.add('owned');

      document.getElementById('btn-profile-create').addEventListener('click', () => {
        const nameInput = document.getElementById('profile-name-input');
        const name = (nameInput.value || '').trim();
        if (!name) {
          alert('لطفاً اسمت را وارد کن.');
          nameInput.focus();
          return;
        }
        const res = ProfileManager.create(selectedAvatar, name);
        if (!res.ok) {
          alert(res.error || 'خطا در ساخت پروفایل.');
          return;
        }
        document.getElementById('modal-profile').classList.add('hidden');
        nameInput.value = '';
        const active = ProfileManager.getActive();
        if (!AppStorage.hasSeenStory()) {
          Story.open(() => {
            const greetEl = document.getElementById('picker-greeting');
            if (greetEl) greetEl.textContent = 'سلام ' + active.avatar + ' ' + active.displayName + '!';
            document.getElementById('modal-sector-picker').classList.remove('hidden');
          });
        } else {
          const greetEl = document.getElementById('picker-greeting');
          if (greetEl) greetEl.textContent = 'سلام ' + active.avatar + ' ' + active.displayName + '!';
          document.getElementById('modal-sector-picker').classList.remove('hidden');
        }
      });

      document.getElementById('btn-friends').addEventListener('click', () => {
        document.getElementById('modal-start').classList.add('hidden');
        GroupsUI.open();
      });
      document.getElementById('btn-group-back').addEventListener('click', () => {
        GroupsUI.close();
        document.getElementById('modal-start').classList.remove('hidden');
      });
      document.getElementById('btn-create-group').addEventListener('click', () => GroupsUI.create());
      document.getElementById('btn-join-group').addEventListener('click', () => {
        document.getElementById('modal-group').classList.add('hidden');
        document.getElementById('modal-join-group').classList.remove('hidden');
      });
      document.getElementById('btn-join-group-ok').addEventListener('click', () => GroupsUI.join());
      document.getElementById('btn-join-group-back').addEventListener('click', () => {
        document.getElementById('modal-join-group').classList.add('hidden');
        document.getElementById('modal-group').classList.remove('hidden');
      });
      document.getElementById('btn-copy-group-code').addEventListener('click', () => {
        const code = document.getElementById('created-group-code').textContent;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => alert('کد کپی شد!')).catch(() => alert('کپی ممکن نشد.'));
        } else {
          alert('کد: ' + code);
        }
      });
      document.getElementById('btn-start-group-game').addEventListener('click', () => GroupsUI.startGameFromCreated());
      document.getElementById('btn-create-group-back').addEventListener('click', () => {
        document.getElementById('modal-create-group').classList.add('hidden');
        document.getElementById('modal-start').classList.remove('hidden');
      });
      document.getElementById('btn-group-board-back').addEventListener('click', () => {
        GroupsUI.closeBoard();
        document.getElementById('modal-start').classList.remove('hidden');
      });
      document.getElementById('btn-group-play-again').addEventListener('click', () => GroupsUI.playAgain());

      document.getElementById('btn-classroom').addEventListener('click', () => ClassroomUI.openJoin());
      document.getElementById('btn-join-class-ok').addEventListener('click', () => ClassroomUI.join());
      document.getElementById('btn-join-class-back').addEventListener('click', () => ClassroomUI.closeJoin());
      document.getElementById('btn-classroom-play').addEventListener('click', () => ClassroomUI.play());
      document.getElementById('btn-classroom-messages').addEventListener('click', () => ClassroomUI.openMessages());
      document.getElementById('btn-classroom-leave').addEventListener('click', () => ClassroomUI.leave());
      document.getElementById('btn-classroom-back').addEventListener('click', () => ClassroomUI.close());

      document.getElementById('btn-legacy').addEventListener('click', () => {
        window.workshopMode = 'legacy';
        legacyStart();
      });

      document.querySelectorAll('.picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sector = parseInt(btn.dataset.sector, 10);
          const active = ProfileManager.getActive();
          if (!active || !sector || sector < 1 || sector > 3) return;
          const nameInput = document.getElementById('player-name');
          const classInput = document.getElementById('player-class');
          if (nameInput) nameInput.value = active.displayName;
          if (classInput) classInput.value = '';
          document.getElementById('modal-sector-picker').classList.add('hidden');
          openCore(sector);
        });
      });
      document.querySelector('.picker-cancel').addEventListener('click', () => {
        document.getElementById('modal-sector-picker').classList.add('hidden');
        document.getElementById('modal-start').classList.remove('hidden');
      });

      document.getElementById('core-home').addEventListener('click', () => {
        window.workshopMode = 'legacy';
        window.corePlay = null;
        document.getElementById('core-board').classList.add('hidden');
        const active = ProfileManager.getActive();
        if (active) {
          const greetEl = document.getElementById('picker-greeting');
          if (greetEl) greetEl.textContent = 'سلام ' + active.avatar + ' ' + active.displayName + '!';
        }
        document.getElementById('modal-sector-picker').classList.remove('hidden');
      });
      document.getElementById('core-back').addEventListener('click', () => closeCore());

      document.getElementById('btn-continue').addEventListener('click', () => {
        document.getElementById('modal-correct').classList.add('hidden');
        this._adv();
      });
      document.getElementById('btn-sector-next').addEventListener('click', () => {
        document.getElementById('modal-sector').classList.add('hidden');
        this.game.continueFromSector();
        this._updHUD();
      });
      document.getElementById('btn-replay').addEventListener('click', () => {
        document.getElementById('modal-report').classList.add('hidden');
        this.hasGreeted = false;
        this.game.start(this.game.playerName, this.game.playerClass);
      });
      document.getElementById('btn-download-report').addEventListener('click', () => {
        if (!this.lastReport) return;
        const blob = new Blob([this._genTxt(this.lastReport)], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'کارنامه_' + safeFileName(this.lastReport.name) + '.txt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
      document.getElementById('btn-report-send-teacher').addEventListener('click', () => {
        if (!this.lastReport) return;
        const activeClass = AppStorage.getActiveClass();
        if (!activeClass) {
          alert('برای ارسال گزارش، ابتدا باید در یک کلاس عضو باشید.');
          return;
        }
        const profile = ProfileManager.getActive();
        if (!profile) return;
        const text = 'گزارش جلسه: ' + toFa(this.lastReport.modulesAttached) + ' قطعه، تسلط ' + toFa(this.lastReport.successRate) + '٪';
        SocialCore.messages.send(profile.profileId, 'teacher_' + activeClass, text, { classCode: activeClass });
        alert('✅ گزارش به معلم ارسال شد!');
      });

      document.getElementById('btn-start').addEventListener('click', () => { window.workshopMode = 'legacy'; legacyStart(); });
      document.getElementById('btn-core-1').addEventListener('click', () => openCore(1));
      document.getElementById('btn-core-2').addEventListener('click', () => openCore(2));
      document.getElementById('btn-core-3').addEventListener('click', () => openCore(3));
    }

    _esc() {
      const c = document.getElementById('modal-correct');
      if (c && !c.classList.contains('hidden')) { c.classList.add('hidden'); this._adv(); return; }
      const l = document.getElementById('modal-teacher-login');
      if (l && !l.classList.contains('hidden')) { l.classList.add('hidden'); return; }
      const tv2 = document.getElementById('modal-teacher-v2');
      if (tv2 && !tv2.classList.contains('hidden')) { TeacherV3.close(); return; }
      const st = document.getElementById('story-app');
      if (st && !st.classList.contains('hidden')) { document.getElementById('story-skip').click(); return; }
      const pr = document.getElementById('modal-profile');
      if (pr && !pr.classList.contains('hidden')) {
        pr.classList.add('hidden');
        document.getElementById('modal-start').classList.remove('hidden');
        return;
      }
      const p = document.getElementById('modal-sector-picker');
      if (p && !p.classList.contains('hidden')) {
        p.classList.add('hidden');
        document.getElementById('modal-start').classList.remove('hidden');
        return;
      }
      const gr = document.getElementById('modal-group');
      if (gr && !gr.classList.contains('hidden')) { GroupsUI.close(); document.getElementById('modal-start').classList.remove('hidden'); return; }
      const gb = document.getElementById('modal-group-board');
      if (gb && !gb.classList.contains('hidden')) { GroupsUI.closeBoard(); document.getElementById('modal-start').classList.remove('hidden'); return; }
      const cj = document.getElementById('modal-class-join');
      if (cj && !cj.classList.contains('hidden')) { ClassroomUI.closeJoin(); return; }
      const cm = document.getElementById('modal-classroom');
      if (cm && !cm.classList.contains('hidden')) { ClassroomUI.close(); return; }
      const msg = document.getElementById('modal-messages');
      if (msg && !msg.classList.contains('hidden')) { MessagesUI.close(); return; }
      const h = document.getElementById('modal-heroes');
      if (h && !h.classList.contains('hidden')) { HeroesUI.close(); return; }
      const hd = document.getElementById('modal-hero-detail');
      if (hd && !hd.classList.contains('hidden')) { HeroesUI.closeDetail(); return; }
    }

    _pick(px, py) {
      let best = null, bd = 100;
      this.game.ships.forEach(s => {
        if (!s.alive) return;
        const d = Math.hypot(px - s.baseX, py - s.currentY);
        if (d < bd) { bd = d; best = s; }
      });
      return best;
    }

    _genTxt(rep) {
      let t = '================================\nگزارش کارگاه ایستگاه فضایی (v6.0)\nمهندس: ' + rep.name + '\n';
      if (rep.className) t += 'کلاس: ' + rep.className + '\n';
      t += 'تاریخ: ' + todayFa() + '\nقطعه‌ها: ' + toFa(rep.modulesAttached) + '\nتسلط: ' + toFa(rep.successRate) + '٪\n--------------------------------\n';
      rep.details.forEach(d => {
        t += '• ' + toFa(d.f1) + '×' + toFa(d.f2) + ': ' + d.masteryName + ' | درست: ' + toFa(d.correctCount) + ' | تلاش: ' + toFa(d.attempts) + '\n';
      });
      return t;
    }
  }

  window.UIController = UIController;

   // ============================================
  // init
  // ============================================
  window.addEventListener('load', () => {
    localStorage.removeItem('sw_student_dossiers_v60');
    try {
      var testRecords = [
        { name: 'مینا آزمون', profileId: 'test_mina', className: 'کلاس آزمایشی',
          date: '۱۴۰۵/۰۷/۲۰', successRate: 40, modulesAttached: 3,
          details: [
            { f1: 4, f2: 8, correctCount: 0, wrongAnswers: [48], attempts: 1, masteryLevel: 0, masteryName: 'نوآموز' },
            { f1: 6, f2: 7, correctCount: 0, wrongAnswers: [48], attempts: 1, masteryLevel: 0, masteryName: 'نوآموز' }
          ] },
        { name: 'آرمین آزمون', profileId: 'test_armin', className: 'کلاس آزمایشی',
          date: '۱۴۰۵/۰۷/۲۰', successRate: 35, modulesAttached: 2,
          details: [
            { f1: 4, f2: 8, correctCount: 0, wrongAnswers: [48], attempts: 1, masteryLevel: 0, masteryName: 'نوآموز' },
            { f1: 6, f2: 7, correctCount: 0, wrongAnswers: [48], attempts: 1, masteryLevel: 0, masteryName: 'نوآموز' }
          ] },
        { name: 'سارا آزمون', profileId: 'test_sara', className: 'کلاس آزمایشی',
          date: '۱۴۰۵/۰۷/۲۰', successRate: 38, modulesAttached: 3,
          details: [
            { f1: 4, f2: 8, correctCount: 0, wrongAnswers: [48], attempts: 1, masteryLevel: 0, masteryName: 'نوآموز' },
            { f1: 6, f2: 7, correctCount: 0, wrongAnswers: [48], attempts: 1, masteryLevel: 0, masteryName: 'نوآموز' }
          ] }
      ];
      localStorage.setItem('sw_student_dossiers_v60', JSON.stringify(testRecords));
      console.log('🧪 داده‌ی آزمایشی تنظیم شد: ۳ دانش‌آموز، همه با گلوگاه «حاصل جدول کناری»');
    } catch (e) { console.warn('test data error:', e); }
    const canvas = document.getElementById('stage');
    const game = new GameController(canvas);
    new UIController(game);
    game.startRenderLoop();

    const last = AppStorage.getLastIdentity();
    if (last.name) document.getElementById('player-name').value = last.name;
    if (last.className) document.getElementById('player-class').value = last.className;

    const activeClass = AppStorage.getActiveClass();
    if (activeClass && window.SocialCore) {
      const cls = SocialCore.classes.getByCode(activeClass);
      if (cls) console.log('عضو کلاس: ' + cls.name);
    }
  });
})();
