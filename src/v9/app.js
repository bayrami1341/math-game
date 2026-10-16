import { openLocal } from './local.mjs';
import { connectApi } from './connection.mjs';
import { studentKey, selectProfile, membershipContext } from './entry.mjs';
import { missionChoices } from './mission.mjs';
import { missions, flightProgress, keepStationRecord, stationPower, createSoundPlayer, stationSystems, nextDestination, multiplicationModel, companionLine } from './experience.mjs';

const $ = id => document.getElementById(id);
const config = window.MathGameV9Config;
const base = (config.apiBase || '').replace(/\/$/, '');
const fa = number => String(number).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
const number = value => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const request = () => ({ schemaVersion: 1, requestId: 'req_' + crypto.randomUUID() });
let local, actor, tokenProvider, auth, authSdk, state = {}, serial = Promise.resolve(), shownQuestionKey, questionShownAt;
let profiles = [], selectedId = null, storyStep = null, replaying = false, pendingCreation = null;
let screen = 'home', collection = null, motionPaused = false, choiceKey = null;
let soundEnabled = false;
let teacherClass = null;
let showingFlight = false;
let helpLevel = 0;
const playSound = createSoundPlayer(() => new (window.AudioContext || window.webkitAudioContext)());
const sound = kind => { if (soundEnabled) void playSound(kind).then(played => {
  if (!played) { soundEnabled = false; $('toggle-sound').textContent = 'صدا در دسترس نیست'; $('toggle-sound').setAttribute('aria-pressed', 'false'); }
}); };
const scenes = [
  ['پیام از ایستگاه', 'چراغ‌های ایستگاه فضایی کم‌نور شده‌اند. برای روشن‌کردنشان به کسی نیاز داریم که فکر کند، یاد بگیرد و دوباره تلاش کند.'],
  ['هر تلاش، یک قدم', 'قرار نیست از اول همهٔ جواب‌ها را بدانی. با تمرین، راه ساختن و پیش‌رفتن را پیدا می‌کنی.'],
  ['قهرمان داستان تویی', 'این سفر به یک قهرمان نیاز دارد؛ قهرمانی که با نام خودش وارد داستان شود.']
];
const notice = (message, error = false) => { $('notice').textContent = message; $('notice').dataset.error = String(error); };
const accountKey = () => 'profile:' + actor.uid;
const key = () => actor.teacher || !selectedId ? accountKey() : studentKey(actor.uid, selectedId);
const operationKey = name => 'entry-operation:' + actor.uid + ':' + name;
function run(task) {
  serial = serial.then(async () => {
    const buttons = [...document.querySelectorAll('button')]; buttons.forEach(button => { button.disabled = true; });
    try { await task(); } catch (error) { notice(error.message || 'عملیات انجام نشد.', true); }
    finally { document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  });
  return serial;
}
async function api(operation, input) {
  const response = await fetch(base + '/api/v9/' + operation, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await tokenProvider() }, body: JSON.stringify(input), signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok || !data.ok) { const error = new Error(data.error?.message || 'درخواست انجام نشد.'); error.code = data.error?.code; throw error; }
  return data;
}
async function save(next) { await local.put(key(), next); state = next; }
function render() {
  $('landing-intro').hidden = true;
  $('login').hidden = true; $('workspace').hidden = false;
  const profile = profiles.find(profile => profile.studentId === selectedId);
  $('identity').textContent = actor.teacher ? 'پنل معلم' : profile ? profile.displayName : 'سفر قهرمان';
  $('teacher').hidden = !actor.teacher;
  if (actor.teacher && teacherClass?.classId !== state.classId) {
    teacherClass = null; $('teacher-policy').hidden = true;
    $('invite-token').value = ''; $('invite-link').value = '';
  }
  $('student').hidden = actor.teacher || !profile || storyStep !== null;
  $('profile-picker').hidden = actor.teacher || !!profile || storyStep !== null;
  $('hero-story').hidden = actor.teacher || storyStep === null;
  if (!actor.teacher) {
    if (storyStep !== null) renderStory();
    $('profile-buttons').replaceChildren();
    profiles.forEach(item => {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = item.displayName + ' — ' + ({ astronaut: 'فضانورد', pilot: 'خلبان', scientist: 'دانشمند' }[item.avatar] || 'قهرمان') + ' · ' + item.studentId.slice(-4);
      button.onclick = () => run(() => activateProfile(item)); $('profile-buttons').append(button);
    });
    if (!profile) return;
    renderStation();
    $('back-station').hidden = screen === 'home';
    $('hero-greeting').textContent = ({ astronaut: '🧑‍🚀 ', pilot: '🚀 ', scientist: '🔬 ' }[profile.avatar] || '') + profile.displayName + '، به ایستگاه خودت خوش آمدی';
    $('join-card').hidden = screen !== 'classes';
    $('activity-settings').hidden = !['practice', 'missions'].includes(screen);
    $('collection').hidden = screen !== 'collection';
    const unfinished = state.session && state.session.status !== 'FINALIZED';
    $('resume-activity').hidden = !unfinished;
    $('resume-status').textContent = unfinished ? 'یک فعالیت نیمه‌تمام داری؛ پاسخ‌ها در پروندهٔ خودت نگهداری شده‌اند.' : 'امروز می‌خواهی کدام مسیر را ادامه بدهی؟';
    document.querySelectorAll('[data-screen]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.screen === screen)));
    $('student-classes').replaceChildren();
    for (const membership of profile.memberships || []) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary';
      button.textContent = membership.name + (membership.classId === state.classId ? ' ✓' : '');
      button.setAttribute('aria-pressed', String(membership.classId === state.classId));
      button.onclick = () => run(() => chooseClass(membership)); $('student-classes').append(button);
    }
    $('join-class').hidden = !!state.classId && !$('student-invite').value;
  }
  $('class-id').textContent = state.classId || '';
  $('open-class-id').value = state.classId || '';
  $('student-class-name').textContent = state.className || 'تمرین من';
  const status = state.membershipStatus;
  $('membership-status').textContent = { active: 'عضویت تأیید شد؛ آمادهٔ تمرین هستی.', pending: 'منتظر تأیید معلم هستی.', revoked: 'عضویت غیرفعال شده؛ از معلم کمک بگیر.' }[status] || 'اول به کلاس بپیوند.';
  $('check-membership').hidden = !state.classId;
  $('class-practice').hidden = status !== 'active';
  $('class-mission').hidden = status !== 'active';
  $('student-show-board').hidden = status !== 'active';
  $('class-context-option').disabled = status !== 'active';
  if (status !== 'active') $('activity-context').value = 'personal';
  const mission = screen === 'missions';
  const destination = missions[Number($('sector').value)] || missions[1];
  $('activity-eyebrow').textContent = mission ? 'مرکز فرماندهی / مقصد سفرت را انتخاب کن' : 'آزمایشگاه / فرصت کشف و مرور';
  $('mission-map').hidden = !mission;
  $('mission-objective').hidden = !mission;
  $('mission-objective').textContent = destination.objective;
  document.querySelectorAll('[data-sector]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sector === $('sector').value)));
  $('student-class-name').textContent = mission ? 'مأموریت نجات ایستگاه' : 'تمرین من';
  $('start-activity').textContent = mission ? 'شروع مأموریت' : 'شروع تمرین';
  $('activity-rules').textContent = mission ? 'قانون این مأموریت: هر سؤال یک پاسخ، هر پاسخ درست یک امتیاز. سرعت امتیاز اضافه ندارد و حرکت کارت‌ها قابل توقف است. نتیجه پس از تأیید سرور ثبت می‌شود؛ نتایج کلاس فقط با اجازهٔ معلم در تابلوی همان کلاس نمایش داده می‌شود.' : 'با آرامش پاسخ بده. پاسخ نادرست را با جواب درست مرور می‌کنی. این نتیجه سابقهٔ آموزشی است و وارد رکورد مأموریت نمی‌شود.';
  $('class-context-option').textContent = state.className ? 'کلاس: ' + state.className : 'کلاس انتخاب‌شده';
  $('practice').hidden = !showingFlight || !state.session || !['practice', 'missions'].includes(screen) || (state.session.activity === 'mission') !== mission;
  $('student').dataset.playing = String(!$('practice').hidden);
  if (!$('practice').hidden) $('activity-settings').hidden = true;
  if (!state.session) return;
  const session = state.session;
  const answered = session.answers || {};
  const question = session.questions.find(question => !answered[question.questionId]);
  $('progress').textContent = fa(Object.keys(answered).length) + ' از ' + fa(session.questions.length) + ' پاسخ روی این دستگاه';
  $('question').textContent = question ? `${fa(question.f1)} × ${fa(question.f2)} = ؟` : 'آفرین! تمرینت تمام شد.';
  $('session-context').textContent = (session.activity === 'mission' ? 'مأموریت' : 'تمرین') + ' — ' + (session.classId ? 'فعالیت کلاس' : 'پروندهٔ شخصی');
  $('answer-form').hidden = !question || session.status === 'FINALIZED' || session.activity === 'mission';
  $('finalize').hidden = !!question || session.status === 'FINALIZED';
  $('mission-controls').hidden = !question || session.status === 'FINALIZED' || session.activity !== 'mission';
  if (question && session.activity === 'mission' && choiceKey !== session.sessionId + ':' + question.questionId) {
    choiceKey = session.sessionId + ':' + question.questionId; $('mission-choices').replaceChildren();
    for (const value of missionChoices(question)) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = fa(value);
      button.onclick = () => run(() => submitAnswer(value, question.questionId)); $('mission-choices').append(button);
    }
  }
  if (question && shownQuestionKey !== session.sessionId + ':' + question.questionId) {
    helpLevel = 0;
    shownQuestionKey = session.sessionId + ':' + question.questionId; questionShownAt = performance.now();
  }
  const confirmed = Object.keys(session.receipts || {}).length;
  $('queue-status').textContent = fa(confirmed) + ' پاسخ در پروندهٔ سرور تأیید شده است.';
  if (session.status === 'FINALIZED') $('feedback').textContent = `نتیجهٔ نهایی: ${fa(session.score)} پاسخ درست از ${fa(session.questions.length)}`;
  renderFlight(session);
  renderHelp(question);
}
function renderStation() {
  const power = stationPower(state.stationRecords || []);
  $('station-power').textContent = fa(power) + '٪'; $('station-meter').value = power;
  $('station-home').hidden = screen !== 'home';
  $('station-report').hidden = screen !== 'home';
  $('station-home').dataset.phase = power === 0 ? 'dark' : power === 100 ? 'restored' : 'repairing';
  const systems = stationSystems(state.stationRecords || []);
  $('station-story').textContent = power === 100 ? 'نور، ارتباط و سکوی پرواز آماده‌اند. می‌توانی دوباره سفر کنی یا در آزمایشگاه کشف تازه‌ای داشته باشی.' : power ? 'نور دارد به ایستگاه برمی‌گردد؛ هر مسیر داستان خودش را دارد. بهترین سفرهایت اینجا می‌مانند.' : 'سه بخش ایستگاه منتظر کمک تو هستند. از هر مسیری که دوست داری شروع کن.';
  $('station-systems').replaceChildren();
  for (const system of systems) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'system-card secondary';
    button.dataset.complete = String(system.complete);
    button.textContent = system.icon + ' ' + system.destination + ' — ' + (system.complete ? 'روشن و آماده ✓' : system.started ? fa(system.percent) + '٪ روشن شده' : 'آمادهٔ اولین سفر');
    button.onclick = () => chooseDestination(system.sectorId);
    $('station-systems').append(button);
  }
}
function chooseDestination(sectorId) {
  screen = 'missions'; showingFlight = false; $('sector').value = String(sectorId); render(); $('activity-settings').scrollIntoView({ block: 'start' });
}
function renderHelp(question) {
  const model = multiplicationModel(question);
  const available = state.session?.activity === 'practice' && state.session.status !== 'FINALIZED' && !!model;
  $('practice-help').hidden = !available;
  $('help-picture').hidden = !available || !helpLevel;
  $('show-help').setAttribute('aria-expanded', String(available && helpLevel > 0));
  $('show-help').textContent = helpLevel === 0 ? '💡 با هم بسازیم' : helpLevel === 1 ? 'حالا جمع و جواب را ببینیم' : 'بستن راهنما';
  $('help-groups').replaceChildren();
  if (!available || !helpLevel) return;
  $('help-description').textContent = fa(model.groups) + ' گروه داریم؛ در هر گروه ' + fa(model.each) + ' ستاره است.';
  for (let group = 0; group < model.groups; group++) {
    const frame = document.createElement('div'); frame.className = 'star-group';
    for (let star = 0; star < model.each; star++) { const dot = document.createElement('span'); dot.textContent = '✦'; frame.append(dot); }
    $('help-groups').append(frame);
  }
  $('help-equation').textContent = helpLevel >= 2 ? model.addends.map(fa).join(' + ') + ' = ' + fa(model.total) : '';
}
function renderFlight(session) {
  const progress = flightProgress(session), mission = session.activity === 'mission';
  const destination = missions[session.sectorId] || missions[1];
  $('flight-scene').dataset.sector = mission ? String(session.sectorId) : 'practice';
  $('flight-destination-note').textContent = mission ? destination.objective : 'در آزمایشگاه می‌توانی جواب‌ها را با گروه‌های ستاره بسازی؛ راهنما فقط برای همین تمرین است.';
  $('companion-message').textContent = companionLine(session).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  $('flight-title').textContent = mission ? destination.icon + ' ' + destination.title : '🌱 آزمایشگاه کشف جواب‌ها';
  $('flight-chapter').textContent = 'قدم ' + fa(progress.answered) + ' از ' + fa(progress.total);
  const chapters = mission ? [destination.destination + ' در انتظار توست', 'از زمین فاصله گرفتیم!', 'مقصد نزدیک است…', 'رسیدیم؛ حالا پایان سفر را ثبت کن'] : ['آزمایشگاه آمادهٔ کشف توست', 'داریم راه جواب‌ها را پیدا می‌کنیم', 'چند کشف دیگر تا پایان تمرین', 'مرور تمام شد؛ پایان تمرین را ثبت کن'];
  $('flight-message').textContent = progress.finalized ? 'این سفر در داستان تو ماند' : chapters[progress.stage];
  $('flight-energy').textContent = fa(progress.lit) + ' سلول روشن' + (progress.pending ? ' — ' + fa(progress.pending) + ' پاسخ هنوز منتظر تأیید است' : progress.answered ? ' — پاسخ‌ها تأیید شده‌اند' : ' — آمادهٔ اولین قدم');
  $('flight-meter').value = progress.percent;
  $('flight-ship').style.left = (14 + progress.percent * 0.57) + '%';
  $('flight-ship').style.top = (65 - progress.percent * 0.55) + '%';
  $('energy-cells').replaceChildren();
  for (let index = 0; index < progress.total; index++) {
    const cell = document.createElement('span'); cell.dataset.lit = String(index < progress.lit); $('energy-cells').append(cell);
  }
  $('question-prompt').textContent = mission ? 'کدام سلول، جواب درست را دارد؟' : 'جواب را کشف کن؛ اینجا فرصت تمرین توست.';
  $('answer-deck').hidden = progress.finalized;
  $('flight-result').hidden = !progress.finalized;
  if (progress.finalized) {
    const perfect = session.score === progress.total;
    $('flight-result').dataset.perfect = String(perfect);
    $('result-title').textContent = perfect ? 'همهٔ چراغ‌های این مسیر روشن شد!' : 'یک قدم دیگر در مسیر یادگیری!';
    $('result-description').textContent = fa(session.score) + ' پاسخ درست از ' + fa(progress.total) + '؛ ' + (mission ? 'نتیجه ثبت شد. بهترین نتیجهٔ هر مسیر به روشنایی ایستگاه کمک می‌کند.' : 'این سفر در سابقهٔ تمرینت ماند؛ می‌توانی برای مأموریت بعدی آماده شوی.');
    $('companion-message').textContent = perfect ? 'چه سفر روشنی! حالا برویم یادگاری‌اش را ببینیم.' : 'تلاشت را دیدم! جواب‌هایی که سخت بودند را در تمرین دوباره پیدا می‌کنیم.';
  }
}
function renderStory() {
  $('story-art').dataset.scene = String(storyStep);
  const final = storyStep >= scenes.length;
  const profile = profiles.find(profile => profile.studentId === selectedId);
  $('story-step').textContent = 'داستان ایستگاه — ' + fa(Math.min(storyStep + 1, scenes.length + 1)) + ' از ' + fa(scenes.length + 1);
  $('story-title').textContent = final ? replaying ? 'قهرمان این داستان: ' + profile.displayName : 'ایستگاه منتظر قهرمانش است' : scenes[storyStep][0];
  $('story-text').textContent = final ? replaying ? 'این سفر با همان نام و پروندهٔ تو ادامه پیدا می‌کند.' : 'نامت را اینجا بنویس؛ در بازی و کلاس با همین نام شناخته می‌شوی.' : scenes[storyStep][1];
  $('story-navigation').hidden = final;
  $('hero-introduction').hidden = !final || replaying;
  $('story-return').hidden = !final || !replaying;
  if (pendingCreation) {
    $('hero-name').value = pendingCreation.displayName; $('hero-avatar').value = pendingCreation.avatar;
  }
  $('hero-name').readOnly = !!pendingCreation; $('hero-avatar').disabled = !!pendingCreation;
}
async function activateProfile(profile) {
  $('class-board').hidden = true; $('board-entries').replaceChildren();
  showingFlight = false;
  selectedId = profile.studentId; storyStep = null; replaying = false; shownQuestionKey = null; choiceKey = null; collection = null; screen = 'home';
  $('achievements').replaceChildren(); $('personal-records').replaceChildren(); $('activity-history').replaceChildren();
  state = await local.get(key()) || { studentId: selectedId };
  const membership = membershipContext(profile, state.classId);
  await save({ ...state, studentId: selectedId, classId: membership?.classId || null, className: membership?.name || '', membershipStatus: membership?.status || null });
  await local.put(accountKey(), { ...(await local.get(accountKey()) || {}), activeStudentId: selectedId });
  $('feedback').textContent = ''; render();
  if (state.classId) await refreshMembership();
}
async function chooseClass(membership) {
  if (state.session && state.session.status !== 'FINALIZED' && state.session.classId !== membership.classId) throw new Error('ابتدا تمرین فعلی را تمام کن؛ پاسخ‌ها به کلاس همان تمرین تعلق دارند.');
  $('class-board').hidden = true; $('board-entries').replaceChildren();
  await save({ ...state, classId: membership.classId, className: membership.name, membershipStatus: membership.status });
  render(); await refreshMembership();
}
async function refreshCollection() {
  collection = await api('getCollection', { schemaVersion: 1, studentId: selectedId });
  await save({ ...state, stationRecords: collection.best }); renderStation();
  const fill = (id, entries, empty) => {
    $(id).replaceChildren();
    for (const text of entries.length ? entries : [empty]) { const paragraph = document.createElement('p'); paragraph.className = 'result'; paragraph.textContent = text; $(id).append(paragraph); }
  };
  fill('achievements', collection.achievements.map(item => item.title + ' — ' + item.condition), 'با پایان اولین فعالیت، نخستین نشان تو اینجا می‌آید.');
  fill('personal-records', collection.best.map(item => 'بخش ' + fa(item.sectorId) + ': ' + fa(item.score) + ' پاسخ درست از ' + fa(item.total)), 'هنوز مأموریت تأییدشده‌ای نداری.');
  fill('activity-history', collection.sessions.map(item => (item.activity === 'mission' ? 'مأموریت' : 'تمرین') + ' — ' + fa(item.score) + ' درست از ' + fa(item.answered) + ' پاسخ ثبت‌شده' + (item.status === 'FINALIZED' ? ' — پایان‌یافته' : ' — نیمه‌تمام')), 'هنوز فعالیتی ثبت نشده است.');
  if (collection.historyTruncated) { const note = document.createElement('p'); note.textContent = 'فقط ۲۰ فعالیت اخیر نمایش داده می‌شود؛ رکوردها و نشان‌های قدیمی حفظ می‌شوند.'; $('activity-history').append(note); }
}
async function loadEntry() {
  const previous = await local.get(accountKey()) || {};
  const input = { schemaVersion: 1 };
  if (previous.studentId && previous.classId && !previous.entryMigrated) input.legacyMembership = { studentId: previous.studentId, classId: previous.classId };
  const result = await api('getEntry', input); profiles = result.profiles;
  if (input.legacyMembership) {
    await local.migrateProfile(accountKey(), studentKey(actor.uid, previous.studentId), actor.uid);
    await local.put(accountKey(), { ...previous, activeStudentId: previous.studentId, entryMigrated: true });
  }
  pendingCreation = await local.get(operationKey('create'));
  const profile = selectProfile(profiles, previous.activeStudentId || previous.studentId);
  if (pendingCreation) { selectedId = null; state = {}; storyStep = scenes.length; render(); }
  else if (profile) await activateProfile(profile);
  else { selectedId = null; state = {}; storyStep = profiles.length ? null : 0; render(); }
  if (result.profilesTruncated || profiles.some(profile => profile.membershipsTruncated)) notice('فهرست پرونده‌ها یا کلاس‌ها کامل نیست؛ برای ادامه از مدیر سامانه کمک بگیر.', true);
}
async function signIn(provider) {
  selectedId = null; profiles = []; storyStep = null; pendingCreation = null;
  tokenProvider = provider;
  actor = await api('getIdentity', { schemaVersion: 1 });
  notice(actor.teacher ? 'کلاس خود را بسازید یا ادامه دهید.' : 'سفر تو با همین پرونده ادامه پیدا می‌کند.');
  state = await local.get(key()) || {};
  $('members').replaceChildren(); $('results').replaceChildren(); $('invite-token').value = ''; $('feedback').textContent = '';
  $('class-board').hidden = true;
  if (actor.teacher) { render(); await refreshTeacherClasses(); await refreshClass(); }
  else {
    await loadEntry();
    const invite = new URL(location.href).searchParams.get('invite');
    if (invite) {
      await local.put('entry-invite:' + actor.uid, invite);
      const url = new URL(location.href); url.searchParams.delete('invite'); history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    $('student-invite').value = await local.get('entry-invite:' + actor.uid) || '';
    render(); await flush();
  }
}
async function refreshMembership() {
  if (!state.classId) return;
  if (actor.teacher) return refreshClass();
  const data = await api('getClass', { schemaVersion: 1, classId: state.classId, studentId: state.studentId });
  const membership = profiles.find(profile => profile.studentId === selectedId)?.memberships.find(member => member.classId === state.classId);
  if (membership) { membership.status = data.membershipStatus; membership.name = data.name; }
  await save({ ...state, className: data.name, membershipStatus: data.membershipStatus }); render();
}
async function refreshClass() {
  if (!state.classId) return;
  const classroom = await api('getClass', { schemaVersion: 1, classId: state.classId });
  teacherClass = classroom;
  $('teacher-policy').hidden = false;
  $('toggle-leaderboard').textContent = classroom.policy.leaderboard === 'on' ? 'خاموش‌کردن تابلو' : 'روشن‌کردن تابلو';
  $('teacher-summary').textContent = fa(classroom.members.filter(m => m.status === 'active').length) + ' عضو فعال، ' + fa(classroom.members.filter(m => m.status === 'pending').length) + ' منتظر تأیید؛ ' + fa(classroom.sessions.filter(s => s.status === 'FINALIZED').length) + ' فعالیت پایان‌یافته در گزارش اخیر.';
  $('members').replaceChildren(); $('results').replaceChildren();
  for (const member of classroom.members) {
    const row = document.createElement('div'); row.className = 'member';
    const label = document.createElement('p'); label.textContent = member.displayName + ' — ' + ({ active: 'فعال', pending: 'منتظر تأیید', revoked: 'غیرفعال' }[member.status]); row.append(label);
    const button = document.createElement('button'); button.className = 'secondary'; button.textContent = member.status === 'active' ? 'لغو عضویت' : 'تأیید عضویت';
    button.onclick = () => run(async () => { await api('setMembership', { ...request(), classId: state.classId, studentId: member.studentId, status: member.status === 'active' ? 'revoked' : 'active' }); await refreshClass(); if (!$('class-board').hidden) await refreshBoard(); });
    row.append(button); $('members').append(row);
  }
  if (!classroom.members.length) $('members').textContent = 'هنوز دانش‌آموزی نپیوسته است.';
  if (classroom.membersTruncated) { const note = document.createElement('p'); note.textContent = 'نمایش اعضا در این پیش‌نمایش به ۱۰۰ نفر محدود است.'; $('members').append(note); }
  for (const session of classroom.sessions) {
    const line = document.createElement('p'); line.className = 'result';
    const name = classroom.members.find(member => member.studentId === session.studentId)?.displayName || 'دانش‌آموز';
    line.textContent = `${name} — ${session.activity === 'mission' ? 'مأموریت' : 'تمرین'}: ${fa(session.score)} درست از ${fa(session.total)} سؤال؛ ${fa(session.answered)} پاسخ ثبت‌شده — ${session.status === 'FINALIZED' ? 'پایان‌یافته' : 'در حال انجام'}`;
    $('results').append(line);
    const review = session.mastery.filter(item => item.wrongAnswers?.length);
    if (review.length) {
      const note = document.createElement('p'); note.className = 'review-note';
      note.textContent = 'پیشنهاد مرور همین نوبت: ' + review.map(item => fa(item.f1) + ' × ' + fa(item.f2)).join('، ') + '؛ نتیجهٔ یک نوبت، تشخیص قطعی تسلط نیست.';
      $('results').append(note);
    }
  }
  if (!classroom.sessions.length) $('results').textContent = 'هنوز فعالیتی برای این کلاس ثبت نشده است.';
  if (classroom.historyTruncated) { const note = document.createElement('p'); note.textContent = 'فقط ۲۰ جلسهٔ آخر نمایش داده می‌شود.'; $('results').append(note); }
}
async function refreshTeacherClasses() {
  const data = await api('getTeacherClasses', { schemaVersion: 1 });
  $('teacher-classes').replaceChildren();
  for (const classroom of data.classes) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = classroom.name;
    button.onclick = () => run(async () => { $('class-board').hidden = true; await save({ ...state, classId: classroom.classId, className: classroom.name }); render(); await refreshClass(); });
    $('teacher-classes').append(button);
  }
  if (!data.classes.length) $('teacher-classes').textContent = 'هنوز کلاسی نساخته‌اید. کلاس قدیمی را یک‌بار با شناسه باز کنید تا اینجا اضافه شود.';
  if (data.truncated) notice('فقط ۱۰۰ کلاس نمایش داده می‌شود.', true);
}
async function refreshBoard() {
  $('board-entries').replaceChildren(); $('board-status').textContent = 'در حال دریافت نتیجه…';
  if (!state.classId) throw new Error('ابتدا کلاس را انتخاب کنید.');
  let data;
  try { data = await api('getLeaderboard', { schemaVersion: 1, classId: state.classId, sectorId: Number($('board-sector').value), ...(actor.teacher ? {} : { studentId: selectedId }) }); }
  catch (error) { $('board-status').textContent = 'تابلو دریافت نشد؛ اتصال یا وضعیت عضویت را بررسی و دوباره تلاش کنید.'; throw error; }
  $('board-title').textContent = 'تابلوی نتایج — ' + data.name;
  $('board-status').textContent = !data.enabled ? 'معلم هنوز نمایش نتایج کلاس را روشن نکرده است.' : !data.entries.length ? 'هنوز مأموریت پایان‌یافته‌ای در این مسیر ثبت نشده است.' : data.truncated ? 'نمایش محدود است؛ این رتبه‌بندی شامل همهٔ اعضا نیست.' : 'نتیجه‌های تأییدشدهٔ اعضای فعال همین کلاس';
  for (const entry of data.entries) {
    const row = document.createElement('li'); row.className = 'board-row'; row.dataset.me = String(entry.isMe);
    row.textContent = 'رتبهٔ ' + fa(entry.rank) + ' · ' + entry.displayName + (entry.isMe ? ' (تو)' : '') + ' — ' + fa(entry.score) + ' از ' + fa(entry.total); $('board-entries').append(row);
  }
}
async function openBoard() { $('class-board').hidden = false; await refreshBoard(); $('class-board').scrollIntoView({ block: 'start' }); }
async function flush(force = false) {
  if (!actor || actor.teacher) return;
  if (!navigator.onLine) { notice('اینترنت قطع است؛ پاسخ‌ها روی این دستگاه نگهداری می‌شوند.'); return; }
  const commands = await local.pending(actor.uid);
  for (const command of commands) {
    if (command.blocked) { notice('بعضی پاسخ‌ها نیاز به بررسی معلم دارند: ' + command.blocked, true); continue; }
    if (!force && command.retryAt > Date.now()) break;
    try {
      const result = await api('submitAttempts', command.input);
      await local.acknowledge(command, result, key());
      const last = result.receipts.at(-1);
      if (state.session?.sessionId === result.sessionId && (!command.stateKey || command.stateKey === key())) {
        const attempt = command.input.attempts.find(attempt => attempt.eventId === last.eventId);
        const question = state.session.questions.find(question => question.questionId === attempt?.questionId);
        $('feedback').textContent = last.correct ? 'پاسخ قبلی درست بود و در پرونده تأیید شد؛ آفرین!' : 'پاسخ قبلی نیاز به مرور داشت؛ جواب درست ' + fa(question.f1 * question.f2) + ' بود. پاسخ تو در پرونده تأیید شد.';
      }
    } catch (error) {
      if (['FORBIDDEN', 'EVENT_CONFLICT', 'STALE_WRITER', 'INVALID_PAYLOAD'].includes(error.code)) await local.block(command, error.code);
      else await local.retry(command);
      notice(error.code ? error.message : 'پاسخ روی این دستگاه ذخیره است؛ ارسال با برگشت ارتباط ادامه می‌یابد.', true);
      break;
    }
  }
  state = await local.get(key()) || {}; render();
}

