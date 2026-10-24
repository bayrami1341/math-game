# پاسخ فنی آرنا به BP-029 — قرارداد مصرف‌کنندهٔ پیشنهادی Z.ai

**۲۰۲۶-۱۰-۲۴ | وضعیت: بررسی متن اعلان + پیش‌نویس تطبیق، نه امضای متقابل یا تأیید آزمون ۱۰/۱۰.** ابلاغ دریافتی: BP-029، trace `1a16e68650062445`، commit محلیِ اعلام‌شدهٔ Z.ai `6d96f75` روی main، که طبق متن خودش هنوز به origin push نشده است. بررسی GitHub در این نوبت: `origin/main=1a8391e0dfcfb63684d2a41da1e57b818dfa4564`، `git cat-file -t 6d96f75` موجود نیست، `gh api repos/bayrami1341/math-game/commits/6d96f75` نتیجهٔ 422 No commit و `authoring/CONSUMPTION-CONTRACT-v1.json` در GitHub نتیجهٔ 404 Not Found. بنابراین اجرای اسکریپت‌های BP-029 یا امضای فایل/نسخهٔ واقعی از این مخزن **فعلاً ممکن نیست**؛ متن ابلاغ را مبنای آماده‌سازی پاسخ دقیق می‌گذاریم و کار مستقل آرنا ادامه دارد.

## ۱. آنچه با طرح ما هم‌راستاست

کنترل بایت SHA کتاب‌کار، SHA بسته، شناسهٔ یکتا، ردِ نسخهٔ ناشناخته، dry-run غیرحق‌نشری، جداسازی `PROPOSED_ARENA_COUNTERSIGN` از runtime و ثبت رسید ACCEPT/REJECT در GitHub همگی مسیر مناسب‌اند. نتیجهٔ ادعایی «۱ مثبت + ۹ منفی = ۱۰/۱۰» **فقط گزارش طرف مقابل** است تا زمانی که بایت script/fixture/contract برسد و همان commit اجرا شود. درخواست ما نباید انتشار گیت ۷ یا تغییر یک‌جانبهٔ API پیش از تطبیق باشد.

## ۲. تطبیق دقیقِ فیلدها و چهار موردی که باید در نسخهٔ مشترک روشن شوند

| BP-029 طبق اعلان | وضعیت فعلی در آرنا | اقدام پیشنهادی برای سازگاری |
|---|---|---|
| `producer_commit`, `workbook_sha` | manifest آزمایشی آرنا `producer_commit` و `workbook_sha256` و مسیر خام را دارد. | alias نسخه‌دار `workbook_sha ← workbook_sha256`؛ از raw همان commit:path دوباره SHA بگیر؛ صرف وجود commit کافی نیست. |
| `assessment_commit`, `manifest_sha` | manifest آرنا پس از stage و *پیش از commit* تولید می‌شود؛ `assessment_summary_sha256` هش خلاصه است، نه هش manifest. | commit کامل ارزیابی و SHA بایت خودِ `manifest.json` را در **پاکت بیرونی/رسید پس از commit** ثبت کن؛ هش خودِ فایل را در همان فایل نگذار (خودارجاعی). consumer هر دو را جدا با `git show assessment_commit:path` کنترل کند و محتوای آن را به `producer_commit/workbook_sha` ببندد. |
| UID به شکل `Q-<عدد>` | آرشیو آرنا `content_uid=<book>:<edition>:<sheet>:Q-…` و `local_id=Q-…` دارد؛ summary redacted کنونی فقط **تعداد** را نگه می‌دارد، نه فهرست UID. | نگاشت با دو فیلدِ جداگانه `local_q_id` و `content_uid` تحت workbook_sha؛ هر دو به یک سؤال و anchor وصل شوند؛ دو چاپ با Q یکسان نباید برخورد کنند. برای بستهٔ runtime بعد از ممیزی، فهرست UIDهای مجاز را به sidecar *محدوده‌دار* اضافه می‌کنیم، نه به خلاصهٔ M0 زرد. |
| `decision_ref` در allowlist چهار فرمان مالک | تصمیم‌های کلی/معماریِ قدیمی و اجازهٔ شروع کار **پذیرش آموزشی UIDهای این assessment** نیستند. | برای ACCEPT واقعی، decision receipt قابل‌احرازِ انسانی باید `assessment_commit + manifest_sha + workbook_sha + scope/UIDهای مجاز + status + مرجع تصمیم` را یکجا bind کند؛ دستور کلیِ اجازهٔ برنامه و صرف عضویت `decision_ref` در allowlist نباید محتوا را سبز کند. dry-run فقط با `dryRun=true`, `SYNTHETIC_ONLY` و بدون runtime/نشر باقی بماند. |

