# -*- coding: utf-8 -*-
"""اعمال ۵ اصلاح قرمز AUD-01 + دو یافتهٔ ممیزی مجدد ماشینی، روی خشاب v0.5 → khshab-G3-MATH_v0.6.xlsx
اصول:
- جراحی تک‌سلولی؛ هیچ محتوای دیگری تغییر نمی‌کند.
- فایل v0.5 دست‌نخورده می‌ماند (سابقهٔ ممیزی).
- شیت مکمل «سجل ممیزی» آخر فایل اضافه می‌شود (قاعدهٔ AUD-14: آخر فایل + اعلام در راهنما).
"""
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from copy import copy

SRC = "/home/z/my-project/download/khshab-G3-MATH_v0.5.xlsx"
OUT = "/home/z/my-project/download/khshab-G3-MATH_v0.6.xlsx"

HDR_FILL   = PatternFill("solid", start_color="548235")
HDR_FONT   = Font(name="Tahoma", size=10, bold=True, color="FFFFFF")
BODY_FONT  = Font(name="Tahoma", size=10)
SMALL_FONT = Font(name="Tahoma", size=9, color="444444")
TITLE_FONT = Font(name="Tahoma", size=13, bold=True, color="2F4F2F")
OK_FILL    = PatternFill("solid", start_color="C6EFCE")
PEND_FILL  = PatternFill("solid", start_color="FFEB9C")
WRAP_RIGHT = Alignment(wrap_text=True, horizontal="right", vertical="top", readingOrder=2)
CENTER     = Alignment(wrap_text=True, horizontal="center", vertical="center", readingOrder=2)
THIN       = Border(*[Side(style="thin", color="BFBFBF")]*4)

wb = load_workbook(SRC)
log = []

# ───────────────── ۱) اطلس خطا ─────────────────
ws = wb["اطلس خطا"]
# AUD-01: نشانهٔ E_PLACE_SHIFT باید با classifyAttempt بخواند (فقط p×10 یا p÷10)
old = ws["E7"].value
ws["E7"] = "۶×۱۰ را ۶۰۰ یا ۶ می‌نویسد (۱۰ برابر یا یک‌دهمِ حاصل)"
log.append(f"اطلس E7: «{old}» → «{ws['E7'].value}»  [AUD-01]")

# موج AUD-03: پس از تغییر گزینهٔ دِ Q-110 (۲۰۰۰→۱۰۰۰)، نمونهٔ بازیابی غلطِ Q-110 گزینهٔ «ب» است نه «د»
old = ws["F20"].value
ws["F20"] = "گزینهٔ دِ Q-102، گزینهٔ بِ Q-110، گزینهٔ دِ Q-111"
log.append(f"اطلس F20: «{old}» → «{ws['F20'].value}»  [موج AUD-03]")

# ───────────────── ۲) بانک سؤال — اصلاح ردیف‌های موجود ─────────────────
ws = wb["بانک سؤال"]

# AUD-02: Q-103 نقشهٔ گزینهٔ د (۷۰ → بی‌الگو؛ شاخهٔ صفر موتور ۷۰ را نگاشت نمی‌کند)
old = ws["L6"].value
ws["L6"] = "الف→E_ZERO_PROPERTY؛ ب→هم‌پوشانی E_IDENTITY_CONFUSION؛ د→چسباندن ۷ و ۰ (بی‌الگو — شاخص توجه)"
log.append(f"بانک L6 (Q-103 نقشهٔ د): اصلاح شد  [AUD-02]")

# موج ممیزی مجدد ۱: Q-104 نقشهٔ گزینهٔ ج (۱۰=۹+۱) — موتور برای ×۱ جمع را نگاشت نمی‌کند (گارد f1,f2≥2) → بی‌الگو
old = ws["L7"].value
ws["L7"] = "ب→E_IDENTITY_CONFUSION؛ ج→جمع به‌جای ضرب (بی‌الگوی نگاشت خودکار موتور — شاخص توجه)؛ د→چسباندن رقم (بی‌الگو — شاخص توجه)"
log.append(f"بانک L7 (Q-104 نقشهٔ ج): «{old}» → برچسب صادق‌شده با موتور  [موج ممیزی مجدد]")

# AUD-01: Q-105 نقشهٔ گزینهٔ د (۶۱ → بی‌الگو؛ PLACE_SHIFT فقط ۶۰۰ یا ۶)
old = ws["L8"].value
ws["L8"] = "ب→E_ADD_CONFUSION؛ ج→E_PLACE_SHIFT (یک ×۱۰ اضافه)؛ د→چسباندن رقم (بی‌الگو — شاخص توجه)"
log.append(f"بانک L8 (Q-105 نقشهٔ د): اصلاح شد  [AUD-01]")

