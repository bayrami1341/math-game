# ریل نرم‌افزاری ریزربات‌های G2 — معماری پیشنهادی برای گفت‌وگو با Z.ai

تاریخ: ۲۰۲۶-۱۰-۲۳ · وضعیت: **RFC خط محتوا، نه طراحی مصوب/پیاده‌سازی یا استقرار Z.ai** · دامنهٔ پایلوت: C205/G2. بعد از آزمون، قرارداد قابل تعمیم به کتاب‌های دیگر است؛ هیچ ادعای پوشش آن‌ها اکنون نداریم. نقشهٔ گره‌ها: `authoring/G2-MICROBOT-FACTORY-PLAN-v1.fa.md`؛ درخواست پاسخ فنی از Z.ai: `authoring/G2-ZAI-TECHNICAL-HANDOFF-REQUEST-v1.fa.md`. هدف: یک ریل مشترک برای جریان *داده و شواهد*، نه گفت‌وگوی زندهٔ عامل‌ها.

## ۱. پاسخ کوتاه به پرسش مالک

**بله؛ سه لایه لازم است، نه فقط مجموعه‌ای از promptها:** (الف) صفحهٔ کنترل: تعریف ریزربات، DAG، صف/زمان‌بند، بودجه و وضعیت؛ (ب) صفحهٔ داده: مصنوعات نسخه‌دار و vault خصوصی کتاب؛ (پ) صفحهٔ اعتماد: گیت منبع، صحت/پوشش، مجوزهای محدود و رأی انسانی جداگانه. ریزربات یک `worker function` کوچکِ نسخه‌دار است که از کارگاه‌بان job می‌گیرد، خروجیِ محدود می‌دهد و گیت مستقل آن را می‌سنجد. برخی ریزربات‌ها اسکریپت قطعی‌اند؛ مدل هوش مصنوعی فقط جایی لازم است که تشخیص/پیشنهاد نیاز دارد، نه برای شمارش SHA یا حل سادهٔ مستقل.

```text
   مالک: سیاست / رأی دامنه‌دار / فریز / مجوز انتشار
                            │ (خارج از صفِ رأی‌سازِ ربات)
     رجیستری bot/version/owner/capability + policy engine
                            │
  event ledger ← queue/lease/scheduler/foreman → monitor/alert/cost
                  │          │            │
             workerهای آرنا  آشیل/Z.ai    موتور/مبدل Z.ai
                  └──────────┬─────────────┘
           immutable metadata/artifact SHA + vault مجاز PDF/crop
                            │
             evidence gate → pedagogy gate → runtime gate
                            │
                   فقط بستهٔ تصمیم مالک
```

**مالکیت:** آرنا قراردادهای محتوا، گیت آموزشی و fixture می‌دهد؛ Z.ai معماری، پیاده‌سازی و استقرار queue/worker/vault/identity/runtime و حل ادغام را بر عهده دارد؛ مالک رأی آموزشی و انتشار را به ربات واگذار نمی‌کند. قبل از توافق بر API جدید، مدل‌های موجود `authoring/agent` در شاخهٔ آشیل و سرویس foreman رسمی باید ارزیابی شوند؛ ساخت سامانهٔ موازیِ ناسازگار ممنوع. ACK هماهنگی فقط `[ARENA-ACK]` در worklog پس از پذیرش واقعی؛ چت زندهٔ بین عامل‌ها وجود ندارد.

## ۲. هفت جزء نرم‌افزاری لازم، با مرز مسئولیت و آزمون

