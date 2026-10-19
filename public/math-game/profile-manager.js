/* ProfileManager — مدیریت پروفایل‌های دانش‌آموزان — نسخه 1.0 */
window.ProfileManager = (function () {
  'use strict';
  const STORAGE_KEY = 'sw_profiles_v1';
  const ACTIVE_KEY = 'sw_active_profile_v1';
  const MAX_PROFILES = 50;
  const AVATARS = ['🦊', '🐼', '🦁', '🐧', '🐻', '🦉', '🐸', '🦄', '🐯', '🐨', '🦅', '🐢'];

  function _load() {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
    catch (e) { console.warn('ProfileManager:', e); return []; }
  }
  function _save(profiles) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles.slice(0, MAX_PROFILES))); }
    catch (e) { console.warn('ProfileManager:', e); }
  }
  function _newId() { return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
  function _now() { return new Date().toISOString(); }

  const api = {
    getAll() { return _load(); },
    getById(profileId) { return _load().find(p => p.profileId === profileId) || null; },
    getActive() {
      try { const id = localStorage.getItem(ACTIVE_KEY); if (!id) return null; return api.getById(id); }
      catch (e) { return null; }
    },
    setActive(profileId) {
      const p = api.getById(profileId);
      if (!p) return false;
      try { localStorage.setItem(ACTIVE_KEY, profileId); api.update(profileId, { lastSeen: _now() }); return true; }
      catch (e) { return false; }
    },
    create(avatar, displayName) {
      const name = String(displayName || '').trim().slice(0, 30);
      if (!name) return { ok: false, error: 'نام نمی‌تواند خالی باشد.' };
      if (!AVATARS.includes(avatar)) return { ok: false, error: 'آواتار نامعتبر است.' };
      const profiles = _load();
      if (profiles.some(p => p.displayName === name)) return { ok: false, error: 'این نام قبلاً استفاده شده.' };
      const newProfile = {
        profileId: _newId(), avatar: avatar, displayName: name,
        createdAt: _now(), lastSeen: _now(),
        totalPoints: 0, streakDays: 0,
        badges: [], fluentFacts: [], shakyFacts: [], focusAreas: [], classLayers: []
      };
      profiles.unshift(newProfile);
      _save(profiles);
      api.setActive(newProfile.profileId);
      return { ok: true, profile: newProfile };
    },
    update(profileId, patch) {
      const profiles = _load();
      const idx = profiles.findIndex(p => p.profileId === profileId);
      if (idx < 0) return false;
      const safe = ['avatar', 'displayName', 'totalPoints', 'streakDays', 'badges', 'fluentFacts', 'shakyFacts', 'focusAreas', 'classLayers', 'lastSeen'];
      safe.forEach(key => { if (Object.prototype.hasOwnProperty.call(patch, key)) profiles[idx][key] = patch[key]; });
      _save(profiles);
      return true;
    },
    delete(profileId) {
      const profiles = _load().filter(p => p.profileId !== profileId);
      _save(profiles);
      try { if (localStorage.getItem(ACTIVE_KEY) === profileId) localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
      return true;
    },
    getAvatars() { return AVATARS.slice(); },
    count() { return _load().length; },
    _clearAll() { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ACTIVE_KEY); } catch (e) {} }
  };

  return api;
})();
