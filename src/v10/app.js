// Version 10.2 Client Application — Powered by Station Layer on top of v9 Core
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
import {
  classifyAttempt,
  detectBehavioralCode,
  dominantCode,
  CODE_SENTENCES_FA
} from './station/errors.js';
import {
  buildLadder
} from './station/ladder.js';

const $ = id => document.getElementById(id);
const config = window.MathGameV9Config || {};
const base = (config.apiBase || '').replace(/\/$/, '');
const toFaDigits = val => String(val || '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]).replace(/[٠-٩]/g, d => '۰۱۲۳۴۵۶۷۸۹'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
const fa = num => String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const normalizeDigits = val => String(val || '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

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

async function loadState() {
  if (!local) return {};
  const raw = await local.get('states', profileStorageKey());
  return raw || { stationRecords: [], teacherOverrides: {}, attemptLog: [] };
}

async function saveState(data) {
  if (!local) return;
  await local.put('states', profileStorageKey(), data);
}

// ─── کارت‌های تشخیصی معلم و بازنویسی برچسب (v10.2) ───
const RELABEL_LABELS_FA = Object.freeze({
  confirmed: 'تأییدشده',
  'case-slip': 'لغزش موردی',
  rejected: 'ردشده'
});

function buildTeacherErrorCards(profileId, attempts, overrides) {
  const flagged = (attempts || [])
    .filter(a => a?.wrongCodes && dominantCode(a.wrongCodes))
    .slice(-6)
    .reverse();
  if (!flagged.length) {
    return '<p style="color: #8aa0ab; font-size: 0.9rem;">هنوز خطایی برای این جلسه ثبت نشده است.</p>';
  }
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

function renderTeacherShell() {
  $('teacher-summary').textContent = teacherClass
    ? `کلاس: ${teacherClass.name} — اعضا: ${fa(teacherClass.members?.length || 0)} نفر`
    : 'یک کلاس را برای بررسی انتخاب کنید.';

  const container = $('teacher-cards-container');
  if (container) {
    container.innerHTML = buildTeacherErrorCards(selectedId, state.attemptLog || [], state.teacherOverrides || {});

    container.querySelectorAll('.teacher-relabel-row button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const profileId = e.currentTarget.dataset.profileId;
        const eventId = e.currentTarget.dataset.eventId;
        const label = e.currentTarget.dataset.relabel;
        const key = `${profileId}:${eventId}`;

        state.teacherOverrides = state.teacherOverrides || {};
        state.teacherOverrides[key] = {
          ...(state.teacherOverrides[key] || {}),
          label,
          updatedAt: new Date().toISOString()
        };
        await saveState(state);
        renderTeacherShell();
      });
    });

    container.querySelectorAll('.teacher-note-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const profileId = e.currentTarget.dataset.profileId;
        const noteId = e.currentTarget.dataset.noteId;
        const note = e.currentTarget.value.trim();
        const key = `${profileId}:${noteId}`;

        state.teacherOverrides = state.teacherOverrides || {};
        state.teacherOverrides[key] = {
          ...(state.teacherOverrides[key] || {}),
          note,
          updatedAt: new Date().toISOString()
        };
        await saveState(state);
      });
    });
  }
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

    const systems = stationSystems(state.stationRecords || []);
    const lockNote = (id, bState) => {
      if (bState !== 'locked') return '';
      const prereq = id === BUILDINGS.TOWER ? BUILDINGS.POWER : BUILDINGS.TOWER;
      const sys = systems.find(s => s.sectorId === prereq);
      const layerLeft = sys ? Math.min(3, (sys.currentDepth || 0) + 1) : 1;
      return `<p class="building-lock-note">نیاز: هر سه لایهٔ ${BUILDING_NAMES[prereq]} کامل شود (الان لایهٔ ${fa(layerLeft)} — ${fa(sys?.percent || 0)}٪)</p>`;
    };

    $('building-power').innerHTML = renderBuildingSVG(BUILDINGS.POWER, powerState);
    $('building-power').dataset.state = powerState;

    $('building-tower').innerHTML = renderBuildingSVG(BUILDINGS.TOWER, towerState) + lockNote(BUILDINGS.TOWER, towerState);
    $('building-tower').dataset.state = towerState;

    $('building-pad').innerHTML = renderBuildingSVG(BUILDINGS.PAD, padState) + lockNote(BUILDINGS.PAD, padState);
    $('building-pad').dataset.state = padState;

    $('path-1').innerHTML = renderPathSVG(1, map.getPathState(1));
    $('path-2').innerHTML = renderPathSVG(2, map.getPathState(2));

    $('sheet-text').textContent = sheet.getSheetText();

    const mainBtnLabel = sheet.getMainButtonLabel();
    const mainBtn = $('sheet-main-button');
    if (mainBtnLabel) {
      mainBtn.hidden = false;
      mainBtn.textContent = mainBtnLabel;
    } else {
      mainBtn.hidden = true;
    }

    $('station-finish-view').hidden = !isFinished;
    if (isFinished) {
      $('finish-narrative').textContent = 'هر سه بنا روشن شدند. مخزن درست است. مأموریت ایستگاه کامل شد.';
    }
  } else if (currentView === 'question') {
    renderQuestionView();
  }
}

