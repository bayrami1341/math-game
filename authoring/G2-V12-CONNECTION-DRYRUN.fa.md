# گزارش dry-run اتصالِ `آشیل v2.4` به نامزدِ `KH-G2-MATH v1.2`

- **تاریخِ اجرا (UTC):** `2026-10-22`
- **چیدمانِ مخزن:** شاخهٔ محتواییِ آرنا `arena/0eb22280-math-game` (مخزن `bayrami1341/math-game`)
- **مرجعِ رسمیِ فقط‌خواندنی:** `origin/v10.3-beta` @ `24e61dd` (سرِ پیشین `0849aae`)، mount شده در `/tmp/v103_ref`
  (شامل `tools/cartridge-converter/convert.mjs` و `public/math-game/authoring/OFFICIAL-HEADS.json`)
- **سرِ رسمیِ اعلام‌شدهٔ G2:** `v0.5` با SHA-256 `f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656`
  و یادداشتِ `«۴۸ سؤال و ۵۴ ردیف صفحه‌ای «پیشنهاد» در انتظار مُهر معلم»`
- **نامزدِ مرجعِ مقایسه (اعلامیِ بازبین):** `v1.2` با SHA-256 `18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618`
  → **در این محیط حاضر نیست**؛ بنابراین هیچ مقایسهٔ بایتی/کلیدی با آن انجام نشده و ادعا نمی‌شود.

> هیچ `--git-push` خودکار، رأیِ معلم، تغییرِ سرِ رسمی یا اعلامِ «نهایی‌بودن» در این اجرا انجام نشده است.

---

## ۱) موجِ افزایشیِ تازهٔ G2 (`wave_spec_G2_v12_incremental.json`)

| فیلد | مقدار |
| --- | --- |
| `wave_id` | `wave-g2-v12-plumbing-dryrun` |
| `family_id` / `book_code` | `KH-G2-MATH` / `C205` |
| `base_cartridge_filename` | `khshab-G2-MATH_v0.5.xlsx` |
| `expected_official_base_sha256` | `f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656` |
| `verified_pagemap_sha256` | `7310680cfe62f4cad8e4222de6f3d32edc2c54bb24a9f586a610ef7e2ac192b8` |
| ردیف‌های S1 افزوده | `2` (`L-900`, `L-901`) — صفحه `؟`، وضعیت `نیاز به تأیید` |
| سؤال/کد خطای افزوده | `0` / `0` (عمداً: هیچ محتوای ساختگیِ بدون شاهد وارد نشد) |
| `authorized_patches` | `[]` (هیچ سلولِ رسمی هدفِ تغییر نیست) |

این نمونه **فقط لوله‌کشیِ اتصال** را می‌آزماید: قفلِ سرِ رسمی، یکتاییِ شناسه‌ها،
عدمِ جابه‌جاییِ ردیفِ رسمی، گزارشِ پوششِ شاهد و مرزِ مجوزها. هیچ هدفِ آموزشی،
صفحه، شکل یا سؤالی از کتاب ادعا نشده است.

---

## ۲) سناریوی A — محیطِ ایزولهٔ هرمتیک (بدون یادداشتِ مُهر معلم)

ریشهٔ رسمیِ ساختگی در `tmp_path` با همان چیدمانِ `v10.3-beta`
(`public/math-game/authoring/OFFICIAL-HEADS.json` + خشاب‌های رسمی با SHAهایِ واقعی)،
به‌همراهِ mount فقط‌خواندنیِ مبدلِ واقعیِ `Z.ai`.

| گیت | نتیجه |
| --- | --- |
| `G3_WAVE_EXPORT` | `PASS` / `WAVE_EXPORT_CLEAN` |
| SHA-256 خروجی | `6afd3a5741712df9ed4c60a90dc356c9742dccd47093d33bf41a90bb89a94086` |
| دیفِ کلیدمحور | `added_row_count=2`، `removed_row_count=0`، `changed_cell_count=0` |
| `G6_WORKBOOK_STRUCTURE` | `PASS` |
| `G3_ANTI_J12` | `PASS` |
| `G4_INDEPENDENT_SOLVER` | `PASS` |
| `G5_DISTRACTOR_CAUSALITY` | `PASS` |
| `U-01..U-10` | `PASS` / `ALL_UNIVERSAL_INVARIANTS_CLEAN` |
| آشیل (گیتِ هلوسه) | `PASS` / `ACHILLES_EVIDENCE_VERIFIED` |
| **پوششِ شاهد (گیتِ جدید)** | `WARN` / `COVERAGE_INCOMPLETE_YELLOW_REMAINS` |
| مبدلِ رسمیِ `Z.ai` | `PASS` — قرمز `0`، زرد `2`، حکمِ «مجاز — JSON منتشر شد» |
| دورهایِ خودترمیمی | `0` |
| وضعیتِ کلیِ ناظر | `PASS` **فنی** (`technical_pass_only=true`) |
| رأیِ معلم | `teacher_verdict_required=true` — ثبت نشده |
| اجازهٔ انتشار | `NOT_GRANTED` |

