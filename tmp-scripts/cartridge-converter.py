#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cartridge-converter — مبدل Excel→JSON خط تولید «خشاب» (کارگاه ضرب و خشاب‌های آینده)
═══════════════════════════════════════════════════════════════════════════════════

نقش در معماری:  اکسل (قالب تألیف) → [این مبدل] → JSON اجرایی در مرورگر
قرارداد مشترک:  public/math-game/src/v10/station/cartridge-schema.js
                 (این اسکریپت پورتِ پایتونی همان قواعد اعتبارسنجی است.)

قواعد تبدیل = پرامپت ممیز T1..T7 (download/prompt-audit-cartridge-fa.md)
              + رسیدهای ممیزی AUD-01 (بازحساب مستقل ضد J12)
              + زردهای رسمی ثبت‌شدهٔ AUD (AUD-06/07/08/12)

* رنگ فیل سلول «رنگ اعتبار»: سبز C6EFCE=«تأییدشده» | زرد FFEB9C=«نیاز به تأیید»
  | قرمز FFC7CE=«ایراد» → ردیف قرمز به JSON نمی‌رود و قرمز بلوکه‌کننده است.
* ضد J12: برای سؤالِ فرم خام «a×b = ؟» گزینهٔ پاسخ با حاصل بازحسابی چک می‌شود؛
  سؤال‌های غیرخام با «رسیدهای ممیزی» (AUDIT_ANSWER_RECEIPTS).
* مالکیت متقاطع (T7): لنگر هر سؤال باید در نقشهٔ کتاب باشد و لنگرهای سلولِ
  نقشهٔ کتاب باید دقیقاً با مالکان واقعی در بانک سؤال برابر باشد.
* fail-closed: حتی یک قرمز → JSON نوشته نمی‌شود؛ فقط گزارش md ساخته می‌شود.
* عام‌پذیری: شناسهٔ خشاب و مسیرها از xlsx/پارامتر خوانده می‌شود؛ هیچ مسیر یا
  شناسه‌ای برای KH-G3-MATH هاردکد نشده (فقط رسیدهای ممیزی و نقشه‌های نیمه‌تزئینی
  که سند ممیزی رسمی‌اند، به‌عنوان جدول نسخه‌دار داخل فایل نگهداری می‌شوند).

مصرف:
  python3 cartridge-converter.py --input X.xlsx --out-json Y.json --out-report Z.md
کد خروج: 0 = مجاز (JSON منتشر شد) | 1 = گیت قرمز (فقط گزارش) | 2 = خطای ساختاری
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook

# ─────────────────────────────────────────────────────────────────────────────
# ۰) ثابت‌های قرارداد (هم‌قرارداد با cartridge-schema.js)
# ─────────────────────────────────────────────────────────────────────────────

FORMAT_VERSION = '1.0'
TOOL_NAME = 'cartridge-converter v1.0'

STATUS_CONFIRMED = 'تأییدشده'
STATUS_PROPOSED = 'نیاز به تأیید'
STATUS_ERROR = 'ایراد'

# نگاشت رنگ فیل سلول «رنگ اعتبار» → وضعیت (قاعدهٔ رنگ راهنما + واژه‌نامه)
FILL_STATUS = {
    'C6EFCE': STATUS_CONFIRMED,   # سبز
    'FFEB9C': STATUS_PROPOSED,    # زرد
    'FFC7CE': STATUS_ERROR,       # قرمز
}
KNOWN_STATUSES = {STATUS_CONFIRMED, STATUS_PROPOSED, STATUS_ERROR}

OPTION_LETTERS = ('الف', 'ب', 'ج', 'د')
LETTER_INDEX = {l: i for i, l in enumerate(OPTION_LETTERS)}

FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

# کدهای ۱۲گانهٔ واقعی errors.js v10.2.0 (ERROR_CODES) — T5
REAL_CODES = frozenset({
    'E_ADD_CONFUSION', 'E_ZERO_PROPERTY', 'E_IDENTITY_CONFUSION', 'E_COMMUTATIVE_FAIL',
    'E_SKIP_OVERCOUNT', 'E_SKIP_UNDERCOUNT', 'E_ANCHOR_DRIFT', 'E_DOUBLING_HALVING',
    'E_PLACE_SHIFT', 'E_DISTRIBUTIVE_LEAK', 'E_PERSISTENT_GUESSING', 'E_FATIGUE_SLIP',
})

# رسیدهای ممیزی — مقدار عددی درستِ گزینهٔ پاسخ (بازحساب مستقل AUD-01 §تأییدهای سبز
# + ممیزی مجدد ماشینی v0.6). برای هر خشاب جدید این جدول باید از سند ممیزی همان
# خشاب به‌روزرسانی شود؛ سؤال‌های فرم خام a×b=؟ از این جدول مستثنی‌اند (بازحساب می‌شوند).
AUDIT_ANSWER_RECEIPTS = {
    'Q-101': 12, 'Q-102': 25, 'Q-103': 0, 'Q-104': 9, 'Q-105': 60, 'Q-106': 16,
    'Q-107': 18, 'Q-108': 72, 'Q-109': 28, 'Q-110': 100, 'Q-111': 30,
    'Q-113': 56, 'Q-114': 54,
    'Q-201': 4, 'Q-202': 3, 'Q-203': 5, 'Q-204': 4, 'Q-206': 604,
    # Q-112 (متای گره) و Q-205 (گزینه‌های کلامی) — بدون رسید عددی؛ AUD-01 تأیید کرده
}

# نقشه‌های نیمه‌تزئینی که AUD-01 رسماً زرد ثبت کرد (AUD-12) — هشدار، نه قرمز
KNOWN_HALF_MAPS = frozenset({('Q-107', 'ج'), ('Q-109', 'ج')})

