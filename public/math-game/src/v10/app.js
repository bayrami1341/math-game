// Version 10.2.0 Client Application — Powered by Station Layer on top of v9 Core
// v10.2: تطبیق دامنهٔ سه بنا با کتاب کد ۳۰۵ + اطلس تشخیصی ۱۲خطا + کارت معلم
// (یک جمله + یک کد + دو نمونه + بازنویسی برچسب بدون تغییر نمره) + لایهٔ تصویری CPA
import { openLocal } from '../v9/local.mjs';
import { connectApi } from '../v9/connection.mjs';
import { loadFirebaseLogin, googleLogin, loginError } from '../v9/firebase-login.mjs';
import { studentKey, selectProfile } from '../v9/entry.mjs';
import {
  RULES_VERSION,
  QUESTION_SET_VERSION,
  CORE_SECTORS,
  DEPTH_LAYERS,
  SIDE_MISSIONS,
  UNLOCK_THRESHOLDS,
  generateSideMissionQuestions,
  stationSystems,
  stationPower,
  flightProgress,
  keepStationRecord,
  multiplicationModel
} from '../v9/experience.mjs';
import { toStationState } from './bridge.js';
import { buildLadder } from './station/ladder.js';
import {
  classifyAttempt,
  detectBehavioralCode,
  CODE_SENTENCES_FA,
  dominantCode
} from './station/errors.js';
// BP-022/M10 — مسیریاب یکنواخت attempt→v103→w8 (قرارداد M09: OPERATION-CONTRACT.json)
import {
  classifyCartridgeAttempt,
  atlasClaimForWrongOption,
  codeRegistryStatus,
  DEFAULT_BOOK_LIMITS
} from './station/errors-router.js';
import {
  createStationLayer,
  COLORS,
  BUILDINGS,
  BUILDING_NAMES,
  BUILDING_SENSATIONS,
  SOUND_EVENTS,
  renderBuildingSVG,
  renderPathSVG,
  renderCellSVG,
  renderEqualGroupsSVG
} from './station/index.js';
// خشاب محتوا (v10.3): فقط مصرف‌کنندهٔ لودر خشاب — بدون اثر بر موتور v10.2 (fail-closed)
// چندخشابی (v10.3.1): CARTRIDGE_ID فقط خشاب «پیش‌فرض» است؛ انتخاب کاربر از فهرست نصب‌شده‌ها می‌آید
import { loadCartridge, listAvailableCartridges } from './station/cartridge.js';
import { CARTRIDGE_ID } from './station/cartridge-schema.js';
// BP-016 فاز الف + BP-017 فاز ب/ج: موتور ۶-قالبی — قالب‌ها، پل کارتریج → نشست، نردبان قالبی
import {
  adaptCartridgeQuestions,
  checkCartridgeAnswer,
  effectiveFormat,
  formatHint,
  numberLineParams,
  FORMAT_MCQ,
  FORMAT_NUMBER,
  FORMAT_FRACTION,
  FORMAT_NUMBER_LINE,
  FORMAT_MATCHING,
  FORMAT_FIGURE,
  FORMAT_HINT_FORMATS
} from './station/answer-formats.js';

const $ = id => document.getElementById(id);
const config = window.MathGameV9Config || {};
const base = (config.apiBase || '').replace(/\/$/, '');
const fa = num => String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const normalizeDigits = val => String(val || '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
// تایپ زندهٔ فارسی: رقم لاتین/عربی همان لحظه فارسی می‌شود؛ نویسهٔ غیرمجاز حذف می‌شود.
// BP-016 فاز الف: «/» و فاصله برای ورودی کسر/مخلوط (مثلاً «۳/۴» یا «۱ ۱/۲») حفظ می‌شود —
// پارسر کسر (parseUserFraction) ارقام فارسی را می‌فهمد؛ جریان ضرب قدیمی بدون «/» دست‌نخورده است.
const fafyAnswerInput = val => String(val || '')
  .replace(/[0-9]/g, d => FA_DIGITS[Number(d)])
  .replace(/[٠-٩]/g, d => FA_DIGITS['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
  .replace(/[^۰-۹/ ]/g, '')
  .replace(/ {2,}/g, ' ')
  .replace(/\s*\/\s*/g, '/');

// گریز امن HTML برای ورودی آزاد معلم (یادداشت کارت)
const escHtml = val => String(val ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let local, actor, tokenProvider;
let state = {};
let serial = Promise.resolve();
let profiles = [];
let selectedId = null;
let profileMode = null; // null | 'create' — دروازهٔ پرونده (v10.1.3)
let soundEnabled = false;
let currentView = 'map'; // 'map' | 'question'
let activeQuestionIndex = 0;
let showGuide = false; // فقط راهنمای نقشه (map-guide-info) — راهنمای سؤال با نردبان محلی مدیریت می‌شود
let stationLayer = null;
// BP-017: وضعیت تعاملی قالب‌های ب/ج (محور عددی/زوج‌سازی/رنگ‌آمیزی) برای سؤال جاری
let cartridgeInteractive = null;

// ─── نردبان داربست ۷پله‌ای (CEAP §8) + ضد تکدی سرنخ (§3.2) ───
let hintLevel = 0;                 // پلهٔ جاری نردبان در سؤال جاری
let legacyGuideShown = false;      // fallback قدیمی (وقتی buildLadder null باشد)
let hintCooldownUntil = 0;         // مهر زمانی سرد شدن دکمهٔ راهنما
let hintCooldownTimer = null;      // id تایمر سرد شدن — در render بعدی پاک می‌شود
let questionStartedAt = 0;         // زمان‌سنجی سؤال جاری برای timeSec
let teacherClass = null;
let teacherMissions = []; // مأموریت‌های در انتظار معلم (از داشبورد — داشبورد اختیاری است)

const TEACHER_MISSION_TITLES = {
  'side-1-antenna': 'تعمیر آنتن فرعی',
  'side-2-backup': 'شارژ سلول پشتیبان',
  'side-3-fuel': 'تأمین سوخت اضافه'
};

// ─── پرونده‌های محلی (v10.1.3): ثبت‌نام بدون سرور — چند کودک روی یک دستگاه ───
const ROLE_META = Object.freeze({
  astronaut: { label: 'فضانورد', icon: '🧑‍🚀' },
  pilot: { label: 'خلبان', icon: '🧑‍✈️' },
  scientist: { label: 'دانشمند', icon: '🧑‍🔬' }
});
const UID_STORAGE_KEY = 'station_uid';
const SELECTED_STORAGE_KEY = 'station_selected_profile';
const PROFILES_INDEX_KEY = 'station_profiles_index';

// uid پایدار: در v10.1.2 با هر رفرش uid تازه ساخته می‌شد و کلید حافظه عوض می‌شد —
// نتیجه: پیشرفت کودک بعد از بستن مرورگر گم می‌شد. اکنون uid در localStorage می‌ماند.
function stableUid() {
  try {
    let uid = localStorage.getItem(UID_STORAGE_KEY);
    if (!uid) {
      uid = 'anon_student_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(UID_STORAGE_KEY, uid);
    }
    return uid;
  } catch {
    return 'anon_student_device'; // حافظهٔ محلی در دسترس نیست — حداقل درون یک نشست پایدار است
  }
}

function persistSelectedProfile() {
  try {
    if (selectedId) localStorage.setItem(SELECTED_STORAGE_KEY, selectedId);
    else localStorage.removeItem(SELECTED_STORAGE_KEY);
  } catch { /* حافظهٔ محلی اختیاری است */ }
}

async function loadProfiles() {
  try {
    const stored = await local.get(PROFILES_INDEX_KEY);
    profiles = Array.isArray(stored) ? stored : [];
  } catch {
    profiles = [];
  }
}

function roleMeta(profile) {
  return ROLE_META[profile?.role] || ROLE_META.astronaut;
}

// داستان خوش‌آمد (v10.1.3) — در لحن مجاز ایستگاه (station-brief)، بدون واژه‌های ممنوع
function welcomeLine(profile) {
  const role = roleMeta(profile);
  return `${role.icon} به ایستگاه خوش آمدی، ${profile.displayName}! تو ${role.label} ایستگاه هستی؛ سه بنا منتظر انرژیِ سلول‌های توئند.`;
}

// داستان کامل ایستگاه (v10.1.4): همیشه از طریق نوار ناوبری در دسترس است (دکمهٔ «📖 داستان ایستگاه»)
// لحن مجاز station-brief: جمله‌های کوتاه و عینی، بدون واژه‌های ممنوع
const STORY_NARRATIVE = Object.freeze([
  'تو نگهبان انرژی ایستگاه فضایی ضرب هستی.',
  'سه بنا روی تو حساب می‌کنند: نیروگاه چراغ‌ها را روشن می‌کند، برج ارتباط با زمین حرف می‌زند، و سکوی پرتاب بارها را آماده می‌کند.',
  'سوخت هر بنا فقط یک چیز است: ضرب درست. هر ضرب درست یک سلول انرژی را پر می‌کند.',
  'هر بنا سه لایه دارد. با دقت بالا، لایه‌های عمیق‌تر یکی‌یکی باز می‌شوند و بخش‌های تازهٔ ایستگاه روشن می‌شود.',
  'سه مأموریت جانبی هم داری: تعمیر آنتن فرعی، شارژ سلول پشتیبان و تأمین سوخت اضافه. این‌ها تمرین بیشترند و به قدرت ایستگاه نمره اضافه نمی‌کنند.',
  'می‌توانی با «🔊 سؤال» هر ضرب را برایت بخوانند و با «💡 راهنما» پله‌پله جلو بروی. اشتباه شد؟ نردبان راهنما خودش بالا می‌آید.',
  'ایستگاه منتظر توست. آرام و با دقت، سلول‌به‌سلول.'
]);

// پنجرهٔ داستان (v10.1.4): رندر داستان کامل ایستگاه
function openStoryDialog() {
  const content = $('story-content');
  if (content) content.innerHTML = STORY_NARRATIVE.map(p => `<p>${p}</p>`).join('');
  const dialog = $('story-dialog');
  if (dialog) dialog.hidden = false;
}

function renderProfileButtons() {
  const box = $('profile-buttons');
  if (!box) return;
  box.innerHTML = profiles.map(p => {
    const role = roleMeta(p);
    return `<button type="button" class="secondary-button profile-button" data-profile-id="${p.studentId}">`
      + `<span aria-hidden="true">${role.icon}</span> ${p.displayName} <span class="profile-role">${role.label}</span>`
      + `</button>`;
  }).join('');
}

const playStationAudio = async (kind) => {
  if (!soundEnabled || !stationLayer?.soundPlayer) return;
  try {
    await stationLayer.soundPlayer(kind);
  } catch {
    // Audio failure must never stop game progress
  }
};

function notice(message, isError = false) {
  const el = $('notice');
  if (!el) return;
  el.textContent = message;
  el.dataset.error = String(isError);
  el.hidden = !message;
}

// ─── مأموریت‌های معلم (برداشت از داشبورد — اگر داشبورد نباشد، بی‌صدا رد می‌شود) ───
async function refreshTeacherMissions() {
  try {
    const profile = profiles.find(p => p.studentId === selectedId);
    if (!profile || typeof fetch !== 'function') return;
    const res = await fetch('/api/assignments?studentName=' + encodeURIComponent(profile.displayName) + '&status=pending');
    if (!res.ok) return;
    const data = await res.json();
    teacherMissions = Array.isArray(data.assignments) ? data.assignments : [];
    renderTeacherMissions();
  } catch { /* داشبورد اختیاری است */ }
}

function renderTeacherMissions() {
  const row = $('sheet-teacher-missions');
  if (!row) return;
  const pending = teacherMissions.filter(m => m.status === 'pending');
  if (!pending.length) {
    row.hidden = true;
    row.innerHTML = '';
    return;
  }
  row.hidden = false;
  row.innerHTML = pending.map(m => `
    <button type="button" class="side-mission-button teacher-mission-button" data-assignment-id="${m.id}" data-mission-id="${m.missionId}" aria-label="مأموریت معلم: ${m.missionTitle || TEACHER_MISSION_TITLES[m.missionId] || ''}">
      <span class="side-mission-icon">📌</span>
      <span>از معلم: ${m.missionTitle || TEACHER_MISSION_TITLES[m.missionId] || 'مأموریت تمرینی'}</span>
      <span class="side-mission-note">${m.note ? m.note : fa(5) + ' سؤال تمرینی'}</span>
    </button>
  `).join('');
}

// ─── خواندن صوتی (TTS فارسی — v10.1.2): اول API داشبورد، در نبودش صدای محلی مرورگر ───
const DIGIT_WORDS = ['صفر', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده', 'یازده', 'دوازده'];
const speakCache = new Map();
let speakingBusy = false;

// fallback محلی: Web Speech API خود مرورگر (fa-IR) — در استقرار مستقل (گیت‌هاب Pages) هم کار می‌کند؛
// اگر صدای فارسی نصب نباشد، موتور پیش‌فرض تلاش می‌کند و در بدترین حالت بی‌صدا می‌ماند.
function localSpeak(text) {
  return new Promise(resolve => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve(false);
      const synth = window.speechSynthesis;
      try { synth.cancel(); } catch { /* بی‌اهمیت */ }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fa-IR';
      u.rate = 0.9;
      const voices = typeof synth.getVoices === 'function' ? (synth.getVoices() || []) : [];
      const faVoice = voices.find(v => v && /^fa/i.test(v.lang || ''));
      if (faVoice) u.voice = faVoice;
      let settled = false;
      const done = ok => { if (!settled) { settled = true; resolve(ok); } };
      u.onend = () => done(true);
      u.onerror = () => done(false);
      synth.speak(u);
      setTimeout(() => done(true), 20000); // محافظ: اگر رویداد end/error نیامد
    } catch { resolve(false); }
  });
}

// گویندهٔ مشترک: صدا از API داشبورد (اگر در دسترس بود) → وگرنه صدای محلی مرورگر → وگرنه بی‌صدا.
// فقط URLهای موفق کش می‌شوند تا شکست API در تلاش بعدی دوباره امتحان شود.
async function speakFa(text, btn = null) {
  if (!text || speakingBusy) return;
  speakingBusy = true;
  const prevLabel = btn ? btn.textContent : null;
  if (btn) btn.textContent = '... در حال خواندن';
  try {
    let url = speakCache.get(text) || null;
    if (!url && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, speed: 0.9 })
        });
        if (res.ok) {
          url = URL.createObjectURL(await res.blob());
          speakCache.set(text, url);
        }
      } catch { /* داشبورد در دسترس نیست — fallback محلی */ }
    }
    if (url) {
      await new Audio(url).play();
    } else {
      const ok = await localSpeak(text);
      if (!ok && btn && btn.id === 'question-speak') notice('خواندن صوتی در دسترس نیست.', true);
    }
  } catch { /* TTS اختیاری است — بی‌صدا */ }
  finally {
    speakingBusy = false;
    if (btn && prevLabel) btn.textContent = prevLabel;
  }
}

