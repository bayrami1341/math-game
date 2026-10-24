# گزارشِ جامعِ تغییرات، اصلاحات و تحلیلِ آن‌ها — برای «مدلِ مادر» (موتورِ اصلیِ `Z.ai`)

- **نویسنده:** آرنا (`khshab-agent v2.4`، شاخهٔ `arena/0eb22280-math-game`)
- **تاریخ:** `2026-10-22` (UTC)
- **مخاطب:** مدلِ مادر / موتورِ اصلیِ `Z.ai` و مالکِ انسانیِ پروژه
- **هدفِ سند:** پایان دادن به واسطه‌گریِ پیام. هر آنچه مدلِ مادر لازم دارد بداند،
  یا در این سند است یا در بستهٔ ماشین‌خوانِ `authoring/MOTHER-AI-INDEX.json`
  که مستقیماً از کد تولید می‌شود و با SHA-256 قابلِ راستی‌آزمایی است.

> **هیچ‌چیز در این سند ادعایِ «نهایی‌بودن»، رأیِ معلم، اجازهٔ انتشار یا تغییرِ
> سرِ رسمی نیست.** فهرستِ صریحِ آنچه اعطا نشده در `not_granted` بستهٔ ماشین‌خوان است.

---

## ۰) دسترسیِ مستقیمِ مدلِ مادر به کدِ موتور (پاسخِ کوتاه: بله)

| منبع | مقدار |
| --- | --- |
| مخزن | `https://github.com/bayrami1341/math-game` |
| شاخهٔ موتورِ آرنا | `arena/0eb22280-math-game` |
| پایهٔ تحویلِ پیشین | `f2d7f24` (تگِ `v2.4-final` روی `211ee45`) |
| کامیتِ سخت‌سازیِ v2.4 | در همین شاخه، بلافاصله پس از `f2d7f24` |
| PR | `#2` — `arena/0eb22280-math-game` → `v10.3-beta` (`OPEN`) |
| مرجعِ رسمیِ فقط‌خواندنی | `origin/v10.3-beta` @ `24e61dd` (سرِ پیشین `0849aae`) |
| بستهٔ ماشین‌خوان | `authoring/MOTHER-AI-INDEX.json` |
| تولیدِ دوبارهٔ بسته | `python3 -m authoring.agent.cli handoff-index --repo-root . --output authoring/MOTHER-AI-INDEX.json --official-ref-root <worktree>` |

**روشِ مصرف برای مدلِ مادر (بدونِ چت):**

```bash
git clone https://github.com/bayrami1341/math-game.git
cd math-game
git checkout arena/0eb22280-math-game
python3 -c "import json; b=json.load(open('authoring/MOTHER-AI-INDEX.json')); print(b['repository']['head_sha_at_generation'], len(b['engine']['modules']))"
sha256sum authoring/agent/achilles_gate.py   # مقایسه با b['engine']['modules'][...]['sha256']
pip install -e . && python -m pytest -q
```

اگر SHA ماژولی با بسته نخواند، یعنی کدِ آن ماژول پس از تولیدِ بسته تغییر کرده است
(یا کسی دست برده) — در آن حالت بسته را با همان فرمانِ بالا بازتولید کنید.

> **نکتهٔ راستی‌آزمایی:** `repository.head_sha_at_generation` شمارهٔ HEAD در *لحظهٔ
> تولیدِ بسته* است و خودِ بسته در کامیتِ بعدی منتشر می‌شود؛ پس شمارهٔ سرِ شاخه یک
> شماره جلوتر خواهد بود. معیارِ هم‌خوانی، SHA-256ِ ماژول‌هاست نه شمارهٔ کامیت
> (آزمونِ `test_committed_index_matches_regenerated_bundle` همین را کنترل می‌کند).

---

## ۱) خلاصهٔ اجرایی

شش یافتهٔ بازبینیِ مستقل روی `آشیل v2.4` گزارش شده بود. هر شش مورد در سمتِ آرنا
بسته شد، **بدون** دست‌زدن به فایل‌های نرم‌افزاریِ `Z.ai`، **بدون** سست‌کردنِ هرگونه گیتِ
توقف، و **بدون** صدورِ رأیِ معلم یا اجازهٔ انتشار.

