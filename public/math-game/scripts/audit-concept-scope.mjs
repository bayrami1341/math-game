#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// اجرای بازرس مستقل مفهومی روی محتوای واقعی — فرمان مالک:
// «هر صفحه و سؤال را با پروفایل نسخه‌دار ... مقایسه کنید»
//
// ورودی: کارتریج‌های رسمی (KH-G2/KH-G3) + page-map‌های رسمی (هر صفحه)
// خروجی: reports/concept-scope-audit-v1.fa.md + .json
// قانون خروج: CRITICAL_DRIFT در محتوای دامنه‌دار → exit 1 (عامل توقف)
//              UNKNOWN/REVIEW → گزارش و ارجاع به انسان، توقف‌زا نیست
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { auditContent, INSPECTOR_VERSION } from '../src/v10/concept-scope.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..'); // public/math-game
const repoRoot = path.resolve(pkgRoot, '../..'); // ریشهٔ مخزن

const PROFILE = JSON.parse(
  readFileSync(path.join(repoRoot, 'authoring/CONCEPT-PROFILE.json'), 'utf8')
);
const MATRIX_SHA = createHash('sha256')
  .update(readFileSync(path.join(repoRoot, 'public/math-game/authoring/DOMAIN-MATRIX.json')))
  .digest('hex');

const faNum = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

const results = {};
let exitCritical = 0;

// ─── ۱) سؤال‌ها: کارتریج‌های رسمی ───
for (const fam of ['KH-G3-MATH', 'KH-G2-MATH']) {
  const cart = JSON.parse(
    readFileSync(path.join(pkgRoot, `cartridges/${fam}.json`), 'utf8')
  );
  const audit = auditContent(cart.questionBank, PROFILE, fam);
  results[fam] = {
    cartridge: cart.cartridgeId,
    generatedAt: cart.generatedAt,
    ...audit.summary,
    blocked: audit.blocked,
    critical: audit.criticalItems.map((c) => ({
      id: c.id,
      domainCode: c.domainCode,
      qType: c.qType,
      reason: c.reasons,
    })),
    review: audit.reviewItems.map((r) => ({
      id: r.id,
      reason: r.reasons[0],
    })),
  };
  if (audit.blocked) exitCritical = 1;
}

// ─── ۲) صفحه‌ها: page-map رسمی — هر صفحه با پروفایل ───
for (const fam of ['KH-G3-MATH', 'KH-G2-MATH']) {
  const short = fam === 'KH-G3-MATH' ? 'G3' : 'G2';
  const pm = JSON.parse(
    readFileSync(path.join(repoRoot, `authoring/PAGE-MAP-KH-${short}-MATH-v1.json`), 'utf8')
  );
  const pages = (pm.pages || []).filter((p) => {
    // صفحات غیرمحتوایی (جلد/شناسنامه/فهرست) بخشی از حکم مفهومی نیستند
    return !(p.kind === 'پیش‌صفحه' || p.pageType === 'غیره') || p.chapter;
  });
  // صفحه: kind='صفحهٔ محتوایی' → با سیگنال‌های دامنهٔ فصل مقایسه می‌شود
  const items = pages.map((p) => ({
    id: `pg-${p.pdfPage}`,
    kind: 'صفحهٔ محتوایی',
    domainCode: p.domainCode ?? null,
    qType: null,
    title: p.section || null,
    prompt: [
      p.title || '',
      ...(p.elements || []).map((e) => `${e.title ?? ''} ${e.detail ?? ''}`),
    ].join(' ').slice(0, 2000),
    chapter: p.chapter,
  }));
  // صفحات بدون domainCode → برچسب دامنهٔ صفحه کار تولید صفحه‌نقشه است؛ REVIEW نه حدس
  const audit = auditContent(items, PROFILE, fam);
  results[`${fam}-PAGES`] = {
    mapId: pm.mapId,
    totalPdfPages: pm.totalPdfPages,
    auditedContentPages: items.length,
    skippedNonContent: (pm.pages || []).length - items.length,
    ...audit.summary,
    blocked: audit.blocked,
    critical: audit.criticalItems.map((c) => ({ id: c.id, reason: c.reasons })),
    reviewCount: audit.reviewItems.length,
  };
  if (audit.blocked) exitCritical = 1;
}

// ─── گزارش مارک‌داون فارسی ───
const now = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  dateStyle: 'full',
  timeStyle: 'short',
}).format(new Date());

