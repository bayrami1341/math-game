/* rosha-engine.js — هستهٔ تک‌کودک روشا — برنچ feature/rosha-night-core
 *
 * نقش: پیاده‌سازی داربستیِ قرارداد MEMARI-FANNI (§۳ موجودیت‌ها، §۵ الگوریتم رخداد،
 * §۶ انتخاب کار بعدی) + واژه‌نامهٔ ۹ دهان ضرب فاز اول. این فایل عمداً خالص و
 * بی‌شبکه است: هیچ Firebase، هیچ مدل زبانی، هیچ درصدی. پروندهٔ کودک روی دستگاه
 * می‌ماند (localStorage همین مرورگر).
 *
 * مرزهای شکستنی که این موتور نگه می‌دارد:
 *   ۱) جواب هرگز در راهنما نیست؛ راهنما انتقال وضعیت نمی‌سازد و بستن را برآورده نمی‌کند.
 *   ۲) قبولِ بدون مهارتِ باز، مهارت نمی‌سازد.
 *   ۳) در هر نوبت حداکثر یک پدر عقب می‌رویم.
 *   ۴) بیرون پنجرهٔ هفته کار ساخته نمی‌شود.
 *   ۵) خبر = کد دهان + توصیف وضعیت؛ نه درصد، نه زمان، نه رتبه.
 *   ۶) وضعیت نقشه و وضعیت پرونده دو جهان جدایند؛ این فایل فقط پرونده می‌شناسد.
 *
 * داربست: بانک کار و شناسهٔ مهارت‌ها جایگزین‌اند (ROSHA-*) — کار واقعی با شناسهٔ
 * G3-1403-Pxx-Tx فقط بعد از بارکنندهٔ نقشه و هم‌خوانی ردیف‌ها وارد می‌شود
 * (تا آن زمان نام/شناسهٔ مهارت به هیچ رابط کاربری نمی‌رسد).
 */
