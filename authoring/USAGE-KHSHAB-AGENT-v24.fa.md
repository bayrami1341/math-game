# راهنمای استفاده و دسترسی به ربات اصلی (`khshab-agent v2.4`)

> **این راهنما با کدِ واقعیِ `authoring/agent/cli.py` هم‌تراز است و توسط آزمون
> `authoring/tests/test_docs_cli_alignment.py` در CI کنترل می‌شود:**
> هر نمونه‌فرمانِ این فایل پیش از هر اجرا با `build_parser()` اعتبارسنجی می‌شود،
> پس هیچ فرمان/گزینهٔ خیالی نمی‌تواند در راهنما بماند.
>
> **اصلاحیهٔ صریح نسبت به راهنمای پیشین (بند ۳ بازبینی):**
> - فرمانی به نام `observe` در CLI **وجود ندارد**؛ مشاهدهٔ PDF از راهِ کتابخانهٔ
>   `authoring.agent.observation.observe_pdf(...)` انجام می‌شود (نه زیرفرمان CLI).
> - فرمان آشتی، `reconcile-chunks --chunks-dir <dir>` است (نه `reconcile --pass-a/--pass-b`).
> - گزینه‌های ساخت موج، `build-wave --wave-spec <json> --output <xlsx>` است
>   (نه `--spec/--out`).
> - جفت‌کردنِ `book_manifest_C205.json` با `C305.pdf` **غلط است**؛ manifest و PDF و
>   observation باید همه از **یک کتاب و یک چاپ** باشند (بند ۴) و گیتِ پوشش در
>   صورتِ ناسازگاری `fail-closed` رد می‌کند.

---

## ۰) محلِ برنامهٔ اصلی و نصب

- **مخزن:** `bayrami1341/math-game` — شاخهٔ کاری آرنا `arena/0eb22280-math-game`
- **نقطهٔ ورود:** `authoring/agent/cli.py:main()` که در `pyproject.toml` به اسکریپت
  `khshab-agent` نگاشت شده است:

```toml
[project.scripts]
khshab-agent = "authoring.agent.cli:main"
```

- **پکیج:** `authoring/agent/` (خروجی موج، اعتبارسنج‌ها، حل‌گر مستقل، مشاهده،
  آشتی، گیت آشیل، گیت پوشش، میز کار معلم، ناظر شبانه).

```bash
git clone https://github.com/bayrami1341/math-game.git
cd math-game
git checkout arena/0eb22280-math-game
pip install -e .
python3 -m pytest -q
```

اگر `khshab-agent` روی `PATH` نصب نشده، همهٔ فرمان‌های زیر با
`python3 -m authoring.agent.cli <subcommand> ...` معادل‌اند.

---

## ۱) فهرستِ واقعیِ زیرفرمان‌ها

