// مدل تشخیصی ۱۲خطای شناختی ضرب — منبع واحد (CEAP v2.1 §7.3)
// این فایل هم موتور تشخیص (diagnosis.ts) و هم فرانت‌اند (سلکت بازنویسی معلم) از آن می‌خوانند.

export type CpaStage = 'Concrete' | 'Pictorial' | 'Abstract';

export interface ErrorCodeMeta {
  code: string;
  titleFa: string;
  cpaStage: CpaStage;
  actionFa: string; // راهبرد مداخلهٔ بالینی آموزگار در کلاس
}

export const CPA_LABELS: Record<CpaStage, string> = {
  Concrete: 'مجسم',
  Pictorial: 'تصویری',
  Abstract: 'انتزاعی',
};

export const ERROR_CODES: Record<string, ErrorCodeMeta> = {
  E_ADD_CONFUSION: {
    code: 'E_ADD_CONFUSION',
    titleFa: 'تداخل جمع و ضرب',
    cpaStage: 'Concrete',
    actionFa: 'دسته‌بندی ملموس و مقایسهٔ تفاوت ۲+۳ با ۲ دستهٔ ۳تایی',
  },
  E_SKIP_OVERCOUNT: {
    code: 'E_SKIP_OVERCOUNT',
    titleFa: 'بیش‌شماری در الگوی جهشی',
    cpaStage: 'Pictorial',
    actionFa: 'رسم کمان‌های پرش روی محور اعداد خطی',
  },
  E_SKIP_UNDERCOUNT: {
    code: 'E_SKIP_UNDERCOUNT',
    titleFa: 'کم‌شماری در الگوی جهشی',
    cpaStage: 'Pictorial',
    actionFa: 'رنگ‌آمیزی خانه‌های جدول صدگان',
  },
  E_PLACE_SHIFT: {
    code: 'E_PLACE_SHIFT',
    titleFa: 'لغزش ارزش مکانی',
    cpaStage: 'Pictorial',
    actionFa: 'کار با جدول ارزش مکانی و بسته‌های ده‌تایی',
  },
  E_COMMUTATIVE_FAIL: {
    code: 'E_COMMUTATIVE_FAIL',
    titleFa: 'عدم درک خاصیت جابه‌جایی',
    cpaStage: 'Concrete',
    actionFa: 'چرخش ۹۰ درجه‌ای صفحهٔ مستطیلی شبکه‌ای',
  },
  E_ANCHOR_DRIFT: {
    code: 'E_ANCHOR_DRIFT',
    titleFa: 'انحراف محاسباتی از لنگر',
    cpaStage: 'Abstract',
    actionFa: 'تمرین صریح بازگویی فاکت مبنا و جمع/تفریق جزئی',
  },
  E_DOUBLING_HALVING: {
    code: 'E_DOUBLING_HALVING',
    titleFa: 'خطای دوبرابر/نصف کردن',
    cpaStage: 'Pictorial',
    actionFa: 'تا زدن متوالی کاغذ شطرنجی و مشاهدهٔ مساحت‌ها',
  },
  E_ZERO_PROPERTY: {
    code: 'E_ZERO_PROPERTY',
    titleFa: 'کژفهمی خاصیت ضرب در صفر',
    cpaStage: 'Concrete',
    actionFa: 'مدل بشقاب‌های خالی بدون عضو',
  },
  E_IDENTITY_CONFUSION: {
    code: 'E_IDENTITY_CONFUSION',
    titleFa: 'کژفهمی عنصر همانی (ضرب در ۱)',
    cpaStage: 'Concrete',
    actionFa: 'نمایش یک دسته و شمارش مستقیم اعضا',
  },
  E_DISTRIBUTIVE_LEAK: {
    code: 'E_DISTRIBUTIVE_LEAK',
    titleFa: 'خطای تفکیک و توزیع‌پذیری',
    cpaStage: 'Abstract',
    actionFa: 'مدل مساحت مستطیلی دو قسمتی دهگان و یکان',
  },
  E_PERSISTENT_GUESSING: {
    code: 'E_PERSISTENT_GUESSING',
    titleFa: 'حدس کور و غیرراهبردی',
    cpaStage: 'Concrete',
    actionFa: 'توقف فوری تمرین و مصاحبهٔ بالینی کلامی با کودک',
  },
  E_FATIGUE_SLIP: {
    code: 'E_FATIGUE_SLIP',
    titleFa: 'لغزش ناشی از افت توان توجه',
    cpaStage: 'Abstract',
    actionFa: 'وقفهٔ اجباری ۲ دقیقه‌ای و استراحت خارج از نمایشگر',
  },
};

export const ERROR_CODE_LIST: ErrorCodeMeta[] = Object.values(ERROR_CODES);

export function errorCodeMeta(code: string): ErrorCodeMeta | null {
  return ERROR_CODES[code] ?? null;
}
