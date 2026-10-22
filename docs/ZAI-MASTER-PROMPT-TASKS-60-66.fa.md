# پرامپت جامع و گام‌به‌گام برای دستیار اصلی پروژه (`Z.ai` — شاخهٔ `v10.3-beta`، تسک‌های ۶۰ تا ۶۶)

> **راهنمای استفاده برای مالک پروژه:** کل بلوک زیر را بدون نیاز به هیچ ویرایشی کپی کنید و مستقیماً به دستیار اصلی پروژه در **`Z.ai`** بدهید. تمام نام شاخه‌ها، هش‌های `SHA-256`، شمارهٔ تسک‌ها (`Task 60` به بعد در ادامهٔ `Task 59` فایل `worklog.md`) و مسیرهای واقعی مخزن `bayrami1341/math-game` از آخرین کامیت زندهٔ شما (`4aa3654` روی `v10.3-beta`) استخراج و راستی‌آزمایی شده‌اند.

---

```markdown
سلام دستیار اصلی پروژه (Z.ai).

پیرو تقسیم کار رسمی تسک ۵۷ (`download/ARENA-EXPERIENCE-TRANSFER-v1.fa.md`) و تحویل‌های تسک ۵۸ و ۵۹ روی شاخهٔ `v10.3-beta` (`4aa3654`)، تیم آرنا + هماهنگ‌کننده مأموریت ساخت **ایجنت اتوماسیون عمومی خط تولید محتوا (`khshab-agent`)** را به همراه موج ۴ خشاب پایهٔ دوم (`KH-G2-MATH v0.5`) روی شاخهٔ گیت‌هاب زیر تحویل داده است:

- **مخزن:** `bayrami1341/math-game`
- **Pull Request رسمی تحویل در گیت‌هاب:** `https://github.com/bayrami1341/math-game/pull/1` (`PR #1`)
- **شاخهٔ تحویل آرنا / ایجنت اتوماسیون:** `origin/arena/0eb22280-math-game`
- **سند کامل دستور کار در خود مخزن:** `docs/ZAI-MASTER-PROMPT-TASKS-60-66.fa.md`
- **مرز مالکیت رعایت‌شده توسط آرنا (§9):** دقیقاً `۰` تغییر روی تمامی فایل‌های نرم‌افزار شما (`workshop-core.js`, `v10.html`, `src/*`, `tools/*`, `errors.js`, `cartridges/*`).

لطفاً وظایف اختصاصی خودت (قلمرو تیم نرم‌افزار، بازرس دوم، داشبورد معلم، CI و ادغام رسمی) را **به‌ترتیب دقیق گام‌های ۰ تا ۷ زیر** اجرا کن، در پایان هر گام خروجی واقعی فرمان‌های راستی‌آزمایی را گزارش بده و در `worklog.md` (از **Task 60** به بعد) ثبت و روی `origin/v10.3-beta` پوش کن.

---

### گام ۰ (فوری — امنیت حق نشر در ایندکس Git شاخهٔ `v10.3-beta`) — `Task 60-Pre`
در بررسی درخت فعلی `origin/v10.3-beta` (`git ls-tree -r --name-only HEAD`) مشخص شد که پیش از افزودن `.gitignore` در تسک ۵۶، اسکریپت بکاپ خودکار فایل‌های دارای حق نشر و باینری موقت زیر را وارد ایندکس Git کرده و همچنان در ریپو Track هستند:
- `upload/C205-152.pdf`، `upload/C205-2.pdf`، `upload/C205-6.pdf`
- `upload/pasted_image_*.png`، `upload/math_grade3_comprehensive (1).xlsx`
- `tool-results/*.png`، `tool-results/*.txt`
- `db/custom.db` و `.zscripts/dev.pid`

**اقدام الزامی گام ۰:**
1. بدون حذف فایل‌ها از دیسک محلی کانتینرت (`--cached`)، همهٔ مسیرهای بالا را از ایندکس Git پاک کن:
   ```bash
   git rm --cached -r upload/ tool-results/ db/custom.db .zscripts/dev.pid
   ```
