# -*- coding: utf-8 -*-
import openpyxl
from collections import Counter
her = openpyxl.load_workbook('tmp-arena-delivery/authoring/khshab-G2-MATH_v0.4.xlsx', data_only=True)
out = openpyxl.load_workbook('public/math-game/authoring/khshab-G2-MATH_v0.4.xlsx', data_only=True)
hs, os_ = her['بانک سؤال'], out['بانک سؤال']
# duplicate keys in her file?
keys = []
for r in range(2, hs.max_row+1):
    v = hs.cell(r,1).value
    if v is None: continue
    s = str(v).strip()
    if s=='یادداشت': continue
    keys.append(s)
dups = [k for k,c in Counter(keys).items() if c>1]
print('her bank rows:', len(keys), 'dups:', dups)
# merged ranges in her sheet vs official
print('her merged:', sorted(str(m) for m in hs.merged_cells.ranges))
print('out merged:', sorted(str(m) for m in os_.merged_cells.ranges))
# where is یادداشت in each?
for name, ws in [('her', hs), ('out', os_)]:
    for r in range(1, ws.max_row+1):
        v = ws.cell(r,1).value
        if v and str(v).strip()=='یادداشت':
            print(f'{name}: یادداشت at row {r}, max_row={ws.max_row}')
            break
# Q-1043 in output file
for r in range(1, os_.max_row+1):
    v = os_.cell(r,1).value
    if v and str(v).strip()=='Q-1043':
        print(f'out: Q-1043 at row {r} →', [os_.cell(r,c).value for c in range(1,6)])
# rows 43..48 of output
for r in range(42, 50):
    print('out row', r, ':', repr(os_.cell(r,1).value)[:30], '|', repr(os_.cell(r,5).value)[:40])
