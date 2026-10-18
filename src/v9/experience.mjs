// ============================================================
// experience.mjs — نسخه ۱۰.۱ (قفل‌شده)
// Station Data Structure + Pure Algorithms
// ============================================================

export const RULES_VERSION = 'rv1';
export const QUESTION_SET_VERSION = 'graph-v10.1';
export const LEGACY_QUESTION_SET = 'graph-v8.1';

// ------------------------------------------------------------
// ۱. سکتورهای اصلی (تغییرناپذیر)
// ------------------------------------------------------------
export const CORE_SECTORS = Object.freeze({
  1: {
    sectorId: 1,
    type: 'core',
    key: 'power',
    title: 'چراغ‌های خاموش',
    destination: 'نیروگاه ایستگاه',
    objective: 'چراغ‌های نیروگاه خاموش‌اند. سلول‌های انرژی را پیدا کن تا دوباره روشن شوند.',
    icon: '⚡',
    order: 1,
    unlock: null,
    focus: { factors: [2, 3, 4, 5], maxProduct: 30 },
    maxDepth: 3
  },
  2: {
    sectorId: 2,
    type: 'core',
    key: 'tower',
    title: 'یک پیام تا زمین',
    destination: 'برج ارتباط',
    objective: 'صدای زمین قطع شده! آنتن ایستگاه را با سلول‌های درست دوباره راه بینداز.',
    icon: '📡',
    order: 2,
    unlock: { require: 'core', sectorId: 1, minPercent: 80 },
    focus: { factors: [6, 7, 8, 9], maxProduct: 81 },
    maxDepth: 3
  },
  3: {
    sectorId: 3,
    type: 'core',
    key: 'pad',
    title: 'آمادهٔ پرواز',
    destination: 'سکوی پرتاب',
    objective: 'وقت برگشتن به مدار است. سوخت درست را پیدا کن و سفینه را برای پرواز آماده کن.',
    icon: '🚀',
    order: 3,
    unlock: { require: 'core', sectorId: 2, minPercent: 80 },
    focus: { factors: [10, 11, 12], maxProduct: 144 },
    maxDepth: 3
  }
});

// Backward compatibility alias for legacy imports
export const missions = CORE_SECTORS;

// ------------------------------------------------------------
// ۲. لایه‌های عمق (۳ لایه × ۳ بنا = ۹ لایه)
// ------------------------------------------------------------
export const DEPTH_LAYERS = Object.freeze({
  '1-1': {
    id: '1-1', sectorId: 1, depth: 1, type: 'depth',
    title: 'سلول‌های پایه',
    questionCount: 8,
    difficulty: 'basic',
    focus: { factors: [2, 3, 4, 5] },
    unlock: null
  },
  '1-2': {
    id: '1-2', sectorId: 1, depth: 2, type: 'depth',
    title: 'سلول‌های پایدار',
    questionCount: 10,
    difficulty: 'stable',
    focus: { factors: [2, 3, 4, 5], preferFluent: true },
    unlock: { require: 'depth', id: '1-1', minPercent: 90 }
  },
  '1-3': {
    id: '1-3', sectorId: 1, depth: 3, type: 'depth',
    title: 'سلول‌های مفهومی',
    questionCount: 6,
    difficulty: 'conceptual',
    focus: { bottleneckTypes: ['equal-groups', 'skip-counting'] },
    unlock: { require: 'depth', id: '1-2', minPercent: 85 }
  },
  '2-1': {
    id: '2-1', sectorId: 2, depth: 1, type: 'depth',
    title: 'آنتن‌های اولیه',
    questionCount: 8,
    difficulty: 'basic',
    focus: { factors: [6, 7, 8, 9] },
    unlock: null
  },
  '2-2': {
    id: '2-2', sectorId: 2, depth: 2, type: 'depth',
    title: 'سیگنال پایدار',
    questionCount: 10,
    difficulty: 'stable',
    focus: { factors: [6, 7, 8, 9], preferFluent: true },
    unlock: { require: 'depth', id: '2-1', minPercent: 90 }
  },
  '2-3': {
    id: '2-3', sectorId: 2, depth: 3, type: 'depth',
    title: 'ارتباط مفهومی',
    questionCount: 6,
    difficulty: 'conceptual',
    focus: { bottleneckTypes: ['neighbor-anchor', 'place-value'] },
    unlock: { require: 'depth', id: '2-2', minPercent: 85 }
  },
  '3-1': {
    id: '3-1', sectorId: 3, depth: 1, type: 'depth',
    title: 'سوخت پایه',
    questionCount: 8,
    difficulty: 'basic',
    focus: { factors: [10, 11, 12] },
    unlock: null
  },
  '3-2': {
    id: '3-2', sectorId: 3, depth: 2, type: 'depth',
    title: 'موتور پایدار',
    questionCount: 10,
    difficulty: 'stable',
    focus: { factors: [10, 11, 12], preferFluent: true },
    unlock: { require: 'depth', id: '3-1', minPercent: 90 }
  },
  '3-3': {
    id: '3-3', sectorId: 3, depth: 3, type: 'depth',
    title: 'آمادگی مفهومی',
    questionCount: 6,
    difficulty: 'conceptual',
    focus: { bottleneckTypes: ['doubling', 'commutativity'] },
    unlock: { require: 'depth', id: '3-2', minPercent: 85 }
  }
});

