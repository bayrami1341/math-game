// Version 10 Client Application — Powered by Station Layer on top of full v9 Core
import { openLocal } from '../v9/local.mjs';
import { connectApi } from '../v9/connection.mjs';
import { loadFirebaseLogin, googleLogin, loginError } from '../v9/firebase-login.mjs';
import { studentKey, selectProfile, membershipContext } from '../v9/entry.mjs';
import { missionChoices } from '../v9/mission.mjs';
import { keepStationRecord } from '../v9/experience.mjs';
import { toStationState } from './bridge.js';
import {
  createStationLayer,
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
const config = (typeof window !== 'undefined' && window.MathGameV9Config) || {};
const base = (config.apiBase || '').replace(/\/$/, '');
const fa = num => String(num).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const normalizeDigits = val => String(val || '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const request = () => ({ schemaVersion: 1, requestId: 'req_' + crypto.randomUUID() });

let local, actor, tokenProvider, auth, authSdk;
let state = {};
let serial = Promise.resolve();
let profiles = [];
let selectedId = null;
let soundEnabled = false;
let currentView = 'map'; // 'map' | 'question'
let activeQuestionIndex = 0;
let questionShownAt = 0;
let showGuide = false;
let stationLayer = null;
let teacherClass = null;

// Safe Sound Synthesizer strictly capped at 0.045
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
  el.textContent = message || '';
  el.dataset.error = String(isError);
  el.hidden = !message;
}

const accountKey = () => 'profile:' + (actor?.uid || 'local');
const profileStorageKey = () => (!actor || actor.teacher || !selectedId)
  ? accountKey()
  : studentKey(actor.uid, selectedId);
const operationKey = name => 'entry-operation:' + (actor?.uid || 'local') + ':' + name;

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

async function api(operation, input) {
  if (!tokenProvider || actor?.offline) {
    throw new Error('در حالت آفلاین، ارتباط مستقیم با سرور برقرار نیست.');
  }
  const response = await fetch(base + '/api/v9/' + operation, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (await tokenProvider())
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message || 'درخواست انجام نشد.');
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

async function saveState(nextState) {
  await local.put(profileStorageKey(), nextState);
  state = nextState;
}

// Compute stationState and initialize stationLayer
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

  // Authentication & Top Navigation
  if ($('login-card')) $('login-card').hidden = !!actor;
  if ($('workspace')) $('workspace').hidden = !actor;
  if ($('logout-button')) $('logout-button').hidden = !actor || !!actor.offline;
  if ($('change-hero')) $('change-hero').hidden = !actor || actor.teacher || profiles.length <= 1;
  if ($('sync-queue')) $('sync-queue').hidden = !actor || actor.teacher || !!actor.offline;

  if (!actor) return;

  if ($('identity-display')) {
    $('identity-display').textContent = actor.teacher
      ? 'پنل معلم'
      : (profile ? profile.displayName : 'انتخاب قهرمان');
  }

  // Shell separation: Teacher Shell vs Child Shell
  if ($('teacher-shell')) $('teacher-shell').hidden = !actor.teacher;
  if ($('child-shell')) $('child-shell').hidden = actor.teacher || !profile;
  if ($('profile-picker')) $('profile-picker').hidden = actor.teacher || !!profile;

  if (!actor.teacher && $('profile-buttons')) {
    $('profile-buttons').replaceChildren();
    profiles.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary-button';
      const roleLabel = { astronaut: 'فضانورد', pilot: 'خلبان', scientist: 'دانشمند' }[item.avatar] || 'قهرمان';
      btn.textContent = `${item.displayName} — ${roleLabel}`;
      btn.onclick = () => run(() => activateProfile(item));
      $('profile-buttons').append(btn);
    });
  }

  if (actor.teacher) {
    renderTeacherShell();
  } else if (profile) {
    renderChildShell(stationState);
  }
}