let md = `# گزارش بازرس مستقل محدودهٔ مفهومی — v1

- **بازرس:** \`${INSPECTOR_VERSION}\` (قاعده‌محور، بدون LLM، بدون import از موتور تولید)
- **پروفایل:** khshab.concept-profile/v${PROFILE.version} — pin ماتریس: \`${MATRIX_SHA.slice(0, 10)}…\`
- **زمان اجرا:** ${now}
- **قاعدهٔ حکم:** انحراف هدف اصلی = CRITICAL_DRIFT (بحرانی/توقف‌زا) · پیش‌نیاز و اشارهٔ فرعی جدا طبقه‌بندی · ابهام = UNKNOWN_REVIEW (بدون حدس) · ظاهری هم‌وزن مفهومی نیست

`;

for (const [key, r] of Object.entries(results)) {
  md += `## ${key}\n\n`;
  md += `| حکم | تعداد |\n|---|---|\n`;
  md += `| IN_SCOPE (مثبت) | ${faNum(r.IN_SCOPE)} |\n`;
  md += `| PREREQ_ONLY (پیش‌نیاز — جدا) | ${faNum(r.PREREQ_ONLY)} |\n`;
  md += `| UNKNOWN_REVIEW (بدون حدس) | ${faNum(r.UNKNOWN_REVIEW)} |\n`;
  md += `| CRITICAL_DRIFT (بحرانی/توقف‌زا) | ${faNum(r.CRITICAL_DRIFT)} |\n`;
  md += `| جمع کل | ${faNum(r.total)} |\n\n`;
  if (r.critical?.length) {
    md += `**موارد بحرانی (عامل توقف):**\n\n`;
    for (const c of r.critical) {
      md += `- \`${c.id}\` (${c.domainCode ?? '—'}): ${c.reason?.[0] ?? ''}\n`;
    }
    md += '\n';
  }
  if (r.review && Array.isArray(r.review)) {
    const groups = {};
    for (const it of r.review) {
      const g = it.reason.split(':')[0];
      groups[g] = (groups[g] || 0) + 1;
    }
    md += `**تفکیک REVIEW (ارجاع به انسان):** ${Object.entries(groups).map(([g, n]) => `${g}=${faNum(n)}`).join(' · ')}\n\n`;
  } else if (r.reviewCount !== undefined) {
    md += `**REVIEW:** ${faNum(r.reviewCount)} صفحه بدون برچسب دامنه — نیازمند برچسب‌گذاری انسانی (حدس نشد)\n\n`;
  }
}

md += `## حکم نهایی\n\n`;
const anyBlocked = Object.values(results).some((r) => r.blocked);
md += anyBlocked
  ? `- **توقف (BLOCKED):** دست‌کم یک انحراف مفهومی بحرانی یافت شد — انتشار محتوا تا رفع مجاز نیست.\n`
  : `- **بدون انحراف بحرانی:** هیچ سؤال یا صفحه‌ای انحراف هدف اصلی بحرانی ندارد.\n`;
const g3 = results['KH-G3-MATH'], g2 = results['KH-G2-MATH'];
md += `- سؤال‌های میراثی فاقد domainCode (${faNum(g3.UNKNOWN_REVIEW + g2.UNKNOWN_REVIEW)} سؤال در دو کارتریج) و صفحه‌های بدون برچسب دامنه (${faNum((results['KH-G3-MATH-PAGES']?.UNKNOWN_REVIEW ?? 0) + (results['KH-G2-MATH-PAGES']?.UNKNOWN_REVIEW ?? 0))} صفحه) حکم دامنه‌ای نگرفتند — برچسب‌گذاری کار خط تولید/انسان است، حدس نشد.\n`;
md += `- این گزارش به‌تنهایی پذیرش نیست؛ پذیرش پس از آزمون مصرف‌کننده و مُهر مالک/معلم ثبت می‌شود.\n`;

mkdirSync(path.join(repoRoot, 'reports'), { recursive: true });
writeFileSync(path.join(repoRoot, 'reports/concept-scope-audit-v1.fa.md'), md, 'utf8');
writeFileSync(
  path.join(repoRoot, 'reports/concept-scope-audit-v1.json'),
  JSON.stringify({ schema: 'khshab.concept-scope-audit/v1', profileVersion: PROFILE.version, matrixPin: MATRIX_SHA, inspector: INSPECTOR_VERSION, generatedAtTehran: now, results }, null, 2),
  'utf8'
);

console.log(md);
process.exit(exitCritical);
