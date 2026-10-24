# Fixture مصنوعی pipeline محتوا

این پوشه فقط برای آزمون آفلاین قراردادهای `source → offset-proof → extraction → valuation → game draft` است.

- کتاب، چاپ، PDF، راهنمای معلم و شناسه‌های این پوشه همگی ساختگی‌اند؛ `manifest.json` هم فقط metadata ساختگی دارد و هیچ متن واقعیِ آموزشی استفاده نشده است.
- `rights_status` و proof عمداً `SYNTHETIC_TEST_ONLY` هستند؛ این وضعیت هرگز برای بخش ۳ واجد شرایط نیست.
- proof برای دو صفحهٔ فرضی، دو hash pass ساختگی و anchor شمارهٔ چاپی دارد؛ hashها شاهدِ اجرای دو خوانندهٔ واقعی نیستند.
- `game-pack.json` خالی است؛ هیچ آیتم یا تأیید انسانی ساخته نشده است.
- این fixture مجوز اجرای PDF، اتصال به Drive، تولید محتوای آموزشی، تغییر workbook رسمی، مهر معلم یا release نمی‌دهد.
- PDF و تصویر/کراپ در این پوشه نیستند. `source.json` فقط یک locator ساختگیِ بیرون‌مخزن را نشان می‌دهد.

اجرای audit از ریشهٔ مخزن:

```bash
python3 -m authoring.agent.cli content-pipeline-audit \
  --repo-root . \
  --source-record authoring/agent/fixtures/content_pipeline_synthetic/source.json \
  --extraction-ledger authoring/agent/fixtures/content_pipeline_synthetic/extraction.json \
  --valuation-bundle authoring/agent/fixtures/content_pipeline_synthetic/valuation.json \
  --game-pack authoring/agent/fixtures/content_pipeline_synthetic/game-pack.json
```

`PASS` در این fixture فقط self-consistency فنی را نشان می‌دهد؛ `section3_input_eligible` و `section3_release_authorized` باید `false` بمانند.