function render() {
  const stationState = toStationState(state.session, state.stationRecords || []);
  stationLayer = createStationLayer({ stationState, session: state.session });

  const isTeacher = Boolean(actor?.teacher);
  const studentEl = $('child-shell') || $('student-view'); if (studentEl) studentEl.hidden = isTeacher;
  const teacherEl = $('teacher-shell') || $('teacher-view'); if (teacherEl) teacherEl.hidden = !isTeacher;

  if (isTeacher) {
    renderTeacherShell();
  } else {
    renderChildShell(stationState);
  }
}

function renderQuestionView() {
  const session = state.session;
  if (!session || !session.questions || !session.questions[activeQuestionIndex]) {
    currentView = 'map';
    render();
    return;
  }

  const question = session.questions[activeQuestionIndex];
  const buildingId = session.sectorId || 1;

  $('question-building-name').textContent = BUILDING_NAMES[buildingId];
  $('question-sensation').textContent = BUILDING_SENSATIONS[buildingId];

  // Cells indicator (active vs pending vs lit)
  const cellsContainer = $('question-cells');
  cellsContainer.innerHTML = session.questions.map((q, idx) => {
    const isLit = Boolean(session.answers && session.answers[q.questionId]);
    const isCurrent = idx === activeQuestionIndex;
    return renderCellSVG(isLit ? 'lit' : (isCurrent ? 'active' : 'off'));
  }).join('');

  // CPA visual representation layer
  const visEl = $('question-visual');
  if (visEl) {
    const canVisual = question.visual === 'equal-groups'
      && question.f1 > 0 && question.f2 > 0 && (question.f1 * question.f2) <= 60;
    visEl.hidden = !canVisual;
    visEl.innerHTML = canVisual ? renderEqualGroupsSVG(question.f1, question.f2) : '';
  }

  // Question equation
  $('question-equation').textContent = `${fa(question.f1)} × ${fa(question.f2)} = ؟`;

  // Guide area (7-step ladder)
  if (showGuide) {
    const stepNum = session.currentHintStep || 1;
    const ladder = buildLadder(question);
    const stepObj = ladder ? ladder[stepNum - 1] : null;
    const hintText = stepObj ? (stepObj.text || stepObj.textFa) : 'به دسته‌ها و اعضا نگاه کن.';

    session.hintsMax = Math.max(session.hintsMax || 0, stepNum);

    $('question-guide-area').hidden = false;
    $('question-guide-area').innerHTML = `
      <div class="guide-box">
        <p><strong>پلهٔ ${fa(stepNum)} از ۷:</strong> ${escHtml(hintText)}</p>
      </div>
      ${(stepObj?.visual === 'equal-groups' && renderEqualGroupsSVG(question.f1, question.f2)) || ''}
    `;
  } else {
    $('question-guide-area').hidden = true;
  }

  const inputEl = $('answer-input');
  inputEl.value = '';
  inputEl.focus();
}

async function handleAnswerSubmit(userAnswer) {
  const session = state.session;
  const question = session.questions[activeQuestionIndex];
  const expected = question.f1 * question.f2;
  const submittedNum = Number(normalizeDigits(userAnswer));
  const isCorrect = submittedNum === expected;

  const result = stationLayer.cells.onAnswer(isCorrect);

  if (!isCorrect) {
    const structuralCode = classifyAttempt({ f1: question.f1, f2: question.f2, submitted: submittedNum });
    const behavioralCode = detectBehavioralCode({ f1: question.f1, f2: question.f2, acceptedFacts: session.acceptedFacts || [] });
    session.wrongAttempts = session.wrongAttempts || [];
    session.wrongAttempts.push({
      questionId: question.questionId,
      f1: question.f1,
      f2: question.f2,
      submitted: submittedNum,
      code: structuralCode || null,
      behavioral: behavioralCode || null,
      at: new Date().toISOString()
    });

    $('question-feedback').textContent = result.feedback;
    void playStationAudio(result.sound);
    return;
  }

  // ثبت پذیرش این عبارت برای کدهای رفتاری
  session.acceptedFacts = session.acceptedFacts || [];
  session.acceptedFacts.push({ f1: question.f1, f2: question.f2 });

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

    // ثبت گزارش تلاش‌ها (attemptLog)
    state.attemptLog = state.attemptLog || [];
    const wrongCodes = {};
    const wrongExamples = [];
    for (const w of session.wrongAttempts || []) {
      if (w?.behavioral) wrongCodes[w.behavioral] = (wrongCodes[w.behavioral] || 0) + 1;
      if (w?.code) {
        wrongCodes[w.code] = (wrongCodes[w.code] || 0) + 1;
      } else if (!w?.behavioral) {
        wrongCodes.UNCLASSIFIED = (wrongCodes.UNCLASSIFIED || 0) + 1;
      }
      if (wrongExamples.length < 3 && Number.isFinite(w?.submitted)) {
        wrongExamples.push({ f1: w.f1, f2: w.f2, submitted: w.submitted });
      }
    }
    if ((wrongCodes.UNCLASSIFIED || 0) >= 3) {
      wrongCodes.E_PERSISTENT_GUESSING = wrongCodes.UNCLASSIFIED;
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
    state.attemptLog = state.attemptLog.slice(-499).concat(attemptEntry);

    state.stationRecords = keepStationRecord(state.stationRecords || [], session, {
      status: 'FINALIZED',
      score: session.score,
      total: session.total
    });

    await saveState(state);

    currentView = 'map';
    showGuide = false;
    void playStationAudio(SOUND_EVENTS.pathLit);
    render();
  }
}

