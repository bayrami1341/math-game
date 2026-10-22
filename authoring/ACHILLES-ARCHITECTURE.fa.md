# آشیل — معماری و مرزهای خوانشِ شاهد‌محور

**تاریخ:** ۱۴۰۴/۰۸/۰۱ — شاخهٔ `arena/0eb22280-math-game` (`171a912` → `HEAD`)

---

## ۱. «آشیل» نامِ کیست؟

- **آشیل = خودِ `khshab-agent`** در حالتِ سخت‌گیرِ شاهد‌محور (`--strict-evidence` پیش‌فرض از `v2.2`).  
  ربات خوانشِ جداگانه‌ای وجود ندارد؛ همان ایجنتِ خطِ محتوا (`authoring/agent/`) است که خروجی‌اش به صادرکنندهٔ موج (`wave_exporter`) خوراک می‌دهد.
- **زیرسامانهٔ خوانش = «چشمِ آشیل»** (`authoring/agent/observation.py` + `reconcile.py` + `achilles_gate.py`):
  - `observation.py` — مشاهده‌گرِ عمومیِ PDF (پارامتری برای هر چاپ `C105/C205/.../C605`) با `pymupdf` (متن/span/تصویر/path) + تشخیصِ کپسولِ برداریِ بالای صفحه + کراپِ `300 DPI / NEAREST` در قرنطینهٔ `/tmp`.
  - `reconcile.py` — آداپتورِ دو خوانندهٔ مستقلِ قرنطینه + آشتی‌دهیِ اتمیِ سطحِ فیلد.
  - `achilles_gate.py` — دروازهٔ پاشنهٔ آشیل (`G_ACHILLES_EVIDENCE`, `P2`, fail-closed).

> **توافقِ دو خواننده بدونِ شاهد، تأییدِ صفحه نیست.** هرگز `EVIDENCE_MATCHED` نمی‌شود؛ فقط `AGREED_UNVERIFIED` می‌ماند.

---

## ۲. خروجیِ موردِ نیاز برای هر چاپ (قراردادِ تحویلِ شاهد)

برای هر `book_code` (مثلاً `C205`, `C305`) در `authoring/audit/observation_{book_code}.json`:

- **فهرستِ کاملِ صفحات:** `quality_scores[]` — هر عنصر `pdf_page`, `expected_book_page`, `extracted_footer_book_page`, `footer_alignment_status`, `text_char_count`, `image_count`, `drawing_path_count`, `quality_score`, `hazards`.
- **ادعاهایِ متصل به شاهد:** `claims[]` — هر ادعا `claim_id`, `pdf_page`, `field_name`, `raw_reading`, `normalized_value`, `evidence_refs[]` (ارجاعِ صریح به `evidence_ledger`).
- **SHA منبع:** `source_pdf_sha256` (هدرِ کتاب) + `source_sha256` در هر `EvidenceRef`.
- **جایگاهِ هر ناحیه:** `golden_and_curated_regions[]` / `evidence_ledger[].bbox_normalized` (مختصاتِ نرمالِ `[x0,y0,x1,y1]` در `[0,1]`).
- **فهرستِ صریحِ مواردِ ناخوانا:** صفحاتی که `recommended_action ∈ {CROP_VERIFICATION_REQUIRED, HUMAN_BOOK_PHOTO_REQUIRED}` یا `hazards` حاوی `SPARSE_TEXT_LAYER`, `VECTOR_OUTLINE_BANNER_NEEDS_VISION`, `MIXED_ENCODING` باشد؛ در عمل:
  ```json
  "unreadable_pages": [3, 27, 55]   // از quality_scores فیلتر می‌شود
  ```
  (در نسخهٔ فعلی این لیست از `quality_scores` قابلِ اشتقاق است؛ از `v2.3` به‌صورتِ کلیدِ صریح در `observation` صادر می‌شود.)

- **شاهدِ کراپ:** `evidence_ledger` — هر `evidence_id` شامل `evidence_kind ∈ {pdf_text_bbox, pdf_crop_150dpi, pdf_crop_300dpi_nearest, physical_book_photo}`, `bbox_normalized`, `crop_sha256` (برایِ کراپ)، `source_sha256`, `pdf_page`.

نمونهٔ ارجاعِ S1:
```
L-401 | page ۵۵ → PDF 61 | note: "مشاهدهٔ مستقیم C205.pdf ص چاپی 55 / PDF 61 …" + EV-CROP150-P061-01
→ ledger[EV-CROP150-P061-01] = {pdf_page:61, bbox:[0.06,0.05,0.94,0.94], crop_sha256:fc13..., source_sha256:a939...}
```

---

## ۳. تضمینِ ضدِ هلوسه