# AUD-03: Q-110 گزینهٔ د: ۲۰۰۰ → ۱۰۰۰ (۵×۲۰: p=۱۰۰؛ ۱۰۰۰=p×۱۰ → E_PLACE_SHIFT دقیق)
old = ws["J13"].value
ws["J13"] = "۱۰۰۰"
log.append(f"بانک J13 (Q-110 گزینهٔ د): «{old}» → «۱۰۰۰»  [AUD-03]")

# AUD-04: عنوان بانک (۱۱→۱۳ سبز)
ws["A1"] = "بانک سؤال KH-G3-MATH — ۱۳ سؤال تأییدشدهٔ ضرب (Q-102 اصلاح‌شده + Q-113/114 وصلهٔ L-43) + ۷ سؤال زرد حفره‌های تقسیم/چهاررقمی"
log.append("بانک A1 (عنوان): به‌روز شد  [AUD-04]")

# ───────────────── ۳) بانک سؤال — دو سؤال جدید L-43 (اول درج، بعد نوشتن) ─────────────────
ws.insert_rows(16, 2)
STYLE_SRC = 8  # ردیف Q-105 (تأییدشده/سبز) برای الگوی ظاهری
new_rows = [
    ["Q-113", "L-43", "CORE", "علامتی", "۷×۸ = ؟", "چهارگزینه‌ای", "۵۶", "۷۸", "۱۵", "۶۳", "الف",
     "ج→E_ADD_CONFUSION (۷+۸)؛ د→E_SKIP_OVERCOUNT (یک گروه ۷تایی بیشتر — ۷×۹)؛ ب→چسباندن ۷ و ۸ (بی‌الگو — شاخص توجه)",
     "آسان", "—",
     "تألیف v0.6 — بازحساب مستقل ۷×۸=۵۶ + تطبیق classifyAttempt (errors.js v10.2.0)",
     "تأییدشده",
     "وصلهٔ حفرهٔ پوشش L-43 (AUD-04)؛ همهٔ انحرافی‌ها با کدهای واقعی موتور"],
    ["Q-114", "L-43", "CORE", "علامتی", "۶×۹ = ؟", "چهارگزینه‌ای", "۵۴", "۶۹", "۴۸", "۶۳", "الف",
     "ج→E_SKIP_UNDERCOUNT (یک گروه ۶تایی کمتر — ۶×۸)؛ د→E_SKIP_OVERCOUNT (یک گروه ۹تایی بیشتر)؛ ب→چسباندن ۶ و ۹ (بی‌الگو — شاخص توجه)",
     "آسان", "—",
     "تألیف v0.6 — بازحساب مستقل ۶×۹=۵۴ + تطبیق classifyAttempt (errors.js v10.2.0)",
     "تأییدشده",
     "جفت زیر/بالای حاصل (۴۸/۶۳) — دو سمتِ پرش؛ نسخهٔ اول گزینهٔ ج «۴۵» بود که ممیزی مجدد ماشینی رد کرد (۴۵=۹×۵ در زنجیرهٔ موتور ANCHOR_DRIFT می‌خورد) و به ۴۸ اصلاح شد"],
]
for i, vals in enumerate(new_rows):
    r = 16 + i
    for c, v in enumerate(vals, 1):
        cell = ws.cell(row=r, column=c, value=v)
        src = ws.cell(row=STYLE_SRC, column=c)
        cell.font = copy(src.font); cell.alignment = copy(src.alignment)
        cell.border = copy(src.border); cell.fill = copy(src.fill)
log.append("بانک ردیف ۱۶ و ۱۷: Q-113 و Q-114 (لنگر L-43، سبز، برچسب‌ها هم‌خوان classifyAttempt)  [AUD-04 + موج ممیزی مجدد]")

# ───────────────── ۴) نقشهٔ کتاب ─────────────────
ws = wb["نقشهٔ کتاب (S1)"]
# AUD-05: L-41 تک‌مالکی — Q-101 مالکش L-42 است
old = ws["K4"].value
ws["K4"] = "E_GROUP_VS_COUNT"
log.append(f"نقشه K4 (L-41 لنگر): «{old}» → «E_GROUP_VS_COUNT»  [AUD-05]")

# AUD-04: L-43 لنگر به سؤال‌های واقعی خودش
old = ws["K5"].value
ws["K5"] = "Q-101، Q-102، Q-111؛ E_ADD_CONFUSION"
log.append(f"نقشه K5 (L-42 لنگر): «{old}» → «Q-101، Q-102، Q-111؛ E_ADD_CONFUSION»  [موج-۳ — کشف مبدل: مالک بانکی Q-111 برابر L-42 است و سلول نقشه ناقص بود]")

