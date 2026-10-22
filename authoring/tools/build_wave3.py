"""Build chapter-2 draft from the teacher-approved verified page map.
Run from repository root: python authoring/tools/build_wave3.py
No copyrighted book images or PDF are embedded or copied.
"""
from collections import Counter
import ast
import operator
from copy import copy
from hashlib import sha256
from pathlib import Path
import re
import openpyxl

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / 'authoring'
MAP = DIR / 'PAGE-MAP-KH-G2-MATH-v1_verified.xlsx'
BASE = DIR / 'khshab-G2-MATH_v0.3.1.xlsx'
OUT = DIR / 'khshab-G2-MATH_v0.4.xlsx'
SOURCE = 'پیام AI — موتور تألیف v۱.۰'
YELLOW = 'نیاز به تأیید'
fa = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')

def f(n): return str(n).translate(fa)
def put(sheet, row, values, sample_row):
    # openpyxl.insert_rows does not move merged ranges automatically. Move the
    # separator merges, or they would swallow data in the last inserted row.
    moved=[(rng.min_row,rng.max_row,rng.min_col,rng.max_col) for rng in list(sheet.merged_cells.ranges) if rng.min_row>=row]
    for r1,r2,c1,c2 in moved:
        sheet.unmerge_cells(start_row=r1,end_row=r2,start_column=c1,end_column=c2)
    sheet.insert_rows(row)
    for r1,r2,c1,c2 in moved:
        sheet.merge_cells(start_row=r1+1,end_row=r2+1,start_column=c1,end_column=c2)
    for col, value in enumerate(values, 1):
        src = sheet.cell(sample_row, col)  # stable existing yellow row above insertion
        cell = sheet.cell(row, col, value)
        if src.has_style: cell._style = copy(src._style)
        cell.alignment = copy(src.alignment)

def real_rows(sheet, prefix):
    return [list(r) for r in sheet.iter_rows(values_only=True) if isinstance(r[0], str) and re.fullmatch(prefix, r[0])]

m = openpyxl.load_workbook(MAP, read_only=True, data_only=True)['نقشهٔ صفحه‌ها']
assert sha256(MAP.read_bytes()).hexdigest() == '7310680cfe62f4cad8e4222de6f3d32edc2c54bb24a9f586a610ef7e2ac192b8', 'master map changed; review required'
for page in range(19,37):
    r = page+8
    assert m.cell(r,1).value == page and m.cell(r,2).value == page+6 and m.cell(r,14).value in ('✓','✗')

