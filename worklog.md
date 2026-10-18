# Worklog

---
Task ID: 1
Agent: Z.ai Code (main)
Task: ممیزی بستهٔ math-game-v10.1 کاربر، اصلاح دو شکاف سند/کد (مأموریت‌های جانبی)، راستی‌آزمایی مرورگری و آماده‌سازی پیش‌نمایش/بستهٔ دانلود

Work Log:
- بستهٔ آپلودشده در /home/z/my-project/upload/math-game-v10.1.zip استخراج و کل سورس‌ها (experience.mjs، app.js، bridge.js، station/*، tests/*، v10.html، v10.css) مطالعه شد
- ۲۰ آزمون موجود اجرا شد: هر دو پاس (ادعای سند «۱۴۸ آزمون» ناسازگار بود؛ در بسته ۲۰ آزمون وجود دارد)
- شکاف ۱: مأموریت‌های جانبی هیچ مسیر شروعی در UI نداشتند (map.js فقط enter-building/show-lock-reason/show-done-message؛ sheet بدون availableSides)
- شکاف ۲: generateQuestionsForDepth پارامتر missionId را نادیده می‌گرفت؛ ۵ سؤال تطبیقی سند پیاده نبود
- اصلاح هسته: تابع Pure «generateSideMissionQuestions(missionId, seed)» در experience.mjs (بخش ۸.۵) با استراتژی‌های گلوگاه شناختی سکتور مادر + متادیتای آموزشی (anchor/skipBy/swapped/...) + determinism با seed
- اصلاح اتصال: bridge.js (اتحاد availableSides همهٔ سکتورها + عدم آلودگی سلول‌ها از جلسه side)، station/index.js (پاس دادن availableSides و currentDepth به sheet)، sheet.js (getSideMissionButtons/onSideMissionButton با اکشن start-side-mission)، v10.html (ظرف sheet-side-missions + عنوان ۱۰.۱)، v10.css (استایل دکمه‌ها با پالت رسمی)، app.js (رندر دکمه‌ها، هندلر تفویضی، startSideMission، هدر «تمرین جانبی»)
- E2E مرورگر (agent-browser) دو باگ P0 کشف کرد:
  1) openLocal('math_game_v10') رشته به‌جای آبجکت IndexedDB → هیچ جلسه‌ای شروع نمی‌شد؛ به openLocal() اصلاح + fallback درون‌حافظه‌ای هم‌قرارداد در local.mjs برای محیط‌های محدودشده (iframe/سافار)
  2) activityId تعریف‌نشده در جلسه‌ها → keepStationRecord رکورد side را با رکورد depth اشتباه و حذف می‌کرد؛ هویت پایدار station-{sector}-depth-{n} و side-{missionId} اختصاص یافت
- آزمون‌ها: tests/v10.1-side-missions.test.js با ۱۱ آزمون جدید (شامل رگرسیون باگ activityId)؛ مجموع ۳۱/۳۱ پاس؛ package.json به‌روز شد
- راهنمای_جامع_نسخه_۱۰.۱.md: بخش ۷ (دفترچهٔ اصلاحات v10.1.1) افزوده شد
- یکپارچه‌سازی پیش‌نمایش: کپی بسته در public/math-game (بدون tests)، زیپ کامل در public/math-game-v10.1-fixed.zip، صفحهٔ فرود فارسی RTL در src/app/page.tsx (کارت اصلاحات، جدول مدل ۹ لایه، پیش‌نمایش iframe بازی، دکمه دانلود، فوتر چسبان)، متادیتای layout.tsx فارسی شد
- راستی‌آزمایی مرورگری نهایی: بازی کامل تا ۱۰۰٪ نیروگاه بازی شد (۸ سؤال)، دکمهٔ «تعمیر آنتن فرعی» ظاهر و اجرا شد (۵ سؤال با ۵ سلول)، هر دو رکورد depth و side در IndexedDB جداگانه ذخیره شدند، صفحهٔ فرود دسکتاپ/موبایل و فوتر چسبان (noGap=true) و اجرای بازی داخل iframe تأیید شد؛ بدون خطای کنسول

Stage Summary:
- بستهٔ نهایی v10.1.1 در /home/z/my-project/math-game-v10.1 (منبع) و public/math-game (سرو) + public/math-game-v10.1-fixed.zip
- ۳۱/۳۱ آزمون پاس | دو شکاف سند/کد بسته شد | دو باگ P0 رفع شد | E2E مرورگری کامل تأیید شد
- تصمیم کلیدی: فلسفهٔ بازی دست‌نخورده ماند (نمرهٔ خالص، sequential map، affectsLeaderboard:false) و همهٔ تغییرات Pure/سازگار با رکوردهای legacy graph-v8.1 هستند
