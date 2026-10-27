#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ثبت، بایگانی و فریز داده‌های G1 (راستی‌آزمایی‌شده با دو شاهد) + G2 + G3
فرمان مالک — trace 1a17d80557fc1d91 — 2026-10-27 تهران
خروجی: public/math-game/frozen/baseline-v1/ (خودکفا، فقط‌خواندنی)
"""
import openpyxl, json, hashlib, shutil, os, stat

ROOT = '/home/z/my-project/public/math-game'
FZ = os.path.join(ROOT, 'frozen', 'baseline-v1')
SRC_G1_XLSX = '/home/z/my-project/upload/CURRICULUM-MAP-G1-v1.xlsx'
SRC_G3_XLSX = '/home/z/my-project/upload/math_grade3_comprehensive (1).xlsx'
FROZEN_AT = '2026-10-27T16:50:44+03:30'
OWNER_TRACE = '1a17d80557fc1d91'

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

# ---------- 1) خواندن نقشهٔ G1 از xlsx گراک ----------
wb = openpyxl.load_workbook(SRC_G1_XLSX, data_only=True)
ws = wb['نقشهٔ_درس‌ها']
LESSON_KEYS = ['پایه','شمارهٔ فصل','عنوان فصل','شمارهٔ درس','عنوان درس / موضوع','صفحات (شروع–پایان)',
               'سطح اطمینان صفحه','زیرموضوع‌ها','خانوادهٔ محتوایی','کد دامنهٔ پیشنهادی',
               'نوع‌های تمرین','حداقل سؤال پیشنهادی','توزیع سختی','گلوگاه‌های احتمالی','یادداشت']
lesson_rows = []
for r in ws.iter_rows(min_row=5, values_only=True):
    if r[1] is None: continue
    vals = list(r[1:16])
    lesson_rows.append({k: vals[i] for i, k in enumerate(LESSON_KEYS)})

wm = wb['ماتریس_دامنه']
DOM_KEYS = ['پایه','کد دامنه','عنوان دامنه','فصل کتاب','حداقل سؤال','نوع‌های تمرین','یادداشت عمق']
dom_rows = []
for r in wm.iter_rows(min_row=4, values_only=True):
    if r[2] and str(r[2]).startswith('D'):
        dom_rows.append({k: r[i+1] for i, k in enumerate(DOM_KEYS)})

self_decl = []
wsd = wb['خوداظهاری']
for r in wsd.iter_rows(min_row=2, values_only=True):
    vals = [v for v in r if v is not None]
    if vals: self_decl.append(vals)

# ---------- 2) ساخت درخت فریز ----------
for d in ['G1','G2','G3']:
    os.makedirs(os.path.join(FZ, d), exist_ok=True)

# G1: JSON کانونی + کپی منبع
g1_json = {
  'schema': 'khshab.curriculum-map/v1',
  'family': 'KH-G1-MATH',
  'grade': 1,
  'title': 'نقشهٔ موضوعات ریاضی اول دبستان — مبنای فریز baseline-v1',
  'provenance': {
    'producer': 'سوپرگراک — برون‌سپاری خواندن کتاب طبق پرامپت استاندارد CURRICULUM-MAP (G1-G6 v1)',
    'sourceFile': 'CURRICULUM-MAP-G1-v1.xlsx',
    'sourceFileSha256': sha256(SRC_G1_XLSX),
    'witness1_studentBook': {
      'title': 'ریاضی اول دبستان — کتاب دانش‌آموزی (رسمی)',
      'scope': 'چاپ ۱ تا ۱۷۵؛ فایل ۱۸۴ صفحه‌ای',
      'localPath': 'upload/G1-MATH-BOOK-OFFICIAL.pdf',
      'sha256': sha256('/home/z/my-project/upload/G1-MATH-BOOK-OFFICIAL.pdf')
    },
    'witness2_teacherGuide': {
      'title': 'کتاب معلم (راهنمای تدریس) ریاضی اول دبستان — منبع مستقل، خارج از دسترس تولیدکننده',
      'scope': '۲۰۷ صفحه',
      'driveLink': 'https://drive.google.com/file/d/1Aw0n-mmL3_GnjHSNfhWorolaToPbhOTc/view?usp=drive_link',
      'localPath': 'upload/G1-BOOK-DRIVE-NEW.pdf',
      'sha256': sha256('/home/z/my-project/upload/G1-BOOK-DRIVE-NEW.pdf'),
      'caveat': 'سال تألیف متفاوت با چاپ فعلی → فقط به‌عنوان سنجهٔ مفهوم و فهرست استفاده شد (حکم مالک: «فقط مفهوم و فهرست مطالب، نه ارجاع صفحه»)'
    }
  },
  'verification': {
    'date': '2026-10-27', 'trace': '1a17d6a6906d72f9',
    'structural': {'errors': 0, 'warnings': 12, 'lessonRows': 37, 'chapters': '۱ تا ۲۵ کامل', 'domainQuestionsSum': 188},
    'conceptualSampling': '۱۱ ردیف از ۳۷ (≈۳۰٪) — بالاتر از حداقل پروتکل (۱۰٪)',
    'methods': [
      'اعتبارسنجی ساختاری ۱۰۰٪ خودکار (اسکیما، enum، ارقام، تکراری‌ها، تطابق درونی نقشه↔ماتریس)',
      'شواهد بصری زنده: ۱۲ صفحهٔ رندرشده از کتاب دانش‌آموزی (لوحه‌های بخش ۱،۲،۴،۱۰،۱۳،۱۴،۱۶،۱۹،۲۲،۲۵ + صفحهٔ ۲۴ چوب‌خط + صفحهٔ ۱۱۲ ساعت/محور/گیره)',
      'اسکن متنی نمادها: ص۸۶ «معرّفی نماد جمع»، ص۹۳ «معرّفی نماد تفریق»، رد مثبتِ کاذب ص۴۵',
      'منبع مستقل: کتاب معلم (اهداف بخش ۱۰ و شابلون) — مطابق بدون هم‌نویسی'
    ],
    'valueScore': '4.5/5',
    'evidenceImages': 'upload/verify/ (b01,b02,b04,b10,p24-tally,b09,b10,p85-addsymbol,p92-subsymbol,b16,p112-clock,b19,b21,b22,b24,b25)'
  },
  'ownerSeal': {
    'by': 'مالک — مجید بایرامی (bayrami1341)',
    'trace': OWNER_TRACE,
    'date': '2026-10-27',
    'statement': '«توسط دو شاهد بیرونی بررسی گردید و معتبر است و می‌تواند در بازی مورد استفاده قرار گیرد»',
    'scope': 'مُهر اعتبار نقشهٔ موضوعی به‌عنوان خوراک بازی؛ تولید سؤال‌ها و مُهر پداگوژیکِ گام صفر معلم، مرحلهٔ جداگانه است'
  },
  'status': 'فریز‌شده — مبنای معتبر خوراک بازی (G1)؛ سؤال‌ها هنوز تولید نشده‌اند (KH-G1-MATH = ۰ سؤال)',
  'lessonRows': lesson_rows,
  'domainMatrix': dom_rows,
  'selfDeclaration': self_decl,
  'openItems': [
    'تصمیم مالک روی D9 (اندازه‌گیری: طول/ساعت) — پذیرش کد یا ادغام در D6/D7 پیش از تبدیل',
    'نگاشت ~۵ نوع تمرین شفاهی به قالب‌های موتور (چهارگزینه‌ای/گزینه‌ای) هنگام تبدیل',
    'تفکیک کامل/تقریبی برای ردیف‌های تک‌صفحه‌ای هنگام تولید «شاهد صفحه‌ای»',
    'ثبت خانوادهٔ KH-G1-MATH در DOMAIN-MATRIX زنده — در گام تبدیل، با مُهر گام صفر'
  ]
}
with open(os.path.join(FZ, 'G1', 'curriculum-map-g1.json'), 'w', encoding='utf-8') as f:
    json.dump(g1_json, f, ensure_ascii=False, indent=2)

# G2/G3: اسنپ‌شات کارتریج + برش ماتریس دامنه + کپی خشاب رسمی اکسل + منبع گراک G3
dm_live = json.load(open(os.path.join(ROOT, 'authoring', 'DOMAIN-MATRIX.json'), encoding='utf-8'))
for g, head_ver, head_xlsx in [('G2', 'v0.5', 'khshab-G2-MATH_v0.5.xlsx'), ('G3', 'v0.7', 'khshab-G3-MATH_v0.7.xlsx')]:
    cart = open(os.path.join(ROOT, 'cartridges', f'KH-{g}-MATH.json'), 'rb').read()
    with open(os.path.join(FZ, g, f'KH-{g}-MATH.snapshot.json'), 'wb') as f:
        f.write(cart)
    fam = dm_live['families'][f'KH-{g}-MATH']
    slice_ = {
        'schema': 'khshab.domain-matrix/v1 — برش فریز',
        'family': f'KH-{g}-MATH',
        'provenance': {'liveFile': 'authoring/DOMAIN-MATRIX.json', 'liveFileSha256': sha256(os.path.join(ROOT, 'authoring', 'DOMAIN-MATRIX.json')),
                        'liveStatus': dm_live.get('status', ''), 'liveUpdatedAt': dm_live.get('updatedAt', '')},
        'minTotal': fam['minTotal'], 'domains': fam['domains'],
        'status': 'فریز‌شده به‌عنوان مبنای baseline-v1 — وضعیت زنده (DRAFT/گام صفر) جداگانه محفوظ است'
    }
    with open(os.path.join(FZ, g, f'domain-matrix-g{g[1]}.json'), 'w', encoding='utf-8') as f:
        json.dump(slice_, f, ensure_ascii=False, indent=2)
    shutil.copy2(os.path.join(ROOT, 'authoring', head_xlsx), os.path.join(FZ, g, head_xlsx))
    side = head_xlsx + ('.sha256' if g == 'G2' else '.sha256')
    sp = os.path.join(ROOT, 'authoring', side)
    if os.path.exists(sp): shutil.copy2(sp, os.path.join(FZ, g, side + '.copy'))

shutil.copy2(SRC_G1_XLSX, os.path.join(FZ, 'G1', 'CURRICULUM-MAP-G1-v1.xlsx'))
shutil.copy2(SRC_G3_XLSX, os.path.join(FZ, 'G3', 'source-math-grade3-comprehensive-grok.xlsx'))

# ---------- 3) سند شواهد دو شاهد G1 ----------
ev = '''# شواهد راستی‌آزمایی نقشهٔ G1 — دو شاهد بیرونی

**trace راستی‌آزمایی:** 1a17d6a6906d72f9 — ۲۰۲۶-۱۰-۲۷ | **فرمان فریز مالک:** trace {owner}

## شاهد ۱ — کتاب دانش‌آموزی رسمی ریاضی اول دبستان
- فایل: `upload/G1-MATH-BOOK-OFFICIAL.pdf` (۱۸۴ صفحهٔ PDF، چاپ ۱ تا ۱۷۵) — همان منبعی که خود تولیدکننده در خوداظهاری اعلام کرد
- شواهد بصری زنده (۱۲ صفحهٔ رندرشده در `upload/verify/`): لوحه‌های بخش ۱ (آشپزخانه/دسته‌های مثل هم)، ۲ (تناظر)، ۴ (شکل)، ۱۰ (ترکیب با پنج)، ۱۳ (رستوران/جمع)، ۱۴ (پرندگان/تفریق)، ۱۶ (عدد دورقمی)، ۱۹ (نانوایی/ده‌تایی‌ها)، ۲۲ (شمارش شش‌تا)، ۲۵ (جدول صد/حل مسئله) + صفحهٔ ۲۴ (آغاز چوب‌خط) + صفحهٔ ۱۱۲ (ساعت/محور ۰–۱۲/اندازه‌گیری با گیره)
- شواهد متنی: ص۸۶ «معرّفی نماد جمع و حاصل جمع»، ص۹۳ «معرّفی نماد تفریق»، ص۲ «دسته‌های ۱ تا ۵تایی مثل هم»، رد مثبتِ کاذب ص۴۵

## شاهد ۲ — کتاب معلم (راهنمای تدریس) — منبع مستقل خارج از دسترس تولیدکننده
- فایل: `upload/G1-BOOK-DRIVE-NEW.pdf` (۲۰۷ صفحه) — لینک درایو مالک
- انطباق مفهومی بدون هم‌نویسی: اهداف «نمایش عدد با انگشتان دو دست و انتقال انگشت» (بخش ۱۰)، «رسم با شابلون»، «سرشماری با چوب‌خط و سازماندهی داده در جدول»
- محدودیت صادقانه: سال تألیف متفاوت با چاپ فعلی → طبق حکم مالک فقط «مفهوم و فهرست» ملاک بود، نه صفحه

## نتیجه
- ساختاری: ۰ خطا / ۱۲ هشدار جزئی | نمونه‌گیری مفهومی ≈۳۰٪ | نمرهٔ ارزش خوراک: **۴.۵/۵**
- هیچ اغماع، جعل یا ناسازگاری مفهومی کشف نشد؛ خوداظهاری تولیدکننده با واقعیت منطبق بود.
'''.format(owner=OWNER_TRACE)
with open(os.path.join(FZ, 'G1', 'verification-evidence-g1.md'), 'w', encoding='utf-8') as f:
    f.write(ev)

# ---------- 4) مانیفست + INDEX ----------
files_rel = []
for base, _, fns in os.walk(FZ):
    for fn in sorted(fns):
        p = os.path.join(base, fn)
        files_rel.append({'path': os.path.relpath(p, FZ), 'bytes': os.path.getsize(p), 'sha256': sha256(p)})
files_rel.sort(key=lambda x: x['path'])

manifest = {
  'schema': 'khshab.frozen-baseline/v1',
  'version': 'baseline-v1',
  'frozenAt': FROZEN_AT,
  'timezone': 'Asia/Tehran',
  'authority': {
    'command': 'ثبت و بایگانی و فریز داده‌های پایهٔ اول در کنار داده‌های پایهٔ دوم و سوم',
    'issuedBy': 'مالک — مجید بایرامی (bayrami1341)',
    'trace': OWNER_TRACE,
    'justification': 'راستی‌آزمایی با دو شاهد بیرونی؛ معتبر و قابل‌استفاده در بازی'
  },
  'freezeRules': [
    'فایل‌های این بسته تغییرناپذیرند (chmod 444)؛ هر اصلاح = نسخهٔ جدید baseline-v1.1 با فرمان مالک، نه ویرایش درجا',
    'هیچ فایل زندهٔ خط تولید (cartridges/، authoring/، DOMAIN-MATRIX) در این فریز دست نخورده است',
    'بازکردن فریز (unfreeze) فقط با فرمان صریح مالک ثبت‌شده در worklog'
  ],
  'grades': {
    'G1': {
      'what': 'نقشهٔ موضوعی کتاب اول دبستان (۳۷ ردیف درس، ۲۵ فصل، ۶ دامنه، ۱۸۸ حداقل سؤال)',
      'seal': 'معتبر برای خوراک بازی — مُهر مالک (trace ' + OWNER_TRACE + ')',
      'questionCount': 0,
      'nextStep': 'تصمیم D9 → تبدیل به KH-G1-MATH.json (حداقل ۱۸۸ سؤال، ۴۰/۴۰/۲۰) → گیت خشاب → مُهر گام صفر'
    },
    'G2': {
      'what': 'اسنپ‌شات کارتریج زنده (۹۲ سؤال) + برش ماتریس دامنه (D1–D6، minTotal 242) + خشاب رسمی v0.5',
      'seal': 'فریز مطابق وضعیت ثبت‌شدهٔ قبلی (بدون مُهر جدید) — سوابق: RUNBOOK-G2، GATE2-FIX v0.3.1',
      'questionCount': 92
    },
    'G3': {
      'what': 'اسنپ‌شات کارتریج زنده (۱۲۰ سؤال) + برش ماتریس دامنه (D1–D8، minTotal 452) + خشاب رسمی v0.7 + منبع خوانش گراک',
      'seal': 'فریز مطابق وضعیت ثبت‌شدهٔ قبلی (بدون مُهر جدید) — سوابق: بازآزمایی تصادفی seed 1404، پوشش D4=100/100',
      'questionCount': 120
    }
  },
  'evidenceAnchors': {
    'note': 'کتاب‌های شاهد برای سبک‌ماندن بستهٔ عمومی، به‌صورت بایت کپی نشده‌اند؛ هش و مسیر بازیابی ثبت شده است.',
    'witnesses': [g1_json['provenance']['witness1_studentBook'], g1_json['provenance']['witness2_teacherGuide']]
  },
  'files': files_rel
}
with open(os.path.join(FZ, 'MANIFEST.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

idx = '''# بایگانی فریز baseline-v1 — داده‌های موضوعی ریاضی G1/G2/G3

**تاریخ مهر:** ۲۰۲۶-۱۰-۲۷ ۱۶:۵۰ (تهران) | **فرمان:** مالک (مجید بایرامی) — trace {tr}

## این بسته چیست
نسخهٔ تغییرناپذیر (فریز) از داده‌های خوانش کتاب‌های ریاضی پایه‌های اول، دوم و سوم دبستان:
- **G1:** نقشهٔ موضوعی ۳۷ ردیفی راستی‌آزمایی‌شده با دو شاهد بیرونی (کتاب دانش‌آموزی + کتاب معلم) — مُهر اعتبار خوراک از مالک
- **G2:** اسنپ‌شات کارتریج (۹۲ سؤال) + ماتریس دامنه (۲۴۲) + خشاب رسمی v0.5
- **G3:** اسنپ‌شات کارتریج (۱۲۰ سؤال) + ماتریس دامنه (۴۵۲) + خشاب رسمی v0.7 + منبع خوانش گراک

## قواعد فریز
۱) هیچ فایلی در این پوشه ویرایش نمی‌شود؛ اصلاح یعنی نسخهٔ جدید (baseline-v1.1) با فرمان مالک.
۲) صحت هر فایل با `MANIFEST.json` (SHA-256) قابل بازبینی است: `sha256sum -c` روی فهرست مانیفست.
۳) فایل‌های زندهٔ خط تولید از این فریز مستقل‌اند؛ بازی فقط از کارتریج‌های زنده می‌خواند.
۴) کتاب‌های شاهد (PDF) بایت‌به‌بایت کپی نشده‌اند — هش و لینک بازیابی در مانیفست است.

## ساختار
```
frozen/baseline-v1/
├── G1/ curriculum-map-g1.json · CURRICULUM-MAP-G1-v1.xlsx · verification-evidence-g1.md
├── G2/ KH-G2-MATH.snapshot.json · domain-matrix-g2.json · khshab-G2-MATH_v0.5.xlsx (+sha256)
├── G3/ KH-G3-MATH.snapshot.json · domain-matrix-g3.json · khshab-G3-MATH_v0.7.xlsx (+sha256) · source-...grok.xlsx
├── MANIFEST.json
└── INDEX.md (همین فایل)
```
'''.format(tr=OWNER_TRACE)
with open(os.path.join(FZ, 'INDEX.md'), 'w', encoding='utf-8') as f:
    f.write(idx)

# ---------- 5) قفل فقط‌خواندنی ----------
os.chmod(FZ, 0o555)
for base, dirs, fns in os.walk(FZ):
    for d in dirs: os.chmod(os.path.join(base, d), 0o555)
    for fn in fns: os.chmod(os.path.join(base, fn), 0o444)

# ---------- 6) صحت‌سنجی نهایی ----------
bad = []
for e in files_rel:
    p = os.path.join(FZ, e['path'])
    if sha256(p) != e['sha256']: bad.append(e['path'])
print('frozen files:', len(files_rel))
print('checksum re-verify:', 'ALL PASS' if not bad else f'FAIL: {bad}')
total = sum(e['bytes'] for e in files_rel)
print(f'total size: {total/1024:.1f} KB')
print('manifest sha256:', sha256(os.path.join(FZ, 'MANIFEST.json')))
