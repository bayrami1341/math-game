// ─────────────────────────────────────────────────────────────────────────────
// بازرس مستقل محدودهٔ مفهومی (Independent Concept-Scope Inspector) — v1.0.0
//
// فرمان مالک: هر صفحه و سؤال با پروفایل نسخه‌دار (هدف‌ها، عملیات، دامنهٔ اعداد،
// پیش‌نیازها، مفاهیم خارج از محدوده) مقایسه می‌شود:
//   • انحراف هدف اصلی  → CRITICAL_DRIFT — خطای بحرانی و عامل توقف
//   • پیش‌نیاز/اشارهٔ فرعی → PREREQ_ONLY / SIDE_REF — جدا طبقه‌بندی، غیرتوقف‌زا
//   • ابهام/ناخوانایی → UNKNOWN_REVIEW — حدس ممنوع، ارجاع به انسان
//   • بنر/ظاهر بی‌اثر → COSMETIC_ONLY — هم‌وزن خطای مفهومی نیست
//
// استقلال: این ماژول هیچ چیزی از موتور تولید سؤال import نمی‌کند؛ فقط
// پروفایل + محتوا را می‌خواند و حکم می‌دهد (قاعده‌محور، بدون LLM).
// ─────────────────────────────────────────────────────────────────────────────

export const INSPECTOR_VERSION = 'concept-scope/v1.0.0';

// حکم‌ها
export const VERDICTS = {
  IN_SCOPE: 'IN_SCOPE',
  PREREQ_ONLY: 'PREREQ_ONLY',
  CRITICAL_DRIFT: 'CRITICAL_DRIFT',
  SIDE_REF: 'SIDE_REF',
  UNKNOWN_REVIEW: 'UNKNOWN_REVIEW',
  COSMETIC_ONLY: 'COSMETIC_ONLY',
};

const BLOCKING = new Set([VERDICTS.CRITICAL_DRIFT]);

// ─── ابزار عدد فارسی ───

const DIGIT_MAP = new Map();
for (let i = 0; i < 10; i++) {
  DIGIT_MAP.set(String(i), i);            // ASCII
  DIGIT_MAP.set(String.fromCharCode(0x0660 + i), i); // ٠..٩ عربی
  DIGIT_MAP.set(String.fromCharCode(0x06f0 + i), i); // ۰..۹ فارسی
}

/** تبدیل ارقام فارسی/عربی/ASCII یک رشته به int — null اگر عددی نباشد */
export function faToInt(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).replace(/[٬,]/g, '');
  let out = '';
  for (const ch of s) {
    if (DIGIT_MAP.has(ch)) out += DIGIT_MAP.get(ch);
    else return null;
  }
  return out === '' ? null : parseInt(out, 10);
}

/** همهٔ عددهای داخل یک متن (فارسی/عربی/ASCII) به ترتیب وقوع */
export function extractNumbers(text) {
  if (!text) return [];
  const normalized = normalizeDigits(text);
  const matches = normalized.match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

/** نرمال‌سازی ارقام فارسی/عربی به ASCII */
function normalizeDigits(text) {
  return String(text ?? '')
    .replace(/[۰-۹]/g, (d) => String(DIGIT_MAP.get(d)))
    .replace(/[٠-٩]/g, (d) => String(DIGIT_MAP.get(d)));
}

/**
 * جفت‌عملوندهای ضرب «A × B» — فقط عددهای مجاور سیمبل ضرب عملوندند؛
 * عددهای دیگر متن (لنگر، حاصل میانی، برچسب) عملوند نیستند (درس آزمون Q-4064)
 */
export function extractMulPairs(text) {
  if (!text) return [];
  const normalized = normalizeDigits(text);
  const out = [];
  for (const m of normalized.matchAll(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)/g)) {
    out.push(Number(m[1]), Number(m[2]));
  }
  return out;
}

const inRange = (n, range) => Array.isArray(range) && n >= range[0] && n <= range[1];

// ─── الگوی جمع تکراری (مرز آموزشی رسمی ضرب) ───
// مثل «۴+۴+۴» یا «۵ + ۵ + ۵ + ۵» — همان عملوند دست‌کم ۲ بار تکرار شده
const REPEATED_ADD_RE = /(\d+|[۰-۹]+)\s*\+\s*\1(?:\s*\+\s*\1)*/u;

