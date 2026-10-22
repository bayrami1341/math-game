// ─────────────────────────────────────────────────────────────────────────────
// اسکیمای خشاب اجرایی (v10.3.2 — چندپایه G2 + G3) — قرارداد مشترک «مبدل Excel→JSON» و «موتور»
//
// این ماژول Pure است (بدون DOM/FS) و دو مصرف دارد:
//   ۱) مبدل (tools/cartridge-converter/convert.mjs) پیش از انتشار JSON را اعتبارسنجی می‌کند.
//   ۲) موتور (station/cartridge.js) در زمان بارگذاری، دوباره اعتبارسنجی می‌کند
//      (دفاع در عمق — JSON دستکاری‌شده نباید وارد UI شود).
// ─────────────────────────────────────────────────────────────────────────────

import { ERROR_CODES, classifyAttempt } from './errors.js';
import { CODES_G2_CONFIRMED } from './errors-g2.js';

export const CARTRIDGE_FORMAT_VERSION = '1.0';
export const CARTRIDGE_ID = 'KH-G3-MATH';
export const CARTRIDGE_ID_PATTERN = /^KH-[A-Za-z0-9_-]+$/;

export const STATUS_CONFIRMED = 'تأییدشده';
export const STATUS_PROPOSED = 'نیاز به تأیید';

/** پشتیبانی هم‌زمان از املای بی‌فاصله («تأییدشده» در G3) و بافاصله («تأیید شده» در G2) */
export function isConfirmedStatus(raw) {
  const norm = String(raw ?? '').replace(/\s+/g, '').trim();
  return norm === 'تأییدشده';
}

export const ENGINE_COMPAT_VALUES = Object.freeze(['تعاملی-عمیق', 'بانک تمرین', 'خارج از موتور']);
export const DOMAIN_VALUES = Object.freeze(['CORE', 'DEPTH', 'SIDE']);
export const CPA_VALUES = Object.freeze(['مجسم', 'تصویری', 'علامتی']);

const BASE_REAL_CODES = Object.freeze(new Set(Object.keys(ERROR_CODES)));
const G2_REAL_CODES = Object.freeze(new Set([
  ...Object.keys(ERROR_CODES),
  ...Object.keys(CODES_G2_CONFIRMED)
]));
const OPTION_LETTERS = Object.freeze(['الف', 'ب', 'ج', 'د']);

export const AUDIT_ANSWER_RECEIPTS = Object.freeze({
  'Q-101': 12, 'Q-102': 25, 'Q-103': 0, 'Q-104': 9, 'Q-105': 60, 'Q-106': 16,
  'Q-107': 18, 'Q-108': 72, 'Q-109': 28, 'Q-110': 100, 'Q-111': 30,
  'Q-113': 56, 'Q-114': 54,
  'Q-201': 4, 'Q-202': 3, 'Q-203': 5, 'Q-204': 4, 'Q-206': 604
});

export const KNOWN_HALF_MAPS = Object.freeze([
  { id: 'Q-107', letter: 'ج' },
  { id: 'Q-109', letter: 'ج' }
]);

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatin = s => String(s ?? '')
  .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
  .replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)));

/** مقدار عددی یک گزینه: عدد خام / جمع / ضرب / «همان ۲۸» — وگرنه null */
export function parseOptionValue(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  const t = toLatin(text).replace(/\s+/g, '');
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (t.includes('+') && !t.includes('×') && t.split('+').every(p => /^\d+$/.test(p))) {
    return t.split('+').reduce((a, b) => a + parseInt(b, 10), 0);
  }
  if (t.includes('×') && !t.includes('+') && t.split('×').every(p => /^\d+$/.test(p))) {
    return t.split('×').reduce((a, b) => a * parseInt(b, 10), 1);
  }
  const m = /همان\s*([۰-۹0-9]+)/.exec(text);
  return m ? parseInt(toLatin(m[1]), 10) : null;
}

/** استخراج مقدار پاسخ تأییدشده از ردپای لاتین ضد J12 در ستون یادداشت (در صورت وجود `answer=N`) */
export function parseAuditNoteAnswer(note) {
  const m = /independently checked:\s*answer\s*=\s*(-?\d+)/.exec(String(note ?? ''));
  return m ? parseInt(m[1], 10) : null;
}