| زیرفرمان | کاربرد |
| --- | --- |
| `init-book` | گام ۰ هر کتاب PDF: کشف آفست + برنامهٔ چانک ≤۱۲ صفحه با هم‌پوشانی ۲ |
| `build-wave` | ساختِ غیرمخربِ خشاب از `WaveSpec v2` (W1) |
| `check-wave` | گیتِ کاملِ موج: دیف کلیدمحور + مُهرها + مبدل رسمی + آشیل + پوشش |
| `coverage` | **گیتِ مستقلِ پوششِ شاهد** (بند ۲/۴): شمارِ ردیفِ با/بی شاهد + اتصال به SHA واقعی PDF و manifest همان چاپ |
| `microbot-preflight` | M13 MVP فقط‌خواندنی: M00 هویت منبع، M01 PDF امن/workspace، M02 اعتبارسنجی observation؛ `G_ACHILLES_COVERAGE` جدا |
| `concept-scope-audit` | M05 فنی و فقط‌خواندنی: تطبیق دو packet صفحه‌به‌صفحه با پروفایل مفهومیِ مقید به همان PDF/چاپ |
| `content-pipeline-audit` | گیتِ اتصال artifactهای نسخه‌دارِ منبع، استخراج، ارزش‌گذاری و game draft در مخزن |
| `export-extraction-xlsx` | ساخت Excel تازه از دفتر استخراجِ مقید به source/offset-proof؛ بدون overwrite |
| `reconcile-chunks` | آشتی‌دهیِ اتمیِ چانک‌های هم‌پوشان (W5) |
| `keyed-diff` | دیفِ سلول‌به‌سلول بر پایهٔ ستون A |
| `count-items` | شمارشِ ماشینیِ شکل‌ها در ناحیهٔ تصویریِ یک صفحه |
| `heads` | راستی‌آزماییِ `OFFICIAL-HEADS.json` (Task 66) |
| `audit` | اجرایِ کاملِ آزمونِ مرجع + ۱۶ حادثهٔ تاریخی |
| `record-verdict` | ثبتِ حکمِ معلم **فقط با احراز هویتِ سمتِ سرور** |
| `serve-viewer` | میز کارِ بصریِ معلم با ذره‌بین پیکسلی و امضای SHA-256 |
| `autopilot` | ناظرِ شبانه با خودترمیمیِ ریشه‌ای (بدون push خودکار) |
| `handoff-index` | تولیدِ بستهٔ دسترسیِ ماشین‌خوان برای مدلِ مادر (`authoring/MOTHER-AI-INDEX.json`) |

---

## ۲) ساختِ موج (`build-wave`)

```bash
python3 -m authoring.agent.cli build-wave \
  --wave-spec authoring/agent/fixtures/wave_spec_G2_v12_incremental.json \
  --output /tmp/khshab_quarantine/KH-G2-MATH_v1.2_dryrun.xlsx \
  --registry /tmp/khshab_quarantine/id_registry_v12.json
```

- خروجیِ موفق باید `gate.status == "PASS"` و `output_sha256` داشته باشد.
- اگر `expected_official_base_sha256` با سرِ رسمیِ موجود برابر نباشد، اجرا با
  `STALE_OFFICIAL_BASE_INCIDENT_07` **متوقف** می‌شود (این گیت هرگز سست نشده است).

---

## ۳) گیتِ کاملِ موج (`check-wave`)

```bash
python3 -m authoring.agent.cli check-wave \
  --candidate /tmp/khshab_quarantine/KH-G2-MATH_v1.2_dryrun.xlsx \
  --base authoring/khshab-G2-MATH_v0.5.xlsx \
  --official authoring/khshab-G2-MATH_v0.5.xlsx
```

خروجی دو گیتِ **جدا** را گزارش می‌کند و هرگز با هم ادغام نمی‌شوند:

- `achilles_evidence` — گیتِ هلوسه: سبزِ بی‌شاهد = `FAIL`.
  `PASS/ACHILLES_NO_LEDGER_BUT_NO_GREEN_RISK` یعنی «سبزِ پرخطر نیست»،
  **نه** «همهٔ صفحه‌ها بررسی شده‌اند».
- `achilles_coverage` — گیتِ پوشش: `rows_with_evidence` / `rows_without_evidence` /
  `rows_mismatch` / `coverage_ratio` به‌صورت عددی؛ ردیفِ بی‌شاهد **زرد می‌ماند**.

---

## ۴) گیتِ پوششِ شاهد و اتصال به منبعِ واقعی (`coverage`)

```bash
python3 -m authoring.agent.cli coverage \
  --cartridge authoring/khshab-G2-MATH_v0.5.xlsx \
  --observation authoring/agent/fixtures/observation_C205.json \
  --book-manifest authoring/agent/fixtures/book_manifest_C205.json \
  --pagemap authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx \
  --expected-book-code C205
```

با PDFِ واقعیِ ورودی (خارج از Git، در قرنطینه) — در این حالت SHA-256 خودِ فایل هم
سنجیده می‌شود:

```bash
python3 -m authoring.agent.cli coverage \
  --cartridge authoring/khshab-G2-MATH_v0.5.xlsx \
  --observation authoring/agent/fixtures/observation_C205.json \
  --book-manifest authoring/agent/fixtures/book_manifest_C205.json \
  --pdf /tmp/khshab_secure_vault/C205.pdf \
  --pagemap authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx \
  --expected-book-code C205
```

کدهای `fail-closed` این گیت: `EXPECTED_BOOK_CODE_MISMATCH`،
`MANIFEST_PRINT_SHA_MISMATCH`، `PDF_SHA_MISMATCH`، `SOURCE_PDF_UNAVAILABLE`،
`LEDGER_SOURCE_BINDING_MISMATCH`، `PROVEN_OFFSET_CONFLICT`،
`PAGE_OFFSET_MISMATCH_HALLUCINATION`، `GREEN_ROWS_WITHOUT_EVIDENCE`.

**قفلِ چاپِ کتاب:** برای پایهٔ سوم باید `book_manifest_C305.json` +
`observation_C305.json` + `C305.pdf` (هر سه از همان چاپ) استفاده شود؛ امروز در مخزن
فقط manifest/observation مربوط به `C205` وجود دارد، پس اتصالِ `C305` هنوز
`fail-closed` است.

---

## ۴ب) پیش‌پروازِ ریزربات‌ها (`microbot-preflight`, M13 MVP)

```bash
python3 -m authoring.agent.cli microbot-preflight \
  --expected-book-code C305 \
  --cartridge authoring/khshab-G3-MATH_v0.7.xlsx \
  --pdf /tmp/khshab_secure_vault/C305.pdf \
  --book-manifest /tmp/khshab_secure_vault/book_manifest_C305.json \
  --observation /tmp/khshab_secure_vault/observation_C305.json \
  --pagemap authoring/PAGE-MAP-KH-G3-MATH-v1_verified.xlsx
```

- این MVP M00 (هویت/SHA منبع)، M01 (قرنطینهٔ امن + گاردهای workspace) و M02
  (اعتبارسنجی observation ازپیش‌تولیدشده و source-bound) را اجرا می‌کند.
  تولید observation، OCR/vision و crop در این runner انجام نمی‌شود؛ M03–M12 و
  M14–M16 صریحاً `NOT_RUN` می‌مانند.
- PDF باید بیرون از درخت Git باشد و دایرکتوری قرنطینه و خود PDF نباید مجوز
  خواندن/نوشتن برای group/other داشته باشند (معمولاً دایرکتوری `0700` و PDF `0600`).
  runner مجوزها را تغییر نمی‌دهد؛ مورد ناامن را رد می‌کند.
- `G_ACHILLES_COVERAGE` گیت تکمیلیِ مستقل است، نه M02. بدون PDF/manifest، M00
  `BLOCKED` می‌شود؛ بدون observation، M02 `BLOCKED` و گیت پوشش `WARN/UNKNOWN` است.
  هیچ‌کدام به PASS ارتقا داده نمی‌شود.
- هر bot envelope نسخه‌دار دارد: `run_id`, `bot_version`, branch/commit، edition،
  hash ورودی‌ها، evidence refs، `requires_human` و `skipped`. run-id برای ورودی و کد
  یکسان پایدار است؛ observation متن/تصویر در گزارش بازنشر نمی‌شود.
- اجرای عادی فقط JSON را روی stdout می‌دهد و فایل، شبکه، verdict، commit، push،
  official-head یا candidate نمی‌سازد/تغییر نمی‌دهد. سقف packet مشاهده ۵۰ MiB و سقف
  رکوردها ۱۰۰٬۰۰۰ است. DAG محدود با حداکثر ۲ worker اجرا می‌شود؛ در POSIX/fork سقف
  زمان دیواری هر گره ۳۰ ثانیه است. بدون `fork`، fallback thread است و timeout سخت
  غیرفعال گزارش می‌شود.
