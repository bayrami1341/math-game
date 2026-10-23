// ─────────────────────────────────────────────────────────────────────────────
// اسکیمای خشاب اجرایی (v10.3) — قرارداد مشترک «مبدل Excel→JSON» و «موتور»
//
// این ماژول Pure است (بدون DOM/FS) و دو مصرف دارد:
//   ۱) مبدل (tools/cartridge-converter) پیش از انتشار JSON را اعتبارسنجی می‌کند.
//   ۲) موتور (station/cartridge.js) در زمان بارگذاری، دوباره اعتبارسنجی می‌کند
//      (دفاع در عمق — JSON دستکاری‌شده نباید وارد UI شود).
//
// قواعد اعتبارسنجی = همان بسته‌های T1/T2/T5/T6/T7 پرامپت ممیز (prompt-audit-cartridge-fa.md):
//   - یکتایی شناسه‌ها، enumها، قاعدهٔ ۸ (سبز بدون منبع = قرمز)
//   - سازگاری نقشهٔ کتاب ↔ بانک سؤال (مالکیت تک‌سؤال — بستن AUD-04/05)
//   - کلید پاسخ با «رسیدهای ممیزی» (بازحساب مستقل AUD-01 + ممیزی مجدد v0.6)
//   - برچسب گزینه→خطا با اجرای واقعی classifyAttempt (بستن AUD-01/02/03)
// ─────────────────────────────────────────────────────────────────────────────

import { ERROR_CODES, classifyAttempt } from './errors.js';

export const CARTRIDGE_FORMAT_VERSION = '1.0';
/** خشاب پیش‌فرض موتور (کتاب زندهٔ بازی) — پلتفرم چندخشابی است و سایر KH-… هم مجازند */
export const CARTRIDGE_ID = 'KH-G3-MATH';
/** الگوی مجاز شناسهٔ هر خشاب — قاعدهٔ نام‌گذاری چندخشابی (T4) */
export const CARTRIDGE_ID_PATTERN = /^KH-[A-Za-z0-9_-]+$/;

export const STATUS_CONFIRMED = 'تأییدشده';
export const STATUS_PROPOSED = 'نیاز به تأیید';

export const ENGINE_COMPAT_VALUES = Object.freeze(['تعاملی-عمیق', 'بانک تمرین', 'خارج از موتور']);
export const DOMAIN_VALUES = Object.freeze(['CORE', 'DEPTH', 'SIDE']);
export const CPA_VALUES = Object.freeze(['مجسم', 'تصویری', 'علامتی']);
// BP-015: لایهٔ دامنهٔ قانونی D1..D8 + قالب‌های ۶گانهٔ پاسخ (DRAFT تا مُهر گام صفر معلم)
// واژه‌نامهٔ نوع‌ها/حداقل‌ها: public/math-game/authoring/DOMAIN-MATRIX.json
export const DOMAIN_CODE_PATTERN = Object.freeze(/^D[1-8]$/);
export const ANSWER_FORMAT_VALUES = Object.freeze(['عدد', 'کسر', 'گزینه‌ای', 'محور عددی', 'زوج‌سازی', 'شکل/نمودار']);

const REAL_CODES = Object.freeze(new Set(Object.keys(ERROR_CODES)));
const OPTION_LETTERS = Object.freeze(['الف', 'ب', 'ج', 'د']);

// رسیدهای ممیزی — مقدار عددی درستِ گزینهٔ پاسخ (بازحساب مستقل AUD-01 §تأییدهای سبز
// + ممیزی مجدد ماشینی v0.6 با اجرای واقعی errors.js). هر تبدیل آینده دوباره با این
// رسیدها چک می‌شود؛ تغییر پاسخ بدون به‌روزرسانی ممیزی = قرمز مبدل.
export const AUDIT_ANSWER_RECEIPTS = Object.freeze({
  'Q-101': 12, 'Q-102': 25, 'Q-103': 0, 'Q-104': 9, 'Q-105': 60, 'Q-106': 16,
  'Q-107': 18, 'Q-108': 72, 'Q-109': 28, 'Q-110': 100, 'Q-111': 30,
  'Q-113': 56, 'Q-114': 54,
  'Q-201': 4, 'Q-202': 3, 'Q-203': 5, 'Q-204': 4, 'Q-206': 604
  // Q-112 (متای گره) و Q-205 (گزینه‌های کلامی) — بدون رسید عددی؛ AUD-01 تأیید کرده
});

