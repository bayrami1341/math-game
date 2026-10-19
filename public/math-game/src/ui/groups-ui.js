/* groups-ui.js — رابط کاربری گروه‌ها — v1.0 */
window.GroupsUI = {
  open() {
    const profile = ProfileManager.getActive();
    if (!profile) { alert('ابتدا وارد بازی شوید.'); return; }
    document.getElementById('modal-group').classList.remove('hidden');
  },
  close() { document.getElementById('modal-group').classList.add('hidden'); },

  create() {
    const profile = ProfileManager.getActive();
    if (!profile) return;
    const name = prompt('نام گروه را وارد کنید:', 'گروه دوستان');
    if (!name) return;
    const res = SocialCore.groups.create(name, profile);
    if (!res.ok) { alert(res.error); return; }
    AppStorage.setActiveGroup(res.group.code);
    document.getElementById('modal-group').classList.add('hidden');
    document.getElementById('created-group-code').textContent = toFa(res.group.code);
    document.getElementById('modal-create-group').classList.remove('hidden');
  },

  startGameFromCreated() {
    document.getElementById('modal-create-group').classList.add('hidden');
    window.workshopMode = 'legacy';
    window.legacyStart();
  },

  join() {
    const profile = ProfileManager.getActive();
    if (!profile) return;
    const code = (document.getElementById('join-group-code').value || '').trim();
    if (!code) return;
    const res = SocialCore.groups.join(code, profile);
    if (!res.ok) { alert(res.error); return; }
    AppStorage.setActiveGroup(res.group.code);
    document.getElementById('join-group-code').value = '';
    document.getElementById('modal-join-group').classList.add('hidden');
    document.getElementById('modal-group').classList.add('hidden');
    this.showBoard(res.group.code);
  },

  showBoard(code) {
    const group = SocialCore.groups.getByCode(code);
    if (!group) { alert('گروه پیدا نشد.'); return; }
    const profile = ProfileManager.getActive();
    const board = SocialCore.groups.getLeaderboard(code);
    document.getElementById('group-board-title').textContent = '🏆 ' + group.name;
    document.getElementById('group-board-sub').textContent = 'کد گروه: ' + toFa(group.code) + ' • ' + toFa(group.members.length) + ' عضو';
    const listEl = document.getElementById('group-leaderboard');
    listEl.innerHTML = '';
    if (board.length === 0) {
      listEl.innerHTML = '<div class="summary-empty">هنوز کسی بازی نکرده.</div>';
    } else {
      board.forEach((m, i) => {
        const rank = i + 1;
        const isMe = profile && m.profileId === profile.profileId;
        const heroCount = HeroesCore.countForProfile(m.profileId);
        const row = document.createElement('div');
        row.className = 'leader-row rank-' + rank + (isMe ? ' me' : '');
        let rankIcon = toFa(rank);
        if (rank === 1) rankIcon = '🥇';
        else if (rank === 2) rankIcon = '🥈';
        else if (rank === 3) rankIcon = '🥉';
        row.innerHTML =
          '<div class="leader-rank">' + rankIcon + '</div>' +
          '<div class="leader-avatar">' + (m.avatar || '👤') + '</div>' +
          '<div class="leader-name">' + escapeHtml(m.name) + (isMe ? ' (تو)' : '') + '</div>' +
          (heroCount > 0 ? '<div class="leader-heroes">🏆 ' + toFa(heroCount) + '</div>' : '') +
          '<div class="leader-score">' + toFa(m.bestScore || 0) + '</div>';
        listEl.appendChild(row);
      });
    }
    document.getElementById('modal-group-board').classList.remove('hidden');
  },

  closeBoard() { document.getElementById('modal-group-board').classList.add('hidden'); },

  playAgain() {
    document.getElementById('modal-group-board').classList.add('hidden');
    window.workshopMode = 'legacy';
    window.legacyStart();
  }
};
