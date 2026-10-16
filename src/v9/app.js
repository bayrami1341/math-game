import { openLocal } from './local.mjs';
import { studentKey, selectProfile, membershipContext } from './entry.mjs';
import { missionChoices } from './mission.mjs';

const $ = id => document.getElementById(id);
const config = window.MathGameV9Config;
const base = (config.apiBase || '').replace(/\/$/, '');
const fa = number => String(number).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
const number = value => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const request = () => ({ schemaVersion: 1, requestId: 'req_' + crypto.randomUUID() });
let local, actor, tokenProvider, auth, authSdk, state = {}, serial = Promise.resolve(), shownQuestionKey, questionShownAt;
let profiles = [], selectedId = null, storyStep = null, replaying = false, pendingCreation = null;
let screen = 'home', collection = null, motionPaused = false, choiceKey = null;
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
  $('login').hidden = true; $('workspace').hidden = false;
  const profile = profiles.find(profile => profile.studentId === selectedId);
  $('identity').textContent = actor.teacher ? 'پنل معلم' : profile ? profile.displayName : 'سفر قهرمان';
  $('teacher').hidden = !actor.teacher;
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
  $('class-context-option').disabled = status !== 'active';
  if (status !== 'active') $('activity-context').value = 'personal';
  const mission = screen === 'missions';
  $('student-class-name').textContent = mission ? 'مأموریت نجات ایستگاه' : 'تمرین من';
  $('start-activity').textContent = mission ? 'شروع مأموریت' : 'شروع تمرین';
  $('activity-rules').textContent = mission ? 'قانون این مأموریت: هر سؤال یک پاسخ، هر پاسخ درست یک امتیاز. سرعت امتیاز اضافه ندارد و حرکت کارت‌ها قابل توقف است. نتیجه پس از تأیید سرور ثبت می‌شود؛ رتبه‌بندی عمومی خاموش است.' : 'با آرامش پاسخ بده. پاسخ نادرست را با جواب درست مرور می‌کنی. این نتیجه سابقهٔ آموزشی است و وارد رکورد مأموریت نمی‌شود.';
  $('class-context-option').textContent = state.className ? 'کلاس: ' + state.className : 'کلاس انتخاب‌شده';
  $('practice').hidden = !state.session || !['practice', 'missions'].includes(screen) || (state.session.activity === 'mission') !== mission;
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
    shownQuestionKey = session.sessionId + ':' + question.questionId; questionShownAt = performance.now();
  }
  const confirmed = Object.keys(session.receipts || {}).length;
  $('queue-status').textContent = fa(confirmed) + ' پاسخ در پروندهٔ سرور تأیید شده است.';
  if (session.status === 'FINALIZED') $('feedback').textContent = `نتیجهٔ نهایی: ${fa(session.score)} پاسخ درست از ${fa(session.questions.length)}`;
}
function renderStory() {
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
  await save({ ...state, classId: membership.classId, className: membership.name, membershipStatus: membership.status });
  render(); await refreshMembership();
}
async function refreshCollection() {
  collection = await api('getCollection', { schemaVersion: 1, studentId: selectedId });
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
  if (actor.teacher) { render(); await refreshClass(); }
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
  $('members').replaceChildren(); $('results').replaceChildren();
  for (const member of classroom.members) {
    const row = document.createElement('div'); row.className = 'member';
    const label = document.createElement('p'); label.textContent = member.displayName + ' — ' + ({ active: 'فعال', pending: 'منتظر تأیید', revoked: 'غیرفعال' }[member.status]); row.append(label);
    const button = document.createElement('button'); button.className = 'secondary'; button.textContent = member.status === 'active' ? 'لغو عضویت' : 'تأیید عضویت';
    button.onclick = () => run(async () => { await api('setMembership', { ...request(), classId: state.classId, studentId: member.studentId, status: member.status === 'active' ? 'revoked' : 'active' }); await refreshClass(); });
    row.append(button); $('members').append(row);
  }
  if (!classroom.members.length) $('members').textContent = 'هنوز دانش‌آموزی نپیوسته است.';
  if (classroom.membersTruncated) { const note = document.createElement('p'); note.textContent = 'نمایش اعضا در این پیش‌نمایش به ۱۰۰ نفر محدود است.'; $('members').append(note); }
  for (const session of classroom.sessions) {
    const line = document.createElement('p'); line.className = 'result';
    const name = classroom.members.find(member => member.studentId === session.studentId)?.displayName || 'دانش‌آموز';
    line.textContent = `${name} — ${session.activity === 'mission' ? 'مأموریت' : 'تمرین'}: ${fa(session.score)} درست از ${fa(session.answered)} پاسخ ثبت‌شده — ${session.status === 'FINALIZED' ? 'پایان‌یافته' : 'در حال انجام'}`;
    $('results').append(line);
  }
  if (classroom.historyTruncated) { const note = document.createElement('p'); note.textContent = 'فقط ۲۰ جلسهٔ آخر نمایش داده می‌شود.'; $('results').append(note); }
}
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
  screen = button.dataset.screen; render();
  if (screen === 'collection') await refreshCollection();
}); });
$('resume-activity').onclick = () => { screen = state.session.activity === 'mission' ? 'missions' : 'practice'; render(); $('practice').scrollIntoView({ block: 'start' }); };
$('class-practice').onclick = () => { screen = 'practice'; $('activity-context').value = 'class'; render(); };
$('refresh-collection').onclick = () => run(refreshCollection);
$('toggle-motion').onclick = () => {
  motionPaused = !motionPaused; $('mission-choices').dataset.paused = String(motionPaused);
  $('toggle-motion').setAttribute('aria-pressed', String(motionPaused)); $('toggle-motion').textContent = motionPaused ? 'ادامهٔ حرکت کارت‌ها' : 'توقف حرکت کارت‌ها';
};
$('story-next').onclick = () => { storyStep++; focusStory(); };
$('story-skip').onclick = () => { storyStep = scenes.length; focusStory(); };
$('story-return').onclick = () => { storyStep = null; replaying = false; render(); };
$('replay-story').onclick = () => { replaying = true; storyStep = 0; focusStory(); };
$('change-hero').onclick = () => run(async () => {
  selectedId = null; state = {}; storyStep = null; $('feedback').textContent = ''; render();
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
  await save({ classId: result.classId, className: result.name }); render(); await refreshClass(); notice('کلاس ساخته شد. اکنون دعوت دانش‌آموز را بسازید.');
});
form('open-class', async () => {
  const classId = $('open-class-id').value.trim(); await api('getClass', { schemaVersion: 1, classId }); await save({ ...state, classId }); render(); await refreshClass();
});
$('issue-invite').onclick = () => run(async () => {
  if (!state.classId) throw new Error('ابتدا کلاس را بسازید یا باز کنید.');
  const result = await api('issueInvite', { ...request(), classId: state.classId, expiresInSeconds: 86400, maxUses: 40 });
  $('invite-token').value = result.token; notice('دعوت برای ۲۴ ساعت و حداکثر ۴۰ عضویت آماده است.');
});
$('copy-invite').onclick = () => run(async () => { await navigator.clipboard.writeText($('invite-token').value); notice('دعوت کپی شد.'); });
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
  await save({ ...state, session: { ...result, answers: {}, receipts: {} } }); render(); $('answer').focus();
  screen = result.activity === 'mission' ? 'missions' : 'practice'; choiceKey = null;
  await local.put(operation, null); render(); notice(result.activity === 'mission' ? 'مأموریت شروع شد؛ از میان کارت‌ها پاسخ را انتخاب کن.' : 'تمرین شروع شد؛ با آرامش فکر کن.');
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
  await save({ ...state, session: { ...state.session, status: result.status, score: result.score } }); render(); notice('تمرینت در پرونده ثبت شد.');
  await local.put(operation, null);
  notice(state.session.activity === 'mission' ? 'نتیجهٔ مأموریت تأیید شد؛ رکورد و نشان‌ها را در گنجینه ببین.' : 'تمرینت در سابقهٔ آموزشی ثبت شد.');
});
$('logout').onclick = () => run(async () => {
  if ((await local.pending(actor.uid)).length) throw new Error('پیش از خروج، پاسخ‌های منتظر را همگام کن.');
  if (auth?.currentUser?.isAnonymous && !window.confirm('ورود دوباره به همین پرونده پس از خروج از حساب ناشناس، هنوز در این پیش‌نمایش فراهم نیست. خارج می‌شوی؟')) return;
  if (auth) await authSdk.signOut(auth);
  sessionStorage.removeItem('v9-local-token'); actor = null; tokenProvider = null; state = {}; profiles = []; selectedId = null; storyStep = null;
  $('hero-name').value = ''; $('student-invite').value = ''; $('workspace').hidden = true; $('login').hidden = false; notice('از حساب خارج شدی. پاسخ‌های ارسال‌نشده برای همین حساب محفوظ‌اند.');
});
window.addEventListener('online', () => run(flush));
document.addEventListener('visibilitychange', () => { if (!document.hidden) run(flush); });
setInterval(() => { if (actor && !actor.teacher && !document.hidden) run(flush); }, 15000);

run(async () => {
  local = await openLocal();
  let meta;
  try {
    const response = await fetch(base + '/api/v9/meta', { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(); meta = await response.json();
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