// نقشه‌های نیمه‌تزئینی که AUD-01 رسماً زرد ثبت کرد (AUD-12) — هشدار، نه قرمز
export const KNOWN_HALF_MAPS = Object.freeze([
  { id: 'Q-107', letter: 'ج' },
  { id: 'Q-109', letter: 'ج' }
]);

const FA_AR_DIGITS = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'; // فارسی + عربی-هندی (W8 — هم‌راستا با مبدل آرنا)
const toLatin = s => String(s ?? '').replace(/[۰-۹٠-٩]/g, d => String(FA_AR_DIGITS.indexOf(d) % 10));

// ── W8 (BP-007): گسترش رسمی مقدار گزینه ─────────────────────────────────
// بازهٔ رسمی مقدار عددی گزینه: ±۱٬۰۰۰٬۰۰۰٬۰۰۰ (فراتر → null — fail-closed).
// کسر دقیق «a/b» و عدد مخلوط «k و a/b» با حساب گویای exact (بدون اعشار شناور).
export const OPTION_VALUE_MAX_ABS = 1_000_000_000;

const FRAC_MAX_ABS = Number.MAX_SAFE_INTEGER; // گارد دقت — فراتر → null (بیرون از واقعیت کتاب)

const gcdInt = (a, b) => { while (b) { const t = a % b; a = b; b = t; } return a; };

/** کسر دقیق ساده‌شده و منجمد — صورت می‌تواند منفی باشد، مخرج همیشه مثبت؛ نامعتبر → null */
export function makeFrac(num, den) {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) return null;
  if (Math.abs(num) > FRAC_MAX_ABS || Math.abs(den) > FRAC_MAX_ABS) return null;
  let n = num, d = den;
  if (d < 0) { n = -n; d = -d; }
  const g = gcdInt(Math.abs(n), d) || 1;
  return Object.freeze({ frac: true, num: n / g, den: d / g });
}

/** تشخیص مقدار کسر (خروجی parseOptionValue برای «a/b» و «k و a/b») */
export function isFracValue(v) {
  return !!v && typeof v === 'object' && v.frac === true
    && Number.isInteger(v.num) && Number.isInteger(v.den) && v.den > 0;
}

/** مقدار دهدهی کسر — فقط برای نمایش/آمار؛ داوری رسمی همیشه با خود کسر دقیق است */
export function fracToNumber(v) {
  return isFracValue(v) ? v.num / v.den : null;
}

// درون‌بازدهٔ بازه: |num/den| ≤ OPTION_VALUE_MAX_ABS با مقایسهٔ ضرب‌زدوری دقیق
const fracInRange = f => BigInt(Math.abs(f.num)) <= BigInt(OPTION_VALUE_MAX_ABS) * BigInt(f.den);

/**
 * مقدار عددی یک گزینه — قرارداد W8 (BP-007):
 *   عدد صحیح ±۱۰^۹ | کسر «a/b» | مخلوط «k و a/b» | جمع خام «a+b» | ضرب خام «a×b» | «همان n»
 * کسر صحیح‌ارزش (مثل ۶/۳) به عدد خام برمی‌گردد (هم‌قرارداد گذشته)؛ بقیهٔ کسرها
 * شیء دقیق {frac,num,den} ساده‌شده می‌دهند. بیرون از قرارداد/بازه → null.
 * سازگاری گذشته: رفتار روی دادهٔ رسمی موجود (صحیح/جمع/ضرب/همان) ذره‌ای تغییر نمی‌کند.
 */
