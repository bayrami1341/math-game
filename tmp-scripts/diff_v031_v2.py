#!/usr/bin/env python3
"""دیف قطعی v0.3.1 ↔ v0.3 با کلید درست (Q-id / L-id از ستون A)"""
import openpyxl, json

V03 = "/home/z/my-project/public/math-game/authoring/khshab-G2-MATH_v0.3.xlsx"
V031 = "/tmp/v031.xlsx"

def sheet_by_id(path, sheet, prefix):
    wb = openpyxl.load_workbook(path, data_only=False)
    ws = wb[sheet]
    out = {}
    for row in ws.iter_rows():
        aid = row[0].value
        if isinstance(aid, str) and aid.startswith(prefix):
            out[aid] = {c.coordinate[0]: c.value for c in row if c.value is not None}
    return out

q_old = sheet_by_id(V03, "بانک سؤال", "Q-")
q_new = sheet_by_id(V031, "بانک سؤال", "Q-")
m_old = sheet_by_id(V03, "نقشهٔ کتاب (S1)", "L-")
m_new = sheet_by_id(V031, "نقشهٔ کتاب (S1)", "L-")

REWRITE_OK = {f"Q-{n}" for n in range(1009, 1025)}
CPA = {"D"}

print("=== بانک سؤال ===")
unexpected = []
for qid in sorted(set(q_old) | set(q_new)):
    a, b = q_old.get(qid, {}), q_new.get(qid, {})
    if a == b: continue
    changed = {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
    if qid in REWRITE_OK:
        kind = "بازنویسی کامل (مجاز)"
    elif changed <= CPA:
        kind = "فقط CPA (مجاز)"
    else:
        kind = "!! نامجاز"
        unexpected.append(qid)
    print(f"{qid}: {kind} — سلول‌ها: {sorted(changed)}")
    if kind == "!! نامجاز":
        for k in sorted(changed - CPA):
            print(f"    {k}: OLD={str(a.get(k))[:80]!r}")
            print(f"        NEW={str(b.get(k))[:80]!r}")
print("نامجاز در بانک:", unexpected or "هیچ ✓")

print("\n=== نقشهٔ کتاب S1 ===")
MAP_REWRITE_OK = {"L-108", "L-109", "L-110", "L-111", "L-112"}
unexpected_m = []
for lid in sorted(set(m_old) | set(m_new)):
    a, b = m_old.get(lid, {}), m_new.get(lid, {})
    if a == b: continue
    changed = {k for k in set(a) | set(b) if a.get(k) != b.get(k)}
    if lid in MAP_REWRITE_OK:
        kind = "بازنویسی کامل (مجاز)"
    elif changed == {"L"} and str(a.get("L", "")).startswith("پیشنهاد AI — موتور تألیف v۱.۰؛ تأیید:"):
        kind = "فقط مُهر منبع L (ریست مدل → هنگام ادغام بازگردانی می‌شود)"
    else:
        kind = "!! بررسی"
        unexpected_m.append(lid)
    print(f"{lid}: {kind} — سلول‌ها: {sorted(changed)}")
    if kind == "!! بررسی":
        for k in sorted(changed):
            print(f"    {k}: OLD={str(a.get(k))[:100]!r}")
            print(f"        NEW={str(b.get(k))[:100]!r}")
print("بررسی‌شدنی در نقشه:", unexpected_m or "هیچ ✓")

print("\n=== L-114 (بند ۲ اصلاحیه) ===")
print("OLD D:", m_old.get("L-114", {}).get("D"))
print("NEW D:", m_new.get("L-114", {}).get("D"))
print("OLD E:", str(m_old.get("L-114", {}).get("E"))[:90])
print("NEW E:", str(m_new.get("L-114", {}).get("E"))[:90])

# کدهای ۱۶ سؤال بازنویسی‌شده
import re
ALLOWED = {"E_SUB_CONFUSION", "E_ADD_CONFUSION", "E_SKIP_UNDERCOUNT", "E_DOUBLE_OFF", "E_GROUPS"}
bad = []
for n in range(1009, 1025):
    qid = f"Q-{n}"
    codes = set(re.findall(r"E_[A-Z_]+", str(q_new.get(qid, {}).get("L", ""))))
    if not codes <= ALLOWED:
        bad.append((qid, codes - ALLOWED))
print("\nکد بیرون سجل در Q-1009..Q-1024:", bad or "هیچ ✓")

# محتوای کامل Q-1017/Q-1018 (دیده‌نشده در دیف قبلی)
print("\n=== Q-1017 / Q-1018 (کامل) ===")
for qid in ("Q-1017", "Q-1018"):
    print(qid, json.dumps(q_new.get(qid, {}), ensure_ascii=False, default=str)[:600])
