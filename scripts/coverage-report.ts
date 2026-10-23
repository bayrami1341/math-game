/**
 * coverage-report.ts — گزارش پوشش دامنه‌دار خشاب‌ها (BP-015 T2)
 *
 * قانون مرجع: «تعریف آمادگی پایهٔ درسی» (Task 23) + ماتریس ماشینی
 *   public/math-game/authoring/DOMAIN-MATRIX.json (DRAFT تا مُهر گام صفر معلم)
 *
 * «آماده» هرگز ادعا نمی‌شود — اندازه‌گیری می‌شود.
 *
 * استفاده:
 *   bun scripts/coverage-report.ts \
 *     --cartridge public/math-game/cartridges/KH-G2-MATH.json \
 *     --cartridge public/math-game/cartridges/KH-G3-MATH.json \
 *     [--matrix public/math-game/authoring/DOMAIN-MATRIX.json] \
 *     [--markdown reports/coverage-current.md] [--gate] [--family KH-G2-MATH]
 *
 * حالت‌ها:
 *   پیش‌فرض      — چاپ گزارش + خروج ۰
 *   --gate       — fail-closed: اگر هیچ دامنه‌ای زیر حداقل باشد (یا minTotal) خروج ۱
 *   --markdown   — نوشتن گزارش در فایل
 *
 * قواعد شمارش:
 *   - سؤال با domainCode معتبر (D1..D8) → همان دامنه
 *   - سؤال بدون domainCode → سطل «میراثی» (بیرون از پوشش دامنه)
 *   - status === «تأییدشده» → ستون تأییدشده (پوشش مُهرشدهٔ واقعی)
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function argOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const cartridgePaths = args.flatMap((a, i) => (a === "--cartridge" ? [args[i + 1]] : []));
const matrixPath = argOf("--matrix") ?? "public/math-game/authoring/DOMAIN-MATRIX.json";
const markdownOut = argOf("--markdown");
const gateMode = args.includes("--gate");
const familyFilter = argOf("--family");

if (cartridgePaths.length === 0) {
  console.error("خطا: حداقل یک --cartridge بدهید (یا هر دو کارتریج رسمی)");
  process.exit(2);
}

// ── load ─────────────────────────────────────────────────────────────────────
const matrix = JSON.parse(readFileSync(matrixPath, "utf-8"));
if (matrix.schema !== "khshab.domain-matrix/v1") {
  console.error(`خطا: ماتریس با schema ناشناخته: ${matrix.schema}`);
  process.exit(2);
}
const ROOT = process.cwd();

function loadCartridge(p) {
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  const c = JSON.parse(readFileSync(abs, "utf-8"));
  const family = c.cartridgeId ?? /KH-[A-Za-z0-9_-]+/.exec(path.basename(p))?.[0];
  if (!family) throw new Error(`cartridgeId در ${p} یافت نشد`);
  const qb = c.questionBank;
  if (!Array.isArray(qb)) throw new Error(`questionBank آرایه نیست: ${p}`);
  return { family, questions: qb, source: p, generatedAt: c.generatedAt ?? null };
}

// ── compute ──────────────────────────────────────────────────────────────────
function coverage(fam, questions) {
  const spec = matrix.families[fam];
  if (!spec) return null;
  const out = {
    title: spec.title,
    minTotal: spec.minTotal,
    total: questions.length,
    totalConfirmed: 0,
    legacy: 0,
    legacyConfirmed: 0,
    domains: {},
    qTypeUnknown: 0,
    formats: {},
  };
  for (const [code, d] of Object.entries(spec.domains)) {
    out.domains[code] = { title: d.title, chapter: d.chapter, min: d.min, count: 0, confirmed: 0, qTypes: {} };
  }
  for (const q of questions) {
    const st = q.status === "تأییدشده";
    if (st) out.totalConfirmed++;
    const fmt = q.format ?? q.answerFormat ?? "—";
    out.formats[fmt] = (out.formats[fmt] ?? 0) + 1;
    const code = typeof q.domainCode === "string" ? q.domainCode.trim().toUpperCase() : null;
    if (code && out.domains[code]) {
      const d = out.domains[code];
      d.count++;
      if (st) d.confirmed++;
      const qt = typeof q.qType === "string" && q.qType.trim() ? q.qType.trim() : "بدون qType";
      if (qt === "بدون qType") out.qTypeUnknown++;
      d.qTypes[qt] = (d.qTypes[qt] ?? 0) + 1;
    } else {
      out.legacy++;
      if (st) out.legacyConfirmed++;
      if (code) out.__badCodes = out.__badCodes ?? {};
      if (code) out.__badCodes[code] = (out.__badCodes[code] ?? 0) + 1;
    }
  }
  out.domainsPass = Object.values(out.domains).every(d => d.count >= d.min);
  out.totalPass = out.total >= out.minTotal;
  out.pass = out.domainsPass && out.totalPass;
  return out;
}

const cartridges = cartridgePaths.map(loadCartridge);
const lines = [];
const gateFailures = [];

lines.push("# گزارش پوشش دامنه‌ای خشاب‌ها");
lines.push("");
lines.push("> 🟡 **DRAFT** — ماتریس مرجع هنوز مُهر گام صفر معلم را ندارد؛ این گزارش «اندازه‌گیری» است، نه «حکم آمادگی». طبق قانون: اعلام «پایه آماده» فقط در v1.0 با ماتریس کامل مُهرشده مجاز است.");
lines.push("");
lines.push(`- تاریخ: ${new Date().toISOString()}`);
lines.push(`- ماتریس: \`${matrixPath}\` (schema ${matrix.schema} — ${matrix.status.startsWith("DRAFT") ? "DRAFT" : "مُهرشده"})`);
lines.push("");

for (const { family, questions, source, generatedAt } of cartridges) {
  if (familyFilter && family !== familyFilter) continue;
  const cov = coverage(family, questions);
  if (!cov) {
    lines.push(`## ${family}`);
    lines.push("");
    lines.push(`⚠️ این خانواده در ماتریس مرجع تعریف نشده (اسکلت/خارج از قانون فعلی) — موجودی: ${questions.length} سؤال.`);
    lines.push("");
    continue;
  }
  const pct = (n, min) => `${Math.min(100, Math.round((n / Math.max(1, min)) * 100))}%`;
  lines.push(`## ${family} — ${cov.title}`);
  lines.push("");
  lines.push(`- منبع: \`${source}\`${generatedAt ? ` (تولید ${generatedAt})` : ""}`);
  lines.push(`- جمع سؤال‌ها: **${cov.total}** (حداقل قانون: ${cov.minTotal}) — ${cov.totalPass ? "✅" : "❌"} | تأییدشده: ${cov.totalConfirmed}`);
  lines.push(`- میراثی (بدون domainCode): **${cov.legacy}** — این سؤال‌ها در پوشش دامنه حساب نمی‌شوند.`);
  lines.push("");
  lines.push("| دامنه | عنوان | فصل | حداقل | موجود | تأییدشده | پوشش | گیت |");
  lines.push("|---|---|---|---:|---:|---:|---:|:-:|");
  for (const [code, d] of Object.entries(cov.domains)) {
    lines.push(`| ${code} | ${d.title} | ${d.chapter} | ${d.min} | ${d.count} | ${d.confirmed} | ${d.count >= d.min ? "—" : `+${d.min - d.count} کمبود`} | ${d.count >= d.min ? "✅" : "❌"} |`);
  }
  if (cov.legacy > 0) {
    lines.push(`| — | میراثی (بدون دامنه) | — | ۰ | ${cov.legacy} | ${cov.legacyConfirmed} | — | ⚪ |`);
  }
  lines.push("");
  // qType شکستگی — خانه‌به‌خانهٔ ماتریس
  lines.push("<details><summary>شکستگی نوع تمرین (عمق) — خانه‌به‌خانه</summary>");
  lines.push("");
  for (const [code, d] of Object.entries(cov.domains)) {
    const entries = Object.entries(d.qTypes);
    if (entries.length === 0) continue;
    lines.push(`- **${code} ${d.title}:** ${entries.map(([t, n]) => `${t} ×${n}`).join("، ")}`);
  }
  if (cov.legacy > 0) {
    lines.push(`- **میراثی:** قالب‌ها: ${Object.entries(cov.formats).map(([f, n]) => `${f} ×${n}`).join("، ")}`);
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");
  if (!cov.pass) {
    for (const [code, d] of Object.entries(cov.domains)) {
      if (d.count < d.min) gateFailures.push(`${family}/${code}: ${d.count}/${d.min}`);
    }
    if (!cov.totalPass) gateFailures.push(`${family}/کل: ${cov.total}/${cov.minTotal}`);
  }
}

lines.push("---");
lines.push("");
lines.push(`**حکم گیت پوشش:** ${gateFailures.length === 0 ? "🟢 همهٔ دامنه‌ها به حداقل رسیده‌اند (هنوز بدون مُهر معلم = آمادگی اعلام نمی‌شود)" : `🔴 ناکافی — ${gateFailures.join("؛ ")}`}`);
lines.push("");

const report = lines.join("\n");
console.log(report);
if (markdownOut) {
  const outPath = path.isAbsolute(markdownOut) ? markdownOut : path.join(ROOT, markdownOut);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, report, "utf-8");
  console.error(`OK: گزارش ذخیره شد -> ${outPath}`);
}
if (gateMode && gateFailures.length > 0) {
  console.error(`⛔ گیت پوشش قرمز — ${gateFailures.length} خانه زیر حداقل`);
  process.exit(1);
}
process.exit(0);