const form = (id, task) => $(id).addEventListener('submit', event => { event.preventDefault(); run(task); });
const focusStory = () => { render(); $('story-title').focus(); };
document.querySelectorAll('[data-screen]').forEach(button => { button.onclick = () => run(async () => {
  screen = button.dataset.screen; showingFlight = false; $('class-board').hidden = true; render();
  if (screen === 'collection') await refreshCollection();
}); });
$('resume-activity').onclick = () => { showingFlight = true; screen = state.session.activity === 'mission' ? 'missions' : 'practice'; render(); $('practice').scrollIntoView({ block: 'start' }); };
$('refresh-teacher-classes').onclick = () => run(refreshTeacherClasses);
$('toggle-leaderboard').onclick = () => run(async () => {
  if (!teacherClass || teacherClass.classId !== state.classId) throw new Error('کلاس را تازه‌سازی کنید.');
  await api('setClassPolicy', { ...request(), classId: state.classId, revision: teacherClass.revision, leaderboard: teacherClass.policy.leaderboard === 'on' ? 'off' : 'on' });
  await refreshClass(); if (!$('class-board').hidden) await refreshBoard();
});
$('teacher-show-board').onclick = $('student-show-board').onclick = () => run(openBoard);
$('refresh-board').onclick = () => run(refreshBoard);
$('board-sector').addEventListener('change', () => run(refreshBoard));
$('close-board').onclick = () => { $('class-board').hidden = true; };
$('class-mission').onclick = () => { screen = 'missions'; showingFlight = false; $('activity-context').value = 'class'; render(); };
$('class-practice').onclick = () => { screen = 'practice'; $('activity-context').value = 'class'; render(); };
$('refresh-collection').onclick = () => run(refreshCollection);
$('next-destination').onclick = () => chooseDestination(nextDestination(state.stationRecords || []));
$('show-help').onclick = () => {
  if (state.session?.activity !== 'practice' || state.session.status === 'FINALIZED') return;
  helpLevel = (helpLevel + 1) % 3;
  renderHelp(state.session.questions.find(question => !state.session.answers[question.questionId]));
};
$('back-station').onclick = () => { screen = 'home'; render(); };
$('launch-mission').onclick = () => { screen = 'missions'; showingFlight = false; render(); $('activity-settings').scrollIntoView({ block: 'start' }); };
$('result-home').onclick = () => { screen = 'home'; render(); $('station-home').scrollIntoView({ block: 'start' }); };
$('result-collection').onclick = () => run(async () => { screen = 'collection'; render(); await refreshCollection(); $('collection').scrollIntoView({ block: 'start' }); });
document.querySelectorAll('[data-sector]').forEach(button => { button.onclick = () => { $('sector').value = button.dataset.sector; render(); }; });
$('sector').addEventListener('change', render);
$('toggle-sound').onclick = () => {
  soundEnabled = !soundEnabled;
  $('toggle-sound').textContent = soundEnabled ? 'صدا: روشن' : 'صدا: خاموش';
  $('toggle-sound').setAttribute('aria-pressed', String(soundEnabled)); sound('correct');
};
$('toggle-motion').onclick = () => {
  motionPaused = !motionPaused; $('mission-choices').dataset.paused = String(motionPaused);
  $('student').dataset.motionPaused = String(motionPaused);
  $('toggle-motion').setAttribute('aria-pressed', String(motionPaused)); $('toggle-motion').textContent = motionPaused ? 'ادامهٔ حرکت کارت‌ها' : 'توقف حرکت کارت‌ها';
};
$('story-next').onclick = () => { storyStep++; focusStory(); };
$('story-skip').onclick = () => { storyStep = scenes.length; focusStory(); };
$('story-return').onclick = () => { storyStep = null; replaying = false; render(); };
$('replay-story').onclick = () => { replaying = true; storyStep = 0; focusStory(); };
$('change-hero').onclick = () => run(async () => {
  $('class-board').hidden = true; selectedId = null; state = {}; storyStep = null; $('feedback').textContent = ''; render();
});
$('new-hero').onclick = () => { replaying = false; storyStep = 0; $('hero-name').value = ''; focusStory(); };
$('show-invite').onclick = () => { $('join-class').hidden = false; $('student-invite').focus(); };
form('hero-introduction', async () => {
  const name = $('hero-name').value.trim();
  if (!name) throw new Error('نام قهرمانت را بنویس.');
  pendingCreation = await local.prepareOperation(operationKey('create'), { ...request(), displayName: name, avatar: $('hero-avatar').value });
  renderStory();
  const created = await api('createStudent', pendingCreation);
  const result = await api('getEntry', { schemaVersion: 1 }); profiles = result.profiles;
  const profile = profiles.find(profile => profile.studentId === created.studentId);
  if (!profile) throw new Error('پرونده ثبت شد؛ برای بازیابی فهرست دوباره تلاش کن.');
  await activateProfile(profile);
  await local.put(operationKey('create'), null); pendingCreation = null;
  notice(profile.displayName + '، از اینجا به بعد قهرمان داستان خودت هستی.');
});
form('create-class', async () => {
  const result = await api('createClass', { ...request(), name: $('class-name').value.trim(), policy: { leaderboard: 'off', membership: $('membership').value } });
  await save({ classId: result.classId, className: result.name }); render(); await refreshClass(); await refreshTeacherClasses(); notice('کلاس ساخته شد. اکنون دعوت دانش‌آموز را بسازید.');
});
form('open-class', async () => {
  const classId = $('open-class-id').value.trim(); await api('getClass', { schemaVersion: 1, classId }); await save({ ...state, classId }); render(); await refreshClass(); await refreshTeacherClasses();
});
$('issue-invite').onclick = () => run(async () => {
  if (!state.classId) throw new Error('ابتدا کلاس را بسازید یا باز کنید.');
  const result = await api('issueInvite', { ...request(), classId: state.classId, expiresInSeconds: 86400, maxUses: 40 });
  $('invite-token').value = result.token;
  const link = new URL(location.origin + location.pathname); link.searchParams.set('invite', result.token); $('invite-link').value = link.href;
  notice('دعوت برای ۲۴ ساعت و حداکثر ۴۰ عضویت آماده است؛ فقط برای دانش‌آموزان همین کلاس بفرستید.');
});
$('copy-invite').onclick = () => run(async () => { await navigator.clipboard.writeText($('invite-token').value); notice('دعوت کپی شد.'); });
$('copy-invite-link').onclick = () => run(async () => { if (!$('invite-link').value) throw new Error('ابتدا دعوت را بسازید.'); await navigator.clipboard.writeText($('invite-link').value); notice('پیوند ورود به کلاس کپی شد.'); });
form('join-class', async () => {
  if (state.session && state.session.status !== 'FINALIZED') throw new Error('ابتدا تمرین فعلی را تمام کن؛ دعوتت را بعد از آن وارد کن.');
  const operation = operationKey('join:' + selectedId);
  const input = await local.prepareOperation(operation, { ...request(), token: $('student-invite').value.trim(), studentId: selectedId });
  $('student-invite').value = input.token;
  let result;
  try { result = await api('joinStudentClass', input); }
  catch (error) {
    if (['INVITE_EXPIRED', 'INVALID_PAYLOAD', 'FORBIDDEN'].includes(error.code)) await local.put(operation, null);
    throw error;
  }
  const entry = await api('getEntry', { schemaVersion: 1 }); profiles = entry.profiles;
  await save({ ...state, classId: result.classId, membershipStatus: result.status });
  await local.put(operation, null); await local.put('entry-invite:' + actor.uid, null);
  $('student-invite').value = ''; render(); await refreshMembership();
});
$('check-membership').onclick = () => run(refreshMembership);
form('start-session', async () => {
  if ((await local.pending(actor.uid)).some(command => command.stateKey === key())) throw new Error('پاسخ‌های منتظر این پرونده را پیش از فعالیت تازه ارسال کن.');
  if (state.session && state.session.status !== 'FINALIZED') throw new Error('ابتدا تمرین فعلی را تمام کن.');
  const operation = operationKey('start:' + selectedId);
  const input = await local.prepareOperation(operation, { ...request(), studentId: selectedId, activity: screen === 'missions' ? 'mission' : 'practice', sectorId: Number($('sector').value), ...($('activity-context').value === 'class' ? { classId: state.classId } : {}) });
  let result;
  try { result = await api('startActivity', input); }
  catch (error) { if (['INVALID_PAYLOAD', 'FORBIDDEN'].includes(error.code)) await local.put(operation, null); throw error; }
  await save({ ...state, session: { ...result, answers: {}, receipts: {} } }); showingFlight = true; render(); if (result.activity !== 'mission') $('answer').focus();
  $('answer-deck').dataset.reaction = '';
  screen = result.activity === 'mission' ? 'missions' : 'practice'; choiceKey = null;
  await local.put(operation, null); render(); notice(result.activity === 'mission' ? 'مأموریت شروع شد؛ از میان کارت‌ها پاسخ را انتخاب کن.' : 'تمرین شروع شد؛ با آرامش فکر کن.');
  $('practice').scrollIntoView({ block: 'start' });
});
form('answer-form', async () => {
  const text = number($('answer').value.trim());
  if (!/^-?\d{1,5}$/.test(text) || Math.abs(Number(text)) > 10000) throw new Error('پاسخ را با عدد تا ۱۰۰۰۰ وارد کن.');
  await submitAnswer(Number(text));
});
async function submitAnswer(value, expectedQuestionId) {
  const session = state.session;
  const question = session.questions.find(question => !session.answers[question.questionId]);
  if (!question || session.status === 'FINALIZED' || (expectedQuestionId && question.questionId !== expectedQuestionId)) return;
  const attempt = { eventId: 'evt_' + crypto.randomUUID(), questionId: question.questionId, answer: value, responseMs: Math.min(3600000, Math.max(0, Math.round(performance.now() - questionShownAt))), clientOccurredAt: new Date().toISOString() };
  const input = { ...request(), sessionId: session.sessionId, writerEpoch: session.writerEpoch, attempts: [attempt] };
  const next = structuredClone(state); next.session.answers[question.questionId] = attempt;
  await local.enqueue(key(), next, { uid: actor.uid, studentId: selectedId, input }); state = next;
  const correct = value === question.f1 * question.f2;
  $('answer-deck').dataset.reaction = correct ? 'correct' : 'review';
  sound(correct ? 'correct' : 'review');
  $('answer').value = ''; $('feedback').textContent = value === question.f1 * question.f2 ? 'آفرین! پاسخ روی این دستگاه ذخیره شد؛ در انتظار تأیید.' : 'پاسخ درست ' + fa(question.f1 * question.f2) + ' بود. این سؤال را دوباره مرور کن؛ پاسخ تو برای ارسال ذخیره شد.';
  render(); if (session.activity !== 'mission') $('answer').focus(); await flush();
}
$('sync').onclick = () => run(() => flush(true));
$('finalize').onclick = () => run(async () => {
  await flush();
  if ((await local.pending(actor.uid)).some(command => command.input.sessionId === state.session.sessionId)) throw new Error('همهٔ پاسخ‌های این نوبت هنوز تأیید نشده‌اند؛ دوباره ارسال کن.');
  const operation = operationKey('finish:' + state.session.sessionId);
  const input = await local.prepareOperation(operation, { ...request(), sessionId: state.session.sessionId, writerEpoch: state.session.writerEpoch });
  const result = await api('finalizeSession', input);
  await save({ ...state, stationRecords: keepStationRecord(state.stationRecords || [], state.session, result), session: { ...state.session, status: result.status, score: result.score } }); render(); sound('finish'); notice('تمرینت در پرونده ثبت شد.');
  await local.put(operation, null);
  notice(state.session.activity === 'mission' ? 'نتیجهٔ مأموریت تأیید شد؛ رکورد و نشان‌ها را در گنجینه ببین.' : 'تمرینت در سابقهٔ آموزشی ثبت شد.');
});
$('logout').onclick = () => run(async () => {
  if ((await local.pending(actor.uid)).length) throw new Error('پیش از خروج، پاسخ‌های منتظر را همگام کن.');
  if (auth?.currentUser?.isAnonymous && !window.confirm('ورود دوباره به همین پرونده پس از خروج از حساب ناشناس، هنوز در این پیش‌نمایش فراهم نیست. خارج می‌شوی؟')) return;
  if (auth) await authSdk.signOut(auth);
  $('class-board').hidden = true; $('board-entries').replaceChildren(); teacherClass = null;
  sessionStorage.removeItem('v9-local-token'); actor = null; tokenProvider = null; state = {}; profiles = []; selectedId = null; storyStep = null;
  $('landing-intro').hidden = false;
  $('hero-name').value = ''; $('student-invite').value = ''; $('workspace').hidden = true; $('login').hidden = false; notice('از حساب خارج شدی. پاسخ‌های ارسال‌نشده برای همین حساب محفوظ‌اند.');
});
window.addEventListener('online', () => run(flush));
document.addEventListener('visibilitychange', () => { if (!document.hidden) run(flush); });
setInterval(() => { if (actor && !actor.teacher && !document.hidden) run(flush); }, 15000);