function renderTeacherShell() {
  // Strict Teacher Shell: Classes, members & invite, board key, 1 summary sentence.
  // Report does not look like main button.
  if (!$('teacher-summary')) return;
  if (teacherClass) {
    const activeCount = (teacherClass.members || []).filter(m => m.status === 'active').length;
    const pendingCount = (teacherClass.members || []).filter(m => m.status === 'pending').length;
    const finalizedCount = (teacherClass.sessions || []).filter(s => s.status === 'FINALIZED').length;
    $('teacher-summary').textContent = `کلاس ${teacherClass.name}: ${fa(activeCount)} عضو فعال، ${fa(pendingCount)} در انتظار تأیید و ${fa(finalizedCount)} فعالیت پایان‌یافته.`;
  } else {
    $('teacher-summary').textContent = 'یک کلاس را برای بررسی انتخاب کنید یا کلاس تازه‌ای بسازید.';
  }
}

function renderChildShell() {
  const { map, sheet } = stationLayer;
  const isFinished = map.isAllDone();

  $('station-map-view').hidden = currentView !== 'map';
  $('question-view').hidden = currentView !== 'question';

  if (currentView === 'map') {
    // Render 3 buildings from bottom to top: Power (1), Tower (2), Pad (3)
    const powerState = map.getBuildingState(BUILDINGS.POWER);
    const towerState = map.getBuildingState(BUILDINGS.TOWER);
    const padState = map.getBuildingState(BUILDINGS.PAD);

    $('building-power').innerHTML = renderBuildingSVG(BUILDINGS.POWER, powerState);
    $('building-power').dataset.state = powerState;

    $('building-tower').innerHTML = renderBuildingSVG(BUILDINGS.TOWER, towerState);
    $('building-tower').dataset.state = towerState;

    $('building-pad').innerHTML = renderBuildingSVG(BUILDINGS.PAD, padState);
    $('building-pad').dataset.state = padState;

    // Render 2 paths
    $('path-1').innerHTML = renderPathSVG(1, map.getPathState(1));
    $('path-2').innerHTML = renderPathSVG(2, map.getPathState(2));

    // Render Bottom Sheet (ورق پایین نقشه)
    $('sheet-text').textContent = sheet.getSheetText();

    const mainBtnLabel = sheet.getMainButtonLabel();
    const mainBtn = $('sheet-main-button');
    if (mainBtnLabel) {
      mainBtn.hidden = false;
      mainBtn.textContent = mainBtnLabel;
    } else {
      mainBtn.hidden = true; // All 3 done: No new question button!
    }

    // Map Guide Button: secondary button, toggles sheet focus without advancing
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

  // Question header & cells
  const buildingId = session.sectorId || 1;
  $('question-building-name').textContent = BUILDING_NAMES[buildingId] || '';
  $('question-sensation').textContent = BUILDING_SENSATIONS[buildingId] || '';

  // Render cells for this building
  const total = questions.length;
  const currentAccepted = stationLayer.cells.getAcceptedCount();
  let cellsHtml = '';
  for (let i = 0; i < total; i++) {
    cellsHtml += renderCellSVG(i < currentAccepted);
  }
  $('question-cells').innerHTML = cellsHtml;

  // The multiplication equation
  $('question-equation').textContent = `${fa(question.f1)} × ${fa(question.f2)} = ؟`;
  $('answer-input').value = '';
  $('answer-input').focus();
  questionShownAt = performance.now();

  // Render optional choices using v9 missionChoices helper
  const choicesEl = $('question-choices');
  if (choicesEl) {
    choicesEl.replaceChildren();
    const choices = missionChoices(question);
    if (choices && choices.length) {
      choicesEl.hidden = false;
      for (const val of choices) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'secondary-button';
        btn.textContent = fa(val);
        btn.onclick = () => {
          $('answer-input').value = String(val);
          void handleAnswerSubmit(String(val));
        };
        choicesEl.append(btn);
      }
    } else {
      choicesEl.hidden = true;
    }
  }

  // Question guide (دسته‌های مساوی بدون رقم حاصل)
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
  if (!session || !session.questions) return;
  const question = session.questions[activeQuestionIndex];
  if (!question) return;

  const numericAnswer = Number(normalizeDigits(userAnswer));
  const expected = question.f1 * question.f2;
  const isCorrect = numericAnswer === expected;

  const result = stationLayer.cells.onAnswer(isCorrect);

  if (!isCorrect) {
    // جواب غلط: همان سؤال. سلول روشن نمی‌شود. نگو «اشتباه کردی».
    $('question-feedback').textContent = result.feedback;
    void playStationAudio(result.sound);
    return;
  }

  // جواب درست: پخش صدا و ثبت در session
  void playStationAudio(result.sound);
  $('question-feedback').textContent = '';

  const eventId = 'evt_' + crypto.randomUUID();
  const attempt = {
    eventId,
    questionId: question.questionId,
    answer: expected,
    responseMs: Math.min(3600000, Math.max(0, Math.round(performance.now() - questionShownAt))),
    clientOccurredAt: new Date().toISOString(),
    submittedAt: new Date().toISOString()
  };

  session.answers = session.answers || {};
  session.answers[question.questionId] = attempt;
  session.receipts = session.receipts || {};
  session.receipts[eventId] = {
    eventId,
    questionId: question.questionId,
    correct: true,
    status: 'ACKNOWLEDGED',
    serverTime: new Date().toISOString()
  };

  // Enqueue in v9 local IndexedDB queue when connected to a real backend session
  if (!actor?.offline && session.writerEpoch) {
    const input = {
      ...request(),
      sessionId: session.sessionId,
      writerEpoch: session.writerEpoch,
      attempts: [attempt]
    };
    const next = structuredClone(state);
    await local.enqueue(profileStorageKey(), next, {
      uid: actor.uid,
      studentId: selectedId,
      input
    });
    state = next;
    void flush();
  }

  if (result.action === 'next-question') {
    activeQuestionIndex++;
    showGuide = false;
    await saveState(state);
    renderQuestionView();
  } else if (result.action === 'building-complete') {
    // پایان جلسه بنا
    session.status = 'FINALIZED';
    session.score = session.questions.length;
    session.total = session.questions.length;

    if (!actor?.offline && session.writerEpoch) {
      try {
        await flush(true);
        const opKey = operationKey('finish:' + session.sessionId);
        const finInput = await local.prepareOperation(opKey, {
          ...request(),
          sessionId: session.sessionId,
          writerEpoch: session.writerEpoch
        });
        const finResult = await api('finalizeSession', finInput);
        session.status = finResult.status || 'FINALIZED';
        session.score = Number.isInteger(finResult.score) ? finResult.score : session.score;
        await local.put(opKey, null);
      } catch {
        // Offline resilience: local record is preserved
      }
    }

    state.stationRecords = keepStationRecord(state.stationRecords || [], session, {
      status: 'FINALIZED',
      score: session.score,
      total: session.total
    });

    await saveState(state);

    // برگشت جلوی همان بنا. راه روشن می‌شود.
    currentView = 'map';
    showGuide = false;
    void playStationAudio(SOUND_EVENTS.pathLit);
    render();
  }
}