(function () {
  'use strict';

  // ─────────────────────────────── واژه‌نامهٔ ۹ دهان ───────────────────────────────
  // منابع: MEMARI-KOL §۶.۴ (فهرست کدهای ضرب فاز اول) + BARNAME-AZ-SEFR (بخش ضرب).
  // هر دهان: id، نام فارسی، نشانهٔ پایدار (mark برای مقایسهٔ بار اول/بار دوم)،
  // ردیاب عملیاتی، و تمرینِ فردا (از BARNAME). ردیاب‌ها محافظه‌کارند: هر شکل غلطی
  // که به هیچ دهانی نخورد → null → «یادداشت» با نشانهٔ تازه (BARNAME «چه کار نکنیم»).
  // نهایی‌سازی آستانه‌ها با تصویب مالک/گوگل‌اپ است؛ اینجا هیچ دهان دهمی ساخته نمی‌شود.

  function digitsOf(n) { return String(n).split('').sort().join(''); }
  function lastDigit(n) { return Number(String(n).slice(-1)); }
  function tensPart(n) { return Number(String(n).slice(0, -1) || '0'); }

  var MOUTHS = [
    {
      id: 'TIMES-ZERO', fa: 'ضرب در صفر', source: 'MEMARI-KOL §۶.۴',
      detect: function (g, a, b) {
        return (a === 0 || b === 0) && g !== 0;
      }
    },
    {
      id: 'TIMES-ONE', fa: 'ضرب در یک', source: 'MEMARI-KOL §۶.۴',
      detect: function (g, a, b) {
        return (a === 1 || b === 1) && g !== a * b;
      }
    },
    {
      id: 'SUM', fa: 'جمع به‌جای ضرب', source: 'MEMARI-KOL §۶.۴',
      detect: function (g, a, b) {
        return (a + b) !== a * b && g === a + b;
      }
    },
    {
      id: 'SUM-GLUE', fa: 'جمعِ آخر چسبانده', source: 'BARNAME-AZ-SEFR (۳۰ و ۱۲ ← ۳۱۲)',
      detect: function (g, a, b) {
        // جزءدهی درست، ادغام غلط: به‌جای جمعِ (دهگان‌حاصل + یکان‌حاصل)، رقم‌ها چسبیده شده‌اند
        if (b < 10 || a < 2 || a > 9) return false;
        var pTens = a * tensPart(b) * 10;           // مثال: ۳×۱۰ = ۳۰
        var pOnes = a * lastDigit(b);               // مثال: ۳×۴  = ۱۲
        if (g === Number(String(pTens) + String(pOnes))) return true;          // ۳۰۱۲
        return g === Number(String(pTens).replace(/0$/, '') + String(pOnes)); // ۳۱۲ (صفرِ دهگان در چسباندن افتاده)
      }
    },
    {
      id: 'MISSING-PART', fa: 'جا ماندن جزء دوم', source: 'MEMARI-KOL §۶.۴ + BARNAME (۳×۱۴ ← ۱۲)',
      detect: function (g, a, b) {
        if (b < 10 || b > 99 || a < 2 || a > 9) return false;
        return g === a * lastDigit(b); // فقط یکان ضرب شده؛ ۳×۱۰ وارد حساب نشده
      }
    },
    {
      id: 'GLUE', fa: 'نشکستن / چسباندن رقم', source: 'BARNAME ضرب + MEMARI-KOL §۳.۳',
      detect: function (g, a, b) {
        // رقم‌ها کنار هم چسبیده‌اند نه ضرب: ۳×۱۴ ← ۳۱۴/۳۴، ۱۴×۳ ← ۱۴۳
        return g === Number(String(a) + String(b))
          || g === Number(String(b) + String(a))
          || (b >= 10 && g === Number(String(a) + lastDigit(b)));
      }
    },
    {
      id: 'JUMP', fa: 'جهش کم یا زیاد', source: 'MEMARI-KOL §۶.۴ + BARNAME (همسایهٔ جدول)',
      mark: function (g, a, b) { // جهت جهش جزو نشانه است — دهان باید همان بماند
        return g === (a - 1) * b || g === a * (b - 1) ? 'JUMP:کم' : 'JUMP:زیاد';
      },
      detect: function (g, a, b) {
        return g === (a - 1) * b || g === a * (b - 1)
          || g === (a + 1) * b || g === a * (b + 1);
      }
    },
    {
      id: 'SWAP', fa: 'شکست جابه‌جایی', source: 'MEMARI-KOL §۶.۴',
      detect: function (g, a, b) {
        // تعریف عملیاتی داربست: رقم‌های حاصل جابه‌جا نوشته شده (۵۶ ← ۶۵)
        return a * b >= 10 && digitsOf(g) === digitsOf(a * b) && g !== a * b;
      }
    },
    {
      id: 'ZERO-SLIP', fa: 'لغزش صفر', source: 'MEMARI-KOL §۶.۴',
      detect: function (g, a, b) {
        // دقیقاً یک صفرِ حاصل جا افتاده (۳۵۰ ← ۳۵)
        var p = String(a * b);
        return (p.match(/0/g) || []).length === 1 && g === Number(p.replace('0', ''));
      }
    }
  ];

  function classifyMouth(given, f1, f2) {
    if (!Number.isFinite(given)) return null;
    var product = f1 * f2;
    if (given === product) return { correct: true };
    for (var i = 0; i < MOUTHS.length; i++) {
      var m = MOUTHS[i];
      if (m.detect(given, f1, f2)) {
        var mark = m.mark ? m.mark(given, f1, f2) : m.id;
        return { correct: false, mouth: m.id, mouthFa: m.fa, mark: mark, source: m.source };
      }
    }
    return { correct: false, mouth: null, mouthFa: null, mark: 'نامعلوم:' + given, source: 'BARNAME «چه کار نکنیم» — یادداشت بماند تا بار دوم' };
  }

  // ─────────────────────────────── بانک داربستی سه مرحله ───────────────────────────────
  // صفحه‌ها از MEMARI-KOL §۳.۷ (پوستهٔ کودک، سه بنا). کارها و مهارت‌ها داربست‌اند
  // (ROSHA-*)؛ کار واقعی فقط از نقشهٔ هم‌خوان می‌آید.

  var STAGES = [
    {
      id: 1, key: 'niroogah', fa: 'نیروگاه', pages: 'صفحهٔ ۱۰ و ۶۴ تا ۶۹',
      theme: 'جهش، دسته، آرایه، جدول یک‌رقمی',
      skill: { id: 'SK-ROSHA-TABLE', parent: null },
      facts: [[2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 4]]
    },
    {
      id: 2, key: 'borj', fa: 'برج', pages: 'صفحهٔ ۷۰ تا ۷۲',
      theme: 'جابه‌جایی و شکستن',
      skill: { id: 'SK-ROSHA-SWAP-BREAK', parent: 'SK-ROSHA-TABLE' },
      facts: [[2, 4], [4, 2], [3, 5], [5, 3], [4, 6], [6, 4], [3, 8], [8, 3]]
    },
    {
      id: 3, key: 'sakkoo', fa: 'سکو', pages: 'صفحهٔ ۱۳۶ تا ۱۴۴',
      theme: 'صفر، یک، ضرب در ۱۰، یک‌رقم در دو/سه‌رقم',
      skill: { id: 'SK-ROSHA-ZERO-ONE-TEN', parent: 'SK-ROSHA-SWAP-BREAK' },
      facts: [[1, 7], [7, 1], [0, 5], [5, 0], [10, 4], [4, 10], [3, 14], [2, 23]]
    }
  ];

  function stageByKey(key) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return STAGES[i];
    return null;
  }

  // کار = یک تمرین ضرب داربستی. شناسه‌ها ROSHA-{مرحله}-T{n} — نه شناسهٔ نقشه.
  function buildWindow(stageKey) {
    var s = stageByKey(stageKey);
    if (!s) return { stage: null, tasks: [] };
    var tasks = s.facts.map(function (f, i) {
      return {
        id: 'ROSHA-S' + s.id + '-T' + (i + 1),
        f1: f[0], f2: f[1],
        prompt: toFa(f[0]) + ' × ' + toFa(f[1]) + ' = ؟',
        skillId: s.skill.id,
        kind: 'جواب عددی' // یکی از چهار زمینهٔ MEMARI-FANNI §۲
      };
    });
    return { stage: s, tasks: tasks };
  }

  function toFa(n) { return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[Number(d)]; }); }

  // ─────────────────────────────── پرونده (روی دستگاه) ───────────────────────────────
  var STORE_KEY = 'rosha_profile_v1';

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* پرونده محفوظ می‌ماند */ }
  }

  function childKeyOf(classCode, childName) {
    return String(classCode || 'کلاس').trim() + '::' + String(childName || '').trim();
  }

  function getProfile(classCode, childName) {
    var store = loadStore();
    var key = childKeyOf(classCode, childName);
    if (!store[key]) {
      store[key] = {
        key: key, classCode: String(classCode || ''), childName: String(childName || ''),
        createdAt: new Date().toISOString(), events: [], skills: {}, doneTasks: {}, relabels: {}
      };
      saveStore(store);
    }
    return store[key];
  }

  function persistProfile(profile) {
    var store = loadStore();
    store[profile.key] = profile;
    saveStore(store);
  }

  function listProfiles() {
    var store = loadStore();
    return Object.keys(store).map(function (k) { return store[k]; });
  }

  function skillState(profile, skillId) {
    if (!profile.skills[skillId]) {
      profile.skills[skillId] = { id: skillId, status: 'دیده‌نشده', lastMark: null, markCount: 0, freshUnassisted: 0 };
    }
    return profile.skills[skillId];
  }

  function skillIsOpen(profile, skillId) {
    return !!skillId && profile.skills[skillId] && profile.skills[skillId].status === 'باز';
  }

  // ─────────────────────────────── الگوریتم رخداد (MEMARI-FANNI §۵) ───────────────────────────────

  /**
   * event = { taskId, f1, f2, given, assisted }
   * task  = کار فعلی (از buildWindow)
   * خروجی = { judged, statusBefore, statusAfter, note }
   */
  function applyEvent(profile, task, event, stage) {
    var before = skillState(profile, task.skillId).status;
    var judged = classifyMouth(Number(event.given), task.f1, task.f2);

    var record = {
      taskId: task.id, f1: task.f1, f2: task.f2,
      correct: !!judged.correct, assisted: !!event.assisted,
      given: Number(event.given), mouth: judged.mouth, mark: judged.mark || null,
      at: new Date().toISOString()
    };
    profile.events.push(record);

    // ردیفِ «ریاضی نیست» در داربست نداریم؛ جای آن در موتور نهایی رزرو است (§۵ بند اول)

    // راهنما: فقط ثبت — نه قبول، نه تأیید بار دوم، نه بستن (§۵)
    if (record.assisted) {
      persistProfile(profile);
      return { judged: judged, statusBefore: before, statusAfter: before, note: 'راهنما فقط ثبت شد؛ انتقالی انجام نشد.' };
    }

    var st = skillState(profile, task.skillId);

    if (judged.correct) {
      if (st.status !== 'باز') {
        // قبولِ بدون مهارتِ باز، مهارت نمی‌سازد (ناوردای §۸)
        profile.doneTasks[task.id] = true;
        persistProfile(profile);
        return { judged: judged, statusBefore: before, statusAfter: st.status, note: 'پاسخ پذیرفته شد.' };
      }
      // مهارت باز است: به بستن کمک می‌کند — دو نمونهٔ تازهٔ بی‌راهنما (§۵)
      st.freshUnassisted += 1;
      if (st.freshUnassisted >= 2) {
        st.status = 'بسته'; // بستن غیرمتعدی است — فرزندان بسته نمی‌شوند
        st.freshUnassisted = 0;
      }
      profile.doneTasks[task.id] = true;
      persistProfile(profile);
      return { judged: judged, statusBefore: before, statusAfter: st.status, note: 'پاسخ پذیرفته شد.' };
    }

    // ── رد است: نشانه را با آخرین نشانهٔ یادداشتِ همین مهارت مقایسه کن (§۵) ──
    var mark = judged.mark;
    if (st.lastMark !== mark) {
      st.lastMark = mark;      // نشانهٔ تازه: شمارندهٔ بار دوم صفر می‌شود (ناوردای §۸)
      st.markCount = 1;
      st.status = 'یادداشت';   // کارت باز نمی‌شود
    } else if (st.markCount === 1) {
      st.markCount = 2;        // همان نشانه، بار دوم:
      var parentOpen = stage && stage.skill.parent && skillIsOpen(profile, stage.skill.parent);
      if (parentOpen) {
        st.status = 'در صف';   // پدر باز است — الگوریتم فقط یک پدر عقب می‌رود
      } else {
        st.status = 'باز';     // پدر باز نیست — مهارت باز می‌شود
      }
    } else {
      st.markCount += 1;       // تکرارهای بعدی همان نشانه: گره همچنان برقرار
      if (st.status === 'یادداشت') {
        var parentOpen2 = stage && stage.skill.parent && skillIsOpen(profile, stage.skill.parent);
        st.status = parentOpen2 ? 'در صف' : 'باز';
      }
    }
    persistProfile(profile);
    return { judged: judged, statusBefore: before, statusAfter: st.status, note: 'گره ثبت شد.' };
  }

  // ─────────────────────────────── انتخاب کار بعدی (MEMARI-FANNI §۶) ───────────────────────────────

  /**
   * پنجره = خروجی buildWindow. نشانگر کلاس مستقل است و با این انتخاب جابه‌جا نمی‌شود.
   * ترتیب: پدرِ باز ← مهارتِ بازِ داخل پنجره ← اولین کار انجام‌نشدهٔ پنجره ← هیچ.
   */
  function nextTask(profile, win) {
    if (!win.stage) return { task: null, reason: 'پنجره‌ای باز نیست.' };
    var s = win.stage;

    // ۱) اگر پدرِ مهارتِ این مرحله باز است، کار بعدی از پدر است (یک پله، نه بیشتر)
    if (s.skill.parent && skillIsOpen(profile, s.skill.parent)) {
      var parentTask = win.tasks.filter(function (t) { return t.skillId === s.skill.parent; })[0];
      if (parentTask) return { task: parentTask, reason: 'یک پله به عقب: کار از مهارت پدر.' };
      // داربست: کارِ پدر در همین پنجره نیست — ادامه با قاعدهٔ بعدی
    }

    // ۲) مهارتی داخل پنجرهٔ هفته باز است → کار بعدی از همان مهارت
    if (skillIsOpen(profile, s.skill.id)) {
      var openTask = win.tasks.filter(function (t) { return t.skillId === s.skill.id; })[0];
      if (openTask) return { task: openTask, reason: 'مهارتِ باز داخل پنجره — تمرین از همان‌جا.' };
    }

    // ۳) اولین کارِ انجام‌نشدهٔ پنجره
    for (var i = 0; i < win.tasks.length; i++) {
      if (!profile.doneTasks[win.tasks[i].id]) {
        return { task: win.tasks[i], reason: 'ادامهٔ پنجرهٔ این هفته.' };
      }
    }

    // ۴) بیرون پنجره کار ساخته نمی‌شود
    return { task: null, reason: 'پنجرهٔ این هفته تمام شد — کار امروز تمام است.' };
  }

  // ─────────────────────────────── خبر (یک جمله، بی‌درصد) ───────────────────────────────
  // جمله از پرونده خوانده می‌شود، از درصد/نقشه تولید نمی‌شود. فاز اول: کد دهان + وضعیت.

  function mouthFaOf(id) {
    for (var i = 0; i < MOUTHS.length; i++) if (MOUTHS[i].id === id) return MOUTHS[i].fa;
    return null;
  }

  // فهرست ۹ دهان برای میز معلم (برچسب‌گذاری) — از واژه‌نامهٔ موتور، نه از مدل زبانی
  function mouthList() {
    return MOUTHS.map(function (m) { return { id: m.id, fa: m.fa, source: m.source }; });
  }

  function morningSentence(profile, win) {
    var s = win && win.stage;
    if (!s) return null;
    var st = skillState(profile, s.skill.id);
    var lastWrong = null;
    for (var i = profile.events.length - 1; i >= 0; i--) {
      var e = profile.events[i];
      if (!e.correct && !e.assisted && win.tasks.some(function (t) { return t.id === e.taskId; })) { lastWrong = e; break; }
    }
    var mouthFa = lastWrong && lastWrong.mouth ? mouthFaOf(lastWrong.mouth) : null;

    if (st.status === 'باز' || st.status === 'در صف') {
      return 'گره مانده' + (mouthFa ? ' — دهان: ' + mouthFa : ' — دهان هنوز نامعین (یادداشت)') + '.';
    }
    if (st.status === 'یادداشت') {
      return 'یک بار لغزش دید' + (mouthFa ? ' — دهان: ' + mouthFa : '') + '؛ هنوز گره نیست.';
    }
    var windowDone = win.tasks.every(function (t) { return profile.doneTasks[t.id]; });
    if (windowDone) return 'کار پنجره را تمام کرد.';
    return 'کار ناتمام دارد.';
  }

  // سه فهرست صبح (میز معلم): نیامده / گره مانده / تمام کرده — از پرونده، بی‌درصد
  function morningLists(profiles, win) {
    var notCome = [], stuck = [], finished = [];
    (profiles || []).forEach(function (p) {
      var saw = (p.events || []).some(function (e) {
        return win.tasks.some(function (t) { return t.id === e.taskId; });
      });
      var st = win.stage ? (p.skills[win.stage.skill.id] || {}).status : 'دیده‌نشده';
      var done = win.tasks.every(function (t) { return p.doneTasks[t.id]; });
      if (!saw) { notCome.push(p); return; }
      if (st === 'باز' || st === 'در صف' || st === 'یادداشت') stuck.push(p);
      if (done) finished.push(p);
    });
    return { notCome: notCome, stuck: stuck, finished: finished };
  }

  // برچسب معلم: حرف آخر با کسی است که بچه را دیده — برچسب فقط پروندهٔ همین کودک را عوض می‌کند
  function relabel(profile, stageKey, newStatusLabel, noteText) {
    var s = stageByKey(stageKey);
    if (!s) return false;
    var st = skillState(profile, s.skill.id);
    st.status = newStatusLabel;
    profile.relabels[s.skill.id] = { by: 'معلم', to: newStatusLabel, note: String(noteText || ''), at: new Date().toISOString() };
    persistProfile(profile);
    return true;
  }

  // ─────────────────────────────── خروجی عمومی ───────────────────────────────
  window.Rosha = {
    STAGES: STAGES,
    MOUTHS: MOUTHS,
    mouthList: mouthList,
    classifyMouth: classifyMouth,
    buildWindow: buildWindow,
    stageByKey: stageByKey,
    getProfile: getProfile,
    persistProfile: persistProfile,
    listProfiles: listProfiles,
    applyEvent: applyEvent,
    nextTask: nextTask,
    morningSentence: morningSentence,
    morningLists: morningLists,
    relabel: relabel,
    skillState: skillState,
    childKeyOf: childKeyOf
  };

  console.log('✅ rosha-engine آماده شد — تک‌کودک، بی‌شبکه، ۹ دهان، پرونده روی دستگاه.');
})();