async function speakCurrentQuestion() {
  const session = state.session;
  const question = session?.questions?.[activeQuestionIndex];
  const btn = $('question-speak');
  if (!question || !btn) return;
  // BP-017: سؤال کارتریجی — صورت کتاب خودش خوانده می‌شود (فاز الف/ب/ج)
  if (question.prompt) {
    await speakFa(String(question.prompt), btn);
    return;
  }
  const w1 = DIGIT_WORDS[Math.min(12, Math.max(0, question.f1))] ?? String(question.f1);
  const w2 = DIGIT_WORDS[Math.min(12, Math.max(0, question.f2))] ?? String(question.f2);
  await speakFa(`${w1} ضربدر ${w2} چند می‌شود؟`, btn);
}

const accountKey = () => 'profile:' + actor.uid;
const profileStorageKey = () => actor.teacher || !selectedId ? accountKey() : studentKey(actor.uid, selectedId);

function run(task) {
  serial = serial.then(async () => {
    const buttons = [...document.querySelectorAll('button')];
    buttons.forEach(b => { b.disabled = true; });
    try {
      await task();
    } catch (err) {
      notice(err.message || 'عملیات انجام نشد.', true);
    } finally {
      document.querySelectorAll('button').forEach(b => { b.disabled = false; });
    }
  });
  return serial;
}

async function saveState(nextState) {
  await local.put(profileStorageKey(), nextState);
  state = nextState;
}

function refreshStationLayer() {
  const stationState = toStationState(state.session, state.stationRecords || []);
  stationLayer = createStationLayer({
    stationState,
    session: state.session,
    playSound: playStationAudio
  });
  return stationState;
}

function render() {
  const stationState = refreshStationLayer();
  const profile = profiles.find(p => p.studentId === selectedId);

  if (!profile) {
    // دروازهٔ پرونده (v10.1.3): ساخت پروندهٔ تازه یا انتخاب پرونده‌های همین دستگاه
    const showCreate = profileMode === 'create' || profiles.length === 0;
    $('login-card').hidden = !showCreate;
    $('profile-picker').hidden = showCreate || !profiles.length;
    if (!showCreate) renderProfileButtons();
    $('workspace').hidden = true;
    $('switch-profile-button').hidden = true;
    $('identity-display').textContent = 'ایستگاه ضرب';
    return;
  }

  $('login-card').hidden = true;
  $('profile-picker').hidden = true;
  $('workspace').hidden = false;
  $('switch-profile-button').hidden = false;
  $('identity-display').textContent = `${roleMeta(profile).icon} ${profile.displayName}`;

  $('teacher-shell').hidden = true;
  $('child-shell').hidden = false;

  renderChildShell(stationState);
}

function renderTeacherShell() {
  $('teacher-summary').textContent = teacherClass
    ? `کلاس: ${teacherClass.name} — اعضا: ${fa(teacherClass.members?.length || 0)} نفر`
    : 'یک کلاس را برای بررسی انتخاب کنید.';
}

// خط پیشرفت (v10.1.3): درصد هر بنا + آستانهٔ واقعی لایهٔ بعدی از DEPTH_LAYERS
function buildProgressLine(systemsNow) {
  if (!systemsNow?.length) return '';
  const parts = systemsNow.map(s => {
    const current = s.currentDepth || 0;
    const nextDepth = Math.min(3, current + 1);
    const layer = DEPTH_LAYERS[`${s.sectorId}-${nextDepth}`];
    const need = nextDepth > current ? layer?.unlock?.minPercent : null;
    const suffix = need ? ` (لایهٔ ${fa(nextDepth)} با ${fa(need)}٪)` : '';
    return `${BUILDING_NAMES[s.sectorId] || 'بنا'}: ${fa(s.percent)}٪${suffix}`;
  });
  return `📍 پیشرفت ایستگاه — ${parts.join(' • ')}`;
}

// تابلوی افتخارات محلی (v10.1.3): بهترین دستاوردهای پرونده‌های همین دستگاه — کاملاً آفلاین
async function refreshLocalBoard() {
  const entriesEl = $('board-entries');
  const statusEl = $('board-status');
  if (!entriesEl) return;
  if (!profiles.length) {
    entriesEl.innerHTML = '';
    if (statusEl) statusEl.textContent = 'هنوز پرونده‌ای ساخته نشده است.';
    return;
  }
  const rows = [];
  for (const p of profiles) {
    let records = [];
    try {
      const stored = await local.get(studentKey(actor.uid, p.studentId));
      records = stored?.stationRecords || [];
    } catch { records = []; }
    rows.push({ profile: p, power: stationPower(records), systems: stationSystems(records) });
  }
  rows.sort((a, b) => b.power - a.power);
  if (statusEl) {
    statusEl.textContent = `بهترین دستاوردهای پرونده‌های همین دستگاه — بر پایهٔ قدرت کلی ایستگاه (${fa(rows.length)} پرونده)`;
  }
  entriesEl.innerHTML = rows.map((row, i) => {
    const role = roleMeta(row.profile);
    const medal = ['🥇', '🥈', '🥉'][i] || `${fa(i + 1)}.`;
    const sectors = row.systems.map(s =>
      `<span class="board-sector-chip">${BUILDING_NAMES[s.sectorId] || ''} ${fa(s.percent)}٪${s.currentDepth ? ` · لایهٔ ${fa(s.currentDepth)}` : ''}</span>`
    ).join(' ');
    return `<li class="board-row">
      <span class="board-rank" aria-hidden="true">${medal}</span>
      <span class="board-name">${role.icon} ${row.profile.displayName}</span>
      <span class="board-power">قدرت ایستگاه: ${fa(row.power)}٪</span>
      <span class="board-sectors">${sectors}</span>
    </li>`;
  }).join('');
}

// پنل معلم (v10.1.4): گزارش آفلاین همین دستگاه — برای معلم/والد کنار کودک
// شامل: قدرت ایستگاه، درصد هر بنا، وضعیت ۹ لایهٔ عمق (باز/قفل/شرط بازشدن)، جلسه‌ها، خطاها، مأموریت‌های معلم
// برچسب‌های بازنویسی کارت معلم (سند فصل ۵): بدون تغییر نمره، پاسخ پذیرفته و قفل بنا
const RELABEL_LABELS_FA = Object.freeze({
  confirmed: 'تأییدشده',
  'case-slip': 'لغزش موردی',
  rejected: 'ردشده'
});

// کارت معلم (v10.2 — سند فصل ۵): یک جمله + یک کد + نمونه‌های واقعی + بازنویسی برچسب
function buildTeacherErrorCards(profileId, attempts, overrides) {
  const flagged = (attempts || [])
    .filter(a => a?.wrongCodes && dominantCode(a.wrongCodes))
    .slice(-6)
    .reverse();
  if (!flagged.length) return '';
  const cards = flagged.map(a => {
    const code = dominantCode(a.wrongCodes);
    const sentence = CODE_SENTENCES_FA[code] || 'الگوی روشنی پیدا نشد.';
    const key = `${profileId}:${a.eventId}`;
    const ov = overrides?.[key];
    const examples = (a.wrongExamples || [])
      .map(w => (Number.isFinite(w?.f1) && Number.isFinite(w?.f2))
        ? `${fa(w.f1)}×${fa(w.f2)} را ${fa(w.submitted)} نوشته`
        // BP-017: سؤال‌های قالبی (فاز ب/ج) عامل عددی ندارند — نمونهٔ صادقانه با قالب/زیرقالب
        : `تمرین ${w?.format || 'کتاب'}${w?.subkind ? ` (${w.subkind})` : ''} — پاسخ: ${w?.submittedRaw ?? '—'}`)
      .join(' • ');
    const labelChip = ov?.label
      ? `<span class="teacher-label-chip teacher-label-${ov.label}">${RELABEL_LABELS_FA[ov.label] || ''}</span>`
      : '';
    return `<div class="teacher-error-card">
      <p class="teacher-error-headline">${escHtml(sentence)} کد: <strong>${code}</strong>${labelChip}</p>
      ${examples ? `<p class="teacher-error-examples">${escHtml(examples)}.</p>` : ''}
      <p class="teacher-error-meta">${BUILDING_NAMES[a.sectorId] || 'بنا'}${a.depth ? ` — لایهٔ ${fa(a.depth)}` : ''}${a.type === 'side' ? ' — تمرین جانبی' : ''}</p>
      ${ov?.note ? `<p class="teacher-error-note">یادداشت: ${escHtml(ov.note)}</p>` : ''}
      <div class="teacher-relabel-row" role="group" aria-label="بازنویسی برچسب خطا">
        <button type="button" data-relabel="confirmed" data-profile-id="${profileId}" data-event-id="${a.eventId}" class="${ov?.label === 'confirmed' ? 'active' : ''}">تأیید تشخیص</button>
        <button type="button" data-relabel="case-slip" data-profile-id="${profileId}" data-event-id="${a.eventId}" class="${ov?.label === 'case-slip' ? 'active' : ''}">لغزش موردی</button>
        <button type="button" data-relabel="rejected" data-profile-id="${profileId}" data-event-id="${a.eventId}" class="${ov?.label === 'rejected' ? 'active' : ''}">رد تشخیص</button>
      </div>
      <input type="text" class="teacher-note-input" data-note-id="${a.eventId}" data-profile-id="${profileId}" value="${escHtml(ov?.note || '')}" maxlength="200" placeholder="یادداشت معلم (اختیاری)">
    </div>`;
  }).join('');
  return `<div class="teacher-cards"><h5>کارت‌های تشخیصی جلسه‌ها</h5>${cards}</div>`;
}

async function renderTeacherPanel() {
  const box = $('teacher-panel-content');
  if (!box) return;
  if (!profiles.length) {
    box.innerHTML = '<p class="teacher-note">هنوز پرونده‌ای روی این دستگاه ساخته نشده است.</p>';
    return;
  }
  const pending = teacherMissions.length;
  let html = pending
    ? `<p class="teacher-note">📌 ${fa(pending)} مأموریت از داشبورد معلم در انتظار برداشتن است.</p>`
    : '';
  for (const p of profiles) {
    let stored = null;
    try { stored = await local.get(studentKey(actor.uid, p.studentId)); } catch { stored = null; }
    const records = stored?.stationRecords || [];
    const attempts = stored?.attemptLog || [];
    const wrongTotal = attempts.reduce((sum, a) => sum + (a?.wrongCount || 0), 0);
    const sideSessions = attempts.filter(a => a?.type === 'side').length;
    const systems = stationSystems(records);
    const layersHtml = [1, 2, 3].map(id => {
      const sys = systems.find(s => s.sectorId === id);
      const pct = sys?.percent || 0;
      const cur = sys?.currentDepth || 0;
      const rows = [1, 2, 3].map(d => {
        const layer = DEPTH_LAYERS[`${id}-${d}`];
        const need = layer?.unlock?.minPercent;
        const stateTxt = cur >= d
          ? '✅ باز'
          : d === 1
            ? '🟢 باز — همین حالا در دسترس است' // لایهٔ ورودی هر بنا آستانه ندارد
            : (cur + 1 === d ? `🔓 با ${fa(need)}٪ دقت باز می‌شود` : '🔒 قفل');
        return `<li>لایهٔ ${fa(d)} — ${stateTxt}</li>`;
      }).join('');
      return `<div class="teacher-building"><strong>${BUILDING_NAMES[id] || 'بنا'}: ${fa(pct)}٪</strong><ul>${rows}</ul></div>`;
    }).join('');
    const errorCardsHtml = buildTeacherErrorCards(p.studentId, attempts, state.errorOverrides);
    html += `
      <div class="teacher-report-card">
        <h4>${roleMeta(p).icon} ${escHtml(p.displayName)} — قدرت ایستگاه: ${fa(stationPower(records))}٪</h4>
        <p class="teacher-stats">جلسهٔ تمام‌شده: ${fa(attempts.length)} • خطای ثبت‌شده: ${fa(wrongTotal)} • تمرین جانبی: ${fa(sideSessions)} جلسه</p>
        ${layersHtml}
        ${errorCardsHtml}
      </div>`;
  }
  html += `
    <p class="teacher-note">💡 «داشبورد کامل معلم» (ارسال مأموریت، تحلیل خطاها، مدیریت کلاس) در پلتفرم «کارگاه ضرب» اجرا می‌شود و این نسخهٔ مستقل به آن وصل نیست. تاریخچهٔ کامل پاسخ‌ها (تلاش‌نگار) روی همین دستگاه ذخیره می‌شود و همین‌جا قابل مرور است. برچسب خطا پیشنهاد است؛ تصمیم نهایی با آموزگار — بازنویسی برچسب نمره و قفل بنا را عوض نمی‌کند.</p>`;
  box.innerHTML = html;
}

