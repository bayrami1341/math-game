// GET /api/cartridge — خشاب پیش‌فرض (KH-G3-MATH) + برچسب‌سنجی زندهٔ هر گزینه با موتور واقعی بازی
//
// این مسیر برای سازگاری قدیمی نگه داشته شده — منطق مشترک به
// src/lib/dashboard/cartridge-core.ts منتقل شد (تک‌منبع حقیقت) و
// مسیر چندخشابی جدید /api/cartridges نیز از همان هسته استفاده می‌کند.
//
// خروجی: { cartridge: {cartridgeId, generatedAt, source, validation, identity}, bank: [...] }
// هر سؤال بانک: verdicts برای گزینه‌های انحرافی (گزینهٔ پاسخ رد می‌شود):
//   { letter, value, engineCode, claim } — engineCode=null یعنی «بی‌الگو»

import { NextResponse } from "next/server";
import { readCartridgeDetail } from "@/lib/dashboard/cartridge-core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const detail = await readCartridgeDetail("KH-G3-MATH");
    if (!detail) {
      return NextResponse.json(
        { error: "خشاب منتشرشدهٔ KH-G3-MATH یافت نشد — پوشهٔ cartridges را بررسی کنید." },
        { status: 500 }
      );
    }
    return NextResponse.json({ cartridge: detail.cartridge, bank: detail.bank });
  } catch (err) {
    return NextResponse.json(
      {
        error: `خواندن یا تحلیل خشاب منتشرشده ناموفق بود: ${
          err instanceof Error ? err.message : "خطای ناشناخته"
        }`,
      },
      { status: 500 }
    );
  }
}