| # | یافته | وضعیت | دلیلِ ریشه‌ای | اقدامِ انجام‌شده |
| --- | --- | --- | --- | --- |
| ۱ | نمونهٔ G2 بر پایهٔ کهنهٔ `v0.4` و شکستِ آزمونِ بازیابیِ صف | بسته شد | آزمونِ صف به نمونه‌ای وابسته بود که سرِ رسمی‌اش عوض شده | نمونهٔ افزایشیِ تازهٔ `v1.2` روی پایهٔ `v0.5` + آزمونِ هرمتیکِ ردِ مبنای کهنه |
| ۲ | `PASS` گیتِ هلوسه به‌معنایِ بررسیِ صفحه‌ها خوانده می‌شد | بسته شد | یک گیت، دو معنا داشت | گیتِ مستقلِ `G_ACHILLES_COVERAGE` با شمارِ عددیِ پوشش |
| ۳ | راهنما با CLI نمی‌خواند (`observe`، `--spec/--out`، جفتِ `C205`/`C305`) | بسته شد | مستندِ دستی بدونِ کنترلِ ماشینی | راهنمایِ تازه + آزمونِ تجزیه **و اجرای واقعیِ** هر نمونه‌فرمان |
| ۴ | اتصالِ شاهد به منبعِ واقعی مقید نبود | بسته شد | فقط وجودِ رشتهٔ ۶۴رقمی سنجیده می‌شد | `bind_evidence_to_source` با چهار لنگر و هشت کدِ `fail-closed` |
| ۵ | `--approve-once` و `record-verdict` می‌توانستند معنایِ مجوزِ انسانی بسازند | بسته شد | نبودِ مرزِ داده‌ای میانِ «اجازهٔ فنی» و «رأیِ معلم» | `TECHNICAL_EXECUTION_ONLY` + الزامِ `authenticated=True` |
| ۶ | توکنِ پیش‌فرضِ قابلِ حدس و میزبانیِ عمومیِ میز کار | بسته شد | fallback راحتی برای توسعه | حذفِ fallback، `host=127.0.0.1`، `.gitignore` برای توکن، آزمونِ `403` |

---

## ۲) تحلیلِ ریشه‌ایِ هر اصلاح (چرا، نه فقط چه)

### ۲.۱ بند ۱ — گیتِ توقفِ مبنای کهنه؛ آزمونِ صف
**نشانه:** در محیطِ ایزولهٔ دارایِ Git، ۱۸ از ۱۹ آزمون گذشت و
`test_persistent_queue_and_crash_recovery` شکست.
**علتِ ریشه‌ای:** آن آزمون از `wave_spec_G2_ch4_v05.json` استفاده می‌کرد که پایه‌اش
`khshab-G2-MATH_v0.4.xlsx` (`a2f6105…`) است؛ وقتی سرِ رسمیِ اعلام‌شده `v0.5`
(`f1f339a0…`) شد، گیتِ `STALE_OFFICIAL_BASE_INCIDENT_07` به‌درستی موج را متوقف کرد
و آزمونِ صف «تکمیلِ موج» را ندید. یعنی **گیت درست کار می‌کرد و آزمون غلط طراحی شده بود**.
**اقدام:**
- گیتِ توقف **دست‌نخورده** ماند (نه حذف، نه سست).
- نمونهٔ `authoring/agent/fixtures/wave_spec_G2_v12_incremental.json` ساخته شد:
  پایهٔ رسمیِ `v0.5` با SHA `f1f339a0…`، دو ردیفِ S1 زرد با صفحهٔ `؟`،
  **صفر** سؤالِ ساختگی، **صفر** پچِ مجاز.
- آزمونِ صف بازنویسی شد تا با ریشهٔ رسمیِ *هرمتیکِ* ساخته‌شده در `tmp_path`
  (همان چیدمانِ `public/math-game/authoring/OFFICIAL-HEADS.json`) اجرا شود؛ پس
  وابستگی به `/tmp/v103_ref` و به محیطِ خاص از بین رفت.
- آزمونِ مستقلِ ردِ مبنای کهنه افزوده شد که **دو** جهت را می‌آزماید:
  با سرِ `v0.5` → `FAIL/STALE_OFFICIAL_BASE_INCIDENT_07` و هیچ فایلی ساخته نمی‌شود؛
  با سرِ `v0.4` (کنترل) → `PASS` و بازتولیدِ بایت‌به‌بایتِ `f1f339a0…`.
  این کنترل ثابت می‌کند گیت «سرِ اعلامی‌محور» است، نه یک `FAIL` همیشه‌گی.