- checkpoint اختیاری است: برای شروع از `--checkpoint /absolute/private/path.json` و
  برای ادامه از `--resume-checkpoint /absolute/private/path.json` استفاده کن. پوشه باید
  از قبل وجود داشته و خصوصی (معمولاً `0700`) باشد؛ فایل checkpoint با `0600` نوشته
  می‌شود، بیرون Git می‌ماند و هیچ مجوزی خودکار تغییر نمی‌کند. این قابلیت فعلاً فقط
  روی POSIX فعال است. resume فقط با تطبیق hash/مسیر ورودی‌ها، mode و مالک PDF/vault،
  hash کد/config، runtime (Python و وابستگی‌ها)، branch/commit، وضعیت worktree و DAG
  پذیرفته می‌شود؛ مورد نامطابق رد می‌شود. `scheduler.checkpoint_resume_enabled` انتخاب
  این حالت و `side_effects.writes_checkpoint` تغییر واقعی فایل را گزارش می‌کنند؛ resume
  کاملِ بی‌نیاز از اجرای گره، فایل را دوباره نمی‌نویسد. retry خودکار پیاده نیست و هیچ
  شکست پنهانی دوباره اجرا نمی‌شود.
- کد خروج: `0=PASS` فنیِ همین preflight، `1=WARN`، `2=BLOCKED`، `3=FAIL`.
  حتی `PASS` هم مجوز candidate، مُهر انسانی یا release نیست.

---

## ۴پ) گیتِ محدودهٔ مفهومی (`concept-scope-audit`, M05 فنی)

```bash
python3 -m authoring.agent.cli concept-scope-audit \
  --repo-root /home/user/math-game \
  --pdf /tmp/khshab_secure_vault/BOOK.pdf \
  --book-manifest /tmp/khshab_secure_vault/book_manifest.json \
  --scope-profile /tmp/khshab_secure_vault/scope_profile.json \
  --pass-a /tmp/khshab_secure_vault/concept_pass_a.json \
  --pass-b /tmp/khshab_secure_vault/concept_pass_b.json
```

- profile باید با `book_code`، `manifest_id`، SHA باینری PDF و SHA همان manifest مقید باشد؛ محدودهٔ فصل از خود manifest مشتق می‌شود، نه از تعداد صفحهٔ کتاب دیگر. حداقل فهرست‌های هدفِ مجاز شامل objective ID، مفهوم اصلی، عملیات اصلی و دامنهٔ عددی است؛ این کد اختیار یا تأیید انسانیِ profile را احراز نمی‌کند.
- این فرمان دو packet ازپیش‌ساخته را مقایسه می‌کند؛ هر packet باید `profile_sha256` همان profile، هویتِ جداگانهٔ reader/model، همهٔ صفحه‌های موردانتظار، شمارهٔ چاپیِ مشاهده‌شدهٔ هر صفحه و دفتر شاهدِ متصل به چاپ را داشته باشد. شماره‌ها باید با offset/نگاشت manifest بخوانند؛ metric `offset_pages_matched` این را جدا از scope گزارش می‌کند. **مدل را اجرا نمی‌کند، observation/OCR تولید نمی‌کند و Drive را نمی‌خواند**. PDF را فقط برای شمارش صفحه، hash پیکسلیِ صفحه/ناحیه و تطبیق text bbox با وجود متنِ همان ناحیه، در حافظه باز می‌کند؛ متن، تصویر یا crop روی دیسک نمی‌نویسد.
- PDF و هر دو packet خوانش باید بیرون Git بمانند؛ profile/pass نیز نباید فیلد متن خام، OCR، نقل‌قول یا payload/مسیر تصویر داشته باشند. کلیدهای شناخته‌شدهٔ حساس و هر رشتهٔ بیش از ۱۰ واژه `BLOCKED` می‌شوند و مقدار محتوا در گزارش بازتاب داده نمی‌شود. `pdf_text_bbox` برای شمارهٔ چاپی با text layer خود PDF سنجیده می‌شود؛ crop تصویری فقط hash ناحیه را به PDF می‌بندد و OCR/خواندن عدد را اثبات نمی‌کند. دو-reader بودن نیز رمزنگارانه اثبات نمی‌شود.
- صفحهٔ غایب، نگاشت چاپ/PDF ناسازگار، شاهدِ بی‌اتصال، خوانش ناقص، تصویر اسکن‌نشده، confidence ناکافی یا اختلاف دو خواننده ⇒ `BLOCKED`؛ توافق دو خواننده بر مفهوم اصلیِ خارج از محدوده ⇒ `FAIL`.
- `PASS` فقط می‌گوید دو packetِ ارائه‌شده از نظر فنی با profile سازگارند. این فرمان استقلال واقعی مدل‌ها یا اختیار profile را رمزنگارانه اثبات نمی‌کند و هیچ ردیف/رنگ/مُهر Excel را تغییر نمی‌دهد؛ `candidate_ready=false` و `release_authorized=false` می‌ماند.
- مفاهیم پشتیبان مانند جمع تکراری می‌توانند با نقش `SUPPORTING` بمانند و به‌تنهایی هدف اصلیِ خارج‌ازمحدوده محسوب نمی‌شوند. این فرمان در وضعیت فعلی به‌تنهایی خوانش دوگانه تولید نمی‌کند.