function renderChildShell(stationState) {
  const { map, sheet } = stationLayer;
  const isFinished = map.isAllDone();

  $('station-map-view').hidden = currentView !== 'map';
  $('question-view').hidden = currentView !== 'question';

  if (currentView === 'map') {
    const powerState = map.getBuildingState(BUILDINGS.POWER);
    const towerState = map.getBuildingState(BUILDINGS.TOWER);
    const padState = map.getBuildingState(BUILDINGS.PAD);
    const systemsNow = stationSystems(state.stationRecords || []);

    // چیپ شرط قفل روی نقشه (v10.2): «چرا بسته است» پنهان نمی‌ماند
    const lockNote = (id, bState) => {
      if (bState !== 'locked') return '';
      const prereq = id === BUILDINGS.TOWER ? BUILDINGS.POWER : BUILDINGS.TOWER;
      const sys = systemsNow.find(s => s.sectorId === prereq);
      const layerLeft = sys ? Math.min(3, (sys.currentDepth || 0) + 1) : 1;
      return `<p class="building-lock-note">نیاز: هر سه لایهٔ ${BUILDING_NAMES[prereq]} کامل شود (الان لایهٔ ${fa(layerLeft)} — ${fa(sys?.percent || 0)}٪)</p>`;
    };

    $('building-power').innerHTML = renderBuildingSVG(BUILDINGS.POWER, powerState) + lockNote(BUILDINGS.POWER, powerState);
    $('building-power').dataset.state = powerState;

    $('building-tower').innerHTML = renderBuildingSVG(BUILDINGS.TOWER, towerState) + lockNote(BUILDINGS.TOWER, towerState);
    $('building-tower').dataset.state = towerState;

    $('building-pad').innerHTML = renderBuildingSVG(BUILDINGS.PAD, padState) + lockNote(BUILDINGS.PAD, padState);
    $('building-pad').dataset.state = padState;

    $('path-1').innerHTML = renderPathSVG(1, map.getPathState(1));
    $('path-2').innerHTML = renderPathSVG(2, map.getPathState(2));

    // داستان خوش‌آمد (v10.1.3): در نخستین ورود، داستان ایستگاه با نام و نقش کودک روایت می‌شود
    const profileNow = profiles.find(p => p.studentId === selectedId);
    const hasProgress = (state.stationRecords || []).length > 0 || !!state.session;
    $('sheet-text').textContent = (!hasProgress && profileNow)
      ? `${welcomeLine(profileNow)} ${sheet.getSheetText()}`
      : sheet.getSheetText();

    // خط پیشرفت (v10.1.3): مسیر بازشدن تدریجی را «دیده‌پذیر» می‌کند
    $('sheet-progress').textContent = buildProgressLine(systemsNow);

    // Side Missions: render unlocked side-mission buttons (affectsLeaderboard: false)
    const sideButtons = sheet.getSideMissionButtons();
    const sideRow = $('sheet-side-missions');
    const unlockedHtml = sideButtons.map(m => `
      <button type="button" class="side-mission-button" data-mission-id="${m.id}" aria-label="${m.title}">
        <span class="side-mission-icon">${m.icon}</span>
        <span>${m.title}</span>
        <span class="side-mission-note">${fa(m.questionCount)} سؤال تمرینی</span>
      </button>
    `).join('');
    // مأموریت‌های قفل‌شده (v10.1.3): محتوای پنهان دیگر مخفی نیست — چرا و با چه شرطی باز می‌شود
    const unlockedIds = new Set(sideButtons.map(m => m.id));
    const lockedHtml = Object.values(SIDE_MISSIONS)
      .filter(m => !unlockedIds.has(m.id))
      .map(m => {
        const need = fa(m.unlock?.minPercent ?? UNLOCK_THRESHOLDS.side);
        const buildingName = BUILDING_NAMES[m.parentSectorId] || 'نیروگاه';
        return `
          <button type="button" class="side-mission-button side-mission-locked" aria-disabled="true" aria-label="قفل: ${m.title}">
            <span class="side-mission-icon">🔒</span>
            <span>${m.title}</span>
            <span class="side-mission-note">با ${need}٪ دقتِ ${buildingName} باز می‌شود</span>
          </button>
        `;
      }).join('');
    if (unlockedHtml || lockedHtml) {
      sideRow.hidden = false;
      sideRow.innerHTML = unlockedHtml + lockedHtml;
    } else {
      sideRow.hidden = true;
      sideRow.innerHTML = '';
    }

    // Teacher Missions: رندر مأموریت‌های در انتظار معلم (اگر باشند)
    renderTeacherMissions();

    const mainBtnLabel = sheet.getMainButtonLabel();
    const mainBtn = $('sheet-main-button');
    if (mainBtnLabel) {
      mainBtn.hidden = false;
      mainBtn.textContent = mainBtnLabel;
    } else {
      mainBtn.hidden = true;
    }

    $('map-guide-button').hidden = isFinished;
    $('map-guide-info').hidden = !showGuide;
  } else if (currentView === 'question') {
    renderQuestionView();
  }
}

// ─── نردبان راهنمای سؤال: عنوان دکمه، سرد شدن، و رندر ناحیهٔ راهنما ───
const guideButtonLabel = () => `💡 راهنما (گام ${fa(hintLevel)} از ${fa(7)})`;

function clearHintCooldownTimer() {
  if (hintCooldownTimer) {
    clearTimeout(hintCooldownTimer);
    hintCooldownTimer = null;
  }
}

// سرد شدن افزایشی (CEAP §3.2 — ضد تکدی سرنخ): پس از پلهٔ ۲ ← ۵ ثانیه، پس از پلهٔ ۴ ← ۱۰ ثانیه
function applyHintCooldown(seconds) {
  hintCooldownUntil = Date.now() + seconds * 1000;
  const btn = $('question-guide-button');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'کمی صبر…';
  clearHintCooldownTimer();
  hintCooldownTimer = setTimeout(() => {
    hintCooldownTimer = null;
    hintCooldownUntil = 0;
    const b = $('question-guide-button');
    if (!b || currentView !== 'question') return; // سؤال عوض شده؛ render بعدی خودش می‌چیند
    b.disabled = false;
    b.textContent = guideButtonLabel();
  }, seconds * 1000);
}

// رندر ناحیهٔ راهنمای سؤال بر اساس وضعیت محلی (نردبان، نردبان قالبی، یا fallback قدیمی)
function renderGuideArea(question) {
  const area = $('question-guide-area');
  if (!area) return;
  // BP-017 T4 — سؤال کارتریجی قالبی (محور عددی/زوج‌سازی/شکل-نمودار): نردبان formatHint
  if (question?.prompt && FORMAT_HINT_FORMATS.includes(question.answerFormat)) {
    if (hintLevel > 0) {
      const stepText = formatHint(question.answerFormat, question, hintLevel - 1);
      if (stepText) {
        area.hidden = false;
        area.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'guide-box';
        p.textContent = stepText;
        area.append(p);
        return;
      }
    }
    area.hidden = true;
    area.innerHTML = '';
    return;
  }

  const ladder = question ? buildLadder({ f1: question.f1, f2: question.f2 }) : null;

  if (ladder && hintLevel > 0) {
    const step = ladder[hintLevel - 1];
    if (step) {
      area.hidden = false;
      let html = `<p class="guide-box">${step.textFa}</p>`;
      if (step.visual === 'equal-groups') {
        html += renderEqualGroupsSVG(question.f1, question.f2);
      }
      area.innerHTML = html;
      return;
    }
  }

  if (!ladder && legacyGuideShown) {
    // fallback امن: راهنمای یک‌پله‌ای قدیمی (createQuestionGuide) — رفتار قبل
    const qGuide = stationLayer.guide.createQuestionGuide(question);
    area.hidden = false;
    area.innerHTML = qGuide ? renderEqualGroupsSVG(qGuide.groupsCount, qGuide.itemsPerGroup) : '';
    return;
  }

  area.hidden = true;
  area.innerHTML = '';
}

// یک پله بالا رفتن نردبان + رندر + اعلام صوتی پله (v10.1.2) — نقطهٔ مشترک دکمهٔ راهنما و نردبان خودکار
function showGuideStepUp(question) {
  // BP-017 T4 — نردبان قالبی برای قالب‌های ب/ج (formatHint خالص از answer-formats)
  if (question?.prompt && FORMAT_HINT_FORMATS.includes(question.answerFormat)) {
    renderGuideArea(question);
    const btn = $('question-guide-button');
    if (btn) btn.textContent = guideButtonLabel();
    const stepText = formatHint(question.answerFormat, question, Math.max(0, hintLevel - 1));
    if (stepText) void speakFa(stepText);
    return { formatHint: true };
  }
  const ladder = buildLadder({ f1: question.f1, f2: question.f2 });
  if (ladder) {
    legacyGuideShown = false;
  } else {
    // fallback امن: راهنمای یک‌پله‌ای قدیمی با toggle محلی (نه showGuide نقشه)
    legacyGuideShown = !legacyGuideShown;
  }
  renderGuideArea(question);
  const btn = $('question-guide-button');
  if (btn) btn.textContent = guideButtonLabel();
  if (ladder && hintLevel > 0) {
    const stepText = ladder[hintLevel - 1]?.textFa;
    if (stepText) void speakFa(stepText);
  }
  return ladder;
}

function renderQuestionView() {
  const session = state.session;
  const questions = session?.questions || [];
  const question = questions[activeQuestionIndex];

  if (!question) {
    currentView = 'map';
    render();
    return;
  }

  const buildingId = session.sectorId || 1;
  const depth = session.depth || 1;
  const mission = session.missionId ? SIDE_MISSIONS[session.missionId] : null;
  $('question-building-name').textContent = mission
    ? `${mission.icon} ${mission.title} (تمرین جانبی)`
    : `${BUILDING_NAMES[buildingId]} (لایهٔ ${fa(depth)})`;
  $('question-sensation').textContent = BUILDING_SENSATIONS[buildingId] || '';

  const total = questions.length;
  const currentAccepted = stationLayer.cells.getAcceptedCount();
  let cellsHtml = '';
  for (let i = 0; i < total; i++) {
    cellsHtml += renderCellSVG(i < currentAccepted);
  }
  $('question-cells').innerHTML = cellsHtml;

  // لایهٔ تصویری CPA (v10.2 فصل ۱.۲ سند): سؤال‌های لایه‌های اول همراه دسته‌های مساوی می‌آیند
  const visEl = $('question-visual');
  if (visEl) {
    const canVisual = question.visual === 'equal-groups'
      && question.f1 > 0 && question.f2 > 0 && question.f1 * question.f2 <= 60;
    visEl.hidden = !canVisual;
    visEl.innerHTML = canVisual ? renderEqualGroupsSVG(question.f1, question.f2) : '';
  }

  // BP-016 فاز الف — سؤال کارتریجی: صورت کتاب + قالب پاسخ (گزینه‌ای/عدد/کسر)
  if (question.prompt) {
    $('question-building-name').textContent = `📦 تمرین خشاب ${session.cartridgeId || 'کتاب'}`;
    $('question-sensation').textContent = 'تمرین با سؤال‌های کتاب درسی';
    if (visEl) { visEl.hidden = true; visEl.innerHTML = ''; }
    $('question-equation').textContent = question.prompt; // textContent = ایمن در برابر تزریق
    configureAnswerArea(question);
    hintLevel = 0;
    legacyGuideShown = false;
    hintCooldownUntil = 0;
    clearHintCooldownTimer();
    questionStartedAt = Date.now();
    const cartridgeGuideBtn = $('question-guide-button');
    if (cartridgeGuideBtn) {
      cartridgeGuideBtn.disabled = false;
      cartridgeGuideBtn.textContent = guideButtonLabel();
      cartridgeGuideBtn.classList.remove('attract');
    }
    renderGuideArea(question);
    return;
  }

  $('question-equation').textContent = `${fa(question.f1)} × ${fa(question.f2)} = ؟`;
  $('answer-input').value = '';
  $('answer-input').focus();

  // سؤال جدید: نردبان از پلهٔ صفر، دکمهٔ راهنما فعال، زمان‌سنجی از نو
  hintLevel = 0;
  legacyGuideShown = false;
  hintCooldownUntil = 0;
  clearHintCooldownTimer();
  questionStartedAt = Date.now();
  const guideBtn = $('question-guide-button');
  if (guideBtn) {
    guideBtn.disabled = false;
    guideBtn.textContent = guideButtonLabel();
    guideBtn.classList.remove('attract');
  }
  renderGuideArea(question);
}

// ─── BP-016 فاز الف: قالب‌های پاسخ کارتریج (گزینه‌ای/عدد/کسر) ─────────────────

const OPTION_LETTERS_FA = ['الف', 'ب', 'ج', 'د'];

// ─── BP-017 فاز ب/ج: رندر تعاملی محور عددی/زوج‌سازی/شکل-نمودار ───
// همهٔ رندرها با DOM API و textContent چیده می‌شوند (بدون innerHTML برای دادهٔ خشاب — ضدتزریق)
// CSS پایه از کلاس‌های موجود (.answer-option و…) + استایل درون‌خطی — فایل CSS خارج از قلمرو این تسک است.

const ACCENT = '126, 240, 255'; // رنگ تأکید هم‌خانوادهٔ تم (cyan)
const WRONG_COLOR = '#ff9b8a'; // قرمز ملایمِ فلش جفت غلط

