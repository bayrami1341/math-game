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
import { loadCartridge } from './station/cartridge.js';

const $ = id => document.getElementById(id);
const config = window.MathGameV9Config || {};
const base = (config.apiBase || '').replace(/\/$/, '');
const fa = num => String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const normalizeDigits = val => String(val || '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
// تایپ زندهٔ فارسی: رقم لاتین/عربی همان لحظه فارسی نمایش داده می‌شود؛ نویسهٔ غیررقمی حذف می‌شود (سازگار با normalizeDigits چک پاسخ)
const fafyAnswerInput = val => String(val || '')
  .replace(/[0-9]/g, d => FA_DIGITS[Number(d)])
  .replace(/[٠-٩]/g, d => FA_DIGITS['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
  .replace(/[^۰-۹]/g, '');

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
      .map(w => `${fa(w.f1)}×${fa(w.f2)} را ${fa(w.submitted)} نوشته`)
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

// رندر ناحیهٔ راهنمای سؤال بر اساس وضعیت محلی (نردبان یا fallback قدیمی)
function renderGuideArea(question) {
  const area = $('question-guide-area');
  if (!area) return;
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

async function handleAnswerSubmit(userAnswer) {
  const session = state.session;
  const question = session.questions[activeQuestionIndex];
  const expected = question.f1 * question.f2;
  const isCorrect = Number(normalizeDigits(userAnswer)) === expected;
  // زمان‌سنجی سؤال (گرد تا یک دهم ثانیه) — برای receipt و تلاش‌نگار
  const elapsedSec = questionStartedAt
    ? Math.round(((Date.now() - questionStartedAt) / 1000) * 10) / 10
    : 0;

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
// fail-closed مضاعف: هر خطا در همین تابع گیر می‌افتد و هیچ مسیر بوتی نمی‌شکند.
async function initCartridgeStatus() {
  const box = $('cartridge-status');
  if (!box) return;
  try {
    const result = await loadCartridge();
    if (result?.ok) {
      const { cartridge, validation } = result;
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
      box.textContent = '';
      const main = document.createElement('div');
      main.className = 'cartridge-status-line';
      main.textContent = mainText;
      const meta = document.createElement('div');
      meta.className = 'cartridge-status-meta';
      meta.textContent = metaText;
      box.append(main, meta);
      box.hidden = false;
      console.info('[cartridge]', `خشاب ${cartridge.cartridgeId} بارگذاری و اعتبارسنجی شد — ${fa(s.questions ?? 0)} سؤال (${fa(s.questionsConfirmed ?? 0)} تأیید)، گیت مبدل: ${g.verdict || 'نامشخص'} (${fa(g.red ?? 0)} قرمز / ${fa(g.yellow ?? 0)} زرد)`);
    } else {
      // fail-closed: پیام صادقانه، بدون شکستن بازی
      const detail = result?.error || 'خطای ناشناخته';
      const errs = Array.isArray(result?.validation?.errors) ? result.validation.errors : [];
      box.textContent = '';
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