export function parseOptionValue(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && Math.abs(raw) <= OPTION_VALUE_MAX_ABS ? raw : null;
  }
  const text = String(raw).trim();
  const t = toLatin(text).replace(/−/g, '-').replace(/؍/g, '/').replace(/\s+/g, '');
  // ۱) عدد صحیح در بازهٔ رسمی W8
  if (/^-?\d+$/.test(t)) {
    const v = parseInt(t, 10);
    return Number.isInteger(v) && Math.abs(v) <= OPTION_VALUE_MAX_ABS ? v : null;
  }
  // ۲) کسر «a/b» — دقیق و ساده‌شده (مخرج صفر → null)
  let m = /^(-?\d+)\/(\d+)$/.exec(t);
  if (m) {
    const f = makeFrac(parseInt(m[1], 10), parseInt(m[2], 10));
    if (!f || !fracInRange(f)) return null;
    return f.den === 1 ? f.num : f;
  }
  // ۳) مخلوط «k و a/b» — علامتِ k بر کل مقدار می‌نشیند: −۲ و ۱/۲ = −(۲ + ۱/۲)
  m = /^(-?\d+)و(-?\d+)\/(\d+)$/.exec(t);
  if (m) {
    const k = BigInt(m[1]);
    const n = BigInt(m[2]);
    const d = BigInt(m[3]);
    const sign = k < 0n ? -1n : 1n;
    const numBig = sign * ((k < 0n ? -k : k) * d + n); // −(۲ و ۱/۲) = −(۲×۲+۱)/۲ = −۵/۲
    const maxBig = BigInt(FRAC_MAX_ABS);
    if (numBig > maxBig || numBig < -maxBig || d > maxBig) return null;
    const f = makeFrac(Number(numBig), Number(d));
    if (!f || !fracInRange(f)) return null;
    return f.den === 1 ? f.num : f;
  }
  // ۴) جمع خام (قرارداد قبلی — دست‌نخورده)
  if (t.includes('+') && !t.includes('×') && t.split('+').every(p => /^\d+$/.test(p))) {
    return t.split('+').reduce((a, b) => a + parseInt(b, 10), 0);
  }
  // ۵) ضرب خام (قرارداد قبلی — دست‌نخورده)
  if (t.includes('×') && !t.includes('+') && t.split('×').every(p => /^\d+$/.test(p))) {
    return t.split('×').reduce((a, b) => a * parseInt(b, 10), 1);
  }
  // ۶) «همان n» (قرارداد قبلی)
  const m2 = /همان\s*([۰-۹0-9]+)/.exec(text);
  return m2 ? parseInt(toLatin(m2[1]), 10) : null;
}

/** فرم ضربِ خام «a×b = ؟» — فقط این ردیف‌ها کلید پاسخ‌شان با حاصل بازحساب می‌شود */
export function parsePlainMultiplication(prompt) {
  const m = /^\s*([0-9۰-۹]+)\s*[×x]\s*([0-9۰-۹]+)\s*=\s*؟\s*$/.exec(String(prompt ?? '').trim());
  return m ? { f1: parseInt(toLatin(m[1]), 10), f2: parseInt(toLatin(m[2]), 10) } : null;
}

/** عامل‌های ضرب درون متن سؤال (حتی غیرخام) — برای آزمون برچسب‌ها؛ ردیف‌های دارای ÷ یا ☐ کنار گذاشته می‌شوند */
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
    const m = new RegExp(letter + '→([^؛]+)').exec(text);
    if (m) out.push({ letter, claim: m[1].trim() });
  }
  return out;
}

/**
 * ارجاع‌های Q- درون یک سلول — با گسترش دو قالب بازه:
 *   «Q-۱۰۳ تا Q-۱۰۵» (قالب G3)  و  «Q-1001-1004» (قالب مختصر موج ۲ G2)
 * بازهٔ نامعتبر (برعکس یا ≥۵۰) مثل رفتار «تا» مصرف می‌شود و گسترش نمی‌یابد —
 * نتیجه: T7 با «لنگرهای سلول ≠ مالکان واقعی» به‌طور بلند فریاد می‌زند (fail-closed).
 */
export function extractQRefs(text) {
  const t = String(text ?? '');
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
      const a = parseInt(h[1], 10); const b = parseInt(h[2], 10);
      if (b >= a && b - a < 50) for (let i = a; i <= b; i++) refs.push(`Q-${i}`);
      rest = rest.replace(h[0], ' ');
    }
  };
  consume(/Q-(\d+)\s*تا\s*Q-(\d+)/g);
  consume(/Q-(\d+)-(\d+)/g);
  for (const m2 of rest.matchAll(/Q-\d+/g)) refs.push(m2[0]);
  return refs;
}

const claimCode = claim => {
  const m = /E_[A-Z_]+/.exec(String(claim ?? ''));
  return m ? m[0] : null;
};

