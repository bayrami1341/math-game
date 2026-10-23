// POST /api/domain-matrix/stamp — ثبت رسید «مُهر گام صفر» روی ماتریس دامنه‌ها
// قرارداد حاکمیتی (گام صفر):
//  - فقط انسان مُهر می‌زند؛ AI هرگز مُهر نمی‌زند و رسید AI-ساخت رد می‌شود.
//  - مُهر به بایت‌های ماتریس بسته می‌شود (SHA-256)؛ اگر محتوا عوض شود مُهر نامعتبر است.
//  - این رسید «محلی» است؛ قفل رسمی در مخزن (registry + status) پس از تأیید صاحب کار در چت
//    و با ثبت Z.ai انجام می‌شود — تا آن لحظه ماتریس در مخزن DRAFT می‌ماند.

import { NextRequest, NextResponse } from "next/server";
import {
  appendReceipt,
  getMatrixView,
  getReceipts,
  tehranNowFa,
  type StepZeroReceipt,
} from "@/lib/dashboard/domain-matrix";

export const dynamic = "force-dynamic";

interface StampBody {
  teacherName?: unknown;
  matrixSha256?: unknown;
  confirmations?: {
    chaptersMatchBook?: unknown;
    minCountsAgreed?: unknown;
    questionTypesAgreed?: unknown;
  };
  note?: unknown;
}

function badRequest(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: message, ...extra },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  let body: StampBody;
  try {
    body = (await req.json()) as StampBody;
  } catch {
    return badRequest("بدنهٔ درخواست JSON معتبر نیست.");
  }

  // ۱) هویت انسانی — حداقلِ متقن: نام واقعی صاحب کار/معلم
  const teacherName =
    typeof body.teacherName === "string" ? body.teacherName.trim() : "";
  if (teacherName.length < 3) {
    return badRequest(
      "نام معلم/صاحب کار لازم است (حداقل ۳ نویسه). مُهر بی‌نام ثبت نمی‌شود."
    );
  }

  // ۲) هر سه تأیید آگاهانه باید صریحاً true باشد (fail-closed)
  const c = body.confirmations ?? {};
  const confirmations = {
    chaptersMatchBook: c.chaptersMatchBook === true,
    minCountsAgreed: c.minCountsAgreed === true,
    questionTypesAgreed: c.questionTypesAgreed === true,
  };
  const missing: string[] = [];
  if (!confirmations.chaptersMatchBook)
    missing.push("تطبیق دامنه‌ها با فصل‌های کتاب");
  if (!confirmations.minCountsAgreed)
    missing.push("توافق با حداقل سؤال هر دامنه");
  if (!confirmations.questionTypesAgreed)
    missing.push("توافق با انواع تمرین هر دامنه");
  if (missing.length > 0) {
    return badRequest(
      `برای مُهر گام صفر باید هر سه تأیید را بپذیرید؛ ناقص: ${missing.join("، ")}.`
    );
  }

  // ۳) مُهر باید به همان بایت‌هایی بسته شود که دیده‌اید (bind به SHA-256)
  let view;
  try {
    view = await getMatrixView();
  } catch (err) {
    console.error("stamp: matrix read failed:", err);
    return NextResponse.json(
      { error: "خواندن ماتریس در لحظهٔ مُهر ناموفق بود؛ مُهر ثبت نشد." },
      { status: 503 }
    );
  }

  if (body.matrixSha256 !== view.sha256) {
    return NextResponse.json(
      {
        error:
          "محتوای ماتریس از لحظهٔ بازدید شما تغییر کرده است (هش نمی‌خواند). صفحه را بازآوری کنید و دوباره بررسی کنید.",
        expectedSha256: view.sha256,
      },
      { status: 409 }
    );
  }

  // ۴) یک مُهر برای هر نسخهٔ ماتریس — تکرار رد می‌شود
  const receipts = await getReceipts();
  const existing = receipts.find(
    (r) => r.matrixSha256 === view.sha256 && r.officialStatus !== "REJECTED"
  );
  if (existing) {
    return NextResponse.json(
      {
        error:
          "برای این نسخه از ماتریس قبلاً مُهر گام صفر ثبت شده است. برای مُهر دوباره، نخست باید نسخهٔ تازه‌ای از ماتریس منتشر شود.",
        receipt: existing,
      },
      { status: 409 }
    );
  }

  // ۵) ثبت رسید محلی
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const receipt: StepZeroReceipt = {
    id: `step-zero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    recordedAt: new Date().toISOString(),
    recordedAtTehran: tehranNowFa(),
    teacherName,
    role: "معلم / صاحب کار — مُهر دست انسان",
    matrixSha256: view.sha256,
    matrixSource: view.source,
    confirmations,
    note,
    officialStatus:
      "RECORDED_LOCALLY — در انتظار ثبت رسمی در مخزن با فرمان صاحب کار",
  };

  try {
    const updated = await appendReceipt(receipt);
    return NextResponse.json({ receipt, receipts: updated }, { status: 201 });
  } catch (err) {
    console.error("stamp: receipt write failed:", err);
    return NextResponse.json(
      { error: "نوشتن رسید ناموفق بود؛ مُهر ثبت نشد. دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}