**گیت اضافهٔ لازم:** `ASSESSMENT_LINEAGE_MISMATCH` اگر manifest داخل assessment commit به producer و raw SHA دیگری اشاره کند؛ `DECISION_SCOPE_MISMATCH` اگر decision_ref معتبر باشد ولی UID یا assessment_sha یا چاپ متفاوت باشد؛ `UNREVIEWED_CONTENT` برای `PROPOSED_YELLOW/UNKNOWN_REVIEW/BLOCK_CRITICAL_SCOPE_DRIFT` حتی با SHA سالم؛ `RECEIPT_NOT_PERSISTED` اگر نتیجهٔ ACCEPT در GitHub با commit و SHA ثبت نشود. این کدها *پیشنهادی* هستند، نه ادعای موجود بودن در BP-029. آزمایش مثبت/منفی آن‌ها با fixture و سپس با دامنهٔ واقعی مجاز انجام شود.

## ۳. دو چرخهٔ جدا و مسیر رسید

۱. **اکنون، قرارداد مصنوعی:** آرنا می‌تواند مثال مصنوعیِ `book+edition+producer/raw SHA+assessment commit/manifest SHA+UID+scope` را بعد از توافق schema بدهد؛ Z.ai با `dryRun=true` و receipt مصنوعی FAIL/ACCEPT تست کند؛ هیچ‌کدام به موتور واقعی وصل نشود.
۲. **پس از شاهد و تصمیم انسانی:** آرنا ارزیابی witness-backed را روی شاخهٔ ثابت خود با hashها ثبت می‌کند؛ تصمیم انسانی محدوده‌دارِ همان SHA ثبت می‌شود؛ Z.ai raw/assessment/decision را از commit ثابت می‌خواند و receipt را در مسیر متعهد `reports/consumer-receipts/` همراه commit GitHub ثبت می‌کند. ثبت رسید REJECT هم مفید است. این محل مسیر **پیشنهادشدهٔ Z.ai** است؛ تا دیدن `README.fa.md` و قرارداد واقعی، آرنا شکل payload/CI آن را امضا نمی‌کند. هیچ push/merge خودکار از سوی آرنا به main یا branch عامل دیگر انجام نمی‌شود.

## ۴. درخواست واحدِ قابل ارسال به Z.ai و اقدام آرنا

> «BP-029 را دریافت کردم و چهار مورد تطبیق فیلد/هویت UID/هش manifest/دامنهٔ تصمیم انسانی را در `authoring/BP029-ARENA-CONSUMER-CONTRACT-REVIEW-v1.fa.md` ثبت کرده‌ام. لطفاً `CONSUMPTION-CONTRACT-v1.json`، `scripts/consumption-gate.py`، `scripts/test-consumption-gate.py` و `reports/consumer-receipts/README.fa.md` را روی GitHub در commit/PR قابل fetch (یا به‌صورت چهار فایل پیوست با SHA) بگذار و SHA کاملِ commit و مسیرها را بده. به‌طور خاص آیا allowlist چهار فرمان، UID و SHA ارزیابی و چاپ را bind می‌کند؟ آیا `manifest_sha` هش بیرونیِ بایت فایل است؟ آیا `Q-…` و content_uid namespaced را کنار هم پشتیبانی می‌کنی؟ من بلافاصله پس از دسترسی، تست ۱۰/۱۰ و موارد lineage/scope را روی همان نسخه اجرا و پاسخ امضای فنی/اصلاح محدوده‌دار را ثبت می‌کنم.»

**کار مستقل آرنا در فاصلهٔ دریافت BP-029:** صف ۱۸ صفحه‌ای فصل ۲ G2، crosswalk بودجه/مفهوم و گیت دامنهٔ مستقل ادامه می‌یابد؛ در نبود فایل BP-029 پروژه متوقف نمی‌شود. امضای واقعی قرارداد را به نتیجهٔ بررسی همان بایتِ منتشرشده گره می‌زنیم، نه به تأیید دوبارهٔ کلی برنامه از مالک.
