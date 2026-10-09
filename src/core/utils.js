/* utils.js — ثابت‌ها، توابع کمکی، حافظه، صدا، صف پیام — v1.0 */
(function () {
  'use strict';

  // ============================================
  // ثابت‌ها
  // ============================================
  const STORAGE_KEYS = {
    RECORDS: 'sw_student_dossiers_v60',
    SETTINGS: 'sw_teacher_settings_v60',
    SESSION: 'sw_current_session_v60',
    BADGES: 'sw_student_badges_v60',
    STORY_SEEN: 'sw_story_seen_v1',
    ACTIVE_CLASS: 'sw_active_class_v1',
    ACTIVE_GROUP: 'sw_active_group_v1'
  };
  const SUCCESS_MSGS = ['آفرین! قطعه‌ات وصل شد 🔧','عالی! ایستگاه بزرگ‌تر شد 🚀','دمت گرم! قطعه جدید ✨','فوق‌العاده! ادامه بده 🌟','آفرین مهندس! 💪'];
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  // ============================================
  // توابع کمکی
  // ============================================
  function toFa(n) { return String(n).replace(/[0-9]/g, d => FA_DIGITS[d]); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function escapeCsv(v) { const s = String(v == null ? '' : v); const d = /^[=+\-@\t\r]/.test(s); const e = s.replace(/"/g, '""'); return d ? `"'${e}"` : `"${e}"`; }
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function todayFa() { try { return new Date().toLocaleDateString('fa-IR'); } catch { return new Date().toISOString().slice(0, 10); } }
  function safeFileName(s) { return String(s || 'کارنامه').replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').slice(0, 40) || 'کارنامه'; }
  function announceSr(text) { const el = document.getElementById('sr-announcer'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = text; }, 50); } }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function timeFa(isoString) { try { const d = new Date(isoString); return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }
  function dateFa(isoString) { try { const d = new Date(isoString); return d.toLocaleDateString('fa-IR'); } catch { return ''; } }
  function closeGameModals() { ['modal-correct', 'modal-sector', 'modal-report'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }); }
  function entryNumber(text) { if (typeof text !== 'string' || !/^\d{1,2}$/.test(text)) return null; const n = Number(text); if (!isFinite(n) || n <= 0) return null; return n; }
  function todayISO() { try { return new Date().toISOString().slice(0, 10); } catch { return 'export'; } }

  // ============================================
  // ذخیره‌سازی
  // ============================================
  const Storage = {
    getSettings() { try { return Object.assign({ teacherPin: '1234' }, JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {}); } catch { return { teacherPin: '1234' }; } },
    saveSettings(s) { try { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s)); } catch {} },
    getAll() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS)) || []; } catch { return []; } },
    saveAll(list) { try { localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify((list || []).slice(0, 200))); } catch {} },
    addDossier(d) {
      const list = this.getAll();
      d.id = 'REC_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      d.date = todayFa();
      list.unshift(d);
      this.saveAll(list);
      return d;
    },
    getLastIdentity() { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION)) || { name: '', className: '' }; } catch { return { name: '', className: '' }; } },
    saveIdentity(n, c) { try { localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ name: n || '', className: c || '' })); } catch {} },
    getBadges(n) { if (!n) return []; try { const a = JSON.parse(localStorage.getItem(STORAGE_KEYS.BADGES)) || {}; return a[n] || []; } catch { return []; } },
    saveBadges(n, b) { if (!n) return; try { const a = JSON.parse(localStorage.getItem(STORAGE_KEYS.BADGES)) || {}; a[n] = Array.isArray(b) ? b : []; localStorage.setItem(STORAGE_KEYS.BADGES, JSON.stringify(a)); } catch {} },
    hasSeenStory() { try { return localStorage.getItem(STORAGE_KEYS.STORY_SEEN) === '1'; } catch { return false; } },
    markStorySeen() { try { localStorage.setItem(STORAGE_KEYS.STORY_SEEN, '1'); } catch {} },
    getActiveClass() { try { return localStorage.getItem(STORAGE_KEYS.ACTIVE_CLASS) || null; } catch { return null; } },
    setActiveClass(code) { try { localStorage.setItem(STORAGE_KEYS.ACTIVE_CLASS, code || ''); } catch {} },
    getActiveGroup() { try { return localStorage.getItem(STORAGE_KEYS.ACTIVE_GROUP) || null; } catch { return null; } },
    setActiveGroup(code) { try { localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUP, code || ''); } catch {} }
  };

  // ============================================
  // سیستم صدا
  // ============================================
  class SoundSystem {
    constructor() { this.ctx = null; this.muted = false; }
    init() { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; try { this.ctx = new AC(); } catch {} } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
    toggleMute() { this.muted = !this.muted; return this.muted; }
    _beep(o) {
      if (this.muted || !this.ctx) return;
      const { freq = 500, endFreq = 200, type = 'sine', duration = 0.15, gain = 0.2 } = o || {};
      try {
        const osc = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
        osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t + duration);
        g.gain.setValueAtTime(gain, t); g.gain.linearRampToValueAtTime(0.001, t + duration);
        osc.connect(g); g.connect(this.ctx.destination); osc.start(t); osc.stop(t + duration + 0.02);
      } catch {}
    }
    playReview() { this._beep({ freq: 240, endFreq: 160, type: 'sine', duration: 0.2, gain: 0.14 }); }
    playNote(s) { if (this.muted || !this.ctx) return; const f = 261.63 * Math.pow(2, s / 12); this._beep({ freq: f, endFreq: f * 0.98, type: 'triangle', duration: 0.3, gain: 0.1 }); }
    playCorrectNote(st) { const p = [0, 2, 4, 7, 9]; this.playNote(p[Math.max(0, Math.min((st || 1) - 1, 4)) % 5]); }
    playSectorFanfare() { if (this.muted || !this.ctx) return; [0, 4, 7, 12].forEach((n, i) => setTimeout(() => this.playNote(n), i * 110)); }
    playCelebration() { if (this.muted || !this.ctx) return; [4, 7, 12].forEach((n, i) => setTimeout(() => this.playNote(n), i * 90)); }
    playDockSpark() { this._beep({ freq: 1200, endFreq: 400, type: 'triangle', duration: 0.25, gain: 0.15 }); }
  }

  // ============================================
  // صف پیام‌ها
  // ============================================
  var toastQueue = [];
  var toastBusy = false;

  function صف_پیام(html, مدت) {
    toastQueue.push({ html: html, duration: مدت || 2000 });
    if (!toastBusy) پردازش_صف();
  }

  function پردازش_صف() {
    if (toastQueue.length === 0) { toastBusy = false; return; }
    toastBusy = true;
    var item = toastQueue.shift();
    var area = document.getElementById('badge-area');
    if (!area) { toastBusy = false; return; }
    var t = document.createElement('div');
    t.className = 'badge-toast';
    t.innerHTML = item.html;
    area.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 30);
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); پردازش_صف(); }, 350);
    }, item.duration);
  }

  function showBadgeToast(b) {
    صف_پیام(
      '<div class="badge-toast-icon">' + b.icon + '</div><div><div class="badge-toast-title">افتخار جدید!</div><div class="badge-toast-name">' + escapeHtml(b.name) + '</div><div class="badge-toast-desc">' + escapeHtml(b.desc) + '</div></div>',
      2000
    );
  }

  function showHeroToast(hero) {
    صف_پیام(
      '<div class="badge-toast-icon">' + hero.emoji + '</div><div><div class="badge-toast-title" style="color:var(--gold);">پهلوان جدید!</div><div class="badge-toast-name">' + escapeHtml(hero.name) + '</div><div class="badge-toast-desc">' + escapeHtml(hero.title) + '</div></div>',
      2500
    );
  }

  let feedbackTimer = null;
  function showFeedbackBar(title, sub, duration = 1800) {
    const bar = document.getElementById('feedback-bar');
    const tEl = document.getElementById('fb-title');
    const sEl = document.getElementById('fb-sub');
    if (!bar) return;
    clearTimeout(feedbackTimer);
    tEl.textContent = title;
    sEl.textContent = sub || '';
    bar.classList.add('show');
    announceSr(title + (sub ? ' ' + sub : ''));
    feedbackTimer = setTimeout(() => bar.classList.remove('show'), duration);
  }

  // ============================================
  // افشا
  // ============================================
  window.STORAGE_KEYS = STORAGE_KEYS;
  window.SUCCESS_MSGS = SUCCESS_MSGS;
  window.toFa = toFa;
  window.escapeHtml = escapeHtml;
  window.escapeCsv = escapeCsv;
  window.now = now;
  window.todayFa = todayFa;
  window.safeFileName = safeFileName;
  window.announceSr = announceSr;
  window.easeOutCubic = easeOutCubic;
  window.timeFa = timeFa;
  window.dateFa = dateFa;
  window.closeGameModals = closeGameModals;
  window.entryNumber = entryNumber;
  window.todayISO = todayISO;
  window.AppStorage = Storage;
  window.SoundSystem = SoundSystem;
  window.showBadgeToast = showBadgeToast;
  window.showHeroToast = showHeroToast;
  window.showFeedbackBar = showFeedbackBar;
  window.sharedSound = null;
})();
