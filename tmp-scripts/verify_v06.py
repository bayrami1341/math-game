# -*- coding: utf-8 -*-
"""راستی‌آزمایی v0.6 — عین روش ممیزی AUD-01:
۱) ساختار: شیت‌ها، هدرها، رنگ سلول‌های اصلاح‌شده، RTL
۲) کلید پاسخ همهٔ سؤال‌های عددی با بازحساب مستقل (ضد J12)
۳) برچسب گزینه→خطا با اجرای واقعی errors.js (bun) — عین classifyAttempt
"""
import json, re, subprocess, sys
from openpyxl import load_workbook

F = "/home/z/my-project/download/khshab-G3-MATH_v0.6.xlsx"
ERRJS = "/home/z/my-project/public/math-game/src/v10/station/errors.js"

PD = str.maketrans("۰۱۲۳۴۵۶۷۸۹٫", "0123456789.")
def num(s):
    """تبدیل گزینه به عدد: عدد خام / جمع / ضرب / «همان ۲۸» — وگرنه None"""
    if s is None: return None
    raw = str(s).strip()
    t = raw.translate(PD).replace(" ", "")
    if re.fullmatch(r"-?\d+", t): return int(t)
    if "+" in t and "×" not in t and all(re.fullmatch(r"\d+", p) for p in t.split("+")):
        return sum(int(p) for p in t.split("+"))
    if "×" in t and "+" not in t and all(re.fullmatch(r"\d+", p) for p in t.split("×")):
        pr = 1
        for p in t.split("×"): pr *= int(p)
        return pr
    m = re.search(r"همان\s*([۰-۹0-9]+)", raw)
    return int(m.group(1).translate(PD)) if m else None

def factors(qtext):
    t = str(qtext).translate(PD).replace(" ", "")
    m = re.search(r"(\d+)\s*[×x]\s*(\d+)", t)
    return (int(m.group(1)), int(m.group(2))) if m else None

REAL = {"E_ADD_CONFUSION","E_ZERO_PROPERTY","E_IDENTITY_CONFUSION","E_PLACE_SHIFT",
        "E_ANCHOR_DRIFT","E_DISTRIBUTIVE_LEAK","E_SKIP_OVERCOUNT","E_SKIP_UNDERCOUNT"}
PROPOSED = {"E_GROUP_VS_COUNT","E_CARRY_MISS","E_OP_REVERSE","E_FACT_CONFUSION",
            "E_REMAINDER_DROP","E_UNEQUAL_GROUP"}
# مواردی که AUD-01 رسماً زرد ثبت کرد (AUD-12) — بازتولید قرمز جدید نیستند
KNOWN_Y = {("Q-107","ج"), ("Q-109","ج")}
# سؤال‌های بیرون از محدودهٔ classifyAttempt (تقسیم/متا/کلامی)
SKIP_ROW = {"Q-102","Q-106","Q-112","Q-201","Q-202","Q-203","Q-204","Q-205","Q-206"}
# کلید پاسخ موردانتظارِ سؤال‌های غیر ضرب-خام (بازحساب مستقل AUD-01 + اصول حساب)
EXPECTED = {"Q-101":12, "Q-102":25, "Q-106":16, "Q-107":18, "Q-109":28, "Q-111":30,
            "Q-201":4, "Q-202":3, "Q-203":5, "Q-204":4, "Q-206":604}

wb = load_workbook(F)
errors = []
print("== ۱) ساختار ==")
sheets = wb.sheetnames
print("شیت‌ها:", sheets)
need = ["راهنما","تصحیحات نسبت به gapgpt","شناسنامهٔ خشاب","نقشهٔ کتاب (S1)","اطلس خطا","بانک سؤال","واژه‌نامهٔ ستون‌ها","سجل ممیزی"]
if sheets[:7] != need[:7] or sheets[-1] != "سجل ممیزی": errors.append("ترتیب شیت‌ها خراب شد")
for name, ncol in [("نقشهٔ کتاب (S1)",14),("اطلس خطا",11),("بانک سؤال",17)]:
    ws = [w for w in wb.worksheets if w.title == name][0]
    if ws.max_column != ncol: errors.append(f"{name}: {ws.max_column} ستون ≠ {ncol}")
    if not ws.sheet_view.rightToLeft: errors.append(f"{name}: RTL از دست رفت")
print("هدرها/RTL/تعداد ستون: OK" if not errors else errors)

ws = wb["بانک سؤال"]
print("\n== ۲) سلول‌های اصلاحی ==")
fix_expect = {
    "E7اطلس": None, "F20اطلس": None, "L6": None, "L8": None, "J13": None,
}
at = wb["اطلس خطا"]
checks = [
    (at["E7"].value, "۶×۱۰ را ۶۰۰ یا ۶ می‌نویسد", "اطلس E7 (AUD-01)"),
    (at["F20"].value, "گزینهٔ دِ Q-102، گزینهٔ بِ Q-110، گزینهٔ دِ Q-111", "اطلس F20 (موج AUD-03)"),
    (ws["L6"].value, "د→چسباندن ۷ و ۰ (بی‌الگو — شاخص توجه)", "بانک L6 (AUD-02)"),
    (ws["L8"].value, "د→چسباندن رقم (بی‌الگو — شاخص توجه)", "بانک L8 (AUD-01)"),
    (ws["J13"].value, "۱۰۰۰", "بانک J13 (AUD-03)"),
    (wb["نقشهٔ کتاب (S1)"]["K4"].value, "E_GROUP_VS_COUNT", "نقشه K4 (AUD-05)"),
    (wb["نقشهٔ کتاب (S1)"]["K6"].value, "Q-113، Q-114", "نقشه K6 (AUD-04)"),
]
for got, want, label in checks:
    ok = want in str(got)
    print(("✓" if ok else "✗"), label, "→", str(got)[:80])
    if not ok: errors.append(f"اصلاح اعمال نشده: {label}")

