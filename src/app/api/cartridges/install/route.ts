// POST /api/cartridges/install — نصب خشاب از فایل JSON آپلودی (fail-closed)
//
// بدنه: { data: <شیء JSON خشاب>, overwrite?: boolean }
// خروجی:
//   201 { ok: true, id, overwritten, validation }  — نصب شد
//   400 { ok: false, reason, errors[], warnings[] } — خشاب گیت را نگذراند یا بدنه نامعتبر است (روی دیسک نمی‌رود)
//   409 { ok: false, reason, id }                   — شناسه تکراری است و overwrite=false
//   413 { error }                                    — فایل بیش از حد بزرگ
//
// گیت fail-closed: حتی یک قرمز = عدم نوشتن. همین تابعِ validateCartridge موتور بازی است
// (تک‌منبع حقیقت) — خشاب مردود هرگز وارد پوشهٔ cartridges نمی‌شود.

import { NextResponse } from "next/server";
import { installCartridge } from "@/lib/dashboard/cartridge-core";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 5 * 1024 * 1024; // ۵ مگابایت — خشاب واقعی ده‌ها کیلوبایت است

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "فایل بیش از حد بزرگ است (حداکثر ۵ مگابایت)." },
      { status: 413 }
    );
  }

  let body: { data?: unknown; overwrite?: boolean };
  try {
    body = (await request.json()) as { data?: unknown; overwrite?: boolean };
  } catch {
    return NextResponse.json(
      { ok: false, status: 400, reason: "بدنهٔ درخواست JSON معتبر نیست.", errors: [], warnings: [] },
      { status: 400 }
    );
  }

  try {
    const result = await installCartridge(body?.data, body?.overwrite === true);
    if (result.ok) {
      return NextResponse.json(result, { status: 201 });
    }
    return NextResponse.json(result, { status: result.status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        status: 500,
        reason: `نوشتن خشاب روی دیسک ناموفق بود: ${
          err instanceof Error ? err.message : "خطای ناشناخته"
        }`,
        errors: [],
        warnings: [],
      },
      { status: 500 }
    );
  }
}