**ریسکِ باقی‌مانده:** اگر `Z.ai` سرِ رسمی را عوض کند و نمونهٔ `v1.2` را
به‌روز نکند، موج دوباره `HELD`/`FAIL` می‌شود — که رفتارِ درست است و در گزارشِ
صبحگاهی با دلیلِ صریح ثبت می‌شود.

### ۲.۲ بند ۲ — تفکیکِ «هلوسه» از «پوششِ شاهد»
**نشانه:** نامزدِ G2 حتی **بدونِ دفترِ شاهد** از گیتِ آشیل `PASS` می‌گرفت
(`ACHILLES_NO_LEDGER_BUT_NO_GREEN_RISK`) و این نتیجه به «بررسی‌شدنِ صفحه‌ها» تفسیر می‌شد.
**علتِ ریشه‌ای:** یک گیت، دو پرسشِ متفاوت را پاسخ می‌داد: «آیا سبزِ بی‌شاهد داریم؟»
(که پاسخش با نبودِ سبز، منفی است) و «آیا صفحه‌ها مشاهده شده‌اند؟» (که بدونِ دفترِ
شاهد، **نامعلوم** است نه مثبت).
**اقدام:** گیتِ مستقلِ `G_ACHILLES_COVERAGE` (`verify_evidence_coverage_gate`) با
زیرفرمانِ `coverage` و سنجه‌های عددی:
`rows_with_evidence`، `rows_without_evidence`، `rows_mismatch`، `coverage_ratio`،
`without_evidence_ids`، `proven_offset`، `ledger_size`.
- بدونِ دفترِ شاهد → `WARN/COVERAGE_UNKNOWN_NO_OBSERVATION` (هرگز `PASS`).
- ردیفِ بی‌شاهد → `WARN/COVERAGE_INCOMPLETE_YELLOW_REMAINS` و ردیف **زرد می‌ماند**.
- سبزِ بی‌شاهد → `FAIL/GREEN_ROWS_WITHOUT_EVIDENCE`.
- ناسازگاریِ منبع/صفحه/آفست → `FAIL` (بند ۴).
هر خلاصهٔ این گیت این جمله را دارد: «این گیت فقط پوششِ شاهد را می‌سنجد؛ PASS آن
به معنایِ تکمیلِ مشاهدهٔ همهٔ صفحه‌ها یا آمادگیِ انتشار نیست و هیچ ردیفی را سبز نمی‌کند.»
**تحلیلِ اثر:** در ناظرِ شبانه، `coverage.status == "FAIL"` مسدودکننده است و
`WARN` فقط گزارش می‌شود؛ پس «دقتِ هلوسه» با «نقصِ پوشش» قاطی نمی‌شود و صفِ شبانه
به‌خاطرِ زردهایِ مشروع نمی‌خوابد.

### ۲.۳ بند ۳ — هم‌ترازیِ راهنما با CLI (و یک نقصِ واقعیِ کد)
**نشانه:** فرمانِ `observe` وجود نداشت؛ `reconcile` با گزینه‌های اشتباه مستند شده بود؛
`build-wave` با `--spec/--out` نوشته شده بود در حالی که `--wave-spec/--output` است؛
نمونه‌ای manifest کتابِ دوم (`C205`) را با PDF کتابِ سوم (`C305`) جفت کرده بود.
**علتِ ریشه‌ای:** مستندِ دستی بدونِ هیچ کنترلِ ماشینی؛ به‌علاوه یک نقصِ واقعی که
در بازبینیِ دستی دیده نشده بود: `build-wave` هنگامِ چاپِ JSON با
`TypeError: Object of type IDAllocator is not JSON serializable` می‌شکست و
`exit=1` می‌داد، در حالی که خشاب را درست ساخته بود.
**اقدام:**
- `authoring/USAGE-KHSHAB-AGENT-v24.fa.md` با فهرستِ واقعیِ ۱۳ زیرفرمان و
  اصلاحیهٔ صریحِ چهار موردِ بالا (از جمله «observe وجود ندارد؛ مشاهده از راهِ
  `authoring.agent.observation.observe_pdf(...)` است»).
- `build_parser()` از `main()` بیرون کشیده شد تا آزمون بتواند *بدونِ اجرا* هم
  نمونه‌فرمان‌ها را تجزیه کند.
- `authoring/tests/test_docs_cli_alignment.py`: هر نمونه‌فرمان هم **تجزیه** می‌شود
  و هم **واقعاً اجرا** می‌شود (`build-wave`، `coverage`، `reconcile-chunks`،
  `keyed-diff`، `record-verdict`)؛ جفتِ ناسازگارِ `C205`/`C305` صریحاً ممنوع است؛
  و `--host` پیش‌فرض باید `127.0.0.1` بماند.