# enumهای پیش‌فرض — در اجرا از شیت واژه‌نامه خوانده می‌شوند (این‌ها فقط fallbackاند)
FALLBACK_CPA = ['مجسم', 'تصویری', 'علامتی']
FALLBACK_ENGINE = ['تعاملی-عمیق', 'بانک تمرین', 'خارج از موتور']
FALLBACK_CATEGORY = ['مفهومی', 'راهبردی', 'محاسباتی', 'بازیابی', 'رفتاری', 'توجهی']
# توکِلهای مجازِ اضافه در «رده» (توصیف‌های مستند اطلس، AUD-08: توصیف اضافه به یادداشت)
CATEGORY_EXTRA_TOKENS = {'اختیاری'}

ZWNJ = '\u200c'


# ─────────────────────────────────────────────────────────────────────────────
# ۱) ابزارهای متن
# ─────────────────────────────────────────────────────────────────────────────

def to_latin(s):
    """تبدیل ارقام فارسی به لاتین (فقط برای مقایسه/محاسبه؛ متن خروجی دست نمی‌خورد)."""
    return ''.join(str(FA_DIGITS.index(ch)) if ch in FA_DIGITS else ch for ch in str(s))


def norm(s):
    """نرمال‌سازی سبک برای تطبیق سرستون‌ها/نام شیت‌ها: حذف ZWNJ و فاصله‌های اضافی."""
    return re.sub(r'\s+', ' ', str(s or '').replace(ZWNJ, '')).strip()


def cell_text(v):
    """متن امن سلول؛ None → None (تبدیل محتواسازی نمی‌کند)."""
    if v is None:
        return None
    if isinstance(v, str):
        return v
    return str(v)


def norm_text(v):
    """متن داده‌ای سلول با نرمال‌سازی فاصله‌ها: فروپاشی هر رشتهٔ فاصله/تب/سطر جدید
    به یک فاصله + حذف ابتدا/انتها (همان رفتار مبدل مرجع؛ هیچ محتوایی اضافه/کم نمی‌شود)."""
    if v is None:
        return None
    t = v if isinstance(v, str) else str(v)
    return re.sub(r'\s+', ' ', t).strip()


def fill_status(cell):
    """رنگ فیل سلول → وضعیت؛ ناشناخته → None."""
    try:
        rgb = cell.fill.start_color.rgb
        if isinstance(rgb, str):
            tail = rgb[-6:].upper()
            if tail in FILL_STATUS:
                return FILL_STATUS[tail]
    except Exception:
        pass
    return None


def row_status(cell):
    """وضعیت ردیف از رنگ فیل (مرجع) با بازگشت به متن سلول؛ ناهم‌خوانی رنگ/متن گزارش می‌شود."""
    by_fill = fill_status(cell)
    by_text = None
    t = cell_text(cell.value)
    if t is not None and t.strip() in KNOWN_STATUSES:
        by_text = t.strip()
    if by_fill and by_text and by_fill != by_text:
        return by_fill, f'رنگ=«{by_fill}» ولی متن سلول=«{by_text}»'
    if by_fill:
        return by_fill, None
    if by_text:
        return by_text, None
    return STATUS_PROPOSED, None  # سلول بی‌رنگ و بی‌متن → محتاطانه زرد


def iso_now():
    dt = datetime.now(timezone.utc)
    return f'{dt:%Y-%m-%dT%H:%M:%S}.{dt.microsecond // 1000:03d}Z'


# ─────────────────────────────────────────────────────────────────────────────
# ۲) پورت موتور تشخیص (errors.js v10.2.0 — classifyAttempt) برای T6
# ─────────────────────────────────────────────────────────────────────────────

