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

---
Task ID: 6
Agent: full-stack-developer (Z.ai Code)
Task: ساخت فرانت‌اند کامل «داشبورد معلم — کارگاه ضرب» (فارسی RTL) روی بک‌اند آمادهٔ Taskهای قبل — صفحهٔ `/` با هدر چسبان، KPI، سه تب (نمای کلی/دانش‌آموزان/گلوگاه‌ها)، Sheet جزئیات دانش‌آموز، Dialog گلوگاه‌ها و گزارش هوشمند AI

Work Log:
- worklog.md و قراردادهای رسمی `src/lib/dashboard/types.ts` و `src/lib/dashboard/constants.ts` خوانده شد؛ همهٔ پاسخ‌های API (overview/students/students/{id}/bottlenecks) با curl راستی‌آزمایی شد
- layout.tsx بازنویسی شد: `lang="fa" dir="rtl"`، فونت Vazirmatn با preconnect + link stylesheet (بدون next/font تا قطع شبکه صفحه را نشکند)، متادیتای فارسی، Providers + Toaster
- globals.css: فقط append — `body { font-family: Vazirmatn,... }` + اسکرول‌بار سفارشی webkit برای `.custom-scroll`
- providers.tsx (جدید): QueryClientProvider با staleTime:15s و refetchOnWindowFocus، QueryClient یک‌بار در useState initializer
- معماری دیتا: page.tsx سه useQuery (`overview`/`students`/`bottlenecks`) با refetchInterval:30_000 و فچ نسبی + cache:'no-store'؛ Sheet جزئیات با useQuery وابسته به id (enabled)؛ refresh سراسری با Promise.all روی هر سه refetch
- کامپوننت‌ها (۱۱ فایل جدید در src/components/dashboard/): api.ts، providers.tsx، trend-bars.tsx (نمودار میله‌ای CSS خالص dir=ltr با tooltip بومی، میلهٔ خط‌چین برای روزهای null، legend)، accuracy-badge.tsx (بج دقت + هلپر مشترک errorBarClass)، state-views.tsx (ErrorCard با WifiOff + EmptyState با CheckCircle2)، kpi-cards.tsx (۵ کارت با اسکلتون)، overview-tab.tsx (روند، سلامت جدول‌ها با آستانه‌های رنگی 40/32/25، فید ۸ جلسه با max-h-96 custom-scroll، قهرمان‌های کلاس)، students-tab.tsx (جدول ۸ ستونه ردیف‌کلیک‌پذیر با keyboard support)، student-detail-sheet.tsx (Sheet side=left با گرید ۹ لایه: mastered/جاری با ring/Lock، روند، فاکتورها، پیشنهادها با Lightbulb، ۶ جلسه)، bottlenecks-tab.tsx (نوار توضیح، چیپ جدول‌ها، جدول با شدت + Dialog «مشاهدهٔ دانش‌آموزان» که با کلیک نام، Sheet همان دانش‌آموز را باز می‌کند + دکمهٔ گزارش هوشمند)، ai-report-dialog.tsx (useMutation POST /api/ai-report، رندر react-markdown با کلاس‌بندی دستی، کپی با Clipboard API + fallback execCommand، Skeleton حین لود، toast خطا)
- page.tsx بازنویسی کامل: هدر sticky با سه دکمه (بازآوری با spin، گزارش هوشمند AI، اجرای بازی target=_blank به /math-game/v10.html)، نوار تاریخ («امروز» با useSyncExternalStore تا hydration-safe باشد + «آخرین به‌روزرسانی» با faRelative)، Tabs سه‌گانه، فوتر چسبان (mt-auto) با min-h-screen flex flex-col، state مشترک activeStudentId و aiOpen
- رفع خطای lint: حذف setState داخل effect (الگوی useSyncExternalStore برای تاریخ امروز) و eslint-disable توجیه‌شده برای قاعدهٔ no-page-custom-font؛ یک باگ ReferenceError useEffect حین تست کشف و رفع شد
- E2E مرورگر (agent-browser): هر سه تب، جدول ۱۲ دانش‌آموز، Sheet با ۹ خانهٔ لایه، Dialog گلوگاه با ۳ نفر affected و پرش به Sheet، تولید موفق گزارش AI (۴ تیتر ## رندر شد)، موبایل 390px بدون سرریز افقی با گرید ۲ ستونه — تأیید شد؛ بدون خطای کنسول
- راستی‌آزمایی بصری با VLM روی اسکرین‌شات دسکتاپ و موبایل: بدون مشکل چیدمان
- bun run lint: صفر خطا/هشدار | GET / = 200 | APIها سالم | dev.log بدون خطای کامپایل

Stage Summary:
- داشبورد معلم کامل و زنده روی `/` سرو شد؛ ۱۱ فایل جدید + ۳ فایل بازنویسی/append (layout.tsx، page.tsx، globals.css) — هیچ فایل بک‌اند/api/lib/prisma تغییر نکرد
- همهٔ اعداد faNum/faPercent با ارقام فارسی، فکت‌ها با span dir=ltr و mono؛ پالت emerald/teal/amber/rose/orange/slate (+violet فقط بج فضانورد) — بدون blue/indigo و بدون ایموجی
- refetch خودکار ۳۰ ثانیه‌ای برای دیدن زندهٔ جلسات جدید بازی؛ حالت‌های loading/error/empty در همهٔ بخش‌ها پوشش داده شد
- نکتهٔ باقی‌مانده: کپی کلیپ‌بورد در مرورگر headless سندباکس رد می‌شود (در مرورگر واقعی با user gesture کار می‌کند؛ fallback execCommand هم اضافه شد)؛ فونت وب به CDN گوگل وابسته است و در نبود شبکه به Tahoma برمی‌گردد

---
Task ID: 1-5,7 (main agent)
Agent: Z.ai Code (main)
Task: بک‌اند کامل داشبورد معلم با دیتابیس واقعی (Prisma/SQLite)، موتور آماری گلوگاه، APIها، پل بازی↔داشبورد و راستی‌آزمایی مرورگری مستقل

Work Log:
- schema.prisma بازنویسی شد: Student / Session / QuestionResult (denormalized studentId + روابط Cascade) — db:push موفق (پس از افزودن رابطهٔ مقابل روی QuestionResult)
- prisma/seed.ts با RNG قطعی (mulberry32 seed=140301): ۱۲ دانش‌آموز با پروفایل‌های متنوع (قوی/متوسط/ضعیف/بحرانی + روند up/flat/down)، ضعف فاکتور-محور (مثل 7×8) هم‌راستا با لایه‌های طی‌شده، تمرکز ۶۰٪ سؤال‌ها روی فاکتورهای ضعیف، وزن‌دهی مضرب ۶-۹ → ۱۲ دانش‌آموز / ۱۴۹ جلسه / ۱۴۹۰ سؤال
- دو بار بازطراحی seed: ابتدا ضعف جدولی رقیق‌شدگی داشت (۱ گلوگاه)؛ مدل فاکتور-محور + آستانهٔ ۲۵٪ → ۱۳ گلوگاه معنادار (خوشهٔ بحرانی ×۲/×۳/×۴ دانش‌آموزان ضعیف + خوشه‌های ×۶/×۷)
- موتور آماری Pure (src/lib/dashboard/stats.ts): aggregateFacts (نرمال‌سازی جابه‌جایی‌ناپذیر)، computeBottlenecks (شدت critical≥40/high≥32/medium، جدول مرجع = جدول با خطای کلاسِ بالاتر، affected per-student)، computeTableHealth (۲..۱۲)، computeDailyTrend (۱۴ روز با لیبل شمسی)، computeLayerProgress (تسلط ۸۵٪ + ۸ تلاش، هم‌راستا با آستانه‌های بازی)، trendDirection
- server.ts: loadDashboardData + buildStudentSummary + sortStudents (نیازمند توجه‌ها اول)
- ۶ API Route با force-dynamic: GET overview / students / students/[id] (params Promise) / bottlenecks؛ POST sessions (zod v4، یافتن/ساخت دانش‌آموز با studentId یا studentName)؛ POST ai-report (z-ai-web-dev-sdk، پرامپت سیستمی معلم‌محور، ساختار ۴ تیتر، ارقام فارسی) — همه با curl تست شدند؛ گزارش AI در ۳.۲s تولید شد
- پل بازی↔داشبورد: تزریق fetch آتش‌وفراموش‌شده در شاخهٔ building-complete بازی سرو‌شده (public/math-game/src/v10/app.js) با keepalive و نگاشت سکتور→لایه (power 0 / antenna 3 / launch 6 + depth)
- E2E زنده با agent-browser: بازی نیروگاه تا building-complete کامل شد → POST /api/sessions → ساخت دانش‌آموز «کودک» در SQLite → ظاهر شدن در جدول داشبورد (۱۳ ردیف) — خط لولهٔ کامل تأیید شد
- باگ‌های کشف‌شده و رفع‌شده حین E2E: (۱) parentSectorId مأموریت جانبی عددی بود (۱/۲/۳) → buildingId:1 و 400؛ نگاشت دوطرفهٔ عدد↔نام بنا در هوک + zod union با transform در API (۲) fallback نام «بازیکن ایستگاه» (۳) کلید تکراری React برای فاکتورهای مربعی (tables=[2,2]) → dedupe در stats + key یکتا در UI (۴) DialogTitle غایب هنگام لود Sheet → sr-only title (۵) aria-describedby برای DialogContent‌ها
- نکتهٔ رصد‌شده: chunk کامپایل‌شدهٔ کهنه Next dev یک بار آستانهٔ قدیمی stats را سرو کرد؛ با touch فایل اجبار به recompile و تأیید سازگاری ۷↔۱۳ → ۱۳/۱۳
- sync نسخهٔ منبع بازی (math-game-v10.1/src/v10/app.js) با نسخهٔ سرو‌شده + node --check
- راستی‌آزمایی نهایی مرورگری: سه تب، Sheet ۹ لایه، Dialog affected، گزارش AI در دیالوگ، موبایل 390px بدون overflow-X، فوتر در موبایل و دسکتاپ درست (push طبیعی)، بدون خطای کنسول | bun run lint: صفر خطا

Stage Summary:
- داشبورد معلم با دیتابیس واقعی SQLite کامل و زنده است: ۱۳ دانش‌آموز، ۱۵۱ جلسه، ۱۵۰۳ سؤال، ۱۳ گلوگاه فعال — همگی از Seed + جلسهٔ زندهٔ واقعی بازی
- قرارداد داده: src/lib/dashboard/types.ts (مشترک بک‌اند/فرانت) | آستانه‌ها: گلوگاه ≥۲۵٪ خطا و ≥۵ تلاش، تسلط لایه ۸۵٪+۸ تلاش
- بازی بدون داشبورد هم بدون خطا کار می‌کند (fetch بی‌صدا شکست می‌خورد) — سازگار با استقرار گیت‌هاب
- لاگر عیب‌یابی payload نامعتبر در POST /api/sessions فعال ماند (console.error سمت سرور) برای دیباگ آینده

---
Task ID: 8 (main agent)
Agent: Z.ai Code (main)
Task: اجرای «برو» روی پلن مصوب — بستن دو شکاف باقی‌مانده: همگام‌سازی Idempotent (پلن P1) و حلقهٔ گزارش←اقدام (پلن معماری شمارهٔ ۲) + راستی‌آزمایی کامل وضعیت

Work Log:
- worklog.md خوانده شد؛ تأیید شد M1 (فیکس ماموریت جانبی، ۳۱/۳۱ تست) و M2/M3 (بک‌اند + داشبورد) قبلاً تحویل شده‌اند؛ دو شکاف واقعی پلن مصوب باقی بود: idempotency و اتصال گلوگاه به ماموریت درمانی
- Idempotency: فیلد `eventId String? @unique` روی Session + db:push؛ POST /api/sessions با چک قبلی + catch P2002 (مسابقهٔ همزمان) → پاسخ 200 با `duplicate:true` بدون ساخت رکورد
- پل بازی (هر دو نسخهٔ public و منبع): `syncEventId` قطعی از `evt_{activityId}_{firstReceiptTime}` — همان تلاش = همان eventId؛ بازیابی بنا = رویداد تازه. node --check هر دو پاس
- حلقهٔ گزارش←اقدام: ماژول جدید `src/lib/dashboard/remediation.ts` (نگاشت جدول ۲–۵ → side-1-antenna، ۶–۹ → side-2-backup، ۱۰–۱۲ → side-3-fuel — آینهٔ SIDE_MISSIONS بازی)؛ `BottleneckItem.remedy` در stats.ts از جدول مرجع؛ `StudentDetailResponse.recommendedRemedy` از ضعیف‌ترین فاکتور + خط پیشنهادی متنی
- UI: چیپ ماموریت درمانی (آیکون‌های lucide: RadioTower/BatteryCharging/Rocket) در ستون «اقدام پیشنهادی» تب گلوگاه‌ها؛ کارت «مأموریت درمانی در بازی» در Sheet دانش‌آموز (هدف، بخش ایستگاه، جدول‌های تحت پوشش، ۵ سؤال تطبیقی)
- باگ حین E2E: `faNum is not defined` در students/[id]/route.ts (ایمپورت جامانده) → رفع شد
- نکتهٔ عملیاتی: پس از db:push باید dev server ری‌استارت شود وگرنه Prisma Client کهنه در حافظه `Unknown argument eventId` می‌دهد (رخ داد و رفع شد)
- تست curl: سه POST با همان eventId → دقیقاً ۱ جلسه و ۳ سؤال در DB، پاسخ سوم `duplicate:true` با همان sessionId؛ دانش‌آموز آزمایشی پس از تست حذف شد
- Agent Browser E2E: تب گلوگاه‌ها = ۱۳ چیپ ماموریت درمانی | Sheet «باران قاسمی» = کارت «تعمیر آنتن فرعی — بخش ایستگاه نیرو» | موبایل 390px بدون overflow افقی | بازی سروشده بدون خطای کنسول، تعامل واقعی (نیروگاه → پاسخ ۲×۲=۴ → سؤال بعدی ۳×۳) تأیید شد
- زیپ `public/math-game-v10.1-fixed.zip` با پل جدید بازسازی شد (تأیید presence of syncEventId داخل زیپ) | bun run lint صفر خطا | ۳۱/۳۱ تست بازی پاس

Stage Summary:
- هر دو معیار پذیرش پلن مصوب بسته شد: (۱) «یک بازی واقعی، رکوردهایش در SQLite بنشیند بدون تکرار» — idempotency فعال و تست‌شده؛ (۲) «هر گزارش گلوگاه با یک اقدام تمام شود» — ۱۳/۱۳ گلوگاه به ماموریت درمانی نگاشت شدند
- حلقهٔ کامل محصول اکنون سرتاسری است: بازی → sync idempotent → SQLite → داشبورد → توصیهٔ ماموریت درمانی → اجرای همان ماموریت در بازی
- قرارداد API پس‌سازگار است: بدنه‌های بدون eventId (کلاینت‌های قدیمی) مثل قبل 201 می‌گیرند

---
Task ID: 9-c
Agent: Z.ai Code (main)
Task: حلقهٔ اقدام معلم در فرانت — دکمهٔ «ارسال مأموریت به دانش‌آموز» + بخش «مأموریت‌های معلم» در Sheet، دیالوگ «اسکن برگهٔ کاغذی» (VLM) با دکمهٔ هدر، و توابع API فرانت‌اند

Work Log:
- worklog.md خوانده شد؛ قراردادهای types.ts (AssignmentItem/PostAssignmentBody/ScanPaperAnalyzeResponse)، constants.ts و remediation.ts مرور شد؛ دو API آمادهٔ assignments و scan-paper با خواندن سورس route.ts تأیید شدند
- api.ts: سه تابع جدید با همان الگوی فایل (fetch نسبی + cache:'no-store') اضافه شد: postAssignment (POST /api/assignments — پاسخ ۲۰۰ duplicate و ۲۰۱ ساخت هر دو موفق شمرده می‌شوند)، fetchStudentAssignments (GET با studentId) و analyzePaper(dataUrl, commit, studentId?) (POST /api/scan-paper)
- student-detail-sheet.tsx: (۱) داخل RemedyCard دکمهٔ «ارسال مأموریت به دانش‌آموز» (آیکون Send، سبز emerald، min-h-11 برای تاچ‌تارگت ۴۴px) با useMutation — بدنهٔ {studentId, missionId, fact: bottlenecks[0]?.fact}؛ onSuccess توست موفق «مأموریت «{title}» برای {name} ارسال شد» (با توضیح متمایز برای duplicate:true) + invalidate ['student-detail', id] و ['student-assignments', id]؛ onError توست destructive الگوی ai-report-dialog؛ حین pending دکمهٔ disabled + Loader2 animate-spin و متن «در حال ارسال…» (۲) بخش جدید «مأموریت‌های معلم» بعد از «پیشنهادهای آموزشی» با useQuery کلید ['student-assignments', studentId] — هر آیتم: عنوان مأموریت + بج وضعیت فارسی (pending=«در انتظار انجام» amber / seen=«دانش‌آموز دیده است» teal / completed=«انجام شد» emerald با dot) + fact با dir=ltr mono + faRelative(createdAt) + note؛ لیست در max-h-96 overflow-y-auto custom-scroll؛ خالی یا لودینگ = هیچ (نه EmptyState)
- scan-paper-dialog.tsx (فایل جدید ~۳۳۰ خط): DialogTitle «اسکن برگهٔ کاغذی» + توضیح دقیق درخواستی؛ Select دانش‌آموز از useQuery ['students'] (۱۳ گزینه، Skeleton حین لود)؛ آپلود با input file مخفی sr-only + دکمهٔ «انتخاب عکس برگه» (accept="image/*" → دوربین موبایل خودکار)؛ FileReader → dataURL سمت کلاینت؛ سقف ۶MB با پیام inline (تست شد با تصویر ۱۰MB)؛ پیش‌نمایش <img> با max-h-48 و alt فارسی؛ دکمهٔ «تحلیل برگه» (ScanLine) بدون فایل disabled؛ حین فراخوانی spinner + Skeleton + متن «تا ۱۵ ثانیه» با role=status aria-live؛ نتیجه: دو بج «تعداد مسئله/تعداد درست» با faNum + چیپ‌های factStats (mono dir=ltr + نوار errorBarClass + faPercent) + متن notes + هشدار amber برای unreadable>0؛ دکمهٔ «ثبت در داشبورد» بدون دانش‌آموز → خطای inline با role=alert (تست شد)؛ commit موفق → توست «{stored} نتیجه به پروندهٔ {name} اضافه شد» + invalidate ['students']/['overview']/['bottlenecks']/['student-detail'] + بستن دیالوگ؛ ریست کامل state و mutation.reset() هنگام بستن
- باگ a11y حین E2E کشف و رفع شد: پذیرش aria-describedby={custom-id} روی DialogContent + id سفارشی روی DialogDescription، چک داخلی Radix را می‌شکند (Radix id تولیدی خودش را در DOM جست‌وجو می‌کند و هشدار «Missing Description» می‌دهد) → حذف id سفارشی و اتکا به اتصال خودکار Radix (content توصیف‌گر را می‌گیرد) → صفر هشدار
- page.tsx: state scanOpen مشابه aiOpen + دکمهٔ هدر «اسکن برگه» (آیکون ScanLine، variant outline، بین «بازآوری» و «گزارش هوشمند AI»، aria-label کامل در موبایل) + رندر ScanPaperDialog در لایه‌های سراسری
- E2E مرورگری کامل (agent-browser): هدر → تب دانش‌آموزان → Sheet «باران قاسمی» → کلیک «ارسال مأموریت به دانش‌آموز» → توست موفق + ظهور بخش «مأموریت‌های معلم» با بج «در انتظار انجام»، فکت 2×4 و «همین حالا» (اسکرین‌شات)؛ کلیک دوباره → duplicate:true و توست تکراری — تأیید دقیقاً ۱ رکورد در DB با curl؛ دیالوگ اسکن بدون فایل → دکمهٔ تحلیل disabled؛ آپلود برگهٔ واقعی ساخته‌شده با PIL (۸ مسئله) → تحلیل VLM در ~۱۵ ثانیه → ۸ مسئله/۵ درست + چیپ‌های 3×4، 4×8، 6×7 با ٪۱۰۰ (بازمحاسبهٔ سرور درست بود حتی وقتی متن آزاد VLM اشتباه شمرد)؛ ثبت بدون دانش‌آموز → خطای inline؛ انتخاب «امیر کاظمی» و commit → دیالوگ بست + totalQuestions او دقیقاً +۸ شد و weakestFact به‌روز شد؛ agent-browser errors خالی؛ mobile-safe (گرید تک‌ستونه)
- رکوردهای واقعی ساخته‌شده برای عامل E2E بعدی نگه داشته شد: ۱ assignment (pending، side-1-antenna، fact 2×4 برای باران قاسمی) + ۱ جلسهٔ mode='paper' (۸ سؤال برای امیر کاظمی)
- bun run lint: صفر خطا/هشدار | dev.log: بدون خطای کامپایل (دو هشدار Fast Refresh قدیمی فقط حین ویرایش داغ فایل‌ها بود و پس از کامپایل نهایی هیچ خطایی نیست)

Stage Summary:
- حلقهٔ «گزارش ← اقدام» از سمت معلم کامل شد: معلم از Sheet یک کلیک مأموریت درمانی می‌فرستد، وضعیتش را زنده می‌بیند و از بازی بازخورد می‌گیرد؛ برگهٔ کاغذی هم با VLM به همان موتور گلوگاه تزریق می‌شود (mode='paper')
- سه فایل تغییر یافت (api.ts، student-detail-sheet.tsx، page.tsx) و یک فایل ساخته شد (scan-paper-dialog.tsx) — هیچ تغییری در API routes، src/lib/dashboard/**، بازی و prisma نرفت؛ globals.css هم دست نخورد (custom-scroll موجود کافی بود)
- درس فنی: با Radix Dialog هرگز id سفارشی روی DialogDescription/aria-describedby سفارشی متفاوت ندهید — اتصال خودکار Radix هم درست است هم بدون هشدار
- نکتهٔ باقی‌مانده: PATCH دکمهٔ «seen/completed» UI ندارد (توسط بازی/تکمیل خودکار ست می‌شود) — خارج از scope این تسک

---
Task ID: 9 (a,b,d,e) — subagent 9-c جداگانه ثبت کرد
Agent: Z.ai Code (main)
Task: P3 کامل — «معلم مأموریت بدهد» + اسکن برگه با VLM + TTS فارسی (بک‌اند، بازی، E2E حلقهٔ کامل)

Work Log:
- 9-a: مدل `Assignment` (studentId/missionId/fact/note/status pending|seen|completed/sessionId/completedAt) + db:push + ری‌استارت سرور (درس قبلی: Prisma Client کهنه) | POST /api/assignments (با جلوگیری از duplicate pending)، GET (studentId برای داشبورد / studentName برای برداشت بازی)، PATCH /[id] | sessions: zod `missionId` + `completeSideAssignments` در هر دو مسیر (create و duplicate) — اتمام مأموریت در بازی = completed خودکار با لینک sessionId
- 9-b: POST /api/tts (voice tongtong، speed clamp 0.5–2، سقف ۳۰۰ نویسه، کش درون‌حافظه ۴۰تایی، پاسخ binary audio/wav) | POST /api/scan-paper: createVision با پرامپت سخت‌گیرانهٔ JSON، extract tolerant، **بازمحاسبهٔ صحت در سرور (اعتماد به پرچم VLM نمی‌شود)**، factStats تجمیعی، inferLayer از جدول‌های غلط، commit → Session با mode='paper' و buildingId='paper-scan' — دادهٔ کاغذی وارد همان موتور گلوگاه می‌شود
- 9-d (بازی، هر دو نسخه sync + node --check + diff): بنر «📌 از معلم: …» در bottom-sheet (CSS کهربایی متمایز)، برداشت با GET studentName=displayName&status=pending در سه نقطه (init، بعد از اتمام بنا، abandon)، کلیک → PATCH seen + startSideMission | دکمهٔ «🔊 سؤال» در فرم پاسخ: جمله‌سازی «{عدد به حروف} ضربدر {عدد} چند می‌شود؟» با speed 0.9 + کش objectURL | پل: `missionId` به POST اضافه شد
- 9-c (delegated به full-stack-developer): دکمهٔ «ارسال مأموریت» در RemedyCard + بخش «مأموریت‌های معلم» در Sheet + دیالوگ کامل اسکن برگه (Select دانش‌آموز، آپلود/پیش‌نمایش، تحلیل→ثبت دومرحله‌ای) + دکمهٔ هدر «اسکن برگه» — گزارش کامل و E2E خودش در worklog (Task ID: 9-c)
- 9-e (E2E حلقهٔ کامل با agent-browser): مأموریت pending برای «کودک» → بنر در نقشهٔ بازی ظاهر شد → کلیک → ۵ سؤال تطبیقی مأموریت side-1-antenna (۳×۴، ۴×۵، ۵×۶، ۲×۷، ۳×۸) همگی درست → اتمام → بنر محو | سمت سرور: `[assignments] auto-completed: 1 side-1-antenna`، وضعیت completed + sessionId لینک‌شده، Session با eventId `evt_side-side-1-antenna_...` و ۵ نتیجه | فراخوانی POST /api/tts از بازی: 200 بدون خطای کنسول | اسکن VLM واقعی توسط subagent 9-c (۸ مسئله، بازمحاسبهٔ سرور دقیق) | bun run lint صفر خطا | ۳۱/۳۱ تست بازی | زیپ با پچ‌های جدید بازسازی شد

Stage Summary:
- P3 تحویل شد و حلقهٔ محصول اکنون واقعاً بسته است: داشبورد گلوگاه را می‌بیند → معلم با یک کلیک مأموریت درمانی می‌دهد → دانش‌آموز در بازی آن را می‌بیند و انجام می‌دهد → بدون هیچ ورود دستی، مأموریت در داشبورد completed می‌شود → دادهٔ جدید، گزارش بعدی را دقیق‌تر می‌کند
- اسکن برگه، دنیای کاغذ را هم به همان موتور گلوگاه وصل کرد (mode='paper') — معلم می‌تواند برگهٔ کاغذی کلاس را عکس بگیرد و داده‌اش کنار دادهٔ بازی تحلیل شود
- TTS فارسی پشتیبان دسترسی‌پذیری خواندن سؤال است؛ در نبود داشبورد همهٔ قابلیت‌های جدید بی‌صدا غیرفعال می‌شوند (استقرار مستقل گیت‌هاب حفظ شد)
- قراردادها پس‌سازگارند: sessions بدون missionId، assignments بدون status filter و کلاینت‌های قدیمی همگی مثل قبل کار می‌کنند

---
Task ID: 10
Agent: Z.ai Code (main)
Task: ممیزی CEAP v2.1 روی v10.1 + رفع باگ تایپ اعداد (فارسی‌سازی زندهٔ فیلد پاسخ) + ریزفیکس‌های a11y

Work Log:
- پروتکل CEAP v2.1 (upload/CEAP_PROTOCOL_SPEC_v2.1.md) سرفصل‌به‌سرفصل با کد فعلی مقایسه شد (صدا، CSS، aria، experience.mjs، keepStationRecord، schema.prisma، firebase-login.mjs)
- یافتهٔ ممیزی: صدا (سقف 0.045 + بی‌صدایی پیش‌فرض + تست رسمی)، aria-live، prefers-reduced-motion، تطابق ۶/۶ گلوگاه‌ها، ثبت timeSec هر پاسخ در سرور = قبلاً منطبق؛ راهنمای تصویری یک‌پله‌ای (💡 راهنما → دسته‌های مساوی بدون رقم) موجود است — anti-leag §8.2 برقرار
- تصمیم کاربر: گیت حریم خصوصی (§3) از دامنه خارج شد (ابزار تشخیص درون‌مدرسه‌ای)؛ بقیه با صلاحدید من
- باگ اصلی کاربر (تایپ اعداد انگلیسی): ریشه = فیلد answer-input هیچ هندلر input نداشت؛ چک پاسخ از قبل با normalizeDigits امن بود (فارسی‌نویس سالم، فقط نمایش ناهماهنگ)
- فیکس: fafyAnswerInput در app.js (هر رقم لاتین/عربی لحظه‌ای فارسی، نویسهٔ غیررقمی حذف) + listener زنده با حفظ مکان‌نما + maxlength=3 روی input (هر دو نسخه sync + node --check)
- ریزفیکس a11y (§5): حذف outline:none از building-node + بلوک :focus-visible با رنگ ring برای ۵ کلاس تعاملی + min-height:44px روی secondary-button
- صداهای glow (1s) و threeLayers (1.45s) عمداً دست نخورد (نقض سقف 400ms §6 با مسیر معافیت پداگوژیک — اوج احساسی اتمام بنا)
- تست: ۳۱/۳۱ پاس | زیپ بازسازی و presence هر سه فیکس داخل زیپ تأیید شد
- E2E مرورگری: تایپ لاتین 4 → نمایش ۴ → پذیرش → سؤال بعد؛ فارسی ۹ مستقیم → پذیرش؛ abc → حذف کامل؛ 5x2 → ۵۲؛ پاسخ غلط → همان سؤال؛ بدون خطای کنسول

Stage Summary:
- باگ تایپ ریشه‌ای بسته شد: فیلد پاسخ حالا همیشه فارسی نشان می‌دهد و از قبل هم پذیرش فارسی/لاتین/عربی امن است
- نقشهٔ CEAP برای ادامه: فاز بعدی پیشنهادی = لایهٔ بالینی معلم (مدل ۱۲ خطا + فاصلهٔ اطمینان + TEACHER_OVERRIDE)، سپس فروشگاه رویداد فقط‌الحاقی/بازپخش، سپس نردبان ۷پله‌ای کامل
- گیت حریم خصوصی به تصمیم مالک محصول بسته و در این فایل مستند شد

---
Task ID: 11-a
Agent: general-purpose (subagent)
Task: موتور تشخیص Pure و قطعی ۱۲خطای شناختی (CEAP §7.3) + API بازنویسی معلم (§9.2) + اتصال هر دو به GET /api/students/[id] + راستی‌آزمایی کامل

Work Log:
- worklog.md و زمینهٔ Taskهای 8/9/10 خوانده شد؛ error-model.ts (منبع واحد ۱۲ کد)، types.ts (DiagnosisItem/OverrideItem)، schema.prisma (TeacherOverride + QuestionResult.submitted) و زنجیرهٔ Task 11-b (chain-server.ts — دست‌نخورده) مرور شد
- فایل جدید src/lib/dashboard/diagnosis.ts (~۴۵۰ خط، کاملاً Pure و قطعی — بدون db/fetch/Date.now): computeDiagnoses(questions) با ۱۱Detector مستقل برای ۱۲ کد؛ اولویت با شواهد submitted (پاسخ واقعی) و الگوهای آماری فقط با confidence پایین‌تر؛ خروجی حداکثر ۳ تشخیص مرتب بر confidence نزولی (tie-break قطعی: attempts نزولی، سپس کد)؛ clamp صادقانهٔ confidence در [0.35, 0.9] (الزام §9.1)
- منطق کلیدی قواعد: COMMUTATIVE خطای جهت‌دار یک‌طرفه (یک جهت ≥2 غلط، جهت دیگر ≥2 درست و صفر خطا، base 0.55+بونوس اختلاف تا 0.7) | ADD_CONFUSION با submitted===a+b (≥2 slip، 0.6+) یا بدون submitted فاکت‌های خیلی آسان جدول ۲ غلط ≥2 (0.4) | SKIP_OVER/UNDER فقط با submitted===expected±a/±b (≥2 مورد؛ بونوس جدول ۲–۵) | PLACE_SHIFT خطای تجمعی جدول ≥10 (نرخ ≥0.4 با ≥3 تلاش) در برابر جدول <10 سالم (<0.2) با submitted===×10/÷10 → 0.75 وگرنه 0.5 | DOUBLING_HALVING نرخ جدول ۴/۸ ≥0.4 با جدول ۲ سالم ≤0.15 (0.6) | ANCHOR_DRIFT نرخ جدول ۶–۹ ≥0.35 با لنگرهای ۵/۱۰ سالم ≤0.2؛ شاهد ±یک‌دسته → 0.7 وگرنه 0.45 | DISTRIBUTIVE_LEAK فقط با submitted: submitted===a*(b−5) یا a*(b%10) (≥2 مورد، 0.65) | ZERO_PROPERTY (×0 یا submitted=0، ≥2 مورد، 0.8) | IDENTITY_CONFUSION (×1، ≥2 مورد، 0.75) | PERSISTENT_GUESSING (میانهٔ زمان غلط‌ها <2s و ≥4 غلط، 0.6 + بونوس مقدار تکراری حدس‌مانند +0.1) | FATIGUE_SLIP (نیمه‌بندی زمانی سراسری، افت دقت ≥0.2 با ≥6 تلاش در هر نیمه + میانهٔ زمان نیمهٔ دوم بلندتر، 0.55)
- هر DiagnosisItem: titleFa/cpaStage/cpaLabelFa/actionFa فقط از ERROR_CODES | sampleFacts حداکثر ۳ فاکت غلطِ آخر با قالب «۷×۸» (تابع محلی toFa) | attempts/errorRate از زیرمجموعهٔ فاکت‌های درگیر و medianTimeSec از سطرهای شاهد | patternFa جملهٔ سادهٔ فارسی با مثال عددی واقعی از شواهد («مثلاً ۳×۸ را ۲۲ نوشته...»)
- API جدید src/app/api/overrides/route.ts: POST با zod (studentId، originalCode/overrideCode با refine روی ERROR_CODES → کد نامعتبر 400، note ≤500) + چک وجود دانش‌آموز (404) → 201 {ok:true,id}؛ GET با ?studentId= → ۱۰ رکورد آخر {ok:true, overrides} با createdAt به ISO (الگوی assignments)
- اتصال در students/[id]/route.ts: جایگزینی placeholder «Task 11-a» با diagnoses: computeDiagnoses(questions) و overrides از db.teacherOverride.findMany (desc، take:10) در Promise.all با buildChainReport — مپ به OverrideItem؛ زنجیرهٔ 11-b و بقیهٔ پاسخ دست نخورد
- ویرایش افزودنی server.ts (تک ضروری خارج از سه فایل، مستندشده): select سطرهای questions فاقد submitted/timeSec/sessionId بود (برخلاف قرارداد مأموریت) → سه فیلد به select اضافه شد + تایپ ClinicalQRow = QRow & {...} روی DashboardData — صرفاً افزودنی؛ computeStudentFacts/computeDailyTrend/aggregateFacts بدون تغییر کار می‌کنند
- راستی‌آزمایی موتور Pure با ۸ سناریوی سینتتیک (bun -e import مستقیم): همهٔ مسیرهای submitted (ADD@0.63، SKIP_OVER@0.7، COMMUTATIVE@0.58، ZERO@0.82، GUESS@0.7 با بونوس، DIST@0.65، FATIGUE@0.55) و آرایهٔ خالی → همگی درست
- کشف داده: در کل DB (۱۵۱۶ سطر) submitted صفر است (seed فیلد را پر نمی‌کند و جلسات زندهٔ قبلی بدون submitted بودند) → تشخیص‌های دانش‌آموزان واقعی فعلاً آماری با confidence پایین‌تر — دقیقاً طبق طراحی؛ مسیر submitted با یک جلسهٔ سینتتیک واقعی از مسیر POST /api/sessions (با submitted) تا خروجی API راستی‌آزمایی شد: E_SKIP_OVERCOUNT@0.7 با sampleFacts فارسی — و سپس دانش‌آموز آزمون کامل حذف شد (کاسکید تأیید شد)
- E2E واقعی: ۱۳ دانش‌آموز sweep شد → ۸ نفر تشخیص دارند (باران قاسمی critical: E_ANCHOR_DRIFT@0.45 + E_ADD_CONFUSION@0.4؛ کیان اکبری critical: E_DOUBLING_HALVING@0.6؛ درسا/امیر/یاسنا: E_COMMUTATIVE_FAIL تا 0.7؛ آرش: E_FATIGUE_SLIP@0.55) و ۵ نفر قوی/عالی بدون تشخیص — آستانه‌ها شل نشد
- تست override روی باران قاسمی: POST معتبر → 201 {ok:true,id} | کد نامعتبر → 400 با پیام فارسی | note>500 → 400 | دانش‌آموز ناموجود → 404 | GET /api/overrides?studentId و GET /api/students/{id} هر دو رکورد را نشان دادند → رکورد تست با PrismaClient حذف و خالی‌بودن مجدد تأیید شد
- bun run lint: صفر خطا (exit 0) | dev.log بدون خطای کامپایل | خطاهای tsc باقی‌مانده همگی pre-existing (examples/، skills/، mode روی SessRow در دو route قبل از این تسک) — هیچ خطای جدیدی از فایل‌های این تسک نیست

Stage Summary:
- لایهٔ بالینی مدل ۱۲خطا فعال شد: داشبورد حالا به‌ازای هر دانش‌آموز حداکثر ۳ تشخیص قطعیِ مبتنی بر شواهد با فاصلهٔ اطمینان صادقانه + اقدام کلاسی + cpaStage می‌دهد و معلم می‌تواند با TEACHER_OVERRIDE فقط‌الحاقی تشخیص را بازنویسی کند (تاریخچهٔ ۱۰ مورد آخر در Sheet در دسترس است)
- سه فایل هدف + server.ts (افزودنی سه‌فیلدی select) تغییر کرد؛ بازی، فرانت (11-c)، زنجیره (11-b) و بقیهٔ APIها دست‌نخورده
- نکتهٔ برای فرانت (11-c): diagnoses فعلاً بدون شواهد submitted است (دیتابیس submitted ندارد)؛ confidenceها 0.4–0.7 آماری است تا جلسات آیندهٔ بازی (که submitted می‌فرستد) مسیر دقیق را فعال کند
- نکتهٔ عملی: اگر آینده دیتای submitted انبوه شد، آستانهٔ ≥2 مورد برای SKIP/DISTRIBUTIVE ممکن است بازنگری بخواهد؛ فعلاً برای پرهیز از تشخیص کاذب تک‌موردی عمداً سخت‌گیر است

---
Task ID: 11-d
Agent: general-purpose (subagent)
Task: نردبان داربست ۷پله‌ای (CEAP §8) + ضد تکدی سرنخ (§3.2) + تلاش‌نگار فقط‌الحاقی (§4.1) + پل شواهد داشبورد — در نسخهٔ منبع و sync به public

Work Log:
- worklog.md و محدودیت‌های فلسفهٔ بازی (نمرهٔ خالص، بدون افشای پاسخ، صدا فقط از SOUND_EVENTS) خوانده شد؛ guide.js و keepStationRecord و v10.html دست نخوردند
- فایل جدید src/v10/station/ladder.js (Pure، ۱۶۳ خط): buildLadder(question) → آرایهٔ ۷ پلهٔ { level, textFa, visual, sibling } — پلهٔ ۱ جلب توجه (فقط عددهای خود مسئله)، پلهٔ ۲ دست‌ورزی ملموس (اشیای واقعی/انگشت‌ها)، پلهٔ ۳ بازنمایی تصویری (visual:'equal-groups' → UI همان renderEqualGroupsSVG(f1,f2))، پلهٔ ۴ پرسش راهبردی متاتحلیلی، پلهٔ ۵ گام میانی («نیمی از دسته‌ها را روشن کن…» — بدون هیچ عددی)، پلهٔ ۶ تجزیهٔ ساختاری بر لنگر نزدیک (f2≥۸ تفکیک دهگان با منفی، f2=۶/۷ لنگر ۵، f2=۳..۵ لنگر ۲، f2=۲ دوبرابر — حاصل نهایی هرگز نوشته نمی‌شود)، پلهٔ ۷ نمونهٔ موازی کاملاً حل‌شده (f2===3?4:3 با محافظ کاندیدهای جایگزین؛ هرگز برابر (f1,f2)/(f2,f1))
- ضدنشت اجباری (§8.2): assertNoLeak(ladder, {f1,f2}) متن هر ۷ پله را به «توکن عددی مستقل» تجزیه می‌کند (هر نویسهٔ غیررقمی جداکننده — پس «۱۲۳» با جست‌وجوی «۱۲» اشتباه نمی‌شود) و حاصل f1×f2 را هم با ارقام فارسی هم لاتین در پله‌های ۱–۶ ممنوع می‌کند + پلهٔ ۷ باید نمونهٔ موازیِ متفاوت با answerFa درست داشته باشد؛ buildLadder در پایان خودش را راستی‌آزمایی می‌کند و در نقض null برمی‌گرداند (ورودی نامعتبر/ن_null هم null)
- UI نردبان در app.js: متغیرهای hintLevel/legacyGuideShown/hintCooldownUntil/hintCooldownTimer/questionStartedAt؛ renderQuestionView هر سؤال جدید نردبان را ریست می‌کند (hintLevel=0، دکمهٔ فعال با عنوان «💡 راهنما (گام ۰ از ۷)»، hidden=true، پاک‌کردن id تایمر)؛ هندلر question-guide-button با منطق نردبان جایگزین شد (پله‌به‌پله، پلهٔ ۳ + تصویر دسته‌های مساوی، hintsMax=Math.max در session) — showGuide حالا فقط راهنمای نقشه را کنترل می‌کند (map-guide-button دست‌نخورده) و fallback قدیمی (createQuestionGuide toggle) فقط وقتی buildLadder null باشد با وضعیت محلی اجرا می‌شود
- سرد شدن افزایشی ضد تکدی سرنخ: پس از پلهٔ ۲ ← ۵ ثانیه و پس از پلهٔ ۴ ← ۱۰ ثانیه (دکمهٔ disabled + «کمی صبر…» + setTimeout تمیز با پاک‌کردن id در render بعدی و محافظ currentView)
- تلاش‌نگار فقط‌الحاقی (§4.1): شاخهٔ غلط handleAnswerSubmit به session.wrongAttempts اضافه می‌کند { questionId, submitted, timeSec, at } (init wrongAttempts:[] و hintsMax:0 در startBuildingSession و startSideMission — مسیر FINALIZED مأموریت جانبی همان building-complete مشترک است)؛ questionStartedAt در renderQuestionView و elapsedSec گرد‌شده به ۰.۱ ثانیه در receipt پاسخ درست؛ در building-complete موازی با keepStationRecord (دست‌نخورده)، state.attemptLog با entry کامل { eventId, activityId, sectorId, depth, missionId, type, total, correct, wrongCount, hintsMax, completedAt } و سقف ۵۰۰ (slice(-499).concat)
- پل داشبورد: هر result حالا submitted دارد (درست → f1*f2؛ بی‌پاسخ → آخرین پاسخ غلطِ همان سؤال؛ وگرنه حذف — سازگار با semanticIntegrity سرور) + timeSec از receipt + hintsMax: session.hintsMax در بدنهٔ POST /api/sessions (zod سرور آماده بود: submitted 0..400 nullable، timeSec 0..300، hintsMax 0..7)
- اعتبارسنجی: node --check روی app.js و ladder.js (هر دو نسخه) پاس | ۳۱/۳۱ تست بازی پاس | sweep خودکار کل جدول ۲..۱۲×۲..۱۰: بدون نشت، بدون برخورد sibling، بدون فالس‌پازیتیو («۲۴۰» برای حاصل ۲۴ نشت شمرده نمی‌شود)؛ تزریق دستی «۲۴»/«24» در پلهٔ ۲ → گرفته شد
- E2E مرورگری (agent-browser روی public سرو‌شده): ۸ سؤال نیروگاه کامل شد — ۷ پله روی ۲×۲ با cooldown واقعی (۵s/۱۰s disabled «کمی صبر…»)، تصویر ۲ دستهٔ ۲تایی در پلهٔ ۳، ریست کامل در سؤال بعدی، پاسخ غلط همان سؤال ماند؛ بدنهٔ fetch رهگیری شد: hintsMax:7، submitted=حاصل برای ۸ سؤال، timeSec واقعی (۵۳.۶s برای سؤالی که همهٔ نردبان باز شد)؛ IndexedDB: attemptLog با ۱ entry کامل و wrongCount:1 + session.hintsMax:7 | جلسه در داشبورد ثبت شد (کودک: totalQuestions 13←21، accuracy 100٪) | بدون خطای کنسول | showGuide نقشه بعد از تغییرات سالم
- sync: app.js و station/ladder.js به public/math-game کپی شد (diff -r خالی = sync کامل)؛ v10.html و سایر فایل‌ها دست نخوردند؛ زیپ نساخته شد (تسک 11-e)

Stage Summary:
- نردبان ۷پله‌ای CEAP با ضدنشت اجباری و ضد تکدی سرنخ در بازی فعال شد: کمک تدریجی بدون افشای حاصل — تنها عدد حاصلِ موجود، مال نمونهٔ موازیِ متفاوت پلهٔ ۷ است
- تلاش‌نگار فقط‌الحاقی راه‌اندازی شد: پاسخ‌های غلط دیگر حذف نمی‌شوند (wrongAttempts + attemptLog سقف ۵۰۰) و زمان هر سؤال (timeSec) همراه شواهد به داشبورد می‌رود — keepStationRecord «بهترین» دست‌نخورده ماند
- fallback امن حفظ شد: هر نقض ضدنشت → buildLadder=null → راهنمای یک‌پله‌ای قدیمی؛ ۳۱/۳۱ تست و دو نسخهٔ منبع/سرو sync
- نمونهٔ ۴×۶: ۱) «به عددها خوب نگاه کن: ۴ دستهٔ ۶تایی می‌خواهد بسازی.» ۲) «با چیزی واقعی بساز: ۴ دسته درست کن و در هر دسته ۶ تا بگذار — با دکمه، لوبیا یا انگشت‌هایت.» ۳) «این ۴ دستهٔ ۶تایی را ببین و یکی‌یکی بشمار.» (+تصویر دسته‌ها) ۴) «کدام ضربِ ساده‌تر چیزی شبیه به این است که بلد باشی؟» ۵) «نیمی از دسته‌ها را روشن کن و بعد ادامه بده.» ۶) «۴×۶ = ۴×۵ + ۴×۱ — پنج دسته را که راحت‌تر می‌شماری، باقی را اضافه کن.» ۷) «۴×۳ = ۱۲ چون ۴ دستهٔ ۳تایی داریم. حالا خودت مسئلهٔ اصلی را امتحان کن.» — در پله‌های ۱–۶ هیچ‌جا ۲۴ (فارسی/لاتین) نیست؛ تأیید با assertNoLeak و sweep کامل جدول ضرب

---
Task ID: 11-c
Agent: general-purpose (subagent)
Task: فرانت لایهٔ بالینی داشبورد معلم — بخش «تشخیص بالینی (مدل ۱۲خطا)» + «تاریخچهٔ بازنویسی معلم» + بج زنجیرهٔ رویداد در Sheet دانش‌آموز + دیالوگ «بازنویسی تشخیص بالینی» با POST /api/overrides + E2E مرورگری کامل

Work Log:
- worklog.md (Taskهای 6، 9-c، 10، 11-a، 11-d) و قرارداد types.ts/error-model.ts/constants.ts خوانده شد؛ پاسخ واقعی GET /api/students/{id} (diagnoses/overrides/chain) و route.ts مربوط به overrides فقط‌خواندنی راستی‌آزمایی شد
- api.ts: تابع postOverride(body: PostOverrideBody) با همان الگوی postAssignment (fetch نسبی + cache:'no-store'؛ ۲۰۱ موفق؛ !ok → throw برای onError mutation) — خروجی { ok, id }
- فایل جدید override-dialog.tsx (الگوی scan-paper-dialog): عنوان «بازنویسی تشخیص بالینی» + توضیح بایگانی TEACHER_OVERRIDE (CEAP §9.2)؛ جعبهٔ «تشخیص فعلی الگوریتم» با چیپ mono ltr originalCode + originalTitleFa برای دانش‌آموز مقصد؛ Select کد جدید از ERROR_CODE_LIST (۱۲ گزینه، لیبل `titleFa (code)`، placeholder خالی)؛ Textarea یادداشت اختیاری maxLength 500 با شمارندهٔ faNum زنده؛ اعتبارسنجی خالی‌بودن کد با role=alert (تست شد)؛ useMutation postOverride → توست «تشخیص بازنویسی شد» + invalidate ['student-detail', studentId] + بستن؛ onError توست destructive؛ pending → disabled + Loader2 «در حال ثبت…»؛ ریست کامل state + mutation.reset() هنگام بستن (بازگشایی → placeholder و یادداشت خالی — تست شد)؛ بدون id سفارشی روی DialogDescription (درس a11y تسک 9-c)
- student-detail-sheet.tsx: (۱) بج زنجیرهٔ رویداد زیر هدر دانش‌آموز — healthy=chain.valid&&replayMatch → بج emerald outline «زنجیرهٔ رویداد سالم · {faNum(verified)} رویداد راستی‌آزمایی‌شده» با آیکون Link2 و title توضیحی؛ وگرنه rose «نیازمند بررسی»؛ متن کمرنگ «(شامل N رویداد پیش از ساخت زنجیره)» هرگاه legacyCount>0 (در هر دو شاخه — برای باران قاسمی با verified=۰ صادقانه توضیح می‌دهد) (۲) کارت تشخیص: چیپ کد mono dir=ltr + titleFa + بج CPA outline (teal) با cpaLabelFa؛ نوار confidence (عرض٪، رنگ ≥۰٫۶۵ emerald / ≥۰٫۵ amber / کمتر slate-400) + faPercent با لیبل «فاصلهٔ اطمینان»؛ سطر شواهد «{faNum(attempts)} تلاش · خطای {faPercent(errorRate)} · میانهٔ پاسخ {faNum(medianTimeSec,1)} ثانیه»؛ sampleFacts با span mono dir=ltr؛ patternFa؛ actionFa با Lightbulb amber (الگوی پیشنهادها)؛ دکمهٔ «بازنویسی تشخیص» (PenLine، size sm، min-h-11) (۳) diagnoses خالی → فقط یک خط آرام «شواهد کافی برای تشخیص شناختی هنوز جمع نشده است.» (بدون EmptyState سنگین) — تست شد روی دانش‌آموز بدون تشخیص (۴) بخش «تاریخچهٔ بازنویسی معلم» فقط وقتی overrides.length>0: آیکون History در SectionTitle، لیست max-h-96 overflow-y-auto custom-scroll، هر آیتم: چیپ originalCode (mono ltr slate) ← چیپ overrideCode (mono ltr emerald) + note + faRelative(createdAt) (۵) جابه‌جایی کنترل‌شده: RemedyCard (کارت خودتوصیف «مأموریت درمانی در بازی») به‌صورت مستقل قبل از لایهٔ بالینی قرار گرفت و بخش «پیشنهادهای آموزشی» (عنوان + فهرست Lightbulb) بعد از تاریخچهٔ بازنویسی ماند — ترتیب ادراکی دقیقاً «بعد از RemedyCard و قبل از پیشنهادهای آموزشی»؛ state های overrideTarget/overrideOpen در سطح Sheet (target هنگام بستن null نمی‌شود تا انیمیشن خروج دیالوگ خالی نماند) و overrideOpen با بستن Sheet ریست می‌شود
- ایمپورت‌های جدید lucide: PenLine، History، Link2 (هر سه موجود در 0.525.0) + useState — بقیهٔ ایمپورت‌ها دست نخورده
- E2E مرورگری (agent-browser): تب دانش‌آموزان → Sheet «باران قاسمی» → بج «زنجیرهٔ رویداد سالم · ۰ رویداد راستی‌آزمایی‌شده» + «(شامل ۹ رویداد پیش از ساخت زنجیره)» → دو کارت تشخیص کامل (E_ANCHOR_DRIFT/انتزاعی/٪۴۵ و E_ADD_CONFUSION/مجسم/٪۴۰ با شواهد و نمونه‌فکت‌ها) → «بازنویسی تشخیص» → ثبت بدون انتخاب کد → خطای inline → انتخاب «خطای دوبرابر/نصف کردن (E_DOUBLING_HALVING)» + یادداشت → ثبت → توست «تشخیص بازنویسی شد» → بستن → بخش «تاریخچهٔ بازنویسی معلم» با آیتم E_ANCHOR_DRIFT ← E_DOUBLING_HALVING + یادداشت + «همین حالا» ظاهر شد (invalidate ['student-detail']) → اسکرین‌شات دسکتاپ؛ بازگشایی دیالوگ → state کامل ریست
- موبایل 390px: scrollWidth=390 بدون overflow افقی (deep scan: تنها جدول students داخل overflow-x-auto عمدی)؛ دیالوگ بازنویسی هم بدون سرریز؛ VLM روی اسکرین‌شات‌های دسکتاپ/موبایل: بدون هم‌پوشانی/بریدگی، RTL و ارقام فارسی سالم، بدون رنگ خارج از پالت
- پاکسازی رکورد: فقط و فقط یک رکورد override در کل DB وجود دارد — همان ثبت واقعی E2E برای باران قاسمی نگه داشته شد (id: cmvdsi6ge0012qh8qb7z9jza0 — E_ANCHOR_DRIFT → E_DOUBLING_HALVING با یادداشت)؛ رکورد دیگری ساخته یا جا نماند
- bun run lint: صفر خطا (exit 0) | agent-browser errors خالی | هشدار قدیمی «Missing Description» SheetContent pre-existing است (فقط با باز شدن Sheet، بدون دیالوگ من رخ می‌دهد — خارج از فایل‌های مجاز این تسک)
- هیچ فایل بک‌اند/API/lib/prisma تغییر نکرد؛ فایل‌های تغییر یافته فقط: api.ts، student-detail-sheet.tsx، override-dialog.tsx (جدید)

Stage Summary:
- لایهٔ بالینی مدل ۱۲خطا در فرانت فعال شد: معلم تشخیص‌های مبتنی بر شواهد با فاصلهٔ اطمینان صادقانه، شواهد عینی (تلاش/نرخ خطا/میانهٔ زمان/نمونه‌فکت)، توضیح الگو و اقدام کلاسی را می‌بیند و می‌تواند با دیالوگ بازنویسی، تشخیص را فقط‌الحاقی با TEACHER_OVERRIDE بازنویسی کند — تشخیص الگوریتم دست‌نخورده و در تاریخچهٔ Sheet قابل مشاهده می‌ماند
- قرارداد invalidate دقیقاً الگوی RemedyCard: ['student-detail', studentId] → تاریخچه و وضعیت زنجیره بلافاصله پس از ثبت به‌روز می‌شود
- رکورد باقی‌مانده برای E2E نهایی سرپرست: override id=cmvdsi6ge0012qh8qb7z9jza0 (باران قاسمی، E_ANCHOR_DRIFT ← E_DOUBLING_HALVING، createdAt 2026-10-18T12:16:40.238Z)
- نکتهٔ برای ادامه: بج زنجیره در حالت سالم با verified=۰ + legacyCount>0، متن legacy را نشان می‌دهد (تعمداً در هر دو شاخه)؛ اگر آینده verifiedها زیاد شد می‌توان متن legacy را فقط به شاخهٔ rose محدود کرد

---
Task ID: 11 (main — با 11-a/b/c/d)
Agent: Z.ai Code (main)
Task: فاز CEAP — لایهٔ بالینی معلم (مدل ۱۲خطا + بازنویسی معلم) + فروشگاه رویداد فقط‌الحاقی (زنجیرهٔ رسید + بازپخش قطعی) + نردبان داربست ۷پله‌ای در بازی

Work Log:
- 11-prep (من): بازخوانی قراردادها؛ schema.prisma: مدل TeacherOverride + Session.lamportClock/prevReceipt/receipt/integrity + QuestionResult.submitted → db:push + ری‌استارت سرور
- 11-c0 (من): error-model.ts (منبع واحد ۱۲ کد §7.3 با titleFa/cpaStage/actionFa) + event-chain.ts (Pure: canonicalEventPayload دفاعی با coerce undefined→null، computeReceipt sha256، verifyChain، replaySessions، semanticIntegrity) + chain-server.ts (db) + types.ts (DiagnosisItem/OverrideItem/ChainReportResponse/PostOverrideBody)
- 11-b (من): POST /api/sessions حالا ساعت لامپورت به‌ازای دانش‌آموز + پیوند prevReceipt + receipt + integrity (submitted↔correct) را محاسبه و ذخیره می‌کند؛ GET /api/students/[id]/chain راستی‌آزمایی کامل + بازپخش؛ scan-paper هم submitted دست‌نویس VLM را ذخیره می‌کند
- باگ کشف‌شده و رفع‌شده: JSON.stringify کلید undefined را حذف می‌کند — سلکت buildChainReport فیلد studentId را نداشت و هش verify با hash می‌شکست؛ اصلاح: سلکت کامل + coerce دفاعی در canonicalEventPayload
- تست دستکاری (§3.2): تغییر دستی یک correct در DB → chain valid:false + replayMatch:false + شناسایی جلسه متخلخل → بازگردانی → سالم. برای باران قاسمی: ۹ جلسه legacy (پیش از زنجیره) + جلسات جدید clocked
- 11-a (ساب‌ایجنت): diagnosis.ts (۱۱ آشکارساز، حداکثر ۳ تشخیص، clamp 0.35–0.9، اولویت شواهد submitted، بدون submitted فقط الگو با confidence پایین) + POST/GET /api/overrides + اتصال به students/[id] + تک‌انحراف مستند: افزودن submitted/timeSec/sessionId به select سرور.ts → ۸/۱۳ دانش‌آموز تشخیص گرفتند (آستانه‌ها شل نشد)
- 11-d (ساب‌ایجنت): ladder.js جدید (۷ پله + assertNoLeak — sweep جدول ۲..۱۲ بدون نشت، پلهٔ ۷ نمونهٔ موازی متفاوت) + UI نردبان با سرد شدن افزایشی (۵s پس از پلهٔ ۲، ۱۰s پس از ۴) + تلاش‌نگار فقط‌الحاقی (state.attemptLog سقف ۵۰۰ + wrongAttempts با submitted/timeSec — پاسخ غلط دیگر حذف نمی‌شود) + پل: submitted/timeSec/hintsMax → ۳۱/۳۱ تست + sync دو نسخه
- 11-c (ساب‌ایجنت): api.ts postOverride + override-dialog.tsx (۱۲ کد از ERROR_CODE_LIST، یادداشت، اعتبارسنجی inline) + Sheet: بخش «تشخیص بالینی (مدل ۱۲خطا)» (چیپ کد + بج CPA + نوار confidence + شواهد + اقدام) + «تاریخچهٔ بازنویسی معلم» + بج زنجیرهٔ رویداد (emerald سالم / rose مشکوک + legacy) → E2E خودش: ثبت بازنویسی واقعی (E_ANCHOR_DRIFT ← E_DOUBLING_HALVING) + موبایل 390px تمیز
- 11-e (من): lint صفر | ۳۱/۳۱ تست | زیپ بازسازی (ladder.js داخل زیپ تأیید) | curl کامل students/[id] (diagnoses+overrides+chain) | E2E نهایی مرورگری: داشبورد (دو کارت تشخیص + بج سالم + تاریخچه) → بازی (نردبان گام ۰→۳ + «کمی صبر…» disabled) → تکمیل بنا ۸/۸ → DB: جلسهٔ clock=2 با receipt و submitted ۸/۸ (۲×۲=۴ در ۲۵s با نردبان؛ ۳×۳=۹ در ۱.۳s روان) → chain (کودک): valid+verified 2+replayMatch | dev.log بدون خطا

Stage Summary:
- سه خواستهٔ پلن مصوب کامل شد: (۱) لایهٔ بالینی معلم: تشخیص با کد + عنوان فارسی + مرحلهٔ CPA + فاصلهٔ اطمینان + شواهد (submitted/زمان/فاکت‌ها) + اقدام کلاسی + بازنویسی معلم فقط‌الحاقی با برچسب تاریخچه؛ (۲) فروشگاه رویداد: همهٔ تلاش‌ها (حتی غلط‌ها) با submitted و زمان حفظ می‌شوند، هر جلسهٔ جدید رسید sha256 زنجیره‌ای + ساعت لامپورت دارد و با بازپخش قطعی راستی‌آزمایی می‌شود — دستکاری دیتابیس خودکار آشکار می‌شود؛ (۳) نردبان ۷پله‌ای با ضدنشت و سرد شدن ضدتکدی
- بازی مستقل (بدون داشبورد) همچنان کامل کار می‌کند: نردبان و تلاش‌نگار محلی‌اند؛ پل sync در نبود سرور بی‌صدا می‌ماند
- پس‌سازگاری: جلسات قدیمی legacy محسوب و در گزارش زنجیره جدا شمرده می‌شوند؛ sessions بدون submitted مثل قبل

---
Task ID: 12
Agent: Z.ai Code (main)
Task: فهرست صفر تا صد تغییرات نسخهٔ ۱۰ → ۱۰.۱ برای نصب روی گیت‌هاب — دیف دقیق و واقعی برابر شاخهٔ v6

Work Log:
- شاخهٔ v6 مخزن bayrami1341/math-game (HEAD 62cfd48 «docs: update README for v10 application on v6 branch») به /tmp/gh-math-game کلون شد و فایل‌به‌فایل با بستهٔ محلی math-game-v10.1 مقایسه شد
- نتیجه: ۱۰ فایل DIFF (v10.html ‏۱۱۵ خط، styles/v10.css ‏۲۲۵، src/v10/app.js ‏۱۱۵۸، bridge.js ‏۴۵، station/index.js ‏۷، station/sheet.js ‏۳۸، station/visuals.js ‏۳۰۶، src/v9/experience.mjs ‏۴۳۱، src/v9/local.mjs ‏۱۶، tests/v10-station.test.js ‏۲۳، package.json ‏۸) | ۴ فایل NEW (station/ladder.js، tests/v10.1-station.test.js، tests/v10.1-side-missions.test.js، راهنمای_جامع_نسخه_۱۰.۱.md) | ۱۲ فایل SAME (v9-config، station/{cells,constants,guide,map,sounds,story}، src/v9/{app,connection,entry,firebase-login,mission})
- دو یافتهٔ ساختاری: (۱) v10.1 پوستهٔ کودک خالص است — سیم‌کشی پنل معلم/ورود Firebase در app.js از ۲۱ مسیر به ۰ رسیده و UIهای کلاس/دعوت/تابلو/ساخت قهرمان از v10.html حذف شده‌اند (مدیریت کلاس به داشبورد پلتفرم منتقل شده)؛ (۲) visuals.js از ۲۵.۲KB به ۵.۷KB سبک‌سازی شده (حذف VISUAL_ASSETS و renderMapBackdropSVG؛ ۴ تابع رندر building/path/cell/equal-groups باقی است)
- صحت‌سنجی وضعیت فعلی: ۳۱/۳۱ تست بازی (exit 0)، node --check سه فایل کلیدی سالم، public/math-game همگام با منبع (فقط بدون پوشهٔ tests)، زیپ public/math-game-v10.1-fixed.zip بایت‌به‌بایت Fresh برای ۷ فایل کلیدی
- ناهماهنگی جزئی سند: درخت فایل §۵ راهنمای ۱۰.۱ هنوز ladder.js، ظرف sheet-teacher-missions و دکمهٔ 🔊 را (که در Taskهای ۹/۱۱ اضافه شدند) فهرست نکرده — پیشنهاد به‌روزرسانی سند قبل از push
- فهرست کامل نصب + دو مسیر نصب (push با توکن کاربر، یا آپلود دستی zip) به کاربر تحویل شد

Stage Summary:
- نقشهٔ نصب v10.1 روی شاخهٔ v6 آماده است: جایگزینی ۱۰ فایل + افزودن ۴ فایل؛ هیچ فایلی از سرور/دارایی‌ها/مستندات v9 دست نمی‌خورد؛ package.json فقط name/version/test تغییر می‌کند (بدون وابستگی جدید)
- تصمیم باز برای کاربر: نصب با push مستقیم (نیاز به احراز هویت کاربر) یا آپلود دستی zip به‌روز