### شمارِ روشنِ پوششِ شاهد (هم روی پایهٔ رسمی `v0.5` و هم روی نامزدِ dry-run)

| سنجه | پایهٔ `v0.5` | نامزدِ dry-run |
| --- | --- | --- |
| کلِ ردیف‌های S1 | `62` | `64` |
| ردیفِ سبز | `8` | `8` (هیچ سبزِ تازه‌ای اضافه نشد) |
| ردیفِ زرد | `54` | `56` |
| **دارای شاهد** | **`51`** | **`51`** |
| **فاقد شاهد** | **`3`** | **`3`** |
| ناسازگاریِ منبع/صفحه | `0` | `0` |
| نسبتِ پوشش | `0.9444` | `0.9444` |
| ردیف‌های فاقد شاهد | `L-101`, `L-201`, `L-401` | همان سه ردیف |
| آفستِ اثبات‌شده | `+6` | `+6` |
| اندازهٔ دفترِ شاهد | `162` | `162` |
| SHA منبعِ PDF | `a93934b6c418d4c6efe5ebb109bbcfe4f5fb6024fa1f3b1b309a4ff6da2746de` | همان |
| چاپِ manifest | `چاپ چهاردهم ۱۴۰۴` | همان |

**این اعداد فقط پوششِ شاهد را می‌سنجند.** نه «متن و تصویرِ همهٔ صفحه‌ها بررسی شده است»
و نه «پرونده آمادهٔ انتشار است»؛ سه ردیفِ فاقد شاهد **زرد می‌مانند** و هیچ مسیرِ
خودکاری آن‌ها را سبز نمی‌کند.

---

## ۳) سناریوی B — ریشهٔ رسمیِ واقعی (`/tmp/v103_ref` @ `24e61dd`)

| مورد | نتیجه |
| --- | --- |
| وضعیتِ ناظر | `HELD_AWAITING_HEAD` |
| دلیل | `HELD_AWAITING_TEACHER_STAMP_AND_WAVE_AUTHORIZATION` |
| پایهٔ فعلی | `public/math-game/authoring/khshab-G2-MATH_v0.5.xlsx` |
| خشابِ ساخته‌شده | **هیچ** (موج نگه داشته شد) |

این همان قانونِ `Wave 5 Hold` است: چون `OFFICIAL-HEADS.json` برای `KH-G2-MATH`
یادداشتِ «در انتظار مُهر معلم» دارد، هر موجِ نیازمندِ پایهٔ `≥ v0.5` نگه داشته می‌شود
و `PASS` شمرده نمی‌شود. **این گیتِ توقف حذف یا سست نشده است.**

---

## ۴) آزمونِ ردِ مبنای کهنه (مستقل و هرمتیک)

| سناریو | انتظار | نتیجه |
| --- | --- | --- |
| نمونهٔ `wave_spec_G2_ch4_v05.json` (پایهٔ `v0.4` = `a2f6105…`) با سرِ اعلامیِ `v0.5` | توقف | `FAIL` / `STALE_OFFICIAL_BASE_INCIDENT_07`، SHA خروجی تهی، **هیچ فایلی ساخته نشد** |
| همان نمونه با سرِ اعلامیِ `v0.4` (کنترل) | ساخت | `PASS` و بازتولیدِ بایت‌به‌بایتِ `f1f339a09a8c…` |

یعنی گیت بر پایهٔ **سرِ اعلامیِ رسمی** تصمیم می‌گیرد، نه یک FAIL همیشه‌گی — هم
بازیابیِ صف واقعاً آزموده شد و هم ردِ مبنای کهنه آزمونِ مستقل دارد.

---

## ۵) نتیجهٔ آزمون‌ها (دقیق)

- چیدمان: `arena/0eb22280-math-game` (محتواییِ آرنا) + مرجعِ فقط‌خواندنیِ `v10.3-beta` @ `24e61dd`
- فرمان: `python -m pytest -q`
- نتیجه: **`69 passed, 4 skipped`** (۷۳ مورد جمع‌آوری‌شده) — پیش از افزودنِ بستهٔ دسترسیِ مدلِ مادر؛
  شمارِ نهاییِ پس از آن در `authoring/MOTHER-AI-HANDOFF-v24.fa.md` §۳ ثبت شده است
- `4 skipped` دقیقاً: نبودِ `C205.pdf` و `C305.pdf` محرمانه در این محیط (۲ مورد) و
  نبودِ مبدلِ رسمیِ SSOT در شاخهٔ محتواییِ آرنا (۲ مورد) — هر چهار مورد صریح و
  مطابقِ §9، نه سکوتِ مبهم.
