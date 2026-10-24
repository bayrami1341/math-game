# مسیر GitHubمحورِ سه‌بخشی محتوا: آشیل → آرنا → Z.ai

**نسخه ۱، ۲۰۲۶-۱۰-۲۴ | وضعیت: نقشهٔ فنی/قرارداد پیشنهادی، نه ادعای اینکه تحویل تولیدی یا ادغام انجام شده است.** مرجع کد و ردپای تحویل، مخزن خصوصی `bayrami1341/math-game` است؛ وضعیت خصوصی مخزن با `gh repo view ... --json isPrivate` در همین نوبت بررسی شد. GitHub باید **کنترل‌پلین و رجیستری نسخه‌های محتوا** باشد؛ خزانهٔ موقتِ اجرای ابزار برای محاسبه/نگهداری مجاز است اما خروجیِ مورد استفادهٔ برنامه نباید فقط آنجا بماند. PDF و تصویر کتابِ دارای حق‌نشر همچنان نباید وارد Git شوند. خصوصی‌بودن مخزن به‌تنهایی مجوز حقوقی یا تضمین امنیتِ داده نیست.

## ۱. وضعیت واقعی همین لحظه، پیش از ترسیم مسیر

- رسمیِ فعلی G2 v0.5 در `origin/v10.3-beta:public/math-game/authoring/khshab-G2-MATH_v0.5.xlsx` با SHA `f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656` است. نامزد آرنا `authoring/khshab-G2-MATH_v1.2_page-goals-draft.xlsx` با SHA `18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618` **روی همین شاخه و در GitHub موجود** است، ولی نامزد زرد/ناقص است، نه خروجیِ تأییدشدهٔ تازهٔ آشیل.
- PR آشیل **#2** در لحظهٔ بررسی `OPEN`, head=`arena/0eb22280-math-game` در SHA `709493c9e469e3511f152123e5de489f0321e01e` و نسبت به `v10.3-beta` دارای تعارض است. در فهرست فایل‌های آن fixtureهای `authoring/agent/fixtures/khshab-G2-MATH_v0.5.xlsx` و `observation_C205.json` هست؛ **fixture یا PASS ضدسبز را رسیدِ تأیید محتوای تمام G2/خشاب جدید نخوانیم**. PR #1 از شاخهٔ آشیل به شاخهٔ آرنا باز است، اما ادغام نشده؛ PR #3 آرنا به `v10.3-beta` نیز باز و متعارض است. شماره/وضعیت PRها هر بار در GitHub دوباره سنجیده شود؛ هیچ شاخه‌ای به صرف PR باز «روی هسته مستقر» نیست.
- [`content_library_intake.py`](tools/content_library_intake.py) هم‌اکنون XLSX و رسید **محلی** می‌گیرد، بایت را بیرون Git آرشیو می‌کند و index خصوصی می‌نویسد. [`section2_pipeline_v1.py`](tools/section2_pipeline_v1.py) index→گیت مفهوم→score را فقط با fixture ساختگی متصل می‌کند. **adapter خواندن از commit پین‌شدهٔ GitHub، انتشار sidecar به GitHub و consumer receipt واقعی Z.ai هنوز پیاده/آزموده نشده‌اند**. این سند جای آن کد یا قرارداد پذیرفته‌شده را نمی‌گیرد.

## ۲. نمودار دقیق جریان، با snapshotهای غیرقابل‌اشتباه

```text
GitHub/شاخه و PR آشیل (نه fixture و نه فایل موقت)
   ورودی مجاز: approved-workbook.xlsx + receipt/manifest نسخه‌دار + SHA بایت
   منشأ PDF/تصویر خصوصی: فقط شناسه/هش/نشانی مجاز، نه خود رسانه در Git
      │  producer_commit + path + workbook_sha + edition + scope حکم
      ▼
آرنا روی شاخهٔ ثابت خود: دریافت فقط-خواندنیِ بایتِ commit پین‌شده
   verify: repo/ref/commit/path + sha256 + receipt trust + ۷ شیت/ستون + UID/Q→L
   archive: نسخهٔ بایت‌به‌بایت در vault اجرای مجاز بیرون Git؛ GitHub همچنان منشأ ثبت‌شده
   guide/crosswalk: هدف معتبر همان چاپ یا UNKNOWN؛ claim مستقل صفحه/Q
   scope → six-factor/null → breadth×depth → candidate/unsupported
      │  assessment_commit + input producer_commit/workbook_sha + hashes تمام sidecarها
      ▼
GitHub/PR آرنا: manifest + رجیستری هدف/پیوند + scope/score/coverage + candidate
   وضعیت: PROPOSED_YELLOW | HOLD | BLOCKED؛ نه مُهر، نه خروجی runtime
      │  assessment_commit + manifest_sha + انتخاب مورد مصرف
      ▼
Z.ai: fetch فقط-خواندنیِ commit پین‌شدهٔ آرنا + ورودی خام مجاز و هم‌هش
   check schema/version/hash/approval scope, converter, capability, render/feedback/tests
      │  consumer_receipt: consumer_commit+engine_version+input_commit/hash+PASS/BLOCKED
      ▼
GitHub/PR یا مسیر رسید نسخه‌دار Z.ai → بازبینی آرنا/مالک؛ نشر فقط پس از گیت مستقل
```