/** قضاوت یک ادعای گزینه با موتور واقعی — عین منطق ممیزی AUD-01 */
function judgeClaim(qid, letter, claim, f1, f2, submitted, atlasProposed) {
  if ((qid, letter, KNOWN_HALF_MAPS.some(k => k.id === qid && k.letter === letter))) {
    return { level: 'warning', msg: `نقشهٔ نیمه‌تزئینی — زرد مستند AUD-12 (${qid} گ${letter})` };
  }
  const hasProposedMarker = /پیشنهادی|کاندید/.test(claim);
  const code = claimCode(claim);
  const engine = classifyAttempt({ f1, f2, submitted });

  if (code && !REAL_CODES.has(code)) {
    if (atlasProposed.has(code)) return null; // کد پیشنهادیِ ثبت‌شده در اطلس — تصمیم با S2
    return { level: 'error', msg: `کد بیرونیِ بدون تگ در اطلس: ${code} (T5 — قرمز)` };
  }
  if (code && REAL_CODES.has(code)) {
    if (/هم‌پوشانی/.test(claim)) {
      return engine && REAL_CODES.has(engine)
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
  return null; // توصیف متنی بدون کد (مثل «تفریق به‌جای تقسیم») — خارج از نگاشت خودکار
}

/**
 * اعتبارسنجی کامل خشاب. خروجی: { ok, errors[], warnings[], stats, gate }
 * fail-closed: حتی یک خطا = ورود به موتور ممنوع.
 * expectedId: شناسهٔ مورد انتظار.
 *   • مبدل/سرور/لودر مرورگر شناسهٔ خودشان را صریح پاس می‌دهند → تطابق دقیق (T4 سخت).
 *   • پیش‌فرض null: هر شناسهٔ خوش‌قالب KH-… پذیرفته می‌شود — قرارداد پلتفرم چندخشابی؛
 *     خشابی با شناسهٔ بدشکل (مثل «WRONG-ID») همچنان مردود است.
 */
export function validateCartridge(c, expectedId = null) {
  const errors = [];
  const warnings = [];
  const err = msg => errors.push(msg);
  const warn = msg => warnings.push(msg);

  if (!c || typeof c !== 'object') return { ok: false, errors: ['خشاب تهی است'], warnings, stats: {}, gate: { red: 1, yellow: 0, verdict: 'مردود' } };
  if (c.formatVersion !== CARTRIDGE_FORMAT_VERSION) err(`formatVersion نامعتبر: ${c.formatVersion}`);
  const idOk = expectedId
    ? c.cartridgeId === expectedId
    : CARTRIDGE_ID_PATTERN.test(String(c.cartridgeId || ''));
  if (!idOk) {
    err(expectedId
      ? `cartridgeId نامعتبر: ${c.cartridgeId} (انتظار: ${expectedId} — T4)`
      : `cartridgeId نامعتبر: ${c.cartridgeId} — باید با الگوی KH-… بخواند (T4)`);
  }

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
    else if (!REAL_CODES.has(a.code)) err(`اطلس: ${a.code} «تأییدشده» است ولی در errors.js نیست (T5)`);
    if (a.status === STATUS_PROPOSED && REAL_CODES.has(a.code)) warn(`اطلس: ${a.code} پیشنهادی است ولی هم‌نام کد واقعی موتور است`);
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
    if (l.status === STATUS_CONFIRMED && !(l.source && String(l.source).trim())) {
      err(`نقشهٔ کتاب ${l.id}: ردیف سبز بدون منبع (قاعدهٔ ۸)`);
    }
    if (l.engineCompat && !ENGINE_COMPAT_VALUES.includes(l.engineCompat)) {
      warn(`نقشهٔ کتاب ${l.id}: مقدار «سازگاری موتور» خارج از واژه‌نامه: «${l.engineCompat}» (زرد AUD-07)`);
    }
  }

  // ── بانک سؤال (T6) ──
  const questionIds = new Set();
  const derivedOwners = new Map(); // lessonId → [Q-…]
  for (const q of bank) {
    if (!q.id) { err('ردیف بانک بدون شناسه'); continue; }
    if (questionIds.has(q.id)) err(`شناسهٔ تکراری سؤال: ${q.id}`);
    questionIds.add(q.id);
    if (!lessonIds.has(q.anchorId)) err(`${q.id}: لنگر «${q.anchorId}» در نقشهٔ کتاب نیست`);
    if (!derivedOwners.has(q.anchorId)) derivedOwners.set(q.anchorId, []);
    derivedOwners.get(q.anchorId).push(q.id);

    if (q.status === STATUS_CONFIRMED && !(q.source && String(q.source).trim())) {
      err(`${q.id}: ردیف سبز بدون منبع (قاعدهٔ ۸)`);
    }
    if (q.domain && !DOMAIN_VALUES.includes(q.domain)) warn(`${q.id}: دامنهٔ خارج از واژه‌نامه: ${q.domain}`);
    if (q.cpa && !CPA_VALUES.includes(q.cpa)) warn(`${q.id}: لایهٔ CPA خارج از واژه‌نامه: «${q.cpa}» (زرد AUD-06)`);
    // BP-015 T1 — فیلدهای دامنه‌دار: نرم (هشدار؛ سؤال میراثی بدون دامنه ایراد ندارد)
    if (q.domainCode && !DOMAIN_CODE_PATTERN.test(String(q.domainCode).trim())) {
      warn(`${q.id}: کد دامنهٔ نامعتبر: «${q.domainCode}» — الگوی مجاز D1..D8 (BP-015)`);
    }
    if (q.qType && typeof q.qType !== 'string') warn(`${q.id}: qType باید رشته باشد (BP-015)`);
    if (q.answerFormat && !ANSWER_FORMAT_VALUES.includes(q.answerFormat)) {
      warn(`${q.id}: قالب پاسخ خارج از واژه‌نامهٔ ۶-قالبی: «${q.answerFormat}» (BP-015)`);
    }
    if (q.renderHint && typeof q.renderHint !== 'string') warn(`${q.id}: renderHint باید رشته باشد (BP-015)`);
    if (!Array.isArray(q.options) || q.options.length !== 4) { err(`${q.id}: تعداد گزینه‌ها ≠ ۴`); continue; }
    if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) err(`${q.id}: پاسخ‌نام خارج از بازه`);
    for (let i = 0; i < 4; i++) {
      const v = parseOptionValue(q.options[i]);
      if (v === null) continue;
      if (isFracValue(v)) {
        // W8: کسر هم همان قاعدهٔ دامنهٔ کتاب را دارد — ۰ ≤ num/den ≤ ۹۹۹۹ (مقایسهٔ ضرب‌زدوری دقیق)
        if (v.num < 0 || v.num > 9999 * v.den) {
          err(`${q.id} گ${OPTION_LETTERS[i]}: کسر خارج از دامنهٔ کتاب (۰..۹۹۹۹ — T4/W8)`);
        }
      } else if (v < 0 || v > 9999) {
        err(`${q.id} گ${OPTION_LETTERS[i]}: عدد خارج از دامنهٔ کتاب (۹۹۹۹ — T4)`);
      }
    }

    // کلید پاسخ: ابتدا فرم خام (a×b=؟)، سپس رسید ممیزی
    const plain = parsePlainMultiplication(q.prompt);
    if (plain && q.answerIndex >= 0 && q.answerIndex <= 3) {
      const v = parseOptionValue(q.options[q.answerIndex]);
      if (v !== plain.f1 * plain.f2) err(`${q.id}: گزینهٔ پاسخ (${v}) ≠ حاصل ${plain.f1}×${plain.f2}=${plain.f1 * plain.f2} (ضد J12)`);
    } else if (q.id in AUDIT_ANSWER_RECEIPTS) {
      const v = parseOptionValue(q.options[q.answerIndex]);
      if (v !== AUDIT_ANSWER_RECEIPTS[q.id]) err(`${q.id}: گزینهٔ پاسخ (${v}) ≠ رسید ممیزی (${AUDIT_ANSWER_RECEIPTS[q.id]})`);
    }

    // برچسب گزینه→خطا با موتور واقعی
    const factors = extractMultiplicationFactors(q.prompt);
    if (factors) {
      const claims = parseClaims(q.optionErrorMap);
      for (let i = 0; i < 4; i++) {
        const letter = OPTION_LETTERS[i];
        const claimObj = claims.find(x => x.letter === letter);
        if (!claimObj) continue;
        const v = parseOptionValue(q.options[i]);
        if (v === null || v === factors.f1 * factors.f2) continue;
        const verdict = judgeClaim(q.id, letter, claimObj.claim, factors.f1, factors.f2, v, atlasProposed);
        if (verdict?.level === 'error') err(`${q.id} گ${letter}=${v}: ${verdict.msg}`);
        if (verdict?.level === 'warning') warn(`${q.id} گ${letter}: ${verdict.msg}`);
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

  // ── آمار و گیت ──
  const stats = {
    lessons: bookMap.length,
    lessonsConfirmed: bookMap.filter(l => l.status === STATUS_CONFIRMED).length,
    atlasReal: atlas.filter(a => a.status === STATUS_CONFIRMED).length,
    atlasProposed: atlasProposed.size,
    questions: bank.length,
    questionsConfirmed: bank.filter(q => q.status === STATUS_CONFIRMED).length,
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