/** سازندهٔ کمکی نود SVG */
function svgNode(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** محور عددی (T1): SVG خط‌کش مقیاس‌دار + دکمه‌های درجه (هدف لمسی ۴۴px) */
function buildNumberLineArea(question, state) {
  const params = question.numberLine || numberLineParams(question);
  const wrap = document.createElement('div');
  if (!params) {
    const note = document.createElement('p');
    note.textContent = 'پارامترهای محور عددی این سؤال کامل نیست — به ناظر محتوا گزارش شود.';
    wrap.append(note);
    return wrap;
  }
  const pitch = 40;
  const W = params.ticks * pitch + 40;
  const svg = svgNode('svg', {
    viewBox: `0 0 ${W} 64`, width: '100%', style: `max-width:${W}px;display:block;margin:0 auto;`,
    role: 'img', 'aria-label': `محور عددی از ${fa(params.min)} تا ${fa(params.max)}`
  });
  const y = 26;
  svg.append(svgNode('line', { x1: 16, y1: y, x2: W - 16, y2: y, stroke: `rgba(${ACCENT},0.75)`, 'stroke-width': 2 }));
  svg.append(svgNode('polygon', { points: `${W - 16},${y - 5} ${W - 6},${y} ${W - 16},${y + 5}`, fill: `rgba(${ACCENT},0.75)` }));

  const applySelection = () => {
    for (const t of state.tickEls) {
      const on = state.value !== null && t.value === state.value;
      t.circle.setAttribute('fill', on ? `rgba(${ACCENT},0.9)` : `rgba(${ACCENT},0.1)`);
      t.circle.setAttribute('stroke', on ? `rgba(${ACCENT},1)` : `rgba(${ACCENT},0.6)`);
      t.circle.setAttribute('r', on ? '8' : '6');
      t.button.setAttribute('aria-pressed', on ? 'true' : 'false');
      t.button.style.background = on ? `rgba(${ACCENT},0.18)` : '';
      t.button.style.borderColor = on ? `rgba(${ACCENT},0.85)` : '';
    }
  };
  for (let i = 0; i <= params.ticks; i++) {
    const value = params.min + i * params.step;
    const x = 20 + i * pitch;
    svg.append(svgNode('line', { x1: x, y1: y - 6, x2: x, y2: y + 6, stroke: `rgba(${ACCENT},0.75)`, 'stroke-width': 2 }));
    const label = svgNode('text', { x, y: y + 26, 'text-anchor': 'middle', 'font-size': 13, fill: 'currentColor' });
    label.textContent = fa(value);
    svg.append(label);
    const circle = svgNode('circle', { cx: x, cy: y, r: 6, fill: `rgba(${ACCENT},0.1)`, stroke: `rgba(${ACCENT},0.6)`, 'stroke-width': 2, style: 'cursor:pointer;' });
    const press = () => { state.value = value; applySelection(); };
    circle.addEventListener('click', press);
    // دسترس‌پذیری کیبورد روی خود SVG
    circle.setAttribute('tabindex', '0');
    circle.setAttribute('role', 'button');
    circle.setAttribute('aria-label', `نقطهٔ ${fa(value)}`);
    circle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(); }
    });
    svg.append(circle);
    state.tickEls.push({ value, circle, button: null });
  }
  wrap.append(svg);

  // دکمه‌های درجه — مسیر دسترس‌پذیر/لمسی (حداقل ۴۴px)
  const row = document.createElement('div');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'درجه‌های محور عددی');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0 4px;';
  for (let i = 0; i <= params.ticks; i++) {
    const value = params.min + i * params.step;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-option';
    btn.style.cssText = 'flex:0 1 auto;min-width:44px;justify-content:center;padding:8px 10px;';
    btn.textContent = fa(value);
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', `انتخاب نقطهٔ ${fa(value)}`);
    btn.addEventListener('click', () => { state.value = value; applySelection(); });
    row.append(btn);
    state.tickEls[i].button = btn;
  }
  wrap.append(row);

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'primary-button';
  send.textContent = 'ثبت نقطهٔ انتخاب‌شده';
  send.addEventListener('click', () => {
    if (state.value === null) {
      $('question-feedback').textContent = 'اول یک نقطه روی محور انتخاب کن.';
      return;
    }
    void handleAnswerSubmit(state.value);
  });
  wrap.append(send);
  return wrap;
}

/** زوج‌سازی (T2): دو ستون دکمه‌ای — چپ ثابت، راست شافل؛ جفت درست می‌ماند، غلط فلش قرمز */
function buildMatchingArea(question, state) {
  const matches = question.matches || [];
  const wrap = document.createElement('div');
  // دادهٔ نمایشی محلی — session.questions هرگز با نودهای DOM آلوده نمی‌شود
  const items = matches.map((m, i) => ({ left: String(m.left), right: String(m.right), leftIdx: i, btnL: null, btnR: null }));
  // شافل نمایشی ستون راست — ایندکس اصلی حفظ می‌شود (قرارداد سنجش: جفت درست leftIdx=rightIdx)
  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  state.order = order;

  const status = document.createElement('p');
  status.className = 'question-feedback';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.cssText = 'font-size:12px;margin:2px 0;';
  state.statusEl = status;

  const board = document.createElement('div');
  board.style.cssText = 'display:flex;gap:10px;width:100%;';
  const colL = document.createElement('div');
  const colR = document.createElement('div');
  colL.style.cssText = 'flex:1 1 0;display:flex;flex-direction:column;gap:8px;';
  colR.style.cssText = 'flex:1 1 0;display:flex;flex-direction:column;gap:8px;';
  board.append(colL, colR);

  let sendBtn = null;

  const applyPairState = () => {
    for (const m of items) {
      const paired = state.pairs.some(p => p[0] === m.leftIdx);
      m.btnL.disabled = paired;
      m.btnR.disabled = paired;
      for (const b of [m.btnL, m.btnR]) {
        b.style.opacity = paired ? '0.85' : '';
        b.style.borderColor = paired ? `rgba(${ACCENT},0.9)` : '';
        b.style.background = paired ? `rgba(${ACCENT},0.14)` : '';
        b.setAttribute('aria-disabled', paired ? 'true' : 'false');
      }
      m.btnL.textContent = `${paired ? '⇄ ' : ''}${m.left}`;
    }
    status.textContent = `${fa(state.pairs.length)} از ${fa(items.length)} جفت ساخته شد.`;
    if (sendBtn) sendBtn.disabled = state.pairs.length !== items.length;
  };

  const refreshSelectedVisual = () => {
    for (const m of items) {
      const selL = state.leftSel === m.leftIdx;
      m.btnL.setAttribute('aria-pressed', selL ? 'true' : 'false');
      if (!m.btnL.disabled) {
        m.btnL.style.borderColor = selL ? `rgba(${ACCENT},0.9)` : '';
        m.btnL.style.background = selL ? `rgba(${ACCENT},0.2)` : '';
      }
    }
  };

  const flashWrong = (m) => {
    for (const b of [m.btnL, m.btnR]) {
      b.style.borderColor = WRONG_COLOR;
      b.style.background = 'rgba(255,155,138,0.16)';
    }
    setTimeout(() => {
      for (const b of [m.btnL, m.btnR]) {
        b.style.borderColor = '';
        b.style.background = '';
      }
      state.leftSel = null;
      applyPairState();
      refreshSelectedVisual();
    }, 600);
  };

  for (const m of items) {
    const btnL = document.createElement('button');
    btnL.type = 'button';
    btnL.className = 'answer-option';
    btnL.textContent = m.left;
    btnL.dataset.leftIdx = String(m.leftIdx);
    btnL.setAttribute('aria-pressed', 'false');
    btnL.addEventListener('click', () => {
      if (btnL.disabled) return;
      state.leftSel = state.leftSel === m.leftIdx ? null : m.leftIdx;
      refreshSelectedVisual();
    });
    const btnR = document.createElement('button');
    btnR.type = 'button';
    btnR.className = 'answer-option';
    btnR.textContent = m.right;
    btnR.dataset.rightIdx = String(m.leftIdx); // ایندکس اصلی — شافل فقط نمایشی است
    btnR.addEventListener('click', () => {
      if (btnR.disabled) return;
      if (state.leftSel === null) {
        status.textContent = 'اول یک آیتم از ستون چپ را انتخاب کن.';
        return;
      }
      if (state.leftSel === m.leftIdx) {
        state.pairs.push([state.leftSel, m.leftIdx]);
        state.leftSel = null;
        applyPairState();
      } else {
        flashWrong(items[state.leftSel]);
        void playStationAudio(SOUND_EVENTS.wrong);
      }
    });
    colL.append(btnL);
    colR.append(btnR);
    m.btnL = btnL;
    m.btnR = btnR;
  }
  // شافل نمایشی: بعد از ساخت، دکمه‌های ستون راست را به ترتیب شافل بچین
  for (const i of order) colR.append(items[i].btnR);

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'primary-button';
  send.textContent = 'ثبت جفت‌ها';
  send.disabled = true;
  send.addEventListener('click', () => {
    if (state.pairs.length !== items.length) return;
    void handleAnswerSubmit({ pairs: state.pairs.map(p => [p[0], p[1]]) });
  });
  sendBtn = send;
  applyPairState();
  wrap.append(status, board, send);
  return wrap;
}

/** «کسر روی شکل»: شبکهٔ خانه‌ها با رنگ‌آمیزی لمسی/کیبوردی (T3) */
function buildFractionShapeArea(question, state) {
  const cells = question.cells ?? question.answerFrac?.den ?? 2;
  const wrap = document.createElement('div');
  // ستون‌بندی: مقسوم‌علیه‌ای از cells که به جذر نزدیک‌تر است؛ در غیر این صورت یک ردیف
  let cols = cells;
  let best = Infinity;
  for (let d = 1; d <= cells; d++) {
    if (cells % d === 0 && Math.abs(d - Math.sqrt(cells)) < best) { best = Math.abs(d - Math.sqrt(cells)); cols = d; }
  }
  const rows = Math.ceil(cells / cols);
  const unit = 50;
  const W = cols * unit + 4;
  const H = rows * unit + 4;
  const svg = svgNode('svg', {
    viewBox: `0 0 ${W} ${H}`, width: '100%', style: `max-width:${W}px;display:block;margin:0 auto;`,
    role: 'group', 'aria-label': `شکل ${fa(cells)} خانه‌ای`
  });
  const counter = document.createElement('p');
  counter.className = 'question-feedback';
  counter.setAttribute('role', 'status');
  counter.setAttribute('aria-live', 'polite');
  counter.style.cssText = 'font-size:12px;margin:2px 0;';
  const updateCounter = () => { counter.textContent = `${fa(state.shaded.size)} خانه رنگ شده است.`; };
  for (let i = 0; i < cells; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rect = svgNode('rect', {
      x: col * unit + 4, y: row * unit + 4, width: unit - 8, height: unit - 8, rx: 9,
      fill: `rgba(${ACCENT},0.06)`, stroke: `rgba(${ACCENT},0.5)`, 'stroke-width': 2,
      style: 'cursor:pointer;', tabindex: '0', role: 'button', 'aria-pressed': 'false',
      'aria-label': `خانهٔ ${fa(i + 1)}`
    });
    const toggle = () => {
      if (state.shaded.has(i)) state.shaded.delete(i); else state.shaded.add(i);
      rect.setAttribute('fill', state.shaded.has(i) ? `rgba(${ACCENT},0.55)` : `rgba(${ACCENT},0.06)`);
      rect.setAttribute('aria-pressed', state.shaded.has(i) ? 'true' : 'false');
      updateCounter();
    };
    rect.addEventListener('click', toggle);
    rect.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    svg.append(rect);
    state.cellRects.push({ i, rect });
  }
  updateCounter();
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'primary-button';
  send.textContent = 'ثبت رنگ‌ها';
  send.addEventListener('click', () => void handleAnswerSubmit(state.shaded.size));
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'secondary-button';
  clear.textContent = 'پاک‌کردن رنگ‌ها';
  clear.addEventListener('click', () => {
    state.shaded.clear();
    for (const { rect } of state.cellRects) {
      rect.setAttribute('fill', `rgba(${ACCENT},0.06)`);
      rect.setAttribute('aria-pressed', 'false');
    }
    updateCounter();
  });
  btnRow.append(send, clear);
  wrap.append(svg, counter, btnRow);
  return wrap;
}

/** «خانه‌شمار مساحت»: اشکال از پیش رسم‌شدهٔ روی شبکه — توکن‌های بستهٔ نمونه (T3) */
const AREA_SHAPE_PRESETS = Object.freeze({
  lshape4: [[0, 0], [0, 1], [0, 2], [1, 2]],
  rect2x2: [[0, 0], [1, 0], [0, 1], [1, 1]],
  ustep4: [[0, 0], [1, 0], [1, 1], [2, 1]],
  tshape5: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
  plus5: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
  lshape6: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2]],
  rect2x3: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  lshape8: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3]],
  rect3x4: [
    [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1],
    [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]
  ]
});

function buildAreaCellsFigure(question) {
  const wrap = document.createElement('div');
  const token = question.figureShape;
  const cells = token ? AREA_SHAPE_PRESETS[String(token)] : null;
  if (!cells) {
    const note = document.createElement('p');
    note.className = 'question-feedback';
    note.style.cssText = 'font-size:12px;';
    note.textContent = `شکل نمایشی «${token || 'نامشخص'}» در بستهٔ رسم نیست — تعداد خانه‌ها را از صورت کتاب بشمار.`;
    wrap.append(note);
    return wrap;
  }
  const maxCol = Math.max(...cells.map(c => c[0]));
  const maxRow = Math.max(...cells.map(c => c[1]));
  const unit = 46;
  const W = (maxCol + 1) * unit + 4;
  const H = (maxRow + 1) * unit + 4;
  const svg = svgNode('svg', {
    viewBox: `0 0 ${W} ${H}`, width: '100%', style: `max-width:${W}px;display:block;margin:0 auto;`,
    role: 'img', 'aria-label': 'شکل روی شبکهٔ مربعی'
  });
  const cellSet = new Set(cells.map(([c, r]) => `${c}:${r}`));
  for (let c = 0; c <= maxCol; c++) {
    for (let r = 0; r <= maxRow; r++) {
      svg.append(svgNode('rect', {
        x: c * unit + 4, y: r * unit + 4, width: unit - 4, height: unit - 4,
        fill: cellSet.has(`${c}:${r}`) ? `rgba(${ACCENT},0.3)` : 'rgba(255,255,255,0.02)',
        stroke: cellSet.has(`${c}:${r}`) ? `rgba(${ACCENT},0.7)` : `rgba(${ACCENT},0.15)`,
        'stroke-width': 1.5
      }));
    }
  }
  wrap.append(svg);
  return wrap;
}