**اصل امنیتی:** HEAD زندهٔ شاخه یا URL فایل به‌تنهایی ورودی بازپخش‌پذیر نیست؛ مصرف‌کننده باید commit SHA کامل، مسیر دقیق، SHA-256 بایت فایل و نسخهٔ schema را همزمان پین کند. SHA فایل ≠ SHA commit. branch protection/بازبینی PR/حقوق/احراز نقش باید در مخزنِ مسئولان برقرار باشد؛ وجود این سند آن تنظیمات را فعال نکرده است.

## ۳. چیدمان پیشنهادی فایل‌ها در GitHub، بدون برهم‌زدن اکسل رسمی

این مسیرها **قرارداد پیشنهادی و هنوز ساخته‌نشده** هستند، نه ادعای وجود فایل واقعی. قالب هفت‌شیتی برنامه و سر رسمی دست‌نخورده می‌ماند؛ stageها با manifest جانبی و مسیر content-addressed جدا می‌شوند:

```text
authoring/content-exchange/
  incoming/G2/C205/<edition-id>/<workbook-sha256>/
    approved-workbook.xlsx              # فقط اگر حق ذخیرهٔ بایتِ XLSX در همین repo احراز شود
    achilles-receipt.json               # source_commit, book_sha, edition, workbook_sha, scope, schema
    evidence-summary.json               # ارجاع صفحه/شاهد، بدون PDF/crop/تصویر/توکن
  assessed/G2/C205/<edition-id>/<workbook-sha256>/<assessment-sha256>/
    manifest.json                       # raw git commit/path/hash + all input/output hashes + states
    objectives.json                     # خلاصهٔ بازنویسی‌شده و citation، نه تکثیر راهنما
    concept-scope-summary.json          # UID/status/reason؛ متن/شکل چاپی تکرار نشود
    content-links.json                  # UID↔objective, alignment, reviewer/evidence references
    six-factor-scorecards.json          # null/bounds/rationale + SHA منبع؛ نه کلید چاپیِ خام
    breadth-depth.json                  # هدف×گونه×بازنمایی، خلأ و دلیل
    experience-candidates.json          # UID/مکانیک/وضعیت قابلیت، نه کپیِ لازم‌نبودنیِ کتاب
    review-queue.json                   # اختلاف‌های محدود، بدون رأیِ خودکار مالک
  consumer-receipts/G2/C205/<edition-id>/<assessment-sha256>/
    zai-contract-result.json            # اگر Z.ai در مجرای مجاز همین repo تحویل دهد
```

برای جلوگیری از رشد تصاعدی مخزن، هر بایت خامِ مجاز **فقط یک بار** در `incoming` ثبت می‌شود و خروجی‌های آرنا با UID و هش به همان بایت اشاره می‌کنند، نه کپیِ دوبارهٔ PDF یا همهٔ stemها. فایل‌های raw فعلیِ legacy سر جای خود می‌مانند؛ migration تنها با diff و نسخهٔ صریح. Git LFS یا GitHub Actions artifact راه‌حل حقوق نشر نیستند؛ artifactهای موقت CI نیز آرشیو دائمی/تنها منبع حقیقت محسوب نمی‌شوند. اگر حقِ نگهداری XLSX کامل در GitHub **احراز نشد**، صادقانه `BLOCKED_FOR_GITHUB_RAW_BYTES` و تصمیم مجازِ صاحب‌اختیار لازم است؛ می‌توان metadata/هش/ارجاع به vault کنترل‌شده را در GitHub نگه داشت، اما **این جایگزین تحقق درخواست «بایت خام در GitHub» نیست** و نباید آن را انجام‌شده نامید.