---

## ۴ت) ثبتِ نسخه‌دارِ زنجیرهٔ محتوا در GitHub

در شروع هر منبع، metadata و artifactهای ساختاریافته در مخزن ثبت می‌شوند؛ PDF اصلی با locator خصوصی و SHA معرفی می‌شود، نه با کپی‌کردن binary آن در Git. برای اجرای آزمایشیِ آفلاین از fixture ساختگی زیر استفاده کن:

```bash
python3 -m authoring.agent.cli content-pipeline-audit \
  --repo-root . \
  --source-record authoring/agent/fixtures/content_pipeline_synthetic/source.json \
  --extraction-ledger authoring/agent/fixtures/content_pipeline_synthetic/extraction.json \
  --valuation-bundle authoring/agent/fixtures/content_pipeline_synthetic/valuation.json \
  --game-pack authoring/agent/fixtures/content_pipeline_synthetic/game-pack.json
```

دفتر JSON استخراج منبع canonical است؛ برای ساخت snapshot تازهٔ Excel (فقط در مسیر جدید و بدون overwrite):

```bash
python3 -m authoring.agent.cli export-extraction-xlsx \
  --repo-root . \
  --source-record authoring/agent/fixtures/content_pipeline_synthetic/source.json \
  --extraction-ledger authoring/agent/fixtures/content_pipeline_synthetic/extraction.json \
  --output authoring/content/extraction_SYNTH.xlsx
```