/** «نمودار میله‌ای»: SVG ثابت از chartData (T3) */
function buildBarChartFigure(question) {
  const wrap = document.createElement('div');
  const data = question.chartData || [];
  if (!data.length) return wrap;
  const values = data.map(d => Math.max(0, Number(d.value)));
  const maxV = Math.max(...values, 1);
  const stepNice = maxV <= 5 ? 1 : Math.ceil(maxV / 5);
  const gridMax = Math.ceil(maxV / stepNice) * stepNice;
  const chartH = 120;
  const baseY = 150;
  const axisX = 36;
  const barSlot = 56;
  const W = axisX + data.length * barSlot + 14;
  const svg = svgNode('svg', {
    viewBox: `0 0 ${W} 190`, width: '100%', style: `max-width:${W}px;display:block;margin:0 auto;`,
    role: 'img', 'aria-label': 'نمودار میله‌ای'
  });
  const scale = chartH / gridMax;
  for (let v = 0; v <= gridMax; v += stepNice) {
    const y = baseY - v * scale;
    svg.append(svgNode('line', { x1: axisX, y1: y, x2: W - 8, y2: y, stroke: v === 0 ? `rgba(${ACCENT},0.7)` : `rgba(${ACCENT},0.18)`, 'stroke-width': 1 }));
    const lbl = svgNode('text', { x: axisX - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10, fill: 'currentColor' });
    lbl.textContent = fa(v);
    svg.append(lbl);
  }
  data.forEach((d, i) => {
    const v = values[i];
    const x = axisX + 10 + i * barSlot;
    const bw = barSlot - 18;
    const h = v * scale;
    svg.append(svgNode('rect', {
      x, y: baseY - h, width: bw, height: Math.max(h, v > 0 ? 2 : 0),
      fill: `rgba(${ACCENT},0.45)`, stroke: `rgba(${ACCENT},0.85)`, 'stroke-width': 1.5, rx: 4
    }));
    const valLbl = svgNode('text', { x: x + bw / 2, y: baseY - h - 6, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' });
    valLbl.textContent = fa(v);
    const catLbl = svgNode('text', { x: x + bw / 2, y: baseY + 16, 'text-anchor': 'middle', 'font-size': 10, fill: 'currentColor' });
    catLbl.textContent = d.label;
    svg.append(valLbl, catLbl);
  });
  wrap.append(svg);
  return wrap;
}

/** «تقارن»: کاتالوگ SVG کوچک شکل‌ها — توکن ناشناخته → جعبهٔ برچسب‌دار صادقانه (T3) */
const SYMMETRY_FIGURE_TOKENS = Object.freeze(['heart', 'rect-v', 'tilt-arrow', 'scalene-tri', 'equilateral-tri', 'flag-f', 'star5', 'blob']);

function symmetryFigureSVG(token) {
  const svg = svgNode('svg', {
    viewBox: '0 0 48 48', width: 40, height: 40, 'aria-hidden': 'true',
    style: `flex:0 0 auto;stroke:rgba(${ACCENT},0.9);fill:rgba(${ACCENT},0.12);stroke-width:2;stroke-linejoin:round;`
  });
  const paths = {
    heart: 'M24 42 C 10 32 4 22 8 14 C 11 8 20 8 24 15 C 28 8 37 8 40 14 C 44 22 38 32 24 42 Z',
    'rect-v': null, // مستطیل — جدا
    'tilt-arrow': null,
    'scalene-tri': 'M8 40 L20 10 L42 30 Z',
    'equilateral-tri': 'M24 8 L42 40 L6 40 Z',
    'flag-f': 'M14 6 V42 M14 8 H34 V18 H22 V24 H30',
    star5: 'M24 4 L29.9 18.1 L45 19 L33.4 28.9 L37.3 43.5 L24 35.4 L10.7 43.5 L14.6 28.9 L3 19 L18.1 18.1 Z',
    blob: 'M12 20 L20 8 L34 12 L40 26 L30 42 L14 38 Z'
  };
  if (token === 'rect-v') {
    svg.append(svgNode('rect', { x: 10, y: 14, width: 28, height: 20, rx: 2 }));
  } else if (token === 'tilt-arrow') {
    const g = svgNode('g', { transform: 'rotate(35 24 24)' });
    g.append(svgNode('path', { d: 'M8 24 H32 M24 14 L34 24 L24 34', fill: 'none' }));
    svg.append(g);
  } else {
    const d = paths[token] || paths.blob;
    svg.append(svgNode('path', { d, fill: SYMMETRY_FIGURE_TOKENS.includes(token) ? 'rgba(126, 240, 255, 0.12)' : 'rgba(255,255,255,0.05)' }));
  }
  return svg;
}

function buildSymmetryArea(question, state) {
  const wrap = document.createElement('div');
  const grid = document.createElement('div');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'گزینه‌های شکل');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;width:100%;';
  (question.figureOptions || []).forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-option';
    btn.style.cssText = 'align-items:center;';
    btn.append(symmetryFigureSVG(optText));
    const label = document.createElement('span');
    label.className = 'answer-option-text';
    label.textContent = optText;
    btn.append(label);
    btn.setAttribute('aria-label', `گزینهٔ ${i + 1}: ${optText}`);
    btn.addEventListener('click', () => {
      state.symmetryIdx = i;
      void handleAnswerSubmit(String(i));
    });
    grid.append(btn);
  });
  wrap.append(grid);
  return wrap;
}

/** آماده‌سازی ناحیهٔ پاسخ بر اساس قالب سؤال کارتریجی (BP-016 فاز الف + BP-017 فاز ب/ج) */
function configureAnswerArea(question) {
  const fmt = effectiveFormat(question);
  const input = $('answer-input');
  const form = $('question-form');
  const submitBtn = form?.querySelector('button[type="submit"]');
  let opts = $('answer-options');
  if (!opts && form) {
    opts = document.createElement('div');
    opts.id = 'answer-options';
    opts.className = 'answer-options';
    opts.setAttribute('role', 'group');
    opts.setAttribute('aria-label', 'گزینه‌های پاسخ');
    form.prepend(opts);
  }
  if (!opts) return;
  opts.innerHTML = '';
  opts.style.display = '';
  cartridgeInteractive = null;

  if (fmt === FORMAT_MCQ) {
    // گزینه‌ای: دکمه‌های گزینه؛ ورودی متنی مخفی
    opts.hidden = false;
    if (input) input.hidden = true;
    if (submitBtn) submitBtn.hidden = true;
    (question.options || []).forEach((optText, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer-option';
      btn.dataset.index = String(i);
      const letter = document.createElement('span');
      letter.className = 'answer-option-letter';
      letter.textContent = OPTION_LETTERS_FA[i] ?? String(i + 1);
      const text = document.createElement('span');
      text.className = 'answer-option-text';
      text.textContent = optText; // textContent — ایمن در برابر تزریق
      btn.append(letter, text);
      btn.addEventListener('click', () => { void handleAnswerSubmit(String(i)); });
      opts.append(btn);
    });
    return;
  }

  if (fmt === FORMAT_NUMBER_LINE) {
    // محور عددی: SVG خط‌کش + دکمه‌های درجه + دکمهٔ ثبت (T1)
    opts.hidden = false;
    opts.style.display = 'block';
    if (input) input.hidden = true;
    if (submitBtn) submitBtn.hidden = true;
    const state = { value: null, tickEls: [] };
    cartridgeInteractive = state;
    opts.append(buildNumberLineArea(question, state));
    return;
  }

  if (fmt === FORMAT_MATCHING) {
    // زوج‌سازی: دو ستون — چپ ثابت، راست شافل؛ تکمیل همهٔ جفت‌ها → ثبت (T2)
    opts.hidden = false;
    opts.style.display = 'block';
    if (input) input.hidden = true;
    if (submitBtn) submitBtn.hidden = true;
    const state = { leftSel: null, pairs: [], order: [] };
    cartridgeInteractive = state;
    opts.append(buildMatchingArea(question, state));
    return;
  }

  if (fmt === FORMAT_FIGURE) {
    const sk = question.subkind;
    if (sk === 'fraction-shape') {
      // کسر روی شکل: خانه‌ها را رنگ کن؛ ثبت = تعداد خانه‌های رنگ‌شده (T3)
      opts.hidden = false;
      opts.style.display = 'block';
      if (input) input.hidden = true;
      if (submitBtn) submitBtn.hidden = true;
      const state = { shaded: new Set(), cellRects: [] };
      cartridgeInteractive = state;
      opts.append(buildFractionShapeArea(question, state));
      return;
    }
    if (sk === 'area-cells' || sk === 'bar-chart') {
      // خانه‌شمار مساحت / نمودار میله‌ای: شکل ثابت + همان ورودی عددی (T3)
      opts.hidden = false;
      opts.style.display = 'block';
      if (input) {
        input.hidden = false;
        input.value = '';
        input.maxLength = 4;
        input.placeholder = 'پاسخ را عدد وارد کن';
        input.focus();
      }
      if (submitBtn) submitBtn.hidden = false;
      opts.append(sk === 'area-cells' ? buildAreaCellsFigure(question) : buildBarChartFigure(question));
      return;
    }
    if (sk === 'symmetry') {
      // تقارن: انتخاب شکل از میان گزینه‌های تصویری — سنجش گزینه‌ای (T3)
      opts.hidden = false;
      opts.style.display = 'block';
      if (input) input.hidden = true;
      if (submitBtn) submitBtn.hidden = true;
      const state = { symmetryIdx: null };
      cartridgeInteractive = state;
      opts.append(buildSymmetryArea(question, state));
      return;
    }
    // زیرقالب ناشناخته — صادقانه: این سؤال نباید تا اینجا می‌رسید (isPlayable گارد دارد)
    opts.hidden = false;
    const note = document.createElement('p');
    note.textContent = 'زیرقالب این سؤال شناخته نشد — به ناظر محتوا گزارش شود.';
    opts.append(note);
    return;
  }

  // عدد/کسر: همان ورودی متنی با تنظیم قالب
  opts.hidden = true;
  if (input) {
    input.hidden = false;
    input.value = '';
    if (fmt === FORMAT_NUMBER) { input.maxLength = 4; input.placeholder = 'پاسخ را عدد وارد کن'; }
    else if (fmt === FORMAT_FRACTION) { input.maxLength = 10; input.placeholder = 'مثلاً ۳/۴ یا ۱ ۱/۲'; }
    else { input.maxLength = 3; input.placeholder = ''; }
    input.focus();
  }
  if (submitBtn) submitBtn.hidden = false;
}

/** مسیر سنجش سؤال کارتریجی — مشترک برای همهٔ قالب‌ها (فاز الف + فاز ب/ج) */
async function handleCartridgeAnswerSubmit(question, userAnswer, elapsedSec) {
  const session = state.session;
  const verdict = checkCartridgeAnswer(question, userAnswer);
  const result = stationLayer.cells.onAnswer(verdict.correct);

  if (!verdict.correct) {
    // تلاش‌نگار فقط‌الحاقی (CEAP §4.1) — BP-022/M10: مسیریاب یکنواخت attempt→v103→w8
    // حدهای per-book/per-grade از قرارداد M09؛ کارتریج ناشناخته = بدون حدهای کتابی (فقط پشتوانهٔ ماژول‌ها)
    const routerVerdict = classifyCartridgeAttempt({
      question,
      submitted: verdict.normalized,
      bookLimits: DEFAULT_BOOK_LIMITS[session.cartridgeId] || null
    });
    const structuralCode = routerVerdict.code;
    // اطلس-لنگر (بدون طبقه‌بندی عددی): برای گزینه‌ایِ بدون op، کدِ ادعاشدهٔ اطلس همان گزینهٔ غلط
    let atlasClaim = null;
    if (!structuralCode) {
      const mcqIdx = /گزینهٔ\s*(\d+)/.exec(String(verdict.normalized ?? ''));
      if (mcqIdx) atlasClaim = atlasClaimForWrongOption(question, Number(mcqIdx[1]) - 1);
    }
    const codeStatus = structuralCode
      ? codeRegistryStatus(structuralCode, session.officialAtlasCodes)
      : (atlasClaim?.status || null);
    session.wrongAttempts = session.wrongAttempts || [];
    session.wrongAttempts.push({
      questionId: question.questionId,
      f1: question.f1 ?? null,
      f2: question.f2 ?? null,
      submitted: (Number.isFinite(Number(verdict.normalized)) && String(verdict.normalized ?? '').trim() !== '' && !String(verdict.normalized).includes('/'))
        ? Number(verdict.normalized) : null,
      submittedNormalized: String(verdict.normalized ?? '').slice(0, 40),
      submittedRaw: String(userAnswer ?? '').slice(0, 40),
      format: question.answerFormat || 'گزینه‌ای',
      // BP-017 T4 — اطلس دامنه‌ای: زیرقالب شکل/نمودار برای کلیدهای format:/subkind: ثبت می‌شود
      subkind: question.subkind || null,
      domainCode: question.domainCode || null,
      code: structuralCode || null,
      // BP-022/M09 — حاکمیت قرارداد: موتور تشخیص + وضعیت رجیستری + اطلس-لنگر گزینهٔ غلط
      engine: routerVerdict.engine,
      routerReason: routerVerdict.reason,
      atlasCode: (!structuralCode && atlasClaim) ? atlasClaim.code : null,
      codeStatus, // «رسمی» | «پیشنهادی» (کدهای W8 تا مُهر انسانی پیشنهادی می‌مانند) | null
      behavioral: null,
      timeSec: elapsedSec,
      at: new Date().toISOString()
    });
    $('question-feedback').textContent = 'درست نیست — یک بار دیگر با دقت فکر کن!';
    void playStationAudio(result.sound);
    // نردبان خودکار پلهٔ ۱ — سؤال‌های ضربی: نردبان کتاب؛ قالب‌های ب/ج: نردبان formatHint
    if (hintLevel === 0 && question.f1 != null && question.f2 != null) {
      hintLevel = 1;
      session.hintsMax = Math.max(session.hintsMax || 0, hintLevel);
      const autoBtn = $('question-guide-button');
      if (autoBtn) autoBtn.classList.add('attract');
      showGuideStepUp(question);
    } else if (hintLevel === 0 && FORMAT_HINT_FORMATS.includes(question.answerFormat)) {
      hintLevel = 1;
      session.hintsMax = Math.max(session.hintsMax || 0, hintLevel);
      const autoBtn = $('question-guide-button');
      if (autoBtn) autoBtn.classList.add('attract');
      showGuideStepUp(question);
    }
    return;
  }

  void playStationAudio(result.sound);
  $('question-feedback').textContent = '';
  if (question.f1 != null && question.f2 != null) {
    session.acceptedFacts = session.acceptedFacts || [];
    session.acceptedFacts.push({ f1: question.f1, f2: question.f2 });
  }

  const eventId = 'evt_' + crypto.randomUUID();
  session.answers = session.answers || {};
  session.answers[question.questionId] = {
    eventId,
    questionId: question.questionId,
    answer: verdict.normalized,
    submittedAt: new Date().toISOString()
  };
  session.receipts = session.receipts || {};
  session.receipts[eventId] = {
    eventId,
    questionId: question.questionId,
    correct: true,
    status: 'ACKNOWLEDGED',
    timeSec: elapsedSec,
    serverTime: new Date().toISOString()
  };

  if (result.action === 'next-question') {
    activeQuestionIndex++;
    showGuide = false;
    await saveState(state);
    renderQuestionView();
  } else if (result.action === 'building-complete') {
    await finalizeCartridgePracticeSession(session);
  }
}