## ۴. تحویل از آشیل به آرنا: پین منبع، نه اعتماد به نام فایل

۱. آشیل در شاخه/PR خودش، workbook واقعاً مصوب با شیت‌های موجود و رسید محدوده‌دار را قرار می‌دهد؛ fixture و نامزد زرد جدا بمانند. حداقل receipt: `schema_version`, `producer=ACHILLES`, `book_id`, `edition_id`, `book_source_sha256`, `workbook_sha256`, `git_commit`, `repo_path`, `approval_scope`, `approval_status`, `reviewer/decision_ref`, `evidence_manifest_sha`. نام `approved` یا `producer` به‌تنهایی امضای رمزنگارانه/حکم معلم نیست؛ GitHub review/امضای معتبر یا کانال تأییدِ حاکمیتی باید جدا تعریف شود.
۲. آرنا **بدون تغییر شاخهٔ این نشست**، از GitHub commit SHA را با `gh`/`git fetch` پیدا و بایت را از `git show <pinned-commit>:<path>` به محیط مجازِ بیرون repo منتقل می‌کند؛ نه `git pull`/merge خودکار PR آشیل و نه مصرف `HEAD` متغیر. پیش از ingest، SHA واقعی بایت، رسید، چاپ/شناسه، ۷ شیت/سرستون، شناسه‌های یکتا و Q→L بررسی می‌شود. `MISSING/DRIFT/CONFLICT` یعنی `HOLD_ACHILLES_INPUT` و درخواست اصلاح موردی از آشیل، نه حدس یا ارتقای زرد.
۳. archive محلیِ فعلی برای پردازش و کنترل exact-byte همچنان مجاز است، **اما** index/lineage/گزارش نهایی باید به `producer_commit+workbook_sha` برگردد و پس از گیت در GitHubِ شاخهٔ آرنا ثبت شود. تغییر یک سلول یا رسید = SHA و assessment تازه، نه overwrite همان مسیر.

## ۵. تحویل از آرنا به GitHub و سپس Z.ai

- آرنا محاسبه را از خامِ پین‌شده و منبعِ راهنمای هم‌چاپ/هم‌ارزی مرورشده انجام می‌دهد؛ چنانچه هدف نامعلوم یا انحراف بحرانی باشد، sidecar **`UNKNOWN_REVIEW/BLOCK_CRITICAL_SCOPE_DRIFT`** همراه علت را در PR نگه می‌دارد، نه کاندید آمادهٔ اجرا. امتیاز v1 دو‌عاملی intake نمرهٔ نهایی نیست؛ v2 فقط با شاهد و گیت محدوده. مفاهیم C55 چاپ ۱۳۹۱ بدون crosswalk برای C205 چاپ ۱۴۰۴ قطعی نیستند.
- خروجی در **شاخهٔ ثابت آرنا** commit/push و به‌عنوان PR/بستهٔ versioned review می‌شود؛ هیچ `git push` به شاخهٔ آشیل/Z.ai یا سر رسمی، تغییر مُهر، انتقال غیرمجاز workbook/PDF، یا merge خودکار انجام نمی‌شود. `manifest.json` باید به `producer_commit`, `workbook_sha`, `guide_sha`, `profile_sha/revision`, `claims_sha`, `links_sha`, `rubric_version`, `coverage_sha`, `assessment_sha`, `pipeline_commit/version`, `content_status`, `release=NOT_GRANTED` وصل باشد. اگر مواد خام در شاخهٔ آشیل هنوز فقط PR بازند، وضعیت ارزیابی `UPSTREAM_UNMERGED_CANDIDATE` است تا مبنای پذیرفته‌شدهٔ مصرف روشن شود.
- Z.ai بسته را با **assessment_commit ثابت**، manifest و raw همان SHA می‌خواند؛ کنترل checksum/نسخه و قابلیت موتور، تست درست/غلط/مرزی، فارسی/RTL، شناسه/کلید/مبدل و حقوق/احراز رأی با اوست. نتیجهٔ مصرف `SUPPORTED[_WITH_LIMITS]/NEEDS_IMPLEMENTATION/NOT_SUPPORTED` و PASS/BLOCKED با engine/schema/commit و SHAهای ورودی در GitHub برمی‌گردد؛ تا receipt واقعی و تست مصرف/گیت انتشار نباشد، «به بازی رفت» گفته نمی‌شود. پاسخ در چت/متن آزاد بدون artifactِ نسخه‌دار برای ACK کافی نیست؛ `[ARENA-ACK]` فقط پس از بررسی واقعی در worklog.

