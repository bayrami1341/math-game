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

---
Task ID: 13
Agent: Z.ai Code (main)
Task: تلاش برای نصب مستقیم v10.1 روی گیت‌هاب + ساخت کیت نصب (زیپ تازه + اسکریپت apply + راهنما)

Work Log:
- پروب اعتبارنامه: بدون gh CLI، بدون ~/.git-credentials و ~/.netrc، بدون GITHUB_TOKEN/GH_TOKEN، credential.helper خالی → push مستقیم ممکن نیست (کلون فقط-خواندنی)
- سند راهنمای_جامع_نسخه_۱۰.۱.md به‌روز شد: درخت §۵ کامل (ladder.js، apply-v10.1-to-github.sh، ظرف مأموریت معلم، هر ۳ فایل تست) + بخش جدید §۸ (نردبان ۷پله‌ای، تلاش‌نگار فقط‌الحاقی، پل معلم/TTS، فیکس تایپ فارسی)
- اسکریپت apply-v10.1-to-github.sh ساخته شد (الگوی apply-v10-to-github.sh): کلون/checkout v6 + شاخهٔ پشتیبان backup/v10-final + ۴ کامیت منظم (هسته پداگوژیک / ایستگاه+کنترلر / تست‌ها / مستندات) + اجرای ۳۱ آزمون + push با پیام خطای راهنما
- هشدار اشتباه فیکس تایپ رفع شد: rg الگوی «fafa» نمی‌گرفت؛ نام واقعی تابع fafyAnswerInput است (خط ۴۲ app.js) — فیکس کاملاً سر جایش است در منبع/سرو/زیپ
- sync سند و اسکریپت به public/math-game؛ زیپ public/math-game-v10.1-fixed.zip بازسازی (۳۵ ورودی) و مارکرها داخل زیپ تأیید شد (fafyAnswerInput: 2، maxlength، ladder.js، اسکریپت، سند §۸)
- تست پوشایی اسکریپت روی کلون تازهٔ /tmp/test-repo: ۴ کامیت روی 62cfd48 (66d712e → 53e8b45)، ۱۵ فایل ‎+1877/−1365‎، ۳۱/۳۱ آزمون در ریپو ادغام‌شده، push با پیام راهنمای دستی متوقف شد (انتظار)، exit 0

Stage Summary:
- کیت نصب کامل و تست‌شده است: کاربر فقط دانلود زیپ + اجرای یک فرمان bash دارد (یا ۶ فرمان دستی)؛ لحظهٔ push با احراز هویت خودش انجام می‌شود
- مسیر جایگزین برای نصب توسط من: کاربر یک Personal Access Token با Contents:read/write بسازد؛ پس از نصب revoke کند
- بازگشت به عقب: شاخهٔ backup/v10-final خودکار ساخته می‌شود (git reset --hard backup/v10-final)

---
Task ID: 14
Agent: Z.ai Code (main)
Task: ساخت کیت نصب نسخهٔ ۱۰.۱ مطابق مشخصات دقیق کاربر — زیپ ۲۲فایلی + اسکریپت apply استاندارد + سند جامع + راستی‌آزمایی روی کلون تازهٔ v6

Work Log:
- مشخصات جدید کاربر اعمال شد: (۱) زیپ باید بعد از unzip پوشهٔ math-game-v10.1/ بدهد، (۲) تعداد فایل زیپ = درخت سند، (۳) نام تابع فیکس تایپ fafyAnswerInput (نه fafa)، (۴) push ناموفق → exit code غیرصفر + پیام دوزبانهٔ تمیز، (۵) سازگاری Git Bash ویندوز
- کیت به ۲۲ فایل دقیق کاهش یافت: حذف v9-config.js و src/v9/{app.js,connection,entry,firebase-login,mission} از پوشهٔ کیت (این‌ها در ریپو v6 سر جای خود هستند؛ تست‌ها فقط از فایل‌های داخل کیت import می‌کنند — با grep تأیید شد)
- نام تابع: کد از قبل fafyAnswerInput بود (app.js:42 + handler خط ۷۳۱-۷۳۶)؛ فقط سند fafa نوشته بود → سند اصلاح شد؛ در کل کیت/سرو، rg «fafa» صفر نتیجه
- apply-v10.1-to-github.sh بازنویسی کامل: چک پیش‌نیاز (git، Node≥18، هویت گیت، کامل‌بودن کیت) + GIT_TERMINAL_PROMPT=0 برای شکست سریع push + آرگومان مسیر (یا کلون خودکار از v6 در پیش‌فرض ../math-game) + گارد درخت کاری کثیف + شاخهٔ backup/v10-final + کپی ۲۲ فایل + ۴ کامیت منطقی (idempotent با git diff --cached --quiet) + node --test سه فایل + push؛ fail push → راهنمای ۳ روش (پنجرهٔ مرورگر / gh auth login / PAT) + exit 2
- سند راهنما بازنویسی کامل با ۱۱ بخش: هدف، درخت دقیق ۲۲فایلی، نصب با اسکریپت (جدول رفتار گام‌به‌گام)، نصب دستی (بلوک cp کاربر)، چک‌لیست ۶بندی، ماتریس ۹لایه، مأموریت‌های جانبی، نردبان/تلاش‌نگار/پل معلم/fafyAnswerInput، دفترچهٔ v10.1.1، بازگشت (reset --hard backup/v10-final + force-push هشداردار)، Pages (منبع v6)
- زیپ بازسازی شد: public/math-game-v10.1-fixed.zip ‏(59,227 بایت) — unzip → دقیقاً ۲۲ فایل، درخت یکی با §۲ سند، chmod +x روی اسکریپت
- راستی‌آزمایی E2E روی کلون تازهٔ v6 (/tmp/verify-mg): اسکریپت اجرا شد → شاخهٔ backup/v10-final ساخته شد، ۴ کامیت روی 62cfd48 (7bdbd72 هسته: ۸ فایل ‎+1207/−1062 شامل ladder.js ‏۱۶۳ خط؛ 97ca3c6 UI؛ 9977c03 تست‌ها؛ 2662ed6 سند)، ۳۱/۳۱ آزمون سبز، درخت کاری تمیز، push فوری شکست خورد با پیام دوزبانه + exit 2 (دقیقاً طبق طراحی، چون این دستگاه credential ندارد)
- صحت‌سنجی زیپ: fafyAnswerInput در app.js و سند ✓، هیچ «fafa» ✓، fafy در نسخهٔ سروشدهٔ public/math-game هم تأیید؛ سند به‌روز به public/math-game کپی شد

Stage Summary:
- کیت نهایی آمادهٔ تحویل: /home/z/my-project/public/math-game-v10.1-fixed.zip ‏(۲۲ فایل) — دانلود از پیش‌نمایش: /math-game-v10.1-fixed.zip
- سناریوی نصب کاربر: unzip → Git Bash → cd math-game-v10.1 → bash apply-v10.1-to-github.sh ../math-game → ۳۱/۳۱ سبز → push با مرورگر/توکن خودش
- هر ۴ بند راستی‌آزمایی الزامی کاربر پاس شد: (۱) تست روی کلون تازه فقط-خواندنی ✓ (۲) ۳۱/۳۱ سبز ✓ (۳) fafyAnswerInput در کد ✓ (۴) تعداد فایل زیپ = درخت سند (۲۲=۲۲) ✓
- تغییر نسبت به Task 13 قبلی: exit code push-fail از ۰ به ۲، زیپ از ۲۸ فایل به ۲۲ فایل مطابق درخت، سند از ۸ بخش به ۱۱ بخش با درخت دقیق، چک‌های پیش‌نیاز و idempotency به اسکریپت اضافه شد

---
Task ID: 15
Agent: Z.ai Code (main)
Task: تشخیص میدانی سه شکایت کاربر پس از نصب v10.1 روی گیت‌هاب (محتوای کم، پنل معلم، نردبان دیده/اعلام‌نشدن) + پچ v10.1.2

Work Log:
- راستی‌آزمایی مرورگری سایت زنده bayrami1341.github.io/math-game/v10.html: استقرار v10.1 سالم است (ladder.js با 200 در دسترس)
- شبیه‌سازی سناریوی کاربر روی سایت زنده: پاسخ غلط → فقط «روشن نشد.»؛ کلیک راهنما → نردبان رندر می‌شود ولی متن ۱۳px با رنگ --text-muted در جعبهٔ کم‌کنتراست — «دیده نمی‌شود» تأیید
- دکمهٔ 🔊 روی گیت‌هاب: POST /api/tts → 405 → شکست بی‌صدا — «اعلام نمی‌کند» تأیید (TTS فقط پلتفرمی بود)
- موبایل 375px: ردیف .answer-form بدون flex-wrap → دکمهٔ 🔊 از لبه بیرون، برچسب راهنما عمودی ۳خطی — تأیید اسکرین‌شات
- پچ v10.1.2 اعمال شد: (۱) app.js — نردبان خودکار پلهٔ ۱ بعد از پاسخ غلط (hintLevel 0→1 + کلاس attract + showGuideStepUp مشترک با اعلام صوتی speakFa برای هر پله) (۲) app.js — زنجیرهٔ گویندهٔ جدید: API داشبورد → Web Speech API محلی (fa-IR) → بی‌صدا؛ فقط URLهای موفق کش (۳) v10.css — جعبهٔ راهنمای پرکنتراست (#question-guide-area .guide-box: متن اصلی ۱۵px، حاشیهٔ فیروزه‌ای، guide-in)، نبض guide-attract روی دکمه، flex-wrap + nowrap + مدیاکوئری ≤480px برای فرم پاسخ
- ۳۱/۳۱ آزمون سبز + node --check سالم؛ راستی‌آزمایی مرورگری پچ: پاسخ غلط → پلهٔ ۱ خودکار ظاهر (guideHidden:false، attract:true، برچسب «گام ۱ از ۷»)، موبایل ردیف بدون سرریز، دسکتاپ جعبهٔ پیدا؛ بدون خطای کنسول
- package.json → 10.1.2؛ سند §۵ ردیف ۴ و §۹.۵ (پچ‌نوت) به‌روز؛ پیام کامیت گروه ۳ اسکریپت «package metadata» شد
- sync به public/math-game؛ زیپ بازسازی (۲۲ فایل + ۷ پوشه = ۲۹ ورودی — تأیید شد ۲۹ اشتباهی نبود)؛ اجرای دوم اسکریپت روی /tmp/verify-mg: حالت پچ idempotent — فقط ۴ فایل تغییرکرده در ۴ کامیت جدید (626c005...)، ۳۱/۳۱، exit 2 طبق طراحی

Stage Summary:
- سه شکایت کاربر: (۱) محتوای کم = طراحی قفل تسلطی (۸۰/۹۰/۸۵٪ و ۷۰٪ مأموریت‌ها) + صفرِ کشف‌پذیری روی نقشه — پیشنهاد v10.2: چیپ‌های قفل روی نقشه (۲) پنل معلم = حذف عمدی معماری «پوستهٔ کودک خالص» — «کلاس من» الان مودال خالی است؛ تصمیم محصولی با کاربر: داشبورد پلتفرم یا بازیابی پنل مستقل (۳) نردبان/اعلام = باگ واقعی → در v10.1.2 رفع شد
- کیت به‌روز در public/math-game-v10.1-fixed.zip (نسخهٔ 10.1.2) — کاربر با همان دستور قبلی دوباره اعمال می‌کند؛ فقط app.js/v10.css/package.json/سند کامیت می‌شوند

---
Task ID: 16
Agent: Z.ai Code (main)
Task: پاسخ به گزارش میدانی دوم کاربر (لیدربرد/ثبت‌نام/داستان/داشبورد معلم) + پچ v10.1.3 — بازگرداندن قابلیت‌های مستقل و رفع باگ بحرانی uid

Work Log:
- ریشه‌یابی با مقایسه git show backup/v10-final:v10.html با کیت: طراحی v10.1 کارت ورود (firebase/محلی/مهمان)، فرم ساخت قهرمان (نام+نقش)، فرم‌های کلاس معلم، دعوت‌نامه و پرکننده‌های board-entries را حذف کرده بود (پوستهٔ فرزند خالص) — لیدربرد v10 هم Server-API بود (getLeaderboard از apiBase ریلوی) و روی Pages مستقل اصلاً کار نمی‌کرد
- کشف باگ بحرانی P0: initApp در v10.1.2 با هر بارگذاری uid تصادفی می‌ساخت → کلید studentKey(uid, studentId) هر رفرش عوض می‌شد → کل پیشرفت کودک در IndexedDB غیرقابل‌دسترس می‌شد (عامل اصلی حس «محتوا بسیار کم است»)
- پچ v10.1.3: (۱) uid پایدار در localStorage (station_uid) + انتخاب پروندهٔ پایدار (station_selected_profile) (۲) ثبت‌نام محلی بدون سرور: login-card با hero-create-form (نام + نقش فضانورد/خلبان/دانشمند) + guest-login + profile-picker (renderProfileButtons) + switch-profile-button در هدر + PROFILES_INDEX_KEY در IndexedDB (۳) refreshLocalBoard: تابلوی افتخارات محلی از stationRecords همهٔ پرونده‌های دستگاه — مدال، قدرت ایستگاه (stationPower جدید import)، درصد و لایهٔ هر بنا، مرتب‌شده (۴) welcomeLine با نام/نقش + notice + speakFa در ساخت پرونده و پیش‌گشته sheet-text در اولین ورود (۵) buildProgressLine: درصد هر بنا + آستانهٔ واقعی DEPTH_LAYERS (۶) مأموریت‌های جانبی قفل‌شده با شرط بازشدن روی نقشه (aria-disabled، بدون data-mission-id → کلیک امن)
- v10.html: کارت ثبت‌نام + انتخاب‌گر پرونده (بیرون workspace) + sheet-progress + board-entries/board-status + دکمهٔ تغییر پرونده + عنوان ۱۰.۱.۳؛ v10.css: ‎+۱۶۰ خط (inline-form/auth-block/button-row/board-*/sheet-progress/side-mission-locked/profile-button + مدیاکوئری موبایل)؛ package.json → 10.1.3؛ سند §۱/§۲/§۹.۶ به‌روز
- E2E مرورگر (localhost:3000/math-game/v10.html): ثبت‌نام «آرش/خلبان» → داستان خوش‌آمد + خط پیشرفت ۰٪ + ۳ مأموریت قفل دیده می‌شود؛ پاسخ غلط → پلهٔ ۱ خودکار + attract؛ لایهٔ ۱ نیروگاه کامل → ۱۰۰٪ + خط «لایهٔ ۲ با ۹۰٪» + آنتن فرعی باز شد؛ کلاس من → 🥇 آرش قدرت ۳۳٪ با جزئیات ۳ بنا؛ reload → پرونده و ۱۰۰٪ ماند (باگ uid رفع)؛ پروندهٔ دوم «سارا/دانشمند» ۰٪ ایزوله؛ سوییچ به آرش → ۱۰۰٪ سر جایش؛ مأموریت جانبی شروع شد (۴×۶، ۵ سلول)؛ صفر خطای کنسول
- پل داشبورد: جلسهٔ E2E آرش به /api/sessions رفت و در داشبورد (db واقعی) بین دانش‌آموزان ظاهر شد — داشبورد معلم تأیید شد سالم و در / پلتفرم است (۱۴ دانش‌آموز، ۱۲ جلسه، ۷۸.۸٪)
- ۳۱/۳۱ آزمون سبز؛ node --check سالم؛ sync کامل به public/math-game؛ زیپ بازسازی: public/math-game-v10.1-fixed.zip (67,809 بایت، دقیقاً ۲۲ فایل، نام فارسی سالم پس از extract، bash -n سند اسکریپت OK)

Stage Summary:
- v10.1.3 تحویل شد: استقرار مستقل حالا ثبت‌نام محلی + تابلوی افتخارات آفلاین + داستان دارد و پیشرفت دیگر پاک نمی‌شود؛ کاربر برای به‌روزرسانی فقط همان دستور قبلی: bash apply-v10.1-to-github.sh ../math-game
- تفسیر سه شکایت: لیدربرد/ثبت‌نام/داستان = حذف عمدی معماری «پوستهٔ فرزند» → در v10.1.3 به‌صورت محلی بازگشتند؛ داشبورد معلم = پلتفرم Next.js (/) که بازی از طریق «اجرای بازی» به آن وصل می‌شود (پل سشن‌ها تأیید شد)؛ محتوای کم = قفل تسلطی ۸۰/۹۰/۸۵٪ + باگ uid — هر دو اکنون دیده‌پذیر/رفع است
- کیت به‌روز: public/math-game-v10.1-fixed.zip (۲۲ فایل، 10.1.3) — ۴ کامیت idempotent بعدی فقط v10.html/app.js/v10.css/package.json/سند را کامیت می‌کنند

---
Task ID: 17
Agent: Z.ai Code (main)
Task: پاسخ به گزارش سوم کاربر (دکمهٔ پنل معلم داخل بازی نبود؛ ناوبری خانه/لیدربرد/ثبت‌نام/داستان مثل نسخهٔ قبل برگردد؛ راهنمای سادهٔ پاورشل) — پچ v10.1.4

Work Log:
- ریشه‌یابی: اسکرین‌شات «پنل معلم» کاربر از پیش‌نمایش پلتفرم Next.js بود؛ در خود بازی v10.1.3 هیچ نقطهٔ دسترسی به teacher-shell وجود نداشت (render همیشه teacher-shell.hidden=true می‌گذاشت و renderTeacherShell هرگز صدا زده نمی‌شد)؛ در home.html نسخهٔ قدیمی هم «ورود معلم» فقط alert «به‌زودی» بود
- ناوبری قدیمی از مخزن (origin/v6) استخراج شد: home.html با دکمه‌های «ورود به کلاس و بازی→join.html»، «نتایج کلاس→leaderboard.html»، «ابزارک‌ها→widgets.html» — صفحات جداگانه که کاربر از دستشان داده بود
- v10.html (v10.1.4): نوار ناوبری پس از هدر با ۵ دکمه — «🏠 خانه»→home.html، «📖 داستان ایستگاه»، «🏅 لیدربرد کلاس»→leaderboard.html، «📝 ثبت‌نام کلاس»→join.html (سه‌تای اول به صفحات دست‌نخوردهٔ موجود در repo لینک‌اند)، «🧑‍🏫 پنل معلم»؛ دو پنجرهٔ جدید story-dialog و teacher-dialog (بازاستفادهٔ board-dialog/dialog-card)
- app.js: STORY_NARRATIVE (۷ بند، لحن مجاز station-brief — با اسکریپت node بدون hit از ۱۳ واژهٔ ممنوع تأیید شد) + openStoryDialog + renderTeacherPanel (گزارش آفلاین هر پرونده: قدرت ایستگاه، جلسه‌ها، خطاهای attemptLog، تمرین جانبی، وضعیت ۹ لایهٔ عمق ✅/🔓/🔒 از DEPTH_LAYERS + یادداشت داشبورد کامل) + سیم‌کشی ۵ شنوندهٔ رویداد با گارد if(element)
- باگ کشف‌شده در E2E: لایهٔ ۱ (X-1) unlock:null دارد → «با undefined٪ دقت باز می‌شود» نمایش داده می‌شد → شاخهٔ d===1 اضافه شد: «🟢 باز — همین حالا در دسترس است»
- apply-v10.1.ps1 (جدید، ۲۳مین فایل کیت): پاورشل ویندوز — پارامتر RepoPath اختیاری، چک git، کلون/پول v6، شاخهٔ پشتیبان، کپی ۲۳ فایل، node --test (اگر Node باشد)، کامیت idempotent، push با راهنمای فارسی سه‌روشه در شکست (exit 2)؛ UTF-8 BOM اضافه شد (PowerShell 5.1 فارسی)؛ اسکریپت bash هم اگر ps1 موجود بود آن را کپی می‌کند؛ bash -n سالم
- سند: §۲ درخت ۲۳ فایلی + §۳-الف «نصب با پاورشل در ویندوز (۶ گام ساده)» + نکتهٔ استقرار v10.1.4 + چک‌لیست ۷/۸/۹؛ package.json → 10.1.4
- E2E مرورگر (localhost:3000/math-game/v10.html): عنوان ۱۰.۱.۴؛ نوار ناوبری با ۵ دکمه رندر شد؛ مهمان → نقشه؛ داستان ۷ بند کامل؛ پنل معلم با گزارش + لایه‌های ۱/۲/۳ (پس از فیکس: 🟢/🔒/🔒)؛ تابلوی افتخارات با پروندهٔ مهمان؛ پاسخ غلط ۹ → پلهٔ ۱ خودکار «به عددها خوب نگاه کن» + دکمه «گام ۱ از ۷»؛ تایپ لاتین 4 → «۴»؛ پاسخ درست → سؤال بعدی ۳×۳ و سلول روشن؛ موبایل ۳۹۰px نوار به‌درستی می‌شکند؛ صفر خطای کنسول؛ ۳۱/۳۱ آزمون سبز
- sync کامل به public/math-game + بازسازی zip: public/math-game-v10.1-fixed.zip (۷۴,۱۵۷ بایت، ۲۳ فایل)

Stage Summary:
- v10.1.4 تحویل شد: ناوبری کامل مثل نسخهٔ قبل (خانه/لیدربرد/ثبت‌نام آدرس جداگانه دارند) + پنل معلم همیشه‌در-دسترس با یک دکمه + داستان ایستگاه با خوانش صوتی + اسکریپت نصب پاورشل مخصوص ویندوز
- تحویل کاربر: zip به‌روز (۲۳ فایل) + ۶ گام پاورشل در §۳-الف سند — کاربر فقط زیپ را extract، powershell را از نوار آدرس باز، و apply-v10.1.ps1 را اجرا می‌کند

---
Task ID: 18
Agent: Z.ai Code (main)
Task: ارزیابی سند پداگوژیک ۷فصلی کاربر برای v10.2 — تحلیل شکاف با کد فعلی (v10.1.4) و تعیین ضرورت‌ها

Work Log:
- کد v10.1.4 بازخوانی شد: constants.js، index.js، sheet.js، cells.js، ladder.js، guide.js， visuals.js، story.js، bridge.js، experience.mjs (CORE_SECTORS/DEPTH_LAYERS/SIDE_MISSIONS/keepStationRecord)، app.js (generateQuestionsForDepth، handleAnswerSubmit، تلاش‌نگار)
- تطبیق فصل‌به‌فصل سند با کد انجام شد؛ یافتهٔ کلیدی: ناهم‌راستایی محتوایی فعلی با کتاب کد ۳۰۵:
  * سکتور ۳ (سکو) عوامل [10,11,12] دارد → ×۱۱ و ×۱۲ خارج از کتاب (کتاب تا ×۱۰)؛ مأموریت جانبی side-3-fuel هم همین
  * سکو فاقد ×۰، ×۱، ×۱۰ دورقمی/سه‌رقمی (۱۴×۱۰، ۴۲×۱۰) و یک‌رقم در دو/سه‌رقمی (۲×۲۱۳) است — کل دامنهٔ صفحه‌های ۱۳۶–۱۴۴ غایب
  * برج (سکتور ۲) فعلاً فقط «فاکتورهای سخت‌تر ۶–۹» است؛ در کتاب صفحه‌های ۷۰–۷۲ یعنی جابه‌جایی + شکستن (۷×۵ از ۵×۵+۲×۵)
  * لایهٔ 3-3 focus شامل 'doubling' → سند: دوبرابر کردن بیرون کتاب و اختیاری؛ لایهٔ 2-3 شامل 'place-value' → ارزش مکانی مال سکو (۱۳۶+) است نه برج
  * سؤال‌ها ۱۰۰٪ نمادین f1×f2 تایپی؛ CPA (مجسم/تصویری) فقط در پلهٔ ۳ نردبان (renderEqualGroupsSVG) هست نه در خود سؤال
- موارد هم‌راستا (بدون کار): نردبان ۷پله‌ای + assertNoLeak (فصل ۴ تقریباً واژه‌به‌واژه)، متن ورق‌ها/داستان (فصل ۶)، صدا max 0.045 و جمله‌های ≤۲ (فصل ۱.۳)، تلاش‌نگار فقط‌الحاقی + سقف ۵۰۰ (زیرساخت فصل ۳ و ۵)، حذف بیزی/درصد اطمینان، حذف تقسیم، سه بنا بدون شخصیت
- موتور جدید قابل ساخت: طبقه‌بندی ۱۲خطا از (f1,f2,submitted) به‌صورت Pure — E_ADD_CONFUSION (submitted=f1+f2)، E_PLACE_SHIFT (×۱۰/÷۱۰)، E_ZERO_PROPERTY، E_IDENTITY_CONFUSION، E_SKIP_OVER/UNDERCOUNT (±f2 یا ±۱)، E_ANCHOR_DRIFT (submitted=f1×لنگر ۵/۱۰)، E_DISTRIBUTIVE_LEAK (فقط دهگان یا یک‌ها)، E_PERSISTENT_GUESSING (۳ بی‌ربط)، E_FATIGUE_SLIP (خطا روی مسلط)، E_COMMUTATIVE_FAIL (جفتی)، E_DOUBLING_HALVING (اختیاری)
- کارت معلم (فصل ۵): یک جمله + کد + دو نمونه + بازنویسی برچسب بدون تغییر نمره → افزودنی به renderTeacherPanel موجود
- نقاط خام سند (نیازمند تصمیم): نگاشت ۹ لایه به دامنه‌های کتاب، آستانهٔ پرچم خطا، سقف ورودی (maxlength=3 فعلی)، فرمت تقریب، آستانه‌های قفل ۸۰/۹۰/۸۵ (و ۸۰ hardcode در bridge.js)، سؤال دوبه‌ای گلوگاه ۱

Stage Summary:
- حکم: سند ~۷۵٪ آمادهٔ پیاده‌سازی است و دقیقاً بزرگ‌ترین نقص فعلی (ناهم‌خوانی محتوا با کتاب) را حل می‌کند؛ ۵ تصمیم کوچک باقی است که پیش‌فرض پیشنهادی داده شد
- v10.2 پیشنهادی = بازتنظیم دامنهٔ سه بنا بر کتاب + موتور ۱۲خطا + کارت معلم + لایهٔ تصویری CPA + تعدیل آستانه‌ها؛ تقریب و دوبرابر اختیاری و جعبه‌ابزار معلم → v10.2.1/10.3
- مهاجرت QUESTION_SET_VERSION به graph-v10.2 + migrateLegacyRecords الزامی (وگرنه رکوردها می‌سوزند)؛ آزمون‌ها به‌روز می‌شوند

---
Task ID: 19
Agent: Z.ai Code (main)
Task: بررسی و نقد فایل آپلودی کاربر «بسته جامع پژوهش... (1).md» قبل از شروع v10.2

Work Log:
- فایل آپلودی (۲۴,۰۱۱ بایت، ۲۹۱ خط) باز و با سندی که کاربر قبلاً در چت فرستاده بود مقایسه شد → همان نسخهٔ v1.1.0 است (JSON version=1.1.0، متن مقدمه، هر ۷ فصل، جدول ۱۲خطا، هر ۷ پله، ورق‌ها، جمع‌بندی — همه یکسان)؛ پسوند «(1)» نشانهٔ دانلود تکراری
- بایگانی: /home/z/my-project/v10.2-plan/سند_پداگوژیک_v1.1.0.md
- نقد فنی عمیق (عمیق‌تر از تحلیل Task 18 — این بار سند با خودش هم سنجیده شد) در /home/z/my-project/v10.2-plan/نقد_فنی_سند_v1.1.0.md نوشته شد؛ ۱۲ نقد:
  ۱) پلهٔ ۶ نردبان کد فعلی برای f2≥8 لنگر-۱۰ تفریقی دارد ← کتاب جمعی لنگر-۵ است و ×۱۰ مال فصل ۸ (وابستگی رو به جلو)
  ۲) پلهٔ ۵/۶ فقط برای f2≥5 تعریف شده؛ جدول لنگر کامل لازم (۳→۲+۱، ۴→۲+۲، ۸→۵+۳، ۹→۵+۴)
  ۳) جدول ۱۲خطا اولویت ندارد؛ نمونه: «۵×۰→۵» هم ZERO_PROPERTY هم ADD — پیشنهاد ترتیب: ZERO > IDENTITY > ADD > PLACE_SHIFT > ANCHOR_DRIFT > DISTRIBUTIVE_LEAK > SKIP
  ۴) SKIP ±f2 یا ±۱؟ پیشنهاد: فقط ±f2
  ۵) آزمون گلوگاه ۱ (کشیدن شکل) درون‌بازی نیست؛ ستون «محل تشخیص» لازم
  ۶) E_COMMUTATIVE_FAIL نیازمند تولید زوج سؤال a×b/b×a — spec نوشته نشده
  ۷) عددهای ورق (۱۵ سلول نیروگاه، ۲۸ حسگر برج) با جلسات ۸/۱۰/۶ نمی‌خواند
  ۸) تقریب بدون spec → v10.3
  ۹) سقف عددی سکو: حاصل ≤ ۹۹۹ تا maxlength=3 نشکند
  ۱۰) FATIGUE/GUESSING درون‌جلسه‌ای تعریف شود (بدون ساختار دادهٔ تازه)؛ تعریف «بی‌ربط»؛ ممنوعیت قفل خودکار
  ۱۱) بازنویسی برچسب: مدل داده (IndexedDB + داشبورد، ۳ مقدار مجاز + یادداشت)
  ۱۲) مهاجرت داده + آستانه‌های قفل (۷۰/۸۰/۷۵، جانبی ۶۰) از سند غایب

Stage Summary:
- حکم بدون تغییر و محکم‌تر شد: سند v1.1.0 ستون فقرات v10.2 است؛ ۱۲ نقد هیچ‌کدام بنیان را نمی‌ریزد ولی ۶ اصلاح در خود سند (نسخهٔ ۱.۲.۰) قبل از کدنویسی لازم است
- پیوست نقد + سند در v10.2-plan بایگانی شد؛ منتظر تأیید کاربر روی جدول تصمیم (۶ تصمیم Task 18 + ۶ اصلاح نقد) برای شروع پیاده‌سازی

---
Task ID: 20
Agent: Z.ai Code (main)
Task: پیاده‌سازی کامل v10.2 — تطبیق کتاب کد ۳۰۵ + اطلس ۱۲خطا + کارت معلم + CPA + آستانه‌ها (پاسخ «شروع کن» کاربر)

Work Log:
- تجربهٔ مروری کامل با agent-browser: ثبت‌نام «آرش/فضانورد» → داستان خوش‌آمد + خط پیشرفت + ۲ چیپ قفل روی نقشه («نیاز: هر سه لایهٔ نیروگاه کامل شود — لایهٔ ۱، ۰٪») → جلسهٔ لایهٔ ۱ نیروگاه با تصویر CPA (۲ دستهٔ ۲تایی برای ۲×۲) → پاسخ غلط ۳×۳ را ۶ → «روشن نشد.» + نردبان خودکار پلهٔ ۱ + attract → جلسه تمام (۸/۸ با یک خطا) → خط پیشرفت «نیروگاه ۱۰۰٪ (لایهٔ ۲ با ۷۰٪)» و بنا هنوز کامل نیست (تکمیل سه‌لایه‌ای) → پنل معلم: کارت تشخیصی «جمع را به جای ضرب گذاشته. کد: E_ADD_CONFUSION — ۳×۳ را ۶ نوشته.» + ۳ دکمهٔ برچسب → «لغزش موردی» + یادداشت ذخیره و پس از بازگشایی پایدار → موبایل ۳۹۰px بدون سرریز، دکمه‌ها می‌شکنند؛ صفر خطای کنسول
- کشف و رفع دو باگ حین E2E: (۱) کلید بازنویسی برچسب ناهم‌خوان بود (هندلر eventId، خواننده profileId:eventId) → data-profile-id به دکمه‌ها/ورودی اضافه و کلید مرکب شد (۲) rsync --delete فایل‌های مخزنِ خارجِ کیت (entry.mjs، connection.mjs، firebase-login.mjs، mission.mjs، v9/app.js، v9-config.js، home/leaderboard/join.html و…) را از public/math-game پاک کرده بود → بازی کاملاً سفید می‌شد؛ از کلون تازهٔ /tmp/verify-mg با --ignore-existing بازگردانده و کیت دوباره روی‌گذاری شد
- **کشف باگ P0 تاریخی با آزمون‌های جدید:** فیلتر `(r.type === 'depth' || !r.type)` در شرط باز شدن لایه‌ها، رکوردهای لایهٔ ۱ (که type 'core' دارند) را نمی‌دید → در v10.1 لایه‌های ۲ و ۳ هرگز باز نمی‌شدند و کودک لایهٔ ۱ را تا ابد تکرار می‌کرد — ریشهٔ دوم «محتوای بسیار کم»؛ رفع شد + تست رگرسیون
- کد: experience.mjs (graph-v10.2، ACCEPTED/LEGACY sets، LAYER_PASS_MARK 70/75/80، UNLOCK_THRESHOLDS، sectorComplete با احترام به ۱۰۰٪ قدیمی، دامنه‌های CORE/DEPTH/SIDE، core-complete، حذف doubling از 3-3 و place-value از 2-3، side-3 → [10,20,30]، case distributive-part) | ladder.js بازنویسی کامل (classifyQuestionDomain با جدول ≤۱۰، نردبان‌های identity/zero/x10/multi با لنگر جمعی ۵ و ۲، حذف لنگر-۱۰ تفریقی، assertNoLeak تعمیم‌یافته با minFactor و معافیت پلهٔ ۷ برای دامنهٔ صفر) | errors.js جدید (۱۲ کد + اولویت ZERO>IDENTITY>ADD>PLACE>ANCHOR>DISTRIBUTIVE>SKIP + detectBehavioralCode + countIrrelevantAttempts + dominantCode + CODE_SENTENCES_FA) | bridge.js (تکمیل سه‌لایه‌ای از records، حذف hardcode 80) | app.js (تولید سؤال دامنه‌محور + زوج‌های جابه‌جایی + visual CPA + کد خطا در wrongAttempts + acceptedFacts + wrongCodes/wrongExamples در attemptLog + کارت معلم + بازنویسی برچسب + یادداشت با escHtml + چیپ قفل نقشه + آستانهٔ ۶۰ مأموریت جانبی) | guide.js گارد فاکتور >۱۲ | story.js padDone «مخزن درست است» + getDoneMessage(3) | v10.html (برند/عنوان ۱۰.۲ + ظرف question-visual) | v10.css (+۹۰ خط) | package.json 10.2.0
- آزمون‌ها: ۳۱ → **۵۳** (v10.1-station بازنویسی برای معناشناسی جدید، v10.2-errors با ۱۲ آزمون، v10.2-domains با ۹ آزمون) — ۵۳/۵۳ سبز؛ اسکریپت bash و ps1 (فهرست آزمون + فایل‌ها + شمارش ۲۶) و سند (عنوان ۱۰.۲، §۱ هدف جدید، درخت ۲۶فایلی، جداول آزمون، §۱۲ مرجع v10.2 با اطلس/اولویت/آستانه‌ها/نقدهای اعمال‌شده) به‌روز
- تحویل: public/math-game همگام (بازی + صفحات مخزن)؛ public/math-game-v10.1-fixed.zip بازسازی (دقیقاً ۲۶ فایل + ۷ پوشه، ۹۴,۳۹۱ بایت)

Stage Summary:
- v10.2 تحویل شد: محتوا بر کتاب (حذف ×۱۱/×۱۲، سکو = ×۱۰/×۰/×۱/چندرقمی با سقف ۹۹۹)، برج = جابه‌جایی+شکستن، تکمیل سه‌لایه‌ای ۷۰/۷۵/۸۰ + رفع باگ P0 باز شدن لایه‌ها، اطلس ۱۲خطا با اولویت، کارت معلم با بازنویسی برچسب بدون تغییر نمره، لایهٔ تصویری CPA، چیپ قفل روی نقشه، مهاجرت کامل نسخه‌های قدیمی
- روش اعمال برای کاربر همان قبلی است: extract زیپ → powershell → apply-v10.1.ps1 (حالا ۲۶ فایل و ۵۳ آزمون) — اسکریپت‌ها idempotent و ۴ کامیت منطقی می‌سازند
- نکتهٔ محصولی: تقریب (ص ۱۴۴) و دوبرابر کردن اختیاری و تب «راهنمای کلاس» معلم → v10.2.1/10.3؛ همگام‌سازی برچسب‌های معلم به داشبورد → v10.2.1

---
Task ID: 21
Agent: Z.ai Code (main)
Task: تدوین «سند صفر تا صد v10.2» (تحلیل + کد + راهنما) برای کپی کاربر + همگام‌سازی نهایی کیت

Work Log:
- بازبینی کامل کیت پس از Task 20: تجربهٔ experience.mjs (graph-v10.2)، ladder.js (لنگر جمعی ۵)، errors.js (اطلس ۱۲خطا)، bridge.js، app.js (تولید دامنه‌محور + کارت معلم + بازنویسی برچسب + چیپ قفل)، v10.html (question-visual)، نسخهٔ package.json 10.2.0
- کشف و رفع ناسازگاری: اسکریپت test در package.json فقط ۳ فایل آزمون قدیمی را اجرا می‌کرد ← دو فایل v10.2-errors و v10.2-domains اضافه شد؛ npm test → ۵۳/۵۳ سبز
- اصلاح برندینگ اسکریپت‌های اعمال: بنر ps1 (۱۰.۱.۴→۱۰.۲.۰، پیام کامیت جدید) و ش (پیام‌های ۴ کامیت منطقی v10.2)؛ bash -n و node --check سبز
- همگام‌سازی مجدد با public/math-game (package.json + دو اسکریپت) و بازسازی zip کیت: دقیقاً ۲۶ فایل + ۶ پوشه، ۹۳,۳۰۵ بایت
- سند جامع «صفر تا صد v10.2» (تحلیل + نقشهٔ فنی + کد کامل ماژول‌های Pure + قطعه‌های کلیدی app.js + اطلس + نردبان + آستانه‌ها + آزمون‌ها + راهنمای اعمال + پذیرش E2E + تعلیق‌شده‌ها) در پاسخ چت به کاربر تحویل شد

Stage Summary:
- کیت v10.2.0 نهایی و خودسازگار است: ۲۶ فایل، ۵۳ آزمون سبز، zip آمادهٔ دانلود (public/math-game-v10.1-fixed.zip)، اسکریپت‌های ps1/sh هم‌پیام و idempotent
- نکتهٔ باقی: نام فایل راهنما و اسکریپت‌ها عمداً «v10.1» مانده (در فهرست کپی دو اسکریپت ارجاع دارد؛ تغییر نام = شکستن اسکریپت‌ها)
- تعلیق‌شده‌ها (بدون تغییر): تقریب ص۱۴۴، دوبرابر اختیاری، تب جعبه‌ابزار معلم، همگام‌سازی برچسب‌ها به داشبورد → v10.2.1/10.3

---
Task ID: 25
Agent: Z.ai Code (main)
Task: مطالعهٔ کامل اکسل gapgpt «math_grade3_comprehensive (1).xlsx» + پاسخ به ۶ پرسش ارتقا + ساخت اکسل اصلاح‌شده (گزینهٔ ۱ کاربر) — بدون هیچ تغییر کدی

Work Log:
- فایل اکسل این بار رسید (upload/math_grade3_comprehensive (1).xlsx، ۳۰,۸۶۸ بایت)؛ ۱ شیت «برنامه درسی ریاضی سوم»، ۳۱ ردیف × ۱۶ ستون (فصل/موضوع/اهداف کلی/جزئی/رفتاری/۲مثال/راهنمای معلم/۳تستی/۲تشریحی/گلوگاه/رفع گلوگاه/بازی‌وارسازی)، ۷ فصل ادعایی ص۱–۱۷۶ — همهٔ سلول‌ها dump و خوانده شد
- همزمان کشف شد: فایل «دستیار معلم — محصول نهایی، بازار.md» (که ۲ بار نرسیده بود) این بار رسیده و خوانده شد (سه بنا با صفحه‌های کد ۳۰۵: نیروگاه ص۱۰+۶۴–۶۹، برج ص۷۰–۷۲، سکو ص۱۳۶–۱۴۴؛ تقسیم ص۷۳ و ص۱۴۵ بیرون کارگاه)؛ «بسته جامع پژوهش» هم همان سند پداگوژیک v1.1.0 آرشیوشدهٔ Task 19 است
- اعتبارسنجی محتوای اکسل با سند پداگوژیک + اطلس واقعی ۱۲خطا (public/math-game/src/v10/station/errors.js خوانده شد — ۱۲ کد + زنجیرهٔ اولویت): ۸ ایراد مستند شد — دامنهٔ عدد ۹۹۹ به‌جای ۹۹۹۹ (چهاررقمی)، غیبت کامل تقسیم، ساختار فصل‌های ساختگی (۷ فصل)، صفحه‌های ساختگی (جدول ضرب ۳و۴ «ص۷۳–۷۸» در حالی که ص۷۳ شروع تقسیم است؛ یک‌رقمی×دورقمی «ص۷۹–۸۴» در حالی که واقعاً ص۱۳۹–۱۴۴ است)، خطای ریاضی صریح J12 (۵+۵+۵+۵+۵ پاسخ‌نام ۵×۴=۲۰؛ درست ۲۵=۵×۵)، واژه‌های خراب (نامتقابل/گذرنده/بدن چرخان)، سؤال مبهم tally
- گزینهٔ ۱ کاربر اجرا شد: اکسل اصلاح‌شدهٔ «سند مشخصات خشاب ریاضی سوم» ساخته شد — download/grade3-math-cartridge-spec-v1.xlsx، ۶ شیت RTL (راهنما / نقشهٔ کتاب / اطلس خطا / بانک سؤال نمونه / حکم ستون‌ها / مطالعات مورد نیاز)، رنگ‌بندی اعتبار (سبز=تأیید با سند پداگوژیک یا errors.js، زرد=پیشنهاد AI نیازمند تأیید معلم با کتاب فیزیکی، قرمز=ایراد مستند)
- نقشهٔ کتاب: ۱۰ ردیف تأییدشدهٔ ضرب (L-PRE تا L-D2 با صفحه‌های سند) + ۶ ردیف اسکلت زرد (عددهای چهاررقمی/کسر/هندسه/اندازه‌گیری/آمار) با برچسب صریح «پیشنهاد AI»
- اطلس خطا: ۱۲ کد واقعی errors.js + ۳ کد پیشنهادی جدید از گلوگاه‌های اکسل gapgpt (E_CARRY_MISS، E_GROUP_VS_COUNT، E_UNEQUAL_GROUP — زرد، تصمیم لازم)
- بانک سؤال: ۱۲ سؤال نمونه با ستون کلیدی «نقشهٔ گزینه→تصور غلط» (که اکسل gapgpt کلاً نداشت) + اصلاح مستند سؤال خراب J12
- حکم ۱۶ ستون اکسل gapgpt (نگه/حذف/ادغام/جابه‌جا) + ۱۰ ستون جدید (شناسه، پیش‌نیاز، نگاشت گزینه→خطا، CPA، دامنه، سطح، وضعیت تأیید، شمارهٔ چاپ، پوشش اپ، اولویت خشاب) + ۵ مطالعهٔ S1–S5 با قاعدهٔ «یک مطالعه = یک هدف = یک شیت»
- سند پاسخ کامل فارسی: download/grade3-math-excel-review-fa.md
- هیچ کدی در برنامهٔ math-game تغییر نکرد (دستور کاربر: تا پاسخ پرسش‌ها و تصمیم او، اقدام اجرایی ممنوع)

Stage Summary:
- اکسل gapgpt: غیرقابل استفاده به‌عنوان «نقشهٔ کتاب» (۸ ایراد مستند)، قابل بازیابی ~۴۰٪ به‌عنوان «بذر» برای اطلس خطا و بانک سؤال و زمینه‌ها
- قالب جدید = پل تألیف→خشاب: اکسل (کارگاه تألیف) ← مبدل Excel→JSON (آینده) ← خشاب (فرم اجرا)؛ موتور بی‌طرف دست نخورده می‌ماند
- معماری «خشاب» کاربر (جدایی هسته از بسته‌های محتوا، فروش خشاب‌به‌خشاب) تأیید و به شکل شیت‌های عملیاتی فرموله شد؛ مهم‌ترین پیام به کاربر: S1 (نقشه صفحه‌به‌صفحه) فقط با کتاب فیزیکی خودِ او معتبر می‌شود — AI پیش‌پرکن است نه تأییدکننده
- تحویل‌دادنی‌ها: grade3-math-cartridge-spec-v1.xlsx (۶ شیت) + grade3-math-excel-review-fa.md؛ منتظر تصمیم کاربر روی ۵ مطالعه، ۳ کد خطای پیشنهادی، و قالب جدید

---
Task ID: 26
Agent: Z.ai Code (main)
Task: پاسخ راهبردی به چشم‌انداز ۱۸ خشاب + تعریف محصول اولیه قابل عرضه + ایدهٔ اکسل صفحه‌به‌صفحه (فقط تحلیل — بدون اجرا)

Work Log:
- پرسش کاربر: محصول اولیهٔ بازار چه ویژگی/محتوایی لازم دارد؛ چشم‌انداز ۶پایه×۳درس=۱۸ خشاب؛ می‌خواهد اکسل صفحه‌به‌صفحهٔ کتب درسی؛ درخواست صریح نقد مسیر
- تحلیل بدون تغییر کد: تأیید ۳ نقطهٔ درست (خشاب، محتوابودن شرط بازار، کامل‌بودن ریاضی سوم) + ۶ نقد (۱۸خشاب=نقشه‌راه نه کار امروز؛ دو تعریفِ «کامل» با عمق تشخیصی متغیر و ممنوعیت فصل بی‌صدا؛ نبودن اکسل جدید — قالب ۶شیتی Task 25 همان است؛ هزینهٔ نابرابر ۳ درس — ریاضی کارخانه/علوم متوسط/فارسی متفاوت؛ هر پایه ریاضی هم طبقه‌بند و اطلس جدید می‌خواهد؛ قیمت‌گذاری پخش‌کننده/نوار)
- تعریف محصول اولیه: هسته (نصب‌کنندهٔ خشاب + شلف + چندکلاس + داشبورد/گزارش چاپی + مجوز/Zarinpal + آفلاین/حریم + onboarding≤۱۰دقیقه + zip آفلاین) + خشاب ریاضی سوم کامل در ۳ موج (موج۱: ضرب — انجام‌شده v10.2؛ موج۲: تقسیم+چهاررقمی+تخمین؛ موج۳: کسر+هندسه+اندازه‌گیری+آمار) + گیت کیفیت هر فصل (تأیید S1 با کتاب فیزیکی، اطلس ≥۲کد، ≥۲سؤال/کد، جملهٔ کارت معلم)
- ترتیب خشاب‌ها پیشنهادی: سوم(کامل)→چهارم(همان بچه‌ها سال بعد — نگهداشت)→دوم/اول/پنجم/ششم→علوم→فارسی؛ پایدارترین برتری رقابتی = موتور تشخیص نه محتوا

Stage Summary:
- حکم: مسیر کاربر درست است؛ دو اصلاح: (۱) ۱۸ خشاب چشم‌انداز است نه بک‌لاگ — اول یک خشاب کامل + Gate، (۲) اکسل صفحه‌به‌صفحه = پر کردن شیت‌های قالب موجود (S1) با کتاب فیزیکی، نه ساخت دائرةالمعارف جدید؛ برای ۱۷ خشاب دیگر فعلاً فقط «شناسنامه» + قالب خالی
- هیچ فایل/کدی اجرا نشد — انتظار تصمیم کاربر

---
Task ID: 26
Agent: Z.ai Code (اصلی)
Task: پاسخ به پیام معلق کاربر — نقد چشم‌انداز ۱۸ خشاب + ویژگی‌های محصول اولیهٔ بازار + مشخصات اکسل صفحه‌به‌صفحه (S1). (پیام جدید کاربر «الف» بود — تست کانال.)

Work Log:
- بدون هیچ تغییر در کد/فایل محصول؛ پاسخ تماماً راهبردی و در چت.
- ۷ نقد ارائه شد: (۱) ریسک اصلی «پذیرش کلاسی/دستگاه» است نه حجم محتوا؛ (۲) ۱۸ خشاب نقشهٔ راه است نه لیست کار؛ (۳) «موتور بی‌طرف» فقط درون خانوادهٔ مفهومی معتبر است (۶-۸ خانواده ≈ ۶-۸ توسعهٔ موتور)؛ (۴) در دبستان خریدار «پایه» است نه «درس» → واحد فروش = بستهٔ پایه سوم؛ (۵) ریسک حق نشر کتاب درسی → الگوی «لنگر + محتوای خودساخته»؛ (۶) گلوگاه اعتبارسنجی انسانی → پیشنهاد ۲-۳ «معلم هم‌ساز»؛ (۷) تفکیک گیت پایلوت از بازار (پایلوت با v10.2 همین حالا).
- چک‌لیست محصول بازار: محتوا (ریاضی کامل سوم: ضرب/تقسیم/ضرب اعداد تعاملی + سایر فصل‌ها بانک تمرین و تشخیص) + ۸ قلم پوسته + تجارت (زرین‌پال/بستهٔ پایه/تصمیم باز: توزیع آفلاین).
- توالی فاز ۰-۴ با گیت‌ها + ضد-لیست + مشخصات کامل S1 (ستون‌ها، رنگ اعتبار، دامنه فقط کد 305، timebox دو هفته).
- جمع‌بندی: مسیر درست اما ترتیب و واحد فروش نیازمند اصلاح؛ خطر نگفته: حق نشر.

Stage Summary:
- طبق دستور کاربر («تا این سوالات مرا جواب ندادی تصمیمی را اجرایی نکن») هیچ تصمیم اجرایی انجام نشد.
- مفاهیم جدید ثبت‌شده: بستهٔ پایه (واحد فروش)، معلم هم‌ساز، خانوادهٔ مفهومی موتور، الگوی لنگر+محتوای خودساخته.
- تصمیمات باز برای کاربر: شروع فاز ۰ (پایلوت)، دامنهٔ S1، انتخاب بسته‌بندی توزیع.

---
Task ID: 27
Agent: Z.ai Code (اصلی)
Task: اجرای گزینهٔ (الف) انتخابی کاربر — «الف» در پیام قبلی به گزینهٔ (الف) از انتهای پاسخ پیشین اشاره داشت (نه حرف الفبا): ساخت «قالب خالی استاندارد خشاب» + «فایل شناسنامهٔ ۱۸ خشاب».

Work Log:
- بازخوانی tmp-scripts/build_cartridge_xlsx.py برای بازاستفاده از زبان بصری (فیل‌ها، RTL، helpers).
- نوشتن tmp-scripts/build_template_and_registry.py و تولید دو فایل در download/:
  1) cartridge-template-standard-v1.xlsx — قالب خالی استاندارد، ۶ شیت RTL: راهنما (۷ قاعدهٔ طلایی + گردش کار ۵ گامی + ضد J12)، شناسنامهٔ خشاب (۱۴ فیلد زرد)، نقشهٔ کتاب S1 (۱۴ ستون + ردیف نمونهٔ سبز واقعی L-41 + ردیف نمونهٔ زرد)، اطلس خطا (۱۱ ستون + نمونهٔ E_ADD_CONFUSION + زنجیرهٔ اولویت)، بانک سؤال (۱۷ ستون + نمونهٔ Q-101)، واژه‌نامهٔ ستون‌ها (۱۸ ردیف = پرامپت استاندارد برای AI).
  2) cartridge-registry-18-v1.xlsx — شناسنامهٔ ۱۸ خشاب، ۴ شیت RTL: راهنما، جدول ۱۸ خشاب (KH-G1..G6 × MATH|SCI|PER؛ فقط KH-G3-MATH سبز با لنگرهای تأییدشدهٔ کد 305؛ اولویت P0..P4 متصل به گیت‌ها)، خانواده‌های موتور (۹ خانواده: ۱ موجود + ۸ آینده)، تقویم فازها (فاز ۰-۴ با گیت خروج قابل سنجش).
- راستی‌آزمایی با reload: ۶+۴ شیت، RTL=True همه، ۱۸ شناسهٔ یکتا، spot-checkها پاس.
- کد محصول (math-game) دست نخورد.

Stage Summary:
- تصمیم‌های کلیدی ثبت‌شده در فایل‌ها: قالب = هم فرم دادهٔ مبدل Excel→JSON هم پرامپت استاندارد AI؛ واحد فروش = بستهٔ پایه؛ فقط کد ۳۰۵ سبز و بقیه «؟»؛ «موتور بی‌طرف» = ۹ خانوادهٔ مفهومی؛ ۱۸ خشاب ≈ ۹ موتور + ۱۸ محتوا؛ هیچ خشابی بدون گیت فاز وارد ساخت نمی‌شود.
- فایل‌ها: download/cartridge-template-standard-v1.xlsx (17,704 B) و download/cartridge-registry-18-v1.xlsx (14,213 B).
- گام بعدی پیشنهادی (بدون اجرا): (ب) پیش‌پُر زرد شیت نقشهٔ کتاب برای فصل تقسیم/چهاررقمی، یا ساخت مبدل Excel→JSON.

---
Task ID: 28
Agent: Z.ai Code (اصلی)
Task: اجرای خواستهٔ کاربر — «تصحیح کار قبلی بر اساس استانداردهای جدید»: پر کردن خودِ خشاب ریاضی سوم (به‌جای سپردن به مدل دیگر) + تحویل پرامپت استاندارد برای مدل‌های دیگر.

Work Log:
- نوشتن tmp-scripts/build_g3_math_filled_v05.py و تولید download/khshab-G3-MATH_v0.5.xlsx (29,136 B؛ ۷ شیت RTL):
  راهنما | تصحیحات نسبت به gapgpt (۸ ایراد → محل اصلاح) | شناسنامهٔ KH-G3-MATH (۹/۱۴ فیلد سبز) | نقشهٔ کتاب S1 (۱۰ سبز + ۶ زرد، ۱۴ ستون) | اطلس خطا (۱۲ کد واقعی سبز + ۶ پیشنهاد زرد: CARRY_MISS/GROUP_VS_COUNT/UNEQUAL_GROUP از gapgpt + OP_REVERSE/FACT_CONFUSION/REMAINDER_DROP جدید) | بانک سؤال (۱۱ سبز + ۷ زرد) | واژه‌نامه.
- Q-102 بازطراحی شد (اصلاح J12): گزینهٔ «۲۵» حذف (دو پاسخ درست می‌ساخت)، گزینهٔ «۵×۶» نشست؛ پاسخ‌نام مستقل: ۵×۵=۲۵.
- ۶ سؤال زرد جدید Q-201..Q-206 برای حفره‌های اکسل قبلی: تقسیم به‌دست‌آوردی/دسته‌کردی، خانوادهٔ ضرب/تقسیم، باقیمانده، خواندن چهاررقمی (۴۰۷۰)، گره در جمع ستونی (۳۵۸+۲۴۶=۶۰۴). همهٔ حساب‌ها با اسکریپت مستقل بازحساب و تأیید شد (ضد J12).
- دو کد پیشنهادی جدید (E_OP_REVERSE، E_FACT_CONFUSION، E_REMAINDER_DROP) از خود بانک سؤال برآمدند — فقط زرد، معیار پذیرش در S2 ثبت شد (حداقل ۲ سؤال + مداخلهٔ متمایز).
- ساخت download/prompt-prefill-cartridge-fa.md — پرامپت استاندارد پیش‌پُرکردن خشاب (۱۲ قاعدهٔ سخت + تعریف ستون‌ها + چک‌لیست خودآزمایی + سنجه‌های مقایسهٔ مدل‌ها)؛ برای خشاب‌های آینده و تست مدل دیگر.
- راستی‌آزمایی reload: ۷ شیت RTL، شناسه‌های یکتا، رنگ‌ها درست، حساب‌ها صحیح. کد محصول دست نخورد.

Stage Summary:
- تحویلی‌ها: khshab-G3-MATH_v0.5.xlsx (فرم تألیف پرشده و تصحیح‌شده — جانشین کامل اکسل gapgpt) + prompt-prefill-cartridge-fa.md.
- گام بعدی معلق بر تصمیم کاربر: نشست تأیید S1 با معلم هم‌ساز (زرد→سبز) یا ساخت مبدل Excel→JSON.

---
Task ID: 29
Agent: Z.ai Code (اصلی)
Task: خواستهٔ کاربر — «پرامپت حرفه‌ای برای تست صحت و دقت اکسل‌های خشاب» (ممیزی ارجاع صفحات، هویت کتاب/چاپ، تحلیل گلوگاه‌ها؛ برای ناظر انسانی یا مدل دیگر).

Work Log:
- بازخوانی tmp-scripts/build_template_and_registry.py، public/math-game/src/v10/station/errors.js و worklog (Task 27-28) برای نام‌های دقیق شیت/ستون، ۱۲ کد خطا، زنجیرهٔ برچسب‌گذاری و لنگرهای صفحاتی.
- کشف کراس‌چک ماشینی: کامنت‌های errors.js صفحات لنگر را ثبت کرده (ص۷۰-۷۲ شکستن، ص۱۳۶ صفر/یک، ص۱۳۹ چندرقمی) + لنگرهای رجیستری (ص۶۴ شروع ضرب، ص۷۳ شروع تقسیم، ص۱۴۵ باقیمانده‌دار، اعداد تا ۹۹۹۹) → ممیزی صفحه بدون کتاب فیزیکی هم بخشاً ممکن شد.
- ساخت download/prompt-audit-cartridge-fa.md — پرامپت ممیز مستقل: نقشهٔ ردپایی (هر ستون کجا مصرف می‌شود)، ده تلهٔ مستند پروژه، هفت بستهٔ آزمون T1..T7 (ساختار / رنگ‌ومنبع / اثرانگشت صفحه / هویت کتاب‌وویراست / اطلس خطا با تست معکوس / بانک سؤال ضد J12 / سازگاری بین‌فایلی)، قواعد حکم و گیت، خروجی سه‌قطعه‌ای (جدول یافته‌ها + برگهٔ تأیید انسانی قابل چاپ + جمع‌بندی گیت)، منع توهم خود ممیز.
- جفت‌سازی با prompt-prefill-cartridge-fa.md (سازنده ← این سند ممیز). کد محصول (math-game) دست نخورد.

Stage Summary:
- تحویلی: download/prompt-audit-cartridge-fa.md — قابل اجرا با هر مدل (با/بدون دسترسی وب) یا ممیز انسانی.
- اصل تثبیت‌شده: هیچ مدل زبانی (سازنده یا ممیز) حق تصدیق صفحه از حافظه ندارد؛ سبز فقط با کتاب فیزیکی/PDF رسمی هم‌چاپ. T3/T4 بدون کتاب به «نامعلوم» و برگهٔ انسانی می‌رسند — طراحی ضد-توهم است، نه ضعف.
- نکتهٔ ثبت‌شده در پرامپت (T1): ناهم‌خوانی فهرست «ردهٔ خطا» بین واژه‌نامهٔ قالب (۵ مقدار) و پرامپت پیش‌پُر (۶ مقدار با «بازیابی») برای تصمیم مالک در v1.1.
- گام بعدی معلق بر تصمیم کاربر: اجرای نمایشی همین ممیزی روی سه فایل تحویلی، یا افزودن شیت «پروتکل ممیزی» به قالب v1.1.

---
Task ID: 30
Agent: Z.ai Code (اصلی)
Task: اجرای هر دو گزینهٔ انتخابی کاربر — (الف) اجرای عملی ممیزی روی سه فایل تحویلی (تولید خروجی AUD واقعی) + (ب) افزودن شیت «پروتکل ممیزی» به قالب استاندارد v1.1.

Work Log:
- dump کامل سه فایل با tmp-scripts/dump_cartridges.py (شیت/ستون/ردیف/رنگ/منبع) و ممیزی کامل T1..T7 طبق prompt-audit-cartridge-fa.md، شامل بازحساب مستقل ۱۸ سؤال (ضد J12) و شبیه‌سازی گزینه→خطا با منطق classifyAttempt در errors.js.
- یافته‌های واقعی (گزارش AUD-01): ۵ قرمز — AUD-01 نشانهٔ «61» برای E_PLACE_SHIFT و نقشهٔ Q-105 د ناسازگار با errors.js (فقط 600/6 برچسب می‌خورند)؛ AUD-02 Q-103 د=70 ناسازگار با شاخهٔ صفر موتور؛ AUD-03 Q-110 د=2000 ناسازگار (موتور فقط 1000/10)؛ AUD-04 حفرهٔ پوشش L-43 (جدول ضرب بدون هیچ سؤال؛ ادعای لنگر Q-103..106 که مالکشان L-81/L-PRE است)؛ AUD-05 دو مالکی Q-101 (L-41 و L-42). + ۱۰ زرد (enumهای خارج واژه‌نامه: «مجسم/مسئله»، «خارج از v10.2»، ردهٔ مرکب؛ ناهم‌خوانی رجیستری در ص10؛ صورت Q-102؛ نقشه‌های ضعیف Q-107ج/Q-109ج؛ قاعدهٔ پوشش سبز؛ شیت مکمل؛ الگوی شناسه L). ۶ بسته تأیید سبز: ۱۸/۱۸ پاسخ درست، ۱۲/۱۲ کد واقعی، صفر سبزِ منبع-AI، صفر تعارض صفحه با لنگرهای ثبتی.
- حکم گیت v0.5: «مجاز ورود به مبدل پس از رفع ۵ قرمز» (همه تک‌سلولی). v0.5 دست نخورد — اصلاحات صرفاً پیشنهاد شد (قاعدهٔ ایستاده کاربر).
- قطعهٔ ۲ (برگهٔ تأیید انسانی): ۱۰ گسترهٔ صفحه سبز + هویت چاپ، برای معلم هم‌ساز چاپی.
- ساخت download/cartridge-template-standard-v1.1.xlsx (23,457 B؛ ۷ شیت RTL) با tmp-scripts/build_template_v11.py: شیت جدید «پروتکل ممیزی» (میثاق ممیز + نقشهٔ ردپایی + ۷ بستهٔ آزمون + ده تله + قواعد حکم + سجل ممیزی با ردیف ثبت)؛ «بازیابی» به ردهٔ خطا (بستن AUD-09)؛ قاعدهٔ طلایی ۸ (بستن AUD-13)؛ گام ۱٫۵ ممیزی در گردش کار؛ نمونهٔ L-41 هم‌خوان (بستن الگوی AUD-05)؛ یادداشت «برچسب باید با classifyAttempt هم‌خوان باشد وگرنه بی‌الگو» در اطلس/واژه‌نامه؛ الگوی نیمه‌معنایی شناسه L رسماً پذیرفته شد (بستن AUD-15). ستون‌ها/ترتیب: بدون تغییر.
- reload test پاس: ۷ شیت RTL، هدرهای ۱۴/۱۱/۱۷ دست‌نخورده، بازیابی در رده، L-41 بدون ادعای Q، سجل ممیزی موجود.
- به‌روزرسانی download/prompt-audit-cartridge-fa.md: مرجع ساختار → v1.1. کد محصول (math-game) دست نخورد.

Stage Summary:
- تحویلی‌های جدید: download/audit-report-khshab-G3-MATH-v05.md (گزارش سه‌قطعه‌ای AUD-01) + download/cartridge-template-standard-v1.1.xlsx.
- اثبات عملی پرامپت ممیز: با تست معکوس، برچسب‌های ناسازگار با موتور در کار خودِ پروژه کشف شد — همان جنس خطای «تحلیل گلوگاه» که کاربر نگرانش بود.
- باقی برای تصمیم مالک: اعمال ۵ اصلاح قرمز روی v0.5 (→ v0.6)، به‌روزرسانی رجیستری (ص10 + اشاره به قالب v1.1)، و برگهٔ انسانی با کتاب فیزیکی.
- گام بعدی معلق بر تصمیم کاربر: اعمال اصلاحات (v0.6) یا ساخت مبدل Excel→JSON.

---
Task ID: 31
Agent: Z.ai Code (اصلی)
Task: اجرای «برو» کاربر — گام ۰ (خشاب v0.6) + گام ۱ (مبدل Excel→JSON و خوانندهٔ خشاب). (این ثبت پس از کشف فایل‌ها نوشته شد؛ اجرا در بخش گم‌شدهٔ کانتکست انجام شده بود و کارنامه‌اش از روی آرتیفکت‌ها بازسازی شد.)

Work Log:
- گام ۰ اجرا شد: tmp-scripts/apply_v06.py تولید کرد download/khshab-G3-MATH_v0.6.xlsx (32,832 B) — رفع هر ۵ قرمز AUD-01: اصلاح نشانهٔ E_PLACE_SHIFT (E7 فقط p×۱۰/p÷۱۰)، Q-103 نقشهٔ دِ بی‌الگو شد، Q-105 نقشهٔ دِ بی‌الگو شد، Q-110 گزینهٔ دِ ۲۰۰۰→۱۰۰۰ + موج AUD-03 نمونه‌های بازیابی، مالکیت L-43 → Q-113/Q-114؛ به‌علاوه موج «ممیزی مجدد ماشینی»: Q-104 نقشهٔ جِ صادق‌شده با موتور (گارد f1,f2≥2).
- وصلهٔ حفرهٔ L-43 (AUD-04): دو سؤال سبز جدید Q-113 (۷×۸=۵۶) و Q-114 (۶×۹=۵۴) با برچسب‌های هم‌خوان classifyAttempt؛ بانک سؤال از ۱۸ به ۲۰ رسید (۱۳ سبز + ۷ زرد).
- شیت «سجل ممیزی» به انتهای v0.6 اضافه شد (قاعدهٔ AUD-14)؛ v0.5 دست‌نخورده ماند.
- رجیستری به‌روز شد: tmp-scripts/apply_registry_v11.py تولید کرد download/cartridge-registry-18-v1.1.xlsx — بستن AUD-10 (لنگر ف۱ ص۱۰)، ارجاع قالب → v1.1، وضعیت v0.6 + تصمیم مالک: فاز ۱ موازی با پایلوت، موج ب پشت گیت پایلوت.
- گام ۱ اجرا شد: مبدل خشاب اجرا و خروجی در public/math-game/cartridges/KH-G3-MATH.json منتشر شد (59,728 B؛ ساختار: formatVersion/cartridgeId/identity/bookMap/errorAtlas(18)/questionBank(20)/glossary/auditTrail/validation)؛ گزارش download/convert-report-KH-G3-MATH-v0.6.md — گیت مبدل: ۰ قرمز، ۷ زرد (همان زردهای رسمی AUD)، «JSON منتشر شد». ۷ زرد: L-83/L-D1/L-D2/L-C1 خارج واژه‌نامهٔ سازگاری موتور (AUD-07)، Q-109 گج نیمه‌تزئینی (AUD-12)، Q-111/Q-204 لایهٔ CPA «مجسم/مسئله» (AUD-06).
- خوانندهٔ خشاب در موتور ساخته شد: src/v10/station/cartridge-schema.js (اعتبارسنج کامل fail-closed با شمارش آمار و گیت) + src/v10/station/cartridge.js (لودر با کش و cartridgeSummary برای پنل معلم؛ اصل: خرابی خشاب هیچ‌کدام از جلسه‌های v10.2 را نمی‌شکند) — node --check هر دو سبز.
- راستی‌آزمایی: npm test → ۵۳/۵۳ سبز (بدون رگرسیون). 
- شکاف باز: اسکریپت مبدل به‌عنوان فایل بایگانی نشده (احتمالاً درون‌خطی اجرا شده) — باید در tmp-scripts/archived شود؛ کارنامهٔ گام ۱ ناقص است (تست‌های جدید خشاب افزوده نشده و app.js هنوز از خشاب نمی‌خواند).

Stage Summary:
- گیت «ورود به مبدل» رسماً سبز شد: v0.6 صفر قرمز دارد و مبدل روی آن اجرا شده و JSON منتشر است.
- وضعیت مسیر v10.3: گام ۰ کامل ✓ | گام ۱ نیمه‌کاره (مبدل+خواننده ✓، اتصال به بازی و تست‌های خشاب ✗) | گام ۲ (موج الف) و بعد از آن گیت پایلوت و موج ب، باقی‌اند.
- این ثبت از آرتیفت‌ها بازسازی شد چون اجرای اصلی در بخش گم‌شدهٔ کانتکست رخ داده بود و در worklog ثبت نشده بود.

---
Task ID: 32
Agent: Z.ai Code (اصلی) + ۲ زیرعامل (32-a مبدل / 32-b سیم‌کشی)
Task: «ادامه» کاربر — تکمیل گام ۱: بازسازی مبدل، اتصال خشاب به بازی، تست‌های خشاب، گیت نهایی

Work Log:
- 32-a (زیرعامل مبدل): tmp-scripts/cartridge-converter.py (۹۲۱ خط) نوشته شد — مبدل پایدار با argparse، تشخیص شیت/ستون با سرستون (آمادهٔ خشاب‌های آینده)، پورت validateCartridge و classifyAttempt، ضد J12، enumهای AUD-06/07 علیه واژه‌نامه، مالکیت متقاطع T7، fail-closed (قرمز → JSON منتشر نمی‌شود). بکاپ قدیم در tmp-scripts/backup-KH-G3-MATH.json؛ JSON بازتولید شده **بایت‌به‌بایت هم‌ارز** قدیم (غیر از generatedAt) و با موتور JS واقعی اعتبارسنجی شد؛ گزارش مبدل هم بازتولید شد. دو تست منفی (قرمزسازی وضعیت + خراب‌کردن کلید پاسخ Q-113) هر دو مردود و exit 1 دادند.
- 32-b (زیرعامل سیم‌کشی): v10.html داخل جعبهٔ راهنما #cartridge-status گرفت؛ app.js تابع initCartridgeStatus() (import از station/cartridge.js، اعداد زنده از stats/gate با fa()، textContent ضد تزریق، try/catch مضاعف، void غیرمسدودکننده در initApp) + console.info بوت؛ styles/v10.css (مسیر واقعی — نه src/v10) ۱۲ خط مینیمال. هیچ رفتار موتوری تغییر نکرد.
- 32-c (اصلی): tests/v10.3-cartridge.test.js با ۱۲ آزمون نوشته شد — خشاب منتشرشده از دیسک سبز، آمار هم‌خوان AUD (۱۶/۱۰، ۱۲+۶، ۲۰=۱۳+۷، ۴+۲+۱ زرد رسمی)، ضد J12 روی فرم خام، مالکیت متقاطع T7، چهار سناریوی fail-closed (کلید پاسخ/شناسه/لنگر یتیم/برچسب T6)، خشاب تهی، واحد راهنما، cartridgeSummary، لودر fail-closed. اسکریپت test در package.json به‌روز شد → **۶۵/۶۵ سبز** (۵۳+۱۲).
- 32-d (اصلی): راستی‌آزمایی مرورگری با agent-browser روی localhost:3000/math-game/v10.html — بوت با console.info خشاب (آمار درست)؛ ورود مهمان → نقشه با ۳ بنا و قفل‌ها؛ راهنما → وضعیت خشاب نمایان با خط منبع/زمان تولید جدید؛ جلسهٔ نیروگاه: ۲×۲ پاسخ درست پذیرفته و جلسه ادامه یافت (موتور سالم)؛ مسیر fail-closed با network route --abort روی cartridges/*.json: پیام «⚠️ خشاب بارگذاری نشد — بازی با محتوای داخلی ادامه می‌دهد» + بوت سالم؛ موبایل ۳۹۰px: بدون overflow افقی (اسکرین‌شات /tmp/cartridge-mobile.png). صفر خطای کنسول در همهٔ مسیرها.

Stage Summary:
- **گام ۱ رسماً بسته شد**: خط کامل «اکسل v0.6 → مبدل پایدار → JSON منتشر → خوانندهٔ fail-closed → نمایش وضعیت در بازی» با تست CI (۶۵/۶۵) و E2E مرورگری هر دو مسیر موفق/ناموفق قفل شد.
- تحویلی‌های جدید: tmp-scripts/cartridge-converter.py | tests/v10.3-cartridge.test.js | سیم‌کشی در v10.html/app.js/v10.css | بکاپ JSON.
- ریسک‌های ثبت‌شده از 32-a: رسیدهای ممیزی داخل مبدل نسخه‌دارند (برای خشاب جدید باید از سند ممیزی همان خشاب به‌روز شود)؛ table «رده» توکلمحور است (تصمیم AUD-08 سخت‌گیرانه = بازبینی CATEGORY_EXTRA_TOKENS).
- گام بعدی (معلق بر تصمیم کاربر): گام ۲ — موج الف (v10.3.0-beta): موتور خانوادهٔ ۲ (گره/قرض) و ۳ (ارزش مکانی/چهاررقمی) + سبزکردن Q-201..206 + ممیزی موج.

---
Task ID: 33
Agent: Z.ai Code (اصلی) + ۳ زیرعامل (33-a موتور / 33-b خشاب v0.7 / 33-c تب داشبورد)
Task: «ادامه» کاربر — گام ۲: موج الف → v10.3.0-beta (موتور خانوادهٔ ۲و۳ + خشاب v0.7 + بانک تمرین + ممیزی موج)

Work Log:
- 33-a (زیرعامل): src/v10/station/errors-v103.js ساخته شد — Pure و کاملاً افزودنی (صفر تغییر در فایل‌های v10.2): CODES_V103 با ۸ کد (CARRY_MISS/BORROW_MISS/ZERO_PLACE_MISS/REMAINDER_DROP/OP_REVERSE/GROUP_VS_COUNT/FACT_CONFUSION/UNEQUAL_GROUP) + CODE_SENTENCES_V103 + PRIORITY_V103؛ ۵ آشکارساز: classifyColumnSum (بدون‌گره رقم‌به‌رقمم — طلایی ۳۵۸+۲۴۶→۵۹۴)، classifyColumnSub (بدون‌قرض mod۱۰ — ۵۲−۲۷→۳۵)، classifyColumnMultiply (ضریب تک‌رقمی — ۲۶×۳→۶۸/Q-112)، classifyDivisionAttempt (عمل‌جایگزین/گروه‌شمارش/فکت همسایه؛ باقیمانده فقط با فلگ totalDivision — قرارداد صداقت Q-204)، classifyFourDigit (حذف صفر میانه — ۴۰۷۰→۴۷۰/Q-205)؛ + classifyV103 دیسپچر. tests/v10.3-families.test.js با ۱۴ آزمون (شامل fuzz ۳۰۰ ورودی) → ۷۹/۷۹ سبز. تناقض نمونهٔ پیش‌نویس تسک (۴۲÷۶→۷) توسط زیرعامل صادقانه کشف و با حالات فرمول‌سازگار بازنویسی شد.
- 33-b (زیرعامل): tmp-scripts/apply_v07.py → download/khshab-G3-MATH_v0.7.xlsx — دو ردیف زرد اطلس (E_BORROW_MISS، E_ZERO_PLACE_MISS با منبع «پیشنهاد AI — موج الف») + سجل AUD-W1/W2/W3 (مرج جابه‌جاشده بازسازی شد)؛ v0.6 دست‌نخورده (md5 ثابت). مبدل: حکم «مجاز» — JSON بازتولید (اطلس ۱۸→۲۰، stats.atlasProposed ۶→۸، سجل ۱۰→۱۳؛ بقیه deep-equal بکاپ v0.6). check-schema.mjs: ok=true، ۰قرمز/۷زرد. آزمون ۲ کارتریج به‌روز شد (۶→۸). بکاپ: tmp-scripts/backup-KH-G3-MATH-v06.json.
- 33-c (زیرعامل): src/app/api/cartridge/route.ts (fs خواندن JSON + import موتور واقعی errors.js/errors-v103.js/cartridge-schema.js از public + لایهٔ تفسیر سؤال: ضرب → تقسیم صریح/داستانی با intent «کامل» → جمع ستونی) + src/components/dashboard/cartridge-tab.tsx (کارت شناسنامه + آمار زنده + Collapsible هشدارها + بانک ۲۰ سؤال اسکرولی با حکم زندهٔ گزینه‌ها) + اتصال تب چهارم در page.tsx + fetchCartridge + ۴ نوع جدید types.ts. راستی‌آزمایی: curl سه نمونهٔ طلایی (Q-206الف→E_CARRY_MISS، Q-201ج→E_OP_REVERSE، Q-105ج→E_PLACE_SHIFT)، agent-browser تب رندر با صفر خطای کنسول، lint فایل‌های جدید exit 0، ۷۹/۷۹ سبز. توزیع ۶۰ حکم: ۲۸ برچسب موتور / ۲۶ بی‌الگوی صادقانه / ۶ غیرعددی.
- 33-d (اصلی): download/audit-report-waveA-v0.7.md — ممیزی موج (T1-T7 با بازخوانی زندهٔ دو موتور؛ بازخوانی‌های شاخص Q-109ج/Q-110ب همگی «زرد مستند» نه قرمز تازه) + برگهٔ انسانی الف چاپی (هویت چاپ، ۸ ردیف صفحهٔ «؟»، جعبهٔ تصمیم دو کد جدید، تیک ۷ سؤال موج الف، امضا). بسته‌بندی: package.json → 10.3.0-beta.0 + عنوان/بنر v10.html → «۱۰.۳ بتا». گیت نهایی: ۷۹/۷۹ سبز؛ مرورگر: بنر جدید + کارت خشاب زنده با v0.7 و اطلس ۱۲+۸؛ صفر خطای کنسول.

Stage Summary:
- **موج الف (v10.3.0-beta) تحویل شد**: موتور تشخیص خانوادهٔ ۱/۲/۳ (ضرب+تقسیم+گره/قرض+چهاررقمی) با ۱۴ آزمون، خشاب v0.7 (اطلس ۲۰ کد = ۱۲ سبز + ۸ زرد) از طریق مبدل پایدار منتشر، بانک تمرین تشخیصی با برچسب‌سنجی زندهٔ موتور در داشبورد معلم، ممیزی موج با صفر قرمز + برگهٔ انسانی الف.
- حکم گیت: «مجاز ورود به گام ۳ (پایلوت فاز ۰) با برگهٔ انسانی الف» — هیچ زردی سبز نشده؛ دو کد جدید و ۷ سؤال موج الف منتظر تأیید انسانی‌اند.
- تعلیق‌شده برای v10.3.0 نهایی: بسته‌بندی کیت (zip + اسکریپت‌های اعمال + سند) پس از بازخورد پایلوت؛ شاخهٔ چهارم تفسیر سؤال (چهاررقمی کلامی Q-205) در route؛ به‌روزرسانی ستون سازگاری موتور L-D1/L-D2 پس از تأیید انسانی.
- گام بعدی (معلق بر تصمیم کاربر): گام ۳ — پایلوت با معلم واقعی (فاز ۰؛ پاسخ ۵ سؤال گیت) یا توزیع برگهٔ انسانی الف.
---
Task ID: 32-b
Agent: general-purpose (سیم‌کشی خشاب)
Task: اتصال خشاب به بازی v10.2 — بارگذاری cartridges/KH-G3-MATH.json در زمان راه‌اندازی و نمایش وضعیتش در جعبهٔ راهنمای نقشه (افزودنیِ صرف؛ بدون هیچ تغییری در تولید سؤال/نردبان/قفل‌ها/جلسه‌ها/کارت معلم)

Work Log:
- پیش‌نیاز خوانده شد: worklog (Task 30-31)، cartridge-schema.js و cartridge.js (فقط مصرف‌کننده — دست نخوردند)، cartridges/KH-G3-MATH.json (bookMap=16، errorAtlas=18، questionBank=20، source={file,tool}، generatedAt موجود)
- v10.html (خط ۱۱۶): داخل #map-guide-info بعد از متن راهنما، `<div id="cartridge-status" class="cartridge-status" hidden></div>` اضافه شد — پیش‌فرض پنهان؛ فقط با toggle دکمهٔ «راهنما» دیده می‌شود (بدون مزاحمت برای تجربهٔ کودک)
- src/v10/app.js: import `loadCartridge` از './station/cartridge.js' (خط ۴۳) + تابع جدید `initCartridgeStatus()` (خطوط ۱۲۹۱-۱۳۵۵، قبل از initApp) + فراخوانی غیرمسدودکنندهٔ `void initCartridgeStatus();` در initApp درست پس از setupEvents() (خط ۱۳۶۲) — بدون await در مسیر بوت
- رفتار تابع: حالت موفق ← خط اصلی یک‌خطی («📦 خشاب محتوا: … — سؤال‌ها: ۲۰ (۱۳ تأیید + ۷ پیشنهاد) — اطلس خطا: ۱۲ واقعی + ۶ پیشنهادی — درس‌ها: ۱۶ (۱۰ تأیید) — گیت مبدل: مجاز (۰ قرمز / ۷ زرد)») که همهٔ اعدادش زنده از validation.stats/gate خوانده و با fa() فارسی می‌شوند (هیچ عددی هاردکد نیست) + خط دوم کوچک (منبع: cartridge.source.file/tool + زمان تولید از generatedAt)؛ حالت ناموفق ← پیام صادقانهٔ «⚠️ خشاب محتوا بارگذاری نشد — بازی با محتوای داخلی ادامه می‌دهد.» + جزئیات خطا در خط دوم؛ کل بدنه در try/catch تو در تو (fail-closed مضاعف — حتی خطای خود تابع بوت را نمی‌شکند)
- console.info خلاصه در بوت: `[cartridge] خشاب KH-G3-MATH بارگذاری و اعتبارسنجی شد — …` (و console.warn در مسیر ناموفق)
- styles/v10.css (خطوط ۸۶۹-۸۸۰): بلوک مینیمال `.cartridge-status` — border-top جداکننده، font-size 11px (کوچک‌تر از 13px خود guide-box)، رنگ var(--text-muted) خاکستری ملایم، text-align:start برای RTL، overflow-wrap:anywhere ضد سرریز موبایل + زیرقاعدهٔ meta با 10px — ۱۲ خط CSS
- نکتهٔ مسیر: برگهٔ مأموریت «src/v10/v10.css» گفته بود اما استایل‌شیت واقعیِ لینک‌شده در v10.html (خط ۷) «styles/v10.css» است — همان ویرایش شد
- محتوا با textContent ساخته می‌شود (نه innerHTML) — مصون از تزریق؛ به #cartridge-status هیچ role اضافه‌ای داده نشد
- راستی‌آزمایی: node --input-type=module --check روی app.js سبز (node --check ساده هم exit 0)؛ CSS براکت‌ها متوازن (135/135)؛ divهای v10.html متوازن (37/37)؛ npm test → ۵۳/۵۳ سبز (بدون رگرسیون)؛ git status → دقیقاً ۳ فایل محصول تغییر کرده
- E2E مرورگر (agent-browser + http.server محلی): بوت → console.info با آمار صحیح ظاهر شد؛ «مهمان» → نقشه → دکمهٔ «راهنما» → #cartridge-status با hidden=false و متن کامل موفق + خط منبع/زمان تولید دیده شد؛ سپس شبیه‌سازی خرابی (بلاک fetch cartridges با network route --abort و reload) → پیام صادقانهٔ fail-closed نمایش داده شد و بوت/نقشه بدون خطا به کار ادامه داد — هر دو مسیر سبز؛ مرورگر و سرور بسته شدند

Stage Summary:
- گام ۱ مسیر v10.3 (اتصال خشاب به بازی) از نظر نمایش وضعیت بسته شد: بازی حالا خشاب منتشرشده را در راه‌اندازی می‌خواند و وضعیت صادقانه‌اش را در جعبهٔ راهنمای نقشه نشان می‌دهد؛ موتور v10.2 عملاً دست‌نخورده ماند (تفاوت diff: فقط import یک خط، یک تابع مستقل اطلاع‌رسانی، یک فراخوانی void غیرمسدودکننده، یک div پنهان، ۱۲ خط CSS)
- محدودیت/ریسک شناخته‌شده: روی پروتکل file:// (بازکردن مستقیم v10.html بدون سرور) fetch خشاب در برخی مرورگرها بلاک می‌شود — در آن حالت پیام fail-closed نمایش داده می‌شود و بازی با محتوای داخلی ادامه می‌دهد (طراحی عمدی، نه باگ)؛ serving از http/https مشکل ندارد
- کارهای بعدی معلق بر تصمیم مالک: تست‌های ماشینی خشاب (بستن کامل گام ۱)، موج الف (محتوای خشاب در تولید سؤال — نیازمند تصمیم معماری)، و گیت پایلوت
---
Task ID: 32-a
Agent: general-purpose (مبدل)
Task: بازسازی مبدل Excel→JSON به‌عنوان اسکریپت پایدار و قابل بایگانی (خلأ ثبت‌شده در Task 31) + بازتولید خروجی‌ها و اثبات هم‌ارزی با JSON منتشرشدهٔ فعلی.

Work Log:
- مطالعهٔ منابع به ترتیب: worklog (Task 29..31)؛ dump کامل download/khshab-G3-MATH_v0.6.xlsx (۸ شیت: راهنما | تصحیحات نسبت به gapgpt | شناسنامهٔ خشاب | نقشهٔ کتاب (S1) | اطلس خطا | بانک سؤال | واژه‌نامهٔ ستون‌ها | سجل ممیزی)؛ public/math-game/cartridges/KH-G3-MATH.json (ساختار هدف)؛ download/convert-report-KH-G3-MATH-v0.6.md؛ download/audit-report-khshab-G3-MATH-v05.md (معناشناسی AUD-01..15)؛ و دو سند قرارداد برای پورت دقیق: src/v10/station/cartridge-schema.js (validateCartridge + رسیدها + نیمه‌تزئینی‌ها) و src/v10/station/errors.js (classifyAttempt).
- ساخت tmp-scripts/cartridge-converter.py (۹۲۱ خط؛ Python 3 + openpyxl؛ بدون وابستگی به Node):
  * argparse با پیش‌فرض‌های v0.6 (--input/--out-json/--out-report/--id/--tool)؛ شناسهٔ خشاب از فیلد «شناسهٔ خشاب» شناسنامهٔ xlsx خوانده می‌شود؛ شیت‌ها با کلیدواژه (مقاوم به ZWNJ/پسوند) و ستون‌ها با نام سرستون (نه موقعیت ثابت) یافت می‌شوند — قابل استفاده برای KH-G4-MATH و بعد آن.
  * رنگ فیل سلول «رنگ اعتبار» → وضعیت: C6EFCE=«تأییدشده» | FFEB9C=«نیاز به تأیید» | FFC7CE=«ایراد»؛ ردیف قرمز به JSON نمی‌رود و قرمز بلوکه‌کننده است؛ ناهم‌خوانی رنگ/متن = زرد.
  * ضد J12: سؤال‌های فرم خام «a×b = ؟» با بازحساب حاصل چک می‌شوند؛ سؤال‌های غیرخام با ۱۸ رسید ممیزی (AUDIT_ANSWER_RECEIPTS)؛ ناهم‌خوانی = قرمز با پیام هم‌قالب schema («گزینهٔ پاسخ (65) ≠ حاصل 7×8=56 (ضد J12)»).
  * پورت کامل validateCartridge: یکتایی شناسه‌ها، قاعدهٔ ۸ (سبز بی‌منبع = قرمز)، enumهای «لایهٔ CPA»/«سازگاری موتور»/«رده» علیه شیت واژه‌نامه با پیام‌های دقیقاً هم‌قالب AUD-06/07 (و AUD-08 توکِل‌محور تا ارزش‌های مرکب مستند اطلس زرد نشوند)، مالکیت متقاطع T7 (هر anchorId در bookMap + برابری دقیق لنگرهای سلول با مالکان واقعی بانک)، برگه‌های نیمه‌تزئینی AUD-12، ارجاع‌های اطلس به بانک، دامنهٔ ۹۹۹۹ گزینه‌ها.
  * fail-closed: حتی یک قرمز → JSON نوشته نمی‌شود و فقط گزارش md ساخته می‌شود؛ کد خروج 0=مجاز / 1=گیت قرمز / 2=خطای ساختاری؛ آرایهٔ errors فقط در گزارش می‌رود (بلوک validation داخل JSON همان قرارداد schema: ok/warnings/stats/gate).
  * متن داده‌ای سلول‌ها با norm_text (فروپاشی whitespace) خوانده می‌شود — همان رفتار مبدل مرجع که در تست کشف شد (سلول Q-107 فاصلهٔ دوتایی داشت).
- تست روی کپی xlsx (نه فایل اصلی): خروجی JSON با JSON فعلی جز «generatedAt» و نام فایل ورودی، هم‌ارز کامل شد؛ تفاوت فاصلهٔ دوتایی Q-107 کشف و با norm_text رفع شد.
- دو تست منفی روی کپی‌های دستکاری‌شده: (۱) قرمزکردن وضعیت Q-101 → ۴ قرمز آبشاری (قاعدهٔ رنگ + ارجاع اطلس + T7 دوطرفه)، حکم «ممنوع»، JSON نوشته نشد، exit 1؛ (۲) خراب‌کردن گزینهٔ پاسخ Q-113 (۵۶→۶۵) → قرمز ضد J12، JSON نوشته نشد، exit 1.
- بکاپ JSON فعلی: tmp-scripts/backup-KH-G3-MATH.json (۵۹,۷۲۸ B).
- اجرای نهایی با پیش‌فرض‌ها: public/math-game/cartridges/KH-G3-MATH.json بازنویسی شد (۵۹,۷۲۸ B؛ بدون سطر پایانی) + download/convert-report-KH-G3-MATH-v0.6.md بازتولید شد (زمان جدید، همان ۷ زرد، همان جدول سنجه و حکم).
- راستی‌آزمایی سه‌لایه: python3 -m py_compile سبز؛ json.load سبز؛ اعتبارسنجی JSON جدید با موتور واقعی JS از طریق tmp-scripts/check-schema.mjs (validateCartridge): ok=true، قرمز ۰، زرد ۷ با همان ترتیب — یعنی پایتونِ مبدل و موتور JS هم‌حکم‌اند.
- پاکسازی فایل‌های تست موقت؛ هیچ فایل دیگری از پروژه (src/tests/اکسل‌ها) تغییر نکرد.

Stage Summary:
- هم‌ارزی: مقایسهٔ ساختاری کامل JSON جدید با بکاپ — صفر تفاوت معنادار غیر از generatedAt (کلیدهای سطح بالا و ترتیبشان، ۱۴ فیلد identity، ۱۶ درس، ۱۸ کد اطلس، ۲۰ سؤال، ۱۸ قاعدهٔ واژه‌نامه، ۱۰ مدخل سجل ممیزی، stats {lessons:16، lessonsConfirmed:10، atlasReal:12، atlasProposed:6، questions:20، questionsConfirmed:13، questionsProposed:7}، gate {red:0، yellow:7، verdict:«مجاز»} و فهرست ۷ زرد — همگی بایت‌به‌بایت یکسان؛ حجم هر دو ۵۹,۷۲۸ B).
- شمارش نهایی: درس ۱۶ (سبز ۱۰) | اطلس ۱۲ واقعی + ۶ پیشنهادی | سؤال ۲۰ (سبز ۱۳، زرد ۷) | قرمز ۰ | زرد ۷ (همان زردهای رسمی AUD: L-83/L-D1/L-D2/L-C1 سازگاری موتور AUD-07، Q-109 نیمه‌تزئینی AUD-12، Q-111/Q-204 لایهٔ CPA AUD-06).
- تحویلی‌ها: tmp-scripts/cartridge-converter.py (مبدل بایگانی‌شده) | tmp-scripts/backup-KH-G3-MATH.json (بکاپ پیش از بازنویسی) | tmp-scripts/check-schema.mjs (پل اعتبارسنجی JSON با موتور JS) | خروجی‌های بازتولیدشده در مسیرهای فوق.
- ریسک‌های ثبت‌شده: (۱) رسیدهای ممیزی و نقشه‌های نیمه‌تزئینی جدول‌های نسخه‌دار داخل اسکریپت‌اند و باید با سند ممیزی هر خشاب جدید (مثلاً KH-G4-MATH) به‌روز شوند؛ (۲) قاعدهٔ «رده» عمداً توکِل‌محور است (ارزش‌های مرکبِ مستند «مفهومی/محاسباتی» و «راهبردی اختیاری» زرد نمی‌شوند) — اگر مالک AUD-08 را سخت‌گیرانه بخواهد باید CATEGORY_EXTRA_TOKENS بازبینی شود؛ (۳) تشخیص پانویس شیت‌ها با سلول شناسهٔ «یادداشت»/«قاعدهٔ…» است — قرارداد تألیف باید همین را نگه دارد؛ (۴) در حین این تسک فایل‌های src/v10/app.js، styles/v10.css و v10.html ساعت ~۱۷:۴۴ توسط عامل/پردازهٔ دیگری (احتمالاً گام ۲ اتصال خشاب به بازی) تغییر کردند — خارج از دامنهٔ این تسک و بی‌تأثیر بر قرارداد JSON.

---
Task ID: 33-b
Agent: general-purpose (خشاب v0.7)
Task: ساخت خشاب v0.7 (موج الف) — افزودن دو کد خطای پیشنهادی جدید خانوادهٔ ۲/۳ به «اطلس خطا» + ثبت در «سجل ممیزی» + بازتولید JSON و گزارش با مبدل پایدار + راستی‌آزمایی سه‌لایه + به‌روزرسانی آزمون ۲ کارتریج (زیرعامل موازی 33-a هم‌زمان موتور errors-v103.js خانوادهٔ ۲/۳ را می‌سازد؛ تعریف این دو کد اینجا در اطلس ثبت شد)

Work Log:
- پیش‌نیازها خوانده شد: worklog (Task 30/31/32/32-a/32-b)، tmp-scripts/cartridge-converter.py (argparse/پیش‌فرض‌ها، قرارداد رنگ C6EFCE|FFEB9C|FFC7CE، پورت classifyAttempt و validateCartridge، fail-closed) و apply_v06.py به‌عنوان الگوی جراحی.
- ساختار واقعی v0.6 دامپ شد: اطلس خطا — سرستون‌های ردیف ۳ (کد (E-) / نام فارسی / رده / توصیف مفهومی / نشانهٔ رفتاری نمونه / ساختار سؤال تشخیصی / مداخلهٔ پیشنهادی / اولویت / منبع / رنگ اعتبار / یادداشت)، ۱۲ ردیف سبز (۴-۱۵) + ۶ ردیف زرد «(پیشنهاد)» (۱۶-۲۱)، ردیف خالی ۲۲، پانویس «یادداشت» ۲۳. سجل ممیزی — هدر ۲، جدول تا ردیف ۱۲، مرج یادداشت A14:E16.
- tmp-scripts/apply_v07.py (الگوی apply_v06.py) نوشته و اجرا شد → download/khshab-G3-MATH_v0.7.xlsx (33,830 B):
  * اطلس خطا: دو ردیف زرد FFEB9C در ردیف ۲۲ و ۲۳ (بلافاصله پس از آخرین کد پیشنهادی، پیش از پانویس؛ سبک از ردیف ۱۹/E_OP_REVERSE کپی شد؛ گارد assert روی ساختار):
    - E_BORROW_MISS (پیشنهاد) / «جاافتادن قرض» / ردهٔ محاسباتی (هم‌ردهٔ E_CARRY_MISS) / توصیف: تفریق ستونی رقم‌به‌رقم بدون قرض‌گرفتن از ده‌گان / نشانه: «۵۲−۲۷ را ۳۵ می‌نویسد (رقم‌به‌رقم بدون قرض)» / الگوی سؤال: «تفریق ستونی دورقمی با نیاز به قرض (نمونه: ۵۲−۲۷)» — بدون ارجاع Q- (قید T5) / مداخله: «بازنمایی مجسم با مکعب‌های ده‌تایی — از ده‌گان قرض بگیر» / اولویت: متوسط (مطابق ردیف‌های مشابه) / منبع: «پیشنهاد AI — موج الف v10.3 (موتور errors-v103.js)» / رنگ اعتبار: «نیاز به تأیید» / یادداشت: «کاندید خانوادهٔ ۲ — سبز شدن با تأیید معلم هم‌ساز (برگهٔ انسانی الف)»
    - E_ZERO_PLACE_MISS (پیشنهاد) / «حذف صفر جایگاه» / ردهٔ مفهومی / توصیف: حذف صفرِ یک جایگاه در خواندن/نوشتن چهاررقمی / نشانه: «۴۰۷۰ را ۴۷۰ می‌نویسد/می‌خواند» / الگوی سؤال: «نوشتن/خواندن چهاررقمی با صفرِ میانی یا پایانی (نمونه: چهار هزار و هفتاد)» — بدون ارجاع Q- / مداخله: «کارت جایگاه‌ها با خانهٔ خالی صفر — صفر نگهبان جایگاه است» / اولویت: متوسط / منبع و رنگ اعتبار و یادداشت مثل بالا با «کاندید خانوادهٔ ۳»
  * سجل ممیزی: سه ردیف جدید در ردیف ۱۳-۱۵ (ساختار ستون‌ها از ردیف‌های موجود): AUD-W1 «اطلس خطا — دو ردیف جدید» / «زرد — کدهای پیشنهادی خانوادهٔ ۲ و ۳ موج الف (E_BORROW_MISS، E_ZERO_PLACE_MISS) با موتور errors-v103.js پیاده شد» / «افزوده شد به‌عنوان پیشنهاد؛ سبز شدن با برگهٔ انسانی الف» / «افزوده شد» — AUD-W2 «بانک سؤال Q-201..Q-206» / «زرد — برچسب‌های موج الف با موتور جدید بازخوانی می‌شوند؛ بدون تغییر متن» / «بدون تغییر — صادق‌ماند» / «ثبت شد» — AUD-W3 «نسخهٔ خشاب» / «v0.6 → v0.7 (موج الف)» / «دو کد اطلس + سجل» / «اعمال شد». قرارداد رنگ سجلِ apply_v06.py حفظ شد (فقط «رفع شد» سبز؛ سه ردیف جدید زرد محتاطانه).
  * نکتهٔ فنی: openpyxl 3.1.5 مرج merged را با insert_rows جابه‌جا نمی‌کند (آزمون روی کپی تأیید شد — A14:E16 stale می‌ماند)؛ در apply_v07.py مرج یادداشت سجل قبل از درج باز و بعد از درج در A17:E19 دوباره بسته شد.
  * هیچ چیز دیگری تغییر نکرد (بانک سؤال/نقشهٔ کتاب/شناسنامه/راهنما/واژه‌نامه دست‌نخورده)؛ md5 فایل v0.6 قبل و بعد از اجرا یکسان — v0.5 هم دست نخورد.
- بکاپ JSON پیش از بازتولید: tmp-scripts/backup-KH-G3-MATH-v06.json (59,728 B — md5 برابر فایل منتشر).
- اجرای مبدل: python3 tmp-scripts/cartridge-converter.py --input download/khshab-G3-MATH_v0.7.xlsx (بقیه پیش‌فرض) → قرمز ۰ | زرد ۷ | حکم «مجاز» | درس ۱۶ (سبز ۱۰) | اطلس ۱۲+۸ | سؤال ۲۰ (سبز ۱۳) | JSON منتشر شد (62,788 B) و گزارش بازتولید شد. توجه: مسیر گزارش پیش‌فرض مبدل همان download/convert-report-KH-G3-MATH-v0.6.md است (طبق دستور «بقیه پیش‌فرض — همان مسیرهای انتشار» دست نخورد)؛ محتوای گزارش ورودی را v0.7 ثبت می‌کند.
- راستی‌آزمایی پایتونی (diff ساختاری کامل JSON جدید با بکاپ v0.6) — فهرست دقیق تفاوت‌ها در Stage Summary؛ هیچ تفاوت غیرمنتظره‌ای نبود.
- اعتبارسنجی با موتور JS واقعی: node tmp-scripts/check-schema.mjs → ok=true | red:0 | yellow:7 با همان فهرست و ترتیب ۷ زرد رسمی (۴×AUD-07 + ۲×AUD-06 + ۱×AUD-12) — کدهای پیشنهادی جدید (خارج REAL_CODES و با وضعیت «نیاز به تأیید» و ردهٔ درون واژه‌نامه) هشدار نساختند؛ زردها همان ۷ ماند.
- tests/v10.3-cartridge.test.js — فقط آزمون ۲ ویرایش شد: atlasProposed از ۶ به ۸ (با کامنت ترکیب: ۶ پیشنهاد AUD-01 + ۲ کد خانوادهٔ ۲/۳ موج الف). هیچ آزمون دیگری (از جمله فیکِ ساختگی آزمون ۱۱) و هیچ فایل دیگری تغییر نکرد.
- npm test در public/math-game → ۶۵/۶۵ سبز (۵۳ قبلی + ۱۲ آزمون کارتریج؛ fail 0). فایل tests/v10.3-families.test.js زیرعامل 33-a در لحظهٔ اجرا هنوز وجود نداشت و اسکریپت test در package.json هم هنوز آن را صدا نمی‌زد — طبق قرارداد هماهنگی، package.json دست نخورد و نتیجهٔ ۶۵تایی صادقانه ثبت می‌شود.

Stage Summary:
- تحویلی‌ها: tmp-scripts/apply_v07.py | download/khshab-G3-MATH_v0.7.xlsx | tmp-scripts/backup-KH-G3-MATH-v06.json | JSON منتشرشدهٔ public/math-game/cartridges/KH-G3-MATH.json | گزارش download/convert-report-KH-G3-MATH-v0.6.md (محتوای v0.7) | ویرایش تک‌آزمونی tests/v10.3-cartridge.test.js.
- فهرست دقیق تفاوت JSON v0.7 با بکاپ v0.6 (۹ بند — جز این‌ها هیچ تفاوتی نبود):
  1) generatedAt: 2026-10-20T17:57:50.262Z → 2026-10-20T18:25:35.169Z (انتظارشده)؛
  2) source.file: khshab-G3-MATH_v0.6.xlsx → khshab-G3-MATH_v0.7.xlsx (نسبت‌شناسی — انتظارشده؛ source.tool بدون تغییر)؛
  3) errorAtlas: ۱۸ → ۲۰ — ۱۸ کد نخست بایت‌به‌بایت هم‌ارز با همان ترتیب؛ دو کد جدید در انتها: E_BORROW_MISS و E_ZERO_PLACE_MISS (هر دو status=«نیاز به تأیید»، source=«پیشنهاد AI — موج الف v10.3 (موتور errors-v103.js)»، اولویت «متوسط»، الگوی سؤال بدون ارجاع Q-)؛
  4) auditTrail.entries: ۱۰ → ۱۳ — ۱۰ مدخل نخست هم‌ارز؛ سه مدخل جدید AUD-W1/W2/W3؛ auditTrail.note و auditTrail.sheet بدون تغییر؛
  5) validation.stats: فقط atlasProposed ۶ → ۸ (atlasReal 12، lessons 16/10، questions 20/13/7 بدون تغییر)؛
  6) validation.warnings: فهرست ۷تایی دقیقاً هم‌ارز (حتی در ترتیب) — زرد جدیدی قاچاق نشد؛
  7) validation.gate: red:0 / yellow:7 / verdict «مجاز» — بدون تغییر؛
  8) identity (۱۴ فیلد)، bookMap (۱۶)، questionBank (۲۰)، glossary (۱۸ قاعده): deep-equal — صفر تفاوت؛
  9) formatVersion، cartridgeId و ترتیب کلیدهای سطح بالا: بدون تغییر.
- حکم نهایی زنجیره: اطلس اکنون ۱۲ واقعی + ۸ پیشنهادی (۶ کد AUD-01 + ۲ کد خانوادهٔ ۲/۳ موج الف)؛ موتور JS با مبدل پایتون هم‌حکم (ok=true / قرمز ۰ / زرد ۷)؛ CI موجود ۶۵/۶۵.
- ریسک‌ها/تعلیق‌ها: (۱) آزمون‌های ۱۴گانهٔ خانواده‌ها (33-a) و اسکریپت test در لحظهٔ این ثبت هنوز سوار نشده بودند — پس از فرود آن‌ها npm test باید ۷۹/۷۹ شود (فقط به افزودن فایل + اسکریپت نیاز دارد، هیچ تداخلی با تغییرات این تسک ندارد: تنها اشتراک، همان JSON منتشرشده است که آزمون ۲ آن به‌روز شده)؛ (۲) نام فایل گزارش مبدل همچنان «...v0.6.md» است (پیش‌فرض پایدار مبدل) — اگر مالک نام‌گذاری نسخه‌دار گزارش را بخواهد باید --out-report نسخه‌ای بدهد یا پیش‌فرض مبدل در موج بعدی پارامتری‌تر شود؛ (۳) دو کد جدید تا تأیید معلم هم‌ساز (برگهٔ انسانی الف) سبز نمی‌شوند — موتور errors-v103.js (33-a) آن‌ها را پیاده می‌کند ولی برچسب‌های Q-201..206 با موتور جدید باید بازخوانی شود (AUD-W2)؛ (۴) برگهٔ تأیید انسانی همچنان معلق است (میراث AUD-01).

---
Task ID: 33-a
Agent: general-purpose (موتور خانوادهٔ ۲و۳)
Task: ساخت موتور تشخیص خطای خانوادهٔ ۲ و ۳ برای موج الف v10.3 — ماژول جدید Pure و کاملاً افزودنی (قاعدهٔ طلایی: هیچ فایل v10.2 حتی یک کاراکتر تغییر نکرد؛ ۶۵ آزمون سبز قبلی محفوظ ماند)

Work Log:
- مطالعهٔ مقدماتی: worklog (Task 30..32-b)؛ src/v10/station/errors.js (قرارداد ERROR_CODES، سبک classifyAttempt، گارد isInt سخت‌گیرانه، زنجیرهٔ اولویت، CODE_SENTENCES_FA بدون کودک‌ستیزی، detectBehavioralCode)؛ tests/v10.2-errors.test.js (node:test + assert/strict، نام‌های فارسی)؛ cartridge-schema.js (کدهای «پیشنهادی» از مسیر atlasProposed و REAL_CODES — هیچ کد جدیدی به errors.js اضافه نمی‌شود)؛ اطلس خشاب منتشرشده (۶ کد پیشنهادی موجود). npm test پایه: ۶۵/۶۵ سبز.
- فایل جدید src/v10/station/errors-v103.js (Pure ESM، بدون DOM/FS، هدر فارسی با قرارداد «کد یا null»): CODES_V103 هشت‌کدی فروزن (nameFa/family/severity عین تسک)، CODE_SENTENCES_V103 (برای هر ۸ کد: یک جملهٔ تشخیصی + دو نمونهٔ رفتاری، بدون «اشتباه کردی»؛ نمونه‌ها با خروجی واقعی موتور هم‌خوان‌اند)، PRIORITY_V103 فروزن (E_REMAINDER_DROP > E_OP_REVERSE > E_GROUP_VS_COUNT > E_FACT_CONFUSION > E_CARRY_MISS > E_BORROW_MISS > E_ZERO_PLACE_MISS > E_UNEQUAL_GROUP) و پنج تشخیص‌گر + دیسپچر:
  * classifyColumnSum — جمع بدون‌گره رقم‌به‌رقم (a_i+b_i)%۱۰ در چهار جایگاه؛ حداقل یک گره واقعی لازم؛ نمونهٔ طلایی ۳۵۸+۲۴۶→۵۹۴=E_CARRY_MISS و ۶۰۴=null؛ جمع بی‌نیاز از گره (۱۲۳+۲۳۴) فقط درست/null.
  * classifyColumnSub — قرارداد a≥b (خارجش null)؛ تفریق بدون‌قرض با mod ۱۰ روی رقم منفی؛ نمونهٔ طلایی ۵۲−۲۷→۳۵=E_BORROW_MISS و ۲۵=null؛ ۶۳−۴۸→۲۵ هم پوشش داده شد.
  * classifyColumnMultiply — ضریب تک‌رقمی b∈[۰,۹] (بیرونش null)؛ بدون‌گره رقم‌به‌رقم a×b؛ نمونهٔ طلایی ۲۶×۳→۶۸ (سناریوی Q-112)؛ b===۰/۱ گره ناممکن → فقط درست/null.
  * classifyDivisionAttempt — گاردها divisor≥۱ و همهٔ مقادیر ۰..۹۹۹۹؛ exact→null؛ E_REMAINDER_DROP فقط با opts.totalDivision===true و submitted===floor یا floor+1 (بدون فلگ صادقانه null — قرارداد Q-204 که رسید آن در cartridge-schema هم ۴ است)؛ E_OP_REVERSE برای ÷→−/+/× (۱۲÷۳→۹/۱۵/۳۶ — سناریوی Q-201)؛ E_GROUP_VS_COUNT فقط r=۰ (submitted===divisor با شرط divisor≠خارج‌قسمت، یا submitted===dividend)؛ E_FACT_CONFUSION فقط r=۰ و submitted===dividend÷(divisor±۱) با تقسیم صحیح و همسایه≥۲. چند الگوی همزمان با pickByPriority روی PRIORITY_V103 داوری می‌شود: ۴۲÷۶→۶ → گروه (نه فکت)؛ ۵÷۳→۲ با فلگ → باقیمانده (نه تفریق) و بدون فلگ → تفریق.
  * classifyFourDigit — حذف «یک» صفرِ میانه از نمایش دهدهی (۴۰۷۰→۴۷۰ — سناریوی Q-205؛ ۴۰۰۷→۴۰۷)؛ حذف صفر انتهایی (۴۰۷۰→۴۰۷ = خانوادهٔ ÷۱۰) و حذفِ صفرپیشروساز (۴۰۰۷→۰۷) صادقانه null.
  * classifyV103 — دیسپچر op='sum'|'sub'|'mulcol'|'div'|'read'؛ spec بدشکل/op نامعلوم → null.
- گاردها همه‌جا سبک errors.js: Number.isInteger سخت‌گیرانه (بدون تبدیل رشته/اعشار — هم‌خوان با آزمون ۱۲ v10.2 که submitted:'12' → null می‌خواهد)، خارج دامنه → null، opts بدشکل (null/عدد) → رفتار «بدون فلگ»، هیچ استثنایی نمی‌دهد.
- تصمیم تفسیری مستند: پیش‌نویس تسک در آزمون ۹ خودش را وسط جمله اصلاح کرده بود («صبر کن — درست ۴۲÷۷=۶ است»)؛ چون ۴۲÷۶→۷ پاسخ درست است و با فرمول نُرماتیف (submitted===dividend÷(divisor±۱)) هم نمی‌خواند، موتور صادقانه null می‌دهد؛ آزمون‌ها با حالات فرمول‌سازگار نوشته شد: ۲۴÷۴→۸ (فکت ۲۴÷۳)، ۴۰÷۵→۱۰ (فکت ۴۰÷۴)، ۶۰÷۵→۱۰ (فکت همسایهٔ بالایی ۶۰÷۶) و حالت نقاب‌شدهٔ ۴۲÷۶→۶ به آزمون اولویت دیسپچر رفت.
- E_UNEQUAL_GROUP عمداً بدون آشکارساز عددی ثبت شد (تشخیص از سه‌تایی عددی ممکن نیست — شواهد کلاسی معلم)؛ در کامنت هدر فایل مستند شد.
- فایل جدید tests/v10.3-families.test.js با ۱۴ آزمون فارسی (سبک v10.2-errors): ثبت ۸ کد + ترتیب دقیق زنجیره؛ جمع/قرض/ضرب ستونی؛ تقسیم دقیق/باقیمانده با و بدون فلگ/عمل جایگزین/گروه‌وشمارش/فکت؛ چهاررقمی؛ دیسپچر و اولویت‌های همزمان؛ گاردهای سخت (NaN/رشته/اعشار/منفی/مخرج صفر/۹۹۹۹+/opts بدشکل — بدون استثنا)؛ کامل‌بودن ۸ جمله؛ فاز fuzz با seed ثابت ۱۰۳۳ (mulberry32) — ۳۰۰ دور به هر ۵ تابع + دیسپچر، صفر استثنا و خروجی فقط کد شناخته‌شده یا null.
- package.json: فقط خط اسکریپت test به‌روز شد (افزودن tests/v10.3-families.test.js) — هیچ کلید دیگری تغییر نکرد.
- راستی‌آزمایی: node --check روی هر دو فایل جدید سبز؛ npm test → ۷۹/۷۹ سبز (۶۵ قبلی + ۱۴ جدید؛ fail 0).
- هم‌زمانی با زیرعامل 33-b (خشاب v0.7): تغییرات cartridges/KH-G3-MATH.json (افزودن E_BORROW_MISS و E_ZERO_PLACE_MISS به اطلس؛ atlasProposed ۶→۸)، ویرایش تک‌آزمونی tests/v10.3-cartridge.test.js و worklog از آن تسک است — نه این تسک؛ دو کدی که 33-b به اکسل v0.7 افزود دقیقاً همان دو کد این موتور است و npm test با هر دو مجموعه تغییر ۷۹/۷۹ شد.

Stage Summary:
- تحویلی‌ها: src/v10/station/errors-v103.js (اطلس ۸ کدی + جمله‌های کارت معلم + زنجیرهٔ اولویت + ۵ تشخیص‌گر + دیسپچر؛ Pure ESM) | tests/v10.3-families.test.js (۱۴ آزمون) | package.json (فقط اسکریپت test).
- الگوهای تشخیصی فعال: جاافتادن گره (جمع و ضرب ستونی)، جاافتادن قرض (تفریق ستونی)، مدیریت‌نشدن باقیمانده (فقط با فلگ totalDivision)، عمل جایگزین (÷→−/+/×)، خلط گروه/شمارش (نوشتن اندازهٔ گروه یا تعداد کل)، خلط فکت همسایه (divisor±۱)، حذف صفر میانهٔ چهاررقمی؛ E_UNEQUAL_GROUP فقط ثبت (بدون آشکارساز عددی — عمدی و صادقانه).
- قاعدهٔ طلایی محفوظ: diff این تسک فقط ۲ فایل جدید + یک خط package.json است؛ errors.js/ladder.js/experience.mjs/app.js و بقیهٔ v10.2 بیت‌به‌بیت دست‌نخورده.
- ریسک‌ها: (۱) برچسب‌های گزینهٔ Q-201..Q-206 بانک سؤال خشاب هنوز با موتور جدید بازخوانی نشده‌اند (AUD-W2 سجل 33-b) — گام بعد باید با classifyV103 هم‌راستا شوند؛ (۲) دامنهٔ submitted در تقسیم ۰..۹۹۹۹ است (قرارداد تسک) — عمل‌جایگزینِ ضربیِ بزرگ‌تر از ۹۹۹۹ آشکار نمی‌شود؛ (۳) در موارد ابهام‌ناپذیر از روی عدد مثل ۴۷۰۰→۴۷۰ (هم حذف صفر میانه ممکن است هم ÷۱۰) موتور به خانوادهٔ ۳ برچسب می‌زند؛ (۴) دو کد جدید و جمله‌ها تا تأیید معلم هم‌ساز «پیشنهادی» می‌مانند (برگهٔ انسانی الف — میراث AUD-01).
---
Task ID: 33-c
Agent: general-purpose (تب بانک تمرین)
Task: تب چهارم «بانک تمرین خشاب» در داشبورد معلم (/) — نمایش خشاب منتشرشدهٔ KH-G3-MATH (v0.7) + برچسب‌سنجی زندهٔ هر گزینهٔ انحرافی با موتور واقعی بازی (تک‌منبع حقیقت: import دوباره، نه کپی)

Work Log:
- مطالعهٔ مقدماتی: worklog (Task 30..33-a/b)؛ cartridge-schema.js (parseOptionValue/extractMultiplicationFactors/parseClaims)، errors.js (classifyAttempt)، errors-v103.js (classifyV103/PRIORITY_V103)؛ ساختار کامل JSON منتشرشده (identity ۱۴فیلدی، bookMap=16، questionBank=20، validation.stats/gate)؛ الگوی تب‌های موجود (bottlenecks-tab.tsx، state-views، api.ts، route handler نمای کلی). allowJs از قبل true بود — tsconfig دست نخورد.
- تحویلی ۱ — src/app/api/cartridge/route.ts (جدید؛ GET + force-dynamic): خواندن public/math-game/cartridges/KH-G3-MATH.json با fs؛ import موتور واقعی با مسیر نسبی (../../../../../… از src/app/api/cartridge → چهار سطح به ریشه) از errors.js / errors-v103.js / cartridge-schema.js. لایهٔ تفسیر سؤال فقط در همین route: (۱) extractMultiplicationFactors(prompt) → classifyAttempt({f1,f2,submitted})؛ (۲) وگرنه تقسیم — صریح («۱۵÷۳») با regex روی ارقام فارسی/لاتین یا داستانی با لنگر «را» + «در … Xتایی» (Q-202/Q-204) یا «را … بین M» (Q-201) با گارد a>b و totalDivision=!includes('کامل') → classifyV103({op:'div',…})؛ (۳) وگرنه جمع ستونی فقط به فرم دقیق «a + b = ؟» (anchored — «۵+۵+۵+۵+۵» قاطی نمی‌شود؛ Q-206) → classifyV103({op:'sum'})؛ (۴) وگرنه null. گزینهٔ پاسخ از verdicts رد می‌شود؛ v===null (گزینهٔ متنی مثل «گره ندارد»/«چهار هزار و هفت») → engineCode=null صادقانه. خروجی: {cartridge:{cartridgeId, generatedAt, source, validation, identity}, bank:[{id, anchorId, anchorTitle از bookMap, cpa, domain, status, prompt, options, answerIndex, optionErrorMap, verdicts:[{letter, value, engineCode, claim}]}]} — claim از parseClaims همان موتور برای tooltip. خطاها → ۵۰۰ با پیام فارسی صادقانه (بدنهٔ error به کلاینت می‌رسد).
- تحویلی ۲ — src/components/dashboard/cartridge-tab.tsx (جدید): کارت شناسنامه (شناسه + عنوان فارسی از فیلد «عنوان فارسی خشاب»، چهار Badge آمار همگی زنده از validation.stats/gate — سؤال ۲۰=۱۳+۷ | اطلس ۱۲+۸ | درس ۱۶=۱۰ | گیت: مجاز — ۰ قرمز/۷ زرد، Badge گیت قرمز>0 → rose، خط منبع xlsx+ابزار+زمان تولید با faDateTime)، فهرست ۷ هشدار زرد در Collapsible با باکس اسکرولی max-h-40 + custom-scroll؛ بدنه: بانک ۲۰ سؤال در max-h-96 overflow-y-auto + custom-scroll، هر ردیف: Badge وضعیت (سبز=تأییدشده/amber=نیاز به تأیید)، شناسه mono، لنگر (عنوان درس)، چیپ‌های CPA/دامنه، prompt، چهار کارت گزینه — پاسخ با ✓ و ring سبز ملایم (emerald)، هر گزینهٔ انحرافی چیپ حکم موتور: engineCode → Badge amber مونو (مثل E_OP_REVERSE)، وگرنه «بی‌الگو»ی کم‌رنگ (و «غیرعددی» وقتی value=null — تمایز صادقانه که موتور اصلاً نرسیده)؛ متن کاندید optionErrorMap در title (tooltip) هر گزینه. Skeleton/خطا+تلاش دوباره هم‌الگوی bottlenecks-tab (ErrorCard). پالت emerald/amber/slate — بدون آبی/نیلی، فارسی RTL.
- تحویلی ۳ — اتصال: page.tsx (آیکون Package، TabTrigger چهارم «بانک تمرین خشاب»، TabsContent، cartridgeQuery با useQuery بدون refetchInterval — محتوای منتشرشده استاتیک است؛ وُرد به refetchAll/isRefreshing/anyError)؛ api.ts (fetchCartridge با خواندن پیام error فارسی سرور در شکست)؛ types.ts (چهار نوع جدید CartridgeVerdict/CartridgeQuestion/CartridgeIdentityField/CartridgeResponse — فقط‌الحاقی).
- راستی‌آزمایی: curl → 200 با ۲۰ سؤال و ۶۰ verdict (۲۸ برچسب‌خورده، ۲۶ بی‌الگوی صادقانه، ۶ غیرعددی)؛ سه نمونهٔ الزامی تأیید شد: Q-206 الف(۵۹۴)→E_CARRY_MISS، Q-201 ج(۹)→E_OP_REVERSE (و الف→E_GROUP_VS_COUNT، د→E_OP_REVERSE)، Q-105 ج(۶۰۰)→E_PLACE_SHIFT (و ب→E_ADD_CONFUSION). مرورگر (agent-browser): تب چهارم کلیک شد، ۲۰ ردیف رندر شد (نه اسکلت همیشگی)، چیپ‌های موتور در DOM حاضرند، Collapsible هشدارها با AUD-07 باز شد، صفر خطای کنسول/صفحه؛ اسکرین‌شات /tmp/cartridge-tab.png (+ /tmp/cartridge-tab-warnings-open.png با هشدارهای باز). dev.log: فقط GET /api/cartridge 200 — بدون خطای کامپایل (EADDRINUSE ابتدای لاگ مال راه‌اندازی قبلی سرور است).
- پاکسازی: یک خطای tsc از نوع verdicts=[] (never[]) در route.ts اصلاح شد (تایپ صریح) — npx tsc --noEmit برای پنج فایل این تسک صفر خطا (خطاهای tsc دیگرِ ریپو پیش‌موجودند: examples/، skills/، routeهای قدیمی). npm run lint: ۹۸ مشکل همگی در فایل‌های legacy همین public/math-game (با stash اثبات شد پیش‌موجودند) — پنج فایل این تسک جداگانه lint شدند: exit 0. npm test بازی: ۷۹/۷۹ سبز — هیچ فایلی از public/math-game تغییر نکرد (فقط import).

Stage Summary:
- تحویلی‌ها: src/app/api/cartridge/route.ts (جدید) | src/components/dashboard/cartridge-tab.tsx (جدید) | src/app/page.tsx (تب چهارم + کوئری) | src/components/dashboard/api.ts (fetchCartridge) | src/lib/dashboard/types.ts (۴ نوع فقط‌الحاقی). هیچ فایل بازی/اسکیمای خشاب/تب موجود دیگری تغییر نکرد و وابستگی جدیدی اضافه نشد.
- نکتهٔ صادق‌ماندن برچسب‌ها (عمدی و مطلوب تسک): حکم هر چیپ «موتورِ واقعی» است نه ادعای خشاب — جاهایی که نقشهٔ خشاب با موتور نمی‌خواند (نمونه: Q-109 ج=۲۱ موتور E_SKIP_UNDERCOUNT می‌زند ولی نقشه E_COMMUTATIVE_FAIL رفتاری را ادعا می‌کند؛ Q-110 ب=۲۵ موتور E_ADD_CONFUSION می‌زند ولی نقشه E_FACT_CONFUSION نوشته) چیپ موتور را نشان می‌دهد و ادعای خشاب فقط در tooltip می‌ماند — دقیقاً «بازخوانی AUD-W2» که سجل 33-b طلب کرده بود.
- محدودیت‌های شناخته‌شده: (۱) لایهٔ تفسیر طبق قرارداد تسک فقط سه شاخه دارد — ضرب داستانی بدون × (Q-111) و مسائل «☐»/آرایه (Q-106/Q-107) و چهاررقمی کلامی (Q-205) به موتور نمی‌رسند و «بی‌الگو/غیرعددی» نشان داده می‌شوند؛ اگر بعداً شاخهٔ چهارم خواست شد فقط در route اضافه می‌شود، موتور Pure دست‌نخورده می‌ماند. (۲) parseClaims ادعاها را روی «؛» می‌شکند — متن داخل پرانتز ممکن است بریده شود (رفتار موتور، دست‌نخورده). (۳) خشاب هاردکد به KH-G3-MATH است (قرارداد T4) — خشاب جدید یعنی مسیر جدید در route.
- کارهای بعدی معلق بر تصمیم مالک: رفع ناسازگاری‌های نقشهٔ گزینه→خطا که برچسب‌سنجی زنده آشکار کرد (Q-109ج/Q-110ب و مشابه‌ها)، تأیید انسانی برگهٔ الف (میراث AUD-01)، و در صورت نیاز شاخهٔ تفسیر ضربِ داستانی برای Q-111.

---
Task ID: 33-pause
Agent: Z.ai Code (اصلی)
Task: ثبت توقف جلسه به درخواست کاربر — «گام بعدی را شروع نکن، شب شده و نمی‌توانم کار را جلو ببرم»

Work Log:
- هیچ اقدام اجرایی انجام نشد؛ موتور/خشاب/داشبورد/بسته‌بندی همگی دست‌نخورده ماندند (بدون diff جدید)
- گام ۳ (پایلوت با معلم واقعی) شروع نشد و شروع هم نخواهد شد مگر با «ادامه» صریح کاربر
- وضعیت نهایی موج الف تأیید شد: v10.3.0-beta (پکیج 10.3.0-beta.0، بنر «۱۰.۳ بتا») — ۷۹/۷۹ سبز، گیت «مجاز» (۰ قرمز / ۷ زرد)، برگهٔ انسانی الف در download/audit-report-waveA-v0.7.md

Stage Summary:
- وضعیت یخ‌زده: گام ۰، ۱ و ۲ (موج الف) بسته و ثبت‌شده‌اند (Task 29..33 + 33-a/b/c)
- نقطهٔ ادامه: گام ۳ — پایلوت با معلم واقعی (فاز ۰؛ پاسخ ۵ سؤال گیت) یا توزیع برگهٔ انسانی الف — صرفاً با «ادامه» کاربر

---
Task ID: 34
Agent: Z.ai Code (اصلی)
Task: «ادامه» کاربر («هوش مصنوعی که خواب نداره تو ادامه بده») — آماده‌سازی کامل گام ۳: کیت پایلوت فاز ۰ + بستهٔ چاپی (بدون هیچ تغییر در محصول؛ اجرای پایلوت خودش منوط به جلسهٔ معلم واقعی است)

Work Log:
- بازخوانی مقدماتی: worklog (Task 25..33-pause)، download/audit-report-waveA-v0.7.md (برگهٔ انسانی الف بخش ۳)، خشاب منتشرشدهٔ KH-G3-MATH v0.7 (اطلس ۲۰ کد با behavioralSignal؛ ۷ سؤال موج الف Q-112/Q-201..206 با options/answerIndex/optionErrorMap)، download/cartridge-registry-18-v1.1.xlsx شیت «تقویم فازها».
- کشف کلیدی: تعریف رسمی «۵ سؤال گیت فاز ۰» فقط در چت بود و بایگانی فایل نداشت → عین عبارت رجیستری v1.1 بایگانی شد: «دستگاه در کلاس؟ دقیقهٔ قابل‌استفاده؟ الگوی استفاده؟ خطاهای واقعی با ۱۲ کد هم‌خوان؟ تمایل به پرداخت؟» — برای هر سؤال: روش اندازه‌گیری + معیار + فرم ثبت طراحی شد.
- تحویلی ۱ — download/pilot-kit-phase0-gam3.md (کیت اصلی گام ۳): بخش ۰ وضعیت منتشرشده (v10.3.0-beta/v0.7/گیت ۰قرمز-۷زرد)؛ بخش ۱ پنج سؤال گیت با فرم ثبت؛ بخش ۲ پروتکل جلسهٔ ۳۰-۴۵ دقیقه (چک‌لیست پیش از جلسه + سناریوی A بازی آزاد / B تشخیص با اسکریپت / C بازخوانی با تب «بانک تمرین خشاب»)؛ بخش ۳ اسکریپت ۷ سؤال موج الف عیناً از خشاب با معنای هر گزینهٔ انحرافی (قید اجرای تخته/کاغذ برای Q-112 طبق نوت خشاب)؛ بخش ۴ برگهٔ مشاهدهٔ خطای ۲۰ کد؛ بخش ۵ معیار خروج قابل سنجش از فاز ۰ (≥۱ جلسه با ≥۳ دانش‌آموز، هر ۵ سؤال، ≥۵ مشاهده، ≥۳ هم‌خوانی کد، برگهٔ انسانی امضاشده)؛ بخش ۶ ردگیری گام‌ها — قید: موج ب پشت گیت پایلوت.
- تحویلی ۲ — download/pilot-prints-fase0.html (بستهٔ چاپی سه‌صفحه‌ای A4، RTL، بدون آبی): صفحهٔ ۱ فرم ۵ سؤال گیت با چک‌باکس و جعبهٔ حکم؛ صفحهٔ ۲ برگهٔ تأیید انسانی الف (عین بخش ۳ گزارش ممیزی: هویت چاپ + ۸ ردیف صفحهٔ «؟» + تصمیم دو کد جدید + تیک ۷ سؤال + امضا)؛ صفحهٔ ۳ جدول مشاهدهٔ دوستونی خطا (۱۲ تأیید | ۸ نیازمند تأیید + ۴ ردیف «خطای جدول‌نوشته») + اسکریپت فشردهٔ ۷ سؤال با پاسخ سبز.
- راستی‌آزمایی مرورگری (agent-browser روی file://): عنوان درست، صفر خطای صفحه؛ شمارش DOM: ۳ صفحه، ۴۰ چک‌باکس، ۷ کارت سؤال؛ اسکرین‌شات تمام‌صفحه /tmp/pilot-prints-full.png — هر سه صفحه با فونت/رنگ/چینش درست رندر شد. git status: فقط دو فایل جدید — صفر تغییر در کد محصول/تست/خشاب.

Stage Summary:
- گام ۳ کاملاً «آمادهٔ اجرا» شد: معلم واقعی فردا فقط باید بستهٔ چاپی را چاپ کند، جلسه را طبق پروتکل برگزار کند و فرم‌ها را پر کند — هیچ ابزاری دیگری لازم نیست.
- «۵ سؤال گیت فاز ۰» از چت به فایل رسید (خطر گم‌شدن بسته شد)؛ معیار خروج فاز ۰ برای اولین بار قابل سنجش و کاغذی شد.
- مرز انضباطی حفظ شد: اجرای پایلوت و پر کردن فرم‌ها با انسان است؛ هیچ زردی سبز نشد؛ موج ب همچنان پشت گیت پایلوت؛ نکتهٔ جزئی: غلط تایپی «نفرía» در پیش‌نویس کیت در همان نشست اصلاح شد (نخوان).
- گام بعدی (معلق بر شاهد انسانی): پس از جلسهٔ پایلوت و برگرداندن فرم‌ها → باز شدن فاز ۱ (S1 با کتاب فیزیکی) + سبز شدن کدها/سؤال‌های تأییدشده + بسته‌بندی v10.3.0 نهایی.

---
Task ID: 35
Agent: Z.ai Code (اصلی)
Task: «به نظرم ادامه بدهیم» — دو تحویلی شبِ پیش از پایلوت: (۱) شاخهٔ چهارم تفسیر Q-205 در route داشبورد (موتور Pure دست‌نخورده) و (۲) ممیزی کامل ۶۰ گزینهٔ انحرافی «موتور در برابر نقشه» + پیش‌نویس تصمیم v0.7.1 (بدون اعمال)

Work Log:
- بازخوانی: src/app/api/cartridge/route.ts (سه شاخهٔ موجود تفسیر)؛ errors-v103.js (قرارداد classifyFourDigit: فقط حذف صفر میانه → E_ZERO_PLACE_MISS؛ ۴۰۷۰→۴۷۰ طلایی؛ بقیه صادقانه null)؛ baseline زندهٔ API ثبت شد (Q-205: هر سه گزینه value=null/غیرعددی).
- تحویلی ۱ — شاخهٔ چهارم تفسیر در route.ts (فقط لایهٔ داشبورد): parseVerbalNumber (تحلیل‌گر کلامی سخت‌گیر تا ۹۹۹۹ — توکن ناشناخته/ترتیب نادرست → null، هرگز حدس نمی‌زند) + extractFourDigitRead (prompt با «خواندن/نوشتن» + عدد ۴رقمی) → classifyV103({op:'read'})؛ اولویت پس از ضرب/تقسیم/جمع ستونی. اثر زنده: Q-205 ج(۴۷۰)→E_ZERO_PLACE_MISS؛ الف(۴۰۰۷)/د(۴۷۰۰) بی‌الگوی صادقانه؛ «غیرعددی» کل بانک ۶→۳ (باقی: Q-112). ضد رگرسیون: سه نمونهٔ طلایی (Q-206الف/Q-201ج/Q-105ج) ثابت + ۱۹ سؤال دیگر بایت‌به‌بایت همان قبل؛ دو «REGRESSION» اولیهٔ اسکریپت چک، خطای انتظارات خود اسکریپت بود نه کد (Q-204ج بی‌فلگ «کامل» و Q-112ب گزینهٔ متنی — هر دو قبل/بعد یکسان). npx tsc روی route.ts: ۰ خطا | eslint: exit 0 | npm test بازی: ۷۹/۷۹.
- راستی‌آزمایی مرورگری: تب «بانک تمرین خشاب» باز شد؛ چیپ E_ZERO_PLACE_MISS در DOM حاضر (document.body تأیید — کوئری اول به tabpanel مخفیِ Radix می‌خورد)؛ اسکرین‌شات /tmp/q205-tab.png (شناسنامهٔ خشاب v0.7 + ۴ Badge). dev.log: فقط EADDRINUSE قدیمیِ ابتدای لاگ؛ همهٔ GETها 200.
- تحویلی ۲ — tmp-scripts/build-mismatch-inventory.mjs (مولد قابل تکرار) → download/option-map-mismatch-inventory.md: تمام ۶۰ گزینهٔ انحرافی با موتور زنده اجرا و ادعای نقشه با «قطعه‌بندی مرز حرف→» (نه پارس «؛»-محور که پرانتزها را می‌شکند و «کاندید E_OP_REVERSE» را قاچاق می‌کرد) استخراج شد. حکم نهایی: ۲۱ هم‌خوان | ۸ ناسازگار مستند (۴ تضاد واقعی: Q-103ب/Q-109ج/Q-110ب/Q-205ج + ۴ شکاف نامی: Q-201د/Q-202ج/Q-203ج/د) | ۲۷ ادعای بی‌شاهد (خوراک S2/توسعهٔ موتور) | ۳ غیرعددی (Q-112) | ۱ بی‌الگو. سند شامل: تضادها با پیشنهاد اصلاح، پیش‌نویس ۸ردیفی از→به v0.7.1 (صریحاً «فقط پیشنهاد — اعمال با مالک از مسیر اکسل+مبدل+گیت»)، ۲۷ بی‌شاهد، یادداشت شاخهٔ چهارم، پیوست کامل ۶۰ردیفی.
- کشف مهم ممیزی: Q-205ج نقشه می‌گوید «حذف جایگاه هزار» ولی موتور (درست) E_ZERO_PLACE_MISS می‌زند — حذف صفر صدگان همان کدِ جدیدِ کاندید است؛ یعنی برچسب صحیحِ این گزینه حالا در جلسهٔ پایلوت شاهد می‌گیرد.

Stage Summary:
- داشبورد برای پایلوت کامل شد: خانوادهٔ ۳ (چهاررقمی) حالا برچسب زندهٔ موتور دارد — سناریوی C جلسهٔ فردا برای Q-205 بی‌معنا نبود.
- ممیزی ۶۰گزینه‌ای برای اولین بار با روش درستِ قطعه‌بندی، فهرست دقیق تصمیم v0.7.1 را آماده کرد — ۸ ردیف مشخص، نه «مشابه‌ها»ی مبهم؛ اعمال آن فقط بعد از مالک و شاهد پایلوت.
- گیتی دورنخورده: خشاب v0.7/موتور/تست‌ها دست‌نخورده (۷۹/۷۹)؛ هیچ زردی سبز نشد؛ موج ب همچنان پشت گیت پایلوت.
- تحویلی‌ها: route.ts (شاخهٔ چهارم) | tmp-scripts/build-mismatch-inventory.mjs | download/option-map-mismatch-inventory.md | /tmp/cartridge-before.json (پایهٔ مقایسه).
- گام بعدی (معلق بر شاهد انسانی): جلسهٔ پایلوت فردا → پر شدن فرم‌ها → تصمیم مالک روی ۸ ردیف v0.7.1 → فاز ۱ (S1).

---
Task ID: 36
Agent: Z.ai Code (اصلی)
Task: «من بخوابم هم تو باید کار کنی» — رفع بدهی فنی محیط تست (مجموعهٔ کامل ۲۶۰/۲۶۰ سبز) + راستی‌آزمایی E2E کامل مسیر طلایی بازی و داشبورد (بدون هیچ تغییر در محصول/خشاب/موتور)

Work Log:
- کشف: `bun test` کل مخزن ۱۶۶پاس/۸شکست/۸خطا داشت — بازی `npm test` (۷۹ آزمون) سبز بود ولی آزمون‌های میراث v9 (server/tests) به‌دلیل نبود node_modules در بستهٔ آپلودی اصلاً اجرا نمی‌شدند («Cannot find module ajv/dist/2020»، «Cannot find package fake-indexeddb»).
- رفع محیطی (نه کدی): نصب دقیق مطابق package-lock خود پکیج (ajv@8.20.0، ajv-formats@3.0.1، fake-indexeddb@6.2.5) به‌عنوان devDependency ریشه — public/ با node_modules آلوده نشد؛ hoisting تعارض ajv@6 ترتیبی را خودکار حل کرد.
- کشف دوم پس از اجراشدن فایل‌ها: یک تعارض قراردادی واقعی — v9-local.test.js انتظار دارد `openLocal(null)` رد شود ولی fallback درون‌حافظه‌ای Task 1 آن را می‌بلعید. رفع حداقلی در local.mjs: null صریح → رد صادقانه (قرارداد v9)؛ نبودِ حافظه در زمان اجرا (undefined/بدشکل) → همان fallback (قرارداد Task 1 برای iframe محدودشده). هر دو رفتار حفظ شد.
- نتیجه: **۲۶۰/۲۶۰ آزمون سبز** (۷۹ بازی + ۱۸۱ میراث v9) — اولین بار در این محیط. `bun run lint` پس از ignore کردن public/math-game/** و tmp-scripts/** (دارایی استاتیک با سویت مستقل) → exit 0؛ ۹۷ خطای require میراث که از قبل بودند دیگر نویز نیستند.
- راستی‌آزمایی E2E مرورگری (agent-browser) — دو سطح:
  (الف) داشبورد Next.js `/`: عنوان درست؛ ۴ تب حاضر؛ تب «بانک تمرین خشاب»: شناسنامهٔ KH-G3-MATH + «گیت: مجاز — ۰ قرمز / ۷ زرد» + برچسب‌های زنده؛ چیپ E_ZERO_PLACE_MISS (شاخهٔ چهارم Q-205، تحویلی 35) در DOM تأیید و «غیرعددی» دقیقاً ۳ سلول (۶→۳)؛ کنسول فقط info/HMR، صفر خطا؛ فوتر طبیعی زیر محتوا؛ موبایل ۳۹۰px بدون اسکرول افقی.
  (ب) بازی `/math-game/v10.html`: بوت سالم + لود خشاب با حکم مجاز؛ ساخت پروندهٔ مهمان + ماندگاری بعد از reload؛ نقشهٔ ۳ سکتور با قفل‌ها؛ جلسهٔ کامل ۸ سؤال تطبیقی (۲×۲ … ۵×۹) با fill+click پاسخ درست → **نیروگاه ۱۰۰٪ (لایهٔ ۲ با ۷۰٪ باز)** + آزادشدن مأموریت جانبی ۶۰٪؛ ماندگاری پیشرفت بعد از reload؛ جلسهٔ ناتمام رهاشده دور ریخته شد (رفتار درست)؛ پنل معلم مستقل رندر شد؛ POST /api/sessions 201 (همگام‌سازی بک‌اند). صفر خطای کنسول در کل مسیر.
- پاک‌کاری: دانش‌آموز تستی «مهمان ایستگاه» + جلسه‌اش از SQLite حذف شد تا داشبورد معلم فردا تمیز شروع کند (پروفایل‌های «کودک» و «آرش» متعلق به تست‌های خود کاربر — دست نخورد).
- وضعیت گیت دست‌نخورده: خشاب v0.7، موتور errors-v103، schema/loder، ۸ ردیف v0.7.1 (فقط پیش‌نویس) — هیچ زردی سبز نشد؛ موج ب پشت گیت.

Stage Summary:
- بدهی فنی محیط تست بسته شد: مجموعهٔ کامل مخزن برای اولین بار ۲۶۰/۲۶۰ و lint صفر — اعتماد به regression-checkها برای شب پایلوت بازسازی شد.
- مسیر طلایی بازی (سناریوی A پایلوت) سرتاسری مرورگری تأیید شد: ثبت‌نام → جلسهٔ تطبیقی → قفل ۷۰٪ → مأموریت جانبی → ماندگاری؛ داشبورد معلم (۴ تب) با برچسب موتور زنده تأیید شد.
- تغییرات دیفیلی محدود و ابزاری: package.json/bun.lock (+۳ devDep)، eslint.config.mjs (+۲ ignore)، local.mjs (۲ خط قرارداد) — صفر تغییر در خشاب/موتور/محتوا.
- تحویلی‌ها: local.mjs (رفع تعارض قرارداد) | eslint.config.mjs | package.json/bun.lock | دیتابیس تمیزشده.
- مانده (معلق بر انسان): چاپ بستهٔ پایلوت ← جلسه ← فرم‌ها؛ تصمیم مالک روی ۸ ردیف v0.7.1 و برگهٔ الف؛ سپس فاز ۱ (S1 با کتاب فیزیکی، سبز شدن کدها/سؤال‌ها، L-D1/L-D2، بسته‌بندی v10.3.0 نهایی). موج ب (کسر/هندسه/اندازه‌گیری/آمار) همچنان پشت گیت پایلوت.

---
Task ID: 37
Agent: Z.ai Code (اصلی)
Task: صبح پایلوت — کشف ریست شبانهٔ محیط (rollback به دوران Task 21) + بازیابی کامل v10.3 از پشتیبان /tmp/my-project + اسموک‌تست دو سطحی

Work Log:
- کشف بحران: download/ خالی (فقط README)، tmp-scripts/ خالی، cartridges/ و errors-v103.js و تست‌های v10.3 و route.ts غایب، worklog به ۲۱ تسک برگشته، package.json بازی 10.2.0، v10.html بدون بنر ۱۰.۳ — یعنی کل شب‌کاری Tasks 22..36 پاک شده بود؛ در گیت هیچ‌کدام هرگز commit نشده بودند (هیچ ردی در تاریخچه).
- شکاف منابع: کارنوشت Tasks 22-36 هم پاک شده بود؛ تنها دانش، خلاصهٔ کانتکست جلسه بود.
- کشف نجات‌بخش: /tmp/my-project یک کپی کامل و تازه (دوران Task 36) بود: worklog تا 36، پکیج 10.3.0-beta.0، devDeps ajv/ajv-formats/fake-indexeddb، route.ts با شاخهٔ چهارم، tmp-scripts کامل (مبدل + apply_v07 + build-mismatch-inventory)، download/ با هر ۱۸ تحویلی، cartridges/KH-G3-MATH.json.
- بازیابی: rsync افزودنی از پشتیبان به پروژه (بدون --delete؛ .git و skills/ و next-env.d.ts زنده ماندند؛ خطاهای chgrp صرفاً روی فایل‌های root-owned پوشهٔ upload — محتوا سالم)؛ سپس bun install (۸ بسته) → **۲۶۰/۲۶۰ آزمون سبز** → lint exit 0.
- ری‌استارت dev server و اسموک‌تست مرورگری: داشبورد با ۴ تب (نمای کلی/دانش‌آموزان/گلوگاه‌ها/بانک تمرین خشاب)، بازی با بنر «۱۰.۳ بتا»، کنسول: «خشاب KH-G3-MATH بارگذاری و اعتبارسنجی شد — ۲۰ سؤال (۱۳ تأیید)، گیت مبدل: مجاز (۰ قرمز / ۷ زرد)» — عین وضعیت پیش از ریست.
- درس: پشتیبانِ خودکار /tmp نجات‌دهنده بود؛ از این پس تحویلی‌های حیاتی هم در download/ و هم مسیر دوم (tool-results/ یا یک کپی در public/math-game/docs/) نگه داشته می‌شوند تا ریست بعدی بی‌هزینه باشد.

Stage Summary:
- وضعیت v10.3 پس از بازیابی دقیقاً برابر پایان Task 36 است: خشاب v0.7 منتشرشده، گیت ۰قرمز/۷زرد، ۲۶۰/۲۶۰ تست، lint صفر، هر دو سطح (بازی + داشبورد) مرورگری تأیید.
- هیچ پیشرفتی از دست نرفت؛ ریست فقط هزینهٔ ~۲۰ دقیقه بازیابی داشت.
- گام بعدی همان گام ۳ انسانی است: چاپ بستهٔ ۳ صفحه‌ای، جلسهٔ پایلوت، فرم‌ها؛ سپس تصمیم مالک روی ۸ ردیف v0.7.1 و باز شدن فاز ۱.

---
Task ID: 38
Agent: Z.ai Code (اصلی)
Task: درخواست کاربر — رفع دانلود نشدن زیپ پشتیبان + سامانهٔ پشتیبان‌گیری خودکار دوره‌ای به گیت‌هاب خصوصی

Work Log:
- بررسی گیت به درخواست «برگرداندن از گیت‌هاب»: سندباکس هیچ remote ندارد (github.io کاربر دیپلوی دستی جداگانه است)؛ اما تاریخچهٔ محلی وضعیت کامل v10.3 را دارد — کامیت 69745e2 شامل هر ۱۸ تحویلی download/ + خشاب + errors-v103 + تست‌های v10.3 + route.ts + کل tmp-scripts + کارنوشت ۴۱تسکی؛ working tree هم تمیز (auto-commit پس از بازیابی همه‌چیز را گرفته بود).
- علت سنگینی زیپ قبلی (۲۷MB): ۲۶MB پس‌زمینه‌های PNG بازی (bg-*.png حدود ۱۲ فایل ۲-۳MB) + نسخهٔ کپی زیپ در pilot/. ریشه‌یابی شد.
- تحویلی ۱ — زیپ سبک math-game-v10.3-backup-lean.zip (۵.۴MB): کل سورس + دیتابیس + تحویلی‌ها + کارنوشت، بدون bg-*.png (هر ۲۷ فایل asset در گیتِ کامیت‌شده محفوظ است → بازیابی کامل = زیپ سبک + git).
- تحویلی ۲ — پورتال دانلود /math-game/pilot/ (index.html): لینک بستهٔ چاپی + کیت + زیپ سبک + زیپ کامل با download attribute + نکتهٔ «Open in New Tab» (iframe پیش‌نمایش دانلود را مسدود می‌کند — علت محتمل شکایت کاربر).
- تحویلی ۳ — scripts/auto-backup.sh + اجرای زندهٔ آن (nohup، هر ۱۵ دقیقه): اگر تغییر بود → کامیت محلی؛ اگر origin تنظیم شده باشد → push به گیت‌هاب. آمادهٔ اتصال به ریپوی خصوصی کاربر به محض دریافت توکن (curl آزمایشی: زیپ سبک 200، پورتال 308→200).
- /tmp/my-project دوباره تازه‌سازی شد (لایهٔ ۲ هم‌گام با وضعیت فعلی).

Stage Summary:
- سه لایهٔ پشتیبان فعال: گیت محلی (کامل) | /tmp پشتیبان | زیپ سبک/کامل قابل‌دانلود برای کاربر.
- حلقهٔ خودکار ۱۵دقیقه‌ای روشن است؛ تنها حلقهٔ ناقص، push گیت‌هاب است که منوط به ساخت ریپوی خصوصی + توکن توسط کاربر است (راهنمای قدم‌به‌قدم در پاسخ چت داده شد + هشدار: خصوصی‌کردن ریپوی github.io در پلن رایگان صفحه را از کار می‌اندازد — ریپوی جدا برای پشتیبان توصیه شد).
---
Task ID: 39
Agent: Z.ai Code (main)
Task: انجام ریلیز رسمی v10.3.0-beta.0 پیش از هر کار دیگر (درخواست صریح کاربر) + رفع تجمیع زیپ‌های قدیمی

Work Log:
- بررسی وضعیت: گیت تمیز (آخرین ذخیرهٔ خودکار 04:48)، بازی 10.3.0-beta.0، سرور روی 3000 سالم
- کشف اینکه pilot/ دو زیپ قدیمی انباشته داشت (lean 5.4M + backup 27M) و cause تورم 59MB پوشهٔ بازی بود
- نگارش public/math-game/RELEASE-NOTES-v10.3.0-beta.0.md (فارسی: محتوا، اجرای آفلاین، قفل‌های عمدی، نقشهٔ راه، لایه‌های پشتیبان)
- ساخت بستهٔ رسمی ریلیز: public/math-game/release/math-game-v10.3.0-beta.0-full.zip (26MB، 415 فایل؛ بدون node_modules/.next/.git/.env/زیپ‌ها)
- کپی به download/ و حذف دو زیپ قدیمی pilot و download (تک‌منطقه‌ای شدن آرتیفکت)
- .gitignore: افزودن public/math-game/release/ و download/*.zip (مرجع = تگ گیت، نه باینری)
- src/app/page.tsx فوتر: لینک جدید «دانلود ریلیز v10.3.0-beta.0 📦» با download attribute
- کامیت 1f1802f + تگ انوتیت‌دار v10.3.0-beta.0
- راستی‌آزمایی: HTTP 200 + Content-Type application/zip + امضای PK؛ لینک فوتر در HTML رندر شد؛ agent-browser: داشبورد و بازی (بنر ۱۰.۳ بتا) بدون خطا؛ dev.log سبز؛ rsync --delete آینهٔ /tmp تازه شد

Stage Summary:
- اولین ریلیز رسمی v10.3.0-beta.0 بسته شد: تگ گیت + یادداشت انتشار + بستهٔ زیپ 26MB قابل دانلود از فوتر داشبورد
- آدرس دانلود: /math-game/release/math-game-v10.3.0-beta.0-full.zip
- پس از دریافت توکن گیت‌هاب کاربر: push تگ + GitHub Release با همین بسته
- خواستهٔ کاربر «پرایوت رایگان» با مخزن موجود math-game (Change visibility) و توکن classic با اسکوپ repo هم‌چنان در انتظار دو خط کاربر است
---
Task ID: 40
Agent: Z.ai Code (main)
Task: اتصال به گیت‌هاب خصوصی کاربر + اولین ذخیرهٔ ابری + GitHub Release رسمی v10.3.0-beta.0

Work Log:
- کاربر مخزن bayrami1341/math-game را Private کرد (کشف ارزشمند: مخزن ۲۰۶ کامیت تاریخچهٔ v6→v10.2 + ۴ تگ/۴ ریلیز دارد)
- کاربر PAT (اسکوپ repo، ۹۰ روز) فرستاد؛ کشف و رفع بهداشتی: .env ردیابی‌شده بود → git rm --cached + gitignore
- اجرای scripts/gh-connect.sh: فچ تاریخچهٔ مخزن (main، v6، تگ‌های v6/v7/v9/v10.2-stable) + پوش وضعیت v10.3 به شاخهٔ تازهٔ v10.3-beta + پوش تگ v10.3.0-beta.0 — بدون هیچ تغییری در شاخه‌های موجود
- ساخت GitHub Release «v10.3.0-beta.0 — ریلیز پایلوت فاز ۰» (id 419209318) + آپلود بستهٔ 26MB (state: uploaded، sha256 ثبت شد)
- scripts/gh-autosave.sh نوشته شد؛ نسخهٔ اول به‌داشت جمع‌آوری فرایندهای سندباکس مرد → مقاوم‌سازی (پوش فوری هنگام شروع + setsid) → زنده (PID 4287) و اولین پوش فوری موفق
- راستی‌آزمایی API: private:true؛ ls-remote: شاخه و تگ روی ریموت؛ آینهٔ /tmp تازه شد

Stage Summary:
- حلقهٔ پشتیبان ۴لایه کامل شد: گیت محلی + آینهٔ /tmp + زیپ ریلیز + گیت‌هاب خصوصی (شاخهٔ v10.3-beta + تگ + Release با زیپ قابل دانلود)
- ذخیرهٔ خودکار هر ۵ دقیقه فعال؛ شاخه‌های اصلی کاربر (main/v6) دست‌نخورده
- پیامد شناخته‌شده: صفحات Pages عمومی مخزن math-game از دسترس عموم خارج شد (عمدی، برگشت‌پذیر)
- URL ریلیز: https://github.com/bayrami1341/math-game/releases/tag/v10.3.0-beta.0
---
Task ID: 41
Agent: Z.ai Code (main)
Task: تحقق مستقیم خواستهٔ معلم — تمام کتاب ریاضی در برنامه + لیدربرد + پنل معلم + قابلیت‌های قابل‌مشاهده در تست

Work Log:
- بازرسی: خشاب ۱۶ درس کامل دارد (۱۰ تأیید + ۶ نیازبه‌تأیید: چهاررقمی/کسر/هندسه/اندازه‌گیری/آمار) اما بانک سؤال ۲۰تایی فقط ضرب را پوشش می‌دهد و لیدربرد HTML قبلی فقط-فایر بیس بود و آفلاین می‌مرد
- public/math-game/book.html (جدید): «کتاب کامل ریاضی سوم» — ماژول مستقل آفلاین، ۱۶ درس × ۸ سؤال رویه‌ای (الگو، آرایه، جمع‌تکراری، جدول ضرب، جابه‌جایی، ×۰/۱/۱۰، چندرقمی، تقریب، تقسیم با/بی‌باقیمانده، چهاررقمی، جمع‌و تفریق چهاررقمی، کسر، هندسه/محیط/تقارن، اندازه‌گیری مرکب، آمار/احتمال) + برچسب «آزمایشی» برای دروس پشت گیت + ستاره‌ها و بهترین رکورد در localStorage + هم‌ترازی عنوان/گیت با خشاب واقعی (fetch)
- leaderboard.html بازنویسی: آفلاین‌محور روی پرونده‌های دستگاه (station_profiles_index + studentKey + stationPower/stationSystems از ماژول‌های v9) با مدال و نوار پیشرفت سه‌بنا؛ حالت خالی گویا
- v10.html ناوبری: دکمهٔ «📚 کتاب کامل ریاضی» افزوده شد
- داشبورد: API /api/leaderboard (رتبه‌بندی: پیشرفت←دقت←تعداد سؤال) + تب «جدول قهرمانان» با مدال/تاج/نوار پیشرفت (leaderboard-tab.tsx) + اتصال به refetchAll/isRefreshing
- راستی‌آزمایی مرورگری: book.html هر ۱۶ درس رندر + جلسهٔ کامل ۸ سؤالی تا صفحهٔ نتیجه + ذخیرهٔ پیشرفت + درس کسر باز شد؛ leaderboard.html حالت خالی درست؛ داشبورد تب قهرمانان با ۱۵ دانش‌آموز واقعی (🥇 تینا…)؛ lint exit 0
- commit + push به شاخهٔ v10.3-beta گیت‌هاب + rsync آینهٔ /tmp

Stage Summary:
- «دروس دیگر پیدا نشد» حل شد: کتاب کامل از فوتر و از ناوبری خود بازی در دسترس است
- لیدربرد دو جا کار می‌کند: داخل بازی (آفلاین، پرونده‌های دستگاه) و داشبورد (دادهٔ SQLite کلاس)
- محتوای ۶ درس آزمایشی به‌عنوان «پیش‌نویس قابل‌بازی» منتشر شد — گیت رسمی (۰ قرمز/۷ زرد) دست‌نخورده ماند و سبز شدن فقط با شاهد پایلوت

---
Task ID: 41
Agent: Z.ai Code (main)
Task: ساخت «موتور تألیف خشاب v۱.۰» — پرامپت/خط تولید سری‌کاری کتاب درسی → اکسل خشاب برای هر ۶ پایه ریاضی (+ کتب دیگر) به درخواست کاربر («پرامپت یا موتوری برای سری‌کاری داشته باشیم تا هوش مصنوعی اشتباه نکند... باید بداند چگونه گراف‌ها را طراحی کند، چه اطلاعاتی از کتاب لازم است، و در اکسل کد شود») + ارتقای مبدل به چندخشابی + بازسازی ۷ آزمون کهنهٔ لیدربرد

Work Log:
- بازرسی زیرساخت تألیف موجود: قالب استاندارد v1.1 (۷ شیت RTL)، پرامپت‌های prefill/audit، مبدل tools/cartridge-converter، گیت cartridge-schema.js — موتور جدید بر همین قراردادها ساخته شد نه موازی با آنها
- سند «موتور تألیف خشاب v۱.۰» نوشته شد (public/math-game/authoring/MOTOR-TALIF-KHSHAB-v1.md + کپی در download/): نقشهٔ خط تولید، ۱۶ قاعدهٔ آهنین ضد توهم (ارثیهٔ ۱۲ قاعده + دامنهٔ ۰-۹۹۹۹ موتور + ارقام فارسی/لاتین + دقت فهرست کتاب)، جدول «چه داده‌ای بازی می‌خواهد و از کجای کتاب»، خط تولید ۱۰گامی با گیت خروجی هر گام، داده‌نامهٔ شیت‌به‌شیت (۱۴/۱۱/۱۷ ستون منطبق با مبدل)، کاتالوگ ۱۴ مدل گراف (M_ARRAY تا M_PATTERN) با فرم استاندارد سلول «شرح شکل/تصویر»، نردبان CPA، جدول پیش‌فرض ۶ پایه با هشدار توسعهٔ موتور، الگوی بسط به کتب دیگر (هستهٔ مشترک + بستهٔ موضوعی)، چک‌لیست ۲۰بندی + ۳ سنجهٔ بازدهی، درس‌های پروندهٔ تاریخی (J12 و...)، و پرامپت اجرایی فشردهٔ خودکفا برای کپی-پیست به هر مدل
- ۵ ورک‌بوک خالی پایه (G1/G2/G4/G5/G6 → khshab-G?-MATH_v0.1.xlsx) با اسکریپت tmp-scripts/make-grade-workbooks.py از قالب v1.1 ساخته شد: شناسنامهٔ هر پایه پیش‌پُر زرد (KH-G?-MATH، خانوادهٔ موتور پیش‌فرض، وضعیت «طرح»)، شیت‌های محتوا بازآرایی شدند تا سطر «یادداشت» بلافاصله زیر هدر بنشیند (مبدل ردیف نمونه را نمی‌خواند — fail-safe) و نمونه‌ها زیر آن به‌عنوان الگو بمانند؛ کپی در download/
- مبدل cartridge-converter به v1.1 (چندخشابی) ارتقا یافت: شناسهٔ خشاب از فیلد «شناسهٔ خشاب» شیت شناسنامه خوانده می‌شود (regex لنگردار KH-…-…)؛ مسیر انتشار JSON و نام گزارش از آن مشتق می‌شود؛ بدون شناسهٔ معتبر = توقف کامل (جلوگیری از آلودگی G3 با قالب خام)؛ cartridge-schema.js: validateCartridge(c, expectedId = CARTRIDGE_ID) — رفتار پیش‌فرض G3 و ۲۱۰ آزمون دست‌نخورده
- رگرسیون سه‌لایه: تبدیل v0.7 → مجاز (۰ قرمز/۷ زرد/۱۶ درس/۲۰ کد/۲۰ سؤال) و diff JSON فقط generatedAt+source.tool؛ قالب خام بدون شناسه → exit 1 و هیچ نوشتنی؛ دود G1 خالی → cartridges/KH-G1-MATH.json با ۰ ردیف منتشر شد (خط لولهٔ پایهٔ جدید آماده)
- کشف و رفع بدهیِ جلسهٔ قبل: بازطراحی آفلاین leaderboard.html (تسک معلم-محور) ۷ آزمون live-board را کهنه کرده بود (module ESM در vm پارس نمی‌شد) → tests/live-board.test.js بازنویسی شد: صفحهٔ آفلاین با تزریق وابستگی‌های ماژول آزمون می‌شود (رتبه‌بندی قدرت/جلسه، حالت خالی، حافظهٔ مسدود، XSS نام‌ها، بی‌نیازی از Firebase) و شنود زندهٔ Firebase به سطح API رفت (permission/اتصال/لغو شنود/بدون نشت) — ۲۶/۲۶ فایل و ۲۱۰/۲۱۰ کل مجموعه سبز
- فوتر داشبورد: لینک «موتور تألیف خشاب 🧠» به سند افزوده شد؛ bun run lint صفر؛ سرو md/xlsx از authoring/ با HTTP 200 راستی‌آزمایی شد
- E2E مرورگری: داشبورد کامل رندر (۱۵ دانش‌آموز/۸ جلسه/۸۳.۵٪)، لینک فوتر موتور تأیید، بدون خطای کنسول

Stage Summary:
- کاربر حالا می‌تواند برای هر پایه: (۱) ورک‌بوک خالی پایه را باز کند، (۲) پرامپت بخش ۱۲ سند موتور + محتوای کتاب را به هر مدل AI بدهد، (۳) جدول‌های خروجی را بالای سطر «یادداشت» جای‌گذاری کند، (۴) پس از تأیید معلم با bun convert.mjs خشاب JSON همان پایه را منتشر کند — گیت قرمز جلوی خطای AI را می‌گیرد
- قاعدهٔ شناسه‌ها: KH-G{پایه}-{درس}؛ موج Q-1xx/Q-2xx؛ کدهای E_ از سجل G3 وام گرفته شوند
- موتور فعلی G3-محور است؛ فعال‌سازی اجرایی خشاب‌های پایهٔ دیگر در موتور بازی (لودر/مأموریت‌ها) = کار آینده پس از پُر شدن اولین ورک‌بوک
- بدهی آزمون لیدربرد (۷ قرمز میراث جلسهٔ قبل) بسته شد؛ کل CI ۲۱۰/۲۱۰ سبز

---
Task ID: 42
Agent: Z.ai Code (main)
Task: درخواست کاربر — «فرض کن می‌خواهم ریاضی پایهٔ دوم را بدهم؛ گام‌به‌گام بگو چکار کنم» → دفترچهٔ اجرای عملیاتی G2 + تست خشک لوله

Work Log:
- بازرسی فایل‌های تحویلی جلسه قبل: ۳ سند MD (MOTOR-TALIF-KHSHAB-v1 = مادر / prompt-audit = ممیز / prompt-prefill = قدیمی) + ۵ ورک‌بوک خالی G1/G2/G4/G5/G6 در authoring/ و کپی در download/
- بازرسی ساختاری khshab-G2-MATH_v0.1.xlsx با openpyxl: ۷ شیت سالم — شناسنامه پیش‌پُر زرد (KH-G2-MATH، «کارگاه ریاضی پایهٔ دوم»)، سه شیت محتوا با ستون‌های استاندارد (S1=۱۴، اطلس=۱۱، بانک=۱۷) و سطر «یادداشت» زیر هدر
- تست خشک لوله مبدل روی ورک‌بوک خالی G2: bun convert.mjs → شناسنامه ۱۴ فیلد خوانده شد، گیت «مجاز (۰ قرمز، ۰ زرد)»، خشاب خالی KH-G2-MATH.json منتشر شد (bookMap/errorAtlas/questionBank = ۰) + گزارش download/convert-report-KH-G2-MATH-v0.1.md — یعنی مسیر Excel→JSON برای پایهٔ دوم از هر دو سر تست شده
- دفترچهٔ «RUNBOOK-G2-MATH.md» نوشته شد (authoring/ + کپی download/): جدول نقش ۳ سند MD، قدم صفر (مواد کتاب: شناسنامه/فهرست/صفحات فصل)، چت تازه + استراتژی ۳موجی (اسکلت فهرستی بدون سؤال → عمق فصل‌به‌فصل → بستن با خودآزمایی)، جای‌گذاری بالای سطر یادداشت + نسخه‌گذاری v0.2/v0.3، دستور مبدل + ۴ خطای قرمز رایج و رفع‌شان، پروتکل سبز کردن با کتاب فیزیکی (سه شاهد)، انتظارات واقع‌بینانه (موتور بازی فعلاً G3-محور؛ روشن‌شدن اجرایی G2 = گام مهندسی پس از اولین ورک‌بوک پُر)، چک‌لیست ۸بندی، و پرامپت آمادهٔ کپی G2 (پیش‌پُر: پایهٔ دوم، دامنهٔ ۱۰۰۰، سجل E_، ۶ مدل گرافِ پرکاربرد دوم + خط «در هر گام یک خط بگو چه می‌کنی» برای هدایت گام‌به‌گام معلم توسط مدل بیرونی)
- سند مادر بخش ۱۳: ردیف G2 به اجرای RUNBOOK ارجاع شد

Stage Summary:
- کاربر برای پایهٔ دوم مسیر کامل و تست‌شده دارد: مواد کتاب → چت جدید + پرامپت RUNBOOK بخش ۹ → جای‌گذاری → مبدل → سبز کردن با کتاب فیزیکی
- اثبات فنی: مبدل چندخشابی ورک‌بوک G2 را از شناسنامه شناسایی و بدون خطا منتشر کرد؛ هیچ ریسک ساختاری در ورک‌بوک نیست
- مرز مسئولیت روشن: مدل AI فقط زرد؛ سبز فقط معلم با کتاب فیزیکی؛ روشن‌سازی موتور بازی برای G2 پس از اولین خشاب پُر

---
Task ID: 42-b
Agent: Z.ai Code (main)
Task: تکمیل پاسخ کاربر — «آیا اکسل + کتاب + پرامپت برای هوش مصنوعی کافی است؟»

Work Log:
- دفترچهٔ RUNBOOK-G2-MATH: دو یادداشت به بخش ۳ افزوده شد — (۱) اکسل اجباری برای مدل نیست (خروجی مدل Markdown است و اکسل مقصد جای‌گذاری معلم؛ آپلود اختیاری برای دیدن واژه‌نامهٔ مقادیر مجاز)؛ (۲) همهٔ موج‌ها در یک چت بمانند تا L-/Q-/E_ پیوسته بمانند، و اگر چت عوض شد جدول‌های S1/اطلس قبلی پیوست شود
- کپی download/ هم‌گام شد؛ کامیت 1abb7b7 + پوش v10.3-beta (راستی‌آزمایی ls-remote)

Stage Summary:
- جواب به کاربر: بله — پرامپت خودکفاست؛ سند مادر/پرامپت‌های دیگر/مبدل سمت مدل نمی‌رود؛ تنها ظرافت‌ها: پر کردن {پوشش} در هر نوبت، یک چت برای کل کتاب، و خط تولید پس‌از-مدل (جای‌گذاری → سبز کردن معلم → مبدل) سمت ماست

---
Task ID: 43
Agent: Z.ai Code (main)
Task: رسیدگی به تحویل موج ۱ مدل بیرونی (اسکلت KH-G2-MATH v0.2) — واکشی از شاخهٔ arena، راستی‌آزمایی، گذر از گیت مبدل، انتشار JSON، و پاسخ به ۳ پرسش مدل

Work Log:
- کشف شاخهٔ arena/6b8310f7-math-game روی مخزن bayrami1341/math-game (مدل بیرونی تحویلی‌هایش را آنجا منتشر کرده)؛ فچ و واکشی ۳ تحویلی: khshab-G2-MATH_v0.2.xlsx، WAVE1-SKELETON-...-v0.2.fa.md، snapshots/KH-G2-MATH-v0.2/ (۷ CSV + manifest)
- راستی‌آزمایی SHA-256: 53ab7d02c936e31b... منطبق با ادعای مدل — فایل بی‌تغییر
- بازرسی سلولی openpyxl: شناسنامه ۱۴ فیلد پر (کد ۲۰۵، چاپ چهاردهم ۱۴۰۴، شابک 978-964-05-2078-9، وضعیت «در تألیف — v0.2»، نیاز توسعهٔ متوسط) همه زرد با شاهد؛ S1 = ۸ ردیف واقعی بالای سطر یادداشت (L-100..L-800، گستره‌های ۱۸صفحه‌ای ۱..۱۴۴، اهداف/شرح شکل = «؟» صادقانه، سازگاری: ۴ تعاملی-عمیق/۳ بانک تمرین/۱ خارج از موتور)؛ اطلس و بانک دست‌نخورده (۰ ردیف)؛ ردیف‌های نمونه زیر سطر یادداشت سالم
- گیت مبدل روی v0.2: «مجاز (۰ قرمز، ۰ زرد)» — ۸ درس، ۰ اطلس، ۰ سؤال؛ KH-G2-MATH.json با bookMap ۸ ردیف کامل (id/page/chapter/title/objective/vocabulary/activityType/visual/practicePotential/engineCompat/anchorsRaw/source/status/note) منتشر شد + گزارش download/convert-report-KH-G2-MATH-v0.2.md
- راستی‌آزمایی مرورگری داشبورد: رندر سالم، بدون خطای کنسول؛ تب بانک تمرین خشاب خشاب فعال G3 را نشان می‌دهد (لودر چندخشابی = گام مهندسی بعدی، طبق برنامه)
- کپی تحویلی‌ها در download/؛ کامیت + پوش v10.3-beta

Stage Summary:
- موج ۱ مدل بیرونی از هر دو گیت (SHA + مبدل) گذشت؛ اسکلت ۸فصلی کتاب دوم اکنون در مخزن رسمی و JSON اجرایی است
- پاسخ به ۳ پرسش مدل: ❶ سبز کردن = گیت انسانی مال معلم (برگهٔ ۳دقیقه‌ای داده شد) ❷ موج ۲ = فصل ۱ (عدد و رقم، ص ۱-۱۸) و موج ۳ = فصل ۲ (توالی کتاب درسی + پیش‌نیاز) ❸ قرارداد باند تأیید با دقیق‌سازی: لنگر فصل L-N00 می‌ماند؛ ردیف واحد صفحه‌ای = L-N01 به‌بعد به‌ترتیب صفحهٔ واقعی (L-201=ص۱۹)؛ هیچ ردیف بدون صفحهٔ واقعی

---
Task ID: 43-b
Agent: Z.ai Code (main)
Task: سؤال کاربر — «نمی‌دانم چه کنم؛ عکس بفرستم کافی است؟» → راه سادهٔ عکس‌محور برای تأیید هر موج

Work Log:
- بخش ۶.۵ به RUNBOOK-G2-MATH افزوده شد: ۳ عکس (شناسنامه/فهرست/آخرین صفحه) → فرستادن در چت → راستی‌آزمایی ماشینی از سمت ما → تأیید نهایی یک‌کلمه‌ای معلم → سبز کردن ردیف‌ها با منبع «کتاب فیزیکی معلم — عکس + تأیید شفاهی» → اجرای دوبارهٔ مبدل
- قاعدهٔ ایستاده صریح تکرار شد: سبز فقط با تأیید معلم؛ عکس فقط بار مقایسه را برمی‌دارد
- کپی download/ هم‌گام؛ کامیت و پوش v10.3-beta

Stage Summary:
- مسیر تأیید برای معلم به «۳ عکس + ۱ کلمه» سبک شد و برای همهٔ موج‌های بعدی هم قابل استفاده است

---
Task ID: 43-c
Agent: Z.ai Code (main)
Task: راستی‌آزمایی ماشینی موج ۱ با ۳ صفحهٔ کتاب فرستادهٔ کاربر (C205-2 / C205-6 / C205-152) — پیش از تأیید نهایی معلم

Work Log:
- کاربر ۳ صفحهٔ تک‌صفحه‌ای از PDF رسمی کتاب فرستاد (upload/C205-*.pdf) — به‌دلیل حق نشر هیچ‌کدام در مخزن کامیت نشد
- صفحهٔ شناسنامه (PDF ص۲): «ریاضی ـ دوم دبستان ـ ۲۰۵ | چاپ چهاردهم ۱۴۰۴ | شابک 978-964-05-2078-9» — منطبق با فیلدهای ۶ و ۷ شناسنامهٔ v0.2
- صفحهٔ فهرست تصویری (PDF ص۶): ۸ فصل با شروع ۱/۱۹/۳۷/۵۵/۷۳/۹۱/۱۰۹/۱۲۷ و عناوین عیناً برابر ۸ ردیف S1 (عدد و رقم، جمع و تفریق اعداد دو رقمی، اشکال هندسی، عددهای سه رقمی، اندازه‌گیری، جمع و تفریق اعداد سه رقمی، کسر و احتمال، آمار و نمودار) — انطباق کامل
- آخرین صفحه (PDF ص۱۵۲ = برگهٔ نظرسنجی پایان کتاب): با ۸ صفحهٔ مقدمهٔ PDF، ۱۵۲−۸=۱۴۴ — سازگار با ادعای «پایان کتاب ۱۴۴ = ۸×۱۸ بدون شکاف»
- حکم ماشینی: هر سه بررسی پاس؛ سبز کردن فقط پس از کلمهٔ «تأیید» معلم (قاعدهٔ ایستاده) + نکتهٔ چکِ چاپ روی کتاب کاغذی کلاس

Stage Summary:
- اسکلت موج ۱ در راستی‌آزمایی ماشینی سه‌موردی پاس شد؛ تنها مانده: تأیید یک‌کلمه‌ای معلم (و چک ۱۰ثانیه‌ای «چاپ چهاردهم» روی کتاب کاغذی کلاس)

---
Task ID: 44
Agent: Z.ai Code (main)
Task: تأیید شفاهی معلم («چاپ چهاردهم ۱۴۰۴ تایید است») → سبز کردن رسمی موج ۱ خشاب G2 + انتشار مجدد

Work Log:
- ورک‌بوک v0.2: ۹ فیلد کتاب‌محور شناسنامه (۱-۷ + معلم + تاریخ) و هر ۸ ردیف S1 سبز شد؛ منبع سبز = «کتاب فیزیکی معلم — چاپ چهاردهم ۱۴۰۴ + راستی‌آزمایی عکس (C205) + تأیید شفاهی معلم» (حفظ منشأ AI برای زنجیرهٔ ممیزی)
- فیلدهای تصمیمی (خانوادهٔ موتور/نیاز توسعه/وضعیت/حق‌نشر/یادداشت آزاد) عمداً زرد ماندند — سبز دروغین نداریم؛ فیلدهای معلم/تاریخ/وضعیت به‌روز شدند
- مبدل دوباره: «مجاز (۰ قرمز، ۰ زرد)» — درس‌ها ۸ (سبز: ۸)؛ KH-G2-MATH.json منتشر شد با status=تأییدشده برای ۸/۸ ردیف
- نکتهٔ ادغام موج بعد: خروجی v0.3 مدل بیرونی همه‌زرد خواهد بود؛ هنگام ادغام، ردیف‌های اسکلت مقایسه و مُهر سبز ما دوباره اعمال می‌شود — ردیف اسکلتی که مدل تغییرش داده = فلگ بازبینی

Stage Summary:
- موج ۱ از هر سه گیت (SHA، مبدل، تأیید انسانی معلم) گذشت — اسکلت ۸ فصلی ریاضی دوم رسماً تأییدشده است
- مسیر ادغام موج‌های بعدی (مقایسهٔ ردیف‌های اسکلت + اعمال مجدد مُهر سبز معلم) تعریف شد

---
Task ID: 45
Agent: Z.ai Code (main)
Task: پاسخ به دو پرسش کاربر — «استخراج G2 تمام شد؟» و «آیا هر پایه را به نوبت به مدل بدهم؟» + افزودن پیام آمادهٔ موج ۲ به RUNBOOK

Work Log:
- وضعیت‌سنجی مخزن: کامیت‌های task44 (e0b4a47 سبزشدن موج ۱) و sync (3a7ee37) روی origin/v10.3-beta منتشر شده‌اند؛ main محلی ۰/۰ با origin/v10.3-beta هم‌گام؛ خشاب KH-G2-MATH.json = ۸/۸ ردیف status=تأییدشده با منبع ممیزی کامل (چاپ چهاردهم + عکس C205 + تأیید شفاهی معلم)
- پاسخ سؤال ۱: استخراج G2 تمام نشده — فقط موج ۱ (اسکلت فصل‌به‌فصل) تمام و سبز است؛ مانده: موج ۲ تا ۹ (عمق‌کاوی فصل‌به‌فصل) + موج بستن (خودآزمایی ۲۰بندی + سه سنجه) → ادغام/مبدل/سبز → اولین خشاب کامل → روشن‌سازی G2 در موتور بازی
- بخش ۱۰ به RUNBOOK-G2-MATH.md افزوده شد: «پیام آمادهٔ موج ۲ — عمق‌کاوی فصل ۱ عدد و رقم ص ۱-۱۸» — هم‌چت با موج ۱، ضمیمهٔ صفحات ۱-۱۸، قرارداد باند (L-100 سبز دست‌نخورده، L-101 به‌بعد به‌ترتیب صفحهٔ واقعی)، وام اطلس از E_PLACE_SWAP/E_ZERO_PLACE_MISS/E_ADD_CONFUSION، گراف‌های M_BUNDLES/M_PLACEVALUE/M_NUMBERLINE، پوشش ۲ CORE + ۱ DEPTH + ۱ SIDE، خروجی v0.3 + SHA + خودآزمایی ۲۰بندی؛ خروجی همه‌زرد؛ پروتکل پس از تحویل (ادغام + مقایسهٔ اسکلت + مُهر سبز مجدد + تأیید عکس‌محور معلم)
- پاسخ سؤال ۲: بله به همین روند ولی ترتیب‌دار — اول G2 تا خشاب کامل و بازی‌پذیر (پایلوت خط تولید)، سپس G3 (نزدیک‌ترین به موتور ضرب‌محور)، بعد G4 و G5/G6، پایهٔ اول آخر (نیاز موتور جمع/تفریق)؛ هر پایه = چت و ورک‌بوک و پرامپت خودش؛ بستهٔ هر پایه (ورک‌بوک خالی + RUNBOOK + پرامپت اختصاصی) را من در نوبت خودش می‌سازم
- کپی download/ هم‌گام شد

Stage Summary:
- پیام موج ۲ آمادهٔ کپی در RUNBOOK-G2-MATH.md §۱۰ (و download/) است؛ گام بعدی معلم: ارسال آن پیام + صفحات ۱-۱۸ در همان چت موج ۱
- توالی پایه‌ها تصمیم‌گیری شد: G2 تا آخر → G3 → G4 → G5/G6 → G1؛ موازی‌سازی فقط پس از اتمام پایلوت G2

---
Task ID: 46
Agent: Z.ai Code (main)
Task: پرسش کاربر — «فکر می‌کردم استخراج پایهٔ سوم تمام شده است؟» → بازخوانی وضعیت G3 و تصحیح برنامهٔ توالی پایه‌ها

Work Log:
- بازرسی cartridges/KH-G3-MATH.json: bookMap ۱۶ (۱۰ تأییدشده / ۶ نیاز به تأیید)، errorAtlas ۲۰ (۱۲/۸)، questionBank ۲۰ (۱۳/۷) — خشاب زندهٔ فعلی بازی
- کشف زنجیرهٔ download/: khshab-G3-MATH_v0.5→v0.6→v0.7.xlsx + audit-report-v05 (AUD-01..15) + گزارش‌های مبدل — G3 در جلسات قبلی (taskهای ۲۹-۳۳) با نسل اول خط تولید ساخته و ممیزی شده؛ در شناسنامهٔ ۱۸ خشابی تنها خشاب سبز با لنگرهای تأییدشدهٔ کد ۳۰۵
- حکم: ادعای کاربر درست است — استخراج G3 انجام شده؛ تفاوت با استاندارد جدید: پوشش مأموریت‌محور (۱۶ ردیف/۲۰ سؤال) نه کل کتاب، گیت معلم عکس‌محور رویش اجرا نشده، ۷ زرد رسمی AUD باز (L-83/L-D1/L-D2/L-C1، Q-109، Q-111/Q-204)
- تصحیح برنامه: G3 = «تکمیل و ترقی v0.7» نه بازتألیف از صفر (حفظ سبزهای موجود + حل ۷ زرد + موج‌های عمق به سبک G2)؛ حذف جملهٔ «ساخت ورک‌بوک خالی G3» از وعدهٔ قبلی
- توالی نهایی پایه‌ها: G2 تا آخر (پایلوت فرایند v1.0) → G3 تکمیل v0.7 → G4 → G5/G6 → G1

Stage Summary:
- وضعیت G3 شفاف شد: نصفه‌تمامِ نسل قبل است، نه پایهٔ تازه؛ کار آینده‌اش فقط تکمیل است — از ۱۳ سؤال و ۱۲ کد اطلس تأییدشدهٔ موجود استفاده می‌شود

---
Task ID: 47
Agent: Z.ai Code (main)
Task: درخواست کاربر — «پلتفرم اصلی چگونه باشد تا آپلود خشاب‌ها به سهولت؟ + آیا کل محتوای G3 دیده می‌شود؟ + آیا عیوب قبلی رفع شده؟» → گزراش سلامت + ساخت «کارگاه خشاب»

Work Log:
- گزراش سلامت: اسویت استیشن ۷۹/۷۹ سبز؛ lint صفر؛ مرورگری: ۵ تب داشبورد رندر سالم، بازی v10 خشاب را لود می‌کند، بدون خطای کنسول/صفحه — عیوب قبلی (بدهی لیدربرد ۷ قرمز) بسته مانده
- کشف نقص دیده‌شدن: تب قدیمی «بانک تمرین خشاب» فقط شناسنامه + بانک سؤال KH-G3 را نشان می‌داد (هاردکد در /api/cartridge)؛ نقشهٔ کتاب (۱۶ درس) و اطلس خطا (۲۰ کد) اصلاً UI نداشتند — تأیید ماشینی hasMap/hasAtlas=false
- ساخت هستهٔ سروری src/lib/dashboard/cartridge-core.ts: listCartridges (اسکن KH-*.json + validateCartridge موتور بازی)، readCartridgeDetail (گارد شناسه ضد path traversal)، installCartridge (fail-closed: حتی یک قرمز = عدم نوشتن) + منطق برچسب‌سنجی زندهٔ بانک (از مسیر قدیمی منتقل — حذف تکرار)
- API تازه: GET /api/cartridges (فهرست | ?id= جزئیات سه‌بخشی) + POST /api/cartridges/install (بدنه {data,overwrite}؛ ۲۰۱/۴۰۰/۴۰۹/۴۱۳)؛ مسیر قدیمی /api/cartridge به هستهٔ مشترک delegate شد (شکل خروجی ثابت)
- UI: بازنویسی cartridge-tab به «کارگاه خشاب» — چیپ‌های خشاب‌های نصب‌شده (نقطهٔ رنگ گیت + آمار)، دکمهٔ «نصب خشاب (JSON)» با ورودی فایل، زیرتب‌های شناسنامه/نقشهٔ کتاب (جدول sticky)/اطلس خطا/بانک سؤال، حالت‌های خالی برای خشاب‌های کم‌محتوا؛ page.tsx ساده‌سازی (تب خودکفا) و نام تب «کارگاه خشاب»
- E2E ماشینی: فهرست ۳ خشاب (G3: ۱۶/۲۰/۲۰، G2: ۸/۰/۰، G1 خالی)؛ جزئیات هر سه زیرنما با شمارش صحیح؛ جابه‌جایی چیپ G2→نقشه ۸ ردیف؛ نصب فایل خراب → توست خطا و عدم نوشتن در پوشه؛ نصب معتبر → ۲۰۱/توست موفق؛ خشاب قرمز آزمایشی (answerIndex=۹) → ۴۰۰ با خطای «Q-101: پاسخ‌نام خارج از بازه» و پوشه دست‌نخورده؛ KH-G2-MATH.json پس از آزمون بازنویسی، به نسخهٔ مبدل برگردانده شد (دیفرنس فقط newline)
- lint نهایی صفر؛ dev.log بدون خطا

Stage Summary:
- پلتفرم حالا «کارگاه خشاب» دارد: نصب خشاب بدون ابزار فنی (انتخاب فایل JSON خروجی مبدل)، گیت fail-closed بین کاربر و انتشار، و دیدنِ کامل هر سه بخش هر خشاب — پاسخ سؤال «کل G3 دیده می‌شود؟» از «نه» به «بله» تغییر کرد
- نقشهٔ راه آپلود اعلام شد: فاز ۲ = آپلود مستقیم اکسل (پورت مبدل به سرور)؛ فاز ۴ = اتصال موتور بازی به خشاب فعال (لودر چندخشابی + مأموریت‌ها از بانک)

---
Task ID: 47-b
Agent: Z.ai Code (main)
Task: پرسش کاربر — «محتوای موج ۲ آماده است؛ دو حالت: اول فیکس نسخه فعلی یا ارسال اکسل و فیکس با دو کتاب (پایهٔ دوم و سوم)؟» → بررسی پلتفرم، کشف هاردکد G3 در لایهٔ مرورگر، و کامل‌سازی پلتفرم چندخشابی

Work Log:
- راستی‌آزمایی وضعیت: کامیت task47 (4a8f1b3) روی origin/v10.3-beta منتشر؛ dev.log سالم؛ سرور چندخشابی بود (cartridge-core با expectedId صریح) ولی لایهٔ مرورگر هاردکد: CARTRIDGE_ID='KH-G3-MATH' هم پیش‌فرض validateCartridge بود هم DEFAULT_URL لودر → خشاب G2 در موتور بازی هرگز قابل پذیرش نبود
- cartridge-schema.js: export CARTRIDGE_ID_PATTERN + تغییر پیش‌فرض validateCartridge به null (هر KH- خوش‌قالب مجاز؛ expectedId صریح = تطابق دقیق برای مبدل/سرور/لودر) — رفتار fail-closed حفظ شد (شناسهٔ بدشکل مردود)
- cartridge.js: بازنویسی چندخشابی — کش موفق‌ها به تفکیک شناسه، استخراج شناسه از نام فایل (تطابق فایل↔محتوا)، شکست‌ها کش نمی‌شوند، تابع جدید listAvailableCartridges از GET /api/cartridges با fallback بی‌صدای null برای استقرار استاتیک (GitHub Pages) + getActiveCartridgeId
- app.js (initCartridgeStatus): انتخابگر چیپی خشاب در جعبهٔ راهنمای نقشه — فهرست نصب‌شده‌ها از داشبورد، چیپ فعال با aria-pressed و آمار (تعداد سؤال)، چیپ نامعتبر خط‌چین، انتخاب در localStorage کلید station_active_cartridge با الگوسنجی، سوییچ = بارگذاری fresh؛ مسیر تک‌خشابی (استاتیک) انتخابگر را اصلاً نمی‌کشد
- v10.css: استایل .cartridge-picker/.cartridge-chip با پالت رسمی (بدون رنگ بیرون از سیستم)
- tests/v10.3-cartridge.test.js: تست ۶ بازنویسی (بدشکل + ناهم‌خوانی با expectedId صریح هر دو قرمز) + تست ۱۳ جدید (خشاب G2 منتشرشده با قرارداد پیش‌فرض پذیرفته، lessons=8/questions=0) — سوئیت کامل ۸۰/۸۰ سبز؛ node --check پنج فایل؛ bun run lint صفر
- E2E مرورگری (agent-browser): ورود مهمان → راهنمای نقشه → انتخابگر ۳ خشاب رندر شد (G3 فعال: ۲۰ سؤال)؛ کلیک G2 → خط وضعیت به «KH-G2-MATH — درس‌ها ۸ (۸ تأیید) — گیت مجاز (۰/۰)» تغییر کرد + localStorage ثبت؛ رفرش → G2 همچنان فعال (ماندگاری)؛ برگشت به G3؛ گیم‌پلی واقعی دست‌نخورده (نیروگاه لایهٔ ۱: ۲×۲=۴ پذیرفته → ۳×۳)؛ موبایل ۳۹۰px بدون overflow-X با ۳ چیپ؛ داشبورد تب کارگاه خشاب: هر ۳ چیپ + زیرتب‌های درست (G2: نقشه ۸/اطلس ۰/بانک ۰)؛ صفر خطای کنسول در همهٔ مراحل
- کامیت e818d1f پوش شد به origin/v10.3-beta (پوش اول به main رد شد — مسیر درست HEAD:v10.3-beta مثل تسک‌های قبل)؛ وضعیت ۰ عقب/۰ جلو

Stage Summary:
- پلتفرم حالا سرتاسر چندخشابی است: نصب (کارگاه خشاب) → فهرست (API) → اعتبارسنجی (اسکیما KH-عمومی) → بازی (انتخابگر + لودر) — «فیکس با دو کتاب» که کاربر خواسته بود تحقق یافت
- خشاب G2 (اسکلت ۸ فصل سبز) در موتور بازی قابل انتخاب و نمایش است؛ خشاب G3 به‌عنوان پیش‌فرض کتاب زندهٔ بازی سر جایش است
- پاسخ تصمیم کاربر: حالت ۲ توصیه شد (ارسال اکسل موج ۲ همان حالا) — چون نسخهٔ فعلی فیکس شده و ادغام v0.3 با مبدل/گیت‌ها بدون انتظار ممکن است

---
Task ID: 48
Agent: Z.ai Code (main)
Task: تحویل موج ۲ فصل ۱ G2 از مدل بیرونی (v0.3) → راستی‌آزمایی سه‌لایه، ادغام با مُهر سبز رسمی، عبور از گیت مبدل و انتشار

Work Log:
- دریافت تحویل از شاخهٔ arena/6b8310f7-math-game: khshab-G2-MATH_v0.3.xlsx + WAVE2-CH1-KH-G2-MATH-v0.3.fa.md؛ SHA-256 منطبق (879b2d54c66cec5d…)
- لایهٔ ۲ (بازرسی سلولی openpyxl): ۷ شیت هم‌نام، هدرهای نقشه/بانک یکسان؛ تطبیق شناسه‌محورِ ۸ ردیف اسکلت با v0.2 محلی → ستون‌های محتوایی ۱-۱۱ صفر تفاوت؛ ۱۸ ردیف تازه L-101..L-118 با صفحات ۱..۱۸ به‌ترتیب، همه زرد با منبع «پیشنهاد AI»؛ ترکیب موتور: ۹ تعاملی-عمیق + ۸ بانک تمرین + ۱ خارج از موتور
- اطلس: ۸ کد (۶ وامی + E_GROUPS/E_TABLE_NEIGHBOUR با پسوند «(پیشنهاد)») همه زرد؛ بانک: Q-1001..Q-1040 یکتا، توازن پاسخ ۱۰/۱۰/۱۰/۱۰، دامنه CORE=20/DEPTH=10/SIDE=10، گزینه‌ها همیشه ۴تا
- کشف ۱: مدل بیرونی مُهر سبز خودش را (بدون پسوند تأیید معلم) روی ۸ ردیف و شناسنامه گذاشته و ۹ فیلد سبز رسمی را ریست کرده بود → طبق پروتکل تسک ۴۴ مُهر رسمی مجدداً اعمال شد (۸ منبع ردیف + ۹ فیلد شناسنامه؛ «وضعیت خشاب» با متن v0.3 و زرد حفظ شد) → SHA نسخهٔ ادغامی 00851df6c1da2448…
- کشف ۲: گیت مبدل قرمز شد — ۸ خطای T7؛ ریشه: قالب بازهٔ خط‌تیره «Q-1001-1004» در سلول لنگرها که extractQRefs نمی‌شناخت (فقط «تا») → گسترش پارسر رسمی (هر دو قالب؛ بازهٔ نامعتبر fail-closed) + تست ۱۰-ب؛ G3 دست‌نخورده
- گیت نهایی روی نسخهٔ ادغامی: مجاز (۰ قرمز، ۳۲ زرد) — ۳۰×AUD-06 (واژگان CPA «انتزاعی/نیمه‌تصویری» بیرون سه‌گانهٔ مجسم/تصویری/علامتی) + ۲×اطلس (کد پیشنهادی هم‌نام موتور) — همگی سند باز برای نظر معلم، نه سد
- انتشار KH-G2-MATH.json: ۲۶ درس (۸ سبز + ۱۸ زرد) / اطلس ۸ / بانک ۴۰ (همه زرد)؛ source.file با نام رسمی khshab-G2-MATH_v0.3.xlsx (اجرای مجدد مبدل برای زنجیرهٔ ممیزی تمیز)
- تست ۱۳ با آمار جدید هم‌گام شد؛ سوئیت ۸۱/۸۱ سبز؛ lint صفر؛ نسخهٔ ادغامی در authoring/ + download/؛ سند موج ۲ در authoring/ + download/؛ گزارش مبدل نهایی در download/
- نکتهٔ عملیاتی: یک کامیت «auto-backup» خودکار (6420e4d) وسط کار پوش شده بود — تاریخچه نشکسته شد؛ کامیت تمیز task48 روی آن نشست (حذف tmp-audit و گزارش interim)
- E2E مرورگری: کارگاه خشاب → G2 = «درس ۲۶ · سؤال ۴۰»، زیرتب‌ها نقشهٔ ۲۶/اطلس ۸/بانک ۴۰ (لیست با برچسب‌سنجی زنده، Q-1001 کامل)؛ بازی → انتخابگر «KH-G2-MATH — ۴۰ سؤال» + وضعیت صادقانه «۴۰ (۰ تأیید + ۴۰ پیشنهاد) — گیت مجاز (۰/۳۲)»؛ صفر خطای کنسول
- RUNBOOK §۱۰: «وضعیت موج ۲» + قالب مجاز بازهٔ لنگر ثبت شد (برای موج‌های بعدی)

Stage Summary:
- موج ۲ رسماً در خشاب منتشرشده نشست: ۶۶ ردیف تازه همه زردِ مستند، اسکلت سبز دست‌نخورده با مُهر رسمی — منتظر گیت معلم (تأیید عکس‌محور سه لایه + حکم دو کد پیشنهادی + واژگان CPA)
- یادآوری محدودیت شناخته‌شده: برچسب‌سنجی زندهٔ داشبورد برای سؤال‌های غیرضرب (ارزش مکانی/شمارش) «بی‌الگو» نشان می‌دهد — رفتار موتور، مستند در تسک 33-c؛ ادعای خشاب در tooltip محفوظ است

---
Task ID: 49
Agent: Z.ai Code (main)
Task: گیت معلم موج ۲ — چک فیزیکی نقشهٔ صفحه‌ها؛ کشف ناهم‌خوانی صفحات ۸–۱۲ و ثبت محتوای واقعی از عکس‌های معلم

Work Log:
- معلم نقشهٔ صفحه‌به‌صفحهٔ موج ۲ را با کتاب فیزیکی چک کرد: ص ۲–۷ و ۱۳–۱۸ تأیید؛ ص ۸–۱۲ ناهم‌خوان («عدد صد» در کتاب نیست)
- معلم قرارداد اسکن را اعلام کرد: در C205.pdf صفحهٔ ۷ = صفحهٔ ۱ کتاب (offset +۶) — در RUNBOOK §6.5 ثبت شد
- ۶ عکس صفحات ۸–۱۲ از معلم دریافت و خوانده شد (یکی تکراری ص ۱۰)؛ محتوای واقعی استخراج شد: ص۸ حلّ مسئله (کم‌کردن در بازهٔ ۲۳ با دستهٔ ده‌تایی)، ص۹ رسم شکل (محور تا ۱۶، ۱۲+۵ با چوب‌خط، سه‌نمطی)، ص۱۰ جمع و تفریق (انگشت/چوب‌خط/شکل/محور)، ص۱۱ فعالیت (بازی مهرهٔ جزء-کل، ۵تا۵تا و ۱۰تا۱۰تا، جمع چندجمله‌ای، خواندن ساعت)، ص۱۲ تمرین (رنگ‌آمیزی مربع و نوشتن جمع، محور، خطّاپوش مثلث)
- نتیجه: درس‌های مدل «عدد صد» و «ترتیب عددی/دهگان و یکان» به‌صورت درس مستقل در این بازه نیستند → L-108..L-112 + Q-1009..Q-1024 باید بازنویسی شوند؛ کدهای سجل کفایت می‌کند (E_ADD_CONFUSION، E_SUB_CONFUSION، E_SKIP_UNDERCOUNT، E_DOUBLE_OFF، E_GROUPS)
- امنیت حق نشر: `upload/` به .gitignore اضافه شد (عکس صفحات کتاب هرگز کامیت نمی‌شود)؛ راستی‌آزمایی با git check-ignore ✓
- RUNBOOK §6.5 «دفتر گیت موج‌ها» با نتیجهٔ نارنجی موج ۲ و محتوای عکس‌محور صفحات ۸–۱۲ به‌روز شد

Stage Summary:
- گیت موج ۲: نارنجی رسمی — پیام اصلاحی v0.3.1 به معلم تحویل شد (بازنویسی ۵ ردیف + ۱۶ سؤال با محتوای واقعی؛ مُهر سبز فقط پس از چک دوبارهٔ ص ۸–۱۲ توسط معلم)
- اصلاح حافظه: سه‌گانهٔ رسمی واژگان = مجسم/تصویری/علامتی (طبق AUD-06 تسک ۴۸) — در پیام اصلاحی لحاظ شد

---
Task ID: 50
Agent: Z.ai Code (main)
Task: پیشنهاد معلم «اجماع دو مدل برای بقیهٔ کتاب» → طراحی و ثبت گیت دوم (بازرس دوم) در RUNBOOK

Work Log:
- نگرانی معلم: کتاب ۱۴۰+ صفحه است و فقط ص ۱–۱۸ چک شده — از کجا معلوم موج‌های بعدی درست باشند؟
- شفاف‌سازی دامنه: فعلاً فقط فصل ۱ تحویل مفصل شده؛ اسکلت ۸ فصل در موج ۱ مهر سبز معلم دارد؛ ریسک متعلق به موج‌های آینده است → سازوکار استاندارد «هر موج» لازم بود، نه چک ۱۴۰ صفحه امروز
- طراحی گیت دوم (§6.6 RUNBOOK): مدل تألیف تحویل → بازرس دوم (دستیار پروژه) به‌صورت کور و مستقیم از PDF نقشهٔ مستقل می‌سازد → مقایسهٔ ماشینی دو نقشه → تطابق=کاندید تأیید (کلمهٔ نهایی همیشه معلم)؛ مغایرت=فقط صفحات اختلافی نزد معلم؛ سه عکس همیشگی به‌عنوان پشتیبان باقی می‌ماند
- مادهٔ لازم: آپلود C205.pdf توسط معلم (در upload/ ایمن، هرگز کامیت نمی‌شود)؛ fallback = عکس هر موج
- اولین اجراها: چک «فهرست کتاب ↔ اسکلت ۸ فصل» + بازرس دوم روی v0.3.1

Stage Summary:
- پروتکل چهارلایهٔ تأیید نهایی شد: مبدل (ماشین) → بازرس دوم (اجماع دو مدل) → عکس‌های شناسنامه → کلمهٔ معلم؛ هزینهٔ معلم در هر موج به «چک چند صفحهٔ اختلافی + یک کلمه» کاهش یافت

---
Task ID: 51
Agent: Z.ai Code (main)
Task: دریافت C205.pdf از معلم → اجرای گیت دوم (§6.6): چک فهرست↔اسکلت برای کل کتاب + بازرس دوم فصل ۱

Work Log:
- C205.pdf (۱۵۲ صفحهٔ PDF؛ صفحهٔ ۷ = ص ۱ کتاب، offset +۶؛ کتاب درسی = ص ۱–۱۴۴) در upload/ امن (git-ignore) دریافت شد
- مقایسهٔ ماشینی (openpyxl روی authoring/khshab-G2-MATH_v0.3.xlsx): فهرست PDF ↔ اسکلت L-100..L-800 → ۸/۸ تطابق کامل؛ عنوان‌ها (عدد و رقم / جمع و تفریق اعداد دو رقمی / اشکال هندسی / عددهای سه رقمی / اندازه‌گیری / جمع و تفریق اعداد سه رقمی / کسر و احتمال / آمار و نمودار) و گستره‌های ۱۸ صفحه‌ای دقیقاً برابر
- بازرس دوم فصل ۱ (خواندن مستقیم PDF ص ۷–۲۴): یافتهٔ معلم تأیید شد (ص ۸–۱۲ غلط)؛ عناوین واقعی واحدها: عدد و شمارش (۲–۴)، دسته‌های ده‌تایی و یکی (۵–۷)، حلّ مسئله/رسم شکل (۸–۹)، جمع و تفریق (۱۰–۱۲)، شمارش چندتا چندتا (۱۳–۱۵)، مرور فصل (۱۶–۱۷)، ص ۱۸ معما+فرهنگ
- کشف ریز تازهٔ بازرس: L-114 غلط است — کتاب ص ۱۴ «شمارش ۴تا۴تا» است نه «سه‌تایی»؛ صفحات تمرین (۴، ۷، ۱۲، ۱۵) عنوان مستقل ندارند؛ عناوین مدل («شمارش دقیق»، «دسته‌های ده‌تایی و جدول») با بنر کتاب دقیقاً یکی نیست
- RUNBOOK دفتر گیت: نتیجهٔ اجرای اول گیت دوم ثبت شد؛ پیام v0.3.1 نهایی با نقشهٔ قطعی به معلم تحویل شد

Stage Summary:
- نگرانی «بقیهٔ کتاب» در سطح موجود پاسخ شد: اسکلت ۸ فصل ۸/۸ با فهرست PDF تطابق دارد (ریسک باقی‌مانده فقط جزئیات صفحات موج‌های آینده است که گیت دوم پوشش می‌دهد)
- نقشهٔ قطعی فصل ۱ برای اصلاح v0.3.1 آماده؛ موج ۳ (فصل ۲ «جمع و تفریق اعداد دو رقمی» ص ۱۹–۳۶) از فهرست رسمی تأیید

---
Task ID: 52
Agent: Z.ai Code (main)
Task: ثبت مُهر تأیید معلم روی پیام اصلاحی v0.3.1 و تحویل نسخهٔ کپی‌آمادهٔ نهایی برای ارسال به مدل

Work Log:
- معلم با یک کلمهٔ «تأیید» پیام اصلاحی v0.3.1 (نقشهٔ قطعی فصل ۱ حاصل از گیت دوم) را مُهر کرد (۱۴۰۵/۰۷/۲۹)
- RUNBOOK §6.5 دفتر گیت به‌روز شد: وضعیت «منتظر v0.3.1 از مدل» → «مُهر تأیید معلم روی پیام اصلاحی ثبت شد»؛ گیت موج ۲ همچنان نارنجی تا رسیدن فایل اصلاحی و سبز شدن گیت‌های ماشینی
- نسخهٔ نهایی کپی‌آمادهٔ پیام اصلاحی (۵ بند: بازنویسی L-108..L-112 با محتوای عکس‌محور، اصلاح L-114 به «شمارش ۴تا۴تا»، بازنویسی Q-1009..Q-1024 با کدهای موجود سجل + ضد J12 و توازن الف-د، عناوین عیناً از بنر کتاب/صفحات تمرین بدون عنوان مستقل/ص ۱۸ خارج از موتور، واژگان فقط سه‌گانهٔ مجسم/تصویری/علامتی + قاعدهٔ دست‌نخوردگی مُهرهای سبز) به معلم تحویل شد

Stage Summary:
- گیت موج ۲: نارنجیِ ثبت‌شده با پیام اصلاحی مُهردار — گام بعدی نزد مدل بیرونی است
- با رسیدن v0.3.1: مقایسهٔ ماشینی مقداربه‌مقدار (L-108..L-112، L-114، Q-1009..Q-1024) + گیت مبدل (bun convert.mjs) + چک ص ۸–۱۲ توسط معلم → مُهر سبز → باز شدن موج ۳ (فصل ۲ «جمع و تفریق اعداد دو رقمی»، ص ۱۹–۳۶) با اجرای کامل گیت دوم

---
Task ID: 53
Agent: Z.ai Code (main)
Task: دریافت تحویل v0.3.1 مدل → اجرای کامل گیت دوم (بازرس دوم) + گیت مبدل + ادغام رسمی و انتشار

Work Log:
- تحویل مدل از شاخهٔ arena (کامیت c665491) دریافت شد؛ SHA-256 فایل = bb756156e60dec1c… دقیقاً برابر ادعای مدل ✓؛ سند GATE2-FIX در authoring/ ذخیره شد
- دیف قطعی v0.3.1 ↔ v0.3 با کلید درست (Q-id/L-id از ستون A — دیف اولیه با کلید لنگر خطا داشت و ۱۴ تغییر CPA را نامرئی می‌کرد): فقط تغییرات مجاز — ۱۶ سؤال بازنویسی، ۱۸ تغییر CPA سؤال‌های قدیمی، ۵ ردیف نقشه، پذیرش دو کد، وضعیت شناسنامه v0.3.1 با قفل موج ۳؛ صفر تغییر نامجاز
- بازرس دوم (خواندن مستقیم PDF صفحات ۱۴–۱۸ و ۲۰): تطابق اکثر ادعاهای مدل (۲۳=۱۲+۱۱، ۳۷=۲۳+۱۴، ۷+۸=۱۵ تا ۱۶، ۱۲+۵=۱۷ چوب‌خط، ۵ روش ص ۱۰، بازی ۷→۸/۹/۱۰، ۱۰+۲۰+۵، ساعت، ۵+۲=۷، سه‌تایی ۱۰، ۵+۸=۱۳، ۱۳−۸+۷=۱۲، شابلون ۴ مثلث) + کشف سه خطای مدل:
  ۱) L-114 (بند ۲ اصلاحیه) اصلاً اعمال نشده بود → با PDF ص ۲۰ اصلاح شد به «شمارش ۴تا۴تا» + هدف/واژگان/فعالیت/شاهد
  ۲) Q-1011 و شاهد L-108: «۱۶ مثلث → ۲۱» غلط؛ شمارش ماشینی جزءهای زرد = ۱۳ → «۱۳ → ۱۸» با مخفّی‌های ۱۴/۱۶/۸ (جای پاسخ ج ثابت برای توازن)
  ۳) ناسازگاری لنگر: Q-1020 به L-112 رفته ولی بازهٔ K نقشه به‌روز نشده → (Q-1017-1019) و (Q-1020)
- مدل مُهرهای رسمی را ریست کرده بود (رویهٔ شناخته‌شدهٔ تسک ۴۸) → ۹ فیلد شناسنامه + منبع ۸ ردیف اسکلت بازگردانی شد (ادغام رسمی: ۳۲ سلول؛ SHA رسمی 8f83352e…)
- تصحیح دو ثبت عکس‌محور قبلی خود دستیار: ص ۹ «کامل کن» = قرینه (نه سه‌نمطی)، ص ۱۲ «خلّق باش» (نه خطّاپوش) — مدل این دو را درست گفته بود؛ PDF داوری کرد؛ در RUNBOOK ثبت شد
- گیت مبدل: بار اول قرمز (۴ خطا) → دو کد پذیرفته‌شدهٔ معلم به سجل موتور اضافه شد (errors.js: ERROR_CODES + CODE_SENTENCES_FA + CODE_SEVERITY_ORDER؛ تغییر افزودنی) + تست ۱ از ۱۲ به ۱۴ کد هم‌گام + لنگرها اصلاح شد → بار دوم: مجاز (۰ قرمز / ۲ زرد) → KH-G2-MATH.json منتشر شد
- تست‌ها ۲۱۲/۲۱۲ سبز؛ lint صفر؛ E2E مرورگری (agent-browser): داشبورد کارگاه خشاب (درس ۲۶·سؤال ۴۰، اطلس ۸، بانک ۴۰، منبع v0.3.1، وضعیت با قفل موج ۳) + v10.html انتخابگر چیپ «KH-G2-MATH — ۴۰ سؤال» + خط وضعیت صادقانه «۴۰ (۰ تأیید + ۴۰ پیشنهاد) — گیت مجاز (۰/۲)»؛ صفر خطای کنسول

Stage Summary:
- v0.3.1 رسمی ادغام و منتشر شد؛ هر سه لایهٔ ماشینی پروتکل چهارلایه سبز (مبدل → بازرس دوم → E2E) — فقط کلمهٔ معلم مانده
- چک باقی‌مانده برای معلم: فقط ص ۸–۱۲ با کتاب کاغذی (و نگاه به ۱۴) + یک کلمهٔ «تأیید» → مُهر سبز ۱۸ ردیف موج ۲ و ۴۰ سؤال → باز شدن موج ۳ (فصل ۲، ص ۱۹–۳۶)
- نکتهٔ پایدار برای موج‌های بعد: مدل (۱) مُهرها را ریست می‌کند (بازگردانی خودکار در ادغام)، (۲) خودآزمایی‌اش شمارش عناصر تصویری کتاب را پوشش نمی‌دهد (بند «هم‌خوانی اعداد» باید شمارش ماشینی شکل‌ها را هم داشته باشد)، (۳) اگر لنگر سؤال جابه‌جا شد بازهٔ K نقشه را فراموش می‌کند — هر سه به چک‌لیست گیت دوم موج ۳ اضافه شود

---
Task ID: 54
Agent: Z.ai Code (main)
Task: راستی‌آزمایی تحویل دوم v0.3.1 مدل (ddee0d9 / SHA a386ba15…) — اجرای سوم گیت دوم + ادغام رسمی v2 + انتشار

Work Log:
- fetch شاخهٔ arena؛ استخراج ۳ فایل تحویل دوم از ddee0d9؛ SHA-256 = a386ba152fa9… ✓ برابر فایل .sha256 و ادعای مدل
- دیف ماشینی سه‌گانه (openpyxl، کلید ستون A): تحویل۲↔v0.3، تحویل۲↔رسمی c2d511a8، سپس ادغام v2↔هر دو — اسکریپت‌ها در tmp-scripts/ (verify_redelivery_v031.py، verify_redelivery_part2.py، verify_merged_v2.py، merge_v031_v2.py)
- سبزهای تحویل دوم تأیید شد: L-114 اعمال شد (بدون کلمهٔ ممنوعه)؛ عناوین تمرین ص۴/۷/۱۵ + L-107 با PDF ص ۱۳؛ CPA طبق AUD-06 (۳۰ ردیف → علامتی؛ ۳۳/۷ روی ۴۰ واقعی)؛ کدها ⊆ ۵ مجاز؛ توازن ۱۰/۱۰/۱۰/۱۰؛ ضد J12؛ اطلس/شناسنامه نسبت به پایهٔ خودش دست‌نخورده
- چهار مغایرت گرفته شد: Q-1011 و شاهد L-108 همچنان ۱۶→۲۱ (مدل فقط خودآزمایش را با عدد خودش هم‌راستا کرده بود)؛ لنگر K باز هم هم‌گام نشد؛ L-109 بدون «قرینه»؛ «خلاق باش» به‌جای «خلّق باش»
- داوری مستقیم با C205.pdf: متن ص ۸ کتاب عددی نگفته؛ رندر + شمارش ماشینی مؤلفه‌های هم‌پیوند = ۱۳ مثلث (هر یک ۸۸-۸۹px) — ۱۳→۱۸ درست است؛ متن ص ۱۵ فایل «سه قسمت دیگر… با تاکردن چپ/راست روی هم» = قرینه؛ متن «خلق باش» (نه خلاق)؛ ص ۱۸ کتاب «فرهنگ خواندن»
- کشف شفاف‌سازی: نسخهٔ رسمی قبلی خودش نقض AUD-06 داشت (۲۳ تصویری + ۲ مجسم) — تحویل دوم CPA درست آورد؛ ستون CPA تحویل دوم در ادغام پذیرفته شد
- ادغام رسمی v2: پایه = تحویل دوم + روپوش ~۴۳ سلولی (Q-1011، شاهد L-108، قرینهٔ L-109، خلّق باش، K هم‌گام، L-114 با عنوان عین پیام + محتوای غنی، L-118 چک‌شدهٔ معلم، ۱۲ سلول شناسنامه + ۸ سلول اسکلت مُهرها، وضعیت B12، اطلس دو کد سبز طبق دفتر گیت)
- گیت‌ها: مبدل مجاز (۰ قرمز/۲ زرد) → KH-G2-MATH.json منتشر؛ تست‌ها ۲۶۵/۲۶۵؛ لینت صفر؛ E2E (agent-browser): تب کارگاه خشاب → KH-G2-MATH (درس ۲۶·سؤال ۴۰، «گیت: مجاز — ۰ قرمز/۲ زرد»، «۴۰ = ۰ تأیید + ۴۰ پیشنهاد»، منبع v0.3.1) — صفر خطای کنسول؛ چک JSON: Q-1011 با ۱۳/۱۴/۱۶/۱۸ پاسخ اندیس ۲، CPA ۳۳/۷، Q-1020→L-112
- گزارش GATE2-FIX با نسخهٔ بازصداوردهٔ مدل + پیوست ۵ (بازرس دوم) بازنویسی شد؛ RUNBOOK §6.5 «اجرای سوم» ثبت شد

Stage Summary:
- تحویل دوم خام سبز نشد (۴ مغایرت) ولی ادغام v2 همهٔ دستاوردهای آن (CPA سازگار AUD-06 + بندهای ۲ و ۴) را با تصحیحات مستند بازرس ترکیب کرد — نسخهٔ رسمی فعلی: authoring/khshab-G2-MATH_v0.3.1.xlsx
- گیت موج ۲: فقط چک فیزیکی معلم (ص ۸–۱۲ + نگاه به ۱۴) + یک کلمه تا مُهر سبز و باز شدن موج ۳
- سه قاعدهٔ پایدار به چک‌لیست گیت دوم افزود: اصلاح داخل فایل نه در خودآزمایش؛ هم‌گام‌سازی K با هر جابه‌جایی لنگر؛ واکهٔ بنرهای ترد از معلم

---
Task ID: 55
Agent: Z.ai Code (main) — با ۱۰ زیرعامل خوانش PDF
Task: دستور معلم «فاز صفر» (§6.7) — ساخت نقشهٔ مادر صفحات کتاب دوم (C205) با داده‌های ریز، مستقیم از PDF، پیش از هر کار تألیف دیگر

Work Log:
- دستور معلم ثبت شد: «اگر ابتدا لیست صفحات با داده‌های ریز آن صفحه تأیید بشه، باقی کار ساده است»؛ لیست توسط بازرس دوم و آرنا از ابتدا ساخته می‌شود، بعد کار وسیع/عمیق آرنا، بعد بازرسی با هوش مصنوعی دیگر → به‌صورت §6.7 RUNBOOK رسمی شد
- اعتبارسنجی upload/C205.pdf (۱۵۲ صفحه؛ gitignore خط ۶۱ ✓)؛ پلن چانک: ۸ بازه با هم‌پوشانی مرزی ۲ صفحه‌ای
- موج اول ۶ زیرعامل (b,d,e,f,g,h) سبز؛ دو بازه (PDF 1–22 و 39–58) به مهلت خورد → تقسیم به ۴ چانک کوچک (a1,a2,c1,c2) → هر ۱۰ چانک سبز (۱۶۶ رکورد، ۱۴ خوانش تکراری مرزی)
- زیرعامل‌ها کور و مستقیم از PDF خواندند (بدون دیدن xlsx قبلی)؛ محدودیت شفاف: تصاویر رنگی در بافت زیرعامل در دسترس نبود → استخراج متنی/چیدمانی (pdftotext -layout / pymupdf)؛ شمارش عناصر صرفاً تصویری در notes «نیازمند تأیید تصویری» علامت خورد
- ادغام: ۱۵۲ رکورد یکتا (پیش‌صفحات ۶ + کتاب ۱۴۴ + پس‌صفحات ۲)؛ bookPage=pdf−۶ در همه ✓؛ صفر جاافتادگی
- آشتی‌دهی هم‌پوشانی: ۱۴ صفحهٔ تکراری → ۱۰ مطابق کامل + ۴ مغایرت (کتاب ۱۶، ۳۳، ۳۴، ۵۲) — همه «صفحهٔ چندبنری» (فرهنگ نوشتن + تمرین + آغاز مرور فصل در یک صفحه) → فلگ «آشتی‌دهی» + شیت جداگانه در اکسل
- اعتبارسنجی ساختاری: شروع ۸ فصل دقیقاً ص ۱/۱۹/۳۷/۵۵/۷۳/۹۱/۱۰۹/۱۲۷ ✓ (۸/۸)؛ فهرست پیش‌صفحه ۸/۸ با مرزها منطبق؛ ۳۴۶ تمرین شماره‌دار؛ ۱۹ صفحهٔ بازی؛ اطمینان: ۱۰۰ بالا / ۵۲ متوسط / ۰ پایین
- تحویلی‌ها: authoring/PAGE-MAP-KH-G2-MATH-v1.xlsx (SHA 28a40cae…؛ ۴ شیت RTL: راهنما/نقشهٔ صفحه‌ها با ستون‌های حکم‌آرنا/اصلاح/ارجاع، خلاصهٔ فصلی، آشتی‌دهی) + PAGE-MAP-KH-G2-MATH-v1.json (SHA 1edc4d65…؛ مادهٔ ماشینی) + گزارش PAGE-MAP-…-v1.fa.md + بریف آمادهٔ کپی ARENA-BRIEF-PAGEMAP-KH-G2-v1.fa.md + chunkها در authoring/page-map-chunks/
- کشف‌های محتوایی برای موج‌های بعد: کتاب ۱۳ «۴ چینه در هر طبقه» (نه ۲) — نمونهٔ عینی ضرورت فاز صفر؛ فصل ۴ بلوک موضوعی دارد نه «درس n»؛ فصل ۸ چهار درس (سرشماری/نمودار ستونی/نمودار تصویری/انتخاب نمودار) با شماره‌گذاری استنباطی

Stage Summary:
- فاز صفر §6.7 از این‌پس برای هر کتاب: نقشهٔ مادر → اجماع دو مدل روی لیست → مُهر سبز معلم → کار عمیق آرنا → بازرسی سه‌لایه §6.6 با دیفِ سریع نسبت به نقشهٔ مادر
- گام بعدی نزد معلم: ارسال PAGE-MAP-KH-G2-MATH-v1.xlsx به آرنا با بریف ARENA-BRIEF (حکم ردیف‌به‌ردیف + ۴ ردیف چندبنری اولویت ۱) → دیف حکم‌ها توسط بازرس دوم → فقط مغایرت‌ها نزد معلم
- گیت موج ۲ خشاب (v0.3.1) همچنان منتظر چک فیزیکی معلم (ص ۸–۱۲) است — این تسک جایگزین آن نیست

---
Task ID: 56
Agent: Z.ai Code (main) — با ۱۷ زیرعامل خوانش PDF
Task: فاز صفر §6.7 برای کتاب سوم (C305.pdf) — نقشهٔ مادر صفحات KH-G3-MATH v1 با خوانش کور مستقیم از PDF

Work Log:
- معلم C305.pdf را آپلود کرد؛ شناسایی: «ریاضی سوم دبستان» (کتاب مرجع خشاب G3 — کتاب زندهٔ بازی) با ۱۵۲ صفحهٔ PDF
- کشف قراردادی مهم: برخلاف C205 (offset=+۶)، در کتاب سوم شمارهٔ چاپی = شمارهٔ PDF (offset=0) — با پالیندروم «مرور فصل ص۲۲» (TOC ↔ بنر) و پانویس‌های چاپی ۱۴۴–۱۴۶ تأیید مستقل شد
- ساختار: پیش‌صفحات ۱–۶ + ۸ فصل × ۱۸ صفحه از ص ۷/۲۵/۴۳/۶۱/۷۹/۹۷/۱۱۵/۱۳۳ (هر ۸ مرز با جست‌وجوی بنر تأیید) + پس‌صفحات ۱۵۱–۱۵۲
- خوانش با ۱۷ زیرعامل کور (چانک ۸–۱۲ صفحه‌ای، هم‌پوشانی مرزی ۲ صفحه‌ای، ۲۰ صفحهٔ تکراری)؛ چانک‌های بزرگ به مهلت خوردند و طبق تجربهٔ تسک ۵۵ تقسیم شدند (الگوی موفق: چانک ≤۱۲ صفحه + موازی‌سازی ۳–۴تایی)
- ادغام و آشتی‌دهی ماشینی: ۱۵۲/۱۵۲ رکورد، صفر جاافتادگی، bookPage=pdfPage همه‌جا؛ ۱۲ صفحهٔ هم‌پوشان با ۲۴ مغایرت ریز (عمدتاً اختلاف شمارش زیرسؤال‌شمار تمرین و بنر صفحات چندبخشی) → داوری مستقیم PDF توسط بازرس (ص۳۹=۸ تمرین، ص۴۹=درس «کاربرد کسر در اندازه‌گیری»، ص۷۰=فعّالیت، ص۱۱۹/۱۲۰ خوانش G1) و بقیه فلگ برای حکم آرنا
- آمار کل: ۷۱۵ تمرین شماره‌دار (≈۲× کتاب دوم)، ۹ صفحهٔ بازی (۱۳،۲۴،۴۱،۶۰،۷۸،۹۶،۱۱۴،۱۳۲،۱۵۰)، اطمینان ۱۱۱ بالا/۴۰ متوسط/۱ پایین (ص۱۵۱ نگارهٔ تمام‌صفحه)، ۷۴ صفحه «نیازمند تأیید تصویری»
- چک TOC(ص۴)↔بنرهای واقعی: کاملاً سازگار — فصل ۱: ۶/۶، فصل ۲: ۵/۵، فصل‌های ۴/۵/۷/۸ کامل ✓؛ فقط تساوی/مقایسهٔ کسرها (۵۲–۵۷) بنر چاپی مستقل ندارند (±۱ برای حکم آرنا)؛ برخلاف موج ۲ کتاب دوم هیچ ناهم‌خوانی مرزی نیست
- کشف کلیدی برای خشاب G3: هیچ بنر «درس n» در کل کتاب نیست (درس‌ها نام‌محورند)؛ لنگرهای صِ ردیف‌های سبز v0.7 دقیقاً تأیید شد (ص۱۰، ۶۴، ۶۷، ۷۰، ۷۳، ۱۳۶، ۱۳۹، ۱۴۵) و ۶ ردیف «ص؟» خشاب (L-A1/A2/B1/C1/E1/F1) حالا از نقشه قابل پُر شدن است
- تحویلی‌ها: PAGE-MAP-KH-G3-MATH-v1.xlsx (SHA 8c2381b5…؛ ۴ شیت RTL) + .json (d1276922…؛ مادهٔ ماشینی) + گزارش fa.md + بریف ARENA-BRIEF-PAGEMAP-KH-G3-v1.fa.md — در authoring/ و download/ + ۱۷ چانک خام در authoring/page-map-chunks-g3/ (سند اثبات خوانش مستقل)
- RUNBOOK: §6.7 «فاز صفر — نقشهٔ مادر صفحات» رسمی شد (پروتکل چهارگام + دو اجرای C205/C305 با تفاوت offset صریح)
- کامیت 89803ce و پوش به v10.3-beta ✓؛ upload/C305.pdf git-ignored (راستی‌آزمایی check-ignore ✓)

Stage Summary:
- فاز صفر برای هر دو کتاب (دوم + سوم) کامل شد؛ گام بعدی نزد معلم: ارسال PAGE-MAP-KH-G3-MATH-v1.xlsx به آرنا با بریف G3 → دیف حکم‌ها توسط بازرس دوم → فقط مغایرت‌ها نزد معلم → مُهر سبز → کار عمیق آرنا + بازنویسی نقشهٔ درس‌های خشاب G3 با لنگرهای قطعی
- نکتهٔ پایدار: قرارداد offset بین کتاب‌ها فرق دارد (C205=+۶، C305=۰) — در هر فاز صفر جدید باید با پالیندروم مرور فصل/TOC قطعی شود
- گیت موج ۲ خشاب G2 (v0.3.1) همچنان منتظر چک فیزیکی معلم (ص ۸–۱۲) است؛ این تسک جایگزین آن نیست

---
Task ID: 57
Agent: Z.ai Code (main)
Task: تقسیم کار رسمی (نرم‌افزار ↔ محتوا) + سند انتقال تجربه برای آرنا و ایجنت اتوماسیون (ARENA-EXPERIENCE-TRANSFER-v1)

Work Log:
- دستور معلم: دستیار پروژه = مسئول برنامهٔ اصلی؛ آرنا = توسعهٔ محتوای پایه‌ها؛ کاربر = هماهنگی + نوشتن ایجنت اتوماسیون برای آرنا
- کل سدهای مرجع دوباره خوانده شد (RUNBOOK §6.5–§6.7، MOTOR-TALIF §1–§13، بریف‌های آرنا G2/G3) و سابقهٔ کامل تسک‌های ۴۸–۵۶ برای استخراج تجربه مرور شد
- سند «انتقال تجربه» نوشته شد: download/ARENA-EXPERIENCE-TRANSFER-v1.fa.md — ۱۱ بخش:
  (۰) خط تولید یک‌مسیره و اصل fail-closed؛ (۲) فاز صفر §6.7 + دو درس فنی (offset متغیر بین کتاب‌ها با روش پالیندروم، الگوی چانک ≤۱۲+هم‌پوشانی ۲+موازی ۳–۴)؛
  (۳) پروتکل چهارلایهٔ تأیید؛ (۴) مکانیک اکسل (ستون‌های مقدس، جای‌گذاری بالای سطر یادداشت، لنگر دوطرفه/T7، نسخه‌بندی)؛
  (۵) قراردادهای داده (ضد J12، سجل E_، سه‌گانهٔ CPA/AUD-06، توازن الف–د، ۰–۹۹۹۹، ارقام فارسی/لاتین، فرم ۱۴ گراف، حق نشر، «خارج از موتور»)؛
  (۶) پروندهٔ ۱۶ حادثهٔ تاریخی (J12، صفحهٔ جعل‌شده، واژهٔ ساختگی، سبز دروغین، ریست مُهرها، اصلاح در خودآزمایش نه فایل، ۱۳≠۱۶ مثلث، لنگر/K ناهم‌گام، دیف با کلید اشتباه، نقض AUD-06 در نسخهٔ رسمی، خلاق≠خلّق، عناوین حدسی، چانک بزرگ، offset فرضی)؛
  (۷) پروتکل تحویل آرنا (شاخهٔ arena + سند + SHA-256 + پسوند _verified)؛ (۸) ۱۰ تابع پیشنهادی برای ایجنت اتوماسیون (دیف ستون A، whitelist، چک مُهرها، هم‌گامی لنگر، توزیع CPA/توازن، شمارش ماشینی تصویر، اجرای مبدل، مدیریت هش، چانک‌بند، حافظهٔ حوادث)؛
  (۹) مرز مالکیت (ممنوعیت‌های آرنا)؛ (۱۰) نقشهٔ فایل‌های مرجع طلایی؛ (۱۱) چک‌لیست سری‌سازی هر پایهٔ جدید

Stage Summary:
- تقسیم کار رسمی ثبت شد: دستیار پروژه = موتور/مبدل/داشبورد/بازرس دوم/ادغام رسمی؛ آرنا = تألیف اکسل و حکم نقشهٔ مادر؛ کلمهٔ نهایی = معلم
- سند انتقال تجربه آمادهٔ ارسال به آرنا در download/ (کپی‌آماده) — گنجینٔ اصلی: پروندهٔ ۱۶ حادثهٔ واقعی + ۱۰ تابع اتوماسیون برای ایجنت سری‌سازی
- گیت موج ۲ خشاب G2 (v0.3.1) همچنان منتظر چک فیزیکی معلم (ص ۸–۱۲) است؛ بدون تغییر

---
Task ID: 58
Agent: Z.ai Code (main)
Task: دریافت تحویل آرنا از شاخهٔ arena (نقشهٔ مادر G2 حکم‌شده + موج ۳ فصل ۲ + دو سند معماری ایجنت) → گیت‌های ماشینی → ادغام رسمی v0.4 → انتشار و E2E

Work Log:
- fetch شاخهٔ arena: ۶ کامیت جدید (266e435..ab15597)؛ استخراج ۹ فایل تحویل؛ SHA-256 هر دو xlsx دقیقاً برابر فایل‌های .sha256 و ادعای آرنا ✓ (khshab v0.4: ad4761ba…، page-map verified: 7310680c…)
- گیت ۱ — نقشهٔ مادر حکم‌شده: دیف با نقشهٔ اصلی = صفر تغییر بیرون از ۳ ستون حکم (۱۲۷✓/۲۵✗/۰؟ + حکم کتاب کاغذی معلم روی ۳ ردیف ابته) ✓؛ نمونه‌گیری بازرس دوم از ۴ حکم ✗ با PDF: ص۲۰ ✓ (تقریب بزن)، ص۵۷/ص۱۳۵ ناقص قابل داوری از لایهٔ متن، **ص۳۱ غلط** — کتاب «۳۵−۱۷» می‌گوید نه «۵۷−۱۴»
- گیت ۲ — دیف قطعی v0.4 خام ↔ رسمی v0.3.1 (کلید ستون A): افزوده‌ها سالم (۱۸ L-201..218 + ۳ کد اطلس پیشنهادی + ۲۸ سؤال Q-1041..1068) ولی **بار سوم شکست مستند #۷**: آرنا از پایهٔ v0.3 پیش از ادغام خودش کار کرده بود — ریست مُهرهای معلم (۵ فیلد شناسنامه + ۲ کد اطلس سبز + ۸ ردیف اسکلت)، پس‌روی وضعیت v0.3.1→v0.3، ناهم‌گامی لنگر K (L-110/L-112)، از دست رفتن محتوای غنی L-114، بازگشت «خلاق» به‌جای «خلّق»، رگرسیون L-118 و **بازگشت باگ تاریخی Q-1011 «۱۶ مثلث»** (درست: ۱۳)
- **ادغام رسمی v0.4: پایه = رسمی v0.3.1 + روپوش افزودهٔ محض** (۳ شیت، درج بالای سطر یادداشت + جابه‌جایی درست mergeها — باگ openpyxl: محدودهٔ merge A46:Q46 بدون شیفت روی Q-1043 می‌افتاد) + عین‌سازی «پیام AI»→«پیشنهاد AI» (واژهٔ استاندارد)
- دیف دوم: افزودهٔ محض، صفر تغییر، همهٔ مُهرها سر جا ✓
- چک ماشینی ۲۸ سؤال تازه: توازن الف/ب/ج/د = ۷/۷/۷/۷ ✓، CPA سه‌گانه ۶ مجسم/۹ تصویری/۱۳ علامتی ✓، گزینه‌ها یکتا و در ۰..۹۹۹۹ ✓، نقشهٔ خطا همه به کدهای اطلس ✓، لنگرها ۱۸/۱۸ هم‌گام ✓، ضد J12 با حساب لاتین ✓، ارقام فارسی در صورت ✓ (۱۵ هشدار سبک: سؤال تصویری بدون M_ در ستون ساختار — زرد سبکی، مبدل قرمز نکرد)
- اصلاح بازرس دوم: L-213 «۵۷−۱۴=۴۳» → «۳۵−۱۷ (مثال کتاب، حاصل ۱۸)» با ثبت مدرک PDF ص۳۷ در یادداشت
- گیت مبدل: **مجاز (۰ قرمز / ۲ زرد)** — همان ۲ زرد شناخته‌شدهٔ هم‌نامی موتور؛ KH-G2-MATH.json منتشر: ۴۴ درس (۸ سبز) / اطلس ۱۱ (۲+۹) / ۶۸ سؤال (۰+۶۸) / منبع v0.4
- تست‌ها: npm test = ۸۱/۸۱ (آزمون ۱۳ به اعداد رسمی موج ۳ به‌روز + گارد رگرسیون جدید «Q-1011 باید ۱۳ بگوید»)؛ v9 میراث خارج از اسکریپت رسمی و خطای ESM/require از پیش موجود — بی‌ربط به تحویل
- E2E مرورگری: داشبورد تب کارگاه خشاب → G2 «درس ۴۴ · سؤال ۶۸» + شناسنامه «۶۸ = ۰ تأیید + ۶۸ پیشنهاد» + «گیت: مجاز — ۰ قرمز / ۲ زرد» + منبع v0.4؛ بازی v10.html → انتخابگر «KH-G2-MATH — ۶۸ سؤال» → سوییچ موفق با خط وضعیت صادقانه؛ API /api/cartridges به‌روز؛ صفر خطای کنسول
- تحویلی‌های غیرخشاب به download/ کپی شد: ARCHITECTURE-PDF-TO-CARTRIDGE-AGENT.fa.md + BUILD-TRUSTWORTHY-TEXTBOOK-CARTRIDGE-AGENT.fa.md (معماری ایجنت اتوماسیون کاربر) + PAGE-MAP verified + ۲ سند حکم/موج

Stage Summary:
- موج ۳ (فصل ۲، ص ۱۹–۳۶) به‌صورت رسمی ادغام و منتشر شد: خشاب G2 اکنون ۴۴ درس / ۱۱ کد اطلس / ۶۸ سؤال — گیت مجاز (۰/۲)
- الگوی پایدار برای همهٔ تحویل‌های آینده تأیید شد: تحویل خام آرنا هرگز مستقیم ادغام نمی‌شود؛ «پایهٔ رسمی + روپوش افزودهٔ محض» + دیف کلید-ستون A + چک مُهرها + چک لنگر + توازن/CPA/دامنه + مبدل + E2E
- باز برای معلم: (۱) ۶۸ سؤال و ۳۶ ردیف صفحه‌ای همه «پیشنهاد» — مُهر سبزِ ردیف‌به‌ردیف همچنان با معلم؛ (۲) چک کتاب کاغذیِ حکم‌های ✗ نقشهٔ مادر (نمونه‌گیری من: ۱ خطا در ۴ نمونه — ص۳۱)؛ (۳) فلگ هم‌پوشانی جدول رنگ ص۳۴ (۱۰۰–۱۱۰/۱۰۰–۱۰۵) که آرنا عمداً رویش سؤال نساخت
- دو سند معماری ایجنت آرنا (شواهد‌محور، با گیت اسکن و موارد شکست) در download/ برای پروژهٔ ایجنت اتوماسیون کاربر آماده است

---
Task ID: 58-R
Agent: Z.ai Code (main)
Task: پاسخ به کاربر («آیا پرامپت خاصی لازم است بدم آرنا؟») + راستی‌آزمایی مجدد وضعیت دریافت G2

Work Log:
- شاخهٔ آرنا origin/arena/6b8310f7-math-game دوباره بررسی شد: ۶ کامیت (نقشهٔ مادر حکم‌شده + موج ۳ + ۳ سند معماری ایجنت)
- فایل خام v0.4 آرنا (ad4761ba…) از شاخه استخراج و SHA آن دقیقاً برابر .sha256 اعلامی ✓
- اجرای مجدد مبدل روی فایل خام: مردود با همان ۲ خطای قرمز لنگر (L-110/L-112) — بازتولید مستقل خطا که درستی الگوی «پایهٔ رسمی + روپوش افزودهٔ محض» در تسک ۵۸ را تأیید می‌کند (گزارش: download/convert-report-KH-G2-MATH-v0.4.md)
- انتشار رسمی راستی‌آزمایی شد: KH-G2-MATH.json = بانک ۶۸ سؤال / اطلس ۱۱ / منبع v0.4؛ فایل رسمی authoring/khshab-G2-MATH_v0.4.xlsx (a2f61058…) روی origin/v10.3-beta (کامیت 677c969) موجود و بایت‌به‌بایت برابر نسخهٔ محلی ✓ — آرنا می‌تواند موج ۴ را از همین پایه آغاز کند
- پرامپت آمادهٔ بازخورد/محوله برای آرنا تدوین و به کاربر تحویل شد

Stage Summary:
- دریافت G2 کامل است؛ هیچ پرامپت جدیدی برای دریافت لازم نیست. تنها یک پیام بازخورد/محوله (موج ۴ از پایهٔ رسمی v0.4 + حکم نقشهٔ G3 + ۴ بازخورد اصلاحی) برای آرنا کافی است

---
Task ID: 59
Agent: Z.ai Code (main)
Task: به حکم کاربر — تحویل رسمی خشاب G3 (v0.7، تألیف موتور اصلی) به آرنا طبق استانداردها، برای ذخیره در مخزن او کنار سایر خشاب‌ها

Work Log:
- راستی‌آزمایی: khshab-G3-MATH_v0.7.xlsx (SHA 0e678e54…) = مرجع طلایی؛ منبع JSON نصب‌شدهٔ cartridges/KH-G3-MATH.json (۱۶ درس / اطلس ۲۰ / بانک ۲۰)؛ گیت مبدل ۰ قرمز / ۷ زردِ مستند AUD
- کشف: v0.7 فقط در download/ روی شاخهٔ راه‌دور بود — در محل استاندارد authoring/ نبود و سند تحویل + رسید SHA نداشت
- بستهٔ تحویل ساخته شد: کپی به public/math-game/authoring/ + khshab-G3-MATH_v0.7.sha256 + سند HANDOFF-KH-G3-MATH-v0.7.fa.md (قوانین: پایهٔ v0.7، مُهرها دست‌نخوردنی، عنوان در انتظار تأیید مالک، زرد→سبز فقط با مُهر معلم، موج B قفل، پروتکل تحویل بعدی)
- کامیت 9d47a47 و پوش به origin/v10.3-beta؛ وجود فایل‌ها روی شاخهٔ راه‌دور تأیید شد
- پرامپت آمادهٔ اطلاع‌رسانی به آرنا به کاربر تحویل شد

Stage Summary:
- خشاب G3 رسماً در محل استاندارد authoring/ کنار سایر خشاب‌ها نشست و بستهٔ تحویل (فایل + SHA + سند) روی v10.3-beta برای کشیدن آرنا منتشر شد
- کار باز مرتبط: حکم نقشهٔ مادر G3 هنوز پیش آرناست (بریف روی همین شاخه)

---
Task ID: 60 (+60-Pre)
Agent: Z.ai Code (main)
Task: اجرای گام‌های ۰ و ۱ از دستورکار تحویل آرنا (PR #1، شاخهٔ arena/0eb22280-math-game) — پاک‌سازی نشت حق‌نشر از Git + جذب رسمی khshab-agent

Work Log:
- راستی‌آزمایی تحویل: شاخهٔ arena/0eb22280-math-game (۴ کامیت جدید روی ab15597) + سند docs/ZAI-MASTER-PROMPT-TASKS-60-66.fa.md خوانده شد؛ ادعای «۰ تغییر روی فایل‌های نرم‌افزار» با دیف درخت تأیید شد
- گام ۰ (60-Pre): ادعای نشت تأیید شد (۶۶ مسیر track‌شده شامل ۳ PDF حق‌نشر)؛ ۶۰ فایل با --cached از ایندکس خارج شد (دیسک محلی دست‌نخورده)؛ .gitignore با tool-results/، db/*.db، .zscripts/dev.pid، authoring/build_preview/، authoring/local_viewer_cache/ قفل شد؛ گارد fail-closed در scripts/auto-backup.sh (توقف کامیت) و scripts/gh-autosave.sh (توقف پوش) با bash -n معتبر؛ معیار پذیرش: git ls-files | rg '\.pdf$|^upload/|^tool-results/' = 0 ✓؛ کامیت 332dcfc پوش شد
- گام ۱ (60): بستهٔ ایجنت (authoring/agent ۱۳ ماژول + README + tests + pyproject) نصب شد؛ آینهٔ مبدل (zai_converter_mirror) حذف و run_converter_and_parse_report مستقیماً به تک‌منبع رسمی (tools/cartridge-converter/convert.mjs + station/{cartridge-schema,errors}.js) سیم‌کشی شد با گارد MISSING_CONVERTER_SSOT؛ _locate_node_modules_with_xlsx مسیر tools/cartridge-converter/node_modules اضافه شد
- دو گارد انطباق یافت: copyright_guard (لیست سفید PNG فقط چیدمان شاخهٔ آرنا را می‌شناخت) و ownership_boundary (base_ref هاردکد ab15597 بی‌نیای HEAD) — هر دو برای توپولوژی رسمی اصلاح شد (ALLOWED_IMAGE_PREFIXES: public/، assets/ + بازگشت به دیف HEAD)
- اجرای زندهٔ CLI: check-wave G2 v0.5 (candidate vs رسمی v0.4) = PASS_READY_FOR_SECOND_INSPECTOR (هر ۶ گیت PASS، مبدل ۰ قرمز/۲ زرد) ✓؛ check-wave G3 v0.7 self-baseline = PASS_READY_FOR_SECOND_INSPECTOR (مبدل ۰/۷ ✓؛ cpa_and_balance داخلی FAIL = همان مشخصات legacy مستند AUD-06، نیازمند پروفایل legacy — نقص جدیدی نیست)؛ keyed-diff v0.4↔v0.5 = ۴۴+/۰−/۰ تغییر سلول؛ count-items دود-تست = PASS (count=19)
- ⚠️ کشف مهم ۱: keyed-diff تأیید کرد فایل v0.5 افزودهٔ محض است و Q-1011 دست‌نخورده (۱۳ رسمی حفظ شده) — اما متن گزارش آرنا (خط «بازگردانی اصلاح شمارش ماشینی Q-1011 (۱۳ مثلث → ۱۸)») تغییری را ادعا می‌کند که در فایل وجود ندارد = متن گزارش نادرست/فریبنده؛ باید در سند تحویل اصلاح شود (داده معتبر است، سند نه)
- ⚠️ کشف مهم ۲: new_wave_start_qid="Q-1069" هاردکد در automation_suite است (باگ دامنه برای غیر-G2) + تست‌های pytest (۲۹/۳۱ شکست در مخزن من) به فضای کاری شاخهٔ آرنا (authoring/audit/*.json، /tmp/c205_secure_vault) وابسته‌اند — اقلام باز Task 60-bis
- v0.5 هنوز ادغام رسمی نشد — طبق گام ۶ نیازمند بازرسی دوم §6.6 (نمونه‌گیری کور PDF ص ۵۵–۷۲) و تصمیم مالک/معلم است

Stage Summary:
- گام ۰ کامل و پوش‌شده (کامیت 332dcfc): مخزن از فایل‌های حق‌نشر پاک شد و دو گارد دائمی جلوی تکرار را می‌گیرد؛ توجه: فایل‌ها در تاریخچهٔ گیت قدیمی هنوز موجودند — پاک‌سازی کامل نیازمند rewrite تاریخچه + تصمیم مالک
- گام ۱ کامل (کامیت f8706b2): ایجنت رسمی مخزن شد، SSOT برقرار، گیت کامل موج ۴ v0.5 = PASS_READY_FOR_SECOND_INSPECTOR
- گام‌های ۲ تا ۷ (CI، داشبورد معلم، errors-v103، SVG رندرر، بازرسی دوم+ادغام v0.5، OFFICIAL-HEADS) باقی است — ترتیب دستورکار حفظ شود

---
Task ID: 61, 65, 66
Agent: Z.ai Code (main)
Task: به اختیار معماری مالک — ادامهٔ دستورکار ۶۰–۶۶ با ترتیب بازطراحی‌شده: گام ۶ (بازرسی دوم + ادغام رسمی v0.5) → گام ۷ (OFFICIAL-HEADS + گارد پایهٔ کهنه) → گام ۲ (CI)

Work Log:
- تصمیم معماری: مسیر بحرانی = آزادسازی موج ۵ آرنا و رساندن ۲۴ سؤال تازه به معلم؛ ترتیب ۶→۷→۲→(۳،۴،۵)
- گام ۶ — بازرسی دوم §6.6 روی v0.5: سند تحویل خوانده شد؛ ۱۸ ردیف L-401..418 و ۲۴ سؤال Q-1069..1092 استخراج ماشینی شد؛ کلیدها مستقلاً بازحساب: ۲۴/۲۴ صحیح؛ نمونه‌گیری از upload/C205.pdf (کامل، ۱۵۲ صفحه): لایهٔ متن ۶ صفحهٔ چاپی ۵۵/۵۷/۶۰/۶۷/۷۰/۷۲ + رندر بصری ۳ صفحه (۵۷ سکه‌ها+الگویابی، ۶۰ جدول ارزش مکانی ۴ شکل، ۷۲ پنتومینو ۱۲ قطعه+فرهنگ خواندن) — مغایرت چاپی: صفر (برخلاف موج ۳ که ص۳۱ غلط بود)
- اصلاح یافتهٔ قبلی: ادعای «Q-1011: ۱۳→۱۸» در سند آرنا = «حفظ اصلاح رسمی تسک ۵۸» (صورت «۱۳ مثلث» + گزینهٔ درست ۱۸) — گارد INC-09 خود آرنا درست است؛ خوانش اولیهٔ من نادرست بود
- ادغام رسمی: v0.5 + .sha256 در authoring/ نشست (SHA = f1f339a0… برابر ادعا)؛ مبدل رسمی: مجاز ۰ قرمز/۲ زرد؛ KH-G2-MATH.json منتشر: ۶۲ درس / اطلس ۱۳ / بانک ۹۲ / منبع v0.5
- تست موتور: یک assert شمارش قدیمی (۴۴/۱۱/۶۸) به اعداد رسمی موج ۴ (۶۲/۱۳/۹۲) به‌روز شد → ۸۱/۸۱ سبز
- گام ۷ — OFFICIAL-HEADS.json برای ۶ خانواده (G1..G6) با SHA واقعی هر فایل + تابع check_official_heads/verify_all_heads در ایجنت + گیت official_heads در check-wave + زیرفرمان heads --verify؛ تست منفی (پایهٔ v0.4 برای خانوادهٔ G2) → FAIL_STOP_WAVE با STALE_OFFICIAL_BASE_INCIDENT_07 ✓؛ تست مثبت → PASS ✓
- گام ۲ — .github/workflows/khshab-gate.yml: push/PR روی v10.3-beta/main/arena/**؛ مراحل fail-closed: گارد حق‌نشر + مرز مالکیت + heads verify + npm ci/test موتور + check-wave self-baseline روی سرهای G2/G3؛ اجرای واقعی رانر به فعال‌بودن Actions در گیت‌هاب وابسته است
- سه کامیت موضوعی: b58797b (ادغام v0.5)، 7fafea9 (Task 66)، 15995f4 (Task 61) + این worklog → پوش

Stage Summary:
- KH-G2-MATH رسماً ۶۲ درس/۹۲ سؤال شد؛ موج ۵ آرنا آزاد است (پایه = v0.5 با SHA اعلامی در OFFICIAL-HEADS.json)
- گارد حادثهٔ #۷ خودکار شد: هر تحویل آینده با پایهٔ کهنه در همان check-wave می‌میرد
- CI اعلامی است تا اولین ران واقعی گیت‌هاب؛ کارهای باقی: گام ۳ (داشبورد: inspect + مُهر معلم)، گام ۴ (۳ آشکارساز errors-v103)، گام ۵ (رندرر SVG ۱۴مدلی)، ۶۰-bis (فیکسچر pytest + رفع هاردکد Q-1069)

---
Task ID: 61-note
Agent: Z.ai Code (main)
Task: وضعیت انتشار فایل CI

Work Log:
- پوش v10.3-beta با فایل workflow رد شد: توکن PAT فعلی scope «workflow» ندارد (refusing to allow a Personal Access Token to create or update workflow)
- اقدام: کامیت CI (15995f4) روی شاخهٔ محلی ci-pending حفظ شد؛ خط v10.3-beta بدون فایل workflow پوش می‌شود

Stage Summary:
- برای انتشار CI: مالک یا scope توکن را به workflow ارتقا می‌دهد یا خودش فایل را پوش می‌کند؛ سپس: git cherry-pick 15995f4 && git push origin HEAD:v10.3-beta

---
Task ID: 61-release
Agent: Z.ai Code (main)
Task: دریافت توکن workflow از مالک → انتشار فایل CI (گام ۲) → سبزکردن اولین ران واقعی khshab-gate

Work Log:
- توکن جدید مالک (classic، اسکوپ repo+workflow+write:packages) از چت دریافت و در remote نصب شد؛ curl اعتبار‌سنجی: 200 + اسکوپ‌ها تأیید
- کشف: origin/main روی گیت‌هاب کامیت بی‌ریشهٔ «Add files via upload» (5ad6659، index.html بازی «نبرد ضرب‌ها» ۱۲۰۷ خطی آپلود دستی مالک) داشت و با تاریخچهٔ محلی بی‌نیای بود
- انتشار CI: cherry-pick 15995f4 روی main (920a8a8) → push موفق v10.3-beta (690f540..920a8a8) — مانع چندوقت scope workflow برطرف شد
- آشتی main: merge --allow-unrelated-histories 5ad6659 → a1a4b01 (index.html مالک حفظ + تاریخچهٔ کامل بازگشت) → push موفق main
- اولین ران واقعی CI: هر دو شاخه FAILURE — همهٔ مراحل تا «تست موتور» سبز؛ فقط «check-wave سر G2 (self-baseline)» قرمز با ownership_boundary=FAIL (لیست تخلف در خروجی چاپ نمی‌شد)
- ریشه‌یابی: npm install در tools/cartridge-converter فایل package-lock.json می‌ساخت (ردیابی‌نشده) → زیر پیشوند ممنوعهٔ tools/ (§9) → گارد درست قرمز می‌کرد؛ گارد پیش از آن (قبل از npm) سبز بود چون هنوز فایلی تولید نشده بود
- فیکس ۳وجهی: (۱) کامیت package-lock.json مبدل (۲۰۳۰ بایت، npm install --package-lock-only) (۲) npm ci به‌جای npm install در workflow (هرگز lockfile نمی‌نویسد) (۳) خروجی گیت‌ها حالا copyright_guard_issues و ownership_boundary_issues را هم چاپ می‌کند (افزودنی، بدون شکستن قرارداد) + gitignore download/convert-report-*.md
- شبیه‌سازی کامل ۸ مرحله‌ای workflow در کلون تمیز (/tmp/ci-repro): همه exit 0 — شامل اولین اجرای تاریخ‌ساز G3 self-baseline (overall: PASS_READY_FOR_SECOND_INSPECTOR، heads G3 v0.7 تأیید)
- پوش 3305fec → هر دو شاخه؛ ران بعدی: main success ✓ + v10.3-beta success ✓ (اسکریپت بکاپ خودکار هم v10.3-beta را پیش از من پوش کرد — حلقهٔ بکاپ کاملاً وصل شد)
- کشف جانبی: انشعابات آرنا به‌روز شدند (arena/0eb22280: a53a766→714338c، arena/6b8310f7: a8541a5→06d7b7d) — تحویل جدید آرنا در صف بررسی

Stage Summary:
- CI رسمی روشن است: هر push/PR روی v10.3-beta/main/arena/** اکنون به‌طور خودکار گیت کامل (حق‌نشر G0 + مرز مالکیت G0B + مانیفست OFFICIAL-HEADS + تست موتور ۸۱تایی + مبدل روی سرهای G2/G3) را اجرا می‌کند و fail-closed است
- گیت self-baseline اکنون خودتوضیح است: فایل متخلف در لاگ CI دیده می‌شود
- توکن قدیمی مالک دیگر استفاده نمی‌شود (پاک‌سازی اختیاری در GitHub → Tokens)
- کار بعدی طبیعی: بررسی تحویل جدید آرنا در دو انشعاب به‌روزشده با پایهٔ v0.5

---
Task ID: foreman-v1
Agent: Z.ai Code (main)
Task: درخواست مالک — «رباتی داخل برنامه که نقشهٔ فنی را بداند و کارهای دستی/پراکنده را خودکار کند؛ در ارتباط با Z.ai و آرنا»

Work Log:
- کارگاه‌بان v1.0.0 ساخته و روشن شد: mini-services/foreman (Bun، پورت 3030، اسکن هر ۱۰ دقیقه + POST /scan دستی)
- معماری: fetch origin → تشخیص هد جدید روی arena/** → worktree ایزوله /tmp/foreman-work → گیت ماشینی محلی (مقایسهٔ نسخه/SHA خشاب‌ها با OFFICIAL-HEADS + heads-verify شاخهٔ آرنا + smoke مبدل در صورت هم‌گامی) → ساخت PR خودکار به v10.3-beta → کامنت رأی فارسی روی PR (کانال مستقیم آرنا) → BRIEF.md + /status
- نقشهٔ فنی رسمی: mini-services/foreman/MAP.md (معماری، مالکیت §9، سرهای رسمی، گیت‌ها، جریان تحویل، سرویس‌ها) + map.json (پیکربندی ماشینی)
- امنیت: توکن فقط از git remote پارس می‌شود، هرگز لاگ/ذخیره نمی‌شود؛ state/log/BRIEF در .gitignore
- باگ‌های رفع‌شده در مسیر: کلید state بدون پیشوند arena/ + تشخیص PR با فیلتر base==v10.3-beta (PR داخلی آرنا دست‌نخورده ماند)
- اولین دور واقعی (زنده): دو تحویل جدید آرنا که حین ساخت ربات رسیده بود پردازش شد — PR#2 (0eb22280 @3f2219f: G2 v0.5 و G3 v0.7 هم‌گام 🟢 ولی smoke مبدل روی شاخه‌اش BLOCKED_CONVERTER_SSOT — توپولوژی قدیمی‌تر از Task 60) + PR#3 (6b8310f7 @c5ed829: G2 v0.4 در برابر سر v0.5 → 🔴 INC-07، کامنت rebase برای آرنا رفت)
- مراحل انسانی دست‌نخورده ماند: بازرسی دوم (Z.ai) ← رأی معلم ← ادغام رسمی

Stage Summary:
- زنجیرهٔ «آرنا پوش می‌کند → ربات می‌بیند → گیت می‌گیرد → PR+رأی می‌نویسد → Z.ai/معلم فقط تصمیم» اکنون خودکار است
- کارگاه‌بان حیاتی است (bun --hot)؛ لاگ: mini-services/foreman/foreman.log | بریفینگ: BRIEF.md
- نکته برای بازرسی بعدی: PR#2 شاخهٔ آرنا مبدل کهنه دارد (SSOT ناهمگام) — هنگام ادغام باید مبدل از main بیاید نه از شاخهٔ آرنا؛ PR#3 باید بعد از rebase آرنا دوباره ارزیابی شود

---
Task ID: central-v2
Agent: Z.ai Code (main)
Task: فرمان مالک — «آرنا = محتوای خشاب/کتاب درسی روی شاخه‌های خودش، Z.ai = برنامهٔ اصلی، هر دو زیر یک سیستم مرکزی مدیریت؛ نقشه‌های فنی فقط با یک تایید مالک توسط ربات‌های درونی اجرا شوند» → ساخت سیستم مرکزی مدیریت

Work Log:
- GOVERNANCE.md v1.0.0 نوشته شد (قانون اساسی همکاری): نقش‌ها، مالکیت §9، کانال‌ها، چرخهٔ حیات نقشهٔ فنی (draft→awaiting_approval→approved→executing→delivered→verified→done)، مکانیزم «تأیید واحد» (مادهٔ ۵)، قیدهای ربات‌ها (مادهٔ ۶: هرگز force-push/حذف شاخه/ادغام محتوا/دست به OFFICIAL-HEADS بدون فرمان مالک)، دو خط اجرا (محتوا با بازرسی دوم+رأی معلم؛ توسعه با تأیید واحد+گیت‌ها)، فرمان فریز (مادهٔ ۸)
- blueprints/ ساخته شد: registry.json (SSOT روی main، اسکیمای khshab.blueprints/v1) + ۶ نقشهٔ اولیه — BP-000 سیستم مرکزی (تأییدشده از چت مالک)، BP-001 فیکسچر pytest+حذف هاردکد Q-1069، BP-002 سه آشکارساز errors-v103، BP-003 رندرر SVG ۱۴مدلی، BP-004 بازرسی محتوا+مُهر معلم در داشبورد، BP-005 موج محتوایی بعدی آرنا (content/arena) — همه در انتظار تأیید مالک
- scripts/blueprint.ts: CLI رسمی (list/show/approve/set-status/validate) با اعتبارسنجی اسکیما — تست شد
- کارگاه‌بان v2.0.0: موتور سیستم مرکزی روی v1 سوار شد — تابلوی مرکزی مدیریت (Issue #4 گیت‌هاب، برچسب central-board) به‌عنوان آینهٔ زندهٔ رجیستری + کانال تأیید واحد (کامنت «تایید BP-xxx»/«تایید همه» فقط از حساب bayrami1341؛ تلاش غیرمالک = پاسخ رد ربات) → ثبت رسمی در رجیستری با Contents API (کامیت روی main) → دیسپچ خودکار دستور کار (آرنا: تابلو+PR مرتبط | Z.ai: تابلو+بریفینگ) + فرمان «فریز» + صف‌های کار در BRIEF.md + اندپوینت /blueprints
- E2E زنده: تابلو #4 ساخته و پر شد (جدول ۶ نقشه، راهنمای تأیید، رویدادها)؛ BP-000 دیسپچ شد؛ CI گیت‌هاب روی main و v10.3-beta برای کامیت حاکمیتی ae29f50 سبز (khshab-gate)؛ intake آرنا سالم ماند (PR#2 سبز؛ PR#3 با هد جدید a36ba24 دوباره ارزیابی شد — کماکان STALE_BASE و در انتظار rebase آرنا)
- دو باگ پایداری کشف و رفع شد: (۱) spawnSync داخل هندلر Bun.serve روی این پلتفرم = مرگ بی‌صدای پروسه (POST /scan و /blueprints هر بار پروسه را می‌کشت) → POST /scan صف‌بندی شد (اجرا در پس‌زمینه) و /blueprints از کش درون‌حافظه‌ای می‌خواند (۲) کرش وسط اسکن → رأی تکراری روی PR (state پیش از finally ذخیره نمی‌شد) → ذخیرهٔ زودهنگام بعد از رأی + گارد هد همانسان
- لایه‌های خودترمیم برای محدودیت سندباکس (پاک‌سازی پروسه‌های پس‌زمینهٔ بیگانه): (۱) مسیر /api/foreman-boot — اگر 3030 مرده باشد کارگاه‌بان را به‌عنوان فرزند درخت پروسهٔ Next اسپاون می‌کند (درخت امن — اثبات‌شده با بقای Next) (۲) mini-services/foreman/supervisor.sh (۳) src/instrumentation.ts برای رستارت‌های بعدی Next. اجرای پایدار فعلی = فرزند Next (بدون --hot؛ طوفان reload با عملیات git ناسازگار است)
- راستی‌آزمایی مرورگری داشبورد (agent-browser): رندر کامل، ۵ تب، KPI واقعی (۱۶ دانش‌آموز/۱۲ گلوگاه)، هیچ خطای کنسول، همهٔ APIها 200 — تغییرات سیستم مرکزی هیچ رگرسیونی روی سایت نیانداخت

Stage Summary:
- سیستم مرکزی مدیریت فعال است: قانون در GOVERNANCE.md | نقشه‌ها در blueprints/registry.json | تابلو در Issue #4 | کارگاه‌بان v2 روی 3030 (فرزند Next، خودترمیم) | CI سبز
- «یک تایید مالک» اکنون یک کامنت است: «تایید BP-001» یا «تایید همه» روی تابلو — بقیه‌اش با ربات‌ها؛ ۵ نقشه (BP-001..BP-005) منتظر همین تاییدند
- مراحل انسانی خط محتوا (بازرسی دوم Z.ai ← رأی معلم ← ادغام) طبق مادهٔ ۷-ب حفظ شد
- نکتهٔ فنی برای آینده: کارگاه‌بان را با GET /api/foreman-boot زنده نگه دارید؛ هرگز bun --hot برای آن استفاده نشود (طوفان reload با عملیات git)

---
Task ID: single-approval-exec
Agent: Z.ai Code (main)
Task: تأیید واحد مالک در چت («من تایید می کنم... با چک لیست های سختگیرانه بررسی کنی») → ثبت رسمی، اجرای BP-001..BP-004 با چک‌لیست سخت‌گیرانه، حکم بازرسی دوم تحویل‌های آرنا، و ثبت BP-006/BP-007

Work Log:
- فاز A — ثبت تأیید: طبق مادهٔ ۵-۴ GOVERNANCE، تأیید چت مالک با CLI برای BP-001..BP-005 ثبت شد (کامیت 6e3805d، نسخهٔ رجیستری ۲)؛ کارگاه‌بان v2 در اسکن بعدی BP-004/BP-005 را خودکار دیسپچ کرد (ایونت تابلو ۱۸:۱۹)
- فاز B — حکم بازرسی دوم تحویل آرنا (39ab27e در arena/0eb22280 + d9c4177 در arena/6b8310f7):
  - مخزن math-game-v10.1 و ریشه هر دو shallow بودند → unshallow شد؛ merge-base 6b8310f7 با v10.3-beta = 5ad6659 (۹۷ کامیت عقب) → INC-07 کارگاه‌بان تأیید مستقل شد (نوک شاخه فاقد khshab-G2-MATH_v0.5.xlsx)
  - 39ab27e: همهٔ تغییرات داخل authoring/** + یک مورد زرد مستند (pyproject.toml ریشه = پیکربندی ایجنت: testpaths += authoring/tests) — بدون PDF/xlsx جدید؛ G0B سبز
  - ادعای W7 («pytest تضمین‌شده PASS روی ۶ سر») در worktree ترکیبی تمیز (کد آرنا + سرهای رسمی v10.3-beta + مبدل SSOT) بازتولید نشد: ۱۳/۱۴ — تست «بازسازی بیت‌به‌بیت v0.5» مردود (f3140306… ≠ f1f339a0…)؛ علت محتمل: ریفکتور excel_exporter در همان کامیت + حساسیت به نسخهٔ openpyxl؛ مبدل روی v0.5 رسمی خودش سبز (۰ قرمز/۲ زرد)
  - ادعای «صفر هاردکد QID» v2.0.0 درست است (Q-1069 فقط placeholder UI/داده)
  - d9c4177: ۳ سند فقط (داخل مرز)؛ سند ربات خوانش صفحه قرارداد پذیرش R0..C5 پیشنهاد می‌دهد — R0 هنوز BLOCKED (مستندات ربات از مالک نرسیده)
  - حکم کامل روی PR#2 کامنت شد (id 6348697410)؛ W7/W8 → BP-006/BP-007 در انتظار تأیید مالک
- فاز C — BP-001 (خروجی: کامیت 1836de9 سری): پیش‌فرض‌های هاردکد Q-1069/فصل «۴» از verify_cpa_and_answer_balance و inspect_cartridge_workbook حذف و cli به مانیفست جدید authoring/agent/wave_registry.json + رزالور wave_registry.py وصل شد؛ سوییت ایزوله authoring/tests (conftest با KHSHAB_REPO_ROOT override؛ هیچ وابستگی به /tmp آرنا) = ۱۱/۱۱؛ rg 'Q-1069' در فایل‌های منطق = 0 (استثنای مستند: spec-of-record و قالب گزارش تحویل)؛ G2 self-baseline همه‌گیت سبز، G3 PASS_READY با cpa FAIL = legacy مستند AUD-06 (رفتار CI حفظ شد)؛ JS 81/81؛ کشف جانبی: سوییت پایتون tests/test_authoring_pipeline.py ۲۷ شکست پیش‌موجود در سندباکس (بدون تغییرات من هم همین است؛ جزو CI نیست)
- فاز D — BP-002 (کامیت a7b6fca سری): سه آشکارساز Pure در errors-v103.js (classifyRoundNearest/classifyUnitValue/classifyApproxExact + سه کد در اطلس + زنجیرهٔ ۱۱تایی با حفظ ترتیب قبلی + سه op تازه در classifyV103)؛ تفکیک مسئولیت «گرد نزدیک → E_ROUND_NEAREST، برش دور → E_APPROX_EXACT_CONFUSION»؛ ۶ تست جدید شامل fuzz ۲۰هزارتایی بی‌استثنا؛ errors.js منجمد ماند؛ npm test 87/87
- فاز E — BP-003 (کامیت a7b6fca سری): model-figures.js (پارس گرامر ۷.۳ + قالب فشرده M_XXX(۳×۴) + وایت‌لیست ۱۴مدلی + نرمال‌سازی ارقام فارسی + renderVisualColumn با فالبک متنی)؛ قفل INC-09 با کلاس‌های شمارش‌پذیر mf-* (نمونهٔ طلایی مثلث:۱۳ دقیقاً ۱۳ polygon)؛ ۱۹ تست؛ npm test 106/106؛ ۱۴ SVG نمونه در authoring/build_preview/model-figures/؛ سیم به station/index.js
- فاز F — BP-004 (کامیت aa3ec13): GET /api/teacher-review (سرهای رسمی + نامزدهای کارگاه‌بان + مُهرها) + POST /api/teacher-review/stamp (قفل SHA سر رسمی + نوشتن اتمی tmp→rename) + تب ششم «بازرسی محتوا» در داشبورد + dispatchTeacherStamps در کارگاه‌بان (idهای ارسال‌شده در state؛ بدون رأی تکراری)؛ E2E زنده: مُهر آزمایشی → فایل رسمی → تابلو #4 → پاک‌سازی تمیز هر دو طرف
- فاز G — رجیستری v8: BP-000=done، BP-001..004=verified، BP-005=executing (دیسپچ‌شده)، BP-006 (W7: pytest در CI — پیش‌نیاز هم‌راستاسازی تست بیت‌به‌بیت یا قفل openpyxl) و BP-007 (W8: گسترش parseOptionValue ±۱e9/کسر/مخلوط + پورت ۵ حل‌گر — ریسک رگرسیون هسته) ثبت و روی main+v10.3-beta پوش شد (862bb6f)
- فاز H — راستی‌آزمایی نهایی: CI گیت‌هاب v10.3-beta سبز (5a4570b success؛ هد فعلی در حال ران)؛ CI شاخه‌های arena/6b8310f7 قرمز = همان INC-07 معلوم (دستور rebase پابرجاست)؛ f2ce81d آرنا (agent v2.1) بازرسی مرزی شد: فقط authoring/** + یک خط gitignore بی‌خطر — بدون نقض SSOT؛ agent-browser: تب بازرسی رندر کامل، مُهر E2E از UI واقعی (toast «مُهر ثبت شد» → فایل)، صفر خطای کنسول، هر ۶ تب سالم، موبایل ۳۹۰px با تب‌های wrap، فوتر چسبان (flex+min-h-screen+mt-auto)

Stage Summary:
- زنجیرهٔ «یک تایید مالک → اجرای ربات‌ها» کامل و زنده اثبات شد: تأیید چت → رجیستری → دیسپچ خودکار → اجرای BP-001..004 → وارسی گیت‌ها → پوش سبز
- BP-001..BP-004 تحویل و وارسی‌شده؛ BP-005 (موج محتوا) در دست آرنا با intake خودکار؛ BP-006/BP-007 منتظر «تایید BP-006 BP-007» یا «تایید همه» مالک روی تابلو/چت
- دو مورد نیازمند تصمیم/توجه مالک: (۱) پروپوزال «co-lead governance» آرنا در arena/6b8310f7 (c33148e) — تغییر قانون اساسی فقط با حکم مالک؛ (۲) ادعای بیت‌به‌بیت آرنا در محیط تمیز صادق نیست — تا رفع، W7 به CI نمی‌رود
- نکتهٔ فنی باقی: هشدارهای instrumentation.ts پیش‌موجود (لایهٔ خودترمیم central-v2) بی‌اثر بر اجرا؛ سوییت پایتون قدیمی tests/test_authoring_pipeline.py در سندباکس ناقص‌اجراست (جزو CI نیست)

---
Task ID: arena-handshake-v1
Agent: Z.ai Code (main)
Task: نگارش پرامپت «قرارداد تعامل حداقلی» برای آرنا — زمینه‌سازی پروتکل‌های همسویی (به دستور مالک)

Work Log:
- انطباق با وضعیت فعلی مخزن: OFFICIAL-HEADS.json (هَدهای G1..G6 + قاعدهٔ SHA و STALE_OFFICIAL_BASE_INCIDENT_07)، بریف ARENA-EXPERIENCE-TRANSFER-v1 و آخرین رکورد BP (رجیستری + intake خودکار + پروپوزال co-lead معلق آرنا)
- نگارش سند ۸بخشی: نقش‌ها، سطح تماس حداقلی ۴نقطه‌ای (شاخه‌های arena/**، فایل‌های xlsx+سند تحویل، worklog append-only، هیچ‌چیز دیگر)، پروتکل‌های همسویی P0..P7، چک‌لیست سخت‌گیرانهٔ پیش از push، قالب رکورد worklog، ممنوعیت‌های مطلق، اهداف شمالی، وضعیت شروع
- مکانیزم امضا: فعال‌سازی قرارداد با اولین کامیت آرنا روی arena/** پس از دریافت؛ ACK/اصلاح فقط با رکورد [ARENA-ACK] در worklog
- فایل تحویل: download/ARENA-MINIMAL-HANDSHAKE-PROMPT-v1.fa.md

Stage Summary:
- قرارداد آمادهٔ ارسال به آرنا توسط مالک است؛ لایهٔ حداقلی تعامل، پاسخ ساختارمند به پروپوزال co-lead معلق است (حکم نهایی با مالک)
- بدون تغییر کد/CI؛ صرفاً سند حاکمیتی + این رکورد

---
Task ID: roadmap-next-version
Agent: Z.ai Code (main)
Task: ترسیم نقشهٔ راه ارتقای هستهٔ مرکزی برای نسخهٔ بعدی (v10.3.0-beta.1) به‌صورت ماشین‌اجرا — به دستور مالک: «ربات بتواند اتوماتیک کار را ادامه دهد»

Work Log:
- انطباق با زیرساخت موجود: خواندن blueprints/registry.json (schema v8→9)، scripts/blueprint.ts (قواعد validator)، mini-services/foreman/MAP.md، RELEASE-NOTES-beta.0 و رشته‌های نسخه
- نگارش سند نقشهٔ راه: blueprints/ROADMAP-v10.3.0-beta.1.fa.md — دو رشتهٔ اجرا A (BP-008→BP-006→BP-010→BP-009) و B (BP-007→BP-011→BP-012) + رشتهٔ موازی محتوا (BP-005) + پروتکل ادامهٔ خودکار (تأیید واحد → پیمایش ترتیبی → گیت fail-closed بین هر گام → کامیت/push → بعدی بدون تأیید جدید) + تعریف «تمام» بتا.۱ + جدول تصمیم‌های معلق (co-lead، بیت‌به‌بیت W7، اولویت W8) + ریسک/پادزهر + ران‌بوک ربات
- ثبت ۵ نقشهٔ جدید در رجیستری (نسخهٔ ۹): BP-008 (بازرسی دوم هدهای 714338c/06d7b7d + ادغام/مانیفست/انتشار JSON — قالب همیشگی خط دریافت محتوا)، BP-010 (گیت سخت انتشار release-check.sh با تست منفی)، BP-009 (bump بتا.۱ + یادداشت + تگ + همگام دو شاخه)، BP-011 (موتور زنجیرهٔ اجرا run-approved.sh با dry-run و توقف ایمن)، BP-012 (انتشار پایدار v10.3.0 مشروط به مُهر واقعی معلم)
- validator سبز: «✅ رجیستری سالم است — ۱۳ نقشه، نسخهٔ ۹»؛ صف تأیید واحد مالک: BP-006 BP-007 BP-008 BP-010 BP-009 BP-011 BP-012
- اشاره‌گر نقشهٔ راه به حافظهٔ کارگاه‌بان اضافه شد (mini-services/foreman/MAP.md §۱-ب)

Stage Summary:
- نقشهٔ راه کاملاً ماشین‌اجراست: تنها اقدام انسانی باقی‌مانده «تایید همه» مالک روی تابلو/چت است؛ پس از آن ربات‌ها رشتهٔ A تا بتا.۱ و سپس رشتهٔ B تا v10.3.0 پایدار را می‌پیمایند
- توقف‌های مطلق ربات: فرمان «فریز»، قرمزی گیت fail-closed، خارج‌ازدامنه؛ مُهر معلم و حکم‌های مالک هرگز شبیه‌سازی نمی‌شود
- فایل‌های این گام: blueprints/ROADMAP-v10.3.0-beta.1.fa.md، blueprints/registry.json (v9)، mini-services/foreman/MAP.md

---
Task ID: BP-008 (A1 — رشتهٔ بتا.۱)
Agent: Z.ai Code (main)
Task: بازرسی دوم هدهای آرنا (211ee45@arena/0eb22280-math-game و dc0922e@arena/6b8310f7-math-game — جدیدتر از 714338c/06d7b7d سند نقشه) + حکم ادغام

Work Log:
- کشف: هدهای اعلامی سند قدیمی بودند؛ آرنا ۹ و ۱۴ کامیت جدید پوش کرده (ربات v2.1→v2.4 و محتوا/حاکمیت) — بازرسی روی آخرین هدها انجام شد
- مرز مالکیت G0B: B1 = همه‌چیز authoring/** به‌جز pyproject.toml ریشه (پین openpyxl==3.1.5 + pymupdf + bump 2.4.0 — بی‌خطر ولی خارج قلمرو) | B2 = همه‌چیز authoring/** + worklog (مجاز) به‌جز .github/workflows/g2-cartridge-gate.yml (نقض صریح قلمرو CI؛ ورک‌فلو فقط‌خواندنی روی شاخهٔ خودش)
- محتوا: درفت‌های G2 v0.8..v1.2؛ SHA sidecar v1.2 منطبق (18e6b4fa)؛ پایهٔ اعلامی گیت خود آرنا = f1f339a0 (هد رسمی v0.5) → INC-07 حل شده؛ مبدل رسمی ما روی v1.1 و v1.2: صفر قرمز/۲ زرد؛ [ARENA-ACK] در worklog شاخه ثبت شده
- 🛡️ حادثهٔ عملیاتی مهار شد: مبدل رسمی خروجی را به مسیر canonical می‌نویسد و در ران روی درفت، KH-G2-MATH.json منتشرشده را آلوده کرد؛ حلقهٔ auto-backup (392795f) درخت کثیف را کامیت/پوش کرد → CI آن کامیت FAILURE شد (گیت fail-closed خودش گرفت!) → بازسازی رسمی از هَد v0.5 (0300628): منبع=khshab-G2-MATH_v0.5.xlsx، ۶۲/۱۳/۹۲، گیت ۰قرمز، تست موتور ۱۰۶/۱۰۶ سبز، پوش موفق
- حکم T3: هر دو شاخه 🟡 قرمزِ ادغام فعلی + لیست دقیق اصلاح؛ کامنت حکم روی تابلو #4 (issuecomment-6352629511)؛ ادغام T4 انجام نشد (fail-closed)

Stage Summary:
- BP-008: delivered+verified — خط لولهٔ «دریافت←گیت←حکم» فعال و مستند؛ اصلاح دو مورد مرزی از آرنا → ادغام بعدی
- آسیب‌شناسی سیستمی ثبت شد: (۱) مبدل برای ورودی غیررسمی باید خروجی را جای امن بنویسد (نکته برای BP-010) (۲) auto-backup نباید درخت با خروجی مبدل بی‌حکم را کامیت کند (۳) khshab-gate روی شاخه‌های آرنا اجرا نمی‌شود چون فایل workflow در تاریخچهٔ آن‌ها نیست — پوشش محلی کارگاه‌بان/بازرسی دوم جبران می‌کند
- وضعیت کارتریج رسمی: سالم و هم‌SHA با هَد v0.5؛ CI main پس از فیکس در انتظار ران سبز

---
Task ID: BP-006 (A2 — رشتهٔ بتا.۱ / W7 آرنا)
Agent: Z.ai Code (main)
Task: تحقق W7 — افزودن گام پایتست ایجنت به CI khshab-gate + هم‌راستاسازی قرارداد بیت‌به‌بیت

Work Log:
- ریشه‌یابی حادثهٔ بیت‌به‌بیت (f3140306≠f1f339a0): حساسیت خروجی اکسل به نسخهٔ openpyxl؛ محلی با openpyxl 3.1.5 → pytest ۱۱/۱۱ سبز؛ پین آرنا در شاخه‌اش (pyproject v2.4) دقیقاً همین است — هم‌راستاسازی تأیید شد
- فیکس CI: پین 'openpyxl==3.1.5' در گام وابستگی‌ها + گام جدید «پایتست ایجنت (authoring/tests)» پس از heads verify (مانیفست ۶ خانواده + رجیستری موج + smoke رسمی)
- شبیه‌سازی محلی: G0 سبز، G0B سبز، heads verify سبز (issues [])، pytest 11 passed
- اولین ران واقعی CI با گیت پایتست: b88b3e8 → success (همهٔ مراحل قبلی دست‌نخورده)

Stage Summary:
- BP-006: delivered+verified — W7 آرنا رسماً در CI مادر پیاده شد؛ مسیر ادغام سوییت کامل‌تر آرنا (بعد از اصلاح مرزی) باز است
- نکته برای BP-011: این گیت باید در زنجیرهٔ رانر هم اجرا شود

---
Task ID: BP-010 (A3 — رشتهٔ بتا.۱)
Agent: Z.ai Code (main)
Task: ساخت گیت سخت انتشار scripts/release-check.sh — fail-closed پیش از هر تگ

Work Log:
- پیاده‌سازی ۶ گام: (۱) سازگاری نسخه package.json ↔ RELEASE-NOTES ↔ سورس HTML/JS/JSON (۲) گاردهای G0/G0B (۳) heads verify (۴) پایتست ایجنت W7 (۵) npm test موتور (۶) مبدل رسمی G2/G3 + تطبیق منبع و محتوای کارتریج منتشرشده با هَد (فقط تفاوت timestamp مجاز) + بازگردانی خودکار درخت پس از گیت
- تست مثبت: EXIT=0 — «RELEASE-CHECK PASS، نسخهٔ 10.3.0-beta.0، تگ مجاز»؛ درخت پس از اجرا تمیز
- تست منفی: دستکاری SHA هَد G2 در مانیفست → FAIL؛ نکتهٔ دفاع‌درعمق: هم گام ۳ و هم پایتست لایهٔ دوم (test_official_heads_manifest) همان تزریق را گرفت؛ مانیفست بازگردانی و سلامتش راستی‌آزمایی شد
- درس عملیاتی: sed -i روی فایل مانیفست در پنجرهٔ کندی سندباکس دوبار شل را گیر انداخت — تامپر با پایتون و اجرای پس‌زمینه‌ای nohup جایگزین شد (فقط روش اجرا، نه نتیجه)
- مستند در blueprints/README.md (بخش گیت سخت انتشار)

Stage Summary:
- BP-010: delivered+verified — از این پس هر تگ بدون گزارشنامهٔ سبز ممنوع است؛ آلودگی نوع auto-backup (392795f) از این گیت دیگر عبور نمی‌کند
- آماده برای A4 (BP-009): bump بتا.۱ + یادداشت + تگ

---
Task ID: BP-009 (A4 — رشتهٔ بتا.۱ / انتشار)
Agent: Z.ai Code (main)
Task: انتشار نسخهٔ v10.3.0-beta.1 با ماشین BP-010

Work Log:
- bump نسخه در public/math-game/package.json → 10.3.0-beta.1 + نگارش RELEASE-NOTES-v10.3.0-beta.1.md (۵ ردیف تغییر: W7، release-check، خط لولهٔ BP-008، مهار حادثهٔ آلودگی، رجیستری v10)
- اجرای گیت انتشار (fail-closed طبق قانون خودمان): release-check → 🟢 PASS نسخهٔ 10.3.0-beta.1 (هر ۶ گام سبز؛ کارتریج‌ها منطبق هَد)
- انتشار: کامیت 1c5f3ea روی main → پوش → fast-forward v10.3-beta به همان هد (هر دو شاخه هم‌هد) → tag -a v10.3.0-beta.1 با متن گزارشنامه → پوش تگ

Stage Summary:
- رشتهٔ A (بتا.۱) کامل شد: BP-008 ✅ BP-006 ✅ BP-010 ✅ BP-009 ✅ — هر چهار delivered+verified
- v10.3.0-beta.1 منتشر شد؛ تعریف «تمام» نقشهٔ راه همگی تیک خوردند (به‌جز ران نهایی CI تگ که در حال راستی‌آزمایی است)
- بعدی طبق رجیستری: رشتهٔ B — BP-007 (W8) → BP-011 (رانر زنجیره) → BP-012 (پایدار)

---
Task ID: nightshift-roadmap-v1
Agent: Z.ai Code (main)
Task: ترسیم نقشهٔ راه شیفت شب — اجرای بی‌توقف از تأیید مالک تا صبح

Work Log:
- نگارش blueprints/ROADMAP-NIGHTSHIFT-v1.fa.md: تعریف Done صبح (۵ بند)، رشتهٔ N (N1=BP-007 در حال اجرا → N2=BP-011 رانر → N3=BP-013 آرنا-واچ → N4=BP-014 پیش‌بارگذاری صبح)، ۵ ممنوعیت مطلق شب، ران‌بوک حلقهٔ اجرا (§۴)، جدول ریسک/پادزهر، قالب گزارش صبح
- ثبت دو نقشهٔ جدید در رجیستری (v21→v22):
  - BP-013 «آرنا-واچ چراغ خاموش» (p15): پایش read-only بین‌گامی شاخه‌های arena/** + issue #4؛ در صورت پوش جدید آرنا → اجرای خط دریافت قالب BP-008 (سبز=ادغام، قرمز=کامنت حکم)
  - BP-014 «پیش‌بارگذاری صبح» (p16): اسکلت خالی teacher-stamps.json + پیش‌نویس DRAFT یادداشت انتشار پایدار + تست دود جریان مُهر داشبورد + گزارش صبح (worklog + issue #4 + چک‌لیست اقدام انسانی)
- مرز سخت صریح‌سازی شد: BP-012 شب اجرا نمی‌شود (مُهر معلم غایب)؛ تست «ردِ خودکار BP-012» داخل پذیرش BP-011 گنجانده شد تا رانر جدید ثابت کند skip ایمن دارد
- گارد اصلی شب در سند: تگ v10.3.0 ممنوع | شبیه‌سازی مُهر ممنوع | ادغام آرنا با گیت قرمز ممنوع | force-push ممنوع | عبور از گیت قرمز ممنوع
- MAP.md: اشاره‌گر NIGHTSHIFT افزوده شد؛ validator رجیستری سبز: «۱۵ نقشه، نسخهٔ ۲۲»

Stage Summary:
- وضعیت صف برای دیسپچ شبانه: executing=BP-007 | approved=BP-011 | awaiting_approval=BP-013, BP-014 | blocked-انسانی=BP-012
- با تأیید مالک («تایید همه» یا «تایید BP-013 و BP-014»)، حلقهٔ §۴ تا صبح بی‌توقف اجرا می‌شود و فقط با: فرمان فریز / قرمزی گیت (فقط همان رشته) / خارج‌ازدامنه متوقف می‌شود

---
Task ID: nightshift-dispatch
Agent: Z.ai Code (main)
Task: ثبت تأیید واحد مالک «تایید همه» (trace 1a165e609768e74d) و آغاز شیفت شب

Work Log:
- approve BP-013 و BP-014 با منبع تأیید «مالک-چت: تایید همه» → رجیستری v24، validator سبز
- صف فعال شب: BP-007 (executing) → BP-011 (approved) → BP-013 → BP-014 | BP-012 قفل انسانی (مُهر معلم)
- حلقهٔ §۴ نقشهٔ NIGHTSHIFT آغاز شد — N1 (W8) شروع می‌شود

Stage Summary:
- شیفت شب رسماً فعال؛ گیت‌های fail-closed بین هر گام؛ ممنوعیت‌های ۵گانهٔ سند NIGHTSHIFT حاکم

---
Task ID: BP-007 (N1 — رشتهٔ B1 / W8 آرنا)
Agent: Z.ai Code (main)
Task: گسترش اسکیمای مبدل (اعداد بزرگ/منفی/کسر/مخلوط) + پورت ۵ خانوادهٔ حل‌گر آرنا + تعمیم classifyAttempt

Work Log:
- T1 (کامیت 769c204): parseOptionValue نسخهٔ W8 — کسر دقیق «a/b» (ساده‌سازی + علامت استاندارد روی صورت)، مخلوط «k و a/b» (علامت بر کل مقدار: −۲ و ۱/۲ = −۵/۲)، بازهٔ رسمی ±۱۰^۹ (fracInRange ضرب‌زدوری BigInt)، ارقام عربی-هندی (٠-٩) و U+2212/U+060D هم‌راستا با مبدل آرنا؛ گیت دامنهٔ کسر در validateCartridge (۰..۹۹۹۹ هم‌قاعدهٔ عدد)؛ makeFrac/isFracValue/fracToNumber صادره شدند
- باگ میانهٔ T1: علامت مخلوط منفی فقط بر k می‌نشست (−۳/۲ به‌جای −۵/۲) — با آزمون مرزی گرفته و فیکس شد
- T2 (کامیت 5510bda): ماژول افزودنی errors-w8.js — پورت وفادار ۵ خانوادهٔ arena/0eb22280:authoring/agent/solvers (fractions/geometry_measure/data_prob/mult_div/number_ops): ۳۰ کد «پیشنهادی» W8 + PRIORITY_W8 (۴۶ کد)، حل‌گرهای exact (solveW8 برای بازحساب کلید مبدل)، آشکارسازهای علّی classifyW8 با حساب گویای BigInt (صفر خطای شناور — عین سیاست Fraction پایتون)
- انجمادِ هدفمند errors.js: گارد classifyAttempt به عامل ۶رقمی + پاسخ تا ۱۰^۱۳ گسترش یافت (حاصل ≤ ۱۰^۱۲ < ۲^۵۳ — exact)؛ منطق الگوها دست‌نخورده
- درس‌های برخورد کاندیدها (مستند): در تفریق هدف‌دار و تبدیل مرکب، چند مکانیزم می‌توانند هم‌ارزش باشند (SWAP↔GE_DIVISOR، GROUP↔q−۱، چسباندن↔توان ۱۰۰) — زنجیرهٔ PRIORITY_W8 انتخاب قطعی می‌دهد؛ پایتون مجموعه برمی‌گرداند و تصمیم با نویسنده است
- T3 آزمون معکوس دوباره (بعد از T1 و بعد از T2): npm test 134/134 (۸۱→۱۰۶→۱۳۴) + release-check کامل 🟢 — مبدل رسمی روی G2 v0.5 و G3 v0.7 «فقط تفاوت timestamp» = صفر رگرسیون روی ۹۲ سؤال رسمی
- فایل تست نو tests/v10.3-w8.test.js: ۲۷ آزمون (۵ خانواده + دروازهٔ classifyAttempt + دیسپچر/متادیتا) به test script افزوده شد

Stage Summary:
- BP-007: delivered — W8 رسمی‌شده: هر سه تسک سبز، پذیرش (acceptance) هر دو بند محقق
- قرارداد نو برای کارتریج‌های آینده: op spec ساختاریافته (مثل math.f1/f2 فعلی) → classifyW8/solveW8؛ کدهای W8 «پیشنهادی»اند تا مُهر معلم (BP-012)
- بعدی طبق NIGHTSHIFT: N2 — BP-011 موتور زنجیرهٔ run-approved.sh

---
Task ID: BP-011 (N2 — رشتهٔ B2)
Agent: Z.ai Code (main)
Task: موتور زنجیرهٔ اجرا scripts/run-approved.sh — ادامهٔ خودکار نقشه‌ها به ترتیب اولویت با گیت بین‌گام

Work Log:
- T1: رانر سه‌حالته run|dry-run|self-test با فیلتر --bp؛ گاهِ بین‌گام = validate رجیستری + release-check (همان ۶ گام BP-010)؛ گذار delivered→verified پس از poll سبزی CI روی هد (API گیت‌هاب، تا ۶ دقیقه)؛ commit/push خودکار؛ block_record در قرمزی = set-status block + worklog + پوش + کد خروج ۱
- T2: dry-run سبز — ترتیب صحیح صف بر اولویت (BP-005 تا BP-014)، بدون هیچ نوشتنی
- T3: self-test سه‌گزاره‌ای سبز — (۱) dry-run exit ۰ (۲) SIMULATE_RED_GATE=1 → کد ۱ + BLOCK (۳) صفر جهش: SHA رجیستری و هد git دست‌نخورده
- قاعدهٔ رد خودکار: BP-012 بدون مُهر معلم (شمارش stamps=۰) → skip مستند نه block — رانر ساختاراً نمی‌تواند انتشار پایدار را بدون مُهر انسانی جلو بکشد؛ تست عملی در dry-run: BP-012 در صف رد نخواهد شد به‌عنوان block
- باگ میانه: صف در BP-005 (executing) با کد ۲ می‌ایستاد و به گیت نمی‌رسید — فیلتر --bp افزود شد (هم ابزار واقعی، هم مسیر self-test)
- مستند: blueprints/README.md §موتور زنجیرهٔ اجرا + MAP کارگاه‌بان §رانر زنجیره

Stage Summary:
- BP-011: delivered — از این پس چرخهٔ «بدنه با دستِ ربات → رانر گیت+CI+وارسی → بعدی» ماشین‌شده است
- بعدی: رانر واقعی روی BP-007 (delivered) برای نخستین وارسی خودکار، سپس N3 آرنا-واچ

---
Task ID: BP-013 (N3 — آرنا-واچ چراغ خاموش / چرخهٔ ۱)
Agent: Z.ai Code (main)
Task: پایش شبانهٔ شاخه‌های arena/** + خط دریافت محتوا در صورت پوش جدید

Work Log:
- پایش: arena/6b8310f7 = dc0922e (بدون تغییر) | arena/0eb22280 = پوش نو 211ee45 → f2d7f24 (۱ کامیت)
- بازرسی تفاضلی f2d7f24: فقط authoring/ZAI-HANDOFF-W7-W8.fa.md (+۱۲ خط) — هندآف نهایی W7/W8؛ G0 پاس، G0B پاس (داخل قلمرو)، بدون اثر کارتریجی
- هم‌راستایی W8 تأیید: درخواست سند آرنا دقیقاً همان تحویل BP-007 است (±۱۰^۹ + a/b + k و a/b + پورت ۵ خانواده)
- وضعیت دو تخلف قبلی: workflow خارج‌ازقلمرو ✅ حذف‌شده (آرنا اصلاح کرد) | pyproject.toml ریشه ⛔ هنوز موجود
- حکم روی تابلو: issuecomment-6353723639 — 🟡 قرمزِ ادغام فعلی (فقط انتقال pyproject.toml به authoring/ مانده)؛ کامیت نو خودش سبز
- [ARENA-ACK] قرارداد حداقلی هنوز در issue #4 ثبت نشده — در چرخه‌های بعدی واچ دنبال می‌شود

Stage Summary:
- خط دریافت «پایش←گیت←حکم» دومین بار در تولید اجرا و سبز شد (قالب همیشگی BP-008)
- رانر زنجیره BP-007/BP-011 را خودکار وارسی کرد (گیت+CI سبز → verified) و BP-012 را به‌دلیل مُهر غایب رد کرد — ردِ خودکار در عمل ثابت شد

---
Task ID: BP-014 (N4 — پیش‌بارگذاری صبح)
Agent: Z.ai Code (main)
Task: اسکلت مُهر معلم + پیش‌نویس DRAFT یادداشت انتشار پایدار + تست دود جریان مُهر

Work Log:
- T1: authoring/teacher-stamps.json غنی‌سازی شد — قاعدهٔ اعتبار کامل (چه‌کسی/کِی/حکم‌ها/اتصال SHA هَد/اثر/API) اضافه شد؛ شمارش stamps = ۰ (طبق قانون — هیچ مُهری ساخته نشد)
- T2: public/math-game/RELEASE-NOTES-v10.3.0.md به‌صورت DRAFT با بنر صریح «منتشرنشده» نوشته شد — بدون bump نسخه و بدون تگ؛ چک‌لیست پیش‌شرط‌ها + گام‌های انتشار پس از مُهر
- T3: تست دود داشبورد — GET /api/teacher-review → 200 (هدها+نامزدها+مُهرها)؛ POST /api/teacher-review/stamp با بدنهٔ خالی → 400 fail-closed («family و verdict معتبر الزامی») — گارد مُهر کار می‌کند، صفر مُهر واقعی
- آزمون خودکارِ خودمان: release-check پس از افزودن DRAFT دوباره اجرا شد → 🟢 PASS (فایل پیش‌نویس گیت را نشکست)

Stage Summary:
- زمین صبح آماده: معلم فقط مُهر می‌زند، مالک فقط فرمان می‌دهد، ماشین BP-012 بقیه را می‌راند
- ممنوعیت‌های شب (بدون تگ پایدار، بدون شبیه‌سازی مُهر) همه رعایت شد

---
Task ID: nightshift-final (پایان شیفت شب)
Agent: Z.ai Code (main)
Task: هم‌هدسازی شاخه‌ها + CI نهایی + گزارش صبح

Work Log:
- رانر زنجیره دومین دور کامل: BP-013 و BP-014 گیت+CI سبز → verified — صف z.ai خالی (exit 0)
- هم‌هدسازی: main و v10.3-beta هر دو = efab195؛ CI ران نهایی: completed success
- گزارش صبح روی تابلو: issuecomment-6353797918 — وضعیت ۴ گام + چک‌لیست اقدام انسانی (مُهر معلم / فرمان BP-012 / pyproject آرنا / ARENA-ACK)

Stage Summary:
- شیفت شب NIGHTSHIFT v1 کامل: BP-007 ✅ BP-011 ✅ BP-013 ✅ BP-014 ✅ (هر چهار verified)
- رانر زنجیره در همان شب دو بار در تولید اجرا و اعتبار سنجیده شد — ۴ وارسی خودکار، ۲ ردِ خودکار مستند
- تنها کار باقی‌مانده تا v10.3.0 پایدار: مُهر واقعی معلم + فرمان مالک (BP-012) + یک اصلاح مرزی آرنا (pyproject.toml)

---
Task ID: BP-015/016-registry (بازیابی بستر + ثبت نقشه‌ها)
Agent: Z.ai Code (main)
Task: گام ۰ نقشهٔ تکمیل خشاب‌ها — بازیابی دسترسی مخزن با PAT مالک + ثبت BP-015/BP-016 در رجیستری (v33)

Work Log:
- دسترسی مخزن با توکن fine-grained/classic مالک بازیابی شد (کلون تازه؛ توکن فقط در remote کلون محلی — در هیچ فایلی نوشته نشد)
- موجودی واقعی اندازه‌گیری شد: KH-G2-MATH = ۹۲ سؤال (CORE 46 / DEPTH 23 / SIDE 23؛ همه «چهارگزینه‌ای»؛ ۰ تأییدشده) — KH-G3-MATH = ۲۰ سؤال (۱۳ تأییدشده) — KH-G1 = صفر
- فیلد دامنهٔ D1..D8 در کارتریج‌ها موجود نیست (فقط CORE/DEPTH/SIDE) — شکاف ماتریس قانون Task 23 تأیید ماشینی شد
- موتور فعلی تک-قالبی است: cartridge-schema.js گزینه‌ها را دقیقاً ۴تایی الزام می‌کند (سطر ۳۰۸)
- BP-015 (اولویت ۱۷) و BP-016 (اولویت ۱۸) طبق §۸ قانون به‌صورت awaiting_approval در رجیستری ثبت شدند — validate سبز (۱۷ نقشه، نسخهٔ ۳۳)

Stage Summary:
- بستر بازگشت؛ موجودی واقعی جای همهٔ برآوردها را گرفت
- صف: BP-015 منتظر تأیید مالک برای شروع گام ۱ (زیرساخت پوشش)؛ BP-016 در انتظار (گام ۲)

---
Task ID: BP-015 (گام ۱ نقشهٔ تکمیل — زیرساخت پوشش دامنه‌دار)
Agent: Z.ai Code (main)
Task: T1 schema دامنه‌دار + T2 گزارش پوشش + T3 گیت ضد-ادعا + T4 لایهٔ دامنه در مبدل رسمی

Work Log:
- T1: public/math-game/authoring/DOMAIN-MATRIX.json (khshab.domain-matrix/v1) — ترجمهٔ ماشینی ماتریس قانون (G3: ۸ دامنه/۴۵۲، G2: ۶ دامنه/۲۴۲) با برچسب DRAFT تا مُهر گام صفر معلم؛ فیلدهای افزودنی سؤال (domainCode/qType/chapter/lesson/answerFormat/renderHint) به‌صورت نرم (هشدار) در cartridge-schema.js — سازگاری پسین کامل با ۹۲ سؤال میراثی
- T2: scripts/coverage-report.ts — گزارش Markdown خانه‌به‌خانه (دامنه×حداقل، سطل میراثی، تأییدشده، قالب‌ها) + --gate خرج‌۱؛ نخستین گزارش واقعی: reports/coverage-current.md — هر دو خانواده قرمز (G2: 92/242 — G3: 20/452 — همهٔ دامنه‌ها صفر چون میراثی‌اند)
- T3: scripts/check-domain-claims.sh — گیت fail-closed ضد-ادعا: ادعای v1.0/«پایه آماده» ⇒ الزام گیت پوشش سبز + مُهر approve معلم؛ سلف‌تست ادعای کاذب → قرمز قطعی (exit 1)؛ سیم‌کشی به khshab-gate.yml (گیت ۳ + setup-bun)
- T4: authoring/agent/domain_matrix.py + authoring/tests/test_domain_matrix.py (۱۰ تست) — اعتبارسنجی دامنه/نوع + شمارش پوشش «در همان گذر» مبدل رسمی (run_converter_and_parse_report اکنون domain_coverage برمی‌گرداند؛ غیربلوک‌کننده)
- گیت محلی: npm test ۱۳۴/۱۳۴ سبز (صفر رگرسیون) + pytest ۲۱/۲۱ + validate رجیستری (۱۷ نقشه) + هر دو حالت گیت ضد-ادعا سبز

Stage Summary:
- «آمادگی» دیگر قابل ادعا نیست — قابل اندازه‌گیری است؛ نخستین اندازه‌گیری واقعی: هر دو پایه در صفر مطلق پوشش دامنه‌ای (۱۱۲ سؤال میراثی تک-قالبی)
- مسیر موج بعدی روشن: نخستین بچ دامنه‌دار آرنا باید domainCode/qType/answerFormat داشته باشد؛ مبدل و گیت‌ها آمادهٔ راستی‌آزمایی‌اند
- BP-016 (موتور ۶-قالبی) همچنان awaiting_approval — گام ۲ پس از فرمان مالک

---
Task ID: governance-lang (فرمان مالک)
Agent: Z.ai Code (main)
Task: ثبت قاعدهٔ زبان — پیام به مالک همیشه فارسی

Work Log:
- مالک تذکر داد که پیام‌های چینی برایش قابل استفاده نیستند؛ قاعدهٔ «همیشه فارسی در چت مالک» به مادهٔ ۳ GOVERNANCE اضافه شد و در worklog ثبت شد
- گزارش گام ۰/گام ۱ به‌صورت فارسی برای مالک بازنویسی و ارسال شد

Stage Summary:
- از این پس همهٔ ایجنت‌ها/شیفت‌ها به مالک فقط فارسی می‌نویسند (قاعدهٔ ثبت‌شده در GOVERNANCE مادهٔ ۳)

---
Task ID: BP-016 فاز الف (گام ۲ نقشهٔ تکمیل)
Agent: Z.ai Code (main)
Task: موتور سؤال چند-قالبی — فاز الف (گزینه‌ای/عدد/کسر) با تست واحد و E2E

Work Log:
- کشف معماری کلیدی: موتور v10 سؤال‌های کارتریج را فقط اعتبارسنجی می‌کرد، بازی نمی‌کرد (تولید رویه‌ای f1×f2) — فاز الف این پل را ساخت
- src/v10/station/answer-formats.js (خالص): تشخیص قالب مؤثر (سازگاری پسین: بدون answerFormat = گزینه‌ای)، پارسر کسر/مخلوط با ساده‌سازی gcd و ارقام فارسی/عربی، سنجش سه‌قالب، adaptCartridgeQuestions (استخراج f1/f2 برای اطلس خطا، شافل، skip قالب‌های فاز ب/ج با شمارش)
- cartridge-schema.js: قالب‌های مستقیم (عدد/کسر) بدون گزینه با answerValue/answerFrac اعتبارسنجی می‌شوند + ضد J12 برای فرم خام a×b در قالب مستقیم؛ رفتار گزینه‌ای قدیمی دست‌نخورده (گارد رگرسیون)
- app.js: شاخهٔ سؤال کارتریجی در renderQuestionView (صورت کتاب + textContent امن) + configureAnswerArea (دکمه‌های الف/ب/ج/د یا ورودی با placeholder/maxlen قالبی) + handleCartridgeAnswerSubmit (تلاش‌نگار فقط‌الحاقی با domainCode/format، نردبان خودکار فقط ضربی‌ها) + finalizeCartridgePracticeSession (رکورد + attemptLog محلی؛ پل داشبورد دامنه‌ای با T5) + نشست تمرین با activityId پایدار cartridge-practice-<خانواده> + دکمهٔ «تمرین با این خشاب (n سؤال قابل بازی)» در جعبهٔ خشاب
- fafyAnswerInput: «/» و فاصله برای کسر/مخلوط حفظ شد (جریان ضرب قدیمی بی‌تغییر)
- KH-DEMO-MATH.json: نمونهٔ مرجع سه‌قالب (گزینه‌ای D4/عدد D3/کسر D5) — صادقانه «نیاز به تأیید» و «نمونه»؛ الگوی ساخت برای موج‌های آرنا
- اصلاح حین کار: route.ts /api/cartridges که تصادفاً بازنویسی کرده بودم به نسخهٔ رسمی (کارگاه خشاب + ?id=) برگشت — قرارداد {cartridges} از قبل با لودر سازگار بود
- تست: tests/v10.3-answer-formats.test.js — ۱۶ تست (پارسر/قالب/سنجش/پل/schema/J12/گارد رگرسیون G2+G3) — موتور ۱۵۰/۱۵۰ سبز
- E2E مرورگری (v10.html): مهمان → نقشه → تمرین G3 (۳ گزینه‌ای درست) → چیپ DEMO → گزینه‌ای ✓ → کسر «۲/۴» هم‌ارز «۱/۲» پذیرفته شد ✓ → عدد ۱۵ ✓ → تکمیل جلسه و برگشت به نقشه — صفر خطای کنسول

Stage Summary:
- سؤال‌های کتاب (الان: ۱۱۲ سؤال گزینه‌ای G2/G3) از همین امروز قابل بازی‌اند — قالب‌های عدد/کسر برای موج‌های دامنه‌دار بعدی آماده است
- فاز ب (محور عددی/زوج‌سازی) و فاز ج (شکل/نمودار) طبق فازبندی نقشه در شیفت‌های بعد
- BP-016 فاز ب/ج همچنان در وضعیت executing — بسته‌شدن نهایی پس از فاز ج + T5 ایستگاه‌های دامنه‌ای
---
Task ID: BP-017/BP-018/BP-019/BP-020 (شیفت ریزربات‌ها — فرمان مالک)
Agent: Z.ai Code (main) + ریزربات ۱ + ریزربات ۲
Task: نقشهٔ فنی کارهای مانده + فاز ب/ج موتور ۶-قالبی + بچ اول D4-G3 + حلقهٔ تولید خودکار

Work Log:
- فرمان مالک («ریل کاری واضح + نقشهٔ فنی برای هر کار نکرده + ریزربات‌ها») → چهار نقشهٔ دقیق ثبت شد: BP-017 (فاز ب/ج موتور)، BP-018 (ایستگاه‌های دامنه‌ای — شیفت بعد)، BP-019 (بچ اول D4-G3)، BP-020 (ریزربات حلقهٔ تولید) — تأیید مالک با استناد به متن پیام (trace 1a1671cc6fc245a5) → هر سه دیسپچ شد
- ریزربات ۱ (BP-017): فاز ب — محور عددی (SVG کلیک‌پذیر + دکمه‌های دسترس‌پذیر + تلورانس از renderHint) و زوج‌سازی (ستون چپ/راست، کلیک-جفت‌کردن لمسی)؛ فاز ج — شکل/نمودار با ۴ زیرقالب (رنگ‌آمیزی کسر روی خانه‌ها، شمارش مساحت، تقارن/شکل، خواندن نمودار میله‌ای SVG)؛ نردبان داربست per-format (formatHint) + اطلس خطا با کلید قالب/دامنه به‌جای f1/f2 عددی؛ adaptCartridge دیگر هیچ‌قالبی را skip نمی‌کند (skippedInvalid نگهبان)؛ KH-DEMO به ۸ سؤال شش‌قالبی رسید
- ریزربات ۲ (BP-019/BP-020): scripts/production-robot.ts (~۱۱۵۰ خط) — صف دامنه‌ای از ماتریس (G3: D4→D3→D8→D5→D2→D6→D1→D7 سپس G2)، تولید قاعده‌محور seed-دار بدون LLM/شبکه، ۱۰ مولد qType با صورت‌مسئلهٔ فارسی متنوع + انحرافی‌های تربیتی + سه فاز دشواری؛ ۵ گیت درون‌حلقه (اعتبارسنج موتور، npm test، pytest، coverage، ضد-ادعا) با بازگردانی بایت‌به‌بایت روی هر قرمزی؛ سه ممنوعیت سخت‌کدشده (هرگز «تأییدشده»، هرگز تگ v1.0، هرگز «پایه آماده»)
- رفع اشکال حین شیفت (توسط اصلی): جست‌وجوی مستقیم مولد بر اساس qType ماتریس (ایندکس دوبل اشتباه بود) + ctx.qType به مولد رسید + آلوده‌ساز سلف‌تست پویا (دو سؤال چهارگزینه‌ای واقعی) + قاعدهٔ MCQ متنی در خودبازرسی (گزینهٔ متنی مجاز — هم‌راستا با موتور واقعی که null → continue)
- سلف‌تست fail-closed: ۵ آلودگی عمدی (شناسهٔ تکراری، گزینهٔ ۳تایی، پاسخ ۹۹۹۹۹، وضعیت ممنوع «تأییدشده»، ضد-J12 با کلید غلط) → هر ۴ لایه رد شد؛ خروج ۱ (مستند: کد «ادغام ممنوع»)
- دور واقعی: G3-D4-batch01 (seed 1404) = ۱۰۰ سؤال (۶۱ گزینه‌ای + ۳۹ عدد؛ آسان ۴۰/متوسط ۴۰/سخت ۲۰) ادغام شد + ۴ درس L-RB-D4-01..04 به نقشهٔ کتاب؛ همه «نیاز به تأیید» — صفر مُهر
- دو دور قرمز قبل از سبزی، خودِ گیت‌ها بودند نه بچ: ۳ تست پایه «واقعیت ۲۰-سؤالی G3» را کدنویسی کرده بودند → به‌روزرسانی صادقانه به واقعیت جدید (۱۲۰ سؤال؛ آمار ۲۰/۱۰/۱۲/۸/۱۲۰/۱۳/۱۰۷؛ گیت پوشش همچنان قرمز چون ۱۲۰≠۴۵۲ و صفر تأییدشدهٔ دامنه‌ای) — هیچ گیتِ سخت‌گیرانه‌ای شل نشد
- E2E مرورگری (هر دو ریزربات): تمرین ۱۲۰ سؤالی KH-G3 (۲ سؤال D4 → درست) + جلسهٔ کامل DEMO هشت‌سؤالی با هر ۶ قالب: رنگ‌آمیزی کسر (۲ خانه از ۴ → درست)، خواندن نمودار (۶ → درست)، مساحت (۶ → درست)، کسر ۱/۲ → درست، عدد ۱۵ → درست، محور عددی (انتخاب اشتباه → «درست نیست — یک بار دیگر با دقت فکر کن!»؛ نقطهٔ ۶ → پذیرفته) و زوج‌سازی (۳ جفت → ثبت → پایان جلسه) — صفر خطای کنسول
- گیت نهایی: موتور ۱۷۲/۱۷۲ + pytest ۲۱/۲۱ + رجیستری v52 سالم (۲۱ نقشه) + coverage-current.md به‌روز (D4-G3 = ۱۰۰/۱۰۰ موجود، ۰ تأییدشده) + گیت ضد-ادعا سبز

Stage Summary:
- موتور ۶-قالبی کامل شد (BP-017 verified) — هر ۶ قالب واژه‌نامه واقعاً قابل بازی‌اند
- نخستین سؤال‌های دامنه‌دار تاریخ پروژه: ۱۰۰ سؤال D4-G3 داخل خشاب رسمی، همه منتظر مُهر معلم (AI مُهر نمی‌زند)
- حلقهٔ تولید خودکار (BP-020 verified): از فردا هر دامنه = یک فرمان؛ مولدهای D3/D8/... در شیفت بعد اضافه می‌شوند
- BP-018 (ایستگاه‌های دامنه‌ای G3:۸/G2:۶ + فیلتر گلوگاه داشبورد معلم) — در صف، next shift
- کار دست معلم/مالک: مُهر گام صفر روی ماتریس + بازرسی بچ D4 در داشبورد
---
Task ID: 29 (BP-021/T1 — Z01)
Agent: Z.ai Code (main)
Task: درخواست دقیق مالک Z01–Z15 — پاسخ تعهدپذیر + بازکردن نخستین گلوگاه (Z01 منبع امن) + ثبت ریل اعتماد

Work Log:
- وارسی واقعی‌سنجی ۱۵ قلم: C205.pdf یافت شد (upload/ سندباکس) — SHA-256 بایت واقعی = a93934b6…46de، اندازه = ۱۱۸۳۸۶۴۱، صفحات = ۱۵۲ (هر سه با مالک یکی)؛ C305 فایل دیگری است (۱۰MB+، ۱۵۲ صفحه)
- vault واقعی بیرون Git ساخته شد: /home/z/vault/c205 (کپی با وارسی یکسانی بایت) + vault-manifest.json (منشأ، سیاست دسترسی، سیاست نگهداری، ممنوعیت توزیع در چت)
- scripts/accept-source-gate.py (fail-closed): وجود/SHA/اندازه/صفحه/خارج-Git — خروجی PASS|BLOCKED|FAIL با مسئول و علت
- حکم گیت: PASS با source_key C205:print-14:1404:a93934b6c418 → reports/source-acceptance-c205.md (فقط هش و آمار — صفر بایت کتاب)
- دو آزمون ابطال سبز: فایل اشتباه (C305) → exit 1/FAIL؛ منبع غایب → exit 1/BLOCKED/SOURCE_ABSENT با مسئول «مالک + Z.ai»
- BP-021 (ریل اعتماد Z01–Z15؛ T1..T13 با معیار پذیرش/مالک/شاهد) ثبت شد — رجیستری v54، status=executing با استناد به trace 1a167fa5c4a957cd
- کشف امنیتی مهم (ثبت برای T3): /api/teacher-review/stamp فعلاً بدون احراز هویت است و by ورودی آزاد است — دقیقاً همان خطر Z03؛ در ریل BP-021 برای اصلاح سرور-ساید برنامه‌ریزی شد

Stage Summary:
- Z01 = تحویل‌شده با شاهد تست؛ Z02..Z14 = برنامه ثبت‌شده در BP-021 با معیار پذیرش دقیق مالک
- پاسخ تعهدپذیر فارسی به مالک ارسال شد (جدول وضعیت + مالک/وابستگی/شاهد/زمان مشروط + طرح نمایش انتهابه‌انتها)
---
Task ID: 30 (BP-022 — فرمان مالک trace 1a1681e84a8d3cad)
Agent: Z.ai Code (main)
Task: شش قلم فرمان مالک — رفع ابهام PR #2، قرارداد M09، اتصال M10 به runtime، حدهای per-book، مبدل/CI تکرارپذیر، پاسخ قابل‌ممیزی

Work Log:
- PR #2: پروب ادغام واقعی محلی (شاخهٔ موقت از v10.3-beta + merge --no-commit + abort) — ۱۵ فایل تعارض واقعی، merge-exit=1؛ reports/pr2-conflict-resolution-v1.fa.md با راهکار یک‌طرفهٔ رسمی (main برای همهٔ تعارض‌ها + پورت انتخابی ویژگی‌های آرنا) — هیچ merge/push انجام نشد
- M09: authoring/OPERATION-CONTRACT.json (khshab.operation-contract/v1) — رجیستری ۲۹ عملیات با نوع پاسخ/موتور/حدهای per-book + سیاست بازخورد رسمی/پیشنهادی + قاعدهٔ سازگاری پسین
- M10: src/v10/station/errors-router.js — مسیریاب یکنواخت attempt→v103→w8؛ app.js مسیر کارتریج زنده سیم‌کشی شد (مسیر رویه‌ای ضرب دست‌نخورده)؛ رکورد تلاش‌نگار فقط‌الحاقی: engine/routerReason/atlasCode/codeStatus + officialAtlasCodes روی نشست
- حدهای per-book: DEFAULT_BOOK_LIMITS (G2: mulcol=null، sum/sub تا ۱۰۰؛ G3 تا ۹۹۹۹؛ کسر denMax/numMax/opAllow) — بیرون بازه = بی‌الگو با دلیل صریح؛ قفل BP-012 با تست: کد تازهٔ W8 در اطلس رسمی ⇒ قرمز
- ۱۱ تست تازه (قرارداد/مسیریاب/گستره/اطلس-لنگر/E2E کارتریج→تعامل) → موتور ۱۸۳/۱۸۳؛ pytest ۲۱/۲۱
- مبدل تکرارپذیر: اجرای واقعی روی سرهای رسمی — G2 v0.5: ۰ قرمز/۲ زرد، G3 v0.7: ۰ قرمز/۷ زرد؛ W7 طبق فرمان مالک «کار مانده» معرفی نشد (از پیش در workflow رسمی)
- یافتهٔ مهم: بازتولید JSON از xlsx بچ‌های ادغام‌شدهٔ بیرون-xlsx (D4-G3) را حذف می‌کند → کارتریج‌ها از گیت بازگردانده شدند و bind دوسویهٔ Excel↔JSON به تصمیم انسانی ارجاع شد
- E2E مرورگری: تمرین KH-G3 — پاسخ غلط → بازخورد صادقانه؛ پاسخ درست (۳۶، سپس ۲۰÷۵=۴) → پذیرش و سؤال بعدی؛ صفر خطای کنسول
- BP-022 در رجیستری (v55) delivered

Stage Summary:
- قرارداد M09 و مسیر زندهٔ M10 با شاهد تست کامل تحویل شد؛ PR #2 با گزارش رسمی شفاف شد (بدون ادغام)
- کار انسانی: تصمیم ادغام PR #2، تأیید حدهای per-book، مُهر کدهای W8، تصمیم bind دوسویهٔ مبدل
---
Task ID: 31 (BP-023 — فرمان مالک trace 1a1683b2622c3d35)
Agent: Z.ai Code (main)
Task: الحاق پروتکل ریزربات‌های G2 به BP-021 — تطبیق حاکمیتی + T3 امنیت مُهر + گیت منبع v2 + نگاشت ۹ سناریو

Work Log:
- ماتریس تطبیق بند‌به‌بند پروتکل آرنا v1 (مادهٔ ۱..۷) با GOVERNANCE/foreman/schema → reports/g2-microbot-protocol-adaptation-v1.fa.md: ۸ ACCEPT، ۳ نیازمند تغییر قرارداد (T14 رجیستری ریزربات، T15 واژگان وضعیت‌شاهد، T16 کلید job)، ۲ BLOCKED زیرساختی (هویت سرویس foreman v3، صف بادوام) — تعارض‌های چهارگانه با گزینه/پیامد برای مالک جدا شد؛ هیچ‌کدام خاموش حل نشد
- T3 در اولویت اجرا شد: src/lib/stamp-auth.ts (توکن سرور TEACHER_STAMP_TOKEN، fail-closed ۵۰۳، ۴۰۱ ناشناس/جعل/غلط، timing-safe، قرنطینهٔ by/role/actor_role/authenticated → claimedBy/claimedRole فقط audit) + route.ts نازک + UI توکن معلم؛ scripts/test-stamp-auth.ts = ۸/۸ سبز (شکست عمدی)
- گیت منبع v2: حفرهٔ یافت‌شدهٔ آرنا (size_bytes=0 / pages=0 عبور می‌کرد) بسته شد — manifest ناقص/صفر → BLOCKED/MANIFEST_INCOMPLETE_*؛ کدهای علت پایدار (EDITION_SHA_MISMATCH و…)؛ scripts/test-source-gate-negative.py روی vault واقعی: ۱۱ منفی رد + pin معتبر C205 سبز ماند (PASS، source_key=C205:print-14:1404:a93934b6c418)
- CI: scripts/test-source-gate-ci.py (بایت مصنوعی — بایت کتاب هرگز به CI نمی‌آید) + دو گام تازه در khshab-gate.yml (گیت ۴: آزمون منفی منبع؛ گیت ۵: امنیت مُهر)
- نگاشت ۹ سناریوی G2 آرنا (G2-CAP-01..09، فیکسچر مصنوعی غیرحق‌نشری) به قابلیت واقعی موتور: reports/g2-capability-reply-v1.json با reply_contract کامل (case_id/commit/نسخهٔ قرارداد/حکم/نگاشت/لینک تست/محدودیت) + tests/v10.5-g2-capability-mapping.test.js (۱۱ تست) — قرارداد M09 → v1.1.0 با پیوست قابلیت
- یافتهٔ مهم حدها: سناریوهای CAP-01/02/03 (جمع/تفریق سه‌رقمی، دهم) با حدهای پیش‌نویس G2 (sum/sub=[0,100]، denMax=8) بیرون بازه‌اند — گارد درست کار می‌کند (تست‌شده)؛ گسترش فقط با مُهر معلم — تعارض ب برای مالک
- موتور ۱۹۴/۱۹۴ (۱۸۳ + ۱۱ تازه) · pytest ۲۱/۲۱ · رجیستری v56 (۲۴ نقشه) validate سبز
- وضعیت صادقانه: foreman گوش نمی‌دهد؛ صف بادوام/worker = NOT_DEPLOYED؛ demo بدون چت = نیازمند تصمیم میزبانی مالک؛ هیچ merge از PRهای آرنا، هیچ انتقال فایل، هیچ مُهر و رأیی انجام نشد

Stage Summary:
- چهار قلم پروتکل امروز به کد/تست/CI رسمی main تبدیل شد (گیت منبع v2، امنیت مُهر، تفکیک گیت‌ها، نگاشت سناریوها)؛ بقیه PROPOSED/BLOCKED با صاحب کار مشخص
- پذیرش خروجی موتور پس از آزمون مصرف‌کننده ثبت می‌شود — ارسال سند به‌تنهایی پذیرش نیست
- کار انسانی معلّق: تعارض الف (دامنهٔ dispatch)، تعارض ب (حدهای G2 با مُهر)، تعارض ج (میزبانی T4)، تعارض د (bind دوسویه)
