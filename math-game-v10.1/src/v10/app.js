// Version 10.1 Client Application — Powered by Station Layer on top of v9 Core
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
  generateSideMissionQuestions,
  stationSystems,
  flightProgress,
  keepStationRecord,
  multiplicationModel
} from '../v9/experience.mjs';
import { toStationState } from './bridge.js';
import { buildLadder } from './station/ladder.js';
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

let local, actor, tokenProvider;
let state = {};
let serial = Promise.resolve();
let profiles = [];
let selectedId = null;
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

  $('login-card').hidden = !!actor;
  $('workspace').hidden = !actor;
  if (!actor) return;

  $('identity-display').textContent = actor.teacher
    ? 'پنل معلم'
    : (profile ? profile.displayName : 'انتخاب قهرمان');

  $('teacher-shell').hidden = !actor.teacher;
  $('child-shell').hidden = actor.teacher || !profile;
  $('profile-picker').hidden = actor.teacher || !!profile;

  if (actor.teacher) {
    renderTeacherShell();
  } else if (profile) {
    renderChildShell(stationState);
  }
}

function renderTeacherShell() {
  $('teacher-summary').textContent = teacherClass
    ? `کلاس: ${teacherClass.name} — اعضا: ${fa(teacherClass.members?.length || 0)} نفر`
    : 'یک کلاس را برای بررسی انتخاب کنید.';
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

    $('building-power').innerHTML = renderBuildingSVG(BUILDINGS.POWER, powerState);
    $('building-power').dataset.state = powerState;

    $('building-tower').innerHTML = renderBuildingSVG(BUILDINGS.TOWER, towerState);
    $('building-tower').dataset.state = towerState;

    $('building-pad').innerHTML = renderBuildingSVG(BUILDINGS.PAD, padState);
    $('building-pad').dataset.state = padState;

    $('path-1').innerHTML = renderPathSVG(1, map.getPathState(1));
    $('path-2').innerHTML = renderPathSVG(2, map.getPathState(2));

    $('sheet-text').textContent = sheet.getSheetText();

    // Side Missions: render unlocked side-mission buttons (affectsLeaderboard: false)
    const sideButtons = sheet.getSideMissionButtons();
    const sideRow = $('sheet-side-missions');
    if (sideButtons.length) {
      sideRow.hidden = false;
      sideRow.innerHTML = sideButtons.map(m => `
        <button type="button" class="side-mission-button" data-mission-id="${m.id}" aria-label="${m.title}">
          <span class="side-mission-icon">${m.icon}</span>
          <span>${m.title}</span>
          <span class="side-mission-note">${fa(m.questionCount)} سؤال تمرینی</span>
        </button>
      `).join('');
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
    session.wrongAttempts = session.wrongAttempts || [];
    session.wrongAttempts.push({
      questionId: question.questionId,
      submitted: Number(normalizeDigits(userAnswer)),
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

function generateQuestionsForDepth(buildingId, depth) {
  const layerKey = `${buildingId}-${depth}`;
  const layer = DEPTH_LAYERS[layerKey] || DEPTH_LAYERS['1-1'];
  const factors = layer.focus?.factors || [buildingId + 1];
  const count = layer.questionCount || 8;

  const questions = [];
  for (let i = 0; i < count; i++) {
    const f1 = factors[i % factors.length];
    const f2 = (i % 9) + 2;
    questions.push({
      questionId: `q_${buildingId}_${depth}_${i + 1}`,
      f1,
      f2
    });
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

  $('open-board-button').addEventListener('click', () => {
    $('board-dialog').hidden = false;
  });
  $('close-board-button').addEventListener('click', () => {
    $('board-dialog').hidden = true;
  });
}

export async function initApp() {
  local = await openLocal(); // موتور v9 خودش globalThis.indexedDB را تزریق می‌کند
  setupEvents();

  actor = { uid: 'anon_student_' + Math.random().toString(36).slice(2, 8), teacher: false };
  profiles = [{ studentId: 'student_1', displayName: 'کودک' }];
  selectedId = 'student_1';

  const stored = await local.get(profileStorageKey());
  if (stored) {
    state = stored;
  } else {
    state = { session: null, stationRecords: [] };
  }

  render();
  void refreshTeacherMissions();
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => notice(err.message, true));
  });
}
