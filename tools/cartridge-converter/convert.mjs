// ─────────────────────────────────────────────────────────────────────────────
// مبدل فرم تألیف اکسل → خشاب JSON اجرایی (v10.3)
// اجرا:  bun convert.mjs [مسیر اکسل]
// خروجی: public/math-game/cartridges/KH-G3-MATH.json + گزارش در download/
//
// اصل fail-closed: اگر اعتبارسنجی (cartridge-schema.js) خطا داشته باشد،
// JSON منتشر نمی‌شود و فقط گزارش قرمز نوشته می‌شود.
// ─────────────────────────────────────────────────────────────────────────────

import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARTRIDGE_FORMAT_VERSION, CARTRIDGE_ID,
  validateCartridge, parseClaims, parseOptionValue,
  parsePlainMultiplication, extractQRefs, AUDIT_ANSWER_RECEIPTS
} from '../../public/math-game/src/v10/station/cartridge-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const inputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'download', 'khshab-G3-MATH_v0.6.xlsx');
const outJson = path.join(ROOT, 'public', 'math-game', 'cartridges', `${CARTRIDGE_ID}.json`);
const outReport = path.join(ROOT, 'download', `convert-report-${CARTRIDGE_ID}-${path.basename(inputPath, '.xlsx').split('_').pop()}.md`);

const ANSWER_LETTER = { 'الف': 0, 'ب': 1, 'ج': 2, 'د': 3 };
const clean = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const rawClean = v => (v === null || v === undefined ? '' : String(v).trim());

function readSheet(wb, needle) {
  const name = wb.SheetNames.find(n => n.includes(needle));
  if (!name) throw new Error(`شیت «${needle}» پیدا نشد`);
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: null });
}

function headerRow(rows, firstCellPrefix) {
  const i = rows.findIndex(r => clean(r?.[0]).startsWith(firstCellPrefix));
  if (i < 0) throw new Error(`هدر «${firstCellPrefix}» پیدا نشد`);
  return i;
}

function dataRows(rows, headIdx) {
  const out = [];
  for (let r = headIdx + 1; r < rows.length; r++) {
    const first = clean(rows[r]?.[0]);
    if (!first || first === 'یادداشت') break;
    out.push(rows[r]);
  }
  return out;
}

// ───────────────────────── خواندن ورک‌بوک ─────────────────────────
const wb = XLSX.readFile(inputPath);
const log = [];

// شناسنامهٔ خشاب (kv)
const idRows = readSheet(wb, 'شناسنامه');
const idHead = headerRow(idRows, 'فیلد');
const identity = [];
for (let r = idHead + 1; r < idRows.length; r++) {
  const k = clean(idRows[r]?.[0]);
  if (!k) break;
  identity.push({ field: k, value: clean(idRows[r]?.[1]), status: clean(idRows[r]?.[2]), source: clean(idRows[r]?.[3]) });
}
log.push(`شناسنامه: ${identity.length} فیلد`);

// نقشهٔ کتاب (۱۴ ستون)
const mapRows = readSheet(wb, 'نقشهٔ کتاب');
const mapHead = headerRow(mapRows, 'شناسه (L-)');
const bookMap = dataRows(mapRows, mapHead).map(r => ({
  id: clean(r[0]), page: clean(r[1]), chapter: clean(r[2]), title: clean(r[3]),
  objective: clean(r[4]), vocabulary: clean(r[5]), activityType: clean(r[6]),
  visual: clean(r[7]), practicePotential: clean(r[8]), engineCompat: clean(r[9]),
  anchorsRaw: rawClean(r[10]), source: clean(r[11]), status: clean(r[12]), note: clean(r[13])
}));
log.push(`نقشهٔ کتاب: ${bookMap.length} درس`);

// اطلس خطا (۱۱ ستون)
const atRows = readSheet(wb, 'اطلس خطا');
const atHead = headerRow(atRows, 'کد (E-)');
const errorAtlas = dataRows(atRows, atHead).map(r => {
  const codeCell = rawClean(r[0]);
  const proposedInCode = codeCell.includes('پیشنهاد');
  return {
    code: codeCell.replace(/\s*\(پیشنهاد\)\s*/, '').trim(),
    nameFa: clean(r[1]), category: clean(r[2]), description: clean(r[3]),
    behavioralSignal: clean(r[4]), questionPattern: clean(r[5]), intervention: clean(r[6]),
    priority: clean(r[7]), source: clean(r[8]),
    status: clean(r[9]) || (proposedInCode ? 'نیاز به تأیید' : ''),
    note: clean(r[10])
  };
});
log.push(`اطلس خطا: ${errorAtlas.length} کد`);

// بانک سؤال (۱۷ ستون)
const qRows = readSheet(wb, 'بانک سؤال');
const qHead = headerRow(qRows, 'شناسه (Q-)');
const questionBank = dataRows(qRows, qHead).map(r => {
  const prompt = clean(r[4]);
  const options = [clean(r[6]), clean(r[7]), clean(r[8]), clean(r[9])];
  const answerIndex = ANSWER_LETTER[clean(r[10])] ?? -1;
  const plain = parsePlainMultiplication(prompt);
  return {
    id: clean(r[0]), anchorId: clean(r[1]), domain: clean(r[2]), cpa: clean(r[3]),
    prompt, format: clean(r[5]), options, answerIndex,
    optionErrorMap: rawClean(r[11]),
    claims: parseClaims(r[11]),
    level: clean(r[12]), criteria: clean(r[13]), source: clean(r[14]),
    status: clean(r[15]), note: clean(r[16]),
    math: plain ? { ...plain, product: plain.f1 * plain.f2 } : null,
    answerValue: answerIndex >= 0 ? parseOptionValue(options[answerIndex]) : null
  };
});
log.push(`بانک سؤال: ${questionBank.length} سؤال`);