- نقصِ `IDAllocator` با جایگزینیِ `allocator_summary` (شمارِ شناسه‌های
  تخصیص‌یافته/بازنشسته) در خروجیِ JSON رفع شد.
**تحلیلِ اثر:** راهنما اکنون «کدِ اجرایی» است نه متنِ تشریفاتی: اگر کسی فردا
زیرفرمانی را عوض کند و راهنما را نه، CI می‌شکند.

### ۲.۴ بند ۴ — اتصالِ شاهد به منبعِ واقعی
**نشانه:** صرفِ وجودِ رشتهٔ ۶۴رقمی در ledger یا شاهدی از همان *صفحه*، کافی فرض می‌شد؛
ناسازگاریِ منبع/چاپ/کد کتاب صریح گزارش نمی‌شد.
**علتِ ریشه‌ای:** دفترِ شاهد به «صفحه» متصل بود، نه به «کتاب + چاپ + فایلِ فیزیکیِ PDF».
**اقدام:** `bind_evidence_to_source(observation, book_manifest, pdf_path, expected_book_code)`
با چهار لنگر:
1. SHA-256 **واقعیِ فایلِ PDF ورودی** در برابرِ `observation.source_pdf_sha256`؛
2. `book_code` یکسان در observation / manifest / تک‌تک ورودی‌های ledger؛
3. manifestِ **همان چاپ** (`source_pdf.sha256` و `edition_label_fa`)؛
4. آفستِ اثبات‌شده (`pagination.pdf_minus_book_offset`) و سازگاری‌اش با نقشهٔ مادر.
کدهای `fail-closed`: `PDF_SHA_MISMATCH`، `SOURCE_PDF_UNAVAILABLE`،
`MANIFEST_PRINT_SHA_MISMATCH`، `EXPECTED_BOOK_CODE_MISMATCH`، `BOOK_CODE_MISMATCH`،
`LEDGER_SOURCE_BINDING_MISMATCH`، `LEDGER_SHA_NOT_MATCHING_REAL_PDF`،
`PROVEN_OFFSET_CONFLICT`، `PAGE_OFFSET_MISMATCH_HALLUCINATION`، `DANGLING_EVIDENCE_REF`.
**نتیجهٔ اندازه‌گیری‌شده روی `khshab-G2-MATH_v0.5.xlsx`:** `51` ردیف با شاهد،
`3` ردیف بدون شاهد (`L-101`, `L-201`, `L-401`)، `0` ناسازگاری، آفستِ `+6`،
ledger `162`، SHA منبع `a93934b6…`، چاپِ `چهاردهم ۱۴۰۴`.
**تحلیلِ اثر:** اکنون «شاهدِ صفحهٔ درست از کتابِ اشتباه/چاپِ اشتباه» غیرممکن است؛
و نبودِ PDF واقعی به‌جایِ سکوت، `SOURCE_PDF_UNAVAILABLE` می‌دهد.

### ۲.۵ بند ۵ — مرزِ «اجازهٔ فنی» از «رأیِ معلم»
**نشانه:** `--approve-once` از وجود و SHA فایلِ نقشه، «رضایتِ احرازشدهٔ مالک» و
«اختیارِ صدورِ رأیِ معلم» استنتاج می‌شد؛ و `record-verdict` با رشتهٔ
`--actor-role human_teacher` رأیِ انسانیِ معتبر می‌ساخت.
**علتِ ریشه‌ای:** نبودِ تمایزِ *داده‌ای* میانِ دو سطحِ مجوز؛ هر دو در یک پرچم/رشته خلاصه می‌شدند.
**اقدام:**
- خروجیِ `_roadmap_approval_proof` اکنون صریحاً دارد:
  `permission_scope="TECHNICAL_EXECUTION_ONLY"`، `teacher_verdict_granted=false`،
  `release_authorization="NOT_GRANTED"`، `not_a_consent_document=true`.
- هر موجِ `PASS` در وضعیتِ ناظر این سه فیلد را حمل می‌کند:
  `technical_pass_only=true`، `teacher_verdict_required=true`،
  `release_authorization="NOT_GRANTED"`؛ و در گزارشِ صبحگاهی بخشِ
  «مرزِ مجوزها (قابلِ ممیزی)» چاپ می‌شود.
