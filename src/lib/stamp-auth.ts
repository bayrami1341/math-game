// ─────────────────────────────────────────────────────────────────────────────
// احراز هویت سمت سرور برای ثبت مُهر رأی تربیتی (T3/BP-021 — فرمان مالک:
// «الحاق پروتکل ریزربات‌های G2 به BP-021»، بند ۲ و پروتکل آرنا مادهٔ ۲)
//
// قاعدهٔ غیرقابل‌مذاکره:
//   ۱) هویت و اختیارِ ثبت مهر فقط سمت سرور اثبات می‌شود — از توکن مالک/معلم در
//      متغیر محیطی TEACHER_STAMP_TOKEN. هیچ فیلد ارسالی کلاینت (by، role،
//      actor_role، authenticated) هرگز رأی معلم نمی‌سازد و هرگز هویت نمی‌دهد.
//   ۲) fail-closed مطلق: اگر توکن سرور تنظیم نشده باشد، endpoint برای همه ۵۰۳
//      برمی‌گرداند — «مسیر ثبت مهر بدون حفاظت در دسترس نیست» حتی برای ادمین.
//   ۳) فقط یک هویت مجاز وجود دارد: معلمِ توکن‌دار. توکن ربات وجود ندارد؛
//      «نقش ریزربات در رجیستری credential نیست» (پروتکل G2 مادهٔ ۱).
//   ۴) مقایسهٔ توکن با timing-safe تا نشت زمانی ممکن نباشد.
//   ۵) ادعاهای کلاینت حذف یا قرنطینه می‌شوند: در رکورد فقط به‌عنوان
//      claimedBy/claimedRole (غیرمعتبر، برای audit جعل) ذخیره می‌شوند.
//
// این ماژول عمداً وابسته به next/server نیست (Request/Response استاندارد Web) تا
// تصمیم‌های امنیتی‌اش مستقیماً با bun قابل آزمون باشد: scripts/test-stamp-auth.ts
// ─────────────────────────────────────────────────────────────────────────────

/** هویتی که سرور از توکن می‌سازد — کلاینت هیچ کنترلی روی آن ندارد */
export const TEACHER_IDENTITY = "معلم-احرازشده-با-توکن-سرور";

export type StampAuthFailure = {
  ok: false;
  response: Response;
};

export type StampAuthSuccess = {
  ok: true;
  identity: typeof TEACHER_IDENTITY;
};

function jsonError(status: number, code: string, errorFa: string): Response {
  return new Response(JSON.stringify({ ok: false, code, error: errorFa }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** مقایسهٔ زمان-ایمن دو رشته (برای توکن) */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const len = Math.max(ab.length, bb.length);
  const padA = new Uint8Array(len);
  const padB = new Uint8Array(len);
  padA.set(ab);
  padB.set(bb);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= padA[i]! ^ padB[i]!;
  return diff === 0;
}

/** استخراج توکن از هدرها: Authorization: Bearer … یا X-Stamp-Token */
export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const tok = auth.slice(7).trim();
    if (tok) return tok;
  }
  const alt = req.headers.get("x-stamp-token");
  if (alt && alt.trim()) return alt.trim();
  return null;
}

/**
 * گیت احراز هویت ثبت مُهر — fail-closed.
 * ورودی: Request استاندارد + (اختیاری) توکن سرور برای تست.
 * خروجی: یا Response خطا (401/503) یا { ok: true, identity }.
 */
export function authorizeStampRequest(
  req: Request,
  serverToken?: string
): StampAuthFailure | StampAuthSuccess {
  // ۱) fail-closed: بدون توکن تنظیم‌شده، هیچ‌کس (حتی ادمین) نمی‌تواند مُهر بزند
  const token = serverToken ?? process.env.TEACHER_STAMP_TOKEN ?? "";
  if (!token || !token.trim()) {
    return {
      ok: false,
      response: jsonError(
        503,
        "STAMP_AUTH_DISABLED",
        "ثبت مُهر غیرفعال است: توکن احراز هویت معلم روی سرور تنظیم نشده (fail-closed). مسیر ثبت رأی بدون حفاظت در دسترس نیست."
      ),
    };
  }

  // ۲) توکن باید در هدر بیاید — دسترسی ناشناس ممنوع
  const presented = extractBearerToken(req);
  if (!presented) {
    return {
      ok: false,
      response: jsonError(
        401,
        "STAMP_AUTH_REQUIRED",
        "ثبت مُهر نیازمند احراز هویت است: توکن معلم را در هدر Authorization: Bearer بفرستید. دسترسی ناشناس رد شد."
      ),
    };
  }

  // ۳) توکن نامعتبر = جعل هویت
  if (!timingSafeEqualStr(presented, token)) {
    return {
      ok: false,
      response: jsonError(
        401,
        "STAMP_AUTH_INVALID",
        "توکن ارسالی معتبر نیست. نقش یا نام ارسالی در بدنهٔ درخواست جایگزین احراز هویت نمی‌شود."
      ),
    };
  }

  return { ok: true, identity: TEACHER_IDENTITY };
}

export type StampBodyRecord = Record<string, unknown>;

/**
 * پالایش بدنهٔ مُهر: ادعاهای هویتی کلاینت قرنطینه می‌شوند.
 * خروجی فقط با identity سمت سروری که authorizeStampRequest ساخته معتبر است.
 */
export function sanitizeStampBody(
  body: StampBodyRecord,
  identity: string
): StampBodyRecord {
  const claimedBy = typeof body.by === "string" ? body.by.slice(0, 200) : null;
  const claimedRole =
    typeof body.role === "string"
      ? body.role.slice(0, 100)
      : typeof body.actor_role === "string"
        ? body.actor_role.slice(0, 100)
        : null;
  const claimedAuthenticated = body.authenticated === true;

  return {
    // فقط فیلدهای محتوایی مشروع
    family: body.family,
    candidateBranch: body.candidateBranch ?? null,
    candidateSha: body.candidateSha ?? null,
    verdict: body.verdict,
    note: typeof body.note === "string" ? body.note.slice(0, 2000) : "",
    // هویت: فقط سمت سرور
    authenticatedAs: identity,
    authMethod: "bearer-teacher-token-server-side",
    // قرنطینهٔ ادعاها — هرگز معتبر نیستند، فقط برای audit جعل
    claimedBy,
    claimedRole,
    claimedAuthenticated,
  };
}
