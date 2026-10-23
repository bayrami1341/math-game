# گزارش گام ۰ — بازیابی بستر و موجودی واقعی خشاب‌ها
- تاریخ: 2026-10-23T04:31:02+00:00
- منبع: bayrami1341/math-game (main)

## ۱. شاخه‌ها و تگ‌ها
* main
  remotes/origin/HEAD -> origin/main
  remotes/origin/arena/0eb22280-math-game
  remotes/origin/arena/6b8310f7-math-game
  remotes/origin/main
  remotes/origin/v10.3-beta
  remotes/origin/v6

v10.2-stable
v10.3.0-beta.0
v10.3.0-beta.1
v2.4-final
v6.0-stable
v7.0-stable
v9.0-stable

## ۲. آخرین ۱۰ کامیت main
24e61dd nightshift: پایان شیفت — گزارش صبح منتشر شد، صف خالی، دو شاخه هم‌هد efab195
efab195 bp-BP-014: verified توسط زنجیرهٔ run-approved (گیت + CI سبز)
cbefa5d bp-BP-013: verified توسط زنجیرهٔ run-approved (گیت + CI سبز)
7f5dc2b bp-013/bp-014: واچ چرخهٔ ۱ + پیش‌بارگذاری صبح (اسکلت مُهر با قاعده + DRAFT یادداشت + تست دود 200/400)
d079048 bp-013: چرخهٔ واچ ۱ — بازرسی f2d7f24 (سبز) + حکم تابلو؛ رانر BP-007/011 را verified کرد
5a4bd2d bp-BP-011: verified توسط زنجیرهٔ run-approved (گیت + CI سبز)
0457358 bp-BP-007: verified توسط زنجیرهٔ run-approved (گیت + CI سبز)
44154c4 bp-011: رد قلمرو آرنا در زنجیره (BP-005 skip) + برچسب دقیق dry-run + فیکس آرگومان skip_reason
05ab6a2 bp-011: موتور زنجیرهٔ اجرا run-approved.sh — run/dry-run/self-test + گیت بین‌گام + رد خودکار BP-012 بدون مُهر معلم
b26e0fd bp-007: delivered+worklog — W8 کامل (T1/T2/T3 سبز، صفر رگرسیون)

## ۳. رجیستری بلوپرینت
نسخه: 32 | تعداد نقشه: 15
- BP-000 | done | ساخت سیستم مرکزی مدیریت (پروتکل + تابلو + کارگاه‌بان v2)
- BP-001 | verified | رفع بدهی ۶۰-bis: فیکسچر pytest ایزوله + حذف هاردکد Q-1069 از
- BP-002 | verified | گام ۴ — سه آشکارساز خطای پروتکل v10.3 در مبدل/ایجنت رسمی
- BP-003 | verified | گام ۵ — رندرر SVG چهارده‌مدلی برای مدل‌های سؤال
- BP-004 | verified | گام ۳ — داشبورد معلم: صفحهٔ بازرسی محتوا + مُهر رأی معلم
- BP-005 | executing | موج محتوایی بعدی آرنا — توسعهٔ محتوای کتاب درسی بر پایهٔ سره
- BP-006 | verified | W7 آرنا — افزودن گام پایتست ایجنت به CI khshab-gate (در انتظ
- BP-007 | verified | W8 آرنا — گسترش اسکیمای مبدل: اعداد بزرگ/منفی/کسری + تعمیم c
- BP-008 | verified | بازرسی دوم هدهای معلق آرنا (714338c / 06d7b7d) + ادغام رسمی،
- BP-009 | verified | ماشین انتشار نسخه: ارتقای هستهٔ مرکزی به v10.3.0-beta.1 + یا
- BP-010 | verified | گیت سخت انتشار scripts/release-check.sh — fail-closed پیش از
- BP-011 | verified | موتور زنجیرهٔ اجرا scripts/run-approved.sh — ادامهٔ خودکار ن
- BP-012 | approved | انتشار پایدار v10.3.0 — خروج از بتا پس از سبزی کامل رشته‌ها 
- BP-013 | verified | آرنا-واچ چراغ خاموش — پایش شبانهٔ شاخه‌های arena/** و اجرای 
- BP-014 | verified | پیش‌بارگذاری صبح — اسکلت مُهر معلم + پیش‌نویس DRAFT یادداشت 

## ۴. کارتریج‌ها (موجودی واقعی)
پوشهٔ cartridges یافت نشد — بررسی درخت مخزن لازم است
## ۵. authoring و scripts
ARENA-BRIEF-PAGEMAP-KH-G2-v1.fa.md
ARENA-BRIEF-PAGEMAP-KH-G3-v1.fa.md
PAGE-MAP-KH-G2-MATH-v1.fa.md
PAGE-MAP-KH-G2-MATH-v1.json
PAGE-MAP-KH-G2-MATH-v1.xlsx
PAGE-MAP-KH-G3-MATH-v1.fa.md
PAGE-MAP-KH-G3-MATH-v1.json
PAGE-MAP-KH-G3-MATH-v1.xlsx
README-AGENT.fa.md
agent
page-map-chunks
page-map-chunks-g3
snapshots
teacher-stamps.json
tests

auto-backup.sh
blueprint.ts
gh-autosave.sh
gh-connect.sh
release-check.sh
run-approved.sh