- `GovernanceLedger.record_verdict` برای هر حکمِ تأییدی `authenticated=True`
  می‌خواهد و در غیر این صورت `TEACHER_IDENTITY_NOT_AUTHENTICATED` می‌دهد؛
  `TeacherVerdict` فیلدهای `authenticated` و `auth_method` را **ذخیره** می‌کند
  تا هر حکم قابلِ ممیزی باشد.
- در CLI، `record-verdict` بدونِ توکن کدِ خروجِ `2` می‌دهد و هیچ فایلی نمی‌سازد؛
  نقشِ `human_teacher` را **سرور** پس از احراز هویت تعیین می‌کند، نه فراخواننده.
**تحلیلِ اثر:** هیچ مسیری (CLI یا HTTP) نمی‌تواند با «خوداظهاری» رأی انسانی بسازد؛
و `--approve-once` از نظرِ داده‌ای فقط مجوزِ اجرای فنیِ محدود است.

### ۲.۶ بند ۶ — امنیتِ میز کارِ معلم
**نشانه:** توکنِ پیش‌فرضِ قابلِ حدس (`dev-teacher-token-2026`) و پیش‌فرضِ
`--host 0.0.0.0`.
**علتِ ریشه‌ای:** fallback راحتیِ توسعه که به تنظیمِ پیش‌فرضِ تولید تبدیل شده بود.
**اقدام:** حذفِ کاملِ fallback (بدونِ توکن → `None` → همهٔ حکم‌های تأییدی `403`)،
پیش‌فرضِ `--host 127.0.0.1` در هر دو لایهٔ `viewer.py` و `cli.py`،
افزودنِ `authoring/audit/teacher_token*.txt` به `.gitignore`، و دو آزمونِ ردِ
درخواستِ بدونِ احراز هویت (یکی با توکنِ غلط، یکی با نبودِ کاملِ توکن).
**تحلیلِ اثر:** «در دسترسِ عموم با تنظیماتِ فعلی» دیگر ممکن نیست؛ برای استفادهٔ
محلی هم توکنِ صریحِ خارج از Git لازم است.

---

## ۳) نتیجهٔ دقیقِ آزمون‌ها

- **چیدمان:** شاخهٔ محتواییِ آرنا `arena/0eb22280-math-game` + مرجعِ رسمیِ
  فقط‌خواندنیِ `v10.3-beta` @ `24e61dd` در `/tmp/v103_ref`
- **فرمان:** `python -m pytest -q`
- **نتیجهٔ نهایی (پس از افزودنِ بستهٔ دسترسیِ مدلِ مادر):** **`76 passed, 4 skipped`**
  (۸۰ مورد جمع‌آوری‌شده) در `29s` — شاملِ ۶۹ موردِ پیشین + ۷ آزمونِ
  `authoring/tests/test_handoff_index.py`. هیچ `failed` و هیچ `error` نیست.
- **`4 skipped` صریح (نه سکوتِ مبهم):** نبودِ `C205.pdf` و `C305.pdf` محرمانه در
  این محیط (۲ مورد) و نبودِ مبدلِ رسمیِ SSOT در شاخهٔ محتواییِ آرنا (۲ مورد).

| آزمونِ خواسته‌شده | نامِ آزمون | نتیجه |
| --- | --- | --- |
| ردِ مبنای کهنه | `test_stale_official_base_is_rejected_and_gate_is_precise` | `PASS` |
| بازیابیِ صف | `test_persistent_queue_and_crash_recovery` | `PASS` |
| ناسازگاریِ PDF/manifest | `test_binding_requires_real_pdf_sha_book_code_and_same_print` + `test_coverage_gate_fails_closed_on_source_and_offset_mismatch` | `PASS` |
| نبودِ شاهد | `test_hallucination_pass_without_ledger_is_neither_coverage_nor_release` + `test_green_row_without_evidence_fails_coverage_gate` | `PASS` |
| نبودِ احراز هویت | `test_viewer_rejects_unauthenticated_when_no_token_configured` + `test_record_verdict_cli_rejects_role_claim_without_server_token` + `test_approval_scope_verdict_cannot_be_minted_by_caller_string` | `PASS` |
| هم‌ترازیِ راهنما/CLI | `test_every_documented_command_parses_against_real_cli` + `test_documented_commands_are_actually_executable` | `PASS` |
| بستهٔ دسترسیِ مدلِ مادر | `authoring/tests/test_handoff_index.py` (۷ آزمون) | `PASS` |

