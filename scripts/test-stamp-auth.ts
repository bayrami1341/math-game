// ─────────────────────────────────────────────────────────────────────────────
// آزمون منفی امنیت ثبت مُهر (T3/BP-021) — فرمان مالک:
//   «تا عبور تست دسترسی ناشناس و جعل نقش، مسیر ثبت مهر در استقرار نباید
//    بدون حفاظت در دسترس باشد» + پروتکل آرنا مادهٔ ۲ (ادعای نقش ≠ credential)
//
// مصرف: bun scripts/test-stamp-auth.ts
// کد خروج: ۰ = همهٔ تلاش‌های جعل رد شدند و توکن معلم واقعی پذیرفته شد؛ ۱ = حفره.
//
// پنج سناریو الزامی + دو سناریوی قرنطینه:
//   ۱. دسترسی ناشناس (بدون هدر)                 → 401 STAMP_AUTH_REQUIRED
//   ۲. جعل نقش در بدنه (role=human_teacher,
//      authenticated=true، by=معلم؛ بدون توکن)  → 401 + هیچ رأیی ساخته نمی‌شود
//   ۳. توکن غلط (پراکس ریزربات)                  → 401 STAMP_AUTH_INVALID
//   ۴. سرور بدون توکن تنظیم‌شده                  → 503 STAMP_AUTH_DISABLED (fail-closed)
//   ۵. توکن معلم واقعی                           → عبور + identity سمت سرور
//   ۶. قرنطینهٔ ادعا: claimedRole/claimedBy فقط audit — authenticatedAs مستقل
//   ۷. هویت معلم هرگز از فیلد کلاینت نمی‌آید حتی با توکن معتبر
// ─────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import {
  authorizeStampRequest,
  sanitizeStampBody,
  TEACHER_IDENTITY,
  timingSafeEqualStr,
} from "../src/lib/stamp-auth.ts";

const SERVER_TOKEN = "teacher-secret-token-demo-1404";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://khshab.example/api/teacher-review/stamp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const FORGED_BODY = {
  family: "KH-G2-MATH",
  verdict: "approve",
  by: "معلم",
  role: "human_teacher",
  actor_role: "human_teacher",
  authenticated: true,
};

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ❌ ${name} — ${(e as Error).message.split("\n")[0]}`);
  }
}

console.log("== آزمون امنیت ثبت مُهر (T3) — شکست عمدی ==");

check("۱. دسترسی ناشناس → 401 و رأیی ساخته نمی‌شود", () => {
  const r = authorizeStampRequest(post(FORGED_BODY), SERVER_TOKEN);
  assert.equal(r.ok, false);
  if (r.ok) throw new Error("unreachable");
  assert.equal(r.response.status, 401);
});

check("۲. جعل نقش در بدنه بدون توکن → 401؛ ادعا credential نیست", () => {
  // حتی با role=human_teacher و authenticated=true و by=معلم در بدنه:
  const r = authorizeStampRequest(post(FORGED_BODY), SERVER_TOKEN);
  assert.equal(r.ok, false);
  if (r.ok) throw new Error("unreachable");
  assert.equal(r.response.status, 401);
  // هیچ مسیر پذیرشی برای بدنهٔ فاقد توکن وجود ندارد — sanitizeStampBody خودش
  // ادعاها را قرنطینه می‌کند (تست ۶)؛ یعنی «رأی معلم» فقط از مسیر تست ۵ می‌آید.
});

check("۳. توکن غلط (پراکس ریزربات) → 401 STAMP_AUTH_INVALID", () => {
  const r = authorizeStampRequest(
    post(FORGED_BODY, { Authorization: "Bearer robot-not-a-teacher" }),
    SERVER_TOKEN
  );
  assert.equal(r.ok, false);
  if (r.ok) throw new Error("unreachable");
  assert.equal(r.response.status, 401);
});

check("۴. سرور بدون توکن تنظیم‌شده → 503 STAMP_AUTH_DISABLED (fail-closed)", () => {
  const r = authorizeStampRequest(post(FORGED_BODY, { Authorization: `Bearer ${SERVER_TOKEN}` }), "");
  assert.equal(r.ok, false);
  if (r.ok) throw new Error("unreachable");
  assert.equal(r.response.status, 503);
  // و با env خالی هم همین‌طور
  const prev = process.env.TEACHER_STAMP_TOKEN;
  delete process.env.TEACHER_STAMP_TOKEN;
  const r2 = authorizeStampRequest(post(FORGED_BODY, { Authorization: `Bearer ${SERVER_TOKEN}` }));
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.response.status, 503);
  if (prev !== undefined) process.env.TEACHER_STAMP_TOKEN = prev;
});

check("۵. توکن معلم واقعی → عبور؛ هویت سمت سرور ساخته می‌شود", () => {
  const r = authorizeStampRequest(
    post({ family: "KH-G2-MATH", verdict: "approve" }, { Authorization: `Bearer ${SERVER_TOKEN}` }),
    SERVER_TOKEN
  );
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("unreachable");
  assert.equal(r.identity, TEACHER_IDENTITY);
});

check("۶. قرنطینهٔ ادعا: authenticatedAs مستقل؛ claimed* فقط audit", () => {
  const s = sanitizeStampBody(FORGED_BODY as Record<string, unknown>, TEACHER_IDENTITY);
  assert.equal(s.authenticatedAs, TEACHER_IDENTITY);
  assert.equal(s.claimedBy, "معلم");
  assert.equal(s.claimedRole, "human_teacher");
  assert.equal(s.claimedAuthenticated, true);
  // هویت معتبر هرگز از ادعای کلاینت کپی نمی‌شود — حتی وقتی ادعا «معلم» است
  assert.notEqual(s.authenticatedAs, s.claimedBy);
});

check("۷. بدون هیچ ادعایی هم هویت سرور همان است (هویت = f(توکن) نه f(بدنه))", () => {
  const s = sanitizeStampBody({ family: "KH-G2-MATH", verdict: "approve" }, TEACHER_IDENTITY);
  assert.equal(s.authenticatedAs, TEACHER_IDENTITY);
  assert.equal(s.claimedBy, null);
  assert.equal(s.claimedRole, null);
});

check("۸. مقایسهٔ زمان-ایم توکن سالم است", () => {
  assert.equal(timingSafeEqualStr(SERVER_TOKEN, SERVER_TOKEN), true);
  assert.equal(timingSafeEqualStr(SERVER_TOKEN, "teacher-secret-token-demo-1405"), false);
  assert.equal(timingSafeEqualStr("", SERVER_TOKEN), false);
});

if (failures > 0) {
  console.log(`\nنتیجه: ❌ قرمز — ${failures} حفره`);
  process.exit(1);
}
console.log("\nنتیجه: ✅ دسترسی ناشناس و جعل نقش رد شدند؛ رأی معلم فقط با توکن سرور ممکن است.");
