#!/usr/bin/env python3
"""Task 54 — راستی‌آزمایی نهایی فایل رسمی ادغام v2"""
import openpyxl, re

MERGED = "/home/z/my-project/public/math-game/authoring/khshab-G2-MATH_v0.3.1.xlsx"
V03    = "/home/z/my-project/public/math-game/authoring/khshab-G2-MATH_v0.3.xlsx"
OFFOLD = "/tmp/official_c2d511a8.xlsx"
REDEL  = "/tmp/gate2-redelivery/khshab-G2-MATH_v0.3.1.xlsx"

FAIL = []
def check(name, ok, detail=""):
    print(f"{'✓' if ok else '✗ FAIL'} {name}" + (f" — {detail}" if detail else ""))
    if not ok: FAIL.append(name)

def rows_by_id(ws, prefix):
    out = {}
    for row in ws.iter_rows():
        aid = row[0].value
        if isinstance(aid, str) and aid.startswith(prefix):
            out[aid] = {c.coordinate[0]: ("" if c.value is None else str(c.value)) for c in row}
    return out

wm = openpyxl.load_workbook(MERGED)
w3 = openpyxl.load_workbook(V03)
qmr, q3 = rows_by_id(wm["بانک سؤال"], "Q-"), rows_by_id(w3["بانک سؤال"], "Q-")
mmr, m3 = rows_by_id(wm["نقشهٔ کتاب (S1)"], "L-"), rows_by_id(w3["نقشهٔ کتاب (S1)"], "L-")

# --- چک‌های هدفمند ---
check("Q-1011 = ۱۳ مثلث → ۱۸ (گزینه‌های ۱۴/۱۶/۸، پاسخ ج)",
      qmr["Q-1011"]["E"].startswith("شکل زیر ۱۳ مثلث") and qmr["Q-1011"]["I"] == "۱۸"
      and qmr["Q-1011"]["G"] == "۱۴" and qmr["Q-1011"]["H"] == "۱۶" and qmr["Q-1011"]["J"] == "۸"
      and qmr["Q-1011"]["K"] == "ج")
check("L-108!N شاهد ۱۳→۱۸", "۱۳ تا" in mmr["L-108"]["N"] and "۱۸" in mmr["L-108"]["N"])
check("L-109!G شامل «قرینه»", "قرینه" in mmr["L-109"]["G"], mmr["L-109"]["G"][:80])
check("L-112!G «خلّق باش»", "خلّق باش" in mmr["L-112"]["G"] and "خلاق" not in mmr["L-112"]["G"])
check("لنگرها: L-110!K=(Q-1017-1019)، L-112!K=(Q-1020)، Q-1020!B=L-112",
      "(Q-1017-1019)" in mmr["L-110"]["K"] and "(Q-1020)" in mmr["L-112"]["K"] and qmr["Q-1020"]["B"] == "L-112")
check("L-114 عنوان = «شمارش ۴تا۴تا» + بدون «سه‌تایی»",
      mmr["L-114"]["D"] == "شمارش ۴تا۴تا" and "سه‌تایی" not in " ".join(mmr["L-114"].values()))
check("L-114 محتوای غنی (خلّق باش ص۱۴ + دسته‌های ۵تایی)", "خلّق باش" in mmr["L-114"]["G"] and "۵تایی" in mmr["L-114"]["G"])

TITLES = {"L-108": "حلّ مسئله", "L-109": "رسم شکل", "L-110": "جمع و تفریق", "L-111": "فعّالیت", "L-112": "تمرین"}
check("عناوین L-108..112 عین بنر", all(mmr[k]["D"] == v for k, v in TITLES.items()),
      str({k: mmr[k]["D"] for k in TITLES}))
check("عناوین تمرین ۴/۷/۱۵ + L-118 خارج از موتور",
      all("عنوان بنری مستقل ندارد" in mmr[k]["D"] for k in ("L-104", "L-107", "L-115"))
      and mmr["L-118"]["D"] == "معمّا و فرهنگ خواندن" and "خارج از موتور" in " ".join(mmr["L-118"].values()))