old = ws["K6"].value
ws["K6"] = "Q-113، Q-114"
log.append(f"نقشه K6 (L-43 لنگر): «{old}» → «Q-113، Q-114»  [AUD-04]")

old = ws["N6"].value
ws["N6"] = (old or "—") + "؛ وصلهٔ پوشش v0.6: Q-113/Q-114 افزوده شد"
log.append("نقشه N6 (یادداشت L-43): یادداشت وصله افزوده شد")

# ───────────────── ۵) شناسنامه: وضعیت ─────────────────
ws = wb["شناسنامهٔ خشاب"]
for r in range(1, ws.max_row + 1):
    if ws.cell(row=r, column=1).value == "وضعیت خشاب":
        ws.cell(row=r, column=2).value = "درجریان — v0.6 (۵ قرمز ممیزی AUD-01 + دو یافتهٔ ممیزی مجدد اعمال شد)؛ موتور v10.2؛ مسیر v10.3: کل کتاب، دو لایه (موج الف تعاملی + موج ب بانک تمرین)"
        log.append("شناسنامه «وضعیت خشاب»: به v0.6 و مسیر v10.3 به‌روز شد")
        break

# ───────────────── ۶) راهنما ─────────────────
ws = wb["راهنما"]
updates = {
    "نام سند": "khshab-G3-MATH_v0.6.xlsx — نسخهٔ تألیف پس از ممیزی AUD-01 و ممیزی مجدد ماشینی؛ هنوز خشاب اجرایی (JSON) نیست.",
    "مبنای ساخت": "قالب استاندارد cartridge-template-standard-v1.1.xlsx (با شیت پروتکل ممیزی) + سند پداگوژیک v1.1.0 + errors.js v10.2.0 + کتاب ریاضی سوم کد ۳۰۵ چاپ دوازدهم ۱۴۰۳ + گزارش ممیزی AUD-01.",
    "ترکیب اعتبار": "نقشهٔ کتاب: ۱۰ سبز + ۶ زرد  |  اطلس خطا: ۱۲ سبز + ۶ زرد (پیشنهاد)  |  بانک سؤال: ۱۳ سبز + ۷ زرد. هیچ زردی بدون تأیید انسانی سبز نمی‌شود. تاریخچهٔ اصلاح‌ها: شیت «سجل ممیزی».",
    "قدم بعدی": "۱) نشست تأیید S1 با معلم هم‌ساز و کتاب فیزیکی (زرد→سبز + برگهٔ انسانی AUD-01)؛ ۲) مبدل Excel→JSON؛ ۳) موتور خوانندهٔ خشاب؛ ۴) بستهٔ zip خشاب.",
}
for r in range(1, ws.max_row + 1):
    key = ws.cell(row=r, column=1).value
    if key in updates:
        ws.cell(row=r, column=2).value = updates[key]

# ───────────────── ۷) شیت سجل ممیزی (آخر فایل — قاعدهٔ AUD-14) ─────────────────
ws = wb.create_sheet("سجل ممیزی")
ws.sheet_view.rightToLeft = True
for i, w in enumerate([12, 18, 46, 56, 12], 1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.cell(row=1, column=1, value="سجل ممیزی AUD-01 → خشاب v0.6 (۲۸ مهر ۱۴۰۵ — ۲۰ اکتبر ۲۰۲۶)").font = TITLE_FONT
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=5)
ws.row_dimensions[1].height = 26
for c, h in enumerate(["شناسهٔ یافته", "محل", "حکم", "اصلاح اعمال‌شده در v0.6", "وضعیت"], 1):
    cell = ws.cell(row=2, column=c, value=h)
    cell.fill, cell.font, cell.alignment, cell.border = HDR_FILL, HDR_FONT, CENTER, THIN
