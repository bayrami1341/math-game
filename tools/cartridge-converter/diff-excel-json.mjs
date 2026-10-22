#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ممیزی دوطرفهٔ سلول‌به‌سلول Excel ↔ Runtime JSON (بستن کامل شکاف P5)
//
// اثبات می‌کند که هیچ ردیف، صورت سؤال، گزینه، کلید پاسخ، کد خطا، لنگر یا یادداشتی
// در تبدیل اکسل به JSON گم، جابه‌جا یا تحریف نشده است (zero silent drop).
// ─────────────────────────────────────────────────────────────────────────────

import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ANSWER_LETTERS = ['الف', 'ب', 'ج', 'د'];
const clean = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());
const rawClean = v => (v === null || v === undefined ? '' : String(v).trim());

function readSheet(wb, needle) {
  const name = wb.SheetNames.find(n => n.includes(needle));
  if (!name) throw new Error(`شیت «${needle}» پیدا نشد`);
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: null });
}

function dataRows(rows, prefix) {
  const headIdx = rows.findIndex(r => clean(r?.[0]).startsWith(prefix));
  if (headIdx < 0) throw new Error(`هدر «${prefix}» یافت نشد`);
  const out = [];
  for (let r = headIdx + 1; r < rows.length; r++) {
    const first = clean(rows[r]?.[0]);
    if (!first || first === 'یادداشت') break;
    out.push(rows[r]);
  }
  return out;
}

export function diffExcelAndJson(xlsxPath, jsonPath) {
  const wb = XLSX.readFile(path.resolve(xlsxPath));
  const json = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));
  const diffs = [];

  const s1Rows = dataRows(readSheet(wb, 'نقشهٔ کتاب'), 'شناسه (L-)');
  const atlasRows = dataRows(readSheet(wb, 'اطلس خطا'), 'کد (E');
  const qRows = dataRows(readSheet(wb, 'بانک سؤال'), 'شناسه (Q-)');

  if (s1Rows.length !== json.bookMap.length) {
    diffs.push({ section: 'bookMap', issue: 'ROW_COUNT_MISMATCH', excel: s1Rows.length, json: json.bookMap.length });
  }
  if (atlasRows.length !== json.errorAtlas.length) {
    diffs.push({ section: 'errorAtlas', issue: 'ROW_COUNT_MISMATCH', excel: atlasRows.length, json: json.errorAtlas.length });
  }
  if (qRows.length !== json.questionBank.length) {
    diffs.push({ section: 'questionBank', issue: 'ROW_COUNT_MISMATCH', excel: qRows.length, json: json.questionBank.length });
  }

  for (let i = 0; i < Math.min(s1Rows.length, json.bookMap.length); i++) {
    const r = s1Rows[i];
    const j = json.bookMap[i];
    if (clean(r[0]) !== j.id || clean(r[1]) !== j.page || clean(r[3]) !== j.title || rawClean(r[10]) !== j.anchorsRaw) {
      diffs.push({ section: 'bookMap', index: i, id: j.id, issue: 'CELL_VALUE_DRIFT' });
    }
  }

  for (let i = 0; i < Math.min(qRows.length, json.questionBank.length); i++) {
    const r = qRows[i];
    const j = json.questionBank[i];
    const excelLetter = clean(r[10]);
    const jsonLetter = ANSWER_LETTERS[j.answerIndex] ?? '';
    const excelOpts = [clean(r[6]), clean(r[7]), clean(r[8]), clean(r[9])];
    if (
      clean(r[0]) !== j.id ||
      clean(r[1]) !== j.anchorId ||
      clean(r[4]) !== j.prompt ||
      excelLetter !== jsonLetter ||
      JSON.stringify(excelOpts) !== JSON.stringify(j.options) ||
      rawClean(r[11]) !== j.optionErrorMap
    ) {
      diffs.push({ section: 'questionBank', index: i, id: j.id, issue: 'QUESTION_FIELD_DRIFT' });
    }
  }

  return {
    ok: diffs.length === 0,
    counts: {
      lessons: s1Rows.length,
      errorAtlas: atlasRows.length,
      questions: qRows.length
    },
    diffs
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [xlsxPath, jsonPath] = process.argv.slice(2);
  if (!xlsxPath || !jsonPath) {
    console.error('Usage: node tools/cartridge-converter/diff-excel-json.mjs <file.xlsx> <file.json>');
    process.exit(1);
  }
  const result = diffExcelAndJson(xlsxPath, jsonPath);
  if (!result.ok) {
    console.error('✗ ناهم‌خوانی بین اکسل و JSON یافت شد:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(`✓ تطابق صددرصد اکسل ↔ JSON تأیید شد (${result.counts.lessons} درس، ${result.counts.errorAtlas} کد خطا، ${result.counts.questions} سؤال — ۰ اختلاف).`);
}
