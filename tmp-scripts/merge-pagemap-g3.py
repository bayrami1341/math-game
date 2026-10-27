#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ادغام ۱۷ چانک نقشهٔ مادر G3 + آشتی‌دهی هم‌پوشانی + اعتبارسنجی ساختاری — تسک ۵۶ (§6.7)"""
import json, glob, sys
from collections import defaultdict

CHUNK_DIR = 'authoring/page-map-chunks-g3'
ORDER = ['chunk-a1.json','chunk-a2.json','chunk-b1s.json','chunk-b2.json','chunk-c1.json',
         'chunk-c2.json','chunk-d1.json','chunk-d2.json','chunk-e1.json','chunk-e2.json',
         'chunk-f1.json','chunk-f2s.json','chunk-g1.json','chunk-g2.json','chunk-h1a1.json',
         'chunk-h1a2.json','chunk-h1b.json']

REQUIRED_KEYS = ['pdfPage','bookPage','kind','section','chapter','banner','pageType','lessonNo',
                 'elements','exerciseCount','keyNumbers','manipulatives','isGame','confidence','notes']

def norm_conf(v):
    if v is None: return 'متوسط'
    s = str(v).strip().lower()
    if s in ('بالا','high','0.9','0.95','0.85','0.9+','زیاد'): return 'بالا'
    if s in ('متوسط','medium','mid','0.7','0.75','0.8'): return 'متوسط'
    if s in ('پایین','low','کم','0.5','0.6'): return 'پایین'
    try:
        f = float(s)
        return 'بالا' if f >= 0.85 else ('متوسط' if f >= 0.7 else 'پایین')
    except Exception:
        return 'متوسط'

def norm_banner(b):
    if b is None: return None
    s = str(b).strip()
    return s if s and s not in ('null','None','—','') else None

# ۱) بارگذاری همهٔ چانک‌ها
by_page = defaultdict(list)   # pdfPage -> [(chunkId, record)]
chunk_stats = []
for name in ORDER:
    try:
        d = json.load(open(f'{CHUNK_DIR}/{name}', encoding='utf-8'))
    except Exception as e:
        print(f'❌ چانک خراب: {name}: {e}'); sys.exit(1)
    cid, rng, pages = d['chunkId'], d['pdfRange'], d['pages']
    ok = True
    for r in pages:
        missing = [k for k in REQUIRED_KEYS if k not in r]
        if missing:
            print(f'❌ {name} ص{r.get("pdfPage")}: کلید ناقص {missing}'); ok = False; continue
        r['_conf'] = norm_conf(r.get('confidence'))
        r['_banner'] = norm_banner(r.get('banner'))
        by_page[r['pdfPage']].append((cid, r))
    chunk_stats.append((cid, rng, len(pages), ok))

print('== چانک‌ها ==')
for cid, rng, n, ok in chunk_stats:
    print(f'  {cid}: {rng} → {n} صفحه {"✓" if ok else "✗"}')

# ۲) پوشش کامل ۱..۱۵۲
all_pages = sorted(by_page)
missing = [p for p in range(1, 153) if p not in by_page]
extra = [p for p in all_pages if not (1 <= p <= 152)]
print(f'\n== پوشش == رکورد صفحه‌ها: {len(all_pages)} | جاافتاده: {missing or "صفر ✓"} | بیرون بازه: {extra or "صفر ✓"}')
if missing or extra: sys.exit(1)

# ۳) آشتی‌دهی هم‌پوشانی‌ها
def conf_rank(c): return {'بالا':2,'متوسط':1,'پایین':0}[c]
merged = {}
reconciliation = []
overlap_pages = [p for p in all_pages if len(by_page[p]) > 1]
for p in all_pages:
    cands = by_page[p]
    if len(cands) == 1:
        merged[p] = dict(cands[0][1])
        continue
    # انتخاب رکورد اصلی: اطمینان بالاتر، بعد عناصر بیشتر
    cands_sorted = sorted(cands, key=lambda x: (conf_rank(x[1]['_conf']), len(x[1]['elements'])), reverse=True)
    cid_main, main = cands_sorted[0]
    rec = dict(main)
    flags = []
    for cid_other, other in cands_sorted[1:]:
        # مقایسهٔ فیلدهای کلیدی
        if norm_banner(main.get('banner')) != norm_banner(other.get('banner')):
            flags.append(('banner', norm_banner(main.get('banner')), norm_banner(other.get('banner'))))
        if main.get('pageType') != other.get('pageType'):
            flags.append(('pageType', main.get('pageType'), other.get('pageType')))
        if int(main.get('exerciseCount') or 0) != int(other.get('exerciseCount') or 0):
            flags.append(('exerciseCount', main.get('exerciseCount'), other.get('exerciseCount')))
        # ادغام مکملی
        for f in ('keyNumbers','manipulatives'):
            for v in (other.get(f) or []):
                if v not in (rec.get(f) or []): rec.setdefault(f, []).append(v)
        other_notes = str(other.get('notes') or '').strip()
        if other_notes and other_notes not in str(rec.get('notes') or ''):
            rec['notes'] = f"{rec.get('notes') or ''} | [{cid_other}] {other_notes}".strip(' |')
        if len(other.get('elements') or []) > len(rec.get('elements') or []):
            # عناصر رکورد دوم غنی‌تر است ولی رکورد اول مرجع حکم می‌ماند؛ یادداشت می‌شود
            flags.append(('elements-rich', cid_other, len(other['elements'])))
    if flags:
        rec.setdefault('notes', '')
        rec['notes'] = (rec['notes'] + ' | فلگ آشتی‌دهی: ' + '; '.join(f"{k}={a}/{b}" for k,a,b in flags)).strip(' |')
        rec['_reconciled'] = True
    merged[p] = rec
    for k, a, b in flags:
        reconciliation.append({'pdfPage': p, 'field': k, 'main': a, 'other': b, 'chunkMain': cid_main})