/** آیا متن الگوی جمع تکراری دارد؟ (همان عملوند ≥۲ بار) */
export function hasRepeatedAddition(text) {
  if (!text) return false;
  const normalized = String(text)
    .replace(/[۰-۹]/g, (d) => String(DIGIT_MAP.get(d)))
    .replace(/[٠-٩]/g, (d) => String(DIGIT_MAP.get(d)));
  return REPEATED_ADD_RE.test(normalized);
}

// ─── وارسی پروفایل (fail-closed) ───

/** پروفایل باید schema/version/derivedFrom/domains کامل داشته باشد */
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return { ok: false, reason: 'PROFILE_MISSING' };
  }
  if (profile.schema !== 'khshab.concept-profile/v1') {
    return { ok: false, reason: 'PROFILE_SCHEMA_MISMATCH' };
  }
  if (!profile.version || !profile.derivedFrom) {
    return { ok: false, reason: 'PROFILE_VERSION_OR_BINDING_MISSING' };
  }
  if (!profile.derivedFrom.domainMatrixSha256) {
    return { ok: false, reason: 'PROFILE_MATRIX_PIN_MISSING' };
  }
  const fams = profile.families || {};
  for (const [fid, fam] of Object.entries(fams)) {
    const doms = fam.domains || {};
    if (Object.keys(doms).length === 0) {
      return { ok: false, reason: `FAMILY_EMPTY: ${fid}` };
    }
    for (const [did, dom] of Object.entries(doms)) {
      if (!dom.objective || !Array.isArray(dom.signals) || !Array.isArray(dom.outOfScope)) {
        return { ok: false, reason: `DOMAIN_INCOMPLETE: ${fid}/${did}` };
      }
    }
  }
  return { ok: true };
}

// ─── تشخیص مفهوم (قاعده‌محور، بدون حدس) ───

function hitsSignals(text, signals) {
  const found = [];
  for (const sig of signals || []) {
    if (sig && String(text).includes(sig)) found.push(sig);
  }
  return found;
}

/**
 * تشخیص مفاهیم یک آیتم از متن اصلی (prompt) + متن پشتیبان (qType/chapter)
 * خروجی: { primary, prereq, sides } — هر مفهوم با نام دامنه و شواهد
 */
function detectConcepts(item, familyProfile) {
  const text = [item.prompt, item.qType, item.title, item.detail]
    .filter(Boolean)
    .join(' ');

  const primary = [];
  const prereq = [];
  const sides = [];

  for (const [did, dom] of Object.entries(familyProfile.domains)) {
    const primHits = hitsSignals(text, dom.signals);
    const prereqHits = hitsSignals(text, dom.prereqSignals);
    if (primHits.length > 0) primary.push({ domain: did, hits: primHits });
    if (prereqHits.length > 0) prereq.push({ domain: did, hits: prereqHits });
    // اشارهٔ فرعی: مفهومی که فقط در outOfScope دامنه‌های دیگر فهرست شده
    for (const oos of dom.outOfScope || []) {
      if (oos && text.includes(oos)) sides.push({ domain: did, concept: oos });
    }
  }

  return { primary, prereq, sides };
}

/** خوانایی: متن بی‌معنا/خالی → UNKNOWN نه حدس */
function readability(item) {
  const prompt = String(item.prompt ?? item.detail ?? '').trim();
  if (prompt.length === 0) return { readable: false, reason: 'EMPTY_PROMPT' };
  if (/ناخوانا|غیرقابل خواندن|نامفهوم/.test(prompt) && prompt.length < 60) {
    return { readable: false, reason: 'ILLEGIBLE_TEXT' };
  }
  return { readable: true };
}

// ─── وارسی دامنهٔ اعداد ───

/**
 * اعدادِ محتوایی یک سؤال ضرب/تقسیم را از متن استخراج می‌کند:
 * عملوندها = عددهای prompt (دستور سؤال)؛ حاصل = answerValue (اگر هست)
 * qType جدولی → قید جدول‌مبنا؛ وگرنه قید عمومی دامنه
 */