// ------------------------------------------------------------
// ۳. مأموریت‌های جانبی
// ------------------------------------------------------------
export const SIDE_MISSIONS = Object.freeze({
  'side-1-antenna': {
    id: 'side-1-antenna',
    type: 'side',
    parentSectorId: 1,
    title: 'تعمیر آنتن فرعی',
    objective: 'یک آنتن کوچک را با سلول‌های درست روشن کن.',
    icon: '📡',
    questionCount: 5,
    focus: { factors: [2, 3, 4, 5], adaptive: true },
    unlock: { require: 'core', sectorId: 1, minPercent: 70 },
    affectsLeaderboard: false,
    reward: 'energy'
  },
  'side-2-backup': {
    id: 'side-2-backup',
    type: 'side',
    parentSectorId: 2,
    title: 'شارژ سلول پشتیبان',
    objective: 'سلول‌های پشتیبان برج را فعال کن.',
    icon: '🔋',
    questionCount: 5,
    focus: { factors: [6, 7, 8, 9], adaptive: true },
    unlock: { require: 'core', sectorId: 2, minPercent: 70 },
    affectsLeaderboard: false,
    reward: 'energy'
  },
  'side-3-fuel': {
    id: 'side-3-fuel',
    type: 'side',
    parentSectorId: 3,
    title: 'تأمین سوخت اضافه',
    objective: 'سوخت اضافه برای سفینه آماده کن.',
    icon: '🚀',
    questionCount: 5,
    focus: { factors: [10, 11, 12], adaptive: true },
    unlock: { require: 'core', sectorId: 3, minPercent: 70 },
    affectsLeaderboard: false,
    reward: 'energy'
  }
});

// ------------------------------------------------------------
// ۴. توابع دسترسی (Pure)
// ------------------------------------------------------------
export function getCoreSectors() {
  return Object.values(CORE_SECTORS).sort((a, b) => a.order - b.order);
}

export function getDepthsForSector(sectorId) {
  return Object.values(DEPTH_LAYERS)
    .filter(d => d.sectorId === sectorId)
    .sort((a, b) => a.depth - b.depth);
}

export function getSideMissionsForSector(sectorId) {
  return Object.values(SIDE_MISSIONS)
    .filter(m => m.parentSectorId === sectorId);
}

// ------------------------------------------------------------
// ۵. الگوریتم بررسی باز بودن (Pure)
// ------------------------------------------------------------
export function isUnlocked(condition, records = [], systemsCache = null) {
  if (!condition) return true;

  if (condition.require === 'core') {
    if (systemsCache) {
      const target = systemsCache.find(s => s.sectorId === condition.sectorId);
      return !!(target && target.percent >= condition.minPercent);
    }
    const related = records.filter(r =>
      (r.type === 'core' || r.type === 'depth' || !r.type) &&
      r.sectorId === condition.sectorId &&
      r.rulesVersion === RULES_VERSION &&
      (r.questionSetVersion === QUESTION_SET_VERSION ||
       r.questionSetVersion === LEGACY_QUESTION_SET) &&
      (r.total > 0 || (r.percent !== undefined && r.percent > 0))
    );
    const getPercent = r => r.percent !== undefined ? r.percent : (r.total > 0 ? Math.round(100 * r.score / r.total) : 0);
    const maxPercent = related.reduce((max, r) => Math.max(max, getPercent(r)), 0);
    return maxPercent >= condition.minPercent;
  }

  if (condition.require === 'depth') {
    const rec = records.find(r =>
      (r.type === 'depth' || !r.type) &&
      (r.activityId === condition.id || `${r.sectorId}-${r.depth}` === condition.id)
    );
    const percent = rec ? (rec.percent ?? (rec.total > 0 ? Math.round(100 * rec.score / rec.total) : 0)) : 0;
    return !!(rec && percent >= condition.minPercent);
  }

  if (condition.require === 'side') {
    const rec = records.find(r => r.type === 'side' && r.missionId === condition.id);
    const percent = rec ? (rec.percent ?? (rec.total > 0 ? Math.round(100 * rec.score / rec.total) : 0)) : 0;
    return !!(rec && percent >= condition.minPercent);
  }

  return false;
}

