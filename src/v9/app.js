import { openLocal } from './local.mjs';

const $ = id => document.getElementById(id);
const config = window.MathGameV9Config;
const base = (config.apiBase || '').replace(/\/$/, '');
const fa = number => String(number).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
const number = value => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const request = () => ({ schemaVersion: 1, requestId: 'req_' + crypto.randomUUID() });
let local, actor, tokenProvider, auth, authSdk, state = {}, serial = Promise.resolve(), shownQuestionKey, questionShownAt;
const notice = (message, error = false) => { $('notice').textContent = message; $('notice').dataset.error = String(error); };
const key = () => 'profile:' + actor.uid;
function run(task) {
  serial = serial.then(async () => {
    const buttons = [...document.querySelectorAll('button')]; buttons.forEach(button => { button.disabled = true; });
    try { await task(); } catch (error) { notice(error.message || 'عملیات انجام نشد.', true); }
    finally { buttons.forEach(button => { button.disabled = false; }); }
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
  $('identity').textContent = actor.teacher ? 'پنل معلم' : 'پروندهٔ دانش‌آموز';
  $('teacher').hidden = !actor.teacher; $('student').hidden = actor.teacher;
  $('class-id').textContent = state.classId || '';
  $('open-class-id').value = state.classId || '';
  $('student-class-name').textContent = state.className || 'تمرین من';
  const status = state.membershipStatus;
  $('membership-status').textContent = { active: 'عضویت تأیید شد؛ آمادهٔ تمرین هستی.', pending: 'منتظر تأیید معلم هستی.', revoked: 'عضویت غیرفعال شده؛ از معلم کمک بگیر.' }[status] || 'اول به کلاس بپیوند.';
  $('start-session').hidden = status !== 'active';
  $('practice').hidden = !state.session;
  if (!state.session) return;
  const session = state.session;
  const answered = session.answers || {};
  const question = session.questions.find(question => !answered[question.questionId]);
  $('progress').textContent = fa(Object.keys(answered).length) + ' از ' + fa(session.questions.length) + ' پاسخ روی این دستگاه';
  $('question').textContent = question ? `${fa(question.f1)} × ${fa(question.f2)} = ؟` : 'آفرین! تمرینت تمام شد.';
  $('answer-form').hidden = !question || session.status === 'FINALIZED';
  if (question && shownQuestionKey !== session.sessionId + ':' + question.questionId) {
    shownQuestionKey = session.sessionId + ':' + question.questionId; questionShownAt = performance.now();
  }
  const confirmed = Object.keys(session.receipts || {}).length;
  $('queue-status').textContent = fa(confirmed) + ' پاسخ در پروندهٔ سرور تأیید شده است.';
  if (session.status === 'FINALIZED') $('feedback').textContent = `نتیجهٔ نهایی: ${fa(session.score)} پاسخ درست از ${fa(session.questions.length)}`;
}
async function signIn(provider) {
  tokenProvider = provider;
  actor = await api('getIdentity', { schemaVersion: 1 });
  state = await local.get(key()) || {};
  $('members').replaceChildren(); $('results').replaceChildren(); $('invite-token').value = ''; $('feedback').textContent = '';
  render(); notice('وارد شدی؛ پاسخ‌ها در پروندهٔ همین حساب نگهداری می‌شوند.');
  if (!actor.teacher) { await refreshMembership(); await flush(); }
}
async function refreshMembership() {
  if (!state.classId) return;
  if (actor.teacher) return refreshClass();
  const data = await api('getClass', { schemaVersion: 1, classId: state.classId, studentId: state.studentId });
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
    line.textContent = `${name}: ${fa(session.score)} درست از ${fa(session.answered)} پاسخ ثبت‌شده — ${session.status === 'FINALIZED' ? 'پایان‌یافته' : 'در حال تمرین'}`;
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
      $('feedback').textContent = last.correct ? 'این پاسخ درست بود؛ آفرین!' : 'این پاسخ نیاز به مرور دارد؛ با معلمت دوباره تمرین کن.';
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
  if ((await local.pending(actor.uid)).length) throw new Error('قبل از تغییر کلاس، پاسخ‌های منتظر را ارسال کنید.');
  const result = await api('redeemInvite', { ...request(), token: $('student-invite').value.trim(), displayName: $('student-name').value.trim() });
  await save({ classId: result.classId, studentId: result.studentId, membershipStatus: result.status }); render(); await refreshMembership();
});
$('check-membership').onclick = () => run(refreshMembership);
form('start-session', async () => {
  if ((await local.pending(actor.uid)).length) throw new Error('پاسخ‌های منتظر را پیش از تمرین تازه ارسال کن.');
  if (state.session && state.session.status !== 'FINALIZED') throw new Error('ابتدا تمرین فعلی را تمام کن.');
  const result = await api('startSession', { ...request(), classId: state.classId, studentId: state.studentId, goal: { type: 'sector', sectorId: Number($('sector').value) } });
  await save({ ...state, session: { ...result, answers: {}, receipts: {} } }); render(); $('answer').focus();
});
form('answer-form', async () => {
  const session = state.session;
  const question = session.questions.find(question => !session.answers[question.questionId]);
  if (!question) return;
  const text = number($('answer').value.trim());
  if (!/^-?\d{1,5}$/.test(text)) throw new Error('پاسخ را با عدد وارد کن.');
  const attempt = { eventId: 'evt_' + crypto.randomUUID(), questionId: question.questionId, answer: Number(text), responseMs: Math.min(3600000, Math.max(0, Math.round(performance.now() - questionShownAt))), clientOccurredAt: new Date().toISOString() };
  const input = { ...request(), sessionId: session.sessionId, writerEpoch: session.writerEpoch, attempts: [attempt] };
  const next = structuredClone(state); next.session.answers[question.questionId] = attempt;
  await local.enqueue(key(), next, { uid: actor.uid, input }); state = next;
  $('answer').value = ''; $('feedback').textContent = 'روی این دستگاه ذخیره شد.'; render(); $('answer').focus(); await flush();
});
$('sync').onclick = () => run(() => flush(true));
$('finalize').onclick = () => run(async () => {
  await flush();
  if ((await local.pending(actor.uid)).length) throw new Error('همهٔ پاسخ‌ها هنوز تأیید نشده‌اند؛ دوباره ارسال کن.');
  const result = await api('finalizeSession', { ...request(), sessionId: state.session.sessionId, writerEpoch: state.session.writerEpoch });
  await save({ ...state, session: { ...state.session, status: result.status, score: result.score } }); render(); notice('تمرینت در پرونده ثبت شد.');
});
$('logout').onclick = () => run(async () => {
  if ((await local.pending(actor.uid)).length) throw new Error('پیش از خروج، پاسخ‌های منتظر را همگام کن.');
  if (auth?.currentUser?.isAnonymous && !window.confirm('ورود دوباره به همین پرونده پس از خروج از حساب ناشناس، هنوز در این پیش‌نمایش فراهم نیست. خارج می‌شوی؟')) return;
  if (auth) await authSdk.signOut(auth);
  sessionStorage.removeItem('v9-local-token'); actor = null; tokenProvider = null; state = {};
  $('workspace').hidden = true; $('login').hidden = false; notice('از حساب خارج شدی. پاسخ‌های ارسال‌نشده برای همین حساب محفوظ‌اند.');
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
