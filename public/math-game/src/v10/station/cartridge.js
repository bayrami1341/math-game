// ─────────────────────────────────────────────────────────────────────────────
// لودر خشاب اجرایی (v10.3) — بارگذاری و اعتبارسنجی cartridge JSON در مرورگر
//
// اصل fail-closed: خشاب نامعتبر هرگز وارد UI نمی‌شود؛ خروجی همیشه وضعیت صادقانه
// دارد تا پنل معلم به‌جای نمایش دادهٔ خراب، پیام روشن بدهد.
// موتور اصلی (نیروگاه/برج/سکو) مستقل از این ماژول کار می‌کند — خرابی خشاب
// هیچ‌کدام از جلسه‌ها، قفل‌ها و تست‌های v10.2 را نمی‌شکند.
// ─────────────────────────────────────────────────────────────────────────────

import { validateCartridge, CARTRIDGE_ID } from './cartridge-schema.js';

const DEFAULT_URL = `cartridges/${CARTRIDGE_ID}.json`;
let cache = null;

/**
 * بارگذاری خشاب. خروجی:
 * { ok: true,  cartridge, validation }  یا  { ok: false, error, validation? }
 */
export async function loadCartridge(url = DEFAULT_URL) {
  if (cache) return cache;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      cache = { ok: false, error: `دریافت خشاب ناموفق بود (HTTP ${res.status})` };
      return cache;
    }
    const data = await res.json();
    const validation = validateCartridge(data);
    cache = validation.ok
      ? { ok: true, cartridge: data, validation }
      : { ok: false, error: 'خشاب اعتبارسنجی را نگذراند — نمایش داده نمی‌شود.', validation };
    return cache;
  } catch (e) {
    cache = { ok: false, error: `خطا در خواندن خشاب: ${e?.message || e}` };
    return cache;
  }
}

/** خروجی کش‌شده (بدون شبکه) — null یعنی هنوز بارگذاری نشده */
export function peekCartridge() {
  return cache;
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