- آزمون‌های کلیدیِ این چرخه:
  - ردِ مبنای کهنه: `test_stale_official_base_is_rejected_and_gate_is_precise` → `PASS`
  - بازیابیِ صف/سقوط: `test_persistent_queue_and_crash_recovery` → `PASS`
  - ناسازگاریِ PDF/manifest/کد کتاب/آفست: `test_binding_requires_real_pdf_sha_book_code_and_same_print`
    و `test_coverage_gate_fails_closed_on_source_and_offset_mismatch` → `PASS`
  - نبودِ شاهد: `test_hallucination_pass_without_ledger_is_neither_coverage_nor_release`
    و `test_green_row_without_evidence_fails_coverage_gate` → `PASS`
  - نبودِ احراز هویت: `test_viewer_rejects_unauthenticated_when_no_token_configured`،
    `test_record_verdict_cli_rejects_role_claim_without_server_token`،
    `test_approval_scope_verdict_cannot_be_minted_by_caller_string` → `PASS`
  - هم‌ترازیِ راهنما با CLI (اجرای واقعیِ فرمان‌ها):
    `test_every_documented_command_parses_against_real_cli` و
    `test_documented_commands_are_actually_executable` → `PASS`

---

## ۶) موانعِ باقی‌مانده تا «پروندهٔ آمادهٔ تصمیمِ مالک»

1. **نامزدِ واقعیِ `v1.2` (`18e6b4fa…`) در این محیط نیست** → مقایسهٔ کلیدمحور/بایتیِ
   خروجیِ dry-run با آن انجام نشده. باید خارج از Git در قرنطینه mount شود.
2. **پوششِ شاهد کامل نیست:** `L-101`، `L-201`، `L-401` شاهدِ کراپ ندارند. تا ثبتِ
   `EV-CROP + bbox_normalized + pdf_page + SHA` (نیازمندِ `C205.pdf` در قرنطینه)
   این ردیف‌ها زرد می‌مانند.
3. **مُهر معلم و `Wave 5 Hold`:** تا اعلامِ رسمیِ `Z.ai` و حکمِ احرازشدهٔ معلم،
   هیچ موجِ G2 با پایهٔ `≥ v0.5` روی ریشهٔ رسمیِ واقعی ساخته نمی‌شود.
4. **هیچ رأیِ معلم و هیچ اجازهٔ انتشاری ثبت نشده است**؛ `G7` همچنان
   `releasable=false` است و `--approve-once` فقط `TECHNICAL_EXECUTION_ONLY` است.
5. **اتصالِ `C305` هنوز `fail-closed` است:** فقط `book_manifest_C205.json` و
   `observation_C205.json` وجود دارد؛ برای پایهٔ سوم به manifest/observationِ همان چاپ
   نیاز است (هر جفتِ ناسازگار با `EXPECTED_BOOK_CODE_MISMATCH` رد می‌شود).
6. **`PR #2` در وضعیتِ `CONFLICTING/DIRTY`** است (تاریخچه‌های نامرتبط
   `ab15597` و `697a452/0849aae`)؛ طبق §9 آرنا حقِ ادغامِ `v10.3-beta` در
   `arena/**` را ندارد و حلِ آن با `Z.ai` است (squash/rebase).
7. **`W7` (خطِ CI) و `W8` (پورتِ `errors.js`)** همچنان در مالکیتِ `Z.ai` است و
   دست‌نخورده باقی مانده.

---

## ۷) دستورهایِ اجراییِ این گزارش (همه راستی‌آزمایی‌شده)

```bash
python3 -m authoring.agent.cli build-wave \
  --wave-spec authoring/agent/fixtures/wave_spec_G2_v12_incremental.json \
  --output /tmp/khshab_quarantine/KH-G2-MATH_v1.2_dryrun.xlsx \
  --registry /tmp/khshab_quarantine/id_registry_v12.json

python3 -m authoring.agent.cli coverage \
  --cartridge authoring/khshab-G2-MATH_v0.5.xlsx \
  --observation authoring/agent/fixtures/observation_C205.json \
  --book-manifest authoring/agent/fixtures/book_manifest_C205.json \
  --pagemap authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx \
  --expected-book-code C205

python3 -m authoring.agent.cli check-wave \
  --candidate /tmp/khshab_quarantine/KH-G2-MATH_v1.2_dryrun.xlsx \
  --base authoring/khshab-G2-MATH_v0.5.xlsx \
  --official authoring/khshab-G2-MATH_v0.5.xlsx

python3 -m pytest -q
```

راهنمای کاملِ هم‌تراز با CLI: `authoring/USAGE-KHSHAB-AGENT-v24.fa.md`.