- `source`, `manifest`, `offset-proof`, `extraction`, `valuation` و `game-pack` باید فایل‌های نسخه‌دار داخل مخزن باشند و هر مرحله به SHA منبع/مرحلهٔ قبل وصل باشد. برای `rights_status=AUTHORIZED`، `content-pipeline-audit` و exporter علاوه بر آن `--source-pdf` را از قرنطینهٔ خارج Git می‌خواهند و SHA، اندازه و شمار صفحه را با manifest می‌سنجند؛ fixture مصنوعی از این الزامِ باینری مستثناست. در نتیجه PR تاریخچهٔ منبع، استخراج صفحه‌ای، objective map و game draft را کنار هم دارد.
- دفتر استخراج، شناسه‌ها، صفحات PDF/چاپ، وضعیت خوانش، concept/operation/domain IDs، ارجاع‌ها و hash شاهدها را نگه می‌دارد. فقط excerpt کوتاهِ مجاز (حداکثر ۱۰ واژه) می‌تواند در آن باشد؛ تصویر/crop/PDF و متن خام بلند وارد Git نمی‌شوند.
- `export-extraction-xlsx` فقط workbook تازه می‌سازد؛ sheet «ردیابی» SHA دفتر JSON/offset-proof/source را نشان می‌دهد و sidecar SHA برای خود workbook نوشته می‌شود. فایل موجود overwrite نمی‌شود؛ workbook رسمی، PAGE-MAP موجود یا رنگ سلولی تغییر نمی‌کند.
- `content-pipeline-audit` صرفاً trace و اتصال را می‌سنجد. game item بدون رکورد `HUMAN_APPROVED` و referenceِ ledger با metadata سازگار با governance `BLOCKED` می‌شود. audit توکن را نمی‌خواند و هویت را رمزنگارانه دوباره احراز نمی‌کند؛ احراز سمتِ سرور فقط در مسیر ثبت حکم انجام می‌شود. حتی PASS مجوز release نیست؛ حقوق نامشخص/محدود یا offset اثبات‌نشده جلوی انتقال به بخش ۳ را می‌گیرد.
- passهای خصوصی M05 و منبع PDF/crop همچنان بیرون Git می‌مانند؛ report و رکورد ساختاریافتهٔ مجازِ حاصل می‌توانند در PR نسخه‌دار شوند. این گیت هیچ حکم انسانی تولید نمی‌کند.

---

## ۵) آشتی‌دهیِ چانک‌ها (`reconcile-chunks`)

```bash
python3 -m authoring.agent.cli reconcile-chunks \
  --chunks-dir authoring/page-map-chunks-g3 \
  --output /tmp/khshab_quarantine/reconcile_g3.json
```

- توافقِ دو خواننده **بدون** شاهد هرگز `EVIDENCE_MATCHED` نمی‌شود
  (`UNVERIFIED_AGREEMENT_PROMOTION_FORBIDDEN`).

---

## ۵ب) گامِ صفرِ هر کتابِ تازه و شمارشِ ماشینیِ شکل‌ها

```bash
python3 -m authoring.agent.cli init-book \
  --pdf /tmp/khshab_secure_vault/C205.pdf \
  --out /tmp/khshab_quarantine/chunk_plan_C205.json \
  --max-pages 12 --overlap 2 --lanes 4
```

```bash
python3 -m authoring.agent.cli count-items \
  --pdf /tmp/khshab_secure_vault/C205.pdf \
  --page 63 \
  --bbox 70,120,520,640
```

```bash
python3 -m authoring.agent.cli audit --repo-root .
```

- `init-book` آفستِ پالیندرومیِ «صفحهٔ چاپی ↔ صفحهٔ PDF» را کشف می‌کند؛ همان آفست
  بعداً در گیتِ پوشش به‌عنوان `proven_offset` سنجیده می‌شود.
- `count-items` فقط روی PDFِ قرنطینه (خارج از Git) اجرا می‌شود؛ خروجیِ آن
  `quality_scores` و `claims` برای دفترِ شاهد است، نه مجوزِ سبزکردنِ ردیف.

---

## ۶) مشاهدهٔ PDF (کتابخانه، نه CLI)

```bash
python3 - <<'PY'
from pathlib import Path
from authoring.agent.observation import observe_pdf
res = observe_pdf(
    manifest_path=Path("authoring/agent/fixtures/book_manifest_C205.json"),
    pdf_path=Path("/tmp/khshab_secure_vault/C205.pdf"),
    vault_dir=Path("/tmp/khshab_counting_vault"),
)
print(res["status"], res.get("source_pdf_sha256"), len(res.get("quality_scores", [])))
PY
```