---

## ۴) گزارشِ dry-run اتصالِ G2 v1.2 (بدونِ ادعایِ تأییدِ محتوایی)

**سناریوی A — ریشهٔ رسمیِ هرمتیکِ ایزوله (سرِ `v0.5`، بدونِ یادداشتِ مُهر معلم):**

| گیت | نتیجه |
| --- | --- |
| `G3_WAVE_EXPORT` | `PASS` / `WAVE_EXPORT_CLEAN` |
| SHA خروجی | `6afd3a5741712df9ed4c60a90dc356c9742dccd47093d33bf41a90bb89a94086` |
| دیفِ کلیدمحور | `added=2`، `removed=0`، `changed_cells=0`، `applied_patches=[]` |
| `G6` / `G3-ANTI-J12` / `G4` / `G5` | همه `PASS` |
| `U-01..U-10` | `PASS` / `ALL_UNIVERSAL_INVARIANTS_CLEAN` |
| گیتِ هلوسه | `PASS` / `ACHILLES_EVIDENCE_VERIFIED` |
| گیتِ پوشش | `WARN` / `COVERAGE_INCOMPLETE_YELLOW_REMAINS` |
| مبدلِ رسمیِ `Z.ai` (فقط‌خواندنی) | `PASS` — قرمز `0`، زرد `2`، «مجاز — JSON منتشر شد» |
| وضعیتِ ناظر | `PASS` **فنی** (`technical_pass_only=true`)، رأیِ معلم `NOT_GRANTED` |

**پوششِ شاهد:** `51` با شاهد / `3` بدون شاهد (`L-101`, `L-201`, `L-401`) /
`0` ناسازگاری / نسبتِ `0.9444` / آفستِ `+6` / ledger `162` / منبعِ PDF `a93934b6…` /
چاپِ `چهاردهم ۱۴۰۴`. هیچ سبزِ تازه‌ای ساخته نشد (`green_rows` همان `8` ماند).

**سناریوی B — ریشهٔ رسمیِ واقعی (`24e61dd`):**
`HELD_AWAITING_TEACHER_STAMP_AND_WAVE_AUTHORIZATION` و **هیچ خشابی ساخته نشد**،
چون `OFFICIAL-HEADS.json` برای `KH-G2-MATH` یادداشتِ «۴۸ سؤال و ۵۴ ردیفِ صفحه‌ای
«پیشنهاد» در انتظار مُهر معلم» دارد. قانونِ `Wave 5 Hold` دست‌نخورده باقی است.

**نامزدِ `v1.2` با SHA `18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618`
در این محیط حاضر نبود**؛ بنابراین هیچ مقایسهٔ بایتی/کلیدی با آن انجام یا ادعا نشده است.

---

## ۵) قراردادهایی که مدلِ مادر نباید بشکند (`hard_invariants`)

| شناسه | قانون | نقطهٔ راستی‌آزمایی |
| --- | --- | --- |
| `INV-01` | شناسه‌های `L-/Q-/E_` غیرقابلِ بازیافت و دائمی‌اند | `id_allocator.ImmutableIDViolationError` |
| `INV-02` | لنگرِ دوطرفهٔ `S1.K ↔ Bank.B` | `validators.verify_bidirectional_anchors` |
| `INV-03` | موجِ جدید فقط از سرِ اعلام‌شدهٔ `OFFICIAL-HEADS.json` | `STALE_OFFICIAL_BASE_INCIDENT_07` |
| `INV-04` | سبزِ AI بدونِ شاهدِ کراپ/BBOX/SHA = `FAIL` | `verify_achilles_evidence_gate` |
| `INV-05` | پوششِ شاهد گیتِ جداست؛ `PASS` هلوسه ≠ پوشش ≠ انتشار | `verify_evidence_coverage_gate` |
| `INV-06` | اتصالِ شاهد به SHA واقعیِ PDF + کد کتاب + همان چاپ + آفست | `bind_evidence_to_source` |
| `INV-07` | مُهرِ معلم فقط با احراز هویتِ سمتِ سرور | `governance.authenticate_teacher` |
| `INV-08` | `--approve-once` فقط اجازهٔ فنیِ محدود | `_roadmap_approval_proof` |
| `INV-09` | توافقِ دو خواننده بدونِ شاهد هرگز `EVIDENCE_MATCHED` نیست | `reconcile.enforce_agreement_evidence_rule` |
| `INV-10` | PDF/عکس/کراپ/نقلِ >۱۰ واژه هرگز در Git نیست | `git_guard.audit_git_copyright_safety` |