/** فرم ضربِ خام «a×b = ؟» — کلید پاسخ‌شان با حاصل بازحساب می‌شود */
export function parsePlainMultiplication(prompt) {
  const m = /^\s*([0-9۰-۹]+)\s*[×x]\s*([0-9۰-۹]+)\s*=\s*؟\s*$/.exec(String(prompt ?? '').trim());
  return m ? { f1: parseInt(toLatin(m[1]), 10), f2: parseInt(toLatin(m[2]), 10) } : null;
}

/** عامل‌های ضرب درون متن سؤال (برای آزمون برچسب‌های ضرب) */
export function extractMultiplicationFactors(prompt) {
  const text = String(prompt ?? '');
  if (text.includes('÷') || text.includes('☐')) return null;
  const m = /([0-9۰-۹]+)\s*[×x]\s*([0-9۰-۹]+)/.exec(text);
  return m ? { f1: parseInt(toLatin(m[1]), 10), f2: parseInt(toLatin(m[2]), 10) } : null;
}

/** نقشهٔ گزینه→خطا: «الف→…؛ ب→…» → [{letter, claim}] */
export function parseClaims(mapText) {
  const out = [];
  const text = String(mapText ?? '');
  for (const letter of OPTION_LETTERS) {
    const m = new RegExp(letter + '\\s*(?:→|->)\\s*([^؛;]+)').exec(text);
    if (m) out.push({ letter, claim: m[1].trim() });
  }
  return out;
}

/**
 * ارجاع‌های Q- درون یک سلول — با گسترش سه قالب:
 *   «Q-103 تا Q-105» (G3) | «Q-1001-1004» (موج ۲ G2) | «Q-1041..Q-1044» (موج ۳ و ۴ G2)
 */