- `achilles_gate.verify_achilles_evidence_gate` — برایِ هر `L-*` (و به‌تبع `Q-*`) با `page` معیّن و `source` حاوی `پیشنهاد AI / موتور تألیف` که `status=تأییدشده` باشد:
  - باید `note` حاوی `شاهد/EV-/PDF/کراپ/عکس` باشد؛
  - `pdf = book + proven_offset` باید در `evidence_ledger` شاهدِ قوی داشته باشد؛
  - `PDF` ذکرشده در `note` باید دقیقاً با `proven_offset` بخواند، وگرنه `PAGE_OFFSET_MISMATCH_HALLUCINATION`.
- در غیرِ این‌صورت **BLOCKED** و هرگز `releasable = True` نمی‌شود. سبزهایِ رسمی (`سند پداگوژیک`) و اسکلت‌های `L-100..L-800` مستثنی‌اند (وابسته به `PAGE-MAP`).

---

## ۴. هویتِ معلم و `--approve-once`

- **Viewer:** `POST /api/verdict` فقط با هدرِ `X-Teacher-Token` که در سمتِ سرور با مقدارِ موردِ انتظار (`KHSHAB_TEACHER_TOKEN` env یا `authoring/audit/teacher_token.txt`) مقایسه می‌شود، می‌پذیرد؛ `actor_role` ادعاییِ کلاینت نادیده گرفته می‌شود و همیشه `human_teacher`ِ احراز‌شده ثبت می‌شود.
- **`--approve-once`:** به‌تنهایی «بلهٔ مالک» نیست. `AutopilotStateStore` هنگامِ `approved_once=True` SHA-256 فایلِ `authoring/ROADMAP-KHSHAB-AGENT-v2.fa.md` را به‌عنوانِ `approval_proof` ذخیره می‌کند و دامنهٔ مجازِ خانواده‌ها (`KH-G*-MATH`) را از همان نقشه استخراج می‌کند؛ هر موج خارج از دامنه `HELD` می‌ماند.

---

## ۵. HELD و مبدل

- موجِ `HELD` (انتظارِ `OFFICIAL-HEADS.json` یا خارج از دامنه) هرگز در `overall_status = PASS` شمرده نمی‌شود (`PASS` فقط وقتی `blocked==0 && held==0`).
- نبودِ مبدلِ رسمیِ `Z.ai` (`public/math-game/tools/cartridge-converter/convert.mjs`) گیتِ تحویل را سبز نمی‌کند؛ `run_converter_and_parse_report` در صورتِ نبودِ مبدل `BLOCKED_CONVERTER_MISSING` برمی‌گرداند و `all_green = false`.

---

## ۶. بازسازیِ بیت‌به‌بیتِ v0.5

- **قرارداد:** بایت‌به‌بایت برابری فقط با `openpyxl==3.1.5` + `save_workbook_deterministically` (کانُنِ `ZIP` + `FIXED_ZIP_DT=1980-01-01` + مرتب‌سازیِ `mergeCells` + حذفِ `xr:uid`) تضمین می‌شود.
- **علتِ ۱۳/۱۴ در بازرسیِ دومِ `39ab27e`:** رفرشِ `excel_exporter.py` در همان کامیت بدونِ پینِ نسخه، در سندباکسِ بازرس `openpyxl` متفاوتی (احتمالاً `3.1.2`) خروجیِ `f3140306…` داد در برابرِ رسمیِ `f1f339a0…` که با `3.1.5` ساخته شده بود. محتوا از نظرِ سلول/شناسه/مُهر ۱۴/۱۴ یکسان بود (کلید-محور `diff_workbooks_by_key` → `0` خارج از لیستِ سفید).
- **راهِ حلِ v2.2:** پینِ نسخه در `pyproject.toml` (`openpyxl==3.1.5`) + تستِ معناییِ `T7`/`S_K ↔ Q_B` + حفظِ `test_w1_g2_wave_spec_produces_bit_for_bit_identical_sha256` بدونِ تضعیف (در صورتِ اختلافِ بایتی، تست `keyed_diff` صفر و `stamps_gate` سالم را هم گزارش می‌کند و علتِ نسخه را صریح می‌کند).

پس از این مرزها، پایلوتِ کور `شاهد صفحه → مهارت → سؤال و مداخله → خشاب` تحویل می‌شود؛ قبولیِ خوانشِ آشیل هرگز سؤالِ تازه را خودکار سبز یا منتشر نمی‌کند. «کارِ شبانه» نیز به‌جایِ یک `batch`، صفِ ماندگارِ `autopilot_state.json` + `autopilot_events.jsonl` + بازیابیِ پس از سقوط (تستِ `test_autopilot_crash_recovery_persistent_queue`) است.
