/* game.js — GameController (بازی ضرب ۱×۱) — v1.0 */
(function () {
  'use strict';

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  class GameController {
    constructor(c) {
      this.canvas = c;
      this.ctx = c.getContext('2d');
      this.pedagogy = new window.PedagogyEngine();
      this.state = 'IDLE';
      this.sectorIdx = 0;
      this.mainCount = 0;
      this.modulesAttached = 0;
      this.streak = 0;
      this.maxStreakEver = 0;
      this.sectorsCompleted = 0;
      this.currentFact = null;
      this.questionStartTime = 0;
      this.isInputLocked = false;
      this.playerName = '';
      this.playerClass = '';
      this.ships = [];
      this.heroX = 0;
      this.particles = [];
      this.stars = [];
      this.screenShake = 0;
      this.flyingModules = [];
      this.cachedFont = 'bold 24px system-ui';
      this._listeners = {};
      this._onResize = this._onResize.bind(this);
      window.addEventListener('resize', this._onResize);
      this._onResize();
    }

    _onResize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      this.cssW = r.width; this.cssH = r.height;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(this.cssW * dpr);
      this.canvas.height = Math.floor(this.cssH * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._initStars();
      if (this.ships.length) {
        const colW = this.cssW / 4, topY = Math.max(150, this.cssH * 0.22);
        this.ships.forEach(s => { s.baseX = colW * s.xIndex + colW / 2; s.targetY = topY + (s.xIndex % 2) * 52; });
      }
      this.heroX = Math.max(0, Math.min(this.heroX || this.cssW / 2, this.cssW));
    }

    _initStars() {
      this.stars = [];
      for (let i = 0; i < 70; i++) {
        this.stars.push({
          x: Math.random() * this.cssW,
          y: Math.random() * this.cssH,
          r: Math.random() * 1.6 + 0.3,
          speed: Math.random() * 1.3 + 0.2
        });
      }
    }

    start(n, c) {
      this.playerName = n || 'مهندس ناشناس';
      this.playerClass = c || '';
      this.pedagogy.reset();
      this.sectorIdx = 0;
      this.mainCount = 0;
      this.modulesAttached = 0;
      this.streak = 0;
      this.maxStreakEver = 0;
      this.sectorsCompleted = 0;
      this.heroX = this.cssW / 2;
      this.particles = [];
      this.flyingModules = [];
      this.screenShake = 0;
      this._spawnQuestion();
    }

    _spawnQuestion() {
      let f1, f2, isRetry = false;
      const due = this.pedagogy.leitner.dueKeys();
      const allowed = window.SECTORS[this.sectorIdx].factors;
      const rel = due.filter(k => allowed.includes(parseInt(k.split('×')[0], 10)));
      if (rel.length) {
        const k = rel[Math.floor(Math.random() * rel.length)];
        const p = k.split('×');
        f1 = +p[0]; f2 = +p[1]; isRetry = true;
      } else {
        f1 = allowed[Math.floor(Math.random() * allowed.length)];
        const w = [1, 2, 3, 4, 5, 4, 3, 2, 1];
        let tot = w.reduce((a, b) => a + b, 0);
        let r = Math.random() * tot;
        f2 = 1;
        for (let i = 0; i < 9; i++) { r -= w[i]; if (r <= 0) { f2 = i + 1; break; } }
        this.mainCount++;
      }
      const correct = f1 * f2;
      const choices = window.generateChoices(f1, f2, correct);
      this.currentFact = { f1, f2, correct, choices, isRetry };
      this.questionStartTime = now();
      this.isInputLocked = false;
      this._buildShips(choices);
      this.state = 'QUESTION';
      this._emit('question', this.currentFact);
    }

    _buildShips(ch) {
      this.ships = [];
      const colW = this.cssW / 4;
      const topY = Math.max(150, this.cssH * 0.22);
      for (let i = 0; i < 4; i++) {
        this.ships.push({
          xIndex: i,
          baseX: colW * i + colW / 2,
          targetY: topY + (i % 2) * 52,
          currentY: topY + (i % 2) * 52 - 28,
          val: ch[i], alive: true, keyNumber: null
        });
      }
      this.ships.slice().sort((a, b) => a.baseX - b.baseX).forEach((s, i) => { s.keyNumber = i + 1; });
    }

    shoot(ship) {
      if (window.workshopMode !== 'legacy') return;
      if (!ship || !ship.alive || this.isInputLocked || this.state !== 'QUESTION' || !this.currentFact) return;
      const fact = this.currentFact;
      return window.dispatchAnswer({
        f1: fact.f1, f2: fact.f2, given: ship.val,
        timeMs: now() - this.questionStartTime,
        engine: 'v6', ship: ship, game: this
      });
    }

    proceed() {
      if (!this.currentFact) return;
      this.pedagogy.leitner.advance();
      const need = window.WAVES_PER_SECTOR[this.sectorIdx] || 4;
      const mainDone = this.mainCount >= need;
      const hasP = this.pedagogy.leitner.hasPendingInSector(window.SECTORS[this.sectorIdx].factors);
      if (mainDone && !hasP) {
        if (this.sectorIdx < window.SECTORS.length - 1) {
          this.sectorsCompleted++;
          this.sectorIdx++;
          this.mainCount = 0;
          this.pedagogy.leitner.reset();
          this.state = 'SECTOR';
          this._emit('sector', window.SECTORS[this.sectorIdx]);
          return;
        } else {
          this.sectorsCompleted++;
          this.state = 'DONE';
          this._emit('done', this.getFinalReport());
          return;
        }
      }
      this._spawnQuestion();
    }

    continueFromSector() { this.state = 'QUESTION'; this._spawnQuestion(); }

    getFinalReport() {
      const data = this.pedagogy.getReportData();
      const sc = data.filter(d => d.isPositive).length;
      const sr = data.length ? Math.round(sc / data.length * 100) : 0;
      let tt = 0, tc = 0;
      data.forEach(d => { if (d.avgCorrectTimeMs > 0) { tt += d.avgCorrectTimeMs; tc++; } });
      return {
        name: this.playerName,
        className: this.playerClass,
        modulesAttached: this.modulesAttached,
        successRate: sr,
        avgTime: tc ? tt / tc / 1000 : 0,
        details: data,
        insights: this.pedagogy.getDiagnosticInsights()
      };
    }

    setHeroX(x) { if (typeof x === 'number' && !isNaN(x)) this.heroX = Math.max(0, Math.min(x, this.cssW)); }

    startRenderLoop() {
      let last = performance.now();
      const loop = t => {
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        this._update(dt);
        this._render(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    _update(dt) {
      if (window.workshopMode !== 'legacy') return;
      for (let i = this.flyingModules.length - 1; i >= 0; i--) {
        const f = this.flyingModules[i];
        f.progress += dt / f.duration;
        if (f.progress >= 1) {
          f.progress = 1;
          for (let j = 0; j < 10; j++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 2.2 + 0.8;
            this.particles.push({
              x: f.targetX, y: f.targetY,
              vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
              alpha: 1, decay: 0.045, color: f.accent
            });
          }
          this.flyingModules.splice(i, 1);
          this._emit('docked', null);
        } else {
          const p = easeOutCubic(f.progress);
          f.x = f.startX + (f.targetX - f.startX) * p;
          f.y = f.startY + (f.targetY - f.startY) * p;
        }
      }
    }

    _render(t) {
      if (window.workshopMode !== 'legacy') return;
      const ctx = this.ctx, sec = window.SECTORS[this.sectorIdx];
      if (!sec) return;
      let ox = 0, oy = 0;
      if (this.screenShake > 0) {
        ox = (Math.random() - 0.5) * this.screenShake;
        oy = (Math.random() - 0.5) * this.screenShake;
        this.screenShake *= 0.88;
        if (this.screenShake < 0.4) this.screenShake = 0;
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();

      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = '#fff';
      this.stars.forEach(s => {
        s.y += s.speed;
        if (s.y > this.cssH) { s.y = 0; s.x = Math.random() * this.cssW; }
        ctx.fillRect(s.x, s.y, s.r, s.r);
      });
      this._drawStation(ctx, t);
      this.flyingModules.forEach(f => {
        const sc = 1 - f.progress * 0.4;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(15,23,42,0.95)';
        ctx.strokeStyle = f.accent;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        this._rr(ctx, -28, -24, 56, 48, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(window.toFa(f.val), 0, 1);
        ctx.restore();
      });
      if (this.state === 'QUESTION') {
        this.ships.forEach(sh => {
          if (!sh.alive) return;
          if (sh.currentY < sh.targetY) { sh.currentY += 9; if (sh.currentY > sh.targetY) sh.currentY = sh.targetY; }
          const x = sh.baseX + Math.sin(t * 0.003 + sh.xIndex) * 8;
          const y = sh.currentY + Math.cos(t * 0.0025 + sh.xIndex) * 4;
          this._drawCard(ctx, x, y, sh.val, sh.keyNumber, sec.accent);
        });
      }
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
        if (p.alpha <= 0) { this.particles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    _drawStation(ctx, t) {
      const baseY = this.cssH - 70, n = this.modulesAttached, cx = this.cssW / 2;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
      ctx.fillRect(cx - 50, baseY + 28, 100, 8);
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 50, baseY + 28, 100, 8);
      const core = 20 + Math.min(n * 1.2, 22);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cx - core / 2, baseY - core / 2 - 8, core, core, 6);
      ctx.fill();
      ctx.stroke();
      const blink = (Math.sin(t * 0.008) + 1) / 2;
      ctx.fillStyle = 'rgba(0,243,255,' + (0.4 + blink * 0.6) + ')';
      ctx.beginPath();
      ctx.arc(cx, baseY - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      const maxR = Math.max(4, Math.floor((this.cssW - 80) / 16));
      const rows = Math.ceil(n / maxR);
      let dr = 0;
      for (let row = 0; row < rows; row++) {
        const inR = Math.min(maxR, n - dr);
        const sx = cx - (inR * 16) / 2;
        for (let i = 0; i < inR; i++) {
          const x = sx + i * 16, y = baseY + 10 + row * 14;
          const hue = 180 + ((dr + i) * 7) % 140;
          ctx.fillStyle = 'hsl(' + hue + ',70%,55%)';
          ctx.fillRect(x, y, 13, 12);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(x + 2, y + 2, 4, 3);
        }
        dr += inR;
      }
      if (n >= 5) {
        const wl = Math.min(40 + n * 2, 90), wy = baseY - 4;
        ctx.fillStyle = 'rgba(56,189,248,0.35)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - core / 2, wy);
        ctx.lineTo(cx - core / 2 - wl, wy - 8);
        ctx.lineTo(cx - core / 2 - wl, wy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + core / 2, wy);
        ctx.lineTo(cx + core / 2 + wl, wy - 8);
        ctx.lineTo(cx + core / 2 + wl, wy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (n >= 3) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, baseY - core / 2 - 8);
        ctx.lineTo(cx, baseY - core / 2 - 28);
        ctx.stroke();
        ctx.fillStyle = '#ffb703';
        ctx.beginPath();
        ctx.arc(cx, baseY - core / 2 - 30, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const hx = this.heroX || cx;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hx, baseY - 22, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(56,189,248,0.35)';
      ctx.beginPath();
      ctx.arc(hx, baseY - 22, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    _drawCard(ctx, x, y, val, kn, acc) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(15,23,42,0.95)';
      ctx.strokeStyle = acc;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      this._rr(ctx, -38, -32, 76, 64, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = this.cachedFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(window.toFa(val), 0, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '12px system-ui';
      ctx.fillText('[' + window.toFa(kn) + ']', 0, -42);
      ctx.restore();
    }

    _rr(ctx, x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
    }

    _emit(e, p) { if (this._listeners[e]) try { this._listeners[e](p); } catch {} }
    on(e, cb) { this._listeners[e] = cb; }
  }

  function dispatchAnswer(input) {
    if (window.workshopMode !== 'legacy') return;
    if (!input || input.engine !== 'v6') return;
    return legacyShoot(input);
  }

  function legacyShoot(input) {
    const game = input.game;
    const ship = input.ship;
    game.isInputLocked = true;
    const f1 = input.f1;
    const f2 = input.f2;
    const given = input.given;
    const correct = game.currentFact.correct;
    const ok = given === correct;
    const ms = input.timeMs;
    game.pedagogy.recordAttempt(f1, f2, given, ok, ms);

    if (ok) {
      game.streak++;
      if (game.streak > game.maxStreakEver) game.maxStreakEver = game.streak;
      ship.alive = false;
      game.modulesAttached++;
      const baseY = game.cssH - 70;
      const maxW = Math.max(4, Math.floor((game.cssW - 60) / 18));
      const n = Math.min(game.modulesAttached, Math.min(36, maxW));
      const sx = game.cssW / 2 - (n * 16) / 2;
      game.flyingModules.push({
        x: ship.baseX, y: ship.currentY,
        startX: ship.baseX, startY: ship.currentY,
        targetX: sx + (n - 1) * 16 + 6, targetY: baseY + 6,
        progress: 0, val: given,
        accent: window.SECTORS[game.sectorIdx].accent, duration: 0.45
      });
      game._emit('answer', { correct: true, timeMs: ms, ship: ship, f1: f1, f2: f2 });
    } else {
      game.streak = 0;
      game.screenShake = 8;
      game._emit('answer', { correct: false, timeMs: ms, ship: ship, chosen: given, correctValue: correct, f1: f1, f2: f2 });
    }
  }

  window.GameController = GameController;
  window.dispatchAnswer = dispatchAnswer;
  window.legacyShoot = legacyShoot;
})();
