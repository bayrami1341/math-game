// GET /api/cartridges        → فهرست خشاب‌های نصب‌شده با حکم گیت هرکدام
// GET /api/cartridges?id=…   → جزئیات کامل یک خشاب (شناسنامه + نقشهٔ کتاب + اطلس + بانک برچسب‌خورده)

import { NextResponse } from "next/server";
import { listCartridges, readCartridgeDetail } from "@/lib/dashboard/cartridge-core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (id) {
      const detail = await readCartridgeDetail(id);
      if (!detail) {
        return NextResponse.json(
          { error: `خشاب «${id}» یافت نشد — شناسه باید با الگوی KH-… باشد و فایلش در cartridges نصب شده باشد.` },
          { status: 404 }
        );
      }
      return NextResponse.json(detail);
    }
    return NextResponse.json({ cartridges: await listCartridges() });
  } catch (err) {
    return NextResponse.json(
      {
        error: `خواندن یا تحلیل خشاب ناموفق بود: ${
          err instanceof Error ? err.message : "خطای ناشناخته"
        }`,
      },
      { status: 500 }
    );
  }
}