| جزء/مالک اجرایی | قرارداد و کار | شکست عمدیِ لازم قبل از ادعای استقرار |
|---|---|---|
| 1. **رجیستری** / Z.ai + قرارداد آرنا | `bot_id/version/owner/input_schema/output_schema/allowed_resources/max_cost/timeout/dependencies`، نسخهٔ مدل/پرامپت برای عامل‌های AI؛ review و مهاجرت نسخه | bot ناشناخته/schema ناسازگار/نسخهٔ prompt عوض‌شده ⇒ dispatch ممنوع. نام `owner=Arena` به معنی credential آرنا نیست. |
| 2. **دفتر job و event** / Z.ai | DB بادوام، `work_id` یکتا، `input_sha/output_sha`, `state/reason`, checkpoint و append-only event؛ job-result immutable با checksum | restart، تکرار پیام/lease expired ⇒ نتیجهٔ مؤثر فقط یک‌بار ثبت؛ هیچ overwrite خاموش. «exactly once execution» وعده نده؛ **at-least-once + idempotent effects** آزموده شود. |
| 3. **scheduler/queue/worker** / Z.ai | DAG با dependency-scoped dispatch؛ lease و renewal/timeout، retry با backoff و سقف، dead-letter، concurrency/cost cap، pause/freeze، اولویت موجی P0/P1 و انصاف برای بقیه | kill worker، قطع شبکه، تمام‌شدن بودجه، freeze و source-drift ⇒ job گم نشود، انتشار/مرحلهٔ وابسته آغاز نشود، dashboard دلیل را نشان دهد. |
| 4. **انبار داده و vault** / Z.ai | محتوای خصوصی C205 با ACL/TTL/encryption خارج Git؛ artifact مجازِ غیرحق‌نشری با SHA و lineage؛ URI امنِ بازبین، log redaction و retention | PDF/برش در Git/PR/CI artifact عمومی/لاگ نباشد؛ دسترسی worker غیرمجاز یا URL منقضی رد شود؛ hash واقعی بایت نه صرفاً رشتهٔ manifest. |
| 5. **محیط اجرای bot** / Z.ai، منطق محتوا آرنا | runner ایزوله و محدود به هر bot با قرارداد `validate_input→run→validate_output`؛ سهمیه CPU/model/token، شبکه و filesystem محدود؛ deterministic tasks بدون LLM | bot نتواند فایل رسمی/secret/vault نامرتبط را بنویسد؛ خطای مدل به `BLOCKED/UNOBSERVABLE` برود نه تولید جواب قطعی. |
| 6. **گیت مستقل/مجوز** / مشترک، اجرای امن Z.ai | چهار وضعیت **جدا**: `source/evidence`, `pedagogy/breadth-depth`, `converter/runtime`, `human-release`; reviewer مستقل برای خطاهای پاسخ‌ساز؛ identity و policy سمت سرور | `authenticated=True` یا role-string ورودی حکم معلم نیست؛ ادعای QA/CI یا بایت SHA درست نتواند تصویر/سؤال را سبز کند؛ رأی scope/SHAدار باید از سرویس انسانی مجاز بیاید. |
| 7. **داشبورد/alert/API** / Z.ai | آخرین heartbeat، SLA/SLO پیشنهادی، تعداد و سن jobها، `blocked_by/owner/next_action`, lineage و هزینه؛ API خواندنی برای آرنا و view محدود مالک | توقف worker/هزینه/انباشت صف هشدار دهد؛ گزارش تعداد Q به‌جای پوشش صفحه→گونه→بازی قابل اجرا، موفقیت کاذب نسازد. |

**انتخاب فناوری هنوز قطعی نیست:** برای پایلوت تک‌worker می‌توان DB/صف کوچکِ بادوام و vault محلی امن را آزمود؛ برای چند worker نیاز به claim اتمی job، transaction/outbox، migration و نگهداری عملیاتی است. Z.ai می‌تواند foreman موجود را توسعه دهد یا مؤلفهٔ معادل معرفی کند؛ انتخاب Postgres/Redis/cloud بدون شناخت هسته و ظرفیت او تصویب نمی‌شود. GitHub Actions گیتِ push/PR است، نه جای صف ۲۴ساعته.

## ۳. روش نوشتن یک ریزربات و «نقش‌دادن» به آن

**یک bot = یک ورودی مشخص + یک مسئولیت محدود + خروجی نسخه‌دار + validator مستقل**؛ نه prompt آزاد با حق نوشتن همه‌جا. نقش دو چیز جداست: `functional_role` در رجیستری (مثلاً شاهدخوان M02) و **هویت اجرایی واقعی** (service account با policy از سمت سرور). مقدار متنیِ `owner`, `role` یا `authenticated` که خود bot فرستاده اختیار نمی‌سازد.

نمونهٔ **شِمای پیشنهادی، نه API موجود** (M14، فقط موجودی بدون PDF):