function checkNumberDomain(item, dom, familyId) {
  const violations = [];
  const numbers = extractNumbers(item.prompt);
  const answer = item.answerValue ?? null;
  const qType = String(item.qType || '');
  const isTableFact = /جدول/.test(qType);

  const nd = dom.numberDomain || {};

  if (/ضرب|×/.test(String(item.prompt) + ' ' + qType)) {
    // عملوندها: اولویت با جفت‌های «A × B»؛ اگر نبود، همهٔ عددهای متن (مسئلهٔ متنی بی‌سیمبل)
    const mulPairs = extractMulPairs(item.prompt);
    const operandNumbers = mulPairs.length > 0 ? mulPairs : numbers;
    if (isTableFact && nd.tableFacts) {
      for (const n of operandNumbers) {
        if (!inRange(n, nd.tableFacts.operands)) {
          violations.push({ code: 'NUM_OUT_OF_TABLE_OPERAND', value: n, limit: nd.tableFacts.operands });
        }
      }
      if (answer !== null && !inRange(answer, nd.tableFacts.product)) {
        violations.push({ code: 'NUM_OUT_OF_TABLE_PRODUCT', value: answer, limit: nd.tableFacts.product });
      }
    } else if (nd.default) {
      const lim = nd.default;
      for (const n of operandNumbers) {
        if (lim.operands && !inRange(n, lim.operands)) {
          violations.push({ code: 'NUM_OPERAND_OUT_OF_RANGE', value: n, limit: lim.operands });
        }
      }
      if (answer !== null && lim.product && !inRange(answer, lim.product)) {
        violations.push({ code: 'NUM_PRODUCT_OUT_OF_RANGE', value: answer, limit: lim.product });
      }
    } else if (nd.operands) {
      // قلم‌بندی تخت (مثل G2-D4): عملوندها/حاصل مستقیم روی دامنه
      for (const n of operandNumbers) {
        if (!inRange(n, nd.operands)) {
          violations.push({ code: 'NUM_OPERAND_OUT_OF_RANGE', value: n, limit: nd.operands });
        }
      }
      if (answer !== null && nd.product && !inRange(answer, nd.product)) {
        violations.push({ code: 'NUM_PRODUCT_OUT_OF_RANGE', value: answer, limit: nd.product });
      }
    }
  }

  if (/تقسیم|÷|بخش‌کردن/.test(String(item.prompt) + ' ' + qType) && nd.default) {
    const lim = nd.default;
    for (const n of numbers) {
      if (lim.dividend && !inRange(n, lim.dividend)) {
        violations.push({ code: 'NUM_DIVIDEND_OUT_OF_RANGE', value: n, limit: lim.dividend });
      }
    }
  }

  // جمع/تفریق: سقف‌های per-book از قرارداد (sum/sub)
  if (/جمع|تفریق|\+|−|-\s*\d/.test(String(item.prompt) + ' ' + qType) && nd.sum) {
    const numbersAll = [...numbers, ...(answer !== null ? [answer] : [])];
    for (const n of numbersAll) {
      if (!inRange(n, nd.sum)) {
        violations.push({ code: 'NUM_OUT_OF_SUM_RANGE', value: n, limit: nd.sum });
      }
    }
  }

  // کسر: مخرج/صورت
  if (nd.denominator && /مخرج|صورت|کسر/.test(String(item.prompt) + ' ' + qType)) {
    for (const n of numbers) {
      if (!inRange(n, nd.denominator) && !inRange(n, nd.numerator || nd.denominator)) {
        violations.push({ code: 'NUM_OUT_OF_FRACTION_RANGE', value: n, limit: nd.denominator });
      }
    }
  }

  // عملیات مسدود per-book (مثل mulcol=null در G2)
  const blocked = nd.blockedOps || [];
  if (blocked.includes('mulcol') && /ستونی/.test(String(item.prompt) + ' ' + qType) && /ضرب|×/.test(String(item.prompt) + ' ' + qType)) {
    violations.push({ code: 'OP_BLOCKED_PER_BOOK', value: 'mulcol', limit: null });
  }

  return violations;
}

// ─── طبقه‌بندی یک آیتم ───

/**
 * classifyScope(item, profile, familyId)
 * item: { id?, prompt, qType?, domainCode?, answerValue?, title?, detail?, kind? }
 * خروجی: { verdict, blocking, reasons[], evidence, inspector, profileVersion }
 */