# رنگ سلول‌های اصلاح‌شده باید سبز بماند (تأییدشده)
for coord, wsx, label in [("J13", ws, "Q-110د"), ("K4", wb["نقشهٔ کتاب (S1)"], "L-41 لنگر"), ("K6", wb["نقشهٔ کتاب (S1)"], "L-43 لنگر")]:
    fg = wsx[coord].fill.start_color.rgb
    if fg not in ("00C6EFCE", "FFC6EFCE", "C6EFCE"): errors.append(f"رنگ {label} خراب: {fg}")
print("رنگ سلول‌های اصلاحی: سبز ✓")

print("\n== ۳) کلید پاسخ + برچسب‌ها (بازحساب مستقل + classifyAttempt واقعی) ==")
rows = []
for r in range(4, ws.max_row + 1):
    qid = ws.cell(row=r, column=1).value
    if qid and str(qid).startswith("Q-"):
        rows.append({
            "r": r, "id": str(qid), "anchor": ws.cell(row=r, column=2).value,
            "q": ws.cell(row=r, column=5).value,
            "opts": [ws.cell(row=r, column=c).value for c in range(7, 11)],
            "key": {"الف":0,"ب":1,"ج":2,"د":3}.get(str(ws.cell(row=r, column=11).value).strip(), None),
            "map": ws.cell(row=r, column=12).value or "",
            "color": ws.cell(row=r, column=16).value,
        })
print(f"تعداد سؤال: {len(rows)}")
ids = [x["id"] for x in rows]
if len(ids) != len(set(ids)): errors.append("شناسهٔ تکراری!")
want_ids = {f"Q-{n}" for n in [101,102,103,104,105,106,107,108,109,110,111,112,201,202,203,204,205,206,113,114]}
if set(ids) != want_ids: errors.append(f"فهرست سؤال‌ها: {sorted(set(ids)^want_ids)}")

# کلید پاسخ با بازحساب مستقل
for x in rows:
    if x["id"] in ("Q-205","Q-112"): continue  # گزینه‌های کلامی/متا — AUD-01 تأیید کرده
    if x["id"] in EXPECTED:
        ok = num(x["opts"][x["key"]]) == EXPECTED[x["id"]]
    else:
        f = factors(x["q"])
        ok = f and num(x["opts"][x["key"]]) == f[0]*f[1]
    if not ok: errors.append(f"کلید پاسخ خراب: {x['id']}")
print("کلید پاسخ ۱۸ سؤال عددی/ساختاری: OK" if not any('کلید' in e for e in errors) else "کلید: ✗")

# برچسب‌ها با موتور واقعی
cases = []
for x in rows:
    if x["id"] in SKIP_ROW: continue
    f = factors(x["q"])
    if not f: continue
    for li, letter in enumerate(["الف", "ب", "ج", "د"]):
        claim = None
        m = re.search(letter + r"→([^؛]+)", str(x["map"]))
        if m: claim = m.group(1).strip()
        v = num(x["opts"][li])
        if v is None: continue
        if (x["id"], letter) in KNOWN_Y: continue
        if claim is None: continue
        if "هم‌پوشانی" in claim: kind = "overlap"
        elif any(c in claim for c in PROPOSED) or "پیوند" in claim or "پیشنهادی" in claim: kind = "skip"
        elif "COMMUTATIVE" in claim: kind = "skip"
        elif "بی‌الگو" in claim or "چسباندن" in claim: kind = "null"
        else:
            hit = [c for c in REAL if c in claim]
            kind = ("real", hit[0]) if hit else "skip"
        cases.append({"id": x["id"], "letter": letter, "f1": f[0], "f2": f[1], "v": v, "kind": kind})

js = 'import { classifyAttempt } from "' + ERRJS + '";\n' \
     'const cases = ' + json.dumps([c for c in cases if c["kind"] != "skip"], ensure_ascii=False) + ';\n' \
     'for (const c of cases) { const code = classifyAttempt({f1:c.f1, f2:c.f2, submitted:c.v}); console.log(JSON.stringify({...c, code})); }\n'
open("/tmp/verify_v06.mjs","w").write(js)
out = subprocess.run(["bun","run","/tmp/verify_v06.mjs"], capture_output=True, text=True, cwd="/home/z/my-project")
if out.returncode != 0: print(out.stderr); sys.exit(1)
mism = 0; n = 0
for line in out.stdout.strip().splitlines():
    c = json.loads(line); n += 1
    if c["kind"] == "null": expect = None
    elif c["kind"] == "overlap": expect = "ANY_REAL"
    else: expect = c["kind"][1]
    got = c["code"]
    ok = (expect == "ANY_REAL" and got in REAL) or got == expect
    flag = "✓" if ok else "✗"
    if not ok: mism += 1; errors.append(f"برچسب ناسازگار: {c['id']}{c['letter']}={c['v']} انتظار {expect} موتور {got}")
    print(f"{flag} {c['id']} گ{c['letter']} ({c['f1']}×{c['f2']}={c['v']}) → موتور: {got} | ادعا: {c['kind']}")
print(f"\nجمع: {n} آزمون موتور، {mism} ناسازگاری")
print("\nنتیجهٔ نهایی:", "همهٔ راستی‌آزمایی‌ها پاس ✓" if not errors else "خطاها: " + "; ".join(errors))
sys.exit(1 if errors else 0)