2. در `.gitignore` ریشهٔ مخزن، الگوهای `upload/`, `tool-results/`, `db/*.db`, `.zscripts/dev.pid`, `authoring/build_preview/`, `authoring/local_viewer_cache/` را قفل کن.
3. در `scripts/auto-backup.sh` و `scripts/gh-autosave.sh` قبل از هر `git commit` یک گارد fail-closed بگذار که اگر خروجی `git diff --cached --name-only` شامل `.pdf` یا `upload/` بود، کامیت متوقف شود (`exit 1`).
4. **معیار پذیرش گام ۰:** اجرای `git ls-files | grep -E '\.pdf$|^upload/|^tool-results/'` باید دقیقاً **خالی (`0` خط)** برگردد.

---

### گام ۱ — جذب رسمی پکیج ایجنت اتوماسیون عمومی (`khshab-agent`) به مخزن اصلی — `Task 60`
بستهٔ ایجنت پایتونی در شاخهٔ `origin/arena/0eb22280-math-game` کاملاً عمومی و مستقل از پایه ساخته شده و هم روی `KH-G3-MATH_v0.7.xlsx` (`0e678e54…`) و هم روی `KH-G2-MATH_v0.5.xlsx` تست خودکار (`31/31 PASS`) دارد.

**توجه مهم توپولوژی Git:** شاخهٔ `v10.3-beta` (با ساختار Next.js + `public/math-game/`) و شاخه‌های `arena/*` نیای مشترک Git ندارند؛ بنابراین **هرگز `git merge` مستقیم نزن**؛ دقیقاً مثل تسک ۵۸ با `git fetch` و استخراج مسیری تمیز عمل کن:

1. واکشی و نصب ماژول‌های ایجنت در مخزن اصلی:
   ```bash
   git fetch origin arena/0eb22280-math-game
   git checkout FETCH_HEAD -- \
     authoring/agent \
     authoring/README-AGENT.fa.md \
     tests/test_authoring_pipeline.py \
     pyproject.toml
   ```
2. **حذف کپی موقت مبدّل (`Single Source of Truth`):**
   در شاخهٔ آرنا پوشهٔ `authoring/agent/zai_converter_mirror/` صرفاً به‌خاطر نبودن `tools/cartridge-converter/` در شاخهٔ پایهٔ آرنا گذاشته شده بود. در مخزن تو:
   - پوشهٔ `authoring/agent/zai_converter_mirror/` را حذف کن (`rm -rf authoring/agent/zai_converter_mirror`).
   - در `authoring/agent/automation_suite.py` تأیید کن که `run_converter_and_parse_report` مستقیماً به تک‌منبع رسمی مخزن تو (`tools/cartridge-converter/convert.mjs` و ماژول‌های `public/math-game/src/v10/station/{cartridge-schema.js,errors.js}`) متصل است (توجه به مسیر `public/math-game/src/v10/station/` در `v10.3-beta` هنگام اجرای ایزوله در `tmpdir`!).
3. **اجرای زندهٔ هر ۴ فرمان ایجنت روی فایل‌های رسمی خودت:**
   - `python3 -m authoring.agent.cli check-wave --candidate public/math-game/authoring/khshab-G3-MATH_v0.7.xlsx` ⟵ باید `PASS_READY_FOR_SECOND_INSPECTOR` (`red=0, yellow=7`) برگرداند.
   - `python3 -m authoring.agent.cli check-wave --candidate public/math-game/authoring/khshab-G2-MATH_v0.4.xlsx` ⟵ باید `PASS_READY_FOR_SECOND_INSPECTOR` (`red=0, yellow=2`) برگرداند.

---