## ۶. CI/بازبینی PR: گیت‌ها و تست‌های منفیِ لازم

| گیت | آزمون رد عمدی و اثر |
|---|---|
| ورودی و حقوق | XLSX با SHA جعلی، فایل از مسیر fixture، edition جابه‌جا، producer/receipt بی‌پشتوانه، PDF/crop/secret در diff یا حق ذخیرهٔ raw نامعلوم ⇒ BLOCK و بدون raw جدید در شاخهٔ آرنا. |
| تغییرات رسمی | compare بایتی/سلولی/سبک/مُهر با پایه؛ هیچ تغییر silent در `public/.../v0.5.xlsx`, `OFFICIAL-HEADS.json`, S1.M, Q.P، شناسه/کلید؛ PR و CI فنی رأی آموزشی نیستند. |
| گیت آموزشی | Q بی‌لنگر، هدف چاپ نامعلوم، صفحهٔ حذف‌شده، main drift، عدد خارج دامنه، فرض «بنر=هدف»، `null→0`، شاهد جعلی/نامرور ⇒ HOLD/BLOCK؛ مرورِ فرعی مانع درجهٔ بحران main را نمی‌پوشاند. |
| تکرارپذیری | همان `(producer commit, workbook/guide/profile/claims/links/rubric/coverage hashes)` همان assessment؛ هر تغییر ورودی وابسته‌ها `STALE`، assessment تازه، هیچ بازنویسی بی‌ردپا. |
| مصرف Z.ai | manifest تغییرکرده، نسخهٔ API ناشناخته، مکانیک unsupported، آزمون نمایش/RTL یا کلید ناموفق، رأی بی‌احراز، نبود consumer receipt ⇒ `ENGINE_BLOCKED/NOT_GRANTED`، نه بازی قابل انتشار. |

CI عمومی روی PR فقط می‌تواند قالب/هشِ مواد مجاز و آزمون‌های غیررسانه‌ای را بررسی کند؛ ممیزی پیکسل و منبع خصوصی باید در محیط دسترسی‌دار مجاز اجرا و **نتیجهٔ redacted، قابل‌ردیابی با SHA** را به GitHub برگرداند. اگر runner اجازهٔ دریافت مادهٔ حق‌نشری ندارد، وضعیت `BLOCKED_EVIDENCE_ACCESS`، نه PASS ساختگی.

## ۷. اولویت اجرا بدون انتظار بی‌دلیل

**گام مستقل آرنا همین حالا:** adapter فقط‌خواندنیِ `producer_commit:path→private exact-byte intake` و تست جعل/ref drift؛ schema manifest/sidecarِ بالا و test fixture مصنوعی؛ گیت PR برای ممنوعیت PDF/تصویر/secret؛ برنامهٔ خروجی redacted. **گام وابستهٔ آشیل:** معرفی بایت خامِ واقعاً تأییدشده در GitHub با receipt/حقوق/چاپ، جدا از fixture و نامزد v1.2. **گام وابستهٔ Z.ai:** پذیرش قرارداد مصرف و manifest قابلیت با نسخه و آزمون E2E. هیچ‌کدام از سه گام به «همهٔ فایل‌ها را مالک دستی دوباره آپلود کند» یا سکوت مالک به‌عنوان رأی وابسته نیست.

**معیار پایان مسیر GitHubمحور:** بتوان برای یک UID از بازی/تمرین پیشنهادی به assessment commit آرنا، raw commit و SHA آشیل، منبع هدف/چاپ، وضعیت گیت و سپس رسید مصرف Z.ai برگشت؛ با حذف یا تعویض هر منبع، گیت شکست قابل مشاهده بدهد. حتی پس از این آزمون، نشر/نهایی‌بودن تنها با تصمیم صاحب‌اختیار است. این نسخه صرفاً نقشهٔ پیاده‌سازی است؛ تا رسیدِ واقعی و تستِ همان SHA نیاید، ادعای استقرار نمی‌کند.
