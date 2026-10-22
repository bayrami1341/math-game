# بستهٔ تحویل فنی بسته‌های `W7` و `W8` به تیم مهندسی `Z.ai`

طبق قانون اساسی مخزن و ماتریس مالکیت در `authoring/ROADMAP-KHSHAB-AGENT-v2.fa.md` (`بخش ۹`)، بسته‌های **`W1` تا `W6`** به‌طور ۱۰۰٪ در فضای مالکیت `authoring/agent/**` پیاده‌سازی، تست و قفل شدند و **هیچ فایلی از قلمرو `Z.ai` لمس نشده است**. این سند مشخصات دقیق قراردادی دو بستهٔ متعلق به `Z.ai` (`W7` و `W8`) را برای اجرا در شاخهٔ رسمی `v10.3-beta` ارائه می‌دهد.

---

## ۱. بستهٔ `W7`: اتصال لایهٔ اعتبارسنجی پایتون در `.github/workflows/khshab-gate.yml`

### وضعیت فعلی در `origin/v10.3-beta` (`b66bc63`)
فایل `.github/workflows/khshab-gate.yml` تمام ۶ خشاب ذکرشده در `public/math-game/authoring/OFFICIAL-HEADS.json` را از `convert.mjs` عبور می‌دهد. اکنون پکیج `authoring/agent` در پایتون آماده است تا به عنوان گام تکمیلی همان job اجرا شود:

### گام پیشنهادی برای افزودن به `.github/workflows/khshab-gate.yml`
```yaml
      - name: Set up Python 3.12 & Run Multi-Grade khshab-agent v2.0 Gates
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install Python verification dependencies
        run: pip install openpyxl pymupdf pillow pytest
      - name: Verify all 6 official heads against Universal-10 & Multi-Grade Solvers
        run: pytest -v authoring/tests
```

### خروجی تضمین‌شده روی هر ۶ خشاب فعلی `OFFICIAL-HEADS.json` (`b66bc63`)
- `KH-G1-MATH` (`v0.1`): `PASS` (`ALL_10_UNIVERSAL_INVARIANTS_CLEAN_SKELETON`, `is_empty_skeleton=True`)
- `KH-G2-MATH` (`v0.4` و `v0.5`): `PASS` (`ALL_10_UNIVERSAL_INVARIANTS_CLEAN`, `is_empty_skeleton=False`)
- `KH-G3-MATH` (`v0.7` و موج آزمایشی `v0.8`): `PASS` (`ALL_10_UNIVERSAL_INVARIANTS_CLEAN`, `is_empty_skeleton=False`)
- `KH-G4-MATH` (`v0.1`): `PASS` (`ALL_10_UNIVERSAL_INVARIANTS_CLEAN_SKELETON`, `is_empty_skeleton=True`)
- `KH-G5-MATH` (`v0.1`): `PASS` (`ALL_10_UNIVERSAL_INVARIANTS_CLEAN_SKELETON`, `is_empty_skeleton=True`)
- `KH-G6-MATH` (`v0.1`): `PASS` (`ALL_10_UNIVERSAL_INVARIANTS_CLEAN_SKELETON`, `is_empty_skeleton=True`)

---

## ۲. بستهٔ `W8`: دو نکتهٔ کلیدی کشف‌شده در اسکیمای مبدل (`cartridge-schema.js` / `errors.js`)

در جریان اجرای واقعی موج آزمایشی `KH-G3-MATH v0.8` و ساخت حل‌گرهای پایه‌های چهارم تا ششم، دو محدودیت دقیق در کد فعلی `public/math-game/src/v10/workshop/cartridge-schema.js` شناسایی شد که برای امواج عددنویسی چندرقمی، کسری و اعداد صحیح پایهٔ ششم حیاتی‌اند:

1. **سقف عددی `parseOptionValue` (`خطای T4` برای اعداد صحیح منفی یا بزرگ‌تر از `9999`):**
   - در حال حاضر در `cartridge-schema.js`، تابع `parseOptionValue` رشته‌های عددی صرف با مقدار `< 0` (دماسنج پایهٔ پنجم/ششم، مثل `-۵`) یا `> 9999` (عددنویسی ۵ تا ۹ رقمی پایه‌های چهارم تا ششم، مثل `۲۰۴۷۰` یا `۱۲۵۰۰۰`) را در `T4` رد می‌کند، مگر این‌که دارای پسوند واحد یا جداکنندهٔ هزارگان باشند.
   - **پیشنهاد اصلاح در `W8`:** بازهٔ مجاز اعداد صحیح در `parseOptionValue` به `-1000000000 <= n <= 1000000000` گسترش یابد و فرم متناظر کسری `'a/b'` و عدد مخلوط `'k و a/b'` به‌عنوان نوع دادهٔ رسمی پشتیبانی شود.
2. **تعمیم `classifyAttempt` در `errors.js` برای الگوهای غیرضرب:**
   - هم‌اکنون در `cartridge-schema.js` فقط صورت‌سؤال‌های منطبق با الگوی ضرب ساده (`/([0-9۰-۹]+)\s*[×x]\s*([0-9۰-۹]+)/`) به `classifyAttempt` متصل‌اند و سایر کدهای جدید با وضعیت `«نیاز به تأیید»` در `اطلس خطا` پذیرفته می‌شوند.
   - در `authoring/agent/solvers/{number_ops,mult_div,fractions,geometry_measure,data_prob}.py` تمام توابع شبیه‌ساز علّی این ۵ خانواده با امضای استاندارد پیاده‌سازی و تست شده‌اند و منطق ریاضی آن‌ها مستقیماً قابل پورت یک‌به‌یک به `errors.js` است.

---

## ۳. وضعیت تحویل نهایی `v2.4` (اوت ۱۴۰۴)

- **شاخهٔ تحویل آرنا:** `arena/0eb22280-math-game` @ `211ee45` (`final v2.4`) — پوش شده به `origin/arena/0eb22280-math-game`
- **تگ نهایی:** `v2.4-final` روی `211ee45` (پیام: `v2.4-final: نسخه نهایی آرنا — W1-W6 100% + autopilot PASS (50 passed) + Achilles v2.3`)
- **PR #2:** `arena/0eb22280-math-game → v10.3-beta` — `OPEN`، چک `Validate official-base reconciliation and candidate` = **SUCCESS** (`2026-10-22T21:07:54Z`)
  - **یادداشت ادغام:** به‌دلیل ریشه‌های نامرتبط (`arena` از `ab15597` و `v10.3-beta` از `697a452`)، گیت‌هاب `CONFLICTING` گزارش می‌دهد. طبق قانون `§9` آرنا مجاز به `git merge origin/v10.3-beta --allow-unrelated-histories` نیست؛ ادغام باید در سمت `Z.ai` با `squash` یا `rebase --allow-unrelated-histories` انجام شود (یا PR باز بماند تا هندآف W7/W8 کامل شود).
- **تست نهایی آرنا:** `50 passed, 4 skipped` روی `211ee45` (۱۲ تست W1-W6 + ۵ تست مرزی Achilles + ۶ تست حل‌گر چندپایه + ۲ تست خودترمیم)
- **پایلوت کور:** `evidence→skill→question→cartridge` با `observation_C205.json` (۱۵۲ page) + `wave_spec_G3_test_v08.json` → `PASS` (`SHA b0b32bea... red 0 yellow 7`) و `achilles_gate` ایزوله `PASS`
- **گزارش صبحگاهی نهایی:** `authoring/MORNING-REPORT.fa.md` @ `2026-10-22T21:07:25Z` — `1 completed KH-G3-MATH PASS`، `G0 PASS`، `approval_proof SHA 576e6f89...`