rows = [
    ("AUD-01", "اطلس E7 + بانک L8", "قرمز — نشانهٔ «61» و برچسب Q-105د ناسازگار با classifyAttempt (فقط ۶۰۰/۶ برچسب می‌خورند)",
     "نشانهٔ اطلس → «۶۰۰ یا ۶»؛ نقشهٔ Q-105د → «چسباندن رقم (بی‌الگو — شاخص توجه)»", "رفع شد"),
    ("AUD-02", "بانک L6", "قرمز — Q-103د (۷۰) با شاخهٔ صفر موتور ناسازگار (۷۰ → بی‌الگو)",
     "نقشهٔ Q-103د → «چسباندن ۷ و ۰ (بی‌الگو — شاخص توجه)» هم‌قرارداد با Q-104", "رفع شد"),
    ("AUD-03", "بانک J13", "قرمز — Q-110د (۲۰۰۰) بی‌الگو؛ الگوی «صفرِ اضافه» کد ندارد",
     "گزینهٔ د → ۱۰۰۰ (= p×۱۰ برای ۵×۲۰) تا E_PLACE_SHIFT دقیق شود", "رفع شد"),
    ("AUD-04", "نقشه K6", "قرمز — لنگرهای ادعایی L-43 متعلق به L-81/L-PRE؛ جدول ضرب بی‌سؤال",
     "دو سؤال واقعی جدید Q-113/Q-114 (۷×۸ و ۶×۹) برای L-43؛ لنگر اصلاح شد؛ عنوان بانک به‌روز شد", "رفع شد"),
    ("AUD-05", "نقشه K4", "قرمز — دو مالکی Q-101 (L-41 و L-42)",
     "لنگر L-41 → «E_GROUP_VS_COUNT» فقط؛ مالکیت Q-101 نزد L-42 ماند", "رفع شد"),
    ("موج AUD-03", "اطلس F20", "هم‌خوانی — پس از تغییر Q-110، ارجاع اطلس به «گزینهٔ دِ Q-110» گمراه‌کننده می‌شد",
     "ارجاع اطلس E_FACT_CONFUSION → «گزینهٔ بِ Q-110»", "رفع شد"),
    ("موج-۱ v0.6", "بانک L7", "یافتهٔ ممیزی مجدد ماشینی — Q-104ج (۹×۱=۱۰) با برچسب E_ADD_CONFUSION ناسازگار بود: موتور برای ضرب در یک، جمع را نگاشت نمی‌کند (گارد f1,f2≥2)",
     "برچسب صادق شد: «جمع به‌جای ضرب (بی‌الگوی نگاشت خودکار موتور — شاخص توجه)»", "رفع شد"),
    ("موج-۲ v0.6", "بانک I17", "یافتهٔ ممیزی مجدد ماشینی — ۴۵=۹×۵ در زنجیرهٔ اولویت موتور E_ANCHOR_DRIFT می‌خورد نه SKIP_UNDERCOUNT",
     "گزینهٔ جِ Q-114 → ۴۸ (۶×۸ — یک گروه ۶تایی کمتر) که دقیقاً E_SKIP_UNDERCOUNT می‌خورد", "رفع شد"),
    ("موج-۳ v0.6", "نقشه K5", "یافتهٔ مبدل Excel→JSON (T7) — بانک مالک Q-111 را L-42 اعلام می‌کند ولی سلول لنگر L-42 فقط Q-101 و Q-102 داشت؛ نقشه با بانک ناهم‌خوان بود",
     "سلول لنگر L-42 → «Q-101، Q-102، Q-111؛ E_ADD_CONFUSION» (بانک مرجع مالکیت است — قرارداد بستن AUD-05)", "رفع شد"),
    ("—", "بانک ردیف ۱۶-۱۷", "پیش‌شرط بستن AUD-04",
     "Q-113/Q-114: پاسخ‌ها با بازحساب مستقل، برچسب‌ها با اجرای مستقیم errors.js (bun) تأیید شد — همه کد واقعی یا «بی‌الگو»", "افزوده شد"),
]
r = 3
for vals in rows:
    for c, v in enumerate(vals, 1):
        cell = ws.cell(row=r, column=c, value=v)
        cell.font = BODY_FONT; cell.alignment = WRAP_RIGHT; cell.border = THIN
        cell.fill = OK_FILL if vals[-1] == "رفع شد" else PEND_FILL
    r += 1
r += 1
note = ("قاعدهٔ اصلاح: فایل v0.5 دست‌نخورده حفظ شد (سابقهٔ ممیزی)؛ همهٔ اصلاحات در همین نسخهٔ v0.6 اعمال شد. "
        "حکم گیت AUD-01 «مجاز ورود به مبدل پس از رفع ۵ قرمز» — پنج مورد رفع شد؛ ممیزی مجدد ماشینی با اجرای واقعی errors.js هم انجام شد. "
        "برگهٔ تأیید انسانی (قطعهٔ ۲ گزارش AUD-01) همچنان معلق است — تصدیق صفحه‌ها فقط با کتاب فیزیکی.")
cell = ws.cell(row=r, column=1, value=note)
cell.font = SMALL_FONT; cell.alignment = WRAP_RIGHT
ws.merge_cells(start_row=r, start_column=1, end_row=r + 2, end_column=5)

wb.save(OUT)
print("ذخیره شد:", OUT)
print("\n--- سیاههٔ تغییرات ---")
for line in log:
    print("•", line)
