/* heroes-ui.js — رابط کاربری گنجینه پهلوانان — v1.0 */
window.HeroesUI = {
  open() {
    const profile = ProfileManager.getActive();
    if (!profile) { alert('ابتدا وارد بازی شوید.'); return; }
    const owned = HeroesCore.getForProfile(profile.profileId);
    const ownedIds = new Set(owned.map(h => h.id));
    const counterEl = document.getElementById('heroes-counter');
    if (counterEl) counterEl.textContent = '🏆 ' + toFa(owned.length) + ' از ' + toFa(HeroesCore.getAll().length) + ' پهلوان آزاد کردی';
    const grid = document.getElementById('heroes-grid');
    if (!grid) return;
    grid.innerHTML = '';
    HeroesCore.getAll().forEach(hero => {
      const isOwned = ownedIds.has(hero.id);
      const card = document.createElement('div');
      card.className = 'hero-card ' + (isOwned ? 'owned' : 'locked');
      card.innerHTML =
        '<span class="hero-emoji">' + hero.emoji + '</span>' +
        '<span class="hero-name">' + escapeHtml(hero.name) + '</span>' +
        '<span class="hero-status">' + (isOwned ? '✅' : '🔒') + '</span>';
      card.onclick = () => this.showDetail(hero, isOwned);
      grid.appendChild(card);
    });
    document.getElementById('modal-heroes').classList.remove('hidden');
  },

  showDetail(hero, isOwned) {
    document.getElementById('hero-detail-emoji').textContent = hero.emoji;
    document.getElementById('hero-detail-name').textContent = hero.name;
    document.getElementById('hero-detail-title').textContent = hero.title;
    document.getElementById('hero-detail-quote').textContent = '«' + hero.quote + '»';
    document.getElementById('hero-detail-req').textContent = isOwned ? '✅ آزاد شده' : hero.requirement;
    document.getElementById('modal-hero-detail').classList.remove('hidden');
  },

  close() { document.getElementById('modal-heroes').classList.add('hidden'); },
  closeDetail() { document.getElementById('modal-hero-detail').classList.add('hidden'); }
};