# Page-specific goals, keywords, activity and visual design; all anchored to the verified map.
# For ✗ rows, the correction (column O) overrides the raw map's mistaken banner/number.
pages = [
('آغاز فصل: جمع و تفریق اعداد دو رقمی','بتواند تعداد بازیکنان و یاران ذخیره را برای یک تیم با جمع بیابد.','فوتبال، تیم، نفر','پرسش آغاز فصل: ۱۱ بازیکن و ۷ یار ذخیره','M_GROUPS — ۱۱ بازیکن و ۷ ذخیره، دو گروه برای جمع','بانک تمرین'),
('جمع و تفریق ده‌تایی — فعّالیت','بتواند جمع و تفریق ده‌تایی‌ها را با دسته و محور محاسبه کند.','دستهٔ ده‌تایی، محور','فعّالیت بالای صفحه؛ نکتهٔ ده‌تایی؛ تقریب بزن در جعبهٔ پایین','M_BUNDLES — ۴ دستهٔ ده‌تایی و ۲ دستهٔ ده‌تایی؛ حاصل ۶ دسته','تعاملی-عمیق'),
('کار در کلاس + فعّالیت','بتواند عبارت‌های یک‌رقمی و ده‌تایی متناظر را با شکل و محور حل کند.','دستهٔ ده‌تایی، محور','کار در کلاس بالای صفحه؛ فعّالیت جمع‌نویسی و محور پایین','M_NUMBERLINE — محور ۰ تا ۱۰۰ با پرش‌های ده‌تایی','بانک تمرین'),
('تمرین + کامل کن','بتواند تساوی دسته‌های ده‌تایی و جای عدد روی محور را کامل کند.','دستهٔ ده‌تایی، محور','تمرین و کامل کن: دسته‌بندی، رنگ‌کردن، محور','M_NUMBERLINE — نشانه‌گذاری ۱۷، ۲۵ و ۳۲ روی محور','بانک تمرین'),
('جمع و تفریق — فعّالیت','بتواند جمع و تفریق یک‌رقمی را با رسم شکل، محور یا چوب‌خط انجام دهد.','محور، چوب‌خط، رسم شکل','فعّالیت: سه راه نمایش و محاسبه','M_NUMBERLINE — محور ۰ تا ۲۰ برای جمع و تفریق','تعاملی-عمیق'),
('کار در کلاس + فعّالیت','بتواند حاصل جمع و تفریق یک‌رقمی را در جدول و با رنگ‌کردن مربع‌ها بیابد.','جدول، مربّع، جمع، تفریق','کار در کلاس: جدول؛ فعّالیت پایین: رنگ‌کردن یا خط‌زدن مربع‌ها','M_ARRAY — مربع‌های رنگ‌شده یا خط‌خورده برای محاسبه','بانک تمرین'),
('تمرین + کار در کلاس','بتواند جمع دو عدد یک‌رقمی را با ساختن ده و جمع دوقلوها توضیح دهد.','انگشتان دست، دستهٔ ده‌تایی، جدول عددها','تمرین مسئله؛ کار در کلاس: روش‌های ۷+۶؛ خلّاق باش','M_BUNDLES — دستهٔ ده‌تایی از ۷ و ۳، همراه ۳ یکی','بانک تمرین'),
('حلّ مسئله + الگویابی کن','بتواند همهٔ عددهای دو رقمی با رقم‌های داده‌شده را منظّم بنویسد.','یکان، دهگان، نظم، الگو','حلّ مسئله بالا: نمودار درختی و جمع‌های ۶؛ الگویابی کن پایین','M_PATTERN — شاخه‌های رقم دهگان ۵/۷ و رقم یکان ۳','بانک تمرین'),
('الگوسازی + کامل کن','بتواند حالت‌های رنگ‌آمیزی را با نظم فهرست کند و دقیقه‌های ساعت را بخواند.','مربّع، مثلّث، ساعت، دقیقه','الگوسازی بالا؛ کامل کن: ساعت در جعبهٔ میانی','M_PATTERN — دو رنگ مربع در برابر سه رنگ مثلث','بانک تمرین'),
('جمع و تفریق دو عدد دو رقمی — فعّالیت','بتواند جمع و تفریق بدون تبدیل را با جداکردن ده‌تایی و یکی انجام دهد.','ده‌تایی، یکی، جمع، تفریق','فعّالیت: ۱۴+۲۳ و ۴۷−۲۲ با دسته‌ها','M_BUNDLES — ۱۴ (۱ ده‌تایی و ۴ یکی) + ۲۳ (۲ ده‌تایی و ۳ یکی)','تعاملی-عمیق'),
('فعّالیت + کار در کلاس','بتواند جمع و تفریق دو رقمی را مرحله‌ای با ده‌تایی و یکی توضیح دهد.','جدول، ده‌تایی، یکی','فعّالیت جدول؛ کار در کلاس: ۳۴+۲۳ و ۴۷−۲۲؛ الگویابی ساعت','M_PLACEVALUE — ۳۴+۲۰=۵۴ سپس ۵۴+۳=۵۷','بانک تمرین'),
('تمرین + تقریب بزن','بتواند جمع یا تفریق را با شکل و محور حل کند و نزدیکی یک عدد به دهگان را بسنجد.','محور، تقریب، عدد','تمرین محاسبه؛ تقریب بزن: جای ۲۳ و ۳۷ و ۴۱ و ۵۸','M_NUMBERLINE — ۲۳ بین ۲۰ و ۳۰ و نزدیک‌تر به ۲۰','بانک تمرین'),
('جمع و تفریق دو عدد (ادامه) — فعّالیت','بتواند جمعِ با تبدیل یکان به دهگان و تفریق مرحله‌ای را با دسته‌ها نشان دهد.','دستهٔ ده‌تایی، یکی، جدول','فعّالیت: ۲۴+۳۷=۶۱ و ۵۷−۱۴=۴۳؛ تکمیل جدول','M_BUNDLES — ۲۴+۳۰=۵۴ سپس ۵۴+۷=۶۱؛ تبدیل ۱۱ یکی','تعاملی-عمیق'),
('کار در کلاس + کامل کن','بتواند جمع و تفریق را با جابه‌جایی ده‌تایی و یکی در جدول ۱ تا ۹۹ انجام دهد.','جدول اعداد، ده‌تایی، یکی','کار در کلاس: ۲۴+۳۲ و ۴۷−۳۴؛ کامل کن: ساعت','M_CHART — جدول ۱ تا ۹۹: جابه‌جایی سطر و خانه','تعاملی-عمیق'),
('تمرین + تقریب بزن','بتواند مسئلهٔ جمع و تفریق را حل و سپس جواب تقریبی را با گردکردن دهگان پیدا کند.','جمع، تفریق، دقیقه، تقریب','تمرین: ۲۶+۱۷ و ۵۵−۲۹؛ تقریب بزن: ۴۷+۲۱','M_NUMBERLINE — ۴۷ نزدیک ۵۰ و ۲۱ نزدیک ۲۰','تعاملی-عمیق'),
('مرور فصل + فرهنگ نوشتن + تمرین','بتواند حاصل عبارت‌های گل‌ها را حساب و بر پایهٔ بازهٔ جدول رنگ طبقه‌بندی کند.','جدول رنگ، جمع، تفریق','مرور فصل: فرهنگ نوشتن و تمرین ۱؛ بازه‌ها طبق اصلاح آرنا','M_CHART — ۱۰ گل و چهار بازهٔ رنگی: ۱۰–۲۰، ۱۰۰–۱۱۰، ۲۰–۳۰، ۱۰۰–۱۰۵','بانک تمرین'),
('ادامهٔ مرور فصل','بتواند جمع و تفریق تقریبی و شمار حالت‌های رقم دهگان و یکان را حل کند.','جمع، تفریق، دایره، مستطیل','مرور فصل: تمرین‌های ۲ تا ۵؛ حالت‌های رنگ و مسئلهٔ صدف','M_PATTERN — ۲ انتخاب یکان و ۳ انتخاب دهگان: ۶ عدد','بانک تمرین'),
('معمّا + فرهنگ خواندن','بتواند ارزش یک رقم را در جای یکان و دهگانِ عدد توضیح دهد.','شکل شطرنجی، رقم، ارزش مکانی','معمّای پوشاندن بدون چرخاندن + فرهنگ خواندن','M_PLACEVALUE — رقم ۲ در یکانِ ۲۲ ارزش ۲ و در دهگان ارزش ۲۰','خارج از موتور'),
]
assert len(pages)==18