```yaml
bot_id: M14
version: 1
functional_role: metadata-inventory
owner_lane: Arena
input_schema: G2InputSnapshot.v1
output_schema: ProvisionalPageInventory.v1
depends_on: [M00]
allowed_reads: [candidate_sha_pinned, queue_metadata]
allowed_writes: [provisional_artifact_store]
forbidden_actions: [teacher_verdict, seal, official_head, git_merge, publish]
max_attempts: 3
on_source_drift: BLOCKED_INPUT_DRIFT
output_gate: inventory_sha_and_144_page_count
```

رفتار تابعِ worker (نمونهٔ مفهومی، نه کد استقرار):

```python
def run_M14(job, context):
    context.policy.require(job.bot_id == "M14", action="read_candidate_metadata")
    context.hashes.assert_pinned(job.input_sha)
    pages = read_only_inventory(context.candidate)  # deterministic; no AI needed
    return ProvisionalArtifact(pages=pages, source_status="NOT_BOOK_VERIFIED",
                               q_promotions=0, input_sha=job.input_sha)
# independent gate checks schema, SHA, exactly 144 page rows and q_promotions == 0
```

**قرارداد job** باید `book=C205`, `edition/source_sha` (با flag تأیید واقعی بایت)، `wave/page_or_skill_scope`, `bot_id/version`, `input_sha`, `depends_on_work_ids`, `idempotency_key`, `deadline/budget`, `artifact_policy` را داشته باشد. کلید تولیدی پس از رسیدن منبع از کتاب+چاپ/SHA بایتِ تأییدشده+موج/صفحه/مهارت+نسخهٔ pipeline+نوع کار مشتق شود؛ شناسهٔ ۱۲رقمی برنامه‌ریز فعلی **فقط برای preview** است. پاسخ باید `output_sha`, `status`, `reason_code`, `evidence_refs` مجاز، `schema_version`, `runner_version`, `attempt` و `next_action` بدهد. artifact اول نوشته و checksum گرفته شود، سپس DB به صورت اتمی/با outbox نتیجه را ثبت و وابستگان را آزاد کند. رابطهٔ job با رویداد/نتیجه قابل‌بازپخش و append-only بماند.

**مثال مسیر واقعی:** M00 SHA را پاس می‌کند؛ M14 از workbook زرد موجودی *فرضی* می‌سازد و M15 گونه‌های *فرضی* را پیشنهاد می‌دهد. M01 در نبود PDF `BLOCKED_SOURCE_UNAVAILABLE` می‌دهد؛ بنابراین M02 اجازهٔ مشاهده و M04/M05/M06 اجازهٔ تولید «کتاب‌منطبق» ندارند. پس از اتصال PDF، M01 فقط بایت و چاپ را کنترل می‌کند؛ M02 باید offset/شکل/عدد را جداگانه اثبات کند. M06 سؤال زرد می‌سازد، M07 حساب مستقل می‌کند، M08 مهر/ID را نگه می‌دارد، M09/M10 بازی واقعی را می‌سنجند، M11 مستقل اختلاف را ثبت می‌کند و M12 **پروندهٔ تصمیم** می‌دهد. ربات انتشار نداریم.

## ۴. قرارداد حالت و وابستگی؛ چرا گیت‌ها را یکی نمی‌کنیم

`job_state` (`QUEUED/RUNNING/BLOCKED/FAILED/PROVISIONAL/PASS_SCOPED`) فقط وضعیت اجرای همان bot است؛ **وضعیت حقیقت** باید جدا نگه داشته شود: `source_bytes`, `page_visual_evidence`, `educational_claim`, `book_variant_coverage`, `runtime_interaction`, `human_decision`. PASS M14 فقط می‌گوید موجودی workbook تحت SHA درست محاسبه شد؛ از آن نمی‌توان PASS شاهد صفحه یا پوشش کتاب نتیجه گرفت. گیت آشیلِ ضدسبز با گیت اثبات مشاهدهٔ ۱۴۴ صفحه یکی نیست. حکم ص۵۷ سؤال۲، ص۸۰ تساوی‌ها و سایر احکام قبلی scoped می‌ماند. هیچ ردیف جدید بدون رأی لازم سبز، هیچ سؤال چاپی/عدد تصویر حدس زده، هیچ PDF یا crop در Git.

