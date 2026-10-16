// Narrative feedback is a view of attempts and receipts, never a source of score.
export const missions = {
  1: { title: 'چراغ‌های خاموش', destination: 'نیروگاه ایستگاه', objective: 'چراغ‌های نیروگاه خاموش‌اند. سلول‌های انرژی را پیدا کن تا دوباره روشن شوند.', icon: '⚡' },
  2: { title: 'یک پیام تا زمین', destination: 'برج ارتباط', objective: 'صدای زمین قطع شده! آنتن ایستگاه را با سلول‌های درست دوباره راه بینداز.', icon: '📡' },
  3: { title: 'آمادهٔ پرواز', destination: 'سکوی پرتاب', objective: 'وقت برگشتن به مدار است. سوخت درست را پیدا کن و سفینه را برای پرواز آماده کن.', icon: '🚀' }
};
export function flightProgress(session) {
  const questions = session?.questions || [];
  const answers = session?.answers || {};
  const receipts = new Map(Object.values(session?.receipts || {}).map(receipt => [receipt.eventId, receipt]));
  let answered = 0, lit = 0, confirmed = 0;
  for (const question of questions) {
    const attempt = answers[question.questionId];
    if (!attempt) continue;
    answered++;
    const receipt = receipts.get(attempt.eventId);
    if (receipt?.status === 'ACKNOWLEDGED') {
      confirmed++; if (receipt.correct) lit++;
    } else if (attempt.answer === question.f1 * question.f2) lit++;
  }
  const finalized = session?.status === 'FINALIZED';
  if (finalized && Number.isInteger(session.score)) lit = session.score;
  return { total: questions.length, answered, lit, confirmed, pending: answered - confirmed,
    percent: questions.length ? Math.round(100 * answered / questions.length) : 0,
    energy: questions.length ? Math.round(100 * lit / questions.length) : 0,
    stage: Math.min(3, Math.floor(3 * answered / Math.max(1, questions.length))), finalized };
}
export function keepStationRecord(records, session, result) {
  if (session.activity !== 'mission' || result.status !== 'FINALIZED') return records;
  const record = { activityId: session.activityId, sectorId: session.sectorId, rulesVersion: session.rulesVersion, questionSetVersion: session.questionSetVersion, score: result.score, total: result.total };
  const same = item => item.activityId === record.activityId && item.rulesVersion === record.rulesVersion && item.questionSetVersion === record.questionSetVersion;
  const previous = records.find(same);
  if (previous && previous.score >= record.score) return records;
  return [...records.filter(item => !same(item)), record];
}
export function stationPower(records) {
  let powered = 0;
  for (const sectorId of [1, 2, 3]) {
    const best = records.filter(record => record.sectorId === sectorId && record.rulesVersion === 'rv1' && record.questionSetVersion === 'graph-v8.1');
    powered += Math.max(0, ...best.map(record => record.total > 0 ? Math.min(1, record.score / record.total) : 0));
  }
  return Math.round(100 * powered / 3);
}

export function stationSystems(records = []) {
  return [1, 2, 3].map(sectorId => {
    const compatible = records.filter(record => record.sectorId === sectorId && record.rulesVersion === 'rv1' && record.questionSetVersion === 'graph-v8.1' && record.total > 0);
    const best = compatible.reduce((best, record) => !best || record.score / record.total > best.score / best.total ? record : best, null);
    return { sectorId, ...missions[sectorId], percent: best ? Math.round(100 * best.score / best.total) : 0, complete: !!best && best.score === best.total, started: !!best };
  });
}
export function nextDestination(records = []) {
  const systems = stationSystems(records);
  return systems.reduce((next, system) => system.percent < next.percent ? system : next).sectorId;
}

export function multiplicationModel(question) {
  if (!question || ![question.f1, question.f2].every(value => Number.isInteger(value) && value >= 1 && value <= 12)) return null;
  return { groups: question.f1, each: question.f2, total: question.f1 * question.f2, addends: Array(question.f1).fill(question.f2) };
}

export function companionLine(session) {
  const progress = flightProgress(session);
  if (!progress.answered) return 'هوشک هستم، همراه سفر تو! هر جواب یک قدم است؛ با خیال راحت فکر کن.';
  const previous = [...session.questions].reverse().find(question => session.answers?.[question.questionId]);
  const attempt = session.answers[previous.questionId];
  const receipt = Object.values(session.receipts || {}).find(receipt => receipt.eventId === attempt.eventId && receipt.status === 'ACKNOWLEDGED');
  const correct = receipt ? receipt.correct : attempt.answer === previous.f1 * previous.f2;
  if (!correct) return 'با هم پیدایش کردیم: ' + previous.f1 + ' × ' + previous.f2 + ' = ' + previous.f1 * previous.f2 + '. این کشف را برای تمرین بعدی نگه داریم!';
  const lines = ['یک چراغ دیگر! نورش را می‌بینی؟', 'این سلول هم آماده است؛ سفرمان جلو رفت!', 'چه خوب پیدایش کردی! مقصد نزدیک‌تر شد.', 'یک کشف تازه برای دفتر سفر تو!'];
  return lines[(progress.answered - 1) % lines.length];
}

export function createSoundPlayer(makeContext) {
  let context;
  return async kind => {
    try {
      context ||= makeContext();
      if (context.state === 'suspended') await context.resume();
      const notes = { correct: [523.25, 659.25], review: [329.63], finish: [523.25, 659.25, 783.99] }[kind] || [440];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = context.currentTime + index * 0.11;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.045, start + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + 0.22);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
      return true;
    } catch { return false; } // Audio failure must never interrupt saving an answer.
  };
}
