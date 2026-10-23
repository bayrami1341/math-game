# بازبینی مصرف‌کنندهٔ نگاشت ۹ سناریوی موتور G2 — نه پذیرش محتوای کتاب

- main ثابت: `8decb334f08cd7cdaddc72f7941c760aa983a1d4`؛ نامزد G2: `18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618`؛ حکم: `HOLD_PINNED_CONTRACT_RECEIPT`.
- CI main نگاشت موتور را اجرا کرده است؛ فایل پاسخ هنوز `@GIT_HEAD@` را به‌جای SHA غیرقابل‌تغییر هر case نگه می‌دارد و `engine_schema_version` را فقط در سطح فایل دارد. این دو شرط reply_contract برای رسیدِ قابل‌مصرف هنوز بسته نشده‌اند. اجرای گیت روی archive بدون `.git` نیز ۱۱/۱۱ پاس شد چون تست producer مقدار `unknown` را مجاز می‌داند؛ پس این تست، pin مستقل نیست.
- پاسخ فنی موتور واقعی‌تر و صادقانه‌تر شده است؛ اما قابلیت موتور با مجوز آموزشی، صحت کتاب یا «کل بازی» یکی نیست. CAP-01/02/03 در حدهای پیش‌نویس G2 بلوکه‌اند؛ CAP-07/09 نیازمند تعامل جدیدند؛ CAP-04/05/08 فقط زیرمجموعهٔ انتخابی/متنی را پوشش می‌دهند؛ CAP-06 بازیپذیر است ولی گیت محور/مقیاس کتاب اینجا اثبات نشده.

| سناریو | گزارش موتور | مصرف مجاز در خط محتوا |
|---|---|---|
| G2-CAP-01 | `SUPPORTED_WITH_LIMITS` | `ENGINE_PARTIAL_BUT_G2_BOOK_LIMITS_BLOCK_AND_BOOK_UNVERIFIED` |
| G2-CAP-02 | `SUPPORTED_WITH_LIMITS` | `ENGINE_PARTIAL_BUT_G2_BOOK_LIMITS_BLOCK_AND_BOOK_UNVERIFIED` |
| G2-CAP-03 | `SUPPORTED_WITH_LIMITS` | `ENGINE_PARTIAL_BUT_G2_BOOK_LIMITS_BLOCK_AND_BOOK_UNVERIFIED` |
| G2-CAP-04 | `SUPPORTED_WITH_LIMITS` | `PARTIAL_INTERACTION_ONLY_BOOK_VARIANTS_UNVERIFIED` |
| G2-CAP-05 | `SUPPORTED_WITH_LIMITS` | `PARTIAL_INTERACTION_ONLY_BOOK_VARIANTS_UNVERIFIED` |
| G2-CAP-06 | `SUPPORTED` | `ENGINE_BAR_CHART_PLAYABLE_AUTHORING_AXIS_SCALE_GATE_NOT_PROVEN` |
| G2-CAP-07 | `NEEDS_IMPLEMENTATION` | `ENGINE_MISSING_REQUESTED_INTERACTION` |
| G2-CAP-08 | `SUPPORTED_WITH_LIMITS` | `PARTIAL_INTERACTION_ONLY_BOOK_VARIANTS_UNVERIFIED` |
| G2-CAP-09 | `NEEDS_IMPLEMENTATION` | `ENGINE_MISSING_REQUESTED_INTERACTION` |

## جداسازی چهار تعارض از تصمیم‌های فوری مالک

- الف `dispatch_count=0`: فقط snapshot یک‌نوبتی آرناست؛ حکم توقف یا ادامهٔ دیسپچ blueprint از آن استخراج نمی‌شود. این یک اصلاح دامنه/تطبیق فنی است، نه رأی تازه برای توقف پروژه.
- ب حدهای G2: پیش‌نویس و سناریوهای مصنوعی‌اند؛ بدون شاهد همان چاپ و بستهٔ کم‌حجمِ دامنه/گزینه/اثر، نه سقف خودکار باز می‌شود و نه حکم جمعی از مالک می‌خواهیم.
- ج میزبانی/هزینهٔ صف بادوام واقعاً تصمیم سیاستی مالک می‌خواهد؛ ابتدا Z.ai گزینه‌ها، هزینه، مسئول عملیات و آزمون demo را مشخص کند؛ تا آن زمان `NOT_DEPLOYED`.
- د Excel↔JSON: انتخاب قرارداد منشأ و آزمون بازتولید نخست کار فنی Z.ai و خط محتواست؛ اگر سیاست سر رسمی/انتشار را عوض کند، آنگاه فقط آن اختلاف به مالک می‌رود. هیچ merge کلی مجاز نشده.

## پروتکل و ایمنی اجرا

- T14 رجیستری ماشینی، T15 واژگان شاهد حاکمیتی و T16 کلید پایدار job هنوز اصلاح قراردادند؛ تا آزمون و پذیرش متقابل، pilot را به استقرار ۲۴ساعته تعبیر نمی‌کنیم. هویت سرویس و صف بادوام در گزارش Z.ai `BLOCKED` مانده‌اند.
- گیت منبع v2 و احراز توکن سمت سرور، رفع ایرادهای نسخهٔ قدیم را در سطح کد/CI نشان می‌دهند؛ بازآزمایی مستقل روی vault واقعی و ممیزی دامنهٔ `candidateSha`/هویت معلم/سیاست توکن هنوز انجام نشده است. ادعای نفوذ یا مُهر معتبر از این بازبینی نتیجه نمی‌شود.

**کار بعدیِ مستقل:** Z.ai پاسخ را با commit کامل و schema per-case دوباره صادر و تست source-pin را بدون fallback `unknown` اجرا کند؛ آرنا همان artifact را مصرف و برای موارد واقعی G2 پس از شاهد چاپ/حدهای مجاز تست تعامل می‌کند. هیچ ACK پذیرش موتور، مُهر یا ادغام در این گزارش صادر نشده.
