// Hard constants strictly governed by station-brief.md and Architecture v10
export const BUILDINGS = {
  POWER: 1, // نیروگاه
  TOWER: 2, // برج ارتباط
  PAD: 3    // سکوی پرتاب
};

export const ORDER = [BUILDINGS.POWER, BUILDINGS.TOWER, BUILDINGS.PAD];

export const BUILDING_NAMES = {
  1: 'نیروگاه',
  2: 'برج ارتباط',
  3: 'سکوی پرتاب'
};

export const BUILDING_SENSATIONS = {
  1: 'نور',
  2: 'صدا',
  3: 'گرمای سوخت'
};

export const BUILDING_STATE = {
  LOCKED: 'locked',
  CURRENT: 'current',
  DONE: 'done'
};

export const MAP_COMBOS = {
  START: 'START',             // نیروگاه جاری، برج قفل، سکو قفل، هر دو راه خاموش
  AFTER_POWER: 'AFTER_POWER', // نیروگاه تمام، برج جاری، سکو قفل، فقط راه اول روشن
  FINISHED: 'FINISHED'        // هر سه تمام، هر دو راه روشن، هیچ حلقه‌ای نیست
};

export const MAIN_BUTTON_LABELS = {
  1: 'ادامهٔ چراغ‌ها',
  2: 'ادامهٔ پیام',
  3: 'ادامهٔ سکو'
};

export const COLORS = {
  bg: '#071427',
  header: '#122441',
  accent: '#146a62',
  currentRing: '#7ef0ff',
  done: '#5ee0b5',
  locked: '#8aa0ab'
};

export const SOUND_CONFIG = {
  MAX_VOLUME: 0.045,
  DEFAULT_ENABLED: false
};

export const SOUND_EVENTS = {
  accepted: 'tick',          // یک تیک کوتاه
  wrong: 'drop',             // افت خیلی کوتاه
  buildingDone: 'layer',     // یک لایهٔ کوتاه، بعد قطع
  locked: 'click',           // کلیک بی‌برق
  pathLit: 'glow',           // حدود یک ثانیه درخشش
  allDone: 'threeLayers',    // سه لایه یک بار، بعد آرام
  ambient: 'bed'             // بستر بی‌کلام
};

// Forbidden concepts strictly prohibited by station-brief.md
export const FORBIDDEN_WORDS = [
  'مسئولیت',
  'بحران',
  'هویت',
  'فداکاری',
  'قهرمان کیهان',
  'جنگ',
  'دشمن',
  'گنج',
  'صندوقچه',
  'اشتباه کردی',
  'باختی',
  'پرواز به بیرون نقشه',
  'نصیحت'
];
