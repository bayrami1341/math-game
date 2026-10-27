# 📐 نقشه‌های فنی (Blueprints) — راهنمای کوتاه

**SSOT:** `blueprints/registry.json` روی شاخهٔ `main` | **قانون کامل:** `GOVERNANCE.md`

## مالک فقط یک کار باید بکند — «تأیید واحد»

روی **تابلوی مرکزی مدیریت** (Issue گیت‌هاب که کارگاه‌بان می‌سازد) کامنت بگذارید:

```
تایید BP-001
تایید BP-002 BP-003      ← چند مورد با هم
تایید همه                ← هر نقشه‌ای که awaiting_approval است
```

کارگاه‌بان ظرف ≤۱۰ دقیقه (یا فوری با `POST :3030/scan`) تأیید را ثبت و دستور کار را دیسپچ می‌کند.

## عامل‌ها (Z.ai / آرنا)

```bash
bun scripts/blueprint.ts list                    # جدول وضعیت
bun scripts/blueprint.ts show BP-001             # جزئیات
bun scripts/blueprint.ts set-status BP-001 executing --note "شروع شد"
bun scripts/blueprint.ts set-status BP-001 delivered --note "آرتیفکت‌ها: ..."
bun scripts/blueprint.ts approve BP-001 --by "مالک-چت"   # ثبت تأیید چت مالک
bun scripts/blueprint.ts validate                # اعتبارسنجی رجیستری
```

هر تغییر وضعیت با کامیت روی `main` ثبت و پوش می‌شود؛ کارگاه‌بان تابلوی گیت‌هاب را خودکار به‌روز می‌کند.

## 🛡️ گیت سخت انتشار (BP-010)

```bash
bash scripts/release-check.sh   # ۶ گام fail-closed؛ خروج ۰ = تگ مجاز
```

گام‌ها: سازگاری نسخه (package.json ↔ RELEASE-NOTES ↔ سورس) · G0/G0B · OFFICIAL-HEADS verify · پایتست ایجنت (W7) · npm test موتور · مبدل رسمی G2/G3 + تطبیق کارتریج منتشرشده با هَد (ضد آلودگی auto-backup). تست منفی ثبت‌شده: دستکاری SHA مانیفست → FAIL (هم گام ۳، هم پایتست لایهٔ دوم گرفت). قرمزی = **ساخت تگ ممنوع**.

## اسکیمای وضعیت

`draft → awaiting_approval → approved → executing → delivered → verified → done` (+ `blocked`/`rejected`)

## ⛓️ موتور زنجیرهٔ اجرا (BP-011)

```bash
bash scripts/run-approved.sh dry-run            # ترتیب صف — بدون هیچ تغییری
bash scripts/run-approved.sh run                # زنجیرهٔ واقعی: گیت → CI → verified → پوش → بعدی
bash scripts/run-approved.sh run --bp BP-007    # فقط یک نقشه
bash scripts/run-approved.sh self-test          # T3: قرمزی گیت شبیه‌سازی‌شده → توقف ایمن، صفر جهش
```

قرارداد: بدنهٔ هر نقشه با دستِ ربات/عامل اجرا و پوش می‌شود؛ رانر فقط **گیت بین‌گام** (validate رجیستری + release-check ۶گام) و **گذار delivered → verified** (پس از سبزی CI روی هد) را خودکار می‌کند و به نقشهٔ بعدی می‌رود.

کدهای خروج: `0` تمیز | `1` گیت قرمز → `set-status block` + worklog + پوش + توقف | `2` بدنهٔ نقشهٔ بعدی اجرا نشده (توقف برای اجرای دستی) | `3` درخت کثیف/همگام‌سازی ناقص.

قاعدهٔ رد خودکار (skip، نه block): پیش‌شرط انسانی/رشته‌ای غایب — نمونه: BP-012 فقط با مُهر واقعی معلم در `authoring/teacher-stamps.json` (شمارش ≥ ۱) + وارسی‌شدن BP-007. این یعنی رانر **هرگز** نمی‌تواند انتشار پایدار را بدون مُهر معلم به جلو بکشد.

SELF-TEST سه‌گزاره‌ای ثبت‌شده (T3): (۱) dry-run تمیز exit ۰ (۲) `SIMULATE_RED_GATE=1` → کد ۱ + پیام BLOCK (۳) صفر جهش — SHA رجیستری و هد git دست‌نخورده. مسیر واقعی block از همان `set-status block` استاندارد می‌گذرد.
