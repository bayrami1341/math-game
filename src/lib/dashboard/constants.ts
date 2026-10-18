// ثابت‌ها و قالب‌بندی فارسی داشبورد معلم

import type { Severity, StudentStatus } from './types';

/** مدل ۹ لایهٔ عمق کارگاه ضرب — هم‌راستا با DEPTH_LAYERS نسخهٔ ۱۰.۱ */
export const DEPTH_LAYERS: { layer: number; name: string; short: string }[] = [
  { layer: 1, name: 'معنای ضرب و جمع تکراری', short: 'معنای ضرب' },
  { layer: 2, name: 'مضاعف‌سازی و جدول ۲', short: 'جدول ۲' },
  { layer: 3, name: 'جدول ۵ و ۱۰', short: 'جدول ۵ و ۱۰' },
  { layer: 4, name: 'جدول ۳ و ۴', short: 'جدول ۳ و ۴' },
  { layer: 5, name: 'جدول ۶ و ۷', short: 'جدول ۶ و ۷' },
  { layer: 6, name: 'جدول ۸', short: 'جدول ۸' },
  { layer: 7, name: 'جدول ۹ و الگوی ۱۰', short: 'جدول ۹' },
  { layer: 8, name: 'جابه‌جایی و تجزیه', short: 'تجزیه' },
  { layer: 9, name: 'تسلط نهایی و سرعت', short: 'تسلط نهایی' },
];

export function layerName(layer: number): string {
  return DEPTH_LAYERS.find((l) => l.layer === layer)?.name ?? `لایهٔ ${layer}`;
}

export function layerShort(layer: number): string {
  return DEPTH_LAYERS.find((l) => l.layer === layer)?.short ?? `لایهٔ ${layer}`;
}

/** پیشنهاد آموزشی برای هر جدول ضرب */
export const TABLE_TIPS: Record<number, string> = {
  2: 'مضاعف‌سازی: شمارش دوتایی و دوبرابرکردن اعداد',
  3: 'شمارش سه‌سه و کشف الگوی ۳ با دسته‌بندی اشیاء',
  4: 'دوبلِ دوبل: دو بار پشت‌سرهم دوبرابرکردن',
  5: 'الگوی پنج‌تایی و ارتباط با ساعت و پول',
  6: 'تجزیه به ۵+۱؛ مثال: ۶×۷ = ۵×۷ + ۷',
  7: 'تجزیه به ۵+۲ و تمرین الگویی جدول ۷',
  8: 'مضاعف‌سازی از ۴ و کشف الگوی هشت',
  9: 'الگوی «۱۰ منهای عدد» و پاس‌های نزولی جدول ۹',
  10: 'افزودن صفر و ارتباط با ارزش مکانی',
  11: 'الگوی تکرار رقم و تجزیه به ۱۰+۱',
  12: 'تجزیه به ۱۰+۲ و پیوند با جدول ۶',
};

export const HERO_CONFIG: Record<string, { label: string; className: string }> = {
  astronaut: { label: 'فضانورد', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  pilot: { label: 'خلبان', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  scientist: { label: 'دانشمند', className: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export const STATUS_CONFIG: Record<StudentStatus, { label: string; badge: string; dot: string }> = {
  excellent: { label: 'درخشان', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  good: { label: 'خوب', badge: 'bg-teal-100 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  practice: { label: 'نیازمند تمرین', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  critical: { label: 'بحرانی', badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

export const SEVERITY_CONFIG: Record<Severity, { label: string; badge: string; bar: string }> = {
  critical: { label: 'بحرانی', badge: 'bg-rose-100 text-rose-700 border-rose-200', bar: 'bg-rose-500' },
  high: { label: 'قابل‌توجه', badge: 'bg-orange-100 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
  medium: { label: 'نیازمند تمرین', badge: 'bg-amber-100 text-amber-800 border-amber-200', bar: 'bg-amber-400' },
};

/** وضعیت دانش‌آموز بر اساس دقت */
export function statusFromAccuracy(acc: number | null | undefined): StudentStatus {
  if (acc === null || acc === undefined) return 'practice';
  if (acc >= 0.9) return 'excellent';
  if (acc >= 0.75) return 'good';
  if (acc >= 0.6) return 'practice';
  return 'critical';
}

// ─── قالب‌بندی فارسی ───

export function faNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('fa-IR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function faPercent(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return `٪${faNum(x * 100, digits)}`;
}

export function faDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function faDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function faRelative(iso: string | Date | null | undefined): string {
  if (!iso) return 'بدون فعالیت';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'همین حالا';
  if (m < 60) return `${faNum(m)} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${faNum(h)} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'دیروز';
  if (d < 30) return `${faNum(d)} روز پیش`;
  return faDate(iso);
}

export function faDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${faNum(s)} ثانیه`;
  if (s === 0) return `${faNum(m)} دقیقه`;
  return `${faNum(m)} دقیقه و ${faNum(s)} ثانیه`;
}
