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
