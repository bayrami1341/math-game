// حلقهٔ گزارش ← اقدام: نگاشت گلوگاه تشخیص‌داده‌شده به ماموریت درمانی بازی
// منبع حقیقت ماموریت‌ها: math-game-v10.1/src/v9/experience.mjs → SIDE_MISSIONS
// هر ماموریت جانبی روی بازه‌ای از جدول‌های ضرب تمرکز دارد (focus.factors) و
// همین ماژول تعیین می‌کند کدام ماموریت برای درمان کدام گلوگاه پیشنهاد شود.

export interface Remedy {
  missionId: string;
  title: string;
  objective: string;
  /** بازهٔ جدول‌های ضرب که این ماموریت تمرین می‌دهد */
  tablesCovered: number[];
  /** نام بخش ایستگاه فضایی در بازی (برای راهنمایی معلم) */
  sectorHint: string;
}

export const SIDE_MISSION_REMEDIES: Record<string, Remedy> = {
  'side-1-antenna': {
    missionId: 'side-1-antenna',
    title: 'تعمیر آنتن فرعی',
    objective: 'یک آنتن کوچک را با سلول‌های درست روشن کن.',
    tablesCovered: [2, 3, 4, 5],
    sectorHint: 'ایستگاه نیرو',
  },
  'side-2-backup': {
    missionId: 'side-2-backup',
    title: 'شارژ سلول پشتیبان',
    objective: 'سلول‌های پشتیبان برج را فعال کن.',
    tablesCovered: [6, 7, 8, 9],
    sectorHint: 'ایستگاه آنتن',
  },
  'side-3-fuel': {
    missionId: 'side-3-fuel',
    title: 'تأمین سوخت اضافه',
    objective: 'سوخت اضافه برای سفینه آماده کن.',
    tablesCovered: [10, 11, 12],
    sectorHint: 'سکوی پرتاب',
  },
};

/** ماموریت درمانی مناسب برای یک جدول ضرب (۲ تا ۱۲) */
export function remedyForTable(table: number): Remedy | null {
  for (const remedy of Object.values(SIDE_MISSION_REMEDIES)) {
    if (remedy.tablesCovered.includes(table)) return remedy;
  }
  return null;
}

/** بهترین ماموریت برای فاکتور a×b — اولین جدولِ تحت پوشش مبنای انتخاب است */
export function remedyForFact(a: number, b: number): Remedy | null {
  for (const t of [a, b]) {
    if (t >= 2 && t <= 12) {
      const remedy = remedyForTable(t);
      if (remedy) return remedy;
    }
  }
  return null;
}
