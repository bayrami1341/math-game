/* social-core.js — سیستم اجتماعی کارگاه ایستگاه
 * گروه‌ها، کلاس‌ها، پیام‌ها
 * کاملاً آفلاین — بدون نیاز به سرور
 * نسخه 1.0
 */
const SocialCore = (function () {
  'use strict';

  const KEYS = {
    GROUPS: 'sw_groups_v1',
    CLASSES: 'sw_classes_v1',
    MESSAGES: 'sw_messages_v1'
  };

  function _load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }

  function _save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (e) { console.warn('SocialCore: storage error', e); }
  }

  function _id() { return 'x_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }
  function _now() { return new Date().toISOString(); }
  function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  // ============================================
  // گروه‌ها (بازی با دوستان)
  // ============================================
  const Groups = {
    create(name, creator) {
      if (!creator || !creator.profileId) return { ok: false, error: 'پروفایل لازم است' };
      const groups = _load(KEYS.GROUPS);
      let code;
      do { code = generateCode(); } while (groups.some(g => g.code === code));

      const group = {
        code: code,
        name: String(name || 'گروه دوستان').slice(0, 30),
        createdBy: creator.profileId,
        createdAt: _now(),
        autoCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        maxMembers: 10,
        members: [{
          profileId: creator.profileId,
          name: creator.displayName,
          avatar: creator.avatar,
          joinedAt: _now(),
          bestScore: 0,
          bestTime: 0,
          sessionsCount: 0,
          lastPlayedAt: null
        }]
      };
      groups.unshift(group);
      _save(KEYS.GROUPS, groups.slice(0, 50));
      return { ok: true, group: group };
    },

    join(code, profile) {
      if (!profile || !profile.profileId) return { ok: false, error: 'پروفایل لازم است' };
      const cleanCode = String(code || '').trim();
      const groups = _load(KEYS.GROUPS);
      const idx = groups.findIndex(g => g.code === cleanCode);
      if (idx < 0) return { ok: false, error: 'گروهی با این کد پیدا نشد' };

      const group = groups[idx];
      if (group.members.length >= group.maxMembers) {
        return { ok: false, error: 'ظرفیت گروه پر است (' + group.maxMembers + ' نفر)' };
      }
      if (group.members.some(m => m.profileId === profile.profileId)) {
        return { ok: true, group: group, alreadyMember: true };
      }
      group.members.push({
        profileId: profile.profileId,
        name: profile.displayName,
        avatar: profile.avatar,
        joinedAt: _now(),
        bestScore: 0,
        bestTime: 0,
        sessionsCount: 0,
        lastPlayedAt: null
      });
      _save(KEYS.GROUPS, groups);
      return { ok: true, group: group };
    },

    getAll() { return _load(KEYS.GROUPS); },

    getByCode(code) {
      return _load(KEYS.GROUPS).find(g => g.code === String(code || '').trim()) || null;
    },

    getForProfile(profileId) {
      return _load(KEYS.GROUPS).filter(g => g.members.some(m => m.profileId === profileId));
    },

    submitScore(code, profileId, score, timeSeconds) {
      const groups = _load(KEYS.GROUPS);
      const group = groups.find(g => g.code === String(code || '').trim());
      if (!group) return null;
      const member = group.members.find(m => m.profileId === profileId);
      if (!member) return null;
      member.sessionsCount = (member.sessionsCount || 0) + 1;
      member.lastPlayedAt = _now();
      const prevBest = member.bestScore || 0;
      const isRecord = score > prevBest;
      if (isRecord) {
        member.bestScore = score;
        member.bestTime = timeSeconds || 0;
      }
      _save(KEYS.GROUPS, groups);
      return { member: member, isRecord: isRecord };
    },

    getLeaderboard(code) {
      const group = this.getByCode(code);
      if (!group) return [];
      return group.members.slice().sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0));
    },

    leave(code, profileId) {
      const groups = _load(KEYS.GROUPS);
      const group = groups.find(g => g.code === String(code || '').trim());
      if (!group) return false;
      group.members = group.members.filter(m => m.profileId !== profileId);
      if (group.members.length === 0) {
        _save(KEYS.GROUPS, groups.filter(g => g.code !== group.code));
      } else {
        _save(KEYS.GROUPS, groups);
      }
      return true;
    },

    delete(code) {
      _save(KEYS.GROUPS, _load(KEYS.GROUPS).filter(g => g.code !== String(code || '').trim()));
    }
  };

  // ============================================
  // کلاس‌ها (کلاس معلم)
  // ============================================
  const Classes = {
    create(name, teacherName) {
      const classes = _load(KEYS.CLASSES);
      let code;
      do { code = generateCode(); } while (classes.some(c => c.code === code));

      const cls = {
        code: code,
        name: String(name || 'کلاس').slice(0, 40),
        teacherName: String(teacherName || 'معلم').slice(0, 30),
        createdAt: _now(),
        maxStudents: 100,
        settings: {
          showRankToStudents: false,
          allowMessaging: true
        },
        members: [],
        assignments: []
      };
      classes.unshift(cls);
      _save(KEYS.CLASSES, classes.slice(0, 20));
      return cls;
    },

    join(code, profile) {
      if (!profile || !profile.profileId) return { ok: false, error: 'پروفایل لازم است' };
      const cleanCode = String(code || '').trim();
      const classes = _load(KEYS.CLASSES);
      const idx = classes.findIndex(c => c.code === cleanCode);
      if (idx < 0) return { ok: false, error: 'کلاسی با این کد پیدا نشد' };

      const cls = classes[idx];
      if (cls.members.length >= cls.maxStudents) return { ok: false, error: 'ظرفیت کلاس پر است' };
      if (cls.members.some(m => m.profileId === profile.profileId)) {
        return { ok: true, class: cls, alreadyMember: true };
      }
      cls.members.push({
        profileId: profile.profileId,
        name: profile.displayName,
        avatar: profile.avatar,
        joinedAt: _now(),
        totalScore: 0,
        sessionsCount: 0,
        lastSeenAt: _now()
      });
      _save(KEYS.CLASSES, classes);
      return { ok: true, class: cls };
    },

    getAll() { return _load(KEYS.CLASSES); },

    getByCode(code) {
      return _load(KEYS.CLASSES).find(c => c.code === String(code || '').trim()) || null;
    },

    getForProfile(profileId) {
      return _load(KEYS.CLASSES).filter(c => c.members.some(m => m.profileId === profileId));
    },

    setSetting(code, key, value) {
      const classes = _load(KEYS.CLASSES);
      const cls = classes.find(c => c.code === String(code || '').trim());
      if (!cls) return false;
      cls.settings[key] = value;
      _save(KEYS.CLASSES, classes);
      return true;
    },

    addAssignment(code, profileId, facts, note) {
      const classes = _load(KEYS.CLASSES);
      const cls = classes.find(c => c.code === String(code || '').trim());
      if (!cls) return false;
      cls.assignments.push({
        id: _id(),
        profileId: profileId,
        facts: Array.isArray(facts) ? facts : [],
        note: String(note || '').slice(0, 100),
        createdAt: _now()
      });
      _save(KEYS.CLASSES, classes);
      return true;
    },

    getAssignmentsFor(code, profileId) {
      const cls = this.getByCode(code);
      if (!cls) return [];
      return (cls.assignments || []).filter(a => a.profileId === profileId || a.profileId === 'all');
    },

    submitScore(code, profileId, score) {
      const classes = _load(KEYS.CLASSES);
      const cls = classes.find(c => c.code === String(code || '').trim());
      if (!cls) return null;
      const member = cls.members.find(m => m.profileId === profileId);
      if (!member) return null;
      member.totalScore = (member.totalScore || 0) + score;
      member.sessionsCount = (member.sessionsCount || 0) + 1;
      member.lastSeenAt = _now();
      _save(KEYS.CLASSES, classes);
      return member;
    },

    getRankFor(code, profileId) {
      const cls = this.getByCode(code);
      if (!cls) return null;
      const sorted = cls.members.slice().sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
      const idx = sorted.findIndex(m => m.profileId === profileId);
      return idx >= 0 ? { rank: idx + 1, total: sorted.length } : null;
    },

    getTopFor(code, count) {
      const cls = this.getByCode(code);
      if (!cls) return [];
      return cls.members.slice()
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
        .slice(0, count || 10);
    },

    delete(code) {
      _save(KEYS.CLASSES, _load(KEYS.CLASSES).filter(c => c.code !== String(code || '').trim()));
    }
  };

  // ============================================
  // پیام‌ها
  // ============================================
  const Messages = {
    send(from, to, text, context) {
      const cleanText = String(text || '').trim();
      if (!cleanText || cleanText.length > 500) return null;
      const messages = _load(KEYS.MESSAGES);
      const msg = {
        id: _id(),
        from: from,
        to: to,
        text: cleanText,
        sentAt: _now(),
        read: false,
        context: context || {}
      };
      messages.unshift(msg);
      _save(KEYS.MESSAGES, messages.slice(0, 500));
      return msg;
    },

    getAll() { return _load(KEYS.MESSAGES); },

    getConversation(idA, idB) {
      return _load(KEYS.MESSAGES)
        .filter(m => (m.from === idA && m.to === idB) || (m.from === idB && m.to === idA))
        .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
    },

    getForClass(classCode) {
      return _load(KEYS.MESSAGES).filter(m =>
        m.context && m.context.classCode === String(classCode || '').trim()
      );
    },

    markRead(messageId) {
      const messages = _load(KEYS.MESSAGES);
      const m = messages.find(x => x.id === messageId);
      if (m) m.read = true;
      _save(KEYS.MESSAGES, messages);
    },

    markAllReadFor(profileId) {
      const messages = _load(KEYS.MESSAGES);
      messages.forEach(m => { if (m.to === profileId) m.read = true; });
      _save(KEYS.MESSAGES, messages);
    },

    getUnreadCount(profileId) {
      return _load(KEYS.MESSAGES).filter(m => m.to === profileId && !m.read).length;
    },

    delete(messageId) {
      _save(KEYS.MESSAGES, _load(KEYS.MESSAGES).filter(m => m.id !== messageId));
    },

    clearAll() {
      _save(KEYS.MESSAGES, []);
    }
  };

  return {
    groups: Groups,
    classes: Classes,
    messages: Messages,
    generateCode: generateCode,
    _keys: KEYS
  };
})();