/** بستن نشست تمرین خشاب — رکورد + تلاش‌نگار محلی (پل داشبورد دامنه‌ای با T5 می‌آید) */
async function finalizeCartridgePracticeSession(session) {
  session.status = 'FINALIZED';
  session.score = session.questions.length;
  session.total = session.questions.length;

  state.stationRecords = keepStationRecord(state.stationRecords || [], session, {
    status: 'FINALIZED',
    score: session.score,
    total: session.total
  });

  state.attemptLog = state.attemptLog || [];
  const wrongCodes = {};
  // BP-017 T4 — اطلس دامنه‌ای: تلاش‌های غلط قالب‌های ب/ج (بدون f1/f2 عددی) با کلیدهای
  // format:<قالب> / subkind:<زیرقالب> / دامنه:<کد دامنه> ثبت می‌شوند؛ کد ساختاری عددی
  // (f1/f2 ضربی) و رفتار UNCLASSIFIED مسیرهای قدیمی دقیقاً دست‌نخورده می‌مانند.
  const NEW_ATLAS_FORMATS = [FORMAT_NUMBER_LINE, FORMAT_MATCHING, FORMAT_FIGURE];
  for (const w of session.wrongAttempts || []) {
    if (w?.code) {
      wrongCodes[w.code] = (wrongCodes[w.code] || 0) + 1;
    } else if (w?.format && NEW_ATLAS_FORMATS.includes(w.format)) {
      wrongCodes[`format:${w.format}`] = (wrongCodes[`format:${w.format}`] || 0) + 1;
      if (w.subkind) wrongCodes[`subkind:${w.subkind}`] = (wrongCodes[`subkind:${w.subkind}`] || 0) + 1;
      if (w.domainCode) wrongCodes[`دامنه:${w.domainCode}`] = (wrongCodes[`دامنه:${w.domainCode}`] || 0) + 1;
    } else {
      wrongCodes.UNCLASSIFIED = (wrongCodes.UNCLASSIFIED || 0) + 1;
    }
  }
  if ((wrongCodes.UNCLASSIFIED || 0) >= 3) {
    wrongCodes.E_PERSISTENT_GUESSING = wrongCodes.UNCLASSIFIED;
  }
  const attemptEntry = {
    eventId: 'evt_' + crypto.randomUUID(),
    activityId: session.activityId,
    sectorId: session.sectorId,
    depth: null,
    missionId: null,
    type: 'cartridge-practice',
    total: session.total,
    correct: session.questions.filter(q => session.answers?.[q.questionId]).length,
    wrongCount: (session.wrongAttempts || []).length,
    wrongCodes,
    wrongExamples: (session.wrongAttempts || []).slice(0, 3).map(w => ({
      f1: w.f1, f2: w.f2, submitted: w.submitted, format: w.format,
      subkind: w.subkind ?? null, submittedRaw: w.submittedRaw ?? null
    })),
    hintsMax: session.hintsMax || 0,
    completedAt: new Date().toISOString()
  };
  state.attemptLog = state.attemptLog.slice(-499).concat(attemptEntry);
  await saveState(state);

  currentView = 'map';
  showGuide = false;
  void playStationAudio(SOUND_EVENTS.pathLit);
  void refreshTeacherMissions();
  render();
}

// ─── BP-016 فاز الف: نشست تمرین با خشاب فعال ─────────────────────────────────

let lastLoadedCartridge = null; // آخرین خشاب بارگذاری‌شده در جعبهٔ خشاب — برای دکمهٔ تمرین

function startCartridgePracticeSession(cartridge, adapted) {
  if (!cartridge || !Array.isArray(adapted?.questions) || adapted.questions.length === 0) return;
  state.session = {
    sessionId: 'sess_' + crypto.randomUUID(),
    activityId: `cartridge-practice-${cartridge.cartridgeId}`, // هویت پایدار — «بهترین رکورد» هر خشاب
    // BP-022/M09 — SSOT رسمی این خشاب: کدهای اطلس رسمی برای وضعیت‌گذاری درستِ رجیستری
    officialAtlasCodes: Array.isArray(cartridge.errorAtlas) ? cartridge.errorAtlas.map(c => c.code).filter(Boolean) : [],
    sectorId: 1,
    activity: 'practice',
    activityType: 'cartridge-practice',
    depth: null,
    missionId: null,
    rulesVersion: RULES_VERSION,
    questionSetVersion: `cartridge-${cartridge.cartridgeId}`,
    cartridgeId: cartridge.cartridgeId,
    questions: adapted.questions,
    answers: {},
    receipts: {},
    status: 'IN_PROGRESS',
    bottleneckHits: [],
    fluentCount: 0,
    wrongAttempts: [],
    acceptedFacts: [],
    hintsMax: 0
  };
  activeQuestionIndex = 0;
  currentView = 'question';
  showGuide = false;
  render();
}

async function startCartridgePractice() {
  const box = $('cartridge-status');
  let cartridge = lastLoadedCartridge;
  if (!cartridge) {
    const id = readSavedCartridgeId() || CARTRIDGE_ID;
    const result = await loadCartridge(`cartridges/${id}.json`, { fresh: true });
    cartridge = result?.ok ? result.cartridge : null;
  }
  if (!cartridge) return;
  const adapted = adaptCartridgeQuestions(cartridge, { limit: 10, shuffle: true });
  if (!adapted.questions.length) {
    if (box) {
      const warn = document.createElement('div');
      warn.className = 'cartridge-status-line';
      warn.textContent = `⚠️ هیچ سؤال قابل بازی در ۶ قالب موتور در خشاب ${cartridge.cartridgeId} نیست — ${fa(adapted.skipped)} سؤال بدشکل/ناشناخته رد شد (skippedInvalid).`;
      box.prepend(warn);
    }
    return;
  }
  startCartridgePracticeSession(cartridge, adapted);
}

async function handleAnswerSubmit(userAnswer) {
  const session = state.session;
  const question = session.questions[activeQuestionIndex];
  // زمان‌سنجی سؤال (گرد تا یک دهم ثانیه) — برای receipt و تلاش‌نگار
  const elapsedSec = questionStartedAt
    ? Math.round(((Date.now() - questionStartedAt) / 1000) * 10) / 10
    : 0;

  // BP-016 فاز الف — سؤال کارتریجی (قالب گزینه‌ای/عدد/کسر)
  if (question?.prompt) {
    await handleCartridgeAnswerSubmit(question, userAnswer, elapsedSec);
    return;
  }

  const expected = question.f1 * question.f2;
  const isCorrect = Number(normalizeDigits(userAnswer)) === expected;

  const result = stationLayer.cells.onAnswer(isCorrect);

  if (!isCorrect) {
    // تلاش‌نگار فقط‌الحاقی (CEAP §4.1): پاسخ‌های غلط حذف نمی‌شوند — شاهد تشخیص گلوگاه
    const submittedNum = Number(normalizeDigits(userAnswer));
    // اطلس ۱۲خطا (v10.2): کد ساختاری از خود پاسخ + کد رفتاری از تاریخچهٔ پذیرش جلسه
    const structuralCode = classifyAttempt({ f1: question.f1, f2: question.f2, submitted: submittedNum });
    const behavioralCode = detectBehavioralCode({ f1: question.f1, f2: question.f2, acceptedFacts: session.acceptedFacts });
    session.wrongAttempts = session.wrongAttempts || [];
    session.wrongAttempts.push({
      questionId: question.questionId,
      f1: question.f1,
      f2: question.f2,
      submitted: submittedNum,
      code: structuralCode || null,
      behavioral: behavioralCode || null,
      timeSec: elapsedSec,
      at: new Date().toISOString()
    });
    $('question-feedback').textContent = result.feedback;
    void playStationAudio(result.sound);
    // نردبان خودکار پلهٔ ۱ (v10.1.2): بعد از خطا، ملایم‌ترین راهنما («به عددها نگاه کن»)
    // همان لحظه دیده و شنیده می‌شود — بدون افشای پاسخ (assertNoLeak پلهٔ ۱)
    if (hintLevel === 0) {
      hintLevel = 1;
      session.hintsMax = Math.max(session.hintsMax || 0, hintLevel);
      const autoBtn = $('question-guide-button');
      if (autoBtn) autoBtn.classList.add('attract');
      showGuideStepUp(question);
    }
    return;
  }

  void playStationAudio(result.sound);
  $('question-feedback').textContent = '';

  // ثبت پذیرش این عبارت — شاهد کدهای رفتاری (جابه‌جایی/لغزش بعد از تسلط)
  session.acceptedFacts = session.acceptedFacts || [];
  session.acceptedFacts.push({ f1: question.f1, f2: question.f2 });

  const eventId = 'evt_' + crypto.randomUUID();
  session.answers = session.answers || {};
  session.answers[question.questionId] = {
    eventId,
    questionId: question.questionId,
    answer: expected,
    submittedAt: new Date().toISOString()
  };
  session.receipts = session.receipts || {};
  session.receipts[eventId] = {
    eventId,
    questionId: question.questionId,
    correct: true,
    status: 'ACKNOWLEDGED',
    timeSec: elapsedSec, // زمان طی‌شده روی این سؤال (فیلد اضافی مجاز)
    serverTime: new Date().toISOString()
  };

  if (result.action === 'next-question') {
    activeQuestionIndex++;
    showGuide = false;
    await saveState(state);
    renderQuestionView();
  } else if (result.action === 'building-complete') {
    session.status = 'FINALIZED';
    session.score = session.questions.length;
    session.total = session.questions.length;

    state.stationRecords = keepStationRecord(state.stationRecords || [], session, {
      status: 'FINALIZED',
      score: session.score,
      total: session.total
    });

    // تلاش‌نگار فقط‌الحاقی (CEAP §4.1): تاریخچهٔ کامل جلسه موازی با رکورد «بهترین» نگه داشته می‌شود
    // keepStationRecord دست‌نخورده می‌ماند (نمایش «بهترین» UI است)؛ اینجا فقط ضمیمه می‌کنیم.
    state.attemptLog = state.attemptLog || [];
    // خلاصهٔ خطاهای جلسه برای کارت معلم (v10.2): کد → تعداد + دو سه نمونهٔ واقعی
    const wrongCodes = {};
    const wrongExamples = [];
    for (const w of session.wrongAttempts || []) {
      if (w?.behavioral) wrongCodes[w.behavioral] = (wrongCodes[w.behavioral] || 0) + 1;
      if (w?.code) {
        wrongCodes[w.code] = (wrongCodes[w.code] || 0) + 1;
      } else if (!w?.behavioral) {
        wrongCodes.UNCLASSIFIED = (wrongCodes.UNCLASSIFIED || 0) + 1; // بی‌الگو — کاندید حدس بی‌ربط
      }
      if (wrongExamples.length < 3 && Number.isFinite(w?.submitted)) {
        wrongExamples.push({ f1: w.f1, f2: w.f2, submitted: w.submitted });
      }
    }
    if ((wrongCodes.UNCLASSIFIED || 0) >= 3) {
      wrongCodes.E_PERSISTENT_GUESSING = wrongCodes.UNCLASSIFIED; // سه پاسخ بی‌ربط (سند فصل ۳)
    }
    const attemptEntry = {
      eventId: 'evt_' + crypto.randomUUID(),
      activityId: session.activityId,
      sectorId: session.sectorId,
      depth: session.depth,
      missionId: session.missionId || null,
      type: session.activityType || 'core',
      total: session.total,
      correct: session.questions.filter(q => session.answers?.[q.questionId]).length,
      wrongCount: (session.wrongAttempts || []).length,
      wrongCodes,
      wrongExamples,
      hintsMax: session.hintsMax || 0,
      completedAt: new Date().toISOString()
    };
    state.attemptLog = state.attemptLog.slice(-499).concat(attemptEntry); // سقف ۵۰۰ ورودی

    await saveState(state);

    // پل داشبورد معلم: ارسال آتش‌وفراموش‌شدهٔ جلسه به سرور محلی (POST /api/sessions)
    // اگر بازی مستقل از داشبورد اجرا شود یا شبکه در دسترس نباشد، خطاها بی‌صدا نادیده گرفته می‌شوند.
    try {
      if (typeof fetch === 'function') {
        const dashProfile = (profiles || []).find(p => p.studentId === selectedId);
        // سکتور می‌تواند رشتهٔ بنا ('station-power') یا شمارهٔ سکتور مأموریت جانبی (۱/۲/۳) باشد
        const sectorKey = String(session.sectorId ?? '');
        const sectorNames = { 'station-power': 'station-power', 'station-antenna': 'station-antenna', 'station-launch': 'station-launch', '1': 'station-power', '2': 'station-antenna', '3': 'station-launch' };
        const sectorOffsets = { 'station-power': 0, 'station-antenna': 3, 'station-launch': 6, '1': 0, '2': 3, '3': 6 };
        const buildingName = sectorNames[sectorKey] ?? 'unknown';
        const sectorOffset = sectorOffsets[sectorKey] ?? 0;
        const firstAt = Object.values(session.receipts || {})[0]?.serverTime;
        const lastAt = Object.values(session.receipts || {}).slice(-1)[0]?.serverTime;
        const spanSec = firstAt && lastAt ? Math.max(0, Math.round((new Date(lastAt) - new Date(firstAt)) / 1000)) : undefined;
        // شناسهٔ قطعی رویداد برای همگام‌سازی idempotent — همان تلاش = همان eventId؛
        // ریترای شبکه رکورد تکراری نمی‌سازد، اما بازی دوبارهٔ همان بنا رویداد تازه می‌سازد.
        const syncEventId = ('evt_' + String(session.activityId ?? ('sync-' + sectorKey)) + '_' + String(firstAt ?? new Date().toISOString()))
          .replace(/\s/g, '-')
          .slice(0, 120);
        void fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            eventId: syncEventId,
            studentName: dashProfile?.displayName || 'بازیکن ایستگاه',
            buildingId: buildingName,
            layer: Math.min(9, sectorOffset + (session.depth ?? 2)),
            mode: session.activityType === 'side' ? 'side' : 'station',
            missionId: session.missionId || undefined,
            durationSec: spanSec,
            hintsMax: session.hintsMax || 0, // بیشترین پلهٔ نردبان راهنما — تشخیص تکدی سرنخ
            results: (session.questions || []).map(q => {
              const answered = !!(session.answers && session.answers[q.questionId]);
              // شواهد فقط‌الحاقی: آخرین پاسخ واقعی دانش‌آموز برای هر سؤال
              const wrongs = (session.wrongAttempts || []).filter(w => w && w.questionId === q.questionId);
              const lastWrong = wrongs.length ? wrongs[wrongs.length - 1] : null;
              const receipt = Object.values(session.receipts || {}).find(r => r && r.questionId === q.questionId);
              const item = {
                a: q.f1 ?? 0,
                b: q.f2 ?? 0,
                correct: answered
              };
              if (answered) {
                item.submitted = q.f1 * q.f2; // نهایی درست
              } else if (lastWrong && Number.isFinite(lastWrong.submitted)) {
                item.submitted = lastWrong.submitted; // آخرین پاسخ غلط (شاهد تشخیص)
              }
              if (receipt && Number.isFinite(receipt.timeSec)) {
                item.timeSec = receipt.timeSec;
              }
              return item;
            })
          })
        }).catch(() => {});
      }
    } catch { /* داشبورد اختیاری است */ }

    currentView = 'map';
    showGuide = false;
    void playStationAudio(SOUND_EVENTS.pathLit);
    void refreshTeacherMissions();
    render();
  }
}

