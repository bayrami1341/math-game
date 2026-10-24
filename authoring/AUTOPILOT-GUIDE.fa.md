# راهنمای عملیاتی اجرای خودمختار شبانه (`khshab-autopilot v2.0`)

این راهنما نحوهٔ سپردن اجرای یکسره، خودترمیم‌گر و متصل به GitHub پایپلاین `khshab-agent v2.0` را توضیح می‌دهد تا تنها با **یک فرمان تأیید اولیه (`--approve-once`)** تمام امواج هدف را بسازد، خطاهای ساختاری/نگارشی را ریشه‌ای ترمیم کند، همهٔ گیت‌های ریاضی و مبدل رسمی `convert.mjs` را چک کند، بهداشت کپی‌رایت را بسنجد و نتیجهٔ نهایی و گزارش صبحگاهی را روی GitHub منتشر کند.

---

## ۱. تنظیم متغیرهای محیطی اختیاری (`G.ai` / `Z.ai` / `GitHub`)

پایپلاین به‌صورت پیش‌فرض تمام گیت‌های قطعی پایتون و `convert.mjs` را بدون نیاز به اینترنت خارجی اجرا می‌کند. اگر بخواهید در طول شب از مدل‌های چندوجهی خارجی برای بازخوانی کراپ‌های برداری یا بازنویسی گزینه‌های انحرافی استفاده کند، کلیدها را در محیط شل ست کنید (هیچ کلیدی هرگز در کد یا Git ذخیره نمی‌شود):

```bash
export GEMINI_API_KEY="YOUR_GOOGLE_AI_STUDIO_KEY"   # اتصال مستقیم REST به G.ai (Gemini 2.5 Flash/Pro)
export ZAI_API_KEY="YOUR_ZAI_GLM_API_KEY"           # اتصال مستقیم REST به Z.ai (GLM-4.6V / OpenAI-Compatible)
```

---

## ۲. فرمان اجرای یکسرهٔ شبانه تا پوش به GitHub

```bash
python3 -m authoring.agent.cli autopilot \
  --repo-root . \
  --approve-once \
  --git-sync \
  --git-push \
  --pr-number 1 \
  --morning-report authoring/MORNING-REPORT.fa.md \
  --target-waves \
    authoring/agent/fixtures/wave_spec_G2_ch4_v05.json \
    authoring/agent/fixtures/wave_spec_G3_test_v08.json
```

### چه اتفاقی از لحظهٔ اجرا تا صبح می‌افتد؟
1. **همگام‌سازی اولیه (`GitHubSyncManager`):** شاخه‌های ریموت (`origin`) و آخرین وضعیت `OFFICIAL-HEADS.json` در شاخهٔ رسمی `origin/v10.3-beta` واکشی می‌شوند.
2. **رعایت خودکار قانون توقف موج ۵ (`Wave 5 Hold`):** اگر موج هدف نیازمند پایهٔ `v0.5` باشد ولی در `OFFICIAL-HEADS.json` هنوز نسخهٔ رسمی `0.4` ثبت شده باشد، موج روی پایهٔ کهنه ساخته **نمی‌شود** و با وضعیت شفاف `WAVE5_HELD_AWAITING_ZAI_V05_MERGE` در گزارش صبحگاهی ثبت می‌گردد.
3. **چرخهٔ ساخت، ممیزی ۶ لایه و خودترمیمی ریشه‌ای (`SelfHealingEngine`):**
   - هر موج با `export_wave_cartridge` ساخته می‌شود و هم‌زمان از `G6_WORKBOOK_STRUCTURE`، `G3_ANTI_J12`، `G4_INDEPENDENT_SOLVER`، `G5_DISTRACTOR_CAUSALITY`، ده قانون جهان‌شمول `U-01..U-10` و مبدل رسمی `convert.mjs` عبور می‌کند.
   - اگر باگی رخ دهد، به‌جای دست‌کاری تست‌ها، علت ریشه‌ای ترمیم و دوباره کل زنجیره از صفر راستی‌آزمایی می‌شود:
     - `H1_PERSIAN_ORTHOGRAPHY`: تبدیل ارقام انگلیسی/عربی و `ي/ك` در صورت سؤال، گزینه‌ها و بازخوردها.
     - `H2_BIJECTIVE_T7_ANCHORS`: همگام‌سازی دوسویهٔ ستون ۱۱ شیت `S1` با سؤالات واقعی شیت `بانک سؤالات` (`T7`).
     - `H3_REGISTER_MISSING_ERROR_CODE`: ثبت خودکار کد خطای جدید در `اطلس خطا` با وضعیت صادقانهٔ `«نیاز به تأیید»`.
     - `H4_STRIP_FORGED_GREEN_STAMP`: حذف فوری هر مهر جعلی `«تأیید شده»` از ردیف‌های تولیدی هوش مصنوعی (مهر سبز انحصاراً در اختیار معلم است).
     - `H5_REBALANCE_CHOICE_KEYS`: جایگشت هم‌زمان `(متن گزینه، کد خطا)` برای توازن ۲۵٪ کلیدهای `الف/ب/ج/د`.
     - `H6_REALIGN_SOLVER_KEY`: هم‌ترازسازی کلید صحیح با پاسخ اثبات‌شدهٔ حل‌گر مستقل `G4` یا درخواست بازنویسی از `G.ai`/`Z.ai`.
4. **پاک‌سازی قرنطینه و گیت امنیت مخزن (`G0_OWNERSHIP_AND_HYGIENE`):**
   - تمام کراپ‌های شمارشی موقت `/tmp` پاک می‌شوند.
   - پیش از `git commit / push`، اگر حتی یک فایل متعلق به `Z.ai` (`workshop-core.js`, `v10.html`, `src/v10/*`, `tools/cartridge-converter/*`, `errors.js`, `cartridges/*`) یا هر فایل تصویری/PDF محرمانه در تغییرات باشد، پوش متوقف می‌شود.
5. **ثبت پایدار و گزارش صبحگاهی:** ژورنال چک‌پوینت در `autopilot_state.json` و گزارش خوانای فارسی در `authoring/MORNING-REPORT.fa.md` نوشته و به GitHub پوش می‌شود. اگر اجرا در نیمه‌شب قطع شود، اجرای دوبارهٔ همان فرمان از آخرین موج ناتمام ادامه می‌دهد.

---

## ۳. راه‌اندازی میز کار بصری معلم با ذره‌بین پیکسلی زنده `8x` (`W6`)

برای بررسی بصری صفحات دارای کپسول برداری یا شمارش اشیاء ریز (مثل ص ۱۰۰ و ۱۳۰ پایهٔ سوم) و ثبت امضای قفل‌شده به `SHA-256`:

```bash
python3 -m authoring.agent.cli serve-viewer \
  --repo-root . \
  --pdf /tmp/khshab_secure_vault/C305.pdf \
  --pagemap authoring/PAGE-MAP-KH-G3-MATH-v1_verified.xlsx \
  --cartridge /tmp/khshab-G3-MATH_v0.8.xlsx \
  --verdicts-path authoring/audit/verdicts_C305.json \
  --host 0.0.0.0 --port 8765
```
