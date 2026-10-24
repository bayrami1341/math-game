// ─────────────────────────────────────────────────────────────────────────────
// آزمون مستقل محدودهٔ مفهومی — v10.6 (فرمان مالک: پوشش نمونهٔ مثبت،
// انحراف واضح، مرزِ جمع تکراری در آموزش ضرب، UNKNOWN بدون حدس،
// ظاهری غیرهم‌وزن، bind پروفایل نسخه‌دار)
//
// فیکسچرها «مصنوعی و غیرحق‌نشری»اند (مثل G2-CAP) — برای آزمون رفتار بازرس،
// نه برای ورود به خشاب رسمی. منبع پروفایل: authoring/CONCEPT-PROFILE.json
// ─────────────────────────────────────────────────────────────────────────────

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  VERDICTS,
  INSPECTOR_VERSION,
  faToInt,
  extractNumbers,
  hasRepeatedAddition,
  extractMulPairs,
  validateProfile,
  classifyScope,
  auditContent,
  isBlocking,
} from '../src/v10/concept-scope.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// tests/ → public/math-game/ → public/ → root مخزن
const root = path.resolve(here, '../../..');
const PROFILE = JSON.parse(
  readFileSync(path.join(root, 'authoring/CONCEPT-PROFILE.json'), 'utf8')
);

// وارسی هش ماتریس (bind) — پروفایل باید به همان ماتریس رسمی دست‌بسته باشد
const MATRIX_PATH = path.join(root, 'public/math-game/authoring/DOMAIN-MATRIX.json');
const MATRIX_SHA = createHash('sha256').update(readFileSync(MATRIX_PATH)).digest('hex');

// ─── ابزار: گزاره‌ساز ───

const q = (over = {}) => ({
  id: 'CS-FIX-' + Math.random().toString(36).slice(2, 7),
  prompt: '',
  domainCode: 'D4',
  ...over,
});

// ─── ۰. پروفایل نسخه‌دار و bind ───

test('0.1 پروفایل رسمی معتبر است و به ماتریس رسمی دست‌بسته است', () => {
  const check = validateProfile(PROFILE);
  assert.equal(check.ok, true, check.reason);
  assert.equal(PROFILE.derivedFrom.domainMatrixSha256, MATRIX_SHA);
  assert.match(PROFILE.schema, /khshab\.concept-profile\/v1/);
});

test('0.2 fail-closed: پروفایل بی‌پین ماتریس → UNKNOWN_REVIEW نه حدس', () => {
  const broken = { ...PROFILE, derivedFrom: {} };
  const verdict = classifyScope(q({ prompt: '۳×۴' }), broken, 'KH-G3-MATH');
  assert.equal(verdict.verdict, VERDICTS.UNKNOWN_REVIEW);
  assert.match(verdict.reasons[0], /PROFILE_FAIL_CLOSED/);
  assert.equal(verdict.blocking, false);
});

test('0.3 fail-closed: schema غلط → رد', () => {
  const broken = { ...PROFILE, schema: 'khshab.concept-profile/v9' };
  assert.equal(validateProfile(broken).ok, false);
  assert.equal(validateProfile(broken).reason, 'PROFILE_SCHEMA_MISMATCH');
});

// ─── ۱. نمونه‌های مثبت — هر ۱۴ دامنهٔ هر دو کتاب ───