w = openpyxl.load_workbook(BASE)
s = w['نقشهٔ کتاب (S1)']
assert s['A22'].value=='L-200' and s['A23'].value=='L-300'
for idx in range(18):
    page=19+idx; title,goal,keywords,activity,visual,mode=pages[idx]
    maprow=page+8
    hint = m.cell(maprow,15).value if m.cell(maprow,14).value=='✗' else '—'
    # Map cells are evidence; do not rewrite any prior sheet or green chapter anchor.
    refs = f'نقشهٔ مادر ردیف {maprow} ({m.cell(maprow,14).value})؛ ص کتاب {page} / PDF {page+6}'
    if hint!='—': refs += '؛ اصلاح ستون «اصلاح آرنا» مقدم بر نقشهٔ خام.'
    v=[f'L-{200+page-18}', f(page), '۲', title, 'دانش‌آموز '+goal, keywords, activity, visual,
       'بالا' if mode=='تعاملی-عمیق' else 'متوسط', mode, '—', SOURCE,YELLOW,refs+' موتور فعلی ضرب‌محور است؛ تعاملیِ جمع/تفریق نیازمند توسعه است.']
    put(s,22+idx,v,21)

# New diagnostic categories are explicitly proposals, not runtime classification claims.
a=w['اطلس خطا']; assert a['A12'].value=='یادداشت'
new_errors=[
('E_CARRY_MISS (پیشنهاد)','جاانداختن انتقال ده‌تایی','راهبردی','وقتی جمع یکی‌ها به ۱۰ می‌رسد، ده‌تایی تازه را در جواب منظور نمی‌کند.','۲۴+۳۷ را ۵۱ می‌نویسد.','دو عدد دورقمی با جمع یکی‌ها ≥۱۰؛ گزینهٔ بی‌انتقال','۱۱ یکی را به ۱ ده‌تایی و ۱ یکی تبدیل کند.','بالا'),
('E_BORROW_MISS (پیشنهاد)','جاانداختن قرض در تفریق','راهبردی','برای کم‌کردن یکی‌ها یک ده‌تایی باز نمی‌کند یا رقم‌ها را وارونه کم می‌کند.','۶۲−۳۸ را ۳۴ می‌نویسد.','تفریق با یکان کوچک‌ترِ عدد اول؛ گزینهٔ بی‌قرض','یک ده‌تایی را به ۱۰ یکی باز کند و دوباره کم کند.','بالا'),
('E_ROUND_NEAREST (پیشنهاد)','گردکردن به دهگان نادرست','مفهومی','به‌جای نزدیک‌ترین دهگان، دهگان دورتر یا عدد اصلی را برمی‌گزیند.','۴۷ را ۴۰ تقریب می‌زند.','تقریب عدد دو رقمی و جمع/تفریق تقریبی','جای عدد را میان دو دهگان روی محور علامت بزند.','متوسط'),
]
for i, row in enumerate(new_errors):
    v=[*row,SOURCE,YELLOW,'پیشنهاد تشخیصی فصل ۲؛ در classifyAttempt فعلی (ضرب‌محور) پیاده نشده؛ نیازمند تأیید معلم و توسعهٔ موتور.']
    put(a,12+i,v,11)

