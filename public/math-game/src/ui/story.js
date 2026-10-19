/* story.js — کلاس Story (داستان ورق‌زن) — v1.0 */
window.Story = {
  current: 0,
  onComplete: null,
  slides: [
    { text: 'در مداری دور زمین، ایستگاهی درخشان بود.', narration: 'در مداری دور زمین، ایستگاهی درخشان بود. خانه‌ای برای نسل‌های مهندس.', bg: 'assets/bg-station.png', char: '' },
    { text: 'یک شب، طوفان کیهانی از راه رسید.', narration: 'یک شب، طوفان کیهانی از راه رسید. طوفانی که هیچ‌کس انتظارش را نداشت.', bg: 'assets/bg-celebration.png', char: '' },
    { text: 'ایستگاه شکست. قطعه‌ها پراکنده شدند.', narration: 'ایستگاه شکست. قطعه‌های طلایی، در فضای بی‌پایان پراکنده شدند.', bg: 'assets/bg-station-broken.png', char: '' },
    { text: 'تو کمک‌کننده‌ای. اسمت چیه؟', narration: 'کمک‌کننده پیدا شد. اسمت چیه، مهندس؟', bg: 'assets/bg-deep-space.png', char: 'assets/avatar-kids.png', interactive: true }
  ],

  open(cb) {
    this.onComplete = cb || function () {};
    this.current = 0;
    document.getElementById('story-app').classList.remove('hidden');
    this._loadAll();
    this._bind();
    this._update();
  },

  close() {
    document.getElementById('story-app').classList.add('hidden');
    AppStorage.markStorySeen();
  },

  _loadAll() {
    this.slides.forEach((s, i) => {
      const bgEl = document.getElementById('story-bg-' + i);
      if (bgEl && s.bg) bgEl.style.backgroundImage = 'url(' + s.bg + ')';
      const charEl = document.getElementById('story-char-' + i);
      if (charEl && s.char) {
        charEl.src = s.char;
        charEl.style.display = 'block';
        charEl.onerror = function () { charEl.style.display = 'none'; };
      }
      const textEl = document.getElementById('story-text-' + i);
      if (textEl) textEl.textContent = s.text;
    });
  },

  _bind() {
    const next = document.getElementById('story-next');
    const prev = document.getElementById('story-prev');
    const skip = document.getElementById('story-skip');
    const replay = document.getElementById('story-replay');
    next.onclick = () => this._next();
    prev.onclick = () => { if (this.current > 0) { this.current--; this._update(); } };
    skip.onclick = () => this._finish();
    replay.onclick = () => this._speak();
  },

  _next() {
    if (this.current < this.slides.length - 1) {
      this.current++;
      this._update();
    } else {
      const nameInput = document.getElementById('story-name-input');
      const name = (nameInput && nameInput.value.trim()) || '';
      if (name) {
        const active = ProfileManager.getActive();
        if (active) {
          ProfileManager.update(active.profileId, { displayName: name });
        }
        const pn = document.getElementById('player-name');
        if (pn) pn.value = name;
      }
      this._finish();
    }
  },

  _finish() {
    this.close();
    if (this.onComplete) this.onComplete();
  },

  _update() {
    document.querySelectorAll('.story-slide').forEach((s, idx) => {
      s.classList.toggle('active', idx === this.current);
    });
    document.getElementById('story-indicator').textContent = toFa(this.current + 1) + ' از ' + toFa(this.slides.length);
    document.getElementById('story-prev').disabled = this.current === 0;
    document.getElementById('story-next').textContent = this.current === this.slides.length - 1 ? 'شروع بازی ✓' : 'بعدی ←';
  },

  _speak() {
    const s = this.slides[this.current];
    if ('speechSynthesis' in window && s && s.narration) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(s.narration);
      u.lang = 'fa-IR';
      window.speechSynthesis.speak(u);
    }
  }
};
