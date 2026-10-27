// مولد سند ممیزی ناسازگاری «نقشهٔ گزینه→خطا» با موتور زنده — قابل اجرای مجدد
// مصرف: node tmp-scripts/build-mismatch-inventory.mjs [مسیر JSON خروجی API]
// خروجی: download/option-map-mismatch-inventory.md
// قاعده: این سند هیچ محتوایی را تغییر نمی‌دهد — فقط شواهد زندهٔ موتور در برابر ادعاهای نقشه را مستند می‌کند.

import { readFileSync, writeFileSync } from "fs";

const inPath = process.argv[2] ?? "/tmp/cartridge-after.json";
const d = JSON.parse(readFileSync(inPath, "utf8"));

/** قطعه‌بندی متن خام optionErrorMap با مرز «حرف→» (بدون شکستن پرانتزها روی «؛») */
function segmentMap(raw) {
  if (!raw) return {};
  const text = String(raw);
  const marks = [];
  const re = /([الفبجد])→/g;
  let m;
  while ((m = re.exec(text))) marks.push({ letter: m[1], start: m.index + m[0].length });
  const out = {};
  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    let seg = text.slice(marks[i].start, end).trim();
    const semi = seg.lastIndexOf("؛");
    if (semi > -1 && i + 1 < marks.length) seg = seg.slice(0, semi).trim();
    out[marks[i].letter] = seg;
  }
  return out;
}

const rows = [];
const counts = {};
for (const q of d.bank) {
  const seg = segmentMap(q.optionErrorMap);
  for (const v of q.verdicts) {
    const claimFull = seg[v.letter] ?? v.claim ?? "";
    let cls;
    if (v.engineCode) cls = claimFull.includes(v.engineCode) ? "match" : "contradiction";
    else if (v.value === null) cls = "nonnumeric";
    else if (claimFull) cls = "unwitnessed";
    else cls = "nopattern";
    counts[cls] = (counts[cls] ?? 0) + 1;
    rows.push({ id: q.id, anchorId: q.anchorId, letter: v.letter, value: v.value, engine: v.engineCode, claim: claimFull, cls });
  }
}

const fa = (n) => String(n).replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[x]);
const contradictions = rows.filter((r) => r.cls === "contradiction");
const naming = contradictions.filter((r) => {
  // شکاف نامی = توصیف فارسی نقشه همان عمل است ولی کد را ندارد (عمل‌جایگزین در تقسیم)
  return /به‌جای تقسیم/.test(r.claim) && r.engine === "E_OP_REVERSE";
});
const realContradictions = contradictions.filter((r) => !naming.includes(r));
const unwitnessed = rows.filter((r) => r.cls === "unwitnessed");
const nonnumeric = rows.filter((r) => r.cls === "nonnumeric");
const nopattern = rows.filter((r) => r.cls === "nopattern");

const proposals = {
  "Q-103|ب": "E_ZERO_PROPERTY (هم‌پوشانی هویت — اولویت موتور محفوظ)",
  "Q-109|ج": "E_SKIP_UNDERCOUNT (فرض رفتاری «جابه‌جایی» فقط در یادداشت بماند)",
  "Q-110|ب": "E_ADD_CONFUSION (فرض رفتاری «فکت‌آشوب» فقط در یادداشت بماند)",
  "Q-205|ج": "E_ZERO_PLACE_MISS (حذف صفرِ صدگان — مورد طلایی موتور v10.3)",
  "Q-201|د": "جمع به‌جای تقسیم (۱۲+۳؛ E_OP_REVERSE)",
  "Q-202|ج": "جمع به‌جای تقسیم (۱۸+۶؛ E_OP_REVERSE)",
  "Q-203|ج": "تفریق به‌جای تقسیم (۱۵−۳؛ E_OP_REVERSE)",
  "Q-203|د": "ضرب به‌جای تقسیم (۱۵×۳؛ E_OP_REVERSE)",
};
const key = (r) => `${r.id}|${r.letter}`;

const tr = (cells) => "| " + cells.join(" | ") + " |";

