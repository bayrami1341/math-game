const HeroesCore = (function () {
  'use strict';
  const STORAGE_KEY = 'sw_heroes_v1';
  const HEROES = [
    { id: 'arash', name: 'آرش کمانگیر', emoji: '🏹', title: 'کماندار افسانه‌ای', quote: 'یک تیر، یک هدف. تو هم می‌توانی با یک تلاش دقیق، به هدفت برسی.', requirement: '۱۰ پاسخ درست پیاپی', requirementShort: '۱۰ پیاپی', condition: { type: 'streak', value: 10 } },
    { id: 'rostam', name: 'رستم', emoji: '🐯', title: 'پهلوان هفت‌خوان', quote: 'زره ببری‌ام از من محافظت کرد. تو هم با تلاش، قدرتمند می‌شوی.', requirement: '۷ روان در یک جلسه', requirementShort: '۷ روان', condition: { type: 'fluent_in_session', value: 7 } },
    { id: 'kaveh', name: 'کاوه آهنگر', emoji: '🌋', title: 'آهنگر آزادی', quote: 'من در کوره آهنگریم، آهن را نرم کردم. تو هم با تلاش، سختی‌ها را نرم می‌کنی.', requirement: 'بازگشت بعد از ۵ غلط پیاپی', requirementShort: 'بازگشت', condition: { type: 'recovery_after_wrong', value: 5 } },
    { id: 'zal', name: 'زال', emoji: '🧙‍♂️', title: 'پرورده سیمرغ', quote: 'من با موی سفید به دنیا آمدم، ولی دانایی، بزرگ‌ترین دارایی است.', requirement: 'بدون خطا یک بخش کامل', requirementShort: 'بخش بی‌خطا', condition: { type: 'perfect_section', value: 1 } },
    { id: 'simurgh', name: 'سیمرغ', emoji: '🦚', title: 'پرنده افسانه‌ای', quote: 'من با پرهای رنگارنگ در آسمانم. وقتی راهنمایی می‌گیری و موفق می‌شوی، من با تو هستم.', requirement: 'استفاده هوشمندانه از راهنماها', requirementShort: 'راهنما+موفقیت', condition: { type: 'assisted_success', value: 3 } },
    { id: 'keykhosrow', name: 'کیخسرو', emoji: '👑', title: 'پادشاه دانا', quote: 'دانایی از شمشیر قوی‌تر است. تو یک پادشاه دانش هستی.', requirement: 'پایان کامل بازی', requirementShort: 'پایان بازی', condition: { type: 'complete_game', value: 1 } },
    { id: 'bahram', name: 'بهرام', emoji: '🦁', title: 'جنگاور سریع', quote: 'سرعت با دقت، پیروزی می‌آورد. تو هر دو را داری.', requirement: 'پاسخ درست زیر ۲ ثانیه', requirementShort: 'زیر ۲ ثانیه', condition: { type: 'fast_answer', value: 5 } },
    { id: 'goodarz', name: 'گودرز', emoji: '🧭', title: 'استراتژیست', quote: 'هر جنگی، نقشه می‌خواهد. تو بدون کمک، نقشه‌ات را کشیدی.', requirement: 'حل بدون راهنما در یک جلسه', requirementShort: 'بدون راهنما', condition: { type: 'no_hint_session', value: 1 } },
    { id: 'esfandiar', name: 'اسفندیار', emoji: '💎', title: 'رویین‌تن', quote: 'من رویین‌تن بودم، ولی دانش از هر زرهی قوی‌تر است.', requirement: '۲۰ پاسخ درست بدون غلط', requirementShort: '۲۰ درست', condition: { type: 'perfect_20', value: 20 } },
    { id: 'gordafarid', name: 'گُردآفرید', emoji: '🦸‍♀️', title: 'بانوی جنگاور', quote: 'من در برابر پهلوانان ایستادم. تو هم می‌توانی بهترین باشی.', requirement: 'رکورد کلاس (دختران)', requirementShort: 'رکورد کلاس', condition: { type: 'girl_record', value: 1 } },
    { id: 'banu_goshasp', name: 'بانو گشسب', emoji: '🌹', title: 'دختر رستم', quote: 'از پدرم رستم، کمانداری و جوانمردی آموختم. تو هم از تلاشت، قدرت یاد می‌گیری.', requirement: 'همه روان‌ها در یک بخش', requirementShort: 'همه روان', condition: { type: 'all_fluent_section', value: 1 } },
    { id: 'siavash', name: 'سیاوش', emoji: '🔥', title: 'شاهزاده پاک', quote: 'من از آتش گذشتم تا پاکی‌ام ثابت شود. پاکی، ارزشمندتر از قدرت است.', requirement: 'کمک به دوستان (از گروه)', requirementShort: 'کمک به دوستان', condition: { type: 'help_friend', value: 1 } }
  ];
  function _load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; } }
  function _save(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {} }
  function _now() { return new Date().toISOString(); }
  const api = {
    getAll() { return HEROES.slice(); },
    getById(id) { return HEROES.find(h => h.id === id) || null; },
    getForProfile(profileId) { if (!profileId) return []; const data = _load(); return data[profileId] || []; },
    hasHero(profileId, heroId) { return this.getForProfile(profileId).some(h => h.id === heroId); },
    checkAndAward(profileId, stats) {
      if (!profileId) return { newlyAwarded: [] };
      const data = _load();
      if (!data[profileId]) data[profileId] = [];
      const owned = new Set(data[profileId].map(h => h.id));
      const newlyAwarded = [];
      HEROES.forEach(hero => {
        if (owned.has(hero.id)) return;
        if (this._checkCondition(hero.condition, stats)) {
          data[profileId].push({ id: hero.id, awardedAt: _now() });
          owned.add(hero.id);
          newlyAwarded.push(hero);
        }
      });
      if (newlyAwarded.length > 0) _save(data);
      return { newlyAwarded: newlyAwarded };
    },
    _checkCondition(condition, stats) {
      if (!condition || !stats) return false;
      switch (condition.type) {
        case 'streak': return (stats.currentStreak || 0) >= condition.value;
        case 'fluent_in_session': return (stats.fluentInSession || 0) >= condition.value;
        case 'recovery_after_wrong': return (stats.recoveryAfterWrong || 0) >= condition.value;
        case 'perfect_section': return (stats.perfectSections || 0) >= condition.value;
        case 'assisted_success': return (stats.assistedSuccess || 0) >= condition.value;
        case 'complete_game': return (stats.completedGames || 0) >= condition.value;
        case 'fast_answer': return (stats.fastAnswers || 0) >= condition.value;
        case 'no_hint_session': return (stats.noHintSessions || 0) >= condition.value;
        case 'perfect_20': return (stats.perfectTwenty || 0) >= condition.value;
        case 'girl_record': return (stats.girlRecords || 0) >= condition.value;
        case 'all_fluent_section': return (stats.allFluentSections || 0) >= condition.value;
        case 'help_friend': return (stats.helpFriend || 0) >= condition.value;
        default: return false;
      }
    },
    countForProfile(profileId) { return this.getForProfile(profileId).length; },
    getLockedForProfile(profileId) {
      const owned = new Set(this.getForProfile(profileId).map(h => h.id));
      return HEROES.filter(h => !owned.has(h.id));
    },
    _clearAll() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }
  };
  return api;
})();