**مسیرهایِ در مالکیتِ `Z.ai` که آرنا هرگز تغییر نمی‌دهد:**
`public/math-game/src/v10/**`، `workshop-core.js`، `v10.html`،
`tools/cartridge-converter/**`، `public/math-game/cartridges/*.json`.

---

## ۶) آنچه فقط از سمتِ مدلِ مادر / مالک انجام‌شدنی است

| شناسه | اقدام | صاحب |
| --- | --- | --- |
| `W7` | افزودنِ خطِ CI به `.github/workflows/khshab-gate.yml` برای `pytest authoring/tests` با Python 3.12 | `Z.ai` |
| `W8` | پورتِ `parseOptionValue` و `classifyAttempt` به `cartridge-schema.js` و `errors.js` | `Z.ai` |
| `PR2` | حلِ `CONFLICTING` بودنِ PR #2 با `squash`/`rebase` (نه ادغامِ `v10.3-beta` در `arena/**`) | `Z.ai` |
| `CANDIDATE` | mount کردنِ نامزدِ واقعیِ `v1.2` (`18e6b4fa…`) خارج از Git برای مقایسهٔ کلیدمحور | مالک / `Z.ai` |
| `STAMP` | صدورِ مُهرِ معلم برای ۴۸ سؤال و ۵۴ ردیفِ «پیشنهاد» و سپس به‌روزرسانیِ `OFFICIAL-HEADS.json` | معلمِ انسانی (انحصاری) |
| `C305` | تهیهٔ `book_manifest_C305.json` و `observation_C305.json` از همان چاپ | آرنا پس از تحویلِ PDFِ قرنطینه |

---

## ۷) موانعِ باقی‌مانده تا «پروندهٔ آمادهٔ تصمیمِ مالک»

1. نامزدِ واقعیِ `v1.2` در دسترس نیست → مقایسهٔ کلیدمحور/بایتی انجام نشده.
2. پوششِ شاهد کامل نیست: `L-101`، `L-201`، `L-401` کراپ/`bbox`/SHA ندارند و
   **زرد می‌مانند** تا شاهد ثبت شود (نیازمندِ `C205.pdf` در قرنطینه).
3. مُهرِ معلم صادر نشده و `Wave 5 Hold` پابرجاست؛ پس روی ریشهٔ رسمیِ واقعی هیچ
   موجِ G2 با پایهٔ `≥ v0.5` ساخته نمی‌شود.
4. `G7` همچنان `releasable=false` است؛ هیچ حکمِ `RELEASE_AUTHORIZED` وجود ندارد.
5. اتصالِ `C305` هنوز `fail-closed` است (manifest/observation همان چاپ وجود ندارد).
6. PR #2 به‌دلیلِ ریشه‌های نامرتبط `CONFLICTING` است؛ حلش در سمتِ `Z.ai` است.
7. چهار آزمون به‌دلیلِ نبودِ PDFهایِ محرمانه و مبدلِ SSOT در شاخهٔ محتواییِ آرنا
   `skip` می‌شوند؛ راستی‌آزماییِ کاملِ آن مسیرها فقط در چیدمانِ `v10.3-beta` ممکن است.

---

## ۸) فهرستِ فایل‌های تغییرکرده در این چرخه و دلیلِ هرکدام