async function startBuildingSession(buildingId) {
  // Resume existing unfinished session for the same building if available
  if (
    state.session &&
    state.session.sectorId === buildingId &&
    state.session.status !== 'FINALIZED' &&
    Array.isArray(state.session.questions) &&
    state.session.questions.length > 0
  ) {
    const answeredIds = state.session.answers || {};
    const nextIdx = state.session.questions.findIndex(q => !answeredIds[q.questionId]);
    activeQuestionIndex = nextIdx >= 0 ? nextIdx : 0;
    currentView = 'question';
    showGuide = false;
    render();
    return;
  }

  // If online with v9 server, try starting an official mission session
  if (actor && !actor.offline && tokenProvider) {
    try {
      await flush();
      const opKey = operationKey('start:' + selectedId + ':' + buildingId);
      const input = await local.prepareOperation(opKey, {
        ...request(),
        studentId: selectedId,
        activity: 'mission',
        sectorId: Number(buildingId),
        ...(state.classId && state.membershipStatus === 'active' ? { classId: state.classId } : {})
      });
      const serverSession = await api('startActivity', input);
      await local.put(opKey, null);
      state.session = {
        ...serverSession,
        sectorId: buildingId,
        activity: 'mission',
        answers: {},
        receipts: {}
      };
      await saveState(state);
      activeQuestionIndex = 0;
      currentView = 'question';
      showGuide = false;
      render();
      return;
    } catch {
      // Fallback to local deterministic station session if offline or server unreachable
    }
  }

  // Deterministic station questions for this building
  const questions = [
    { questionId: `q_${buildingId}_1`, f1: buildingId + 1, f2: 2 },
    { questionId: `q_${buildingId}_2`, f1: buildingId + 1, f2: 3 },
    { questionId: `q_${buildingId}_3`, f1: buildingId + 1, f2: 4 }
  ];

  state.session = {
    sessionId: 'sess_' + crypto.randomUUID(),
    activityId: `station_sector_${buildingId}`,
    sectorId: buildingId,
    activity: 'mission',
    rulesVersion: 'rv1',
    questionSetVersion: 'graph-v8.1',
    questions,
    answers: {},
    receipts: {},
    status: 'IN_PROGRESS'
  };

  await saveState(state);
  activeQuestionIndex = 0;
  currentView = 'question';
  showGuide = false;
  render();
}

