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

## اسکیمای وضعیت

`draft → awaiting_approval → approved → executing → delivered → verified → done` (+ `blocked`/`rejected`)
