/* classroom-ui.js — رابط کاربری کلاس — v1.0 */
window.ClassroomUI = {
  openJoin() {
    const profile = ProfileManager.getActive();
    if (!profile) { alert('ابتدا وارد بازی شوید.'); return; }
    document.getElementById('modal-start').classList.add('hidden');
    document.getElementById('modal-class-join').classList.remove('hidden');
  },
  closeJoin() {
    document.getElementById('modal-class-join').classList.add('hidden');
    document.getElementById('modal-start').classList.remove('hidden');
  },
  join() {
    const profile = ProfileManager.getActive();
    if (!profile) return;
    const code = (document.getElementById('join-class-code').value || '').trim();
    if (!code) return;
    const res = SocialCore.classes.join(code, profile);
    if (!res.ok) { alert(res.error); return; }
    AppStorage.setActiveClass(res.class.code);
    document.getElementById('join-class-code').value = '';
    document.getElementById('modal-class-join').classList.add('hidden');
    this.showClassroom(res.class.code);
  },
  showClassroom(code) {
    const cls = SocialCore.classes.getByCode(code);
    if (!cls) { alert('کلاس پیدا نشد.'); return; }
    document.getElementById('classroom-title').textContent = '🏫 ' + cls.name;
    const profile = ProfileManager.getActive();
    const info = document.getElementById('classroom-info');
    const rank = profile ? SocialCore.classes.getRankFor(code, profile.profileId) : null;
    let html = '';
    html += '<div class="stat-line"><span>معلم</span><span style="font-weight:800; color:var(--cyan);">' + escapeHtml(cls.teacherName) + '</span></div>';
    html += '<div class="stat-line"><span>تعداد اعضا</span><span style="font-weight:800; color:var(--cyan);">' + toFa(cls.members.length) + '</span></div>';
    if (rank && cls.settings.showRankToStudents) {
      html += '<div class="stat-line"><span>رتبه تو</span><span style="font-weight:800; color:var(--gold);">' + toFa(rank.rank) + ' از ' + toFa(rank.total) + '</span></div>';
    }
    info.innerHTML = html;
    document.getElementById('modal-classroom').classList.remove('hidden');
  },
  close() {
    document.getElementById('modal-classroom').classList.add('hidden');
    document.getElementById('modal-start').classList.remove('hidden');
  },
  leave() {
    const code = AppStorage.getActiveClass();
    if (!code) return;
    const profile = ProfileManager.getActive();
    if (!profile) return;
    if (!confirm('از کلاس خارج می‌شوید؟')) return;
    const classes = SocialCore.classes.getAll();
    const cls = classes.find(c => c.code === code);
    if (cls) {
      cls.members = cls.members.filter(m => m.profileId !== profile.profileId);
      localStorage.setItem('sw_classes_v1', JSON.stringify(classes));
    }
    AppStorage.setActiveClass('');
    this.close();
  },
  play() {
    document.getElementById('modal-classroom').classList.add('hidden');
    const greetEl = document.getElementById('picker-greeting');
    const profile = ProfileManager.getActive();
    if (greetEl && profile) greetEl.textContent = 'سلام ' + profile.avatar + ' ' + profile.displayName + '!';
    document.getElementById('modal-sector-picker').classList.remove('hidden');
  },
  openMessages() {
    const code = AppStorage.getActiveClass();
    if (!code) return;
    const cls = SocialCore.classes.getByCode(code);
    if (!cls) return;
    const profile = ProfileManager.getActive();
    if (!profile) return;
    document.getElementById('messages-subtitle').textContent = 'گفتگو با ' + cls.teacherName;
    MessagesUI._currentTeacher = 'teacher_' + code;
    MessagesUI._currentClassCode = code;
    MessagesUI.render();
    document.getElementById('modal-messages').classList.remove('hidden');
  }
};