const POSITIVES_G3 = [
  ['D1', { prompt: 'الگوی عددی ۲، ۴، ۶، □ ادامه بده. خانهٔ جاافتاده کدام است؟' }],
  ['D2', { prompt: 'در عدد ۴۵۲۷، رقم ۵ در کدام خانهٔ ارزش مکانی است؟', answerValue: null }],
  ['D3', { prompt: 'حاصل ۲۴۵ + ۱۳۷ را با جمع ستونی و انتقال پیدا کن.', answerValue: 382 }],
  ['D4', { prompt: 'روی میز ۲۷ بشقاب است و در هر بشقاب ۳ تا سنجاق گذاشته‌اند. روی هم چند سنجاق است؟', qType: 'مسئلهٔ متنی', answerValue: 81 }],
  ['D4', { prompt: 'حاصل ۷ × ۸ در جدول ضرب چند است؟', qType: 'جدول ۲..۱۰ درجهت', answerValue: 56 }],
  ['D5', { prompt: 'کسر ۳ بر ۸ روی شکل رنگ‌آمیزی شده است. مخرج این کسر چند است؟' }],
  ['D6', { prompt: 'محیط شکل را با شمارش ضلع‌ها حساب کن. هر ضلع ۴ سانتی‌متر است.' }],
  ['D7', { prompt: 'از نمودار ستونی کلاس، چند دانش‌آموز اتوبوس را انتخاب کردند؟' }],
  ['D8', { prompt: 'حاصل ۳۰ × ۴ با الگوی مضرب چند است؟', answerValue: 120 }],
];

for (const [domainCode, over] of POSITIVES_G3) {
  test(`1.G3 ${domainCode} نمونهٔ مثبت → IN_SCOPE`, () => {
    const verdict = classifyScope(q({ domainCode, ...over }), PROFILE, 'KH-G3-MATH');
    assert.equal(verdict.verdict, VERDICTS.IN_SCOPE, JSON.stringify(verdict));
    assert.equal(verdict.blocking, false);
  });
}

const POSITIVES_G2 = [
  ['D1', { prompt: 'الگوی شکلی را ادامه بده و شکل جاافتاده را پیدا کن.' }],
  ['D2', { prompt: 'عدد ۲۴۵ را بخوان و عدد بعدی آن را بنویس.', answerValue: null }],
  ['D3', { prompt: 'حاصل ۲۳ + ۴۵ را با حساب فکری پیدا کن.', answerValue: 68 }],
  ['D4', { prompt: 'در جدول ضرب، حاصل ۵ × ۳ چند است؟', qType: 'جدول‌های ۲/۳/۴/۵/۱۰', answerValue: 15 }],
  ['D5', { prompt: 'با خط‌کش طول مداد را به سانتی‌متر اندازه بگیر.' }],
  ['D6', { prompt: 'از جدول داده، تعداد روزهای آفتابی را از نمودار بخوان.' }],
];

for (const [domainCode, over] of POSITIVES_G2) {
  test(`1.G2 ${domainCode} نمونهٔ مثبت → IN_SCOPE`, () => {
    const verdict = classifyScope(q({ domainCode, ...over }), PROFILE, 'KH-G2-MATH');
    assert.equal(verdict.verdict, VERDICTS.IN_SCOPE, JSON.stringify(verdict));
  });
}

// ─── ۲. انحراف‌های واضح → CRITICAL_DRIFT و عامل توقف ───

test('2.1 کسر در دامنهٔ ضرب (G3-D4) → انحراف بحرانی', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', prompt: 'کسر نصفِ شکل را رنگ کن. مخرج کسر چند است؟' }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.CRITICAL_DRIFT);
  assert.equal(verdict.blocking, true);
  assert.equal(isBlocking(verdict.verdict), true);
  assert.match(verdict.reasons[0], /PRIMARY_DRIFT/);
});

test('2.2 ضرب ۱۲×۱۲ در جدول G2-D4 (جدول‌های مجاز ۲/۳/۴/۵/۱۰) → بحرانی', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', prompt: 'حاصل ۱۲ × ۱۲ در جدول ضرب چند است؟', qType: 'جدول‌های ۲/۳/۴/۵/۱۰', answerValue: 144 }),
    PROFILE,
    'KH-G2-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.CRITICAL_DRIFT);
  assert.match(JSON.stringify(verdict.evidence.numberViolations), /NUM_OPERAND_OUT_OF_RANGE/);
});

test('2.3 جمع با حاصل ۱۵۰ در G2-D3 (حد per-book تا ۱۰۰) → بحرانی', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D3', prompt: 'حاصل ۸۵ + ۶۵ را پیدا کن.', answerValue: 150 }),
    PROFILE,
    'KH-G2-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.CRITICAL_DRIFT);
  assert.match(JSON.stringify(verdict.evidence.numberViolations), /NUM_OUT_OF_SUM_RANGE/);
});