- `manifest_path`، `pdf_path` و `book_code` باید **یک کتاب/یک چاپ** باشند.
- کراپ‌ها فقط در `/tmp` (قرنطینه) ساخته می‌شوند؛ هیچ PDF یا تصویری وارد Git نمی‌شود.

---

## ۷) میز کارِ معلم (`serve-viewer`) — امن و پیش‌فرضِ بسته

پیش از اجرا، توکن را **خارج از Git** تنظیم کنید (هیچ توکنِ پیش‌فرضِ قابلِ حدسی وجود ندارد):

```bash
export KHSHAB_TEACHER_TOKEN="$(openssl rand -hex 24)"
python3 -m authoring.agent.cli serve-viewer \
  --pdf /tmp/khshab_secure_vault/C205.pdf \
  --book-manifest authoring/agent/fixtures/book_manifest_C205.json \
  --pagemap authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx \
  --cartridge authoring/khshab-G2-MATH_v0.5.xlsx \
  --verdicts-path authoring/audit/verdicts_C205.json \
  --host 127.0.0.1 \
  --port 8765
```

- پیش‌فرضِ `--host` روی `127.0.0.1` است؛ `0.0.0.0` فقط با توکنِ صریح و فایروال.
- اگر توکن پیکربندی نشده باشد، همهٔ حکم‌های تأییدی با `403
  TEACHER_TOKEN_INVALID_OR_MISSING` رد می‌شوند (حتی با `actor_role=human_teacher`).

ثبتِ امضا از راهِ HTTP (فقط با توکنِ سمتِ سرور):

```bash
curl -sS -X POST http://127.0.0.1:8765/api/verdict \
  -H "Content-Type: application/json" \
  -H "X-Teacher-Token: $KHSHAB_TEACHER_TOKEN" \
  -d '{"scope":"ROW_APPROVED","actor":"استاد راهنما","target_ids":["L-401"]}'
```

---

## ۸) ثبتِ حکم از راهِ CLI (`record-verdict`)

```bash
printf '%s' "$KHSHAB_TEACHER_TOKEN" > /tmp/khshab_quarantine/teacher_token.txt
python3 -m authoring.agent.cli record-verdict \
  --verdict-id TV-0001 \
  --scope ROW_APPROVED \
  --actor "استاد راهنما" \
  --target-ids L-401 \
  --target-file authoring/khshab-G2-MATH_v0.5.xlsx \
  --teacher-token-file /tmp/khshab_quarantine/teacher_token.txt \
  --notes "بررسیِ دستیِ ردیف با شاهدِ کراپ"
```

- بدون `--teacher-token-file` (یا `KHSHAB_TEACHER_TOKEN`) خروجی
  `TEACHER_TOKEN_*` و کدِ بازگشتیِ `2` است: **رشتهٔ `--actor-role` به‌تنهایی
  رأیِ انسانیِ معتبر نمی‌سازد**.
- فایلِ توکن هرگز در Git نیست: `authoring/audit/teacher_token.txt` در `.gitignore` است.

---

## ۹) اجرای شبانه (`autopilot`) — بدون push خودکار

```bash
python3 -m authoring.agent.cli autopilot \
  --repo-root . \
  --official-ref-root /tmp/v103_ref \
  --state-dir /tmp/khshab_autopilot_state \
  --target-waves authoring/agent/fixtures/wave_spec_G2_v12_incremental.json \
  --max-heal-rounds 3 \
  --morning-report /tmp/khshab_quarantine/MORNING-REPORT.fa.md
```

- **`--approve-once` فقط «اجازهٔ اجرای فنیِ محدود» است**
  (`permission_scope=TECHNICAL_EXECUTION_ONLY`)؛ نه رضایتِ احرازشدهٔ مالک،
  نه رأیِ معلم و نه اجازهٔ انتشار. در گزارش صبحگاهی این مرز صریحاً ثبت می‌شود:
  `teacher_verdict_required=True` و `release_authorization=NOT_GRANTED`.
