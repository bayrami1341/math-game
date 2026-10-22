#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// مبدل رسمی فرم تألیف اکسل → خشاب JSON اجرایی (v10.3.2 — چندخشابی + حکمرانی انتشار)
//
// اجرا:
//   node tools/cartridge-converter/convert.mjs <input.xlsx> [--mode preview|release] [--out path.json] [--report path.md]
//
// اصول غیرقابل‌مذاکره:
//   ۱) fail-closed روی هر خطای ساختاری، لنگر، اطلس یا ضد J12 (خروجی غیرصفر، بدون نوشتن JSON).
//   ۲) در حالت `--mode release`: اگر حتی یک سؤال زرد («نیاز به تأیید»)، کد پیشنهادی یا
//      بانک بدون سؤال تأییدشده (`questionsConfirmed === 0`) وجود داشته باشد، انتشار
//      رسماً مسدود می‌شود (`exit code 2 — RELEASE_GATE_BLOCKED`).
// ─────────────────────────────────────────────────────────────────────────────

import XLSX from 'xlsx';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARTRIDGE_FORMAT_VERSION,
  validateCartridge,
  parseClaims,
  parseOptionValue,
  parsePlainMultiplication,
  AUDIT_ANSWER_RECEIPTS
} from '../../src/v10/station/cartridge-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const ANSWER_LETTER = { 'الف': 0, 'ب': 1, 'ج': 2, 'د': 3 };
const clean = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const rawClean = v => (v === null || v === undefined ? '' : String(v).trim());

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

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