// ------------------------------------------------------------
// ۶. الگوریتم وضعیت سیستم‌های ایستگاه (Pure) — No hardcoded 3!
// ------------------------------------------------------------
export function stationSystems(records = []) {
  const sectors = getCoreSectors().map(sector => {
    const related = records.filter(r =>
      (r.type === 'core' || r.type === 'depth' || !r.type) &&
      r.sectorId === sector.sectorId &&
      r.rulesVersion === RULES_VERSION &&
      (r.questionSetVersion === QUESTION_SET_VERSION ||
       r.questionSetVersion === LEGACY_QUESTION_SET) &&
      (r.total > 0 || (r.percent !== undefined && r.percent > 0))
    );

    const getPercent = r => r.percent !== undefined ? r.percent : (r.total > 0 ? Math.round(100 * r.score / r.total) : 0);

    const best = related.reduce((best, r) =>
      !best || getPercent(r) > getPercent(best) ? r : best, null);

    const bestPercent = best ? getPercent(best) : 0;

    const depths = getDepthsForSector(sector.sectorId);
    const currentDepth = depths.reduce((max, d) => {
      const rec = related.find(r => (r.type === 'depth' || !r.type) && r.depth === d.depth);
      return (rec && getPercent(rec) >= 80) ? Math.max(max, d.depth) : max;
    }, 0);

    return {
      sectorId: sector.sectorId,
      key: sector.key,
      title: sector.title,
      destination: sector.destination,
      icon: sector.icon,
      percent: bestPercent,
      complete: bestPercent >= 100,
      started: !!best,
      currentDepth
    };
  });

  return sectors.map(s => ({
    ...s,
    availableSides: getSideMissionsForSector(s.sectorId)
      .filter(m => isUnlocked(m.unlock, records, sectors))
      .map(m => m.id)
  }));
}

// ------------------------------------------------------------
// ۷. الگوریتم قدرت کلی ایستگاه (Pure) — No hardcoded 3!
// ------------------------------------------------------------
export function stationPower(records = []) {
  const systems = stationSystems(records);
  if (!systems.length) return 0;
  const total = systems.reduce((sum, s) => sum + s.percent, 0);
  return Math.round(total / systems.length);
}

// ------------------------------------------------------------
// ۸. الگوریتم مقصد بعدی (Pure)
// ------------------------------------------------------------
export function nextDestination(records = []) {
  const systems = stationSystems(records);
  const incomplete = systems.filter(s => !s.complete);
  if (!incomplete.length) return null;
  return incomplete.reduce((next, s) =>
    s.percent < next.percent ? s : next
  ).sectorId;
}

// ------------------------------------------------------------
// ۸.۵. تولید سؤال تطبیقی مأموریت‌های جانبی (Pure)
// هر مأموریت جانبی دقیقاً questionCount سؤال (۵ سؤال) بر پایهٔ
// فاکتورهای خود مأموریت و گلوگاه‌های شناختی سکتور مادر تولید می‌کند.
// ورودی seed باعث تنوع بین تلاش‌ها (تطبیقی) بدون از دست دادن
// قطعیت (determinism) برای آزمون‌ها می‌شود.
// ------------------------------------------------------------
export const SIDE_F2_RANGE = Object.freeze({ min: 2, max: 9 });