let md = `# ممیزی ناسازگاری «نقشهٔ گزینه→خطا» با موتور زنده — پیش‌نویس تصمیم v0.7.1

- منبع داده: خروجی زندهٔ \`GET /api/cartridge\` (خشاب منتشرشدهٔ KH-G3-MATH v0.7 + موتور واقعی errors.js/errors-v103.js)
- روش: هر ۶۰ گزینهٔ انحرافی (۲۰ سؤال × ۳) با موتور اجرا شد؛ ادعای نقشه با «قطعه‌بندی مرز حرف→» روی متن خام استخراج شد (پارس «؛»-محور پرانتزها را می‌شکند — محدودیت شناخته‌شدهٔ parseClaims)
- تاریخ داده: ${d.cartridge?.generatedAt ?? "—"} | این سند هیچ محتوایی را تغییر نمی‌دهد — فقط شواهد را مستند و تصمیم را آماده می‌کند

---

## خلاصهٔ شمارش (۶۰ گزینهٔ انحرافی)

| رده | شمارش | معنا |
|---|---|---|
| هم‌خوان | ${fa(counts.match)} | حکم موتور = ادعای نقشه (کد در متن ادعا حاضر) |
| ناسازگار مستند | ${fa(counts.contradiction)} | موتور کد دیگری می‌زند — ۴ تضاد واقعی + ۴ شکاف نامی |
| ادعای بی‌شاهد | ${fa(counts.unwitnessed)} | نقشه الگویی ادعا می‌کند که موتور پیاده‌اش نکرده (صادقانه بی‌الگو — خوراک S2/توسعهٔ موتور) |
| غیرعددی | ${fa(counts.nonnumeric)} | گزینهٔ متنی (Q-112) — خارج از نگاشت عددی |
| بی‌الگو | ${fa(counts.nopattern)} | نه حکم موتور نه ادعای نقشه |

---

## بخش ۱ — چهار تضاد واقعی (موتور مخالف ادعای نقشه)

${tr(["سؤال", "حرف", "مقدار", "حکم موتور", "ادعای نقشه", "پیشنهاد v0.7.1"])}
${tr([":---", ":-:", ":-:", "---", "---", "---"])}
${realContradictions.map((r) => tr([r.id, r.letter, fa(r.value ?? "—"), "`" + r.engine + "`", r.claim, proposals[key(r)] ?? "—"])).join("\n")}

## بخش ۲ — چهار شکاف نامی (توافق معنایی؛ کد در نقشه نوشته نشده)

نقشه «عمل جایگزین در تقسیم» را توصیف می‌کند و موتور همان را با کد E_OP_REVERSE برچسب می‌زند — فقط کد در متن ادعا حاضر نیست:

${tr(["سؤال", "حرف", "مقدار", "حکم موتور", "ادعای نقشه", "پیشنهاد v0.7.1"])}
${tr([":---", ":-:", ":-:", "---", "---", "---"])}
${naming.map((r) => tr([r.id, r.letter, fa(r.value ?? "—"), "`" + r.engine + "`", r.claim, proposals[key(r)] ?? "—"])).join("\n")}

## بخش ۳ — پیش‌نویس v0.7.1 (فقط پیشنهاد — اعمال نشده)

> قاعدهٔ ایستاده: تغییر ستون «نقشهٔ گزینه→خطا» = تغییر محتوا → فقط با تأیید مالک، از مسیر اکسل (v0.7.1) + مبدل + گیت «صفر قرمز» — هرگز با دست‌کاری JSON منتشرشده. پیش از اعمال، این ۸ ردیف باید به فرم جلسهٔ پایلوت (برگهٔ انسانی الف) الصاق شود تا شاهد واقعی کلاس هم ثبت شود.

${tr(["#", "سؤال", "از (وضع فعلی)", "به (پیشنهاد)"])}
${tr([":-:", ":-:", "---", "---"])}
${[...realContradictions, ...naming].map((r, i) => tr([fa(i + 1), r.id + " " + r.letter, r.claim.slice(0, 60), proposals[key(r)] ?? "—"])).join("\n")}

## بخش ۴ — ${fa(unwitnessed.length)} ادعای بی‌شاهد (نقشهٔ راه توسعهٔ موتور / تصمیم S2)

ادعاهایی که موتور پیاده‌شان نکرده — هیچ‌کدام «خطا» نیستند؛ خشاب صادقانه ادعا را نوشته و داشبورد حکم موتور را جدا نشان می‌دهد:

${tr(["سؤال", "حرف", "مقدار", "ادعای نقشه (بی‌شاهد)"])}
${tr([":---", ":-:", ":-:", "---"])}
${unwitnessed.map((r) => tr([r.id, r.letter, r.value === null ? "—" : fa(r.value), r.claim.slice(0, 70)])).join("\n")}

## بخش ۵ — یادداشت فنی: شاخهٔ چهارم تفسیر (چهاررقمی کلامی)

- تغییر امروز (فقط لایهٔ تفسیر داشبورد — موتور Pure دست‌نخورده): گزینه‌های کلامی سؤال‌های «خواندن/نوشتن» چهاررقمی با تحلیل‌گر کلامی سخت‌گیر (تا ۹۹۹۹؛ توکن ناشناخته → null) به موتور می‌رسند: \`classifyV103({op:'read', a:هدف}, submitted)\`.
- اثر: Q-205 ج (۴۷۰) حالا \`E_ZERO_PLACE_MISS\` می‌گیرد (مورد طلایی خانوادهٔ ۳)؛ الف (۴۰۰۷) و د (۴۷۰۰) صادقانه بی‌الگو (موتور چنین الگویی ندارد)؛ شمار «غیرعددی» کل بانک ۶→۳ (۳ باقی‌مانده: Q-112).
- پیش از این تغییر: هر ۴ گزینهٔ Q-205 «غیرعددی» بودند و جلسهٔ پایلوت برای خانوادهٔ ۳ هیچ برچسب زنده‌ای نداشت.
- سوابق قبل از تغییر (پایهٔ مقایسه): فایل /tmp/cartridge-before.json — بانک جز Q-205 بایت‌به‌بایت بدون تغییر.

## پیوست — جدول کامل ۶۰ گزینهٔ انحرافی

${tr(["سؤال", "حرف", "مقدار", "حکم موتور", "ادعای نقشه (قطعه‌بندی‌شده)", "رده"])}
${tr([":---", ":-:", ":-:", "---", "---", "---"])}
${rows.map((r) => tr([r.id, r.letter, r.value === null ? "کلامی" : fa(r.value), r.engine ? "`" + r.engine + "`" : "—", (r.claim || "—").slice(0, 60), { match: "هم‌خوان", contradiction: "ناسازگار مستند", unwitnessed: "ادعای بی‌شاهد", nonnumeric: "غیرعددی", nopattern: "بی‌الگو" }[r.cls]])).join("\n")}
`;

writeFileSync("download/option-map-mismatch-inventory.md", md, "utf8");
console.log("WRITTEN download/option-map-mismatch-inventory.md —", md.split("\n").length, "lines");
console.log("COUNTS:", JSON.stringify(counts), "| real:", realContradictions.length, "| naming:", naming.length);
