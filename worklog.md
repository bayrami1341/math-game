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