export function extractQRefs(text) {
  const t = toLatin(String(text ?? ''));
  const refs = [];
  let rest = t;
  const consume = re => {
    re.lastIndex = 0;
    const hits = [];
    let m;
    while ((m = re.exec(rest)) !== null) {
      hits.push(m);
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    for (const h of hits) {
      const a = parseInt(h[1], 10);
      const b = parseInt(h[2], 10);
      if (b >= a && b - a < 50) {
        for (let i = a; i <= b; i++) refs.push(`Q-${i}`);
      }
      rest = rest.replace(h[0], ' ');
    }
  };
  consume(/Q-(\d+)\s*تا\s*Q-(\d+)/g);
  consume(/Q-(\d+)\.\.Q-(\d+)/g);
  consume(/Q-(\d+)-(\d+)/g);
  for (const m2 of rest.matchAll(/Q-\d+/g)) refs.push(m2[0]);
  return refs;
}

const claimCode = claim => {
  const m = /E_[A-Z0-9_]+/.exec(String(claim ?? ''));
  return m ? m[0] : null;
};

function judgeClaim(qid, letter, claim, f1, f2, submitted, atlasProposed, realCodes) {
  if (KNOWN_HALF_MAPS.some(k => k.id === qid && k.letter === letter)) {
    return { level: 'warning', msg: `نقشهٔ نیمه‌تزئینی — زرد مستند AUD-12 (${qid} گ${letter})` };
  }
  const hasProposedMarker = /پیشنهادی|کاندید/.test(claim);
  const code = claimCode(claim);
  const engine = classifyAttempt({ f1, f2, submitted });

  if (code && !realCodes.has(code)) {
    if (atlasProposed.has(code)) return null;
    return { level: 'error', msg: `کد بیرونیِ بدون تگ در اطلس: ${code} (T5 — قرمز)` };
  }
  if (code && realCodes.has(code)) {
    if (/هم‌پوشانی/.test(claim)) {
      return engine && realCodes.has(engine)
        ? null
        : { level: 'error', msg: `ادعای هم‌پوشانی ولی موتور بی‌الگو داد (${engine})` };
    }
    return engine === code
      ? null
      : { level: 'error', msg: `ادعا ${code} ولی موتور ${engine ?? 'بی‌الگو'} داد — ناسازگاری T6` };
  }
  if (/بی‌الگو|چسباندن/.test(claim)) {
    return engine === null
      ? null
      : { level: 'error', msg: `ادعای بی‌الگو ولی موتور ${engine} زد — ناسازگاری T6` };
  }
  if (hasProposedMarker) return null;
  return null;
}

export function validateCartridge(c, expectedId = null) {
  const errors = [];
  const warnings = [];
  const err = msg => errors.push(msg);
  const warn = msg => warnings.push(msg);

  if (!c || typeof c !== 'object') {
    return { ok: false, errors: ['خشاب تهی است'], warnings, stats: {}, gate: { red: 1, yellow: 0, verdict: 'مردود' } };
  }
  if (c.formatVersion !== CARTRIDGE_FORMAT_VERSION) err(`formatVersion نامعتبر: ${c.formatVersion}`);
  const idOk = expectedId
    ? c.cartridgeId === expectedId
    : CARTRIDGE_ID_PATTERN.test(String(c.cartridgeId || ''));
  if (!idOk) {
    err(expectedId
      ? `cartridgeId نامعتبر: ${c.cartridgeId} (انتظار: ${expectedId} — T4)`
      : `cartridgeId نامعتبر: ${c.cartridgeId} — باید با الگوی KH-… بخواند (T4)`);
  }

  const realCodes = c.cartridgeId === 'KH-G2-MATH' ? G2_REAL_CODES : BASE_REAL_CODES;
  const bookMap = Array.isArray(c.bookMap) ? c.bookMap : [];
  const atlas = Array.isArray(c.errorAtlas) ? c.errorAtlas : [];
  const bank = Array.isArray(c.questionBank) ? c.questionBank : [];

  // ── اطلس خطا (T5) ──
  const atlasProposed = new Set();
  const atlasCodes = new Set();
  for (const a of atlas) {
    if (!a.code) { err('ردیف اطلس بدون کد'); continue; }
    if (atlasCodes.has(a.code)) err(`کد تکراری در اطلس: ${a.code}`);
    atlasCodes.add(a.code);
    if (a.status === STATUS_PROPOSED) atlasProposed.add(a.code);
    else if (!realCodes.has(a.code)) err(`اطلس: ${a.code} «تأییدشده» است ولی در موتور ثبت نیست (T5)`);
    if (a.status === STATUS_PROPOSED && realCodes.has(a.code)) {
      warn(`اطلس: ${a.code} پیشنهادی است ولی هم‌نام کد واقعی موتور است`);
    }
  }
  for (const a of atlas) {
    for (const ref of extractQRefs(a.questionPattern)) {
      if (!bank.some(q => q.id === ref)) err(`اطلس ${a.code}: ارجاع ${ref} در بانک سؤال نیست`);
    }
  }

  // ── نقشهٔ کتاب ──
  const lessonIds = new Set();
  for (const l of bookMap) {
    if (!l.id) { err('ردیف نقشهٔ کتاب بدون شناسه'); continue; }
    if (lessonIds.has(l.id)) err(`شناسهٔ تکراری درس: ${l.id}`);
    lessonIds.add(l.id);
    if (isConfirmedStatus(l.status) && !(l.source && String(l.source).trim())) {
      err(`نقشهٔ کتاب ${l.id}: ردیف سبز بدون منبع (قاعدهٔ ۸)`);
    }
    if (l.engineCompat && !ENGINE_COMPAT_VALUES.includes(l.engineCompat)) {
      warn(`نقشهٔ کتاب ${l.id}: مقدار «سازگاری موتور» خارج از واژه‌نامه: «${l.engineCompat}» (زرد AUD-07)`);
    }
  }

  // ── بانک سؤال (T6) ──
  const questionIds = new Set();
  const derivedOwners = new Map();
  for (const q of bank) {
    if (!q.id) { err('ردیف بانک بدون شناسه'); continue; }
    if (questionIds.has(q.id)) err(`شناسهٔ تکراری سؤال: ${q.id}`);
    questionIds.add(q.id);
    if (!lessonIds.has(q.anchorId)) err(`${q.id}: لنگر «${q.anchorId}» در نقشهٔ کتاب نیست`);
    if (!derivedOwners.has(q.anchorId)) derivedOwners.set(q.anchorId, []);
    derivedOwners.get(q.anchorId).push(q.id);

    if (isConfirmedStatus(q.status) && !(q.source && String(q.source).trim())) {
      err(`${q.id}: ردیف سبز بدون منبع (قاعدهٔ ۸)`);
    }
    if (q.domain && !DOMAIN_VALUES.includes(q.domain)) warn(`${q.id}: دامنهٔ خارج از واژه‌نامه: ${q.domain}`);
    if (q.cpa && !CPA_VALUES.includes(q.cpa)) warn(`${q.id}: لایهٔ CPA خارج از واژه‌نامه: «${q.cpa}» (زرد AUD-06)`);
    if (!Array.isArray(q.options) || q.options.length !== 4) { err(`${q.id}: تعداد گزینه‌ها ≠ ۴`); continue; }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) err(`${q.id}: پاسخ‌نام خارج از بازه`);
    for (let i = 0; i < 4; i++) {
      const v = parseOptionValue(q.options[i]);
      if (v !== null && (v < 0 || v > 9999)) err(`${q.id} گ${OPTION_LETTERS[i]}: عدد خارج از دامنهٔ کتاب (۹۹۹۹ — T4)`);
    }

    // کلید پاسخ: فرم خام ضرب -> رسید ممیزی -> ردپای لاتین ضد J12
    const plain = parsePlainMultiplication(q.prompt);
    const noteAns = parseAuditNoteAnswer(q.note);
    if (plain && q.answerIndex >= 0 && q.answerIndex <= 3) {
      const v = parseOptionValue(q.options[q.answerIndex]);
      if (v !== plain.f1 * plain.f2) err(`${q.id}: گزینهٔ پاسخ (${v}) ≠ حاصل ${plain.f1}×${plain.f2}=${plain.f1 * plain.f2} (ضد J12)`);
    } else if (q.id in AUDIT_ANSWER_RECEIPTS) {
      const v = parseOptionValue(q.options[q.answerIndex]);
      if (v !== AUDIT_ANSWER_RECEIPTS[q.id]) err(`${q.id}: گزینهٔ پاسخ (${v}) ≠ رسید ممیزی (${AUDIT_ANSWER_RECEIPTS[q.id]})`);
    } else if (noteAns !== null && q.answerIndex >= 0 && q.answerIndex <= 3) {
      const v = parseOptionValue(q.options[q.answerIndex]);
      if (v !== noteAns) err(`${q.id}: گزینهٔ پاسخ (${v}) ≠ بازمحاسبهٔ مستقل یادداشت (${noteAns}) (ضد J12)`);
    }

    // برچسب گزینه→خطا: هم برای ضرب (با موتور classifyAttempt) و هم کنترل ثبت همهٔ کدهای E_ در اطلس/موتور
    const claims = parseClaims(q.optionErrorMap);
    const factors = extractMultiplicationFactors(q.prompt);
    for (let i = 0; i < 4; i++) {
      const letter = OPTION_LETTERS[i];
      const claimObj = claims.find(x => x.letter === letter);
      if (!claimObj) continue;
      if (factors) {
        const v = parseOptionValue(q.options[i]);
        if (v === null || v === factors.f1 * factors.f2) continue;
        const verdict = judgeClaim(q.id, letter, claimObj.claim, factors.f1, factors.f2, v, atlasProposed, realCodes);
        if (verdict?.level === 'error') err(`${q.id} گ${letter}=${v}: ${verdict.msg}`);
        if (verdict?.level === 'warning') warn(`${q.id} گ${letter}: ${verdict.msg}`);
      } else {
        const code = claimCode(claimObj.claim);
        if (code && !realCodes.has(code) && !atlasProposed.has(code)) {
          err(`${q.id} گ${letter}: کد بیرونیِ ثبت‌نشده در اطلس یا موتور: ${code} (T5 — قرمز)`);
        }
      }
    }
  }

  // ── سازگاری نقشه ↔ بانک (T7 — بستن AUD-04/AUD-05) ──
  for (const l of bookMap) {
    const refs = [...new Set(extractQRefs(l.anchorsRaw))];
    const derived = (derivedOwners.get(l.id) || []).slice().sort();
    const refsSorted = refs.slice().sort();
    const same = refsSorted.length === derived.length && refsSorted.every((x, i) => x === derived[i]);
    if (!same) {
      err(`نقشهٔ کتاب ${l.id}: لنگرهای سلول [${refsSorted.join('،')}] ≠ مالکان واقعی در بانک [${derived.join('،')}]`);
    }
    for (const ref of refs) {
      if (!questionIds.has(ref)) err(`نقشهٔ کتاب ${l.id}: ارجاع ${ref} در بانک سؤال نیست`);
    }
  }

  const stats = {
    lessons: bookMap.length,
    lessonsConfirmed: bookMap.filter(l => isConfirmedStatus(l.status)).length,
    atlasReal: atlas.filter(a => isConfirmedStatus(a.status)).length,
    atlasProposed: atlasProposed.size,
    questions: bank.length,
    questionsConfirmed: bank.filter(q => isConfirmedStatus(q.status)).length,
    questionsProposed: bank.filter(q => q.status === STATUS_PROPOSED).length
  };
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats,
    gate: { red: errors.length, yellow: warnings.length, verdict: errors.length ? 'مردود' : 'مجاز' }
  };
}
