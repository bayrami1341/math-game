// ─────────────────────────────────────────────────────────────────────────────
// لودر خشاب اجرایی (v10.3) — بارگذاری و اعتبارسنجی cartridge JSON در مرورگر
//
// اصل fail-closed: خشاب نامعتبر هرگز وارد UI نمی‌شود؛ خروجی همیشه وضعیت صادقانه
// دارد تا پنل معلم به‌جای نمایش دادهٔ خراب، پیام روشن بدهد.
// موتور اصلی (نیروگاه/برج/سکو) مستقل از این ماژول کار می‌کند — خرابی خشاب
// هیچ‌کدام از جلسه‌ها، قفل‌ها و تست‌های v10.2 را نمی‌شکند.
//
// چندخشابی (v10.3.1): شناسهٔ خشاب از نام فایل استخراج و به اعتبارسنج پاس می‌شود
// (تطابق دقیق فایل↔محتوا)؛ فهرست خشاب‌های نصب‌شده از داشبورد خوانده می‌شود و
// در استقرار استاتیک (بدون داشبورد) به‌صورت بی‌صدا به خشاب پیش‌فرض برمی‌گردد.
// ─────────────────────────────────────────────────────────────────────────────

import { validateCartridge, CARTRIDGE_ID } from './cartridge-schema.js';

const DEFAULT_URL = `cartridges/${CARTRIDGE_ID}.json`;
const LIST_API = '/api/cartridges';

/** کش موفق‌ها به تفکیک شناسه — شکست‌ها کش نمی‌شوند تا تلاش بعدی تازه باشد */
const cacheById = new Map();
let activeId = null;

/** استخراج شناسهٔ KH-… از مسیر فایل — null یعنی شناسه‌ای در URL نیست */
function idFromUrl(url) {
  const m = /KH-[A-Za-z0-9_-]+/.exec(String(url ?? ''));
  return m ? m[0] : null;
}

/**
 * بارگذاری خشاب. خروجی:
 * { ok: true,  id, cartridge, validation }  یا  { ok: false, id?, error, validation? }
 * fresh=true: کش را نادیده می‌گیرد (پس از نصب خشاب تازه یا تعویض انتخاب کاربر).
 */
export async function loadCartridge(url = DEFAULT_URL, { fresh = false } = {}) {
  const id = idFromUrl(url);
  const key = id || String(url);
  if (!fresh && cacheById.has(key)) return cacheById.get(key);
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, id, error: `دریافت خشاب ناموفق بود (HTTP ${res.status})` };
    }
    const data = await res.json();
    const validation = validateCartridge(data, id ?? undefined);
    if (!validation.ok) {
      return {
        ok: false,
        id,
        error: 'خشاب اعتبارسنجی را نگذراند — نمایش داده نمی‌شود.',
        validation
      };
    }
    const result = { ok: true, id, cartridge: data, validation };
    cacheById.set(key, result);
    activeId = id;
    return result;
  } catch (e) {
    return { ok: false, id, error: `خطا در خواندن خشاب: ${e?.message || e}` };
  }
}

/** خروجی کش‌شدهٔ خشاب فعال (بدون شبکه) — null یعنی هنوز بارگذاری موفق نشده */
export function peekCartridge() {
  return activeId ? (cacheById.get(activeId) ?? null) : null;
}

/** شناسهٔ خشاب فعال — null یعنی هنوز انتخابی بارگذاری نشده */
export function getActiveCartridgeId() {
  return activeId;
}

/**
 * فهرست خشاب‌های نصب‌شده از داشبورد (تک‌منبع حقیقت: پوشهٔ cartridges).
 * در استقرار استاتیک (GitHub Pages / بدون داشبورد) null برمی‌گردد —
 * فراخوانده به خشاب پیش‌فرض برمی‌گردد و بازی بی‌صدا مثل قبل کار می‌کند.
 */
export async function listAvailableCartridges() {
  try {
    const res = await fetch(LIST_API, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data?.cartridges) ? data.cartridges : null;
    if (!items) return null;
    return items.filter(x => x && typeof x.id === 'string');
  } catch {
    return null;
  }
}

/** خلاصهٔ آماری برای نمایش سریع در پنل معلم */
export function cartridgeSummary(cartridge) {
  const v = cartridge?.validation?.stats;
  if (!v) return null;
  return {
    questions: v.questions,
    questionsConfirmed: v.questionsConfirmed,
    questionsProposed: v.questionsProposed,
    lessons: v.lessons,
    lessonsConfirmed: v.lessonsConfirmed,
    atlasReal: v.atlasReal,
    atlasProposed: v.atlasProposed,
    red: cartridge.validation.gate.red,
    yellow: cartridge.validation.gate.yellow
  };
}