| فایل | دلیل |
| --- | --- |
| `authoring/agent/achilles_gate.py` | گیتِ پوششِ شاهد + `bind_evidence_to_source` (بندهای ۲ و ۴) |
| `authoring/agent/governance.py` | `expected_teacher_token`، `authenticate_teacher`، الزامِ `authenticated` (بندهای ۵ و ۶) |
| `authoring/agent/models.py` | فیلدهای `authenticated`/`auth_method` روی `TeacherVerdict` برای ممیزی |
| `authoring/agent/viewer.py` | حذفِ توکنِ پیش‌فرض، `403` بدونِ توکن، `host=127.0.0.1` (بند ۶) |
| `authoring/agent/cli.py` | زیرفرمان‌های `coverage` و `handoff-index`، احراز هویتِ `record-verdict`، `build_parser()`، رفعِ نقصِ JSON (بندهای ۳ و ۵) |
| `authoring/agent/autopilot.py` | اجرای گیتِ پوشش در هر موج، مرزِ مجوزها در وضعیت و گزارشِ صبحگاهی (بندهای ۲ و ۵) |
| `authoring/agent/wave_exporter.py` | `allocated_lids/qids/eids` برای دامنه‌بندیِ قطعیِ بازرسان |
| `authoring/agent/handoff.py` | **جدید** — سازندهٔ بستهٔ دسترسیِ ماشین‌خوان برای مدلِ مادر |
| `authoring/agent/fixtures/wave_spec_G2_v12_incremental.json` | **جدید** — موجِ افزایشیِ G2 روی پایهٔ رسمیِ `v0.5` (بند ۱) |
| `authoring/tests/test_achilles_boundaries.py` | آزمونِ هرمتیکِ ردِ مبنای کهنه + بازنویسیِ آزمونِ بازیابیِ صف |
| `authoring/tests/test_achilles_v24_hardening.py` | **جدید** — پوشش، اتصالِ منبع، مرزِ مجوزها، احراز هویت |
| `authoring/tests/test_docs_cli_alignment.py` | **جدید** — کنترلِ ماشینیِ راهنما با CLI واقعی |
| `authoring/tests/test_handoff_index.py` | **جدید** — راستی‌آزماییِ بستهٔ دسترسیِ مدلِ مادر |
| `authoring/tests/test_wave_exporter_and_w3_w6.py` | توکنِ محیطیِ صریح + آزمونِ ردِ `403` |
| `tests/test_authoring_pipeline.py` | حکم‌های معلم با `authenticated=True` + آزمونِ ردِ رأیِ خوداظهار |
| `authoring/USAGE-KHSHAB-AGENT-v24.fa.md` | **جدید** — راهنمایِ هم‌تراز با CLI (بند ۳)؛ بخشِ `handoff-index` افزوده شد |
| `authoring/MOTHER-AI-INDEX.json` | **جدید** — بستهٔ منتشرشدهٔ دسترسیِ ماشین‌خوان: ۱۶ ماژول + SHA-256 + ۱۳ زیرفرمانِ CLI + گیت‌ها + کدهای `fail-closed` + سرهای رسمی + `not_granted` |
| `authoring/G2-V12-CONNECTION-DRYRUN.fa.md` | **جدید** — گزارشِ dry-run اتصالِ G2 |
| `authoring/MOTHER-AI-HANDOFF-v24.fa.md` | **جدید** — همین سند |
| `authoring/MOTHER-AI-INDEX.json` | **جدید** — بستهٔ ماشین‌خوانِ تولیدشده از کد |
| `authoring/ZAI-HANDOFF-W7-W8.fa.md` | بخشِ ۴: صورت‌وضعیتِ سخت‌سازی برای `Z.ai` |
| `.gitignore` | `authoring/audit/teacher_token*.txt` هرگز در Git |

---

## ۹) راهنمایِ سریعِ مدلِ مادر برای ادامهٔ کار

```bash
# ۱) خواندنِ بستهٔ دسترسی و راستی‌آزماییِ SHA
python3 -c "import json;b=json.load(open('authoring/MOTHER-AI-INDEX.json'));print(b['repository']['head_sha']);print([m['path'] for m in b['engine']['modules']])"

# ۲) ساختِ موجِ افزایشیِ G2 و سنجشِ پوششِ شاهد
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

# ۳) اجرای شبانه بدونِ push خودکار
python3 -m authoring.agent.cli autopilot --repo-root . \
  --official-ref-root <worktree-of-v10.3-beta> \
  --state-dir /tmp/khshab_autopilot_state \
  --target-waves authoring/agent/fixtures/wave_spec_G2_v12_incremental.json \
  --morning-report /tmp/khshab_quarantine/MORNING-REPORT.fa.md

# ۴) بازتولیدِ بستهٔ دسترسی پس از هر تغییرِ کد
python3 -m authoring.agent.cli handoff-index --repo-root . \
  --output authoring/MOTHER-AI-INDEX.json \
  --official-ref-root <worktree-of-v10.3-beta>
```

**قاعدهٔ طلاییِ گزارش‌دهی برای مدلِ مادر:** هر گزارشی از `N passed` باید
چیدمانِ مخزن (`v10.3-beta` یا `arena/0eb22280-math-game`)، هشِ کامیت و شمارِ دقیقِ
`passed`/`skipped` را داشته باشد؛ و هر `PASS` فنی باید با `technical_pass_only=true`
گزارش شود، نه «تأییدِ محتوا».