export function convertWorkbook(inputPath, options = {}) {
  const resolvedInput = path.resolve(inputPath);
  const mode = options.mode || 'preview';
  const generatedAt = options.generatedAt || '2026-10-22T00:00:00.000Z';

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`SOURCE_XLSX_MISSING: ${resolvedInput}`);
  }
  const inputSha256 = sha256File(resolvedInput);
  const wb = XLSX.readFile(resolvedInput);

  // ۱. شناسنامهٔ خشاب
  const idRows = readSheet(wb, 'شناسنامه');
  const idHead = headerRow(idRows, 'فیلد');
  const identity = [];
  for (let r = idHead + 1; r < idRows.length; r++) {
    const k = clean(idRows[r]?.[0]);
    if (!k) break;
    identity.push({
      field: k,
      value: clean(idRows[r]?.[1]),
      status: clean(idRows[r]?.[2]),
      source: clean(idRows[r]?.[3])
    });
  }

  const idField = identity.find(x => String(x.field).replace(/\s+/g, '').startsWith('شناسهٔخشاب'));
  const idMatch = idField ? /^KH-[A-Z0-9]+-[A-Z0-9]+/.exec(String(idField.value || '').trim()) : null;
  if (!idMatch) {
    return {
      ok: false,
      exitCode: 1,
      reason: 'INVALID_CARTRIDGE_ID',
      errors: ['شناسهٔ خشاب در شیت «شناسنامهٔ خشاب» قابل استخراج نیست (قالب معتبر: KH-G2-MATH).']
    };
  }
  const targetId = idMatch[0];
  const versionTag = path.basename(resolvedInput, '.xlsx').split('_').pop();
  const outJson = options.outJson
    ? path.resolve(options.outJson)
    : path.join(ROOT, 'cartridges', `${targetId}.json`);
  const outReport = options.outReport
    ? path.resolve(options.outReport)
    : path.join(ROOT, 'authoring', 'audit', `convert-report-${targetId}-${versionTag}.md`);

  // ۲. نقشهٔ کتاب (S1)
  const mapRows = readSheet(wb, 'نقشهٔ کتاب');
  const mapHead = headerRow(mapRows, 'شناسه (L-)');
  const bookMap = dataRows(mapRows, mapHead).map(r => ({
    id: clean(r[0]),
    page: clean(r[1]),
    chapter: clean(r[2]),
    title: clean(r[3]),
    objective: clean(r[4]),
    vocabulary: clean(r[5]),
    activityType: clean(r[6]),
    visual: clean(r[7]),
    practicePotential: clean(r[8]),
    engineCompat: clean(r[9]),
    anchorsRaw: rawClean(r[10]),
    source: clean(r[11]),
    status: clean(r[12]),
    note: clean(r[13])
  }));

  // ۳. اطلس خطا
  const atRows = readSheet(wb, 'اطلس خطا');
  const atHead = headerRow(atRows, 'کد (E');
  const errorAtlas = dataRows(atRows, atHead).map(r => {
    const codeCell = rawClean(r[0]);
    const proposedInCode = codeCell.includes('پیشنهاد');
    const cleanCode = codeCell.replace(/\s*\([^)]*پیشنهاد[^)]*\)\s*/g, '').trim();
    const rawStatus = clean(r[9]);
    return {
      code: cleanCode,
      nameFa: clean(r[1]),
      category: clean(r[2]),
      description: clean(r[3]),
      behavioralSignal: clean(r[4]),
      questionPattern: clean(r[5]),
      intervention: clean(r[6]),
      priority: clean(r[7]),
      source: clean(r[8]),
      status: proposedInCode ? 'نیاز به تأیید' : (rawStatus || 'نیاز به تأیید'),
      note: clean(r[10])
    };
  });

  // ۴. بانک سؤال
  const qRows = readSheet(wb, 'بانک سؤال');
  const qHead = headerRow(qRows, 'شناسه (Q-)');
  const questionBank = dataRows(qRows, qHead).map(r => {
    const prompt = clean(r[4]);
    const optionsArr = [clean(r[6]), clean(r[7]), clean(r[8]), clean(r[9])];
    const answerIndex = ANSWER_LETTER[clean(r[10])] ?? -1;
    const plain = parsePlainMultiplication(prompt);
    return {
      id: clean(r[0]),
      anchorId: clean(r[1]),
      domain: clean(r[2]),
      cpa: clean(r[3]),
      prompt,
      format: clean(r[5]),
      options: optionsArr,
      answerIndex,
      optionErrorMap: rawClean(r[11]),
      claims: parseClaims(r[11]),
      level: clean(r[12]),
      criteria: clean(r[13]),
      source: clean(r[14]),
      status: clean(r[15]),
      note: clean(r[16]),
      math: plain ? { ...plain, product: plain.f1 * plain.f2 } : null,
      answerValue: answerIndex >= 0 ? parseOptionValue(optionsArr[answerIndex]) : null
    };
  });

  // ۵. واژه‌نامه
  const glRows = readSheet(wb, 'واژه');
  const glHead = headerRow(glRows, 'شیت');
  const glossary = [];
  for (let r = glHead + 1; r < glRows.length; r++) {
    const sheet = clean(glRows[r]?.[0]);
    if (!sheet) break;
    glossary.push({
      sheet,
      column: clean(glRows[r]?.[1]),
      rule: clean(glRows[r]?.[2]),
      allowed: clean(glRows[r]?.[3])
    });
  }

  // ۶. سجل / پروتکل ممیزی
  let auditTrail = null;
  try {
    const auName = wb.SheetNames.find(n => n.includes('سجل ممیزی') || n.includes('پروتکل ممیزی'));
    if (auName) {
      const auRows = XLSX.utils.sheet_to_json(wb.Sheets[auName], { header: 1, raw: false, defval: null });
      auditTrail = { sheet: auName, rowCount: auRows.filter(r => r && r.some(Boolean)).length };
    }
  } catch {
    auditTrail = null;
  }

  const cartridge = {
    formatVersion: CARTRIDGE_FORMAT_VERSION,
    cartridgeId: targetId,
    generatedAt,
    releaseStage: mode === 'release' ? 'production' : 'preview-awaiting-teacher-verdict',
    source: {
      file: path.basename(resolvedInput),
      sha256: inputSha256,
      tool: 'cartridge-converter v1.2 (چندخشابی + حکمرانی انتشار)'
    },
    identity,
    bookMap,
    errorAtlas,
    questionBank,
    glossary,
    auditTrail
  };

  const validation = validateCartridge(cartridge, targetId);

  // دروازهٔ سخت حالت انتشار (`--mode release`): بدون تأیید انسانی آموزگار هیچ JSON انتشاری صادر نمی‌شود!
  const releaseBlockers = [];
  if (mode === 'release') {
    if (validation.stats.questionsConfirmed === 0) {
      releaseBlockers.push('ZERO_CONFIRMED_QUESTIONS: هیچ سؤال تأییدشدهٔ انسانی در بانک وجود ندارد');
    }
    if (validation.stats.questionsProposed > 0) {
      releaseBlockers.push(`UNAPPROVED_YELLOW_QUESTIONS:${validation.stats.questionsProposed}`);
    }
    if (validation.stats.atlasProposed > 0) {
      releaseBlockers.push(`UNAPPROVED_PROPOSED_ERROR_CODES:${validation.stats.atlasProposed}`);
    }
  }

  const report = [
    `# گزارش مبدل خشاب — ${targetId} (${mode})`,
    '',
    `- ورودی: \`${path.basename(resolvedInput)}\` (\`sha256: ${inputSha256}\`)`,
    `- حالت اجرا: \`${mode}\``,
    '',
    '| سنجه | مقدار |',
    '|---|---|',
    `| قرمز (بلوکه‌کنندهٔ اسکیما) | **${validation.gate.red}** |`,
    `| زرد (هشدار ممیزی) | ${validation.gate.yellow} |`,
    `| درس‌ها (S1) | ${validation.stats.lessons} (تأییدشده: ${validation.stats.lessonsConfirmed}) |`,
    `| اطلس خطا | ${validation.stats.atlasReal} تأییدشده + ${validation.stats.atlasProposed} پیشنهادی |`,
    `| بانک سؤال | ${validation.stats.questions} (تأییدشده: ${validation.stats.questionsConfirmed}، زرد در انتظار معلّم: ${validation.stats.questionsProposed}) |`,
    `| موانع انتشار نهایی (\`release\`) | ${releaseBlockers.length ? releaseBlockers.join('؛ ') : 'هیچ'} |`,
    ''
  ];
  if (validation.errors.length) {
    report.push('## خطاهای اسکیما');
    validation.errors.forEach(e => report.push(`- 🔴 ${e}`));
  }
  if (validation.warnings.length) {
    report.push('', '## هشدارها');
    validation.warnings.forEach(w => report.push(`- 🟡 ${w}`));
  }

  fs.mkdirSync(path.dirname(outReport), { recursive: true });
  fs.writeFileSync(outReport, report.join('\n') + '\n', 'utf8');

  if (!validation.ok) {
    return {
      ok: false,
      exitCode: 1,
      reason: 'SCHEMA_VALIDATION_FAILED',
      validation,
      outReport,
      errors: validation.errors
    };
  }

  if (mode === 'release' && releaseBlockers.length > 0) {
    return {
      ok: false,
      exitCode: 2,
      reason: 'RELEASE_GATE_BLOCKED',
      validation,
      releaseBlockers,
      outReport,
      errors: releaseBlockers
    };
  }

  cartridge.validation = {
    ok: validation.ok,
    warnings: validation.warnings,
    stats: validation.stats,
    gate: validation.gate
  };
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(cartridge, null, 2) + '\n', 'utf8');

  return {
    ok: true,
    exitCode: 0,
    targetId,
    outJson,
    outJsonSha256: sha256File(outJson),
    outReport,
    validation
  };
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let input = null;
  let mode = 'preview';
  let outJson = null;
  let outReport = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) mode = args[++i];
    else if (args[i] === '--out' && args[i + 1]) outJson = args[++i];
    else if (args[i] === '--report' && args[i + 1]) outReport = args[++i];
    else if (!args[i].startsWith('--') && !input) input = args[i];
  }
  if (!input) {
    console.error('Usage: node tools/cartridge-converter/convert.mjs <input.xlsx> [--mode preview|release] [--out file.json]');
    process.exit(1);
  }

  const res = convertWorkbook(input, { mode, outJson, outReport });
  if (!res.ok) {
    console.error(`✗ [${res.reason}] تبدیل متوقف شد:`);
    for (const e of res.errors || []) console.error('  •', e);
    process.exit(res.exitCode || 1);
  }
  console.log(`✓ [${res.targetId}] تبدیل موفق (${mode}) — درس: ${res.validation.stats.lessons}، سؤال: ${res.validation.stats.questions} (سبز: ${res.validation.stats.questionsConfirmed}، زرد: ${res.validation.stats.questionsProposed})`);
  console.log(`  JSON:   ${res.outJson} (sha256: ${res.outJsonSha256})`);
  console.log(`  Report: ${res.outReport}`);
}