# Four self-authored questions per block: CORE, CORE, DEPTH, SIDE.
# Each entry: page, expression-independent wording, arithmetic evidence, correct integer,
# distractors (integer, atlas code), CPA layer. Numbers never copied as whole questions.
blocks=[
(20,[
('۳ دستهٔ ده‌تایی و ۴ دستهٔ ده‌تایی روی هم چند یکی دارند؟','30+40=70',70,[(7,'E_ZERO_PLACE_MISS'),(60,'E_TABLE_NEIGHBOUR'),(80,'E_TABLE_NEIGHBOUR')],'مجسم'),
('۹۰ منهای ۳۰ چند می‌شود؟','90-30=60',60,[(6,'E_ZERO_PLACE_MISS'),(50,'E_TABLE_NEIGHBOUR'),(70,'E_TABLE_NEIGHBOUR')],'علامتی'),
('از ۸ دستهٔ ده‌تایی، ۵ دسته برداریم و ۲ دسته اضافه کنیم؛ چند یکی می‌ماند؟','80-50+20=50',50,[(5,'E_ZERO_PLACE_MISS'),(30,'E_SUB_CONFUSION'),(70,'E_ADD_CONFUSION')],'تصویری'),
('روی محور ده‌تایی از ۲۰ سه پرش به جلو می‌رویم؛ به چند می‌رسیم؟','20+3*10=50',50,[(23,'E_ZERO_PLACE_MISS'),(40,'E_SKIP_UNDERCOUNT'),(60,'E_TABLE_NEIGHBOUR')],'تصویری')]),
(23,[
('۷ + ۶ چند می‌شود؟','7+6=13',13,[(12,'E_DOUBLE_OFF'),(14,'E_DOUBLE_OFF'),(1,'E_SUB_CONFUSION')],'علامتی'),
('۱۶ − ۹ چند می‌شود؟','16-9=7',7,[(6,'E_DOUBLE_OFF'),(8,'E_DOUBLE_OFF'),(25,'E_ADD_CONFUSION')],'علامتی'),
('ابتدا ۸ چوب‌خط و بعد ۷ چوب‌خط بکشیم؛ در کل چند چوب‌خط داریم؟','8+7=15',15,[(14,'E_DOUBLE_OFF'),(16,'E_DOUBLE_OFF'),(1,'E_SUB_CONFUSION')],'مجسم'),
('روی محور از ۱۴، ۶ خانه عقب برویم؛ کجا می‌ایستیم؟','14-6=8',8,[(7,'E_DOUBLE_OFF'),(9,'E_DOUBLE_OFF'),(20,'E_ADD_CONFUSION')],'تصویری')]),
(28,[
('۳۲ + ۲۴ چند می‌شود؟','32+24=56',56,[(52,'E_GROUPS'),(36,'E_GROUPS'),(55,'E_DOUBLE_OFF')],'علامتی'),
('۷۶ − ۳۲ چند می‌شود؟','76-32=44',44,[(46,'E_GROUPS'),(54,'E_GROUPS'),(43,'E_DOUBLE_OFF')],'علامتی'),
('۵۱ تا مهره داشتیم؛ ۲۳ تا اضافه و ۱۲ تا کم کردیم. چند مهره ماند؟','51+23-12=62',62,[(74,'E_SUB_CONFUSION'),(50,'E_GROUPS'),(63,'E_DOUBLE_OFF')],'مجسم'),
('۴ دستهٔ ده‌تایی و ۳ یکی داریم. ۲ دستهٔ ده‌تایی و ۵ یکی می‌افزاییم؛ حاصل چیست؟','43+25=68',68,[(48,'E_GROUPS'),(63,'E_GROUPS'),(69,'E_DOUBLE_OFF')],'تصویری')]),
(31,[
('۲۶ + ۳۷ چند می‌شود؟','26+37=63',63,[(53,'E_CARRY_MISS'),(62,'E_DOUBLE_OFF'),(64,'E_DOUBLE_OFF')],'علامتی'),
('۴۸ + ۱۵ چند می‌شود؟','48+15=63',63,[(53,'E_CARRY_MISS'),(62,'E_DOUBLE_OFF'),(64,'E_DOUBLE_OFF')],'علامتی'),
('یک ظرف ۲۷ مهره و ظرف دیگر ۳۶ مهره دارد؛ ۵ مهره را جدا می‌کنیم. چند مهره می‌ماند؟','27+36-5=58',58,[(48,'E_CARRY_MISS'),(63,'E_SUB_CONFUSION'),(57,'E_DOUBLE_OFF')],'مجسم'),
('در جمع ۳۸ + ۲۷ ابتدا ده‌تایی‌ها و بعد یکی‌ها را می‌افزاییم؛ نتیجه چیست؟','38+20=58;58+7=65',65,[(55,'E_CARRY_MISS'),(58,'E_GROUPS'),(66,'E_DOUBLE_OFF')],'تصویری')]),
(32,[
('در جدول اعداد، از ۶۲ سه ردیف بالا و ۸ خانه عقب برویم؛ به چند می‌رسیم؟','62-30-8=24',24,[(34,'E_BORROW_MISS'),(32,'E_GROUPS'),(25,'E_DOUBLE_OFF')],'تصویری'),
('۷۳ − ۲۸ چند می‌شود؟','73-28=45',45,[(55,'E_BORROW_MISS'),(44,'E_DOUBLE_OFF'),(46,'E_DOUBLE_OFF')],'علامتی'),
('از ۸۱ مهره، ۳۷ مهره برداریم و ۵ مهره اضافه کنیم؛ چند مهره می‌ماند؟','81-37+5=49',49,[(54,'E_BORROW_MISS'),(44,'E_GROUPS'),(48,'E_DOUBLE_OFF')],'مجسم'),
('در جدول از ۵۴ دو ردیف بالا و ۶ خانه عقب برویم؛ به چند می‌رسیم؟','54-20-6=28',28,[(38,'E_BORROW_MISS'),(34,'E_GROUPS'),(29,'E_DOUBLE_OFF')],'تصویری')]),
(33,[
('آوا ۲۸ دقیقه مطالعه و ۱۶ دقیقه تمرین کرد. در کل چند دقیقه کار کرد؟','28+16=44',44,[(34,'E_CARRY_MISS'),(43,'E_DOUBLE_OFF'),(12,'E_SUB_CONFUSION')],'علامتی'),
('از ۶۵ دقیقه، ۲۷ دقیقه گذشته است. چند دقیقه باقی مانده؟','65-27=38',38,[(42,'E_BORROW_MISS'),(37,'E_DOUBLE_OFF'),(92,'E_ADD_CONFUSION')],'علامتی'),
('یک کلاس ۴۹ برگه داشت، ۲۳ برگه دریافت کرد و ۱۸ برگه مصرف کرد. چند برگه ماند؟','49+23-18=54',54,[(44,'E_CARRY_MISS'),(72,'E_SUB_CONFUSION'),(53,'E_DOUBLE_OFF')],'مجسم'),
('مینا ۵۲ برچسب داشت. ۲۸ تا بخشید و ۱۷ تا خرید. اکنون چند برچسب دارد؟','52-28+17=41',41,[(51,'E_BORROW_MISS'),(24,'E_GROUPS'),(40,'E_DOUBLE_OFF')],'تصویری')]),
(34,[
('حاصل تقریبی ۴۷ + ۲۱ با گردکردن به نزدیک‌ترین دهگان چیست؟','47~50;21~20;50+20=70',70,[(60,'E_ROUND_NEAREST'),(80,'E_ROUND_NEAREST'),(68,'E_ROUND_NEAREST')],'علامتی'),
('حاصل تقریبی ۸۱ − ۲۸ با گردکردن به نزدیک‌ترین دهگان چیست؟','81~80;28~30;80-30=50',50,[(60,'E_ROUND_NEAREST'),(40,'E_ROUND_NEAREST'),(53,'E_ROUND_NEAREST')],'علامتی'),
('حاصل تقریبی ۳۹ + ۲۵ با گردکردن به نزدیک‌ترین دهگان چیست؟','39~40;25~30;40+30=70',70,[(60,'E_ROUND_NEAREST'),(80,'E_ROUND_NEAREST'),(64,'E_ROUND_NEAREST')],'تصویری'),
('حاصل تقریبی ۸۹ − ۵۱ با گردکردن به نزدیک‌ترین دهگان چیست؟','89~90;51~50;90-50=40',40,[(30,'E_ROUND_NEAREST'),(50,'E_ROUND_NEAREST'),(38,'E_ROUND_NEAREST')],'علامتی')]),
]
q=w['بانک سؤال']; assert q['A44'].value=='یادداشت'
letters='الف ب ج د'.split(); answers=[]
for page, items in blocks:
    for index,(prompt,calc,right,wrong,cpa) in enumerate(items):
        assert len(wrong)==3 and all(0<=v<=9999 and v!=right for v,c in wrong)
        # Independently evaluate the stated calculation, rather than trusting the key.
        final=calc.split(';')[-1].split('=')[0]
        tree=ast.parse(final, mode='eval')
        def eval_math(node):
            if isinstance(node,ast.Expression): return eval_math(node.body)
            if isinstance(node,ast.Constant) and type(node.value) is int: return node.value
            if isinstance(node,ast.BinOp) and type(node.op) in (ast.Add,ast.Sub,ast.Mult):
                return {ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul}[type(node.op)](eval_math(node.left),eval_math(node.right))
            raise ValueError('unsupported arithmetic: '+final)
        assert eval_math(tree)==right,(calc,right)
        assert len({right,*(v for v,c in wrong)})==4
        # Rotate correct answer so the final combined bank stays evenly distributed.
        number=1041+len(answers); position=(number-1041)%4
        vals=[(v,code) for v,code in wrong]; vals.insert(position,(right,None))
        mapping='؛ '.join(f'{letters[i]}→{code}' for i,(_,code) in enumerate(vals) if code)
        layer=['CORE','CORE','DEPTH','SIDE'][index]
        row=[f'Q-{number}',f'L-{page+182}',layer,cpa,prompt,'چهارگزینه‌ای',
             *(f(v) for v,c in vals),letters[position],mapping,'متوسط' if index>=2 else 'آسان',
             f'پاسخ دقیق: {f(right)}؛ محاسبهٔ مستقل در یادداشت. گزینه‌های دیگر راه‌حل درست این سؤال نیستند.',
             SOURCE,YELLOW,f'ضد J12 — کار دفترچه‌ای (لاتین): {calc}; independently checked: answer={right}; wrong={[(v,c) for v,c in wrong]}. لنگر ص {page} / PDF {page+6}؛ پرسش خودساخته، نه نقل کتاب.']
        put(q,44+len(answers),row,43)
        answers.append(letters[position])