// ─── تولید سؤال بر پایهٔ دامنهٔ لایه (v10.2 — دامنه‌ها بر کتاب کد ۳۰۵، deterministic) ───
// سکو ۳–۱ (×۱۰ صفحهٔ ۱۳۶–۱۳۸)، ۳–۲ (×۰ و ×۱)، ۳–۳ (یک‌رقم در چندرقمی — سقف حاصل ۹۹۹)
const X10_QUESTIONS = Object.freeze([
  { f1: 3, f2: 10 }, { f1: 7, f2: 10 }, { f1: 9, f2: 10 }, { f1: 6, f2: 10 },
  { f1: 8, f2: 10 }, { f1: 14, f2: 10 }, { f1: 42, f2: 10 }, { f1: 25, f2: 10 }
]);
const ZERO_ONE_QUESTIONS = Object.freeze([
  { f1: 6, f2: 0 }, { f1: 0, f2: 7 }, { f1: 8, f2: 1 }, { f1: 1, f2: 9 },
  { f1: 5, f2: 0 }, { f1: 0, f2: 3 }, { f1: 7, f2: 1 }, { f1: 1, f2: 6 },
  { f1: 9, f2: 0 }, { f1: 4, f2: 1 }
]);
const MULTI_DIGIT_QUESTIONS = Object.freeze([
  { f1: 3, f2: 24 }, { f1: 4, f2: 13 }, { f1: 2, f2: 45 },
  { f1: 5, f2: 32 }, { f1: 2, f2: 213 }, { f1: 3, f2: 121 }
]);
// زوج‌های جابه‌جایی (گلوگاه ۱ و ۶ — نقد ۵ و ۶): دو سر زوج با تصویر متفاوت —
// رفتار کودک روی زوج، شاهد درون‌بازی E_COMMUTATIVE_FAIL و درک دسته‌ها/اعضاست
const POWER_PAIRS = Object.freeze([[3, 5], [2, 4], [4, 6]]);
const TOWER_PAIRS = Object.freeze([[7, 4], [8, 3], [9, 2]]);

function generateQuestionsForDepth(buildingId, depth) {
  const layerKey = `${buildingId}-${depth}`;
  const layer = DEPTH_LAYERS[layerKey] || DEPTH_LAYERS['1-1'];
  const domain = layer.domain || 'table';
  const base = (f1, f2, i, visual) => ({
    questionId: `q_${buildingId}_${depth}_${i + 1}`,
    f1,
    f2,
    ...(visual ? { visual } : {})
  });

  if (domain === 'x10') return X10_QUESTIONS.map((q, i) => base(q.f1, q.f2, i));
  if (domain === 'zero-one') return ZERO_ONE_QUESTIONS.map((q, i) => base(q.f1, q.f2, i));
  if (domain === 'multi-digit') return MULTI_DIGIT_QUESTIONS.map((q, i) => base(q.f1, q.f2, i));

  if (domain === 'paired') {
    const pairs = buildingId === 1 ? POWER_PAIRS : TOWER_PAIRS;
    const out = [];
    pairs.forEach(([a, b], k) => {
      out.push(base(a, b, k * 2, 'equal-groups')); // سر اول زوج: تصویر دسته‌ها
      out.push(base(b, a, k * 2 + 1));             // سر دوم: ترتیب چرخیده، بدون تصویر
    });
    return out;
  }

  // دامنهٔ جدول — لایهٔ ۱ نیروگاه کاملاً تصویری (CPA، فصل ۱.۲ سند)
  const factors = layer.focus?.factors || [buildingId + 1];
  const count = layer.questionCount || 8;
  const visualAll = layerKey === '1-1';
  const visualFirst = layerKey === '2-1';

  const questions = [];
  for (let i = 0; i < count; i++) {
    const f1 = factors[i % factors.length];
    const f2 = (i % 9) + 2;
    const visual = (visualAll || (visualFirst && i < 4)) ? 'equal-groups' : null;
    questions.push(base(f1, f2, i, visual));
  }
  return questions;
}

function startBuildingSession(buildingId, depth = 1, type = 'core', missionId = null) {
  const questions = generateQuestionsForDepth(buildingId, depth);

  state.session = {
    sessionId: 'sess_' + crypto.randomUUID(),
    activityId: `station-${buildingId}-depth-${depth}`, // هویت پایدار برای معنای «بهترین رکورد»
    sectorId: buildingId,
    activity: 'mission',
    activityType: type,
    depth,
    missionId,
    rulesVersion: RULES_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    questions,
    answers: {},
    receipts: {},
    status: 'IN_PROGRESS',
    bottleneckHits: DEPTH_LAYERS[`${buildingId}-${depth}`]?.focus?.bottleneckTypes || [],
    fluentCount: depth === 2 ? questions.length : 0,
    wrongAttempts: [], // تلاش‌نگار فقط‌الحاقی (CEAP §4.1)
    acceptedFacts: [], // پذیرش‌های همین جلسه برای کدهای رفتاری (جابه‌جایی/لغزش)
    hintsMax: 0 // بیشترین پلهٔ نردبان راهنما در این جلسه
  };

  activeQuestionIndex = 0;
  currentView = 'question';
  showGuide = false;
  render();
}

// شروع مأموریت جانبی: ۵ سؤال تطبیقی اختصاصی مأموریت، بدون اثر بر لیدربرد
function startSideMission(missionId) {
  const mission = SIDE_MISSIONS[missionId];
  if (!mission || mission.type !== 'side') return;

  const seed = (state.stationRecords || []).length + 1; // تنوع تطبیقی بین تلاش‌ها
  const questions = generateSideMissionQuestions(missionId, seed);
  if (!questions.length) return;

  state.session = {
    sessionId: 'sess_' + crypto.randomUUID(),
    activityId: `side-${missionId}`, // هویت پایدار مستقل از جلسه‌های اصلی (بدون تداخل)
    sectorId: mission.parentSectorId,
    activity: 'mission',
    activityType: 'side',
    depth: null,
    missionId,
    rulesVersion: RULES_VERSION,
    questionSetVersion: QUESTION_SET_VERSION,
    questions,
    answers: {},
    receipts: {},
    status: 'IN_PROGRESS',
    bottleneckHits: [...new Set(questions.map(q => q.strategy))],
    fluentCount: 0,
    wrongAttempts: [], // تلاش‌نگار فقط‌الحاقی (CEAP §4.1) — مسیر مأموریت جانبی هم پوشش داده می‌شود
    acceptedFacts: [],
    hintsMax: 0
  };

  activeQuestionIndex = 0;
  currentView = 'question';
  showGuide = false;
  render();
}