// ─── تولید سؤال بر پایهٔ دامنهٔ لایه (v10.2 بر کتاب کد ۳۰۵) ───
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
const POWER_PAIRS = Object.freeze([[3, 5], [2, 4], [4, 6]]);
const TOWER_PAIRS = Object.freeze([[7, 4], [8, 3], [9, 2]]);

function generateQuestionsForDepth(buildingId, depth) {
  const layerKey = `${buildingId}-${depth}`;
  const layer = DEPTH_LAYERS[layerKey] || DEPTH_LAYERS['1-1'];
  const domain = layer.domain || 'table';
  const baseQ = (f1, f2, i, visual) => ({
    questionId: `q_${buildingId}_${depth}_${i + 1}`,
    f1, f2,
    ...(visual ? { visual } : {})
  });

  if (domain === 'x10') return X10_QUESTIONS.map((q, i) => baseQ(q.f1, q.f2, i));
  if (domain === 'zero-one') return ZERO_ONE_QUESTIONS.map((q, i) => baseQ(q.f1, q.f2, i));
  if (domain === 'multi-digit') return MULTI_DIGIT_QUESTIONS.map((q, i) => baseQ(q.f1, q.f2, i));

  if (domain === 'paired') {
    const pairs = buildingId === 1 ? POWER_PAIRS : TOWER_PAIRS;
    const out = [];
    pairs.forEach(([a, b], k) => {
      out.push(baseQ(a, b, k * 2, 'equal-groups'));
      out.push(baseQ(b, a, k * 2 + 1));
    });
    return out;
  }

  const factors = layer.focus?.factors || [buildingId + 1];
  const count = layer.questionCount || 8;
  const visualAll = layerKey === '1-1';
  const visualFirst = layerKey === '2-1';

  const questions = [];
  for (let i = 0; i < count; i++) {
    const f1 = factors[i % factors.length];
    const f2 = (i % 9) + 2;
    const visual = (visualAll || (visualFirst && i < 4)) ? 'equal-groups' : null;
    questions.push(baseQ(f1, f2, i, visual));
  }
  return questions;
}

function startBuildingSession(buildingId, depth = 1, type = 'core', missionId = null) {
  const questions = generateQuestionsForDepth(buildingId, depth);

  state.session = {
    sessionId: 'sess_' + crypto.randomUUID(),
    activityId: `station-${buildingId}-depth-${depth}`,
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
    wrongAttempts: [],
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

  $('map-guide-button').addEventListener('click', () => {
    showGuide = !showGuide;
    $('map-guide-info').hidden = !showGuide;
  });

  $('question-guide-button').addEventListener('click', () => {
    const session = state.session;
    if (session) {
      if (!showGuide) {
        showGuide = true;
        session.currentHintStep = 1;
      } else {
        session.currentHintStep = ((session.currentHintStep || 1) % 7) + 1;
      }
    } else {
      showGuide = !showGuide;
    }
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
  const answerInput = $('answer-input');
  if (answerInput && !answerInput.dataset.faListener) {
    answerInput.dataset.faListener = 'true';
    answerInput.addEventListener('input', () => {
      const start = answerInput.selectionStart;
      const end = answerInput.selectionEnd;
      const next = toFaDigits(answerInput.value);
      if (next === answerInput.value) return;
      answerInput.value = next;
      if (start != null && end != null) answerInput.setSelectionRange(start, end);
    });
  }

  local = await openLocal('math_game_v10');
  setupEvents();

  actor = { uid: 'anon_student_' + Math.random().toString(36).slice(2, 8), teacher: false };
  profiles = [{ studentId: 'student_1', displayName: 'کودک' }];
  selectedId = 'student_1';

  state = await loadState();
  render();
}

window.addEventListener('DOMContentLoaded', () => {
  void initApp();
});