export function generateSideMissionQuestions(missionId, seed = 0) {
  const mission = SIDE_MISSIONS[missionId];
  if (!mission || mission.type !== 'side') return [];

  const factors = mission.focus?.factors || [];
  if (!factors.length) return [];

  const count = mission.questionCount || 5;
  // bottleneckTypes همان گلوگاه‌های لایهٔ مفهومی (لایهٔ ۳) سکتور مادر است
  const parentLayer = DEPTH_LAYERS[`${mission.parentSectorId}-3`];
  const strategies = parentLayer?.focus?.bottleneckTypes || ['equal-groups'];

  const offset = ((Number(seed) || 0) % 7 + 7) % 7;
  const f2Min = SIDE_F2_RANGE.min;
  const f2Max = SIDE_F2_RANGE.max;
  const f2Span = f2Max - f2Min + 1;

  const questions = [];
  for (let i = 0; i < count; i++) {
    const f1 = factors[(i + offset) % factors.length];
    let f2 = f2Min + ((i + offset * 2) % f2Span);
    if (f2 === f1 && f2 > f2Min) f2 -= 1; // پرهیز از تکرار کامل یک عامل در هر دو سمت

    const strategy = strategies[i % strategies.length];
    const question = {
      questionId: `q_side_${mission.parentSectorId}_${i + 1}_s${offset}`,
      missionId,
      f1,
      f2,
      strategy
    };

    if (strategy === 'neighbor-anchor') {
      const anchorF1 = f1 - 1 >= 2 ? f1 - 1 : f1 + 1;
      question.meta = { anchor: { f1: anchorF1, f2 }, delta: f1 - anchorF1 };
    } else if (strategy === 'skip-counting') {
      question.meta = { skipBy: f2, steps: f1 };
    } else if (strategy === 'doubling') {
      const half = f2 % 2 === 0 ? f2 / 2 : Math.max(f2Min, f2 - 1) / 2;
      question.meta = { doubleOf: { f1, f2: half } };
    } else if (strategy === 'commutativity') {
      question.meta = { swapped: { f1: f2, f2: f1 } };
    } else if (strategy === 'place-value') {
      question.meta = { tens: Math.floor(f2 / 10), ones: f2 % 10 };
    }

    questions.push(question);
  }
  return questions;
}

// ------------------------------------------------------------
// ۹. الگوریتم ثبت رکورد (سازگار با نسخه ۹ و ۱۰)
// ------------------------------------------------------------
export function keepStationRecord(records, session, result) {
  if (!result || result.status !== 'FINALIZED') return records;
  // If activity is personal practice, do not keep station record
  if (session?.activity && session.activity !== 'mission') return records;

  const percent = result.total > 0 ? Math.round((100 * result.score) / result.total) : 0;

  const record = {
    activityId: session.activityId,
    type: session.activityType || 'core',
    sectorId: session.sectorId,
    depth: session.depth,
    missionId: session.missionId,
    rulesVersion: session.rulesVersion || RULES_VERSION,
    questionSetVersion: session.questionSetVersion || QUESTION_SET_VERSION,
    score: result.score,
    total: result.total,
    percent,
    completedAt: new Date().toISOString(),
    bottleneckHits: session.bottleneckHits || [],
    fluentCount: session.fluentCount || 0
  };

  const same = r =>
    r.activityId === record.activityId &&
    r.rulesVersion === record.rulesVersion &&
    r.questionSetVersion === record.questionSetVersion;

  const previous = records.find(same);
  if (previous) {
    const prevPercent = previous.percent !== undefined
      ? previous.percent
      : (previous.total > 0 ? Math.round(100 * previous.score / previous.total) : 0);
    if (prevPercent >= record.percent) return records;
  }

  return [...records.filter(r => !same(r)), record];
}

// ------------------------------------------------------------
// ۱۰. مهاجرت رکوردهای قدیمی (Idempotent)
// ------------------------------------------------------------
export function migrateLegacyRecords(records = []) {
  return records.map(r => {
    if (r.type) return r;
    return {
      ...r,
      type: 'core',
      percent: r.percent !== undefined ? r.percent : (r.total > 0 ? Math.round(100 * r.score / r.total) : 0),
      questionSetVersion: r.questionSetVersion || LEGACY_QUESTION_SET
    };
  });
}

// ------------------------------------------------------------
// ۱۱. توابع کمکی حفظ سازگاری کامل موتور v9
// ------------------------------------------------------------
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
  return {
    total: questions.length, answered, lit, confirmed, pending: answered - confirmed,
    percent: questions.length ? Math.round(100 * answered / questions.length) : 0,
    energy: questions.length ? Math.round(100 * lit / questions.length) : 0,
    stage: Math.min(3, Math.floor(3 * answered / Math.max(1, questions.length))),
    finalized
  };
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