// واژه‌نامه (خام نگه داشته می‌شود) — هدر: شیت | ستون | معنی/قاعده | مقادیر مجاز
const glRows = readSheet(wb, 'واژه');
const glHead = headerRow(glRows, 'شیت');
const glossary = [];
for (let r = glHead + 1; r < glRows.length; r++) {
  const sheet = clean(glRows[r]?.[0]);
  if (!sheet) break;
  glossary.push({ sheet, column: clean(glRows[r]?.[1]), rule: clean(glRows[r]?.[2]), allowed: clean(glRows[r]?.[3]) });
}
log.push(`واژه‌نامه: ${glossary.length} ردیف`);

// سجل ممیزی (اختیاری — v0.6 به بعد)
let auditTrail = null;
try {
  const auRows = readSheet(wb, 'سجل ممیزی');
  const auHead = headerRow(auRows, 'شناسهٔ یافته');
  const entries = [];
  let note = '';
  for (let r = auHead + 1; r < auRows.length; r++) {
    const first = clean(auRows[r]?.[0]);
    if (!first) continue;
    if (clean(auRows[r]?.[1]) === '' && first.length > 20) { note += first + ' '; continue; }
    entries.push({ finding: first, place: clean(auRows[r]?.[1]), verdict: clean(auRows[r]?.[2]), fix: clean(auRows[r]?.[3]), status: clean(auRows[r]?.[4]) });
  }
  auditTrail = { entries, note: note.trim(), sheet: 'سجل ممیزی' };
  log.push(`سجل ممیزی: ${entries.length} ردیف`);
} catch { log.push('سجل ممیزی: یافت نشد (اختیاری)'); }

// ───────────────────────── اعتبارسنجی fail-closed ─────────────────────────
const cartridge = {
  formatVersion: CARTRIDGE_FORMAT_VERSION,
  cartridgeId: CARTRIDGE_ID,
  generatedAt: new Date().toISOString(),
  source: { file: path.basename(inputPath), tool: 'cartridge-converter v1.0' },
  identity, bookMap, errorAtlas, questionBank, glossary, auditTrail
};
const validation = validateCartridge(cartridge);

// ───────────────────────── گزارش ─────────────────────────
const report = [];
report.push(`# گزارش مبدل خشاب — ${CARTRIDGE_ID}`);
report.push('');
report.push(`- ورودی: \`${path.basename(inputPath)}\``);
report.push(`- ابزار: cartridge-converter v1.0 (قواعد = پرامپت ممیز T1..T7 + رسیدهای ممیزی)`);
report.push(`- زمان: ${new Date().toISOString()}`);
report.push('');
report.push('| سنجه | مقدار |');
report.push('|---|---|');
report.push(`| قرمز (بلوکه‌کننده) | **${validation.gate.red}** |`);
report.push(`| زرد (هشدار) | ${validation.gate.yellow} |`);
report.push(`| درس‌ها | ${validation.stats.lessons} (سبز: ${validation.stats.lessonsConfirmed}) |`);
report.push(`| اطلس | ${validation.stats.atlasReal} واقعی + ${validation.stats.atlasProposed} پیشنهادی |`);
report.push(`| بانک سؤال | ${validation.stats.questions} (سبز: ${validation.stats.questionsConfirmed}، زرد: ${validation.stats.questionsProposed}) |`);
report.push('');
if (validation.errors.length) {
  report.push('## خطاها (JSON منتشر نشد)');
  validation.errors.forEach(e => report.push(`- 🔴 ${e}`));
} else {
  report.push('## خطاها');
  report.push('- هیچ — گیت سبز.');
}
if (validation.warnings.length) {
  report.push('');
  report.push('## هشدارها (زرد — همان‌هایی که ممیزی AUD رسماً ثبت کرده)');
  validation.warnings.forEach(w => report.push(`- 🟡 ${w}`));
}
report.push('');
report.push('## رسیدهای کلید پاسخ');
report.push(`بررسی خودکار علیه ${Object.keys(AUDIT_ANSWER_RECEIPTS).length} رسید ممیزی + بازحساب فرم خام a×b.`);
report.push('');
report.push(`**حکم گیت مبدل: ${validation.gate.verdict}${validation.gate.red ? ' — انتشار JSON ممنوع' : ' — JSON منتشر شد'}**`);

fs.mkdirSync(path.dirname(outReport), { recursive: true });
fs.writeFileSync(outReport, report.join('\n'), 'utf8');

if (!validation.ok) {
  console.error('✗ اعتبارسنجی مردود — JSON منتشر نشد. گزارش:', outReport);
  validation.errors.forEach(e => console.error('  🔴', e));
  process.exit(1);
}

// ───────────────────────── انتشار ─────────────────────────
cartridge.validation = { ok: validation.ok, warnings: validation.warnings, stats: validation.stats, gate: validation.gate };
fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(cartridge, null, 2), 'utf8');

console.log('✓ مبدل: تخصیص‌ها');
log.forEach(l => console.log('  •', l));
console.log('  • گیت:', validation.gate.verdict, `(${validation.gate.red} قرمز، ${validation.gate.yellow} زرد)`);
console.log('✓ JSON:', outJson);
console.log('✓ گزارش:', outReport);