run(async () => {
  local = await openLocal();
  let meta;
  try {
    notice('در حال اتصال به ایستگاه…');
    meta = await connectApi(base, { onWaiting: () => notice('ایستگاه در حال بیدارشدن است؛ اتصال دوباره بررسی می‌شود…') });
  } catch {
    $('unconfigured').hidden = false; notice('برای این پیش‌نمایش، سرور هنوز در دسترس نیست.'); return;
  }
  $('login').hidden = false;
  if (meta.mode === 'local') {
    const { accounts } = await (await fetch(base + '/api/dev/accounts')).json();
    $('local-accounts').hidden = false;
    for (const account of accounts) {
      const button = document.createElement('button'); button.textContent = account.name;
      button.onclick = () => run(async () => { await signIn(async () => account.token); sessionStorage.setItem('v9-local-token', account.token); });
      $('account-buttons').append(button);
    }
    notice('محیط محلی آماده است؛ یک حساب آزمایشی انتخاب کن.');
    const token = sessionStorage.getItem('v9-local-token');
    if (accounts.some(account => account.token === token)) await signIn(async () => token);
    return;
  }
  if (!config.firebase) throw new Error('تنظیمات ورود امن این پیش‌نمایش هنوز آماده نیست.');
  const sdkBase = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const firebaseApp = await import(sdkBase + 'firebase-app.js'); authSdk = await import(sdkBase + 'firebase-auth.js');
  auth = authSdk.getAuth(firebaseApp.initializeApp(config.firebase, 'math-game-v9'));
  $('firebase-login').hidden = false;
  form('email-form', async () => {
    const email = $('email').value.trim();
    if (authSdk.isSignInWithEmailLink(auth, location.href)) {
      await authSdk.signInWithEmailLink(auth, email, location.href);
      history.replaceState(null, '', location.pathname);
      await signIn(() => auth.currentUser.getIdToken());
    } else {
      await authSdk.sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
      notice('پیوند ورود ارسال شد؛ آن را باز کن و ایمیلت را تأیید کن.');
    }
  });
  $('anonymous-login').onclick = () => run(async () => { await authSdk.signInAnonymously(auth); await signIn(() => auth.currentUser.getIdToken()); });
  await auth.authStateReady();
  if (auth.currentUser) await signIn(() => auth.currentUser.getIdToken());
  else notice('با ایمیل معلم یا دعوت دانش‌آموز وارد شوید.');
});