export function classifyScope(item, profile, familyId) {
  const check = validateProfile(profile);
  if (!check.ok) {
    return {
      verdict: VERDICTS.UNKNOWN_REVIEW,
      blocking: false,
      reasons: [`PROFILE_FAIL_CLOSED: ${check.reason}`],
      evidence: {},
      inspector: INSPECTOR_VERSION,
      profileVersion: profile?.version ?? null,
    };
  }

  const family = profile.families[familyId];
  if (!family) {
    return {
      verdict: VERDICTS.UNKNOWN_REVIEW,
      blocking: false,
      reasons: [`FAMILY_UNKNOWN: ${familyId}`],
      evidence: {},
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  const reasons = [];
  const evidence = {};

  // صفحات غیرمحتوایی (جلد/شناسنامه/فهرست) — محتوا نیستند، اثری بر حکم مفهومی ندارند
  if (item.kind && item.kind !== 'سؤال' && item.kind !== 'صفحهٔ محتوایی') {
    if (item.kind === 'بنر/ظاهر') {
      return {
        verdict: VERDICTS.COSMETIC_ONLY,
        blocking: false,
        reasons: ['COSMETIC: بدون اثر بر هدف آموزشی یا رفتار بازی'],
        evidence: {},
        inspector: INSPECTOR_VERSION,
        profileVersion: profile.version,
      };
    }
  }

  // ۱) خوانایی — ناخوانا/خالی → REVIEW (حدس ممنوع)
  const read = readability(item);
  if (!read.readable) {
    return {
      verdict: VERDICTS.UNKNOWN_REVIEW,
      blocking: false,
      reasons: [`NOT_GUESSED: ${read.reason}`],
      evidence: {},
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  // ۲) domainCode میراثی — بدون حدسِ دامنه
  if (!item.domainCode) {
    return {
      verdict: VERDICTS.UNKNOWN_REVIEW,
      blocking: false,
      reasons: ['LEGACY_NO_DOMAIN: سؤال فاقد domainCode است — برچسب‌گذاری دامنه کار انسانی/خط تولید است'],
      evidence: {},
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  const dom = family.domains[item.domainCode];
  if (!dom) {
    return {
      verdict: VERDICTS.UNKNOWN_REVIEW,
      blocking: false,
      reasons: [`DOMAIN_CODE_UNKNOWN: ${item.domainCode} در پروفایل ${familyId} نیست`],
      evidence: {},
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  // ۳) تشخیص مفهوم
  const detected = detectConcepts(item, family);
  evidence.primary = detected.primary;
  evidence.prereq = detected.prereq;

  // ۳-ب) qTypeِ اعلام‌شدهٔ تولیدکننده — تطبیق دقیق با فهرست qTypes پروفایل
  //      (آیتم‌های واقعی کارتریج همیشه qType از ماتریس دارند)
  const declaredByQType = [];
  if (item.qType) {
    for (const [did, domEntry] of Object.entries(family.domains)) {
      if ((domEntry.qTypes || []).includes(item.qType)) declaredByQType.push(did);
    }
  }
  evidence.declaredByQType = declaredByQType;

  const declaredHere =
    detected.primary.some((p) => p.domain === item.domainCode) ||
    declaredByQType.includes(item.domainCode);
  const foreignPrimary = detected.primary.filter((p) => p.domain !== item.domainCode);

  // qTypeِ متعلق به دامنهٔ دیگر = انحراف هدف صریح (نه حدس)
  const qTypeForeign = declaredByQType.filter((d) => d !== item.domainCode);
  if (declaredByQType.length > 0 && !declaredByQType.includes(item.domainCode)) {
    evidence.foreignPrimary = foreignPrimary.concat(
      qTypeForeign.map((d) => ({ domain: d, hits: [`qType: ${item.qType}`] }))
    );
    reasons.push(
      `PRIMARY_DRIFT: qType «${item.qType}» متعلق به دامنهٔ ${qTypeForeign.join('،')} است، نه ${item.domainCode}`
    );
    return {
      verdict: VERDICTS.CRITICAL_DRIFT,
      blocking: true,
      reasons,
      evidence,
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  // ۴) مرز آموزشی: جمع تکراری در آموزش ضرب → پیش‌نیاز، نه انحراف
  const repeatedAdd = hasRepeatedAddition(item.prompt);
  if (repeatedAdd && /ضرب|×|دسته/.test(item.prompt + ' ' + (item.qType || ''))) {
    evidence.repeatedAddition = true;
  }

  // ۵) حکم مفهومی
  if (declaredHere) {
    // هدف اصلی داخل دامنه — حالا وارسی اعداد
    const numViolations = checkNumberDomain(item, dom, familyId);
    if (numViolations.length > 0) {
      evidence.numberViolations = numViolations;
      reasons.push('NUMBER_DOMAIN_VIOLATION: عدد بیرون حدهای per-book/دامنه');
      return {
        verdict: VERDICTS.CRITICAL_DRIFT,
        blocking: true,
        reasons,
        evidence,
        inspector: INSPECTOR_VERSION,
        profileVersion: profile.version,
      };
    }

    if (evidence.repeatedAddition) {
      reasons.push('PREREQ_BOUNDARY: جمع تکراری به‌عنوان بازنمایی مفهوم ضرب — مجاز و جدا طبقه‌بندی شد');
    }
    if (foreignPrimary.length > 0) {
      evidence.sideRefs = foreignPrimary;
      reasons.push('SIDE_REF_ALSO: اشارهٔ فرعی به مفهوم دیگر — غیرتوقف‌زا، جدا ثبت شد');
      return {
        verdict: VERDICTS.IN_SCOPE,
        blocking: false,
        reasons,
        evidence,
        inspector: INSPECTOR_VERSION,
        profileVersion: profile.version,
      };
    }
    return {
      verdict: VERDICTS.IN_SCOPE,
      blocking: false,
      reasons: ['IN_SCOPE: هدف اصلی با پروفایل دامنه می‌خواند و اعداد داخل حد است'],
      evidence,
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  // هدف اصلی این‌جا اعلام نشده — پیش‌نیاز خالص یا انحراف؟
  const prereqForThisDomain = detected.prereq.find((p) => p.domain === item.domainCode);
  if (prereqForThisDomain || (evidence.repeatedAddition && /ضرب|جدول|دسته/.test(item.qType || ''))) {
    return {
      verdict: VERDICTS.PREREQ_ONLY,
      blocking: false,
      reasons: ['PREREQ_ONLY: فقط پیش‌نیاز/بازنمایی مفهومی — جدا طبقه‌بندی شد، توقف‌زا نیست'],
      evidence,
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  if (foreignPrimary.length > 0) {
    evidence.foreignPrimary = foreignPrimary;
    reasons.push(`PRIMARY_DRIFT: هدف اصلی به دامنهٔ ${foreignPrimary.map((f) => f.domain).join('،')} تعلق دارد، نه ${item.domainCode}`);
    return {
      verdict: VERDICTS.CRITICAL_DRIFT,
      blocking: true,
      reasons,
      evidence,
      inspector: INSPECTOR_VERSION,
      profileVersion: profile.version,
    };
  }

  // هیچ سیگنالی نیافتیم — حدس نمی‌زنیم
  return {
    verdict: VERDICTS.UNKNOWN_REVIEW,
    blocking: false,
    reasons: ['NO_SIGNAL_MATCHED: نه هدف مجاز، نه پیش‌نیاز، نه انحرافِ قابل‌تشخیص — نیازمند بازبینی انسانی'],
    evidence,
    inspector: INSPECTOR_VERSION,
    profileVersion: profile.version,
  };
}

// ─── ممیزی دسته‌ای + خلاصه ───

/**
 * auditContent(items, profile, familyId)
 * خروجی: { results[], summary{...}, blocked }
 */
export function auditContent(items, profile, familyId) {
  const results = (items || []).map((item) => ({
    id: item.id ?? null,
    domainCode: item.domainCode ?? null,
    qType: item.qType ?? item.title ?? null,
    ...classifyScope(item, profile, familyId),
  }));

  const count = (v) => results.filter((r) => r.verdict === v).length;
  const summary = {
    total: results.length,
    IN_SCOPE: count(VERDICTS.IN_SCOPE),
    PREREQ_ONLY: count(VERDICTS.PREREQ_ONLY),
    SIDE_REF: count(VERDICTS.SIDE_REF),
    UNKNOWN_REVIEW: count(VERDICTS.UNKNOWN_REVIEW),
    COSMETIC_ONLY: count(VERDICTS.COSMETIC_ONLY),
    CRITICAL_DRIFT: count(VERDICTS.CRITICAL_DRIFT),
    familyId,
    profileVersion: profile.version,
    matrixPin: profile.derivedFrom.domainMatrixSha256,
    inspector: INSPECTOR_VERSION,
  };

  const criticalItems = results.filter((r) => r.verdict === VERDICTS.CRITICAL_DRIFT);
  const reviewItems = results.filter((r) => r.verdict === VERDICTS.UNKNOWN_REVIEW);

  return {
    results,
    summary,
    criticalItems,
    reviewItems,
    blocked: criticalItems.length > 0,
  };
}

export const isBlocking = (verdict) => BLOCKING.has(verdict);