- `--git-push` و `--pr-number` **اختیاری و خاموش‌اند**؛ در چرخهٔ جاری هرگز
  خودکار اجرا نمی‌شوند (زمان و اعلامِ نهایی فقط با مالک است).
- قانونِ `Wave 5 Hold`: اگر `OFFICIAL-HEADS.json` برای `KH-G2-MATH` یادداشتِ
  «در انتظار مُهر معلم» داشته باشد، موج با
  `HELD_AWAITING_TEACHER_STAMP_AND_WAVE_AUTHORIZATION` نگه داشته می‌شود و
  `PASS` شمرده نمی‌شود.

---

## ۹ب) بستهٔ دسترسیِ ماشین‌خوان برای مدلِ مادر (`handoff-index`)

به‌جایِ ردوبدل‌کردنِ توضیحات در چت، فهرستِ دقیقِ موتور (ماژول‌ها + SHA-256 +
APIهایِ عمومی + زیرفرمان‌های CLI + گیت‌ها + کدهای `fail-closed` + سرهای رسمی +
مرزهای مجوز) مستقیماً از کد تولید و در مخزن منتشر می‌شود:

```bash
python3 -m authoring.agent.cli handoff-index   --repo-root .   --output authoring/MOTHER-AI-INDEX.json   --official-ref-root /tmp/v103_ref
```

- بسته **هیچ** مادهٔ محرمانه‌ای ندارد: PDF، تصویرِ صفحه، کراپ و توکنِ معلم
  هرگز فهرست نمی‌شوند (فقط مسیر + SHA-256ِ فایل‌های غیرمحرمانه).
- بسته **هیچ مجوزی صادر نمی‌کند**؛ `not_granted` همیشه شاملِ
  `TEACHER_VERDICT`، `RELEASE_AUTHORIZATION`، `OFFICIAL_HEAD_CHANGE`،
  `FINALITY_CLAIM`، `AUTO_GREEN_PROMOTION` و `GIT_PUSH_AUTOMATIC` است.
- پس از هر تغییرِ کد، بسته را بازتولید کنید؛ آزمونِ
  `authoring/tests/test_handoff_index.py` کهنه‌شدنِ SHAها را شکار می‌کند.
- گزارشِ تحلیلیِ کامل: `authoring/MOTHER-AI-HANDOFF-v24.fa.md`.

---

## ۱۰) دسترسیِ سریع به وضعیت

```bash
python3 -m authoring.agent.cli heads --verify --repo-root .
python3 -m authoring.agent.cli keyed-diff authoring/khshab-G2-MATH_v0.4_official.xlsx authoring/khshab-G2-MATH_v0.5.xlsx
python3 -m pytest -q
```

- گزارشِ `N passed / M skipped` همیشه باید با **چیدمانِ مخزن**
  (`arena/0eb22280-math-game` یا `v10.3-beta`)، **هش کامیت** و شمارِ دقیقِ
  `passed`/`skipped` اعلام شود.

---

## ۱۱) مرزهایِ ممنوعهٔ همیشگی (§9)

- ادغامِ `v10.3-beta` در `arena/**` (تاریخچه‌های نامرتبط) ممنوع.
- ویرایشِ فایل‌های نرم‌افزاریِ `Z.ai` (`workshop-core.js`، `v10.html`، `src/v10/*`،
  `tools/cartridge-converter/*`، `errors.js`، داشبورد، `cartridges/*.json`) ممنوع.
- تبدیلِ خودکارِ زرد به سبز و هر ادعای «نهایی‌بودن» ممنوع؛ مُهرِ معلم فقط با
  احراز هویتِ سمتِ سرور.
- ورودِ PDF، عکسِ کتاب، کراپِ صفحه یا نقلِ بیش از ۱۰ واژه از کتاب به Git ممنوع.