def classify_attempt(f1, f2, submitted):
    """پورت خط‌به‌خط classifyAttempt؛ خروجی: کد خطا یا None (درست/بی‌الگو)."""
    if not all(isinstance(x, int) for x in (f1, f2, submitted)):
        return None
    if f1 < 0 or f2 < 0 or f1 > 999 or f2 > 999:
        return None
    if submitted < 0 or submitted > 9999:
        return None

    p = f1 * f2
    if submitted == p:
        return None  # پاسخ درست

    # ۱. ضرب در صفر
    if f1 == 0 or f2 == 0:
        other = max(f1, f2)
        if submitted == other or submitted == 1:
            return 'E_ZERO_PROPERTY'
        return None

    # ۲. ضرب در یک
    if (f1 == 1 or f2 == 1) and submitted == 1:
        return 'E_IDENTITY_CONFUSION'

    # ۳. جمع به جای ضرب
    if f1 >= 2 and f2 >= 2 and submitted == f1 + f2:
        return 'E_ADD_CONFUSION'

    # ۴. لغزش صفر (ارزش مکانی)
    if p > 0 and (submitted == p * 10 or (p % 10 == 0 and submitted == p // 10)):
        return 'E_PLACE_SHIFT'

    # ۵. جا ماندن جزء دوم شکستن (لنگر ۵)
    if f2 > 5 and submitted == f1 * 5:
        return 'E_ANCHOR_DRIFT'
    if f1 > 5 and submitted == f2 * 5:
        return 'E_ANCHOR_DRIFT'

    # ۶. جا ماندن یک جزء چندرقمی
    if f2 >= 11 and 2 <= f1 <= 9:
        tens, ones = divmod(f2, 10)
        if ones > 0 and submitted == f1 * ones:
            return 'E_DISTRIBUTIVE_LEAK'
        if tens > 0 and submitted in (f1 * tens, f1 * tens * 10):
            return 'E_DISTRIBUTIVE_LEAK'
    if f1 >= 11 and 2 <= f2 <= 9:
        tens, ones = divmod(f1, 10)
        if ones > 0 and submitted == f2 * ones:
            return 'E_DISTRIBUTIVE_LEAK'
        if tens > 0 and submitted in (f2 * tens, f2 * tens * 10):
            return 'E_DISTRIBUTIVE_LEAK'

    # ۷ و ۸. بیش/کم‌شماری جهش
    if f2 >= 2 and submitted == p + f2:
        return 'E_SKIP_OVERCOUNT'
    if f2 >= 2 and submitted == p - f2:
        return 'E_SKIP_UNDERCOUNT'
    if f1 >= 2 and submitted == p + f1:
        return 'E_SKIP_OVERCOUNT'
    if f1 >= 2 and submitted == p - f1:
        return 'E_SKIP_UNDERCOUNT'

    return None


# ─────────────────────────────────────────────────────────────────────────────
# ۳) پورت تجزیه‌گرهای قرارداد (cartridge-schema.js)
# ─────────────────────────────────────────────────────────────────────────────

def parse_option_value(raw):
    """مقدار عددی گزینه: عدد خام / جمع / ضرب / «همان N» — وگرنه None."""
    if raw is None:
        return None
    text = str(raw).strip()
    t = re.sub(r'\s+', '', to_latin(text))
    if re.fullmatch(r'-?\d+', t):
        return int(t)
    if '+' in t and '×' not in t and all(re.fullmatch(r'\d+', p) for p in t.split('+')):
        return sum(int(p) for p in t.split('+'))
    if '×' in t and '+' not in t and all(re.fullmatch(r'\d+', p) for p in t.split('×')):
        prod = 1
        for p in t.split('×'):
            prod *= int(p)
        return prod
    m = re.search(r'همان\s*([۰-۹0-9]+)', text)
    return int(to_latin(m.group(1))) if m else None


def parse_plain_multiplication(prompt):
    """فرم ضربِ خام «a×b = ؟» → {f1, f2}؛ وگرنه None (فقط این‌ها بازحساب مستقیم می‌شوند)."""
    m = re.match(r'^\s*([0-9۰-۹]+)\s*[×x]\s*([0-9۰-۹]+)\s*=\s*؟\s*$', str(prompt or '').strip())
    if not m:
        return None
    return {'f1': int(to_latin(m.group(1))), 'f2': int(to_latin(m.group(2)))}


def extract_multiplication_factors(prompt):
    """عامل‌های ضرب درون متن سؤال (حتی غیرخام)؛ ÷ یا ☐ → None."""
    text = str(prompt or '')
    if '÷' in text or '☐' in text:
        return None
    m = re.search(r'([0-9۰-۹]+)\s*[×x]\s*([0-9۰-۹]+)', text)
    if not m:
        return None
    return {'f1': int(to_latin(m.group(1))), 'f2': int(to_latin(m.group(2)))}


def parse_claims(map_text):
    """«الف→…؛ ب→…» → [{letter, claim}] — با همان برشِ ؛ قرارداد schema."""
    out = []
    text = str(map_text or '')
    for letter in OPTION_LETTERS:
        m = re.search(re.escape(letter) + r'→([^؛]+)', text)
        if m:
            out.append({'letter': letter, 'claim': m.group(1).strip()})
    return out


def extract_q_refs(text):
    """ارجاع‌های Q- درون سلول، با گسترش «Q-۱۰۳ تا Q-۱۰۵»."""
    t = str(text or '')
    refs, consumed = [], []
    for m in re.finditer(r'Q-([0-9۰-۹]+)\s*تا\s*Q-([0-9۰-۹]+)', t):
        a, b = int(to_latin(m.group(1))), int(to_latin(m.group(2)))
        if b >= a and b - a < 50:
            refs.extend(f'Q-{i}' for i in range(a, b + 1))
        consumed.append(m.group(0))
    rest = t
    for c in consumed:
        rest = rest.replace(c, ' ')
    refs.extend(re.findall(r'Q-[0-9۰-۹]+', rest))
    return refs


def claim_code(claim):
    m = re.search(r'E_[A-Z_]+', str(claim or ''))
    return m.group(0) if m else None


# ─────────────────────────────────────────────────────────────────────────────
# ۴) خواندن xlsx (یافتن شیت با کلیدواژه، سرستون با نام — نه موقعیت ثابت)
# ─────────────────────────────────────────────────────────────────────────────

SHEET_KEYS = {
    'identity': 'شناسنامه',
    'bookmap': 'نقشهٔ کتاب',
    'atlas': 'اطلس خطا',
    'bank': 'بانک سؤال',
    'glossary': 'واژه‌نامه',
    'audit': 'سجل ممیزی',
}
# کلید سرستونِ شناسگر هر شیت (برای یافتن ردیف هدر)
HEADER_ANCHOR = {
    'identity': 'فیلد',
    'bookmap': 'شناسه (L-)',
    'atlas': 'کد (E-)',
    'bank': 'شناسه (Q-)',
    'glossary': 'شیت',
    'audit': 'شناسهٔ یافته',
}
REQUIRED_SHEETS = ('identity', 'bookmap', 'atlas', 'bank', 'glossary', 'audit')

FOOTER_MARKS = ('یادداشت',)  # ردیف‌های پانویس شیت‌ها که داده نیستند


def find_sheet(wb, key):
    """شیت را با کلیدواژه (مقاوم به ZWNJ/پسوند) پیدا می‌کند."""
    needle = norm(SHEET_KEYS[key]).replace(' ', '')
    for ws in wb.worksheets:
        title = norm(ws.title).replace(' ', '')
        if needle in title:
            return ws
    return None


def header_map(ws, anchor_label, max_scan=10):
    """نقشه «سرستون نرمال‌شده → اندیس ستون» برای اولین ردیفی که ستونِ لنگر آن = anchor."""
    for r in range(1, min(ws.max_row, max_scan) + 1):
        cols = {}
        for c in range(1, ws.max_column + 1):
            h = norm(ws.cell(row=r, column=c).value)
            if h:
                cols.setdefault(h, c)
        if anchor_label in cols:
            return r, cols
    return None, {}


def iter_data_rows(ws, header_row, cols, id_col):
    """ردیف‌های داده: از بعد هدر تا ردیف پانویس/تهی. پانویس = «یادداشت»/«قاعدهٔ»/«نتیجه»."""
    for r in range(header_row + 1, ws.max_row + 1):
        idv = cell_text(ws.cell(row=r, column=id_col).value)
        any_val = any(cell_text(ws.cell(row=r, column=c).value) not in (None, '')
                      for c in range(1, ws.max_column + 1))
        if not any_val:
            continue
        if idv is not None and (idv.strip() in FOOTER_MARKS
                                or idv.strip().startswith(('قاعدهٔ', 'نتیجه'))):
            return
        yield r


def get(cols, ws, r, label):
    """متن نرمال‌شدهٔ سلول داده از ستونِ سرستونِ داده‌شده."""
    if label not in cols:
        return None
    return norm_text(ws.cell(row=r, column=cols[label]).value)


# ─────────────────────────────────────────────────────────────────────────────
# ۵) ساخت بخش‌های JSON از شیت‌ها
# ─────────────────────────────────────────────────────────────────────────────

def build_identity(wb, red_rows):
    ws = find_sheet(wb, 'identity')
    if ws is None:
        raise RuntimeError('شیت «شناسنامهٔ خشاب» پیدا نشد')
    hr, cols = header_map(ws, HEADER_ANCHOR['identity'])
    if hr is None:
        raise RuntimeError('سرستون‌های شناسنامه (فیلد/مقدار/رنگ اعتبار/منبع) یافت نشد')
    identity = []
    for r in iter_data_rows(ws, hr, cols, cols['فیلد']):
        field = get(cols, ws, r, 'فیلد')
        value = get(cols, ws, r, 'مقدار')
        status, mismatch = row_status(ws.cell(row=r, column=cols['رنگ اعتبار']))
        if mismatch:
            MISMATCH_NOTES.append(f'شناسنامه «{field}»: {mismatch}')
        if status == STATUS_ERROR:
            red_rows.append(('شناسنامهٔ خشاب', field))
            continue
        identity.append({
            'field': field,
            'value': value,
            'status': status,
            'source': get(cols, ws, r, 'منبع / یادداشت'),
        })
    return identity


def build_bookmap(wb, red_rows):
    ws = find_sheet(wb, 'bookmap')
    if ws is None:
        raise RuntimeError('شیت «نقشهٔ کتاب (S1)» پیدا نشد')
    hr, cols = header_map(ws, HEADER_ANCHOR['bookmap'])
    if hr is None:
        raise RuntimeError('سرستون‌های نقشهٔ کتاب یافت نشد')
    out = []
    for r in iter_data_rows(ws, hr, cols, cols['شناسه (L-)']):
        lid = get(cols, ws, r, 'شناسه (L-)')
        status, mismatch = row_status(ws.cell(row=r, column=cols['رنگ اعتبار']))
        if mismatch:
            MISMATCH_NOTES.append(f'نقشهٔ کتاب «{lid}»: {mismatch}')
        if status == STATUS_ERROR:
            red_rows.append(('نقشهٔ کتاب (S1)', lid))
            continue
        out.append({
            'id': lid,
            'page': get(cols, ws, r, 'صفحه/گستره'),
            'chapter': get(cols, ws, r, 'فصل'),
            'title': get(cols, ws, r, 'درس/موضوع'),
            'objective': get(cols, ws, r, 'اهداف رفتاری قابل سنجش'),
            'vocabulary': get(cols, ws, r, 'واژگان کلیدی'),
            'activityType': get(cols, ws, r, 'نوع فعالیت'),
            'visual': get(cols, ws, r, 'شرح شکل/تصویر'),
            'practicePotential': get(cols, ws, r, 'پتانسیل تمرین'),
            'engineCompat': get(cols, ws, r, 'سازگاری موتور'),
            'anchorsRaw': get(cols, ws, r, 'لنگر Q-/E-'),
            'source': get(cols, ws, r, 'منبع'),
            'status': status,
            'note': get(cols, ws, r, 'یادداشت'),
        })
    return out


def build_atlas(wb, red_rows):
    ws = find_sheet(wb, 'atlas')
    if ws is None:
        raise RuntimeError('شیت «اطلس خطا» پیدا نشد')
    hr, cols = header_map(ws, HEADER_ANCHOR['atlas'])
    if hr is None:
        raise RuntimeError('سرستون‌های اطلس خطا یافت نشد')
    out = []
    for r in iter_data_rows(ws, hr, cols, cols['کد (E-)']):
        raw_code = get(cols, ws, r, 'کد (E-)') or ''
        code = re.sub(r'\s*\(پیشنهاد\)\s*$', '', raw_code.strip())  # تگ پیشنهاد جزو کد نیست
        status, mismatch = row_status(ws.cell(row=r, column=cols['رنگ اعتبار']))
        if mismatch:
            MISMATCH_NOTES.append(f'اطلس «{code}»: {mismatch}')
        if status == STATUS_ERROR:
            red_rows.append(('اطلس خطا', code))
            continue
        out.append({
            'code': code,
            'nameFa': get(cols, ws, r, 'نام فارسی'),
            'category': get(cols, ws, r, 'رده'),
            'description': get(cols, ws, r, 'توصیف مفهومی'),
            'behavioralSignal': get(cols, ws, r, 'نشانهٔ رفتاری نمونه'),
            'questionPattern': get(cols, ws, r, 'ساختار سؤال تشخیصی'),
            'intervention': get(cols, ws, r, 'مداخلهٔ پیشنهادی'),
            'priority': get(cols, ws, r, 'اولویت'),
            'source': get(cols, ws, r, 'منبع'),
            'status': status,
            'note': get(cols, ws, r, 'یادداشت'),
        })
    return out


def build_bank(wb, red_rows):
    ws = find_sheet(wb, 'bank')
    if ws is None:
        raise RuntimeError('شیت «بانک سؤال» پیدا نشد')
    hr, cols = header_map(ws, HEADER_ANCHOR['bank'])
    if hr is None:
        raise RuntimeError('سرستون‌های بانک سؤال یافت نشد')
    out = []
    for r in iter_data_rows(ws, hr, cols, cols['شناسه (Q-)']):
        qid = get(cols, ws, r, 'شناسه (Q-)')
        status, mismatch = row_status(ws.cell(row=r, column=cols['رنگ اعتبار']))
        if mismatch:
            MISMATCH_NOTES.append(f'بانک سؤال «{qid}»: {mismatch}')
        if status == STATUS_ERROR:
            red_rows.append(('بانک سؤال', qid))
            continue
        raw_ans = (get(cols, ws, r, 'پاسخ') or '').strip()
        if raw_ans in LETTER_INDEX:
            answer_index = LETTER_INDEX[raw_ans]
        elif to_latin(raw_ans) in ('1', '2', '3', '4'):
            answer_index = int(to_latin(raw_ans)) - 1
        else:
            answer_index = None
        options = [get(cols, ws, r, f'گزینهٔ {l}') for l in OPTION_LETTERS]
        prompt = get(cols, ws, r, 'صورت سؤال')
        plain = parse_plain_multiplication(prompt)
        ai = answer_index if (answer_index is not None and 0 <= answer_index <= 3) else None
        out.append({
            'id': qid,
            'anchorId': get(cols, ws, r, 'لنگر (L-)'),
            'domain': get(cols, ws, r, 'دامنه'),
            'cpa': get(cols, ws, r, 'لایهٔ CPA'),
            'prompt': prompt,
            'format': get(cols, ws, r, 'ساختار'),
            'options': options,
            'answerIndex': answer_index,
            'optionErrorMap': get(cols, ws, r, 'نقشهٔ گزینه→خطای مفهومی'),
            'claims': parse_claims(get(cols, ws, r, 'نقشهٔ گزینه→خطای مفهومی')),
            'level': get(cols, ws, r, 'سطح'),
            'criteria': get(cols, ws, r, 'معیار تصحیح'),
            'source': get(cols, ws, r, 'منبع'),
            'status': status,
            'note': get(cols, ws, r, 'یادداشت'),
            # ضد J12: math = فرم خام بازحسابی؛ answerValue = مقدار عددی گزینهٔ پاسخ
            'math': ({'f1': plain['f1'], 'f2': plain['f2'], 'product': plain['f1'] * plain['f2']}
                     if plain else None),
            'answerValue': (parse_option_value(options[ai]) if ai is not None else None),
        })
    return out


def build_glossary(wb):
    ws = find_sheet(wb, 'glossary')
    if ws is None:
        raise RuntimeError('شیت «واژه‌نامهٔ ستون‌ها» پیدا نشد')
    hr, cols = header_map(ws, HEADER_ANCHOR['glossary'])
    if hr is None:
        raise RuntimeError('سرستون‌های واژه‌نامه یافت نشد')
    out = []
    for r in iter_data_rows(ws, hr, cols, cols['شیت']):
        out.append({
            'sheet': get(cols, ws, r, 'شیت'),
            'column': get(cols, ws, r, 'ستون'),
            'rule': get(cols, ws, r, 'معنی / قاعده'),
            'allowed': get(cols, ws, r, 'مقادیر مجاز / الگو'),
        })
    return out


def build_audit(wb):
    """سجل ممیزی → {entries, note, sheet}؛ ردیف پانویسِ تک‌سلولی = note."""
    ws = find_sheet(wb, 'audit')
    if ws is None:
        raise RuntimeError('شیت «سجل ممیزی» پیدا نشد')
    hr, cols = header_map(ws, HEADER_ANCHOR['audit'])
    if hr is None:
        raise RuntimeError('سرستون‌های سجل ممیزی یافت نشد')
    fix_col = next((c for h, c in cols.items() if h.startswith('اصلاح')), None)
    entries, note = [], None
    for r in range(hr + 1, ws.max_row + 1):
        finding = norm_text(ws.cell(row=r, column=cols['شناسهٔ یافته']).value)
        place = norm_text(ws.cell(row=r, column=cols['محل']).value)
        if not finding:
            continue
        if not place:  # ردیف تک‌سلولی بعد از جدول = یادداشت سجل
            if note is None:
                note = finding
            continue
        entries.append({
            'finding': finding,
            'place': place,
            'verdict': norm_text(ws.cell(row=r, column=cols['حکم']).value),
            'fix': (norm_text(ws.cell(row=r, column=fix_col).value) if fix_col else None),
            'status': norm_text(ws.cell(row=r, column=cols['وضعیت']).value),
        })
    return {'entries': entries, 'note': note or '', 'sheet': ws.title}


def enum_from_glossary(glossary, column_label, fallback):
    """مقادیر مجاز یک ستون از شیت واژه‌نامه («الف | ب | ج»)؛ نبودِ ردیف → fallback."""
    for g in glossary:
        if norm(g.get('column')) == norm(column_label):
            vals = [v.strip() for v in str(g.get('allowed') or '').split('|') if v.strip()]
            if vals:
                return vals
    return list(fallback)


# ─────────────────────────────────────────────────────────────────────────────
# ۶) اعتبارسنجی (پورت validateCartridge — T1/T5/T6/T7 + زردهای AUD)
# ─────────────────────────────────────────────────────────────────────────────

MISMATCH_NOTES = []  # ناهم‌خوانی رنگ/متن سلول‌های وضعیت — در اجرا پر می‌شود


def judge_claim(qid, letter, claim, f1, f2, submitted, atlas_proposed):
    """قضاوت یک ادعای گزینه با موتور واقعی — عین منطق ممیزی AUD-01."""
    if (qid, letter) in KNOWN_HALF_MAPS:
        return ('warning', f'نقشهٔ نیمه‌تزئینی — زرد مستند AUD-12 ({qid} گ{letter})')
    has_proposed_marker = re.search(r'پیشنهادی|کاندید', claim) is not None
    code = claim_code(claim)
    engine = classify_attempt(f1, f2, submitted)

    if code and code not in REAL_CODES:
        if code in atlas_proposed:
            return None  # کد پیشنهادیِ ثبت‌شده در اطلس — تصمیم با S2
        return ('error', f'کد بیرونیِ بدون تگ در اطلس: {code} (T5 — قرمز)')
    if code and code in REAL_CODES:
        if re.search(r'هم‌پوشانی', claim):
            if engine in REAL_CODES:
                return None
            return ('error', f'ادعای هم‌پوشانی ولی موتور بی‌الگو داد ({engine})')
        if engine == code:
            return None
        return ('error', f'ادعا {code} ولی موتور {engine if engine else "بی‌الگو"} داد — ناسازگاری T6')
    if re.search(r'بی‌الگو|چسباندن', claim):
        if engine is None:
            return None
        return ('error', f'ادعای بی‌الگو ولی موتور {engine} زد — ناسازگاری T6')
    return None  # توصیف متنی بدون کد — خارج از نگاشت خودکار


def validate(cartridge, enums, red_rows):
    """خروجی: {ok, errors, warnings, stats, gate} — fail-closed."""
    errors, warnings = [], []
    err, warn = errors.append, warnings.append

    bookmap = cartridge['bookMap']
    atlas = cartridge['errorAtlas']
    bank = cartridge['questionBank']
    cpa_values, engine_values, category_values = enums

    # قرمزهای مبدأ (ردیف‌های «ایراد» که عمداً به JSON نمی‌روند — قاعدهٔ رنگ)
    for sheet, label in red_rows:
        err(f'ردیف قرمز (ایراد مستند) در شیت «{sheet}»: {label} — به JSON نمی‌رود (قاعدهٔ رنگ)')

    # ── اطلس خطا (T5 + رده AUD-08) ──
    atlas_proposed, atlas_codes = set(), set()
    for a in atlas:
        code = a.get('code')
        if not code:
            err('ردیف اطلس بدون کد')
            continue
        if code in atlas_codes:
            err(f'کد تکراری در اطلس: {code}')
        atlas_codes.add(code)
        if a['status'] == STATUS_PROPOSED:
            atlas_proposed.add(code)
        elif code not in REAL_CODES:
            err(f'اطلس: {code} «تأییدشده» است ولی در errors.js نیست (T5)')
        if a['status'] == STATUS_PROPOSED and code in REAL_CODES:
            warn(f'اطلس: {code} پیشنهادی است ولی هم‌نام کد واقعی موتور است')
        cat = a.get('category')
        if cat:
            # توکِل‌بندی محتاطانه: ارزش مرکب مستند (مثل «مفهومی/محاسباتی») می‌گذرد؛
            # هر توکِل ناشناخته = زرد (AUD-08 — توصیف اضافه باید در یادداشت باشد)
            tokens = [t for t in re.split(r'[/\s]+', str(cat).strip()) if t]
            if not all(t in category_values or t in CATEGORY_EXTRA_TOKENS for t in tokens):
                warn(f'اطلس خطا {code}: مقدار «رده» خارج از واژه‌نامه: «{cat}» (زرد AUD-08)')
    for a in atlas:
        for ref in extract_q_refs(a.get('questionPattern')):
            if not any(q['id'] == ref for q in bank):
                err(f'اطلس {a["code"]}: ارجاع {ref} در بانک سؤال نیست')

    # ── نقشهٔ کتاب (قاعدهٔ ۸ + سازگاری موتور AUD-07) ──
    lesson_ids = set()
    for l in bookmap:
        lid = l.get('id')
        if not lid:
            err('ردیف نقشهٔ کتاب بدون شناسه')
            continue
        if lid in lesson_ids:
            err(f'شناسهٔ تکراری درس: {lid}')
        lesson_ids.add(lid)
        if l['status'] == STATUS_CONFIRMED and not (l.get('source') or '').strip():
            err(f'نقشهٔ کتاب {lid}: ردیف سبز بدون منبع (قاعدهٔ ۸)')
        ec = l.get('engineCompat')
        if ec and ec not in engine_values:
            warn(f'نقشهٔ کتاب {lid}: مقدار «سازگاری موتور» خارج از واژه‌نامه: «{ec}» (زرد AUD-07)')

    # ── بانک سؤال (T6 + ضد J12 + AUD-06/AUD-12) ──
    question_ids = set()
    derived_owners = {}  # lessonId → [Q-…]
    for q in bank:
        qid = q.get('id')
        if not qid:
            err('ردیف بانک بدون شناسه')
            continue
        if qid in question_ids:
            err(f'شناسهٔ تکراری سؤال: {qid}')
        question_ids.add(qid)
        if q.get('anchorId') not in lesson_ids:
            err(f'{qid}: لنگر «{q.get("anchorId")}» در نقشهٔ کتاب نیست')
        derived_owners.setdefault(q.get('anchorId'), []).append(qid)

        if q['status'] == STATUS_CONFIRMED and not (q.get('source') or '').strip():
            err(f'{qid}: ردیف سبز بدون منبع (قاعدهٔ ۸)')
        if q.get('domain') and q['domain'] not in ('CORE', 'DEPTH', 'SIDE'):
            warn(f'{qid}: دامنهٔ خارج از واژه‌نامه: {q["domain"]}')
        if q.get('cpa') and q['cpa'] not in cpa_values:
            warn(f'{qid}: لایهٔ CPA خارج از واژه‌نامه: «{q["cpa"]}» (زرد AUD-06)')

        options = q.get('options') or []
        if len(options) != 4:
            err(f'{qid}: تعداد گزینه‌ها ≠ ۴')
            continue
        ai = q.get('answerIndex')
        if not isinstance(ai, int) or ai < 0 or ai > 3:
            err(f'{qid}: پاسخ‌نام خارج از بازه')
        for i, opt in enumerate(options):
            v = parse_option_value(opt)
            if v is not None and (v < 0 or v > 9999):
                err(f'{qid} گ{OPTION_LETTERS[i]}: عدد خارج از دامنهٔ کتاب (۹۹۹۹ — T4)')

        # کلید پاسخ: ابتدا فرم خام (a×b=؟) با بازحساب — ضد J12؛ سپس رسید ممیزی
        plain = parse_plain_multiplication(q.get('prompt'))
        if plain and isinstance(ai, int) and 0 <= ai <= 3:
            v = parse_option_value(options[ai])
            if v != plain['f1'] * plain['f2']:
                err(f'{qid}: گزینهٔ پاسخ ({v}) ≠ حاصل {plain["f1"]}×{plain["f2"]}={plain["f1"] * plain["f2"]} (ضد J12)')
        elif qid in AUDIT_ANSWER_RECEIPTS and isinstance(ai, int) and 0 <= ai <= 3:
            v = parse_option_value(options[ai])
            if v != AUDIT_ANSWER_RECEIPTS[qid]:
                err(f'{qid}: گزینهٔ پاسخ ({v}) ≠ رسید ممیزی ({AUDIT_ANSWER_RECEIPTS[qid]})')

        # برچسب گزینه→خطا با موتور واقعی
        factors = extract_multiplication_factors(q.get('prompt'))
        if factors:
            claims = q.get('claims') or []
            for i, letter in enumerate(OPTION_LETTERS):
                claim_obj = next((c for c in claims if c['letter'] == letter), None)
                if not claim_obj:
                    continue
                v = parse_option_value(options[i])
                if v is None or v == factors['f1'] * factors['f2']:
                    continue
                verdict = judge_claim(qid, letter, claim_obj['claim'],
                                      factors['f1'], factors['f2'], v, atlas_proposed)
                if verdict and verdict[0] == 'error':
                    err(f'{qid} گ{letter}={v}: {verdict[1]}')
                if verdict and verdict[0] == 'warning':
                    warn(f'{qid} گ{letter}: {verdict[1]}')

    # ── سازگاری نقشه ↔ بانک (T7 — بستن AUD-04/AUD-05) ──
    for l in bookmap:
        lid = l.get('id')
        if not lid:
            continue
        refs = sorted(set(extract_q_refs(l.get('anchorsRaw'))))
        derived = sorted(derived_owners.get(lid) or [])
        if refs != derived:
            err(f'نقشهٔ کتاب {lid}: لنگرهای سلول [{ "،".join(refs) }] ≠ مالکان واقعی در بانک [{ "،".join(derived) }]')
        for ref in refs:
            if ref not in question_ids:
                err(f'نقشهٔ کتاب {lid}: ارجاع {ref} در بانک سؤال نیست')

    for note in MISMATCH_NOTES:
        warn(f'ناهم‌خوانی رنگ/متن «رنگ اعتبار» — {note}')

    stats = {
        'lessons': len(bookmap),
        'lessonsConfirmed': sum(1 for l in bookmap if l['status'] == STATUS_CONFIRMED),
        'atlasReal': sum(1 for a in atlas if a['status'] == STATUS_CONFIRMED),
        'atlasProposed': len(atlas_proposed),
        'questions': len(bank),
        'questionsConfirmed': sum(1 for q in bank if q['status'] == STATUS_CONFIRMED),
        'questionsProposed': sum(1 for q in bank if q['status'] == STATUS_PROPOSED),
    }
    ok = len(errors) == 0
    # بلوک validation داخل JSON همان قرارداد schema است (ok/warnings/stats/gate —
    # بدون آرایهٔ errors)؛ فهرست کامل خطاها فقط به گزارش md می‌رود.
    validation = {
        'ok': ok,
        'warnings': warnings,
        'stats': stats,
        'gate': {'red': len(errors), 'yellow': len(warnings),
                 'verdict': 'مجاز' if ok else 'ممنوع'},
    }
    return validation, errors


# ─────────────────────────────────────────────────────────────────────────────
# ۷) گزارش md (هم‌قالب گزارش مبدل v0.6)
# ─────────────────────────────────────────────────────────────────────────────

def render_report(cartridge_id, input_name, when, validation, errors, published):
    v = validation
    s = v['stats']
    lines = []
    lines.append(f'# گزارش مبدل خشاب — {cartridge_id}')
    lines.append('')
    lines.append(f'- ورودی: `{input_name}`')
    lines.append(f'- ابزار: {TOOL_NAME} (قواعد = پرامپت ممیز T1..T7 + رسیدهای ممیزی)')
    lines.append(f'- زمان: {when}')
    lines.append('')
    lines.append('| سنجه | مقدار |')
    lines.append('|---|---|')
    red, yellow = v['gate']['red'], v['gate']['yellow']
    lines.append(f'| قرمز (بلوکه‌کننده) | **{red}** |')
    lines.append(f'| زرد (هشدار) | {yellow} |')
    lines.append(f'| درس‌ها | {s["lessons"]} (سبز: {s["lessonsConfirmed"]}) |')
    lines.append(f'| اطلس | {s["atlasReal"]} واقعی + {s["atlasProposed"]} پیشنهادی |')
    lines.append(f'| بانک سؤال | {s["questions"]} (سبز: {s["questionsConfirmed"]}، زرد: {s["questionsProposed"]}) |')
    lines.append('')
    lines.append('## خطاها')
    if not errors:
        lines.append('- هیچ — گیت سبز.')
    else:
        for e in errors:
            lines.append(f'- 🔴 {e}')
    lines.append('')
    lines.append('## هشدارها (زرد — همان‌هایی که ممیزی AUD رسماً ثبت کرده)')
    for w in v['warnings']:
        lines.append(f'- 🟡 {w}')
    lines.append('')
    lines.append('## رسیدهای کلید پاسخ')
    lines.append(f'بررسی خودکار علیه {len(AUDIT_ANSWER_RECEIPTS)} رسید ممیزی + بازحساب فرم خام a×b.')
    lines.append('')
    if published:
        lines.append(f'**حکم گیت مبدل: مجاز — JSON منتشر شد**')
    else:
        lines.append(f'**حکم گیت مبدل: ممنوع — JSON نوشته نشد (fail-closed)**')
    return '\n'.join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# ۸) main
# ─────────────────────────────────────────────────────────────────────────────

def main(argv=None):
    global TOOL_NAME
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(
        description='مبدل Excel→JSON خشاب (قواعد ممیز T1..T7 + رسیدهای ممیزی، fail-closed)')
    ap.add_argument('--input', default=str(root / 'download/khshab-G3-MATH_v0.6.xlsx'),
                    help='مسیر اکسل تألیف (ورودی)')
    ap.add_argument('--out-json', default=str(root / 'public/math-game/cartridges/KH-G3-MATH.json'),
                    help='مسیر JSON اجرایی (خروجی — فقط در گیت سبز نوشته می‌شود)')
    ap.add_argument('--out-report', default=str(root / 'download/convert-report-KH-G3-MATH-v0.6.md'),
                    help='مسیر گزارش md (خروجی — همیشه نوشته می‌شود)')
    ap.add_argument('--id', default=None, help='دورزدن شناسهٔ خشاب خوانده‌شده از شناسنامه (پیش‌فرض: از xlsx)')
    ap.add_argument('--tool', default=TOOL_NAME, help='نام ابزار ثبت‌شده در JSON/گزارش')
    args = ap.parse_args(argv)

    in_path = Path(args.input)
    if not in_path.is_file():
        print(f'[خطا] فایل ورودی پیدا نشد: {in_path}', file=sys.stderr)
        return 2

    wb = load_workbook(in_path, data_only=True)

    TOOL_NAME = args.tool
    MISMATCH_NOTES.clear()

    try:
        red_rows = []
        identity = build_identity(wb, red_rows)
        bookmap = build_bookmap(wb, red_rows)
        atlas = build_atlas(wb, red_rows)
        bank = build_bank(wb, red_rows)
        glossary = build_glossary(wb)
        audit = build_audit(wb)
    except (RuntimeError, KeyError) as e:
        print(f'[خطا ساختاری] {e}', file=sys.stderr)
        return 2

    cartridge_id = args.id
    if not cartridge_id:
        for row in identity:
            if norm(row['field']) == 'شناسهٔ خشاب':
                cartridge_id = row['value']
                break
    if not cartridge_id:
        print('[خطا] شناسهٔ خشاب («شناسهٔ خشاب» در شناسنامه) یافت نشد — با --id بدهید', file=sys.stderr)
        return 2
    if not re.fullmatch(r'KH-G\d+-[A-Z0-9]+(-[A-Z0-9]+)*', cartridge_id):
        print(f'[هشدار] الگوی شناسهٔ خشاب متعارف (KH-G<پایه>-<موضوع>): {cartridge_id}', file=sys.stderr)

    enums = (
        enum_from_glossary(glossary, 'لایهٔ CPA', FALLBACK_CPA),
        enum_from_glossary(glossary, 'سازگاری موتور', FALLBACK_ENGINE),
        enum_from_glossary(glossary, 'رده', FALLBACK_CATEGORY),
    )

    cartridge = {
        'formatVersion': FORMAT_VERSION,
        'cartridgeId': cartridge_id,
        'generatedAt': iso_now(),
        'source': {'file': in_path.name, 'tool': TOOL_NAME},
        'identity': identity,
        'bookMap': bookmap,
        'errorAtlas': atlas,
        'questionBank': bank,
        'glossary': glossary,
        'auditTrail': audit,
    }
    validation, errors_list = validate(cartridge, enums, red_rows)
    cartridge['validation'] = validation
    v = validation
    published = v['ok']

    when = iso_now()  # زمان گزارش، جدا و کمی بعد از generatedAt

    # JSON فقط در گیت سبز (fail-closed)
    if published:
        out_json = Path(args.out_json)
        out_json.parent.mkdir(parents=True, exist_ok=True)
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump(cartridge, f, ensure_ascii=False, indent=2)

    report_md = render_report(cartridge_id, in_path.name, when, v, errors_list, published)
    out_report = Path(args.out_report)
    out_report.parent.mkdir(parents=True, exist_ok=True)
    with open(out_report, 'w', encoding='utf-8') as f:
        f.write(report_md)

    # خلاصهٔ کنسول
    g = v['gate']
    print(f'خشاب: {cartridge_id} | ورودی: {in_path.name}')
    print(f'قرمز: {g["red"]} | زرد: {g["yellow"]} | حکم: {g["verdict"]}')
    print(f'درس: {v["stats"]["lessons"]} (سبز {v["stats"]["lessonsConfirmed"]}) | '
          f'اطلس: {v["stats"]["atlasReal"]}+{v["stats"]["atlasProposed"]} | '
          f'سؤال: {v["stats"]["questions"]} (سبز {v["stats"]["questionsConfirmed"]})')
    print(f'JSON: {"منتشر شد → " + str(out_json) if published else "نوشته نشد (fail-closed)"}')
    print(f'گزارش: {out_report}')
    return 0 if published else 1


if __name__ == '__main__':
    sys.exit(main())
