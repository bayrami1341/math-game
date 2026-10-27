// API وضعیت ریل اصلی — فقط خواندنی؛ هیچ تغییری در مخزن ایجاد نمی‌کند.

import { NextResponse } from "next/server";
import { getRailView } from "@/lib/dashboard/rail-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const view = await getRailView();
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای ناشناخته";
    return NextResponse.json(
      { error: `خواندن وضعیت ریل ناموفق بود: ${message}` },
      { status: 500 }
    );
  }
}