// v9 Offline Queue Flush
async function flush(force = false) {
  if (!actor || actor.teacher || actor.offline || !tokenProvider) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notice('اینترنت قطع است؛ پاسخ‌ها روی این دستگاه نگهداری می‌شوند.');
    return;
  }
  const commands = await local.pending(actor.uid);
  for (const command of commands) {
    if (command.blocked) {
      notice('بعضی پاسخ‌ها نیاز به بررسی معلم دارند: ' + command.blocked, true);
      continue;
    }
    if (!force && command.retryAt > Date.now()) break;
    try {
      const result = await api('submitAttempts', command.input);
      await local.acknowledge(command, result, profileStorageKey());
    } catch (error) {
      if (['FORBIDDEN', 'EVENT_CONFLICT', 'STALE_WRITER', 'INVALID_PAYLOAD'].includes(error.code)) {
        await local.block(command, error.code);
      } else {
        await local.retry(command);
      }
      break;
    }
  }
  state = (await local.get(profileStorageKey())) || state;
  render();
}

// v9 Student Entry & Profile Management
async function activateProfile(profile) {
  selectedId = profile.studentId;
  currentView = 'map';
  showGuide = false;
  state = (await local.get(profileStorageKey())) || { studentId: selectedId, session: null, stationRecords: [] };
  const membership = membershipContext(profile, state.classId);
  await saveState({
    ...state,
    studentId: selectedId,
    classId: membership?.classId || state.classId || null,
    className: membership?.name || state.className || '',
    membershipStatus: membership?.status || state.membershipStatus || null
  });
  await local.put(accountKey(), {
    ...((await local.get(accountKey())) || {}),
    activeStudentId: selectedId
  });
  if (!actor.offline) {
    try {
      const collection = await api('getCollection', { schemaVersion: 1, studentId: selectedId });
      if (Array.isArray(collection?.best)) {
        await saveState({ ...state, stationRecords: collection.best });
      }
    } catch {
      // Keep local stationRecords if collection endpoint is offline
    }
  }
  render();
}

async function loadEntry() {
  const previous = (await local.get(accountKey())) || {};
  const input = { schemaVersion: 1 };
  if (previous.studentId && previous.classId && !previous.entryMigrated) {
    input.legacyMembership = { studentId: previous.studentId, classId: previous.classId };
  }
  const result = await api('getEntry', input);
  profiles = result.profiles || [];
  if (input.legacyMembership) {
    await local.migrateProfile(accountKey(), studentKey(actor.uid, previous.studentId), actor.uid);
    await local.put(accountKey(), { ...previous, activeStudentId: previous.studentId, entryMigrated: true });
  }
  const profile = selectProfile(profiles, previous.activeStudentId || previous.studentId);
  if (profile) {
    await activateProfile(profile);
  } else {
    selectedId = null;
    state = { session: null, stationRecords: [] };
    render();
  }
}

async function signIn(provider) {
  selectedId = null;
  profiles = [];
  tokenProvider = provider;
  actor = await api('getIdentity', { schemaVersion: 1 });
  state = (await local.get(profileStorageKey())) || { session: null, stationRecords: [] };
  if (actor.teacher) {
    notice('پنل معلم آماده است.');
    render();
    await refreshTeacherClasses();
    if (state.classId) await refreshClass();
  } else {
    await loadEntry();
    if (typeof location !== 'undefined') {
      const invite = new URL(location.href).searchParams.get('invite');
      if (invite) {
        await local.put('entry-invite:' + actor.uid, invite);
        if ($('student-invite-input')) $('student-invite-input').value = invite;
      }
    }
    render();
    await flush();
  }
}