print(f'\n== آشتی‌دهی == صفحات هم‌پوشان: {len(overlap_pages)} → {overlap_pages}')
print(f'   مغایرت‌های ثبت‌شده: {len(reconciliation)}')
for r in reconciliation:
    print(f"   ص{r['pdfPage']} [{r['chunkMain']}] {r['field']}: {str(r['main'])[:40]} ≠ {str(r['other'])[:40]}")

# ۴) اعتبارسنجی ساختاری
print('\n== اعتبارسنجی ساختاری ==')
bad_book = [p for p, r in merged.items() if r['bookPage'] != p]
print(f'  bookPage=pdfPage: {"✓ همه" if not bad_book else f"✗ {bad_book}"}')

CH_START = {1:7, 2:25, 3:43, 4:61, 5:79, 6:97, 7:115, 8:133}
CH_END   = {1:24, 2:42, 3:60, 4:78, 5:96, 6:114, 7:132, 8:150}
ch_ok = True
for ch, s in CH_START.items():
    pages_ch = [p for p, r in merged.items() if r.get('chapter') == ch]
    lo, hi = min(pages_ch), max(pages_ch)
    banner = merged[s]['_banner']
    ok = (lo == s and hi == CH_END[ch])
    ch_ok &= ok
    print(f'  فصل {ch}: بازهٔ رکورد {lo}–{hi} (انتظار {s}–{CH_END[ch]}) {"✓" if ok else "✗"} | بنر ص{s}: {banner!r}')
    if merged[s].get('chapter') != ch:
        ch_ok = False; print(f'    ✗ chapter فیلد ص{s} = {merged[s].get("chapter")}')
kind_pre  = sorted(p for p, r in merged.items() if r['kind'] == 'پیش‌صفحه')
kind_post = sorted(p for p, r in merged.items() if r['kind'] == 'پس‌صفحه')
print(f'  پیش‌صفحه‌ها: {kind_pre} (انتظار ۱–۶)')
print(f'  پس‌صفحه‌ها: {kind_post} (انتظار ۱۵۱–۱۵۲)')

# ۵) آمار کلی
total_ex = sum(int(r.get('exerciseCount') or 0) for r in merged.values())
games = sorted(p for p, r in merged.items() if r.get('isGame'))
conf_dist = defaultdict(int)
for r in merged.values(): conf_dist[r['_conf']] += 1
multibanner = sorted(p for p, r in merged.items() if 'چندبنری' in str(r.get('notes') or ''))
visual = sorted(p for p, r in merged.items() if 'نیازمند تأیید تصویری' in str(r.get('notes') or ''))
reconciled = sorted(p for p, r in merged.items() if r.get('_reconciled'))
print(f'\n== آمار == تمرین شماره‌دار: {total_ex} | بازی/گروهی: {len(games)} → {games}')
print(f'  اطمینان: {dict(conf_dist)} | چندبنری: {multibanner} | تصویری: {len(visual)} صفحه | آشتی‌دهی: {reconciled}')

# ۶) بنرهای اصلی هر فصل (برای گزارش)
print('\n== بنرها/سرصفحه‌های هر فصل (صفحات با banner) ==')
for ch, s in CH_START.items():
    for p in range(s, CH_END[ch] + 1):
        b = merged[p]['_banner']
        if b: print(f'  فصل{ch} ص{p}: {b}')

# ۷) ذخیرهٔ مادهٔ ادغامی
out = {'pages': {str(p): {k: v for k, v in r.items() if not k.startswith('_')} for p, r in merged.items()},
       'reconciliation': reconciliation}
json.dump(out, open('tmp-scripts/merged-g3.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n✓ مادهٔ ادغامی → tmp-scripts/merged-g3.json')