**تغییر یک صفحه:** هش شاهد آن page/claim عوض شود → فقط M02 و وابستگان همان صفحه/مهارت invalid شوند؛ immutable نتیجهٔ قبلی برای audit بماند، jobهای مستقل ادامه دهند؛ اگر نوع خطا جهان‌شمول است (چاپ/SHA یا schema)، کل cohort آن نسخه بلوکه شود. هر ریزربات قبل از resume ورودی و نسخه را دوباره تطبیق کند. وضعیت بی‌صاحب یا بی‌دلیل نه `PASS`، بلکه `BLOCKED_INTEGRITY` است.

## ۵. ساخت MVP و ترتیب آزمون، بدون ادعای استقرار امروز

| مرحله | تحویل و مسئول | گیت خروج |
|---|---|---|
| A — قرارداد کاغذی قابل اجرا | آرنا: ۱۷ spec و fixture منفی؛ Z.ai: نگاشت با schema/foreman و پیشنهاد identity/DB/queue؛ مالک فقط trade-off منابع/حقوق در صورت لزوم | schema/version و دو job نمونهٔ M14 و M02 با حالات موفق/بلوکه؛ اختلاف مرز با تصمیم مالک، نه فرض توافق. |
| B — پایلوت امن بدون PDF | Z.ai: یک worker محدود و queue ماندگار برای M00/M14/M15، رجیستری، append-only event، dashboard؛ آرنا: تست مصرف‌کننده؛ فقط data ساختگی/metadata زرد | ۲ run خودکار بدون چت، reboot/retry بدون تکرار اثر، تغییر SHA ⇒ توقف، نقش بدون اختیار ⇒ رد، ۰ مهر/انتشار. |
| C — منبع و آشیل | Z.ai: vault/binding بایت و M01/M02؛ آرنا: آزمون کور صفحه/تصویر و صف ۱۰۸ ردیف | پاسخ‌سازِ مبهم به `UNOBSERVABLE`، PDF/چاپ غلط به BLOCKED؛ هیچ رسانهٔ کتاب در repo/CI عمومی. |
| D — موج کوچک انتهابه‌انتها | مشترک: از یک صفحهٔ مجاز تا skill/گونه/بازی زرد، حل مستقل، converter، interaction و ممیزی دوم | همهٔ مصنوعات **همان SHA**، تست مثبت/منفی/RTL، بازبینی مستقل، freeze و rollback؛ بدون publish. |
| E — موازی‌سازی کنترل‌شده | Z.ai: worker pool/بودجه/alert؛ آرنا: صف موجی و معیار پوشش ۸ فصل | هزینه و نرخ خطا پایش، تکثیر اثر صفر، بستهٔ تصمیم مالک تولید شود؛ ادعای uptime فقط از دادهٔ عملیاتی. |

**بستهٔ سؤال به Z.ai هنگام رسیدن پاسخ او:** کدام اجزای ۱–۷ اکنون با SHA و تست واقعاً وجود دارند؟ آیا foreman فعلی job آموزشی بادوام، lease، freeze و dashboard را پوشش می‌دهد یا فقط PR/blueprint را می‌پاید؟ قرارداد schema و identity پیشنهادی او چیست؟ پایلوت M14↔M02 را کجا اجرا می‌کند و چه چیز را تا فراهم‌شدن PDF/مجوز BLOCKED نگه می‌دارد؟ پاسخ باید `EXISTS/PROPOSED/BLOCKED`، شاهد و owner داشته باشد. هیچ‌یک از این پرسش‌ها درخواست تأیید دوبارهٔ G0–G8 از مالک نیست.

**وضعیت صادقانه:** `g2_microbot_plan.py --run-safe` در نشست فعلی فقط ۵ بررسی read-only/provisional را در یک پردازش انجام داده و ۰ dispatch ثبت کرده است. PDF واقعی، worker دائمی، سرویس احراز رأی و پلتفرم فوق هنوز در اختیار/اثبات این خط نیستند. این RFC «نقشهٔ ریل» است؛ پاسخ Z.ai باید آن را با هستهٔ موجود آشتی دهد یا ناسازگاری را مکتوب کند، نه اینکه دو سیستم متضاد بسازیم.