test('2.4 ضرب ستونی در G2 (mulcol=null در قرارداد) → بحرانی', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', prompt: 'ضرب ستونی ۲۳ × ۴ را حل کن.', answerValue: 92 }),
    PROFILE,
    'KH-G2-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.CRITICAL_DRIFT);
  const codes = verdict.evidence.numberViolations.map((v) => v.code);
  assert.ok(codes.includes('OP_BLOCKED_PER_BOOK') || codes.includes('NUM_OPERAND_OUT_OF_RANGE'));
});

test('2.5 جدول ۱۴ در G3-D4 (قید جدول‌مبنا ۰..۱۰) → بحرانی', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', prompt: 'حاصل ۱۴ × ۵ در جدول ضرب چند است؟', qType: 'جدول ۲..۱۰ درجهت', answerValue: 70 }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.CRITICAL_DRIFT);
});

// ─── ۳. مورد مرزی: جمع تکراری در آموزش ضرب ───

test('3.1 مرز رسمی: «۳×۴ کدام جمع تکراری است؟» → PREREQ_ONLY نه انحراف (G3-D4)', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', prompt: '۳×۴ کدام جمع تکراری است؟ الف) ۳+۴ ب) ۴+۴+۴ ج) ۳+۳+۴ د) ۴+۴', answerIndex: 1 }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.IN_SCOPE, 'هدف اصلی ضرب است و جمع تکراری پیش‌نیازِ مجاز');
  assert.match(verdict.reasons.join(' '), /PREREQ_BOUNDARY/);
  assert.equal(verdict.blocking, false);
  assert.equal(verdict.evidence.repeatedAddition, true);
});

test('3.2 سؤالِ فقط‌پیش‌نیاز: الگوی جمع تکراری بدون هدف ضربِ دیگر → PREREQ_ONLY', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', qType: 'مفهوم: دسته‌های مساوی→ضرب', prompt: 'جمع تکراری ۵+۵+۵ را با شمارش پرشی بنویس.' }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.ok(
    verdict.verdict === VERDICTS.PREREQ_ONLY || verdict.verdict === VERDICTS.IN_SCOPE,
    'پیش‌نیاز مجاز است؛ هرگز نباید انحراف حساب شود'
  );
  assert.equal(verdict.blocking, false);
});

test('3.3 جمع عمومیِ مستقل در دامنهٔ ضرب (بدون قاب مفهومی ضرب) → انحراف بحرانی', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', prompt: 'حاصل ۳۶ + ۴۷ را با جمع ستونی پیدا کن.', answerValue: 83 }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.CRITICAL_DRIFT);
  assert.equal(verdict.blocking, true);
});

test('3.4 ابزار تشخیص: hasRepeatedAddition فقط تکرار همان عملوند را می‌پذیرد', () => {
  assert.equal(hasRepeatedAddition('۴+۴+۴'), true);
  assert.equal(hasRepeatedAddition('5 + 5 + 5 + 5'), true);
  assert.equal(hasRepeatedAddition('۳+۴+۵'), false);
  assert.equal(hasRepeatedAddition('۳+۴'), false);
});

// درس آزمون‌شده روی محتوای واقعی: حاصل میانی/لنگر در متن عملوند نیست

test('3.5 رگرسیون Q-4064: لنگر ۱۳×۱۰=۱۳۰ — عدد ۱۳۰ عملوند نیست → IN_SCOPE', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', qType: 'لنگر ۵/۱۰', prompt: 'علی برای حل ۱۳ × ۹ از لنگر ۱۳ × ۱۰ = ۱۳۰ کمک گرفت. حاصل ۱۳ × ۹ چند است؟', answerValue: 117 }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.IN_SCOPE, JSON.stringify(verdict.evidence));
});

