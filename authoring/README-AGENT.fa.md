# راهنمای ایجنت اتوماسیون خط تولید محتوا (`khshab-agent`)

- **همگام با کامیت رسمی مرجع:** `f36533b9d7dc3de320a532cb271e029affc7694d` (شاخهٔ `v10.3-beta` — شامل کامیت‌های `332dcfc`، `f8706b2` و `f36533b`)
- **پوشهٔ رسمی فیکسچرهای غیرمحرمانهٔ تست (`B2`):** `authoring/agent/fixtures/`
- **تطبیق مسیر دوگانه (`tests/conftest.py` و `authoring/agent/paths.py`):** اولویت اول با مسیر رسمی `public/math-game/authoring/` است و برای فایل‌های محرمانهٔ PDF در CI از `pytest.skip(reason=...)` صریح استفاده می‌شود.
- **منبع واحد حقیقت مبدل (`B1`):** اجرای مستقیم `tools/cartridge-converter/convert.mjs` + `public/math-game/src/v10/station/{cartridge-schema.js,errors.js}` بدون هیچ کپی موازی (`zai_converter_mirror` به طور کامل حذف شده است).
- **مشتق‌سازی خودکار دامنهٔ موج (`B3`):** تابع `derive_wave_scope_from_diff` شناسه‌های سؤال و درس‌های افزوده‌شدهٔ هر موج در هر پایه (`G1..G6`) را مستقیماً از `diff_workbooks_by_key` استخراج می‌کند (صفر هاردکد `Q-1069`).

---

## دستورات خط فرمان (`CLI`)

```bash
# ۱. کشف خودکار آفست پالیندرومی و برنامهٔ چانک <=۱۲ صفحه با هم‌پوشانی ۲ صفحه برای هر کتاب PDF جدید
python3 -m authoring.agent.cli init-book --pdf /path/to/C305.pdf --out /tmp/chunk_plan_C305.json

# ۲. دیف کلیدمحور سلول‌به‌سلول بر پایهٔ ستون A بین هر دو نسخهٔ اکسل
python3 -m authoring.agent.cli keyed-diff \
  public/math-game/authoring/khshab-G2-MATH_v0.4.xlsx \
  authoring/khshab-G2-MATH_v0.5.xlsx

# ۳. بررسی کامل هر موج در هر پایه (G1..G6)
python3 -m authoring.agent.cli check-wave \
  --candidate authoring/khshab-G2-MATH_v0.5.xlsx \
  --base public/math-game/authoring/khshab-G2-MATH_v0.4.xlsx \
  --official public/math-game/authoring/khshab-G2-MATH_v0.3.1.xlsx

# ۴. اجرای مجموعهٔ تست‌های قابل‌حمل در چیدمان رسمی v10.3-beta یا CI
python3 -m pytest tests/test_authoring_pipeline.py -v
```
