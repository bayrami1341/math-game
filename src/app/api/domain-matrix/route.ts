// GET /api/domain-matrix — ماتریس دامنه‌ها + هش بایت‌ها + رسیدهای مُهر گام صفر

import { NextResponse } from "next/server";
import { getMatrixView, getReceipts } from "@/lib/dashboard/domain-matrix";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const view = await getMatrixView();
    const receipts = await getReceipts();
    const alreadyStamped = receipts.some(
      (r) => r.matrixSha256 === view.sha256 && r.officialStatus !== "REJECTED"
    );

    return NextResponse.json(
      { ...view, receipts, alreadyStamped },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("domain-matrix GET failed:", err);
    return NextResponse.json(
      { error: "خواندن ماتریس دامنه‌ها ناموفق بود" },
      { status: 500 }
    );
  }
}