function setupEvents() {
  $('toggle-sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    $('toggle-sound').textContent = soundEnabled ? 'صدا: روشن' : 'صدا: خاموش';
    $('toggle-sound').setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) {
      void playStationAudio(SOUND_EVENTS.accepted);
    }
  });

  [1, 2, 3].forEach(id => {
    const el = $(`building-${id === 1 ? 'power' : id === 2 ? 'tower' : 'pad'}`);
    if (!el) return;
    el.addEventListener('click', () => {
      const outcome = stationLayer.map.touchBuilding(id);
      if (outcome.staysOnMap) {
        notice(outcome.message);
        if (outcome.sound) void playStationAudio(outcome.sound);
      } else if (outcome.action === 'enter-building') {
        const systems = stationSystems(state.stationRecords || []);
        const sys = systems.find(s => s.sectorId === id);
        const nextDepth = Math.min(3, (sys?.currentDepth || 0) + 1);
        startBuildingSession(id, nextDepth, 'depth');
      }
    });
  });

  $('sheet-main-button').addEventListener('click', () => {
    const action = stationLayer.sheet.onMainButton();
    if (action.canProceed) {
      const systems = stationSystems(state.stationRecords || []);
      const sys = systems.find(s => s.sectorId === action.buildingId);
      const nextDepth = Math.min(3, (sys?.currentDepth || 0) + 1);
      startBuildingSession(action.buildingId, nextDepth, 'depth');
    }
  });

  // Side Missions: delegated click handler (دکمه‌ها در هر رندر بازسازی می‌شوند)
  $('sheet-side-missions').addEventListener('click', e => {
    const btn = e.target.closest('button[data-mission-id]');
    if (!btn) return;
    const outcome = stationLayer.sheet.onSideMissionButton(btn.dataset.missionId);
    if (outcome.canProceed) {
      startSideMission(outcome.missionId);
    }
  });

  // Teacher Missions: برداشت مأموریت معلم — علامت «دیده شد» + شروع مأموریت
  $('sheet-teacher-missions').addEventListener('click', e => {
    const btn = e.target.closest('button[data-assignment-id]');
    if (!btn) return;
    const assignmentId = btn.dataset.assignmentId;
    const missionId = btn.dataset.missionId;
    if (typeof fetch === 'function') {
      void fetch('/api/assignments/' + encodeURIComponent(assignmentId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ status: 'seen' })
      }).catch(() => {});
    }
    teacherMissions = teacherMissions.filter(m => m.id !== assignmentId);
    startSideMission(missionId);
  });

  $('map-guide-button').addEventListener('click', () => {
    showGuide = !showGuide;
    $('map-guide-info').hidden = !showGuide;
  });

  // نردبان داربست ۷پله‌ای (CEAP §8) + سرد شدن ضد تکدی سرنخ (§3.2)
  $('question-guide-button').addEventListener('click', () => {
    if (Date.now() < hintCooldownUntil) return; // در سرد شدن دکمه disabled است؛ محافظ مضاعف
    const session = state.session;
    const question = session?.questions?.[activeQuestionIndex];
    if (!question) return;

    hintLevel = Math.min(7, hintLevel + 1);
    session.hintsMax = Math.max(session.hintsMax || 0, hintLevel); // بیشترین پلهٔ جلسهٔ جاری

    const btn = $('question-guide-button');
    if (btn) btn.classList.remove('attract'); // کودک خودش سراغ راهنما آمد؛ نبض لازم نیست

    const ladder = showGuideStepUp(question); // رندر + اعلام صوتی پله

    if (ladder && hintLevel === 2) applyHintCooldown(5);
    else if (ladder && hintLevel === 4) applyHintCooldown(10);
  });

  $('question-speak').addEventListener('click', () => {
    void speakCurrentQuestion();
  });

  $('question-abandon').addEventListener('click', () => {
    stationLayer.cells.onAbandon();
    currentView = 'map';
    showGuide = false;
    clearHintCooldownTimer(); // تایمر سرد شدن راهنما در render بعدی دوباره چیده می‌شود
    void refreshTeacherMissions();
    render();
  });

  // باگ تایپ: کیبورد انگلیسی رقم لاتین می‌نوشت — هر ورودی همان لحظه فارسی می‌شود
  const answerInput = $('answer-input');
  answerInput.addEventListener('input', () => {
    const fafied = fafyAnswerInput(answerInput.value);
    if (fafied === answerInput.value) return;
    answerInput.value = fafied;
    answerInput.setSelectionRange(fafied.length, fafied.length);
  });

  $('question-form').addEventListener('submit', e => {
    e.preventDefault();
    const inputVal = $('answer-input').value.trim();
    if (!inputVal) return;
    handleAnswerSubmit(inputVal);
  });

  // ─── پرونده‌های محلی (v10.1.3): ثبت‌نام، مهمان، انتخاب و تغییر پرونده ───
  const createProfile = (displayName, role) => run(async () => {
    const profile = {
      studentId: 'student_' + crypto.randomUUID().slice(0, 8),
      displayName,
      role,
      createdAt: new Date().toISOString()
    };
    profiles = profiles.concat(profile);
    await local.put(PROFILES_INDEX_KEY, profiles);
    selectedId = profile.studentId;
    persistSelectedProfile();
    profileMode = null;
    state = { session: null, stationRecords: [] };
    await saveState(state);
    render();
    notice(welcomeLine(profile));
    void speakFa(welcomeLine(profile));
  });

  $('hero-create-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('hero-name').value.trim().slice(0, 32);
    if (!name) return;
    void createProfile(name, $('hero-avatar').value);
  });

  $('guest-login').addEventListener('click', () => {
    void createProfile('مهمان ایستگاه', 'astronaut');
  });

  $('profile-buttons').addEventListener('click', e => {
    const btn = e.target.closest('button[data-profile-id]');
    if (!btn) return;
    void run(async () => {
      selectedId = btn.dataset.profileId;
      persistSelectedProfile();
      profileMode = null;
      const stored = await local.get(profileStorageKey());
      state = stored || { session: null, stationRecords: [] };
      render();
      void refreshTeacherMissions();
    });
  });

  $('new-profile-button').addEventListener('click', () => {
    profileMode = 'create';
    render();
    $('hero-name').focus();
  });

  $('switch-profile-button').addEventListener('click', () => {
    void run(async () => {
      selectedId = null;
      persistSelectedProfile();
      profileMode = null;
      render();
    });
  });

  $('open-board-button').addEventListener('click', () => {
    $('board-dialog').hidden = false;
    void refreshLocalBoard(); // تابلوی افتخارات محلی (v10.1.3) — هر بار تازه خوانده می‌شود
  });
  $('close-board-button').addEventListener('click', () => {
    $('board-dialog').hidden = true;
  });

  // نوار ناوبری (v10.1.4): داستان + پنل معلم — لینک‌های خانه/لیدربرد/ثبت‌نام مستقیم href هستند
  const storyButton = $('open-story-button');
  if (storyButton) storyButton.addEventListener('click', openStoryDialog);
  const storyClose = $('close-story-button');
  if (storyClose) storyClose.addEventListener('click', () => { $('story-dialog').hidden = true; });
  const storySpeak = $('story-speak-button');
  if (storySpeak) storySpeak.addEventListener('click', () => {
    void speakFa(STORY_NARRATIVE.join(' '), storySpeak);
  });
  const teacherButton = $('open-teacher-panel');
  if (teacherButton) teacherButton.addEventListener('click', () => {
    $('teacher-dialog').hidden = false;
    void renderTeacherPanel(); // هر بار باز شدن، تازه خوانده می‌شود
  });
  const teacherClose = $('close-teacher-panel-button');
  if (teacherClose) teacherClose.addEventListener('click', () => { $('teacher-dialog').hidden = true; });

  // کارت معلم (v10.2): بازنویسی برچسب + یادداشت — بدون تغییر نمره و قفل بنا (سند فصل ۵)
  // کلید ذخیره‌سازی: «پرونده:eventId» — کارت‌های همهٔ پرونده‌ها روی دستگاه جاری ذخیره می‌شوند
  const panelBox = $('teacher-panel-content');
  if (panelBox) {
    panelBox.addEventListener('click', e => {
      const btn = e.target.closest('button[data-relabel]');
      if (!btn) return;
      const eventId = btn.dataset.eventId;
      const profileId = btn.dataset.profileId || '';
      const label = btn.dataset.relabel;
      void run(async () => {
        state.errorOverrides = state.errorOverrides || {};
        const key = `${profileId}:${eventId}`;
        const prev = state.errorOverrides[key] || {};
        state.errorOverrides[key] = { ...prev, label, at: new Date().toISOString() };
        await saveState(state);
        void renderTeacherPanel();
      });
    });
    panelBox.addEventListener('change', e => {
      const input = e.target.closest('input[data-note-id]');
      if (!input) return;
      const eventId = input.dataset.noteId;
      const profileId = input.dataset.profileId || '';
      const note = String(input.value || '').slice(0, 200);
      void run(async () => {
        state.errorOverrides = state.errorOverrides || {};
        const key = `${profileId}:${eventId}`;
        const prev = state.errorOverrides[key] || { label: 'confirmed' };
        state.errorOverrides[key] = { ...prev, note, at: new Date().toISOString() };
        await saveState(state);
      });
    });
  }
}

// ─── خشاب محتوا (v10.3): سیم‌کشی وضعیت خشاب به جعبهٔ راهنمای نقشه ───
// فقط اطلاع‌رسانی است: تولید سؤال/نردبان/قفل‌ها از محتوای داخلی خود موتور می‌آیند.
// چندخشابی (v10.3.1): انتخابگر خشاب نصب‌شده — فهرست از داشبورد، انتخاب در localStorage،
// و در استقرار استاتیک (بدون داشبورد) بی‌صدا فقط خشاب پیش‌فرض.
// fail-closed مضاعف: هر خطا در همین تابع گیر می‌افتد و هیچ مسیر بوتی نمی‌شکند.
const CARTRIDGE_STORAGE_KEY = 'station_active_cartridge';
let cartridgeListCache = null; // فهرست نصب‌شده‌ها — یک‌بار در بوتی خوانده می‌شود

function readSavedCartridgeId() {
  try {
    const v = localStorage.getItem(CARTRIDGE_STORAGE_KEY);
    return v && /^KH-[A-Za-z0-9_-]+$/.test(v) ? v : null;
  } catch { return null; } // حافظهٔ محلی اختیاری است
}

function persistCartridgeId(id) {
  try { localStorage.setItem(CARTRIDGE_STORAGE_KEY, id); } catch { /* اختیاری */ }
}

function defaultCartridgeIdFrom(list) {
  const saved = readSavedCartridgeId();
  if (saved && list.some(x => x.id === saved)) return saved;
  if (list.some(x => x.id === CARTRIDGE_ID)) return CARTRIDGE_ID;
  const firstValid = list.find(x => x.valid !== false);
  return (firstValid || list[0])?.id || CARTRIDGE_ID;
}

function cartridgeChipLabel(item) {
  const q = item?.stats?.questions;
  const parts = [item.id];
  if (item.valid === false) parts.push('⚠ نامعتبر');
  else if (typeof q === 'number') parts.push(`${fa(q)} سؤال`);
  return parts.join(' — ');
}

/** رندر کامل جعبهٔ خشاب: انتخابگر (در صورت چندخشابی) + خط وضعیت خشاب انتخابی */
async function renderCartridgeBox(box, list, selectedId) {
  box.textContent = '';
  if (list.length > 1) {
    const picker = document.createElement('div');
    picker.className = 'cartridge-picker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', 'انتخاب خشاب محتوا (کتاب فعال)');
    for (const item of list) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cartridge-chip'
        + (item.id === selectedId ? ' is-active' : '')
        + (item.valid === false ? ' is-invalid' : '');
      btn.textContent = cartridgeChipLabel(item);
      btn.setAttribute('aria-pressed', String(item.id === selectedId));
      if (item.title) btn.title = item.title;
      btn.addEventListener('click', () => { void selectCartridge(box, item.id); });
      picker.append(btn);
    }
    box.append(picker);
  }

  const result = await loadCartridge(`cartridges/${selectedId}.json`, { fresh: true });
  if (result?.ok) {
    const { cartridge, validation } = result;
    lastLoadedCartridge = cartridge; // BP-016 فاز الف — برای دکمهٔ «تمرین با این خشاب»
    const s = validation?.stats || {};
    const g = validation?.gate || {};
    const mainText = [
      `📦 خشاب محتوا: ${cartridge.cartridgeId}`,
      `سؤال‌ها: ${fa(s.questions ?? 0)} (${fa(s.questionsConfirmed ?? 0)} تأیید + ${fa(s.questionsProposed ?? 0)} پیشنهاد)`,
      `اطلس خطا: ${fa(s.atlasReal ?? 0)} واقعی + ${fa(s.atlasProposed ?? 0)} پیشنهادی`,
      `درس‌ها: ${fa(s.lessons ?? 0)} (${fa(s.lessonsConfirmed ?? 0)} تأیید)`,
      `گیت مبدل: ${g.verdict || 'نامشخص'} (${fa(g.red ?? 0)} قرمز / ${fa(g.yellow ?? 0)} زرد)`
    ].join(' — ');
    const src = cartridge.source || {};
    const metaText = [
      src.file ? `منبع: ${src.file}` : null,
      src.tool ? `ابزار: ${src.tool}` : null,
      cartridge.generatedAt ? `زمان تولید: ${fa(String(cartridge.generatedAt).replace('T', ' ').replace(/\.\d+Z$/, ' UTC'))}` : null
    ].filter(Boolean).join(' — ');
    const main = document.createElement('div');
    main.className = 'cartridge-status-line';
    main.textContent = mainText;
    const meta = document.createElement('div');
    meta.className = 'cartridge-status-meta';
    meta.textContent = metaText;
    box.append(main, meta);
    // BP-016 فاز الف — دکمهٔ تمرین با خشاب فعال (قالب‌های گزینه‌ای/عدد/کسر)
    const playable = adaptCartridgeQuestions(cartridge, { limit: 0, shuffle: false }).questions.length;
    const practiceBtn = document.createElement('button');
    practiceBtn.type = 'button';
    practiceBtn.className = 'cartridge-practice-button';
    practiceBtn.textContent = playable > 0
      ? `▶ تمرین با این خشاب (${fa(playable)} سؤال قابل بازی)`
      : '▶ تمرین با این خشاب';
    practiceBtn.setAttribute('aria-label', 'شروع جلسهٔ تمرین با سؤال‌های خشاب فعال');
    practiceBtn.addEventListener('click', () => { void startCartridgePractice(); });
    box.append(practiceBtn);
    box.hidden = false;
    console.info('[cartridge]', `خشاب ${cartridge.cartridgeId} بارگذاری و اعتبارسنجی شد — ${fa(s.questions ?? 0)} سؤال (${fa(s.questionsConfirmed ?? 0)} تأیید)، گیت مبدل: ${g.verdict || 'نامشخص'} (${fa(g.red ?? 0)} قرمز / ${fa(g.yellow ?? 0)} زرد)`);
  } else {
    // fail-closed: پیام صادقانه، بدون شکستن بازی
    const detail = result?.error || 'خطای ناشناخته';
    const errs = Array.isArray(result?.validation?.errors) ? result.validation.errors : [];
    const main = document.createElement('div');
    main.className = 'cartridge-status-line';
    main.textContent = '⚠️ خشاب محتوا بارگذاری نشد — بازی با محتوای داخلی ادامه می‌دهد.';
    const meta = document.createElement('div');
    meta.className = 'cartridge-status-meta';
    meta.textContent = [detail].concat(errs).join(' — ');
    box.append(main, meta);
    box.hidden = false;
    console.warn('[cartridge]', 'بارگذاری ناموفق —', detail, errs);
  }
}

async function selectCartridge(box, id) {
  persistCartridgeId(id);
  const list = cartridgeListCache || [{ id, valid: true, title: null, stats: null, gate: null }];
  await renderCartridgeBox(box, list, id);
}

async function initCartridgeStatus() {
  const box = $('cartridge-status');
  if (!box) return;
  try {
    const items = await listAvailableCartridges();
    cartridgeListCache = items && items.length
      ? items
      : [{ id: CARTRIDGE_ID, valid: true, title: null, stats: null, gate: null }];
    await renderCartridgeBox(box, cartridgeListCache, defaultCartridgeIdFrom(cartridgeListCache));
  } catch (e) {
    try {
      box.textContent = '';
      const main = document.createElement('div');
      main.className = 'cartridge-status-line';
      main.textContent = '⚠️ خشاب محتوا بارگذاری نشد — بازی با محتوای داخلی ادامه می‌دهد.';
      const meta = document.createElement('div');
      meta.className = 'cartridge-status-meta';
      meta.textContent = `خطای غیرمنتظره: ${e?.message || e}`;
      box.append(main, meta);
      box.hidden = false;
    } catch { /* DOM در دسترس نیست — بی‌صدا */ }
    console.warn('[cartridge]', 'initCartridgeStatus ناموفق —', e);
  }
}

export async function initApp() {
  local = await openLocal(); // موتور v9 خودش globalThis.indexedDB را تزریق می‌کند
  setupEvents();

  // خشاب محتوا (v10.3): بارگذاری غیرمسدودکننده — بدون await در مسیر بوت
  void initCartridgeStatus();

  // uid پایدار (رفع باگ v10.1.2): پیشرفت پس از بستن مرورگر می‌ماند
  actor = { uid: stableUid(), teacher: false };

  // پرونده‌های محلی (v10.1.3): ثبت‌نام/انتخاب پرونده بدون سرور
  await loadProfiles();
  try { selectedId = localStorage.getItem(SELECTED_STORAGE_KEY) || null; } catch { selectedId = null; }
  if (selectedId && !profiles.some(p => p.studentId === selectedId)) selectedId = null;
  profileMode = profiles.length ? null : 'create';

  const stored = selectedId ? await local.get(profileStorageKey()) : null;
  state = stored || { session: null, stationRecords: [] };

  render();
  void refreshTeacherMissions();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => notice(err.message, true));
  });
}