# Replace S1 placeholders by the exact question IDs owned by that page, not a guessed range.
for page, items in blocks:
    ids=[r[0] for r in real_rows(q,r'Q-\d+') if r[1]==f'L-{page+182}']
    assert len(ids)==4
    s.cell(22+(page-19),11,'، '.join(ids))

# Assertions: no existing content or green seal changed; no reused identifiers; no stale page.
old=openpyxl.load_workbook(BASE,read_only=True)
for name,prefix in [('نقشهٔ کتاب (S1)',r'L-\d+'),('اطلس خطا',r'E_[A-Z_]+(?: \(پیشنهاد\))?'),('بانک سؤال',r'Q-\d+')]:
    before=real_rows(old[name],prefix); after=real_rows(w[name],prefix)
    assert all(r in after for r in before), f'prior row altered: {name}'
    assert len(after)==len({r[0] for r in after}), f'duplicate ID: {name}'
assert all(w['شناسنامهٔ خشاب'].cell(r,c).value==old['شناسنامهٔ خشاب'].cell(r,c).value for r in range(1,17) for c in range(1,5))
assert len(answers)==28 and Counter(answers)==dict.fromkeys(letters,7)
assert [int(s.cell(r,2).value.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹','0123456789'))) for r in range(22,40)]==list(range(19,37))
assert all(q.cell(r,15).value==SOURCE and q.cell(r,16).value==YELLOW for r in range(44,72))
assert all(s.cell(r,12).value==SOURCE and s.cell(r,13).value==YELLOW for r in range(22,40))
assert all(a.cell(r,9).value==SOURCE and a.cell(r,10).value==YELLOW for r in range(12,15))
assert a['A15'].value=='یادداشت' and q['A72'].value=='یادداشت' and s['A47'].value=='یادداشت'
assert all(re.fullmatch(r'[۰-۹]+',str(q.cell(r,c).value)) for r in range(44,72) for c in range(7,11))
assert all(not re.search(r'[0-9]',str(q.cell(r,c).value)) for r in range(44,72) for c in [5,7,8,9,10,14])
for r in range(44,72):
    opts=[q.cell(r,c).value for c in range(7,11)]
    assert len(set(opts))==4
    correct=letters.index(q.cell(r,11).value)
    mapped=re.findall(r'(الف|ب|ج|د)→(E_[A-Z_]+)',q.cell(r,12).value)
    assert {letter for letter,code in mapped}==set(letters)-{letters[correct]}, (r, q.cell(r,12).value, mapped, correct)
    assert all(any(e[0].split(' ')[0]==code for e in real_rows(a,r'E_[A-Z_]+(?: \(پیشنهاد\))?')) for _,code in mapped)
assert not (ROOT/'tools/cartridge-converter').exists(), 'converter now present: run it before claiming gate status'
w.save(OUT)
hash=sha256(OUT.read_bytes()).hexdigest()
(DIR/'khshab-G2-MATH_v0.4.sha256').write_text(f'{hash}  {OUT.name}\n',encoding='utf-8')
print('S1: 18 pages | atlas: 3 proposals | bank: 28 questions | correct: 7 each | SHA:',hash)