test('3.6 رگرسیون Q-4083: خانوادهٔ ضرب-تقسیم با حاصل میانی ۳۲۰ → IN_SCOPE', () => {
  const verdict = classifyScope(
    q({ domainCode: 'D4', qType: 'خانوادهٔ ضرب-تقسیم', prompt: 'اگر ۴۰ × ۸ = ۳۲۰ باشد، آنگاه ۳۲۰ ÷ ۴۰ چند است؟', answerValue: 8 }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.IN_SCOPE, JSON.stringify(verdict.evidence));
});

test('3.7 جفت‌عملوند: فقط عددهای مجاور × عملوند شمرده می‌شوند', () => {
  assert.deepEqual(extractMulPairs('حاصل ۱۳ × ۹ از لنگر ۱۳ × ۱۰ = ۱۳۰'), [13, 9, 13, 10]);
  assert.deepEqual(extractMulPairs('روی میز ۲۷ بشقاب و هر بشقاب ۳ سنجاق'), []);
});

// ─── ۴. UNKNOWN/REVIEW — حدس ممنوع ───

test('4.1 prompt خالی → UNKNOWN_REVIEW نه حدس', () => {
  const verdict = classifyScope(q({ prompt: '' }), PROFILE, 'KH-G3-MATH');
  assert.equal(verdict.verdict, VERDICTS.UNKNOWN_REVIEW);
  assert.match(verdict.reasons[0], /EMPTY_PROMPT|NOT_GUESSED/);
});

test('4.2 ناخوانایی → UNKNOWN_REVIEW', () => {
  const verdict = classifyScope(q({ prompt: 'ناخوانا' }), PROFILE, 'KH-G3-MATH');
  assert.equal(verdict.verdict, VERDICTS.UNKNOWN_REVIEW);
  assert.match(verdict.reasons[0], /ILLEGIBLE/);
});

test('4.3 سؤال میراثیِ بی‌domainCode → UNKNOWN_REVIEW (برچسب دامنه حدس زده نمی‌شود)', () => {
  const verdict = classifyScope(q({ prompt: 'عدد بعد از ۳۹ چیست؟', domainCode: null }), PROFILE, 'KH-G2-MATH');
  assert.equal(verdict.verdict, VERDICTS.UNKNOWN_REVIEW);
  assert.match(verdict.reasons[0], /LEGACY_NO_DOMAIN/);
});

test('4.4 domainCode ناشناخته → UNKNOWN_REVIEW', () => {
  const verdict = classifyScope(q({ domainCode: 'D9', prompt: 'الگوی عددی ۲،۴،۶' }), PROFILE, 'KH-G3-MATH');
  assert.equal(verdict.verdict, VERDICTS.UNKNOWN_REVIEW);
  assert.match(verdict.reasons[0], /DOMAIN_CODE_UNKNOWN/);
});

test('4.5 هیچ سیگنالی نیافت → UNKNOWN_REVIEW نه حدس', () => {
  const verdict = classifyScope(q({ domainCode: 'D2', prompt: 'این متن سیگنال شناخته‌شده‌ای ندارد زیگزاگ فروتنی' }), PROFILE, 'KH-G3-MATH');
  assert.equal(verdict.verdict, VERDICTS.UNKNOWN_REVIEW);
  assert.match(verdict.reasons[0], /NO_SIGNAL_MATCHED/);
});

// ─── ۵. ظاهری — هم‌وزن مفهومی نیست ───

test('5.1 خطای بنر/ظاهر → COSMETIC_ONLY و غیرتوقف‌زا', () => {
  const verdict = classifyScope(
    q({ kind: 'بنر/ظاهر', prompt: 'غلط تایپی در بنر بالای صفحه' }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(verdict.verdict, VERDICTS.COSMETIC_ONLY);
  assert.equal(isBlocking(verdict.verdict), false);
});

test('5.2 وزن‌ها: ظاهری هرگز وارد جمعِ بحرانی نمی‌شود و توقف نمی‌سازد', () => {
  const audit = auditContent(
    [
      q({ kind: 'بنر/ظاهر', prompt: 'رنگ دکمه اشتباه است' }),
      q({ domainCode: 'D4', prompt: 'حاصل ۷ × ۸ در جدول ضرب چند است؟', qType: 'جدول ۲..۱۰ درجهت', answerValue: 56 }),
    ],
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(audit.blocked, false);
  assert.equal(audit.summary.COSMETIC_ONLY, 1);
  assert.equal(audit.summary.CRITICAL_DRIFT, 0);
});

// ─── ۶. ابزار عددی ───

test('6.1 faToInt ارقام فارسی/عربی/ASCII را می‌خواند', () => {
  assert.equal(faToInt('۱۴۰۴'), 1404);
  assert.equal(faToInt('٤٥'), 45);
  assert.equal(faToInt('78'), 78);
  assert.equal(faToInt('abc'), null);
});

test('6.2 extractNumbers همهٔ عددهای متن را به ترتیب می‌دهد', () => {
  assert.deepEqual(extractNumbers('روی میز ۲۷ بشقاب و هر بشقاب ۳ سنجاق → ۸۱'), [27, 3, 81]);
  assert.deepEqual(extractNumbers('بدون عدد'), []);
});

// ─── ۷. ممیزی دسته‌ای: توقف فقط با بحرانی ───

test('7.1 یک بحرانی → ممیزی متوقف می‌شود و فهرست جدا دارد', () => {
  const audit = auditContent(
    [
      q({ domainCode: 'D4', prompt: 'حاصل ۷ × ۸ چند است؟', qType: 'جدول ۲..۱۰ درجهت', answerValue: 56 }),
      q({ domainCode: 'D4', prompt: 'کسر نصف شکل را رنگ کن.', id: 'CS-DRIFT-1' }),
      q({ domainCode: 'D4', prompt: '۳×۵ کدام جمع تکراری است؟', answerIndex: 0 }),
    ],
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(audit.blocked, true);
  assert.equal(audit.summary.CRITICAL_DRIFT, 1);
  assert.equal(audit.criticalItems[0].id, 'CS-DRIFT-1');
  assert.ok(audit.summary.PREREQ_ONLY >= 1 || audit.summary.IN_SCOPE >= 1);
});

test('7.2 خلاصه با تعداد کل می‌خواند (هیچ آیتمی گم نمی‌شود)', () => {
  const items = [
    q({ domainCode: 'D4', prompt: 'حاصل ۶ × ۹ چند است؟', qType: 'جدول ۲..۱۰ درجهت', answerValue: 54 }),
    q({ prompt: '' }),
    q({ prompt: 'عدد بعد از ۳۹ چیست؟', domainCode: null }),
  ];
  const audit = auditContent(items, PROFILE, 'KH-G3-MATH');
  const sum =
    audit.summary.IN_SCOPE +
    audit.summary.PREREQ_ONLY +
    audit.summary.SIDE_REF +
    audit.summary.UNKNOWN_REVIEW +
    audit.summary.COSMETIC_ONLY +
    audit.summary.CRITICAL_DRIFT;
  assert.equal(sum, audit.summary.total);
  assert.equal(audit.summary.total, 3);
});

test('7.3 مهر بازرس و پین ماتریس در خروجی ممیزی ثبت می‌شود (قابلیت ممیزی)', () => {
  const audit = auditContent([q({ prompt: '' })], PROFILE, 'KH-G3-MATH');
  assert.equal(audit.summary.inspector, INSPECTOR_VERSION);
  assert.equal(audit.summary.matrixPin, MATRIX_SHA);
});

// ─── ۸. نگهبان ضد-کورکوری: بازرس باید انحراف تزریقی را بگیرد ───

test('8.1 نگهبان: اگر بازرس یک انحرافِ آشکار را IN_SCOPE بدهد آزمون قرمز است', () => {
  // تزریق عمدی انحراف — این assert تضمین می‌کند بازرس کورکور نشده
  const drift = classifyScope(
    q({ domainCode: 'D6', prompt: 'حاصل کسر یک‌دوم و مخرج آن را بنویس.' }),
    PROFILE,
    'KH-G3-MATH'
  );
  assert.equal(drift.verdict, VERDICTS.CRITICAL_DRIFT, 'کسر در دامنهٔ هندسه باید انحراف باشد');
});
