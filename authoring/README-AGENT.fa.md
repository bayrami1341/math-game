# راهنمای ۱ صفحه‌ای ایجنت اتوماسیون خط تولید محتوا (`khshab-agent`)

این بسته یک **ایجنت عمومی و مستقل از پایه** برای خط تولید هر کتاب درسی (`G1`, `G2`, `G3`, ...) است — نه اسکریپت تک‌منظورهٔ یک پایه.

## چهار فرمان اصلی ایجنت برای هر کتاب و هر پایه

### ۱) شروع هر کتاب جدید (کشف خودکار آفست پالیندرومی + چانک‌بندی `<=12` صفحه با هم‌پوشانی `2`)
```bash
python3 -m authoring.agent.cli init-book \
  --pdf /path/to/quarantined/BOOK.pdf \
  --out authoring/audit/chunk_plan.json
```

### ۲) گیت کامل کنترل هر موج اکسل (دیف کلیدمحور + لیست سفید + حفظ مُهرهای سبز + `convert.mjs` + گزارش تحویل و `SHA-256`)
```bash
python3 -m authoring.agent.cli check-wave \
  --candidate authoring/khshab-GX-MATH_v0.Y.xlsx \
  --base      authoring/khshab-GX-MATH_v0.X.xlsx \
  --official  authoring/khshab-GX-MATH_official.xlsx \
  --report-md authoring/DELIVERY-v0.Y.fa.md
```
اگر خروجی `PASS_READY_FOR_SECOND_INSPECTOR` بود موج اجازهٔ تحویل دارد؛ اگر `FAIL_STOP_WAVE` بود دقیقاً مختصات سلول خطادار چاپ می‌شود و موج متوقف می‌ماند.

### ۳) دیف کلیدمحور مستقل برای بازرس دوم (بدون خطای ناشی از جابه‌جایی ردیف)
```bash
python3 -m authoring.agent.cli keyed-diff old.xlsx new.xlsx
```

### ۴) شمارشگر پیکسلی شکل‌های کتاب (جلوگیری از خطای چشمی مدل‌های زبانی)
```bash
python3 -m authoring.agent.cli count-items \
  --pdf /path/to/quarantined/BOOK.pdf \
  --page 14 --bbox 55,356,520,414
```