cpa = {}
for qid, row in qmr.items():
    if "نمونه" in qid: continue
    cpa[row["D"]] = cpa.get(row["D"], 0) + 1
check("CPA ۴۰ ردیف واقعی = ۳۳ علامتی + ۷ تصویری (AUD-06)", cpa == {"علامتی": 33, "تصویری": 7}, str(cpa))

ALLOWED = {"E_SUB_CONFUSION", "E_ADD_CONFUSION", "E_SKIP_UNDERCOUNT", "E_DOUBLE_OFF", "E_GROUPS"}
bad = [(f"Q-{n}", set(re.findall(r"E_[A-Z_]+", qmr[f"Q-{n}"]["L"])) - ALLOWED)
       for n in range(1009, 1025) if set(re.findall(r"E_[A-Z_]+", qmr[f"Q-{n}"]["L"])) - ALLOWED]
check("کدهای Q-1009..1024 ⊆ ۵ کد مجاز", not bad)
bal = {}
for qid, row in qmr.items():
    if "نمونه" not in qid: bal[row["K"]] = bal.get(row["K"], 0) + 1
check("توازن پاسخ ۱۰/۱۰/۱۰/۱۰ (۴۰ واقعی)", bal == {"الف": 10, "ب": 10, "پ": 10, "د": 10}, str(bal))
check("جای پاسخ ۱۶ سؤال مثل v0.3", all(q3[f"Q-{n}"]["K"] == qmr[f"Q-{n}"]["K"] for n in range(1009, 1025)))

# مُهرها
ws_i = wm["شناسنامهٔ خشاب"]
check("مُهرهای شناسنامه سبز (ردیف ۳-۷)", all(ws_i[f"C{r}"].value == "تأییدشده" for r in range(3, 8)))
check("وضعیت = v0.3.1 با قفل موج ۳", "v0.3.1" in str(ws_i["B12"].value) and "موج ۳" in str(ws_i["B12"].value))
check("تاریخ تأیید رسمی", "موج ۱" in str(ws_i["B14"].value))
skel_ok = all("تأیید: کتاب فیزیکی معلم" in mmr[k]["L"] for k in ("L-100", "L-200", "L-300", "L-400", "L-500", "L-600", "L-700", "L-800"))
check("مُهر ۸ ردیف اسکلت سبز", skel_ok)

# اطلس مو به مو v0.3
a = [[("" if c.value is None else str(c.value)) for c in r] for r in w3["اطلس خطا"].iter_rows()]
b = [[("" if c.value is None else str(c.value)) for c in r] for r in wm["اطلس خطا"].iter_rows()]
check("اطلس خطا مو به مو v0.3 (دو کد زرد)", a == b)

# --- دلتا نسبت به رسمی قبلی (c2d511a8) و نسبت به تحویل دوم ---
def celldiff(p1, p2, label):
    w1, w2 = openpyxl.load_workbook(p1), openpyxl.load_workbook(p2)
    n = 0
    print(f"\n== دلتا {label} ==")
    for sh in w1.sheetnames:
        a = [[("" if c.value is None else str(c.value)) for c in r] for r in w1[sh].iter_rows()]
        b = [[("" if c.value is None else str(c.value)) for c in r] for r in w2[sh].iter_rows()]
        for i, (ra, rb) in enumerate(zip(a, b), 1):
            for j, (va, vb) in enumerate(zip(ra, rb)):
                if va != vb:
                    n += 1
                    key = a[i-1][0] or f"ردیف{i}"
                    print(f"  [{sh}!{key}!{chr(65+j)}] {va[:45]!r} → {vb[:45]!r}")
    print(f"  جمع: {n} سلول")
    return n

n_off = celldiff(OFFOLD, MERGED, "رسمی قبلی (c2d511a8) → ادغام v2")
n_red = celldiff(REDEL, MERGED, "تحویل دوم مدل (a386ba15) → ادغام v2")
print("\nنتیجه: FAIL =", FAIL if FAIL else "هیچ — همهٔ چک‌ها سبز ✓")
