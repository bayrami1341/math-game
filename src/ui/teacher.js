/* teacher.js — پنل معلم v3 — v1.0 */
window.TeacherV3 = {
  data: { students: [], latest: {}, totals: {} },
  currentDetail: null,
  currentPage: 'today',
  currentChatStudent: null,

  open() {
    const list = AppStorage.getAll();
    const latest = {};
    list.forEach(row => { if (!latest[row.name]) latest[row.name] = row; });
    this.data.students = Object.values(latest);
    this.data.latest = latest;

    let sumAcc = 0, cnt = 0, allFacts = {};
    this.data.students.forEach(st => {
      sumAcc += (st.successRate || 0);
      cnt++;
      (st.details || []).forEach(d => {
        const k = (d.f1 || '') + '×' + (d.f2 || '');
        if (!allFacts[k]) allFacts[k] = { fluent: 0, shaky: 0, wrong: 0 };
        if (d.masteryLevel >= 3) allFacts[k].fluent++;
        if (d.shaky) allFacts[k].shaky++;
        if ((d.wrongAnswers || []).length > 0) allFacts[k].wrong++;
      });
    });
    const avgAcc = cnt ? Math.round(sumAcc / cnt) : 0;
    let weakest = null, maxWrong = 0;
    Object.keys(allFacts).forEach(k => {
      if (allFacts[k].wrong > maxWrong) { maxWrong = allFacts[k].wrong; weakest = k; }
    });
    this.data.totals = { count: this.data.students.length, avgAcc: avgAcc, weakest: weakest, allFacts: allFacts };

    document.getElementById('modal-teacher-v2').classList.remove('hidden');
    this.goTo('today');
    this._bindNav();
  },

  close() {
    document.getElementById('modal-teacher-v2').classList.add('hidden');
    this.currentDetail = null;
    this.currentChatStudent = null;
  },

  _bindNav() {
    document.querySelectorAll('#teacher-nav .teacher-nav-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#teacher-nav .teacher-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.goTo(btn.dataset.tpage);
      };
    });
  },

  goTo(page) {
    this.currentPage = page;
    document.querySelectorAll('.teacher-page').forEach(p => p.classList.add('hidden'));
    const backBtn = document.getElementById('teacher-back-v2');
    const title = document.getElementById('teacher-title-v2');
    if (backBtn) backBtn.classList.add('hidden');

    if (page === 'today') {
      document.getElementById('page-today').classList.remove('hidden');
      if (title) title.textContent = '🏠 امروز';
      this.renderToday();
    } else if (page === 'students') {
      document.getElementById('page-students').classList.remove('hidden');
      if (title) title.textContent = '👥 دانش‌آموزان';
      this.renderStudentList();
    } else if (page === 'detail') {
      document.getElementById('page-detail').classList.remove('hidden');
      if (backBtn) backBtn.classList.remove('hidden');
      if (title) title.textContent = '👤 جزئیات';
      this.renderDetail();
    } else if (page === 'classes') {
      document.getElementById('page-classes').classList.remove('hidden');
      if (title) title.textContent = '🏫 کلاس‌های من';
      this.renderClasses();
    } else if (page === 'messages') {
      document.getElementById('page-messages').classList.remove('hidden');
      if (title) title.textContent = '📬 پیام‌ها';
      this.renderMessages();
    } else if (page === 'settings') {
      document.getElementById('page-settings').classList.remove('hidden');
      if (title) title.textContent = '⚙️ تنظیمات';
      this.renderSettings();
    }
  },

  getKawhMessage() {
    const h = new Date().getHours();
    const cnt = this.data.students.length;
    if (cnt === 0) return 'هنوز کسی بازی نکرده. وقتی اولین دانش‌آموز بازی کند، اینجا گزارش می‌دهم.';
    const good = this.data.students.filter(s => (s.successRate || 0) >= 80).length;
    const warn = this.data.students.filter(s => (s.successRate || 0) >= 50 && (s.successRate || 0) < 80).length;
    const danger = this.data.students.filter(s => (s.successRate || 0) < 50).length;
    if (h >= 5 && h < 12) {
      return toFa(cnt) + ' دانش‌آموز در سیستم داریم. ' + (good > 0 ? toFa(good) + ' نفر آماده، ' : '') + (warn > 0 ? toFa(warn) + ' نفر نیاز به تمرین، ' : '') + (danger > 0 ? toFa(danger) + ' نفر نیاز به توجه.' : 'همه خوب.');
    }
    if (h >= 12 && h < 18) return toFa(cnt) + ' دانش‌آموز بازی کردند. ' + (good > 0 ? toFa(good) + ' نفر پیشرفت کردند.' : 'امروز منتظر پیشرفت هستیم.');
    return toFa(cnt) + ' دانش‌آموز در سیستم هستند. یک نگاه به لیست بینداز.';
  },

  renderToday() {
    const kawhEl = document.getElementById('kawh-text-today');
    if (kawhEl) kawhEl.textContent = this.getKawhMessage();

    const good = [], warn = [], danger = [];
    this.data.students.forEach(st => {
      const acc = st.successRate || 0;
      if (acc >= 80) good.push(st);
      else if (acc >= 50) warn.push(st);
      else danger.push(st);
    });

    let statusHTML = '';
    if (this.data.students.length === 0) {
      statusHTML = '<div class="summary-empty">هنوز داده‌ای نیست.</div>';
    } else {
      statusHTML += '<div class="stat-line clickable" data-expando="good"><span class="expando-icon" data-icon="good">▼</span><span>✅ آماده (' + toFa(good.length) + ')</span></div>';
      statusHTML += '<div class="expando-content" id="expando-good">';
      if (good.length === 0) statusHTML += '<div>هنوز کسی به ۸۰٪ نرسیده.</div>';
      else good.forEach(st => {
        const profile = ProfileManager.getById(st.profileId);
        const av = profile ? profile.avatar : '👤';
        statusHTML += '<div class="student-line"><span class="line-name">' + av + ' ' + escapeHtml(st.name) + '</span><span class="line-note">' + toFa(st.successRate || 0) + '٪</span></div>';
      });
      statusHTML += '</div>';

      statusHTML += '<div class="stat-line clickable" data-expando="warn"><span class="expando-icon" data-icon="warn">▼</span><span>⚠️ نیاز به تمرین (' + toFa(warn.length) + ')</span></div>';
      statusHTML += '<div class="expando-content" id="expando-warn">';
      if (warn.length === 0) statusHTML += '<div>همه خوب پیش می‌روند.</div>';
      else warn.forEach(st => {
        statusHTML += '<div class="student-line"><span class="line-name">' + escapeHtml(st.name) + '</span><span class="line-note">' + toFa(st.successRate || 0) + '٪</span></div>';
      });
      statusHTML += '</div>';

      statusHTML += '<div class="stat-line clickable" data-expando="danger"><span class="expando-icon" data-icon="danger">▼</span><span>❌ نیاز به توجه (' + toFa(danger.length) + ')</span></div>';
      statusHTML += '<div class="expando-content" id="expando-danger">';
      if (danger.length === 0) statusHTML += '<div>هیچ‌کس در وضعیت بحرانی نیست.</div>';
      else danger.forEach(st => {
        statusHTML += '<div class="student-line"><span class="line-name">' + escapeHtml(st.name) + '</span><span class="line-note">' + toFa(st.successRate || 0) + '٪</span></div>';
      });
      statusHTML += '</div>';
    }
    const statusBody = document.getElementById('today-status-body');
    if (statusBody) statusBody.innerHTML = statusHTML;

    let suggestionHTML = '';
    const weakest = this.data.totals.weakest;
    if (weakest) {
      const parts = weakest.split('×');
      const f1 = parseInt(parts[0], 10), f2 = parseInt(parts[1], 10);
      const wrongList = [];
      this.data.students.forEach(st => {
        (st.details || []).forEach(d => {
          if ((d.f1 === f1 && d.f2 === f2) && (d.wrongAnswers || []).length > 0) wrongList.push(st.name);
        });
      });
      suggestionHTML = '<div style="font-size:1rem; font-weight:700; margin-bottom:6px; color:#fff;">۷ دقیقه مرور ضرب ' + toFa(f1) + '×' + toFa(f2) + '</div>';
      suggestionHTML += '<div style="font-size:0.82rem; color:var(--muted); margin-bottom:12px; line-height:1.6;">' + toFa(wrongList.length) + ' دانش‌آموز در این ضرب خطا کردند.</div>';
      suggestionHTML += '<button class="action-btn" style="width:100%;" id="today-go-students-btn">ببین جزئیات</button>';
    } else {
      suggestionHTML = '<div style="font-size:1rem; font-weight:700; margin-bottom:6px; color:#fff;">امروز تمرین خاصی پیشنهاد نمی‌شود.</div>';
      suggestionHTML += '<div style="font-size:0.82rem; color:var(--muted);">وقتی دانش‌آموزان بازی کنند، اینجا پیشنهاد ظاهر می‌شود.</div>';
    }
    const sugBody = document.getElementById('today-suggestion-body');
    if (sugBody) sugBody.innerHTML = suggestionHTML;

    let overviewHTML = '';
    overviewHTML += '<div class="stat-line"><span>👥 دانش‌آموزان</span><span style="font-weight:800; color:var(--cyan);">' + toFa(this.data.totals.count) + '</span></div>';
    overviewHTML += '<div class="stat-line clickable" data-expando="avg"><span class="expando-icon" data-icon="avg">▼</span><span>✅ میانگین دقت</span><span style="font-weight:800; color:var(--green);">' + toFa(this.data.totals.avgAcc) + '٪</span></div>';
    overviewHTML += '<div class="expando-content" id="expando-avg">';
    this.data.students.slice().sort((a, b) => (b.successRate || 0) - (a.successRate || 0)).forEach(st => {
      overviewHTML += '<div class="student-line"><span class="line-name">' + escapeHtml(st.name) + '</span><span class="line-note">' + toFa(st.successRate || 0) + '٪</span></div>';
    });
    overviewHTML += '</div>';
    const ovBody = document.getElementById('today-overview-body');
    if (ovBody) ovBody.innerHTML = overviewHTML;

    this._bindExpando();
    const goBtn = document.getElementById('today-go-students-btn');
    if (goBtn) goBtn.addEventListener('click', () => {
      document.querySelectorAll('#teacher-nav .teacher-nav-btn').forEach(b => b.classList.remove('active'));
      const studentsTab = document.querySelector('[data-tpage="students"]');
      if (studentsTab) studentsTab.classList.add('active');
      this.goTo('students');
    });
  },

  _bindExpando() {
    document.querySelectorAll('.teacher-page [data-expando]').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.expando;
        const content = document.getElementById('expando-' + key);
        const icon = el.querySelector('.expando-icon');
        if (!content) return;
        if (content.classList.contains('show')) {
          content.classList.remove('show');
          if (icon) icon.classList.remove('open');
        } else {
          content.classList.add('show');
          if (icon) icon.classList.add('open');
        }
      });
    });
  },

  renderStudentList() {
    const list = document.getElementById('student-list-v2');
    if (!list) return;
    let students = this.data.students.slice();
    students.sort((a, b) => (a.successRate || 0) - (b.successRate || 0));
    if (students.length === 0) {
      list.innerHTML = '<div class="summary-empty">هیچ دانش‌آموزی ثبت نشده.</div>';
      return;
    }
    list.innerHTML = '';
    students.forEach(st => {
      const acc = st.successRate || 0;
      let statusIcon = '✅';
      if (acc < 50) statusIcon = '❌';
      else if (acc < 80) statusIcon = '⚠️';
      const profile = ProfileManager.getById(st.profileId);
      const avatar = profile ? profile.avatar : '👤';
      const heroCount = st.profileId ? HeroesCore.countForProfile(st.profileId) : 0;
      const heroText = heroCount > 0 ? ' • 🏆 ' + toFa(heroCount) : '';
      const row = document.createElement('div');
      row.className = 'student-row';
      row.innerHTML = '<div class="student-avatar">' + avatar + '</div>' +
                      '<div class="student-info">' +
                        '<div class="student-name">' + escapeHtml(st.name) + '</div>' +
                        '<div class="student-sub">' + (st.className ? escapeHtml(st.className) : '—') + heroText + '</div>' +
                      '</div>' +
                      '<div class="student-status">' + statusIcon + '</div>' +
                      '<div class="student-percent">' + toFa(acc) + '٪</div>';
      row.addEventListener('click', () => {
        this.currentDetail = st;
        this.goTo('detail');
      });
      list.appendChild(row);
    });
  },

  renderDetail() {
    const st = this.currentDetail;
    if (!st) return;
    const profile = ProfileManager.getById(st.profileId);
    const avatar = profile ? profile.avatar : '👤';
    const details = st.details || [];
    let fluentCount = 0;
    details.forEach(d => { if (d.masteryLevel >= 3) fluentCount++; });
    const heroCount = st.profileId ? HeroesCore.countForProfile(st.profileId) : 0;
    const ownedHeroes = st.profileId ? HeroesCore.getForProfile(st.profileId) : [];

    let html = '';
    html += '<div style="text-align:center; padding:16px 0;">';
    html += '<div style="font-size:3.4rem; margin-bottom:6px;">' + avatar + '</div>';
    html += '<div style="font-size:1.25rem; font-weight:900; color:#fff;">' + escapeHtml(st.name) + '</div>';
    html += '<div style="font-size:0.82rem; color:var(--muted); margin-top:4px;">' + (st.className ? escapeHtml(st.className) : '') + '</div>';
    html += '</div>';

    html += '<div style="background:rgba(13,22,45,0.95); border:1.5px solid rgba(0,243,255,0.15); border-radius:12px; padding:12px 14px; margin-bottom:10px;">';
    html += '<h3 style="color:var(--cyan); font-size:0.88rem; margin-bottom:10px; font-weight:800;">📊 پیشرفت</h3>';
    html += '<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:0.85rem; color:#fff;"><span>ضرب‌های روان</span><span style="font-weight:800; color:var(--cyan);">' + toFa(fluentCount) + ' از ' + toFa(details.length) + '</span></div>';
    html += '<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:0.85rem; color:#fff;"><span>دقت</span><span style="font-weight:800; color:var(--cyan);">' + toFa(st.successRate || 0) + '٪</span></div>';
    html += '<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:0.85rem; color:#fff;"><span>پهلوانان</span><span style="font-weight:800; color:var(--gold);">' + toFa(heroCount) + ' از ۱۲</span></div>';
    html += '</div>';

    if (ownedHeroes.length > 0) {
      html += '<div style="background:rgba(255,183,3,0.05); border:1.5px solid rgba(255,183,3,0.3); border-radius:12px; padding:12px 14px; margin-bottom:10px;">';
      html += '<h3 style="color:var(--gold); font-size:0.88rem; margin-bottom:10px; font-weight:800;">🏆 پهلوانان آزادشده</h3>';
      html += '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
      ownedHeroes.forEach(h => {
        const hero = HeroesCore.getById(h.id);
        if (hero) html += '<div style="font-size:1.6rem; padding:6px; background:rgba(0,0,0,0.3); border-radius:8px;" title="' + escapeHtml(hero.name) + '">' + hero.emoji + '</div>';
      });
      html += '</div></div>';
    }

    const learned = details.filter(d => d.masteryLevel >= 3);
    html += '<div style="background:rgba(13,22,45,0.95); border:1.5px solid rgba(0,243,255,0.15); border-radius:12px; padding:12px 14px; margin-bottom:10px;">';
    html += '<h3 style="color:var(--cyan); font-size:0.88rem; margin-bottom:10px; font-weight:800;">✅ ضرب‌های روان</h3>';
    if (learned.length === 0) html += '<div style="color:var(--muted); font-size:0.82rem; padding:8px;">هنوز ضربی روان نشده.</div>';
    else learned.forEach(d => {
      html += '<div style="padding:8px 10px; border-radius:8px; background:rgba(0,0,0,0.2); margin-bottom:6px; font-size:0.82rem; display:flex; justify-content:space-between; align-items:center; color:#fff; border-right:3px solid var(--green);"><span>' + toFa(d.f1) + '×' + toFa(d.f2) + '</span><span style="color:var(--green); font-weight:700;">روان</span></div>';
    });
    html += '</div>';

    const shaky = details.filter(d => d.shaky || ((d.masteryLevel < 3) && (d.wrongAnswers || []).length > 0));
    html += '<div style="background:rgba(13,22,45,0.95); border:1.5px solid rgba(0,243,255,0.15); border-radius:12px; padding:12px 14px; margin-bottom:10px;">';
    html += '<h3 style="color:var(--cyan); font-size:0.88rem; margin-bottom:10px; font-weight:800;">⚠️ ضرب‌های لرزان</h3>';
    if (shaky.length === 0) html += '<div style="color:var(--muted); font-size:0.82rem; padding:8px;">همه ضرب‌ها محکم هستند.</div>';
    else shaky.forEach(d => {
      html += '<div style="padding:8px 10px; border-radius:8px; background:rgba(0,0,0,0.2); margin-bottom:6px; font-size:0.82rem; display:flex; justify-content:space-between; align-items:center; color:#fff; border-right:3px solid var(--red);"><span>' + toFa(d.f1) + '×' + toFa(d.f2) + '</span><span style="color:var(--red); font-weight:700;">' + toFa((d.wrongAnswers || []).length) + ' خطا</span></div>';
    });
    html += '</div>';

    const detailContent = document.getElementById('detail-content');
    if (detailContent) detailContent.innerHTML = html;
  },

  renderClasses() {
    const box = document.getElementById('teacher-classes-list');
    if (!box) return;
    const classes = SocialCore.classes.getAll();
    if (classes.length === 0) {
      box.innerHTML = '<div class="summary-empty">هنوز کلاسی نساخته‌اید.<br>روی «ساخت کلاس جدید» بزنید.</div>';
      return;
    }
    box.innerHTML = '<div style="font-size:0.78rem; color:var(--muted); margin-bottom:10px;">📚 ' + toFa(classes.length) + ' کلاس — کدها اینجا آرشیو می‌شوند</div>';
    classes.forEach(cls => {
      const div = document.createElement('div');
      div.style.cssText = 'background:rgba(0,0,0,0.3); border:1.5px solid rgba(255,183,3,0.3); border-radius:12px; padding:14px; margin-bottom:10px;';
      div.innerHTML =
        '<div style="font-weight:800; color:#fff; font-size:0.95rem; margin-bottom:8px;">🏫 ' + escapeHtml(cls.name) + '</div>' +
        '<div style="text-align:center; background:rgba(0,243,255,0.08); border:1.5px dashed var(--cyan); border-radius:10px; padding:10px; margin-bottom:10px;">' +
          '<div style="font-size:0.72rem; color:var(--muted); margin-bottom:4px;">کد کلاس</div>' +
          '<div style="font-size:1.8rem; font-weight:900; color:var(--gold); letter-spacing:0.2em; font-family:monospace; direction:ltr;">' + cls.code + '</div>' +
        '</div>' +
        '<div style="font-size:0.78rem; color:var(--muted); margin-bottom:10px;">معلم: ' + escapeHtml(cls.teacherName) + ' • 👥 ' + toFa(cls.members.length) + ' از ' + toFa(cls.maxStudents) + '</div>' +
        '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
          '<button class="mini-btn" data-action="copy" data-code="' + cls.code + '">📋 کپی کد</button>' +
          '<button class="mini-btn" data-action="view" data-code="' + cls.code + '">👁 اعضا</button>' +
          '<button class="mini-btn" data-action="leaderboard" data-code="' + cls.code + '">🏆 رتبه‌ها</button>' +
          '<button class="mini-btn" data-action="delete" data-code="' + cls.code + '" style="color:var(--red);">🗑 حذف</button>' +
        '</div>';
      box.appendChild(div);
    });
    box.querySelectorAll('.mini-btn').forEach(btn => {
      btn.onclick = () => {
        const code = btn.dataset.code;
        const action = btn.dataset.action;
        if (action === 'copy') {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => alert('کد ' + code + ' کپی شد!')).catch(() => alert('کد: ' + code));
          } else alert('کد: ' + code);
        } else if (action === 'view') {
          const cls = SocialCore.classes.getByCode(code);
          if (cls) {
            const list = cls.members.length === 0 ? '(خالی)' : cls.members.map(m => '• ' + m.name + ' (' + toFa(m.totalScore || 0) + ' امتیاز)').join('\n');
            alert('کلاس ' + cls.name + ' — کد: ' + code + '\n\n' + list);
          }
        } else if (action === 'leaderboard') {
          const cls = SocialCore.classes.getByCode(code);
          if (!cls) return;
          const top = SocialCore.classes.getTopFor(code, 10);
          alert('🏆 رتبه‌بندی ' + cls.name + '\n\n' + (top.length === 0 ? '(خالی)' : top.map((m, i) => (i + 1) + '. ' + m.name + ' — ' + toFa(m.totalScore || 0)).join('\n')));
        } else if (action === 'delete') {
          if (confirm('کلاس حذف شود؟ این کار قابل بازگشت نیست.')) {
            SocialCore.classes.delete(code);
            this.renderClasses();
          }
        }
      };
    });
  },

  renderMessages() {
    const picker = document.getElementById('teacher-msg-picker');
    const chat = document.getElementById('teacher-chat-container');
    if (!picker || !chat) return;

    const list = AppStorage.getAll();
    const latest = {};
    list.forEach(row => { if (!latest[row.name]) latest[row.name] = row; });
    const students = Object.values(latest);

    if (students.length === 0) {
      picker.innerHTML = '<div class="summary-empty">هنوز دانش‌آموزی ثبت نشده.</div>';
      chat.innerHTML = '<div class="chat-empty">هنوز دانش‌آموزی نیست.</div>';
      return;
    }

    const ids = students.map(st => st.profileId || st.name || 'guest');
    if (!this.currentChatStudent || !ids.includes(this.currentChatStudent)) {
      this.currentChatStudent = ids[0];
    }

    picker.innerHTML = '';
    students.forEach(st => {
      const id = st.profileId || st.name || 'guest';
      const profile = ProfileManager.getById(st.profileId);
      const av = profile ? profile.avatar : '👤';
      const chip = document.createElement('button');
      chip.className = 'msg-student-chip' + (this.currentChatStudent === id ? ' active' : '');
      chip.textContent = av + ' ' + st.name;
      chip.onclick = () => {
        this.currentChatStudent = id;
        this.renderMessages();
      };
      picker.appendChild(chip);
    });

    const activeClass = AppStorage.getActiveClass();
    const teacherId = activeClass ? ('teacher_' + activeClass) : 'teacher';
    const convA = SocialCore.messages.getConversation(this.currentChatStudent, 'teacher');
    const convB = SocialCore.messages.getConversation(this.currentChatStudent, teacherId);
    const seen = new Set();
    const conv = convA.concat(convB)
      .filter(m => {
        const key = (m.id || (m.sentAt + '|' + m.text));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

    if (conv.length === 0) {
      chat.innerHTML = '<div class="chat-empty">هنوز پیامی رد و بدل نشده.</div>';
      return;
    }

    chat.innerHTML = '';
    conv.forEach(m => {
      const isMine = m.from === 'teacher' || (typeof m.from === 'string' && m.from.indexOf('teacher_') === 0);
      const b = document.createElement('div');
      b.className = 'chat-bubble ' + (isMine ? 'from-me' : 'from-them');
      b.innerHTML = escapeHtml(m.text) + '<span class="chat-time">' + timeFa(m.sentAt) + '</span>';
      chat.appendChild(b);
    });
    chat.scrollTop = chat.scrollHeight;
  },

  renderSettings() {
    const s = AppStorage.getSettings();
    const sr = document.getElementById('setting-show-rank');
    const am = document.getElementById('setting-allow-msg');
    if (sr) {
      sr.checked = !!s.showRankToStudents;
      sr.onchange = () => {
        s.showRankToStudents = sr.checked;
        AppStorage.saveSettings(s);
      };
    }
    if (am) {
      am.checked = s.allowMessaging !== false;
      am.onchange = () => {
        s.allowMessaging = am.checked;
        AppStorage.saveSettings(s);
      };
    }
  },

  failedAttempts: 0,
  lockUntil: 0,

  openLogin() {
    if (Date.now() < this.lockUntil) {
      alert('ورود برای ' + Math.ceil((this.lockUntil - Date.now()) / 1000) + ' ثانیه قفل است.');
      return;
    }
    const m = document.getElementById('modal-teacher-login');
    const i = document.getElementById('teacher-pin-input');
    i.value = '';
    m.classList.remove('hidden');
    setTimeout(() => i.focus(), 80);
  },

  submitLogin() {
    const i = document.getElementById('teacher-pin-input'), pin = i.value.trim();
    const m = document.getElementById('modal-teacher-login'), s = AppStorage.getSettings();
    if (pin === s.teacherPin) {
      this.failedAttempts = 0;
      m.classList.add('hidden');
      this.open();
    } else {
      this.failedAttempts++;
      if (this.failedAttempts >= 3) {
        this.lockUntil = Date.now() + 30000;
        this.failedAttempts = 0;
        m.classList.add('hidden');
        alert('سه تلاش ناموفق. ورود برای ۳۰ ثانیه قفل شد.');
      } else {
        i.value = '';
        i.focus();
        alert('رمز نادرست. تلاش ' + toFa(this.failedAttempts) + ' از ۳');
      }
    }
  }
};
