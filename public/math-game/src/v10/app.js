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

let local, actor, tokenProvider;
let state = {};
let serial = Promise.resolve();
let profiles = [];
let selectedId = null;
let soundEnabled = false;
let currentView = 'map'; // 'map' | 'question'
let activeQuestionIndex = 0;
let showGuide = false;
let stationLayer = null;
let teacherClass = null;

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

  const qGuide = stationLayer.guide.createQuestionGuide(question);
  if (qGuide && showGuide) {
    $('question-guide-area').hidden = false;
    $('question-guide-area').innerHTML = renderEqualGroupsSVG(qGuide.groupsCount, qGuide.itemsPerGroup);
  } else {
    $('question-guide-area').hidden = true;
  }
}

async function handleAnswerSubmit(userAnswer) {
  const session = state.session;
  const question = session.questions[activeQuestionIndex];
  const expected = question.f1 * question.f2;
  const isCorrect = Number(normalizeDigits(userAnswer)) === expected;

  const result = stationLayer.cells.onAnswer(isCorrect);

  if (!isCorrect) {
    $('question-feedback').textContent = result.feedback;
    void playStationAudio(result.sound);
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
            durationSec: spanSec,
            results: (session.questions || []).map(q => ({
              a: q.f1 ?? 0,
              b: q.f2 ?? 0,
              correct: !!(session.answers && session.answers[q.questionId])
            }))
          })
        }).catch(() => {});
      }
    } catch { /* داشبورد اختیاری است */ }

    currentView = 'map';
    showGuide = false;
    void playStationAudio(SOUND_EVENTS.pathLit);
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
    fluentCount: depth === 2 ? questions.length : 0
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
    fluentCount: 0
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

  $('map-guide-button').addEventListener('click', () => {
    showGuide = !showGuide;
    $('map-guide-info').hidden = !showGuide;
  });

  $('question-guide-button').addEventListener('click', () => {
    showGuide = !showGuide;
    renderQuestionView();
  });

  $('question-abandon').addEventListener('click', () => {
    stationLayer.cells.onAbandon();
    currentView = 'map';
    showGuide = false;
    render();
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
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => notice(err.message, true));
  });
}
