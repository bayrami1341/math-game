# -*- coding: utf-8 -*-
"""دیف قطعی موج ۳: v0.4 (تحویل آرنا) ↔ v0.3.1 (رسمی) — کلید ستون A + چک مُهرها"""
import openpyxl, json, re
from collections import Counter

OFF = 'public/math-game/authoring/khshab-G2-MATH_v0.3.1.xlsx'
NEW = 'public/math-game/authoring/khshab-G2-MATH_v0.4.xlsx'

wb_o, wb_n = openpyxl.load_workbook(OFF, data_only=True), openpyxl.load_workbook(NEW, data_only=True)
print('sheets OFF:', wb_o.sheetnames)
print('sheets NEW:', wb_n.sheetnames)
print('sheet names identical:', wb_o.sheetnames == wb_n.sheetnames)

def rows_of(ws, key_col=1):
    """ردیف‌ها با کلید ستون A (ردیف هدر=1) — حذف سطر یادداشت و نمونه‌ها"""
    out = {}
    header = None
    for r in ws.iter_rows(min_row=1, values_only=False):
        vals = [c.value for c in r]
        key = vals[0]
        if header is None:
            if key: header = vals
            continue
        if key is None: continue
        if str(key).strip() in ('یادداشت','نمونه:','نمونه: …'): break
        out[str(key).strip()] = vals
    return header, out

report = {}
for sheet in wb_o.sheetnames:
    if sheet not in wb_n.sheetnames: report[sheet]='MISSING'; continue
    so, sn = wb_o[sheet], wb_n[sheet]
    ho, ro = rows_of(so); hn, rn = rows_of(sn)
    hdr_same = (ho == hn)
    added   = sorted(set(rn) - set(ro))
    removed = sorted(set(ro) - set(rn))
    changed = []
    for k in sorted(set(ro) & set(rn)):
        if [str(v) for v in ro[k]] != [str(v) for v in rn[k]]:
            diffs = {i+1: (ro[k][i], rn[k][i]) for i in range(len(ho or [])) if (ro[k][i] if i<len(ro[k]) else None) != (rn[k][i] if i<len(rn[k]) else None)}
            changed.append((k, diffs))
    report[sheet] = dict(header_same=hdr_same, added=added, removed=removed, changed=changed)

print('\n===== SUMMARY =====')
for s, r in report.items():
    if r == 'MISSING': print(f'[{s}] MISSING'); continue
    print(f'[{s}] header_same={r["header_same"]} | added={len(r["added"])} removed={len(r["removed"])} changed={len(r["changed"])}')
    for a in r['added']: print('   +', a)
    for d in r['removed']: print('   -', d)
    for k, diffs in r['changed']:
        print(f'   ~ {k}:')
        for col, (a,b) in diffs.items():
            print(f'      col{col}: {repr(a)[:60]} -> {repr(b)[:60]}')