// Teacher Shell Operations (Classes, Invites, Members, Board)
async function refreshTeacherClasses() {
  if (!actor?.teacher || actor.offline) return;
  const data = await api('getTeacherClasses', { schemaVersion: 1 });
  const container = $('teacher-classes');
  if (!container) return;
  container.replaceChildren();
  for (const classroom of data.classes || []) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-button';
    btn.textContent = classroom.name;
    btn.onclick = () => run(async () => {
      await saveState({ ...state, classId: classroom.classId, className: classroom.name });
      await refreshClass();
      render();
    });
    container.append(btn);
  }
}

async function refreshClass() {
  if (!state.classId || actor?.offline) return;
  const classroom = await api('getClass', { schemaVersion: 1, classId: state.classId });
  teacherClass = classroom;
  if ($('toggle-leaderboard')) {
    $('toggle-leaderboard').hidden = false;
    $('toggle-leaderboard').textContent = classroom.policy?.leaderboard === 'on'
      ? 'خاموش‌کردن تابلو'
      : 'روشن‌کردن تابلو';
  }

  const membersEl = $('teacher-members');
  if (membersEl) {
    membersEl.replaceChildren();
    for (const member of classroom.members || []) {
      const row = document.createElement('div');
      row.className = 'member-row';
      const label = document.createElement('span');
      const statusText = { active: 'فعال', pending: 'منتظر تأیید', revoked: 'غیرفعال' }[member.status] || member.status;
      label.textContent = `${member.displayName} — ${statusText}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary-button';
      btn.textContent = member.status === 'active' ? 'لغو عضویت' : 'تأیید عضویت';
      btn.onclick = () => run(async () => {
        await api('setMembership', {
          ...request(),
          classId: state.classId,
          studentId: member.studentId,
          status: member.status === 'active' ? 'revoked' : 'active'
        });
        await refreshClass();
      });
      row.append(label, btn);
      membersEl.append(row);
    }
    if (!classroom.members?.length) {
      membersEl.textContent = 'هنوز دانش‌آموزی به این کلاس نپیوسته است.';
    }
  }

  const resultsEl = $('teacher-results');
  if (resultsEl) {
    resultsEl.replaceChildren();
    for (const sess of classroom.sessions || []) {
      const row = document.createElement('div');
      row.className = 'result-row';
      const studentName = classroom.members?.find(m => m.studentId === sess.studentId)?.displayName || 'دانش‌آموز';
      row.textContent = `${studentName} — ${fa(sess.score)} درست از ${fa(sess.total)} (${sess.status === 'FINALIZED' ? 'پایان‌یافته' : 'در حال انجام'})`;
      resultsEl.append(row);
      const review = (sess.mastery || []).filter(item => item.wrongAnswers?.length);
      if (review.length) {
        const note = document.createElement('p');
        note.className = 'review-note';
        note.textContent = 'پیشنهاد مرور: ' + review.map(item => `${fa(item.f1)} × ${fa(item.f2)}`).join('، ');
        resultsEl.append(note);
      }
    }
    if (!classroom.sessions?.length) {
      resultsEl.textContent = 'هنوز فعالیتی برای این کلاس ثبت نشده است.';
    }
  }
  render();
}

async function refreshBoard() {
  const entriesEl = $('board-entries');
  const statusEl = $('board-status');
  if (!entriesEl || !statusEl) return;
  entriesEl.replaceChildren();

  if (!state.classId || actor?.offline) {
    statusEl.textContent = 'بهترین دستاورد اعضای کلاس در سه بنای ایستگاه.';
    const records = state.stationRecords || [];
    for (const bId of [1, 2, 3]) {
      const rec = records.find(r => r.sectorId === bId);
      const li = document.createElement('li');
      li.className = 'board-row';
      li.dataset.me = 'true';
      li.textContent = `${BUILDING_NAMES[bId]}: ${rec ? `${fa(rec.score)} از ${fa(rec.total)} سلول روشن` : 'هنوز کامل نشده'}`;
      entriesEl.append(li);
    }
    return;
  }

  statusEl.textContent = 'در حال دریافت تابلوی کلاس…';
  const sectorId = Number($('board-sector')?.value || 1);
  const data = await api('getLeaderboard', {
    schemaVersion: 1,
    classId: state.classId,
    sectorId,
    ...(actor.teacher ? {} : { studentId: selectedId })
  });
  if ($('board-title')) $('board-title').textContent = `تابلوی نتایج — ${data.name}`;
  statusEl.textContent = !data.enabled
    ? 'معلم هنوز نمایش تابلوی نتایج این کلاس را روشن نکرده است.'
    : (!data.entries?.length ? 'هنوز نتیجه‌ای در این بنا ثبت نشده است.' : 'بهترین دستاورد اعضای کلاس در سه بنای ایستگاه.');

  for (const entry of data.entries || []) {
    const li = document.createElement('li');
    li.className = 'board-row';
    li.dataset.me = String(!!entry.isMe);
    li.textContent = `رتبهٔ ${fa(entry.rank)} · ${entry.displayName}${entry.isMe ? ' (تو)' : ''} — ${fa(entry.score)} از ${fa(entry.total)}`;
    entriesEl.append(li);
  }
}

async function enterOfflineStation() {
  actor = { uid: 'anon_student_local', teacher: false, offline: true };
  profiles = [{ studentId: 'student_1', displayName: 'کودک', avatar: 'astronaut' }];
  selectedId = 'student_1';
  const stored = await local.get(profileStorageKey());
  state = stored || { session: null, stationRecords: [] };
  render();
}

// Event Listeners Setup
function setupEvents() {
  // Sound toggle button (default muted)
  $('toggle-sound')?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    $('toggle-sound').textContent = soundEnabled ? 'صدا: روشن' : 'صدا: خاموش';
    $('toggle-sound').setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) {
      void playStationAudio(SOUND_EVENTS.accepted);
    }
  });

  // Map building touches
  [1, 2, 3].forEach(id => {
    const el = $(`building-${id === 1 ? 'power' : id === 2 ? 'tower' : 'pad'}`);
    if (!el) return;
    el.addEventListener('click', () => {
      const outcome = stationLayer.map.touchBuilding(id);
      if (outcome.staysOnMap) {
        notice(outcome.message);
        if (outcome.sound) void playStationAudio(outcome.sound);
      } else if (outcome.action === 'enter-building') {
        void startBuildingSession(id);
      }
    });
  });

  // Main button on bottom sheet
  $('sheet-main-button')?.addEventListener('click', () => {
    const action = stationLayer.sheet.onMainButton();
    if (action.canProceed) {
      void startBuildingSession(action.buildingId);
    }
  });

  // Map secondary guide
  $('map-guide-button')?.addEventListener('click', () => {
    showGuide = !showGuide;
    $('map-guide-info').hidden = !showGuide;
  });

  // Question secondary guide
  $('question-guide-button')?.addEventListener('click', () => {
    showGuide = !showGuide;
    renderQuestionView();
  });

  // Abandon button (رها کردن: برگشت به نقشه، بنا هنوز جاری است)
  $('question-abandon')?.addEventListener('click', () => {
    stationLayer.cells.onAbandon();
    currentView = 'map';
    showGuide = false;
    render();
  });

  // Question Answer Form
  $('question-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const inputVal = $('answer-input').value.trim();
    if (!inputVal) return;
    void handleAnswerSubmit(inputVal);
  });

  // Board Modal (کلاس من فقط تا تابلو)
  const openBoardHandler = () => {
    $('board-dialog').hidden = false;
    void refreshBoard().catch(() => {});
  };
  $('open-board-button')?.addEventListener('click', openBoardHandler);
  $('teacher-show-board')?.addEventListener('click', openBoardHandler);
  $('refresh-board-button')?.addEventListener('click', () => run(refreshBoard));
  $('board-sector')?.addEventListener('change', () => run(refreshBoard));
  $('close-board-button')?.addEventListener('click', () => {
    $('board-dialog').hidden = true;
  });

  // Offline / Local station entry button
  $('offline-station-login')?.addEventListener('click', () => run(enterOfflineStation));

  // Header actions: change hero, sync queue, logout
  $('change-hero')?.addEventListener('click', () => {
    selectedId = null;
    currentView = 'map';
    render();
  });

  $('sync-queue')?.addEventListener('click', () => run(() => flush(true)));

  $('logout-button')?.addEventListener('click', () => run(async () => {
    if (actor && !actor.offline && (await local.pending(actor.uid)).length) {
      throw new Error('پیش از خروج، پاسخ‌های منتظر را همگام‌سازی کنید.');
    }
    if (auth && authSdk) await authSdk.signOut(auth);
    sessionStorage.removeItem('v9-local-token');
    actor = null;
    tokenProvider = null;
    teacherClass = null;
    profiles = [];
    selectedId = null;
    state = {};
    render();
  }));

  // Create hero profile (online mode)
  $('hero-create-form')?.addEventListener('submit', e => {
    e.preventDefault();
    run(async () => {
      const name = $('hero-name').value.trim();
      if (!name) return;
      const avatar = $('hero-avatar')?.value || 'astronaut';
      if (actor?.offline) {
        const newProfile = { studentId: 'student_' + Date.now(), displayName: name, avatar };
        profiles.push(newProfile);
        await activateProfile(newProfile);
        return;
      }
      const opKey = operationKey('create');
      const pending = await local.prepareOperation(opKey, { ...request(), displayName: name, avatar });
      const created = await api('createStudent', pending);
      const entry = await api('getEntry', { schemaVersion: 1 });
      profiles = entry.profiles || [];
      const found = profiles.find(p => p.studentId === created.studentId);
      await local.put(opKey, null);
      if (found) await activateProfile(found);
    });
  });

  // Student join class form inside board modal
  $('student-join-class-form')?.addEventListener('submit', e => {
    e.preventDefault();
    run(async () => {
      const token = $('student-invite-input')?.value.trim();
      if (!token || !selectedId || actor?.offline) return;
      const opKey = operationKey('join:' + selectedId);
      const input = await local.prepareOperation(opKey, { ...request(), token, studentId: selectedId });
      const result = await api('joinStudentClass', input);
      await local.put(opKey, null);
      await saveState({ ...state, classId: result.classId, membershipStatus: result.status });
      $('student-invite-input').value = '';
      notice('درخواست پیوستن به کلاس ثبت شد.');
      await refreshBoard();
    });
  });

  // Teacher Shell forms & buttons
  $('refresh-teacher-classes')?.addEventListener('click', () => run(refreshTeacherClasses));

  $('create-class-form')?.addEventListener('submit', e => {
    e.preventDefault();
    run(async () => {
      const name = $('class-name-input').value.trim();
      if (!name) return;
      const membership = $('membership-policy')?.value || 'teacher_approval';
      const result = await api('createClass', {
        ...request(),
        name,
        policy: { leaderboard: 'off', membership }
      });
      $('class-name-input').value = '';
      await saveState({ ...state, classId: result.classId, className: result.name });
      await refreshTeacherClasses();
      await refreshClass();
      notice('کلاس تازه ساخته شد.');
    });
  });

  $('open-class-form')?.addEventListener('submit', e => {
    e.preventDefault();
    run(async () => {
      const classId = $('open-class-id').value.trim();
      if (!classId) return;
      await api('getClass', { schemaVersion: 1, classId });
      await saveState({ ...state, classId });
      await refreshClass();
      await refreshTeacherClasses();
    });
  });

  $('issue-invite')?.addEventListener('click', () => run(async () => {
    if (!state.classId) throw new Error('ابتدا یک کلاس را انتخاب کنید.');
    const result = await api('issueInvite', {
      ...request(),
      classId: state.classId,
      expiresInSeconds: 86400,
      maxUses: 40
    });
    if ($('invite-box')) $('invite-box').hidden = false;
    if ($('invite-token')) $('invite-token').value = result.token;
    if ($('invite-link') && typeof location !== 'undefined') {
      const link = new URL(location.origin + location.pathname);
      link.searchParams.set('invite', result.token);
      $('invite-link').value = link.href;
    }
    notice('پیوند دعوت ۲۴ ساعته آماده شد.');
  }));

  $('copy-invite')?.addEventListener('click', () => run(async () => {
    const val = $('invite-token')?.value;
    if (val && navigator.clipboard) {
      await navigator.clipboard.writeText(val);
      notice('کد دعوت کپی شد.');
    }
  }));

  $('copy-invite-link')?.addEventListener('click', () => run(async () => {
    const val = $('invite-link')?.value;
    if (val && navigator.clipboard) {
      await navigator.clipboard.writeText(val);
      notice('پیوند دعوت کپی شد.');
    }
  }));

  $('toggle-leaderboard')?.addEventListener('click', () => run(async () => {
    if (!teacherClass || teacherClass.classId !== state.classId) return;
    await api('setClassPolicy', {
      ...request(),
      classId: state.classId,
      revision: teacherClass.revision,
      leaderboard: teacherClass.policy?.leaderboard === 'on' ? 'off' : 'on'
    });
    await refreshClass();
  }));
}

// Bootstrap
export async function initApp() {
  local = await openLocal('math_game_v10');
  setupEvents();

  // Default immediate entry into offline/local Station mode so child map works out-of-the-box,
  // while probing v9 backend in the background if configured.
  await enterOfflineStation();

  if (!base) return;

  try {
    const meta = await connectApi(base);
    if (meta.mode === 'local') {
      const { accounts } = await (await fetch(base + '/api/dev/accounts')).json();
      if ($('local-accounts')) $('local-accounts').hidden = false;
      if ($('account-buttons')) {
        $('account-buttons').replaceChildren();
        for (const account of accounts || []) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'secondary-button';
          btn.textContent = account.name;
          btn.onclick = () => run(async () => {
            await signIn(async () => account.token);
            sessionStorage.setItem('v9-local-token', account.token);
          });
          $('account-buttons').append(btn);
        }
      }
      const savedToken = sessionStorage.getItem('v9-local-token');
      if (savedToken && (accounts || []).some(a => a.token === savedToken)) {
        await signIn(async () => savedToken);
      } else if ($('logout-button')) {
        $('logout-button').hidden = false;
      }
      return;
    }

    if (config.firebase) {
      ({ auth, sdk: authSdk } = await loadFirebaseLogin(config.firebase));
      if ($('firebase-login')) $('firebase-login').hidden = false;
      if ($('logout-button')) $('logout-button').hidden = false;

      if ($('google-login')) {
        $('google-login').onclick = () => {
          let pending;
          try {
            pending = googleLogin(auth, authSdk);
          } catch (err) {
            notice(loginError(err), true);
            return;
          }
          const outcome = Promise.resolve(pending).then(() => ({ ok: true }), error => ({ error }));
          run(async () => {
            const res = await outcome;
            if (res.error) {
              notice(loginError(res.error), true);
              return;
            }
            if (auth.currentUser) {
              await signIn(() => auth.currentUser.getIdToken());
            }
          });
        };
      }

      if ($('anonymous-login')) {
        $('anonymous-login').onclick = () => run(async () => {
          await authSdk.signInAnonymously(auth);
          await signIn(() => auth.currentUser.getIdToken());
        });
      }

      if ($('email-form')) {
        $('email-form').addEventListener('submit', e => {
          e.preventDefault();
          run(async () => {
            const email = $('email-input').value.trim();
            if (!email) return;
            if (authSdk.isSignInWithEmailLink(auth, location.href)) {
              await authSdk.signInWithEmailLink(auth, email, location.href);
              await signIn(() => auth.currentUser.getIdToken());
            } else {
              await authSdk.sendSignInLinkToEmail(auth, email, {
                url: location.origin + location.pathname,
                handleCodeInApp: true
              });
              notice('پیوند ورود به ایمیل شما ارسال شد.');
            }
          });
        });
      }

      await auth.authStateReady();
      if (auth.currentUser) {
        await signIn(() => auth.currentUser.getIdToken());
      }
    }
  } catch {
    // Stay seamlessly in local Station mode when server/Firebase is unreachable
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void flush(); });
  window.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => notice(err.message, true));
  });
}