### گام ۲ — ساخت دروازهٔ خودکار GitHub Actions CI روی هر Push و PR — `Task 61`
فایل `.github/workflows/khshab-gate.yml` را بساز تا از این لحظه هیچ تحویل محتوایی از شاخه‌های `arena/**` یا کامیت روی `v10.3-beta` بدون عبور خودکار از گیت‌های ماشینی پذیرفته نشود:
1. تریگر روی `push` و `pull_request` برای شاخه‌های `v10.3-beta`, `main`, `arena/**`.
2. مراحل Job (کاملاً Fail-Closed):
   - نصب Node 20 + Python 3.11 + `pip install pytest openpyxl pymupdf` + `npm ci`.
   - گارد حق نشر Git (`python3 -c "from authoring.agent.git_guard import check_git_safety; r=check_git_safety('.'); assert r.status=='PASS', r.issues"`).
   - اجرای `python3 -m authoring.agent.cli check-wave` روی تمام فایل‌های `authoring/khshab-*-MATH_v*.xlsx` (به‌جز نسخه‌های آرشیوی پیش از `v0.3.1` که مستنداً باگ تاریخی دارند).
   - اجرای مجموعه تست‌های جاوااسکریپت موتور (`npm test` در `public/math-game`).

---

### گام ۳ — اتصال داشبورد معلم (Next.js) به ایجنت اتوماسیون و گردش‌کار «مُهر سبز معلم» — `Task 62`
در حال حاضر معلم برای دیدن مغایرت‌ها و زدن «مُهر سبز» مجبور به کار دستی با فایل اکسل یا خواندن متن خام گزارش است (که منشأ خطاهای #۷ و #۸ بود). در لایهٔ Next.js (`src/app/api/cartridges/*` و `src/components/dashboard/cartridge-tab.tsx`):
1. یک اندپوینت سرور `POST /api/cartridges/inspect` اضافه کن که `python3 -m authoring.agent.cli check-wave --candidate ... --official ...` را صدا بزند و خروجی JSON ساختاریافتهٔ آن را به UI برگرداند:
   - خلاصهٔ دیف کلیدمحور نسبت به نسخهٔ رسمی (`added_rows`, `changed_cells`, `removed_rows`)
   - وضعیت ۱۶ حادثهٔ تاریخی (`INC-01..INC-16`) و ۳ شاخص بهره‌وری (`% بدون ؟ کاذب`، `% ضد J12`، `% پوشش کد خطا`)
   - لیست ردیف‌های جدید زرد (`نیاز به تأیید`) با شمارهٔ صفحهٔ چاپی کتاب درسی برای بازبینی فیزیکی سریع معلم!
2. قابلیت **«ثبت حکم معلم (تأیید ردیف‌به‌ردیف زرد ← سبز)»** در داشبورد اضافه کن که با قفل `SHA-256` (`GovernanceLedger`) ردیف‌های تأییدشده توسط معلم را در نسخهٔ رسمی بعدی سبز کند و خودکار `convert.mjs` را اجرا نماید.

---

### گام ۴ — تکمیل آشکارسازهای کد خطای پیشنهادی در `errors-v103.js` (حفظ خلوص `errors.js`) — `Task 63`
طبق قانون معماری خودت، `public/math-game/src/v10/station/errors.js` منجمد و دست‌نخوردنی است و توسعهٔ کدها در ماژول افزودنی `errors-v103.js` / `errors-g2.js` انجام می‌شود. در حال حاضر کدهای پرتکرار زیر در خشاب‌های `G2` و `G3` با برچسب `(پیشنهاد)` ثبت شده‌اند:
- `E_ROUND_NEAREST` (گرد کردن به ده‌تایی/صدتایی نزدیک به‌جای پاسخ دقیق یا برعکس در تقریب فصل ۲ و ۴)
- `E_UNIT_VALUE_CONFUSION` (خلط رقم و ارزش مکانی؛ مثل نوشتن `۸` به‌جای `۸۰۰` در `۸۰۹`، یا جمع تعداد سکه‌ها `۳+۴=۷` به‌جای ارزش ریالی `۳۴۰`)
- `E_APPROX_EXACT_CONFUSION` (محاسبهٔ دقیق به‌جای تقریب یا برعکس)

**اقدام الزامی گام ۴:**
1. توابع آشکارساز عددی Pure (بدون هیچ وابستگی به DOM/FS، دقیقاً مطابق قرارداد `CODES_V103` و `CODE_SENTENCES_V103`) و جمله‌های تشخیصی مهربانانهٔ کارت معلم را برای این ۳ کد در `public/math-game/src/v10/station/errors-v103.js` پیاده کن.
2. تست‌های واحد کامل (مرزی، دامنهٔ `0..9999`، عدم تداخل اولویت `PRIORITY_V103`) را در `public/math-game/tests/v10.3-cartridge.test.js` اضافه کن و `npm test` را ۱۰۰٪ سبز نگه دار.

---

### گام ۵ — ساخت موتور رندر SVG پارامتریک برای ۱۴ مدل کاتالوگ `MOTOR-TALIF-KHSHAB-v1` — `Task 64`
در حال حاضر ستون `ساختار تصویر` در شیت S1 و بانک سؤال طبق استاندارد رسمی `MOTOR-TALIF-KHSHAB-v1.md` با گرامر یک‌خطی زیر پر می‌شود:
`نوع: M_XXX؛ <پارامتر=مقدار، ...>؛ رنگ: <...>؛ پرسش: «...»`
اما `public/math-game/src/v10/station/visuals.js` فعلاً فقط ۸ SVG ساختمان‌های ایستگاه را دارد و هنوز پارسر + رندرر SVG زنده برای ۱۴ مدل آموزشی کاتالوگ وجود ندارد:
`M_ARRAY`, `M_GROUPS`, `M_NUMBERLINE`, `M_BUNDLES`, `M_PLACEVALUE`, `M_AREAMODEL`, `M_BARS`, `M_FRACTION`, `M_GEO_SHAPES`, `M_CLOCK_TIME`, `M_BALANCE`, `M_MONEY`, `M_CHART`, `M_PATTERN`.

**اقدام الزامی گام ۵:**
1. ماژول جدید و مستقل `public/math-game/src/v10/station/model-figures.js` را بساز شامل:
   - `parseVisualSpec(specText)` برای پارس قطعی گرامر `نوع: M_XXX؛ ...`
   - `renderModelFigureSVG(parsedSpec)` برای رسم تمیز، RTL و خوانای هر ۱۴ مدل
2. **تضمین ضد باگ تاریخی #۹ (`INC-09`):** تعداد المان‌های گرافیکی رسم‌شده در SVG خروجی باید **به‌طور ریاضی و دقیق برابر پارامتر عددی پارس‌شده** باشد (مثلاً اگر `مثلث=۱۳` یا `صدتایی=۵، ده‌تایی=۷، یکی=۴` است، دقیقاً همان تعداد شکل SVG با کلاس قابل شمارش در تست واحد تولید شود!).
3. اتصال امن به `sheet.js` با Fallback متنی در صورت `—` بودن ستون تصویر + تست واحد شمارش DOM برای هر ۱۴ مدل.

---

### گام ۶ — بازرسی دوم (`§6.6`) و ادغام رسمی موج ۴ خشاب پایهٔ دوم (`KH-G2-MATH v0.5`) — `Task 65`
روی شاخهٔ `origin/arena/0eb22280-math-game`، بستهٔ کامل موج ۴ (فصل ۴ کتاب دوم: اعداد سه‌رقمی، صفحات ۵۵ تا ۷۲ چاپی = `PDF 61..78`) تحویل شده و **مستقیماً روی فایل رسمی تسک ۵۸ تو (`khshab-G2-MATH_v0.4.xlsx`, SHA `a2f610585b4f915f3fe01201b2361d5aa607dd015d6c4d57947556245af52d34`) ساخته شده است**:

- **فایل اکسل موج ۴:** `authoring/khshab-G2-MATH_v0.5.xlsx`
- **هش `SHA-256`:** `f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656`
- **سند تحویل و خودآزمایی ۲۰‌بندی:** `authoring/WAVE4-CH4-KH-G2-MATH-v0.5.fa.md`
- **دیف کلیدمحور نسبت به `v0.4` رسمی تو (`a2f61058…`):**
  - `changed_cell_count = 0` (**صفر تغییر در سلول‌های قبلی و مُهرهای رسمی، از جمله حفظ اصلاح `L-213 = ۳۵−۱۷`**)
  - `removed_row_count = 0`
  - `added_row_count = 44` (`۱۸` درس `L-401..L-418` + `۲` کد اطلس پیشنهادی + `۲۴` سؤال `Q-1069..Q-1092` با نردبان کامل سه‌لایهٔ `CPA` در هر ۶ درس عمیق و توازن دقیق `۶/۶/۶/۶` در موج ۴ و `۲۳/۲۳/۲۳/۲۳` در کل ۹۲ سؤال کتاب!)

**اقدام الزامی گام ۶ (طبق پروتکل همیشگی تسک ۵۸):**
1. فایل و `.sha256` و سند تحویل را از `origin/arena/0eb22280-math-game` استخراج و هش آن را راستی‌آزمایی کن.
2. به‌عنوان **بازرس دوم مستقل (§6.6)**، با خوانش مستقیم از `C205.pdf` (`PDF 61..78`) حداقل ۶ صفحه از ۱۸ صفحهٔ فصل ۴ (به‌ویژه مرزهای سکه‌ها، جدول ارزش مکانی، الگوهای شمارشی و صفحهٔ ۷۲ پنتومینو `L-418`) را نمونه‌گیری کور کن؛ اگر مغایرت چاپی دیدی با ذکر مختصات سلول و شاهد PDF اصلاح و مستند کن.
3. فایل رسمی ادغام‌شده را در `public/math-game/authoring/khshab-G2-MATH_v0.5.xlsx` (+ `.sha256`) بنشان، مبدّل رسمی `tools/cartridge-converter/convert.mjs` را اجرا کن (`۰ قرمز`)، `public/math-game/cartridges/KH-G2-MATH.json` (۶۲ درس / ۱۳ کد اطلس / ۹۲ سؤال) و `download/convert-report-KH-G2-MATH-v0.5.md` را به‌روز کن و تست‌های `npm test` و E2E مرورگری داشبورد + `v10.html` را سبز کن.

---

### گام ۷ — بستهٔ استاندارد تبادل برای سری‌سازی پایه‌های بعدی (`G3`, `G1`, `G4..G6`) — `Task 66`
برای آن‌که از امروز تولید محتوای تمام پایه‌ها بدون کوچک‌ترین اصطکاک یا تکرار خطای #۷ پیش برود:
1. یک فایل مانیفست کوچک `public/math-game/authoring/OFFICIAL-HEADS.json` بساز و بعد از هر ادغام رسمی به‌روز نگه دار که برای هر پایه (`KH-G1-MATH` تا `KH-G6-MATH`) دقیقاً آخرین نسخهٔ رسمی، مسیر فایل و `SHA-256` پایهٔ الزامی موج بعد را اعلام کند.
2. در `khshab-agent check-wave` یک بررسی خودکار به `OFFICIAL-HEADS.json` وصل کن تا اگر هر نویسنده‌ای در آرنا موج جدیدی را روی پایه‌ای با `SHA-256` قدیمی‌تر شروع کرده بود، در همان ثانیهٔ اول با خطای صریح `STALE_OFFICIAL_BASE_INCIDENT_07` متوقف شود!

---

### خطوط قرمز و معیار نهایی تحویل (`Definition of Done`)
- **حفظ تفکیک نقش:** هیچ ردیف زردی بدون حکم صریح معلم سبز نشود (`تأییدشده` فقط با مُهر معلم).
- **گزارش پایانی شفاف:** در پایان کار جدول خلاصهٔ تسک‌های `60-Pre` تا `66` را شامل: (۱) وضعیت پاک‌سازی PDFها از Git، (۲) خروجی `khshab-agent` روی `G2 v0.5` و `G3 v0.7`، (۳) تعداد کل تست‌های سبز `npm test` و `pytest`، و (۴) هش `SHA-256` فایل‌های منتشرشدهٔ جدید ارائه کن.
```
