#!/usr/bin/env bash
# release-check.sh — گیت سخت انتشار «کارگاه ضرب» (BP-010)
# هدف: هیچ تگی بدون گزارشنامهٔ سبز ساخته نشود. همهٔ مراحل fail-closed: نخستین قرمزی = خروج ≠۰.
# اجرا: bash scripts/release-check.sh   (از هر جا؛ خودش به ریشهٔ مخزن می‌رود)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
FAILED=0
STEP() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
OK()   { printf '  \033[1;32m✅ %s\033[0m\n' "$1"; }
BAD()  { printf '  \033[1;31m⛔ %s\033[0m\n' "$1"; FAILED=1; }

echo "🛡️ گیت سخت انتشار — کارگاه ضرب | $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ── گام ۱: سازگاری نسخه در مخزن ─────────────────────────────────────────────
STEP "گام ۱ — سازگاری نسخه (package.json ↔ سند انتشار ↔ سورس)"
VERSION=$(python3 -c "import json;print(json.load(open('public/math-game/package.json'))['version'])")
if [[ -f "public/math-game/RELEASE-NOTES-${VERSION}.md" || -f "public/math-game/RELEASE-NOTES-v${VERSION}.md" ]]; then
  OK "یادداشت انتشار موجود: RELEASE-NOTES-*${VERSION}.md"
else
  BAD "یادداشت انتشار برای ${VERSION} یافت نشد (RELEASE-NOTES-*${VERSION}.md)"
fi
MISMATCH=$(python3 - "$VERSION" << 'PY'
import os, re, sys
version = sys.argv[1]
pat = re.compile(r'10\.3\.0-beta\.[0-9]+')
bad = []
for base, dirs, files in os.walk('public/math-game'):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git')]
    for f in files:
        p = os.path.join(base, f)
        if not f.endswith(('.html', '.js', '.json')) or 'package-lock' in f or f.startswith('RELEASE-NOTES-'):
            continue
        try:
            txt = open(p, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        found = set(pat.findall(txt))
        if any(v != version for v in found):
            bad.append(f'{p}: {sorted(found)}')
print('\n'.join(bad))
PY
)
if [[ -n "$MISMATCH" ]]; then
  BAD "رشتهٔ نسخهٔ ناسازگار یافت شد:"; echo "$MISMATCH"
else
  OK "نسخهٔ یکتا: ${VERSION} (سورس HTML/JS/JSON ناسازگار ندارد)"
fi

# ── گام ۲: گاردهای گیت (G0 حق‌نشر + G0B مرز مالکیت) ─────────────────────────
STEP "گام ۲ — گاردهای G0/G0B"
python3 - << 'PY' || FAILED=1
from authoring.agent.git_guard import check_git_safety, check_ownership_boundary
r1 = check_git_safety('.')
print('  G0:', r1.summary)
assert r1.status == 'PASS', r1.summary
r2 = check_ownership_boundary('.')
print('  G0B:', r2.summary)
assert r2.status != 'FAIL', r2.summary
PY
[[ "$FAILED" -eq 0 ]] && OK "G0 و G0B سبز"

# ── گام ۳: مانیفست سرهای رسمی ───────────────────────────────────────────────
STEP "گام ۳ — OFFICIAL-HEADS verify"
if python3 -m authoring.agent.cli heads --verify --repo-root . > /tmp/rc-heads.json 2>&1; then
  OK "شش خانوادهٔ G1..G6 هم‌SHA با فایل‌های واقعی"
else
  BAD "مانیفست سرها نامعتبر:"; cat /tmp/rc-heads.json | tail -n 5
fi

# ── گام ۴: پایتست ایجنت (W7) ────────────────────────────────────────────────
STEP "گام ۴ — پایتست ایجنت (authoring/tests)"
if OUT=$(python3 -m pytest authoring/tests -q 2>&1 | tail -n 1); [[ "$OUT" == *" passed"* && "$OUT" != *"failed"* ]]; then
  OK "پایتست: $OUT"
else
  BAD "پایتست سبز نشد: $OUT"
fi

# ── گام ۵: تست‌های موتور بازی ───────────────────────────────────────────────
STEP "گام ۵ — npm test موتور (public/math-game)"
OUT=$(cd public/math-game && npm test 2>&1 | rg -o "pass [0-9]+|fail [0-9]+" | tr '\n' ' ')
if echo "$OUT" | rg -q "pass" && echo "$OUT" | rg -q "fail 0"; then
  OK "موتور: $OUT"
else
  BAD "موتور قرمز: $OUT"
fi

# ── گام ۶: مبدل رسمی روی سرهای G2/G3 + تطبیق کارتریج منتشرشده ───────────────
STEP "گام ۶ — مبدل رسمی (self-baseline) + تطبیق کارتریج منتشرشده با هَد"
for FAM in "G2:khshab-G2-MATH_v0.5.xlsx" "G3:khshab-G3-MATH_v0.7.xlsx"; do
  GRADE="${FAM%%:*}"; FILE="${FAM##*:}"
  XLSX="public/math-game/authoring/${FILE}"
  cp "public/math-game/cartridges/KH-${GRADE}-MATH.json" "/tmp/rc-pub-${GRADE}.json"
  CONV=$(cd tools/cartridge-converter && timeout 180 bun convert.mjs "$ROOT/$XLSX" 2>&1)
  GATE_LINE=$(echo "$CONV" | rg -o "گیت:.*" | head -n 1)
  if echo "$GATE_LINE" | rg -q "0 قرمز"; then OK "مبدل ${GRADE}: ${GATE_LINE}"; else BAD "مبدل ${GRADE} قرمز: ${GATE_LINE}"; fi
  python3 - "$GRADE" "$FILE" << 'PY' || FAILED=1
import json, sys
grade, headfile = sys.argv[1], sys.argv[2]
pub = json.load(open(f'public/math-game/cartridges/KH-{grade}-MATH.json'))
src = (pub.get('source') or {}).get('file', '')
if src != headfile:
    print(f'  ⛔ کارتریج منتشرشده KH-{grade}-MATH.json از هَد رسمی نیست (source={src} ≠ {headfile})')
    sys.exit(1)
print(f'  منبع کارتریج KH-{grade} = {src} ✓')
PY
  AFTER=$(sha256sum "public/math-game/cartridges/KH-${GRADE}-MATH.json" | awk '{print $1}')
  BEFORE=$(sha256sum "/tmp/rc-pub-${GRADE}.json" | awk '{print $1}')
  if [[ "$BEFORE" != "$AFTER" ]]; then
    python3 - "$GRADE" << 'PY' || FAILED=1
import json, sys, re
grade = sys.argv[1]
def norm(p):
    d = json.load(open(p))
    d.pop('generatedAt', None)
    return json.dumps(d, sort_keys=True, ensure_ascii=False)
if norm(f'public/math-game/cartridges/KH-{grade}-MATH.json') != norm(f'/tmp/rc-pub-{grade}.json'):
    print(f'  ⛔ بازتولید KH-{grade} با نسخهٔ منتشرشده تفاوت ماهوی دارد (نشت درفت/آلودگی!)')
    sys.exit(1)
print(f'  KH-{grade}: فقط تفاوت timestamp — محتوا منطبق ✓')
PY
  fi
done
# بازگرداندن درخت به حالت کامیت‌شده (خروجی مبدل = همان محتوای منتشرشده؛ فقط timestamp)
git checkout -- public/math-game/cartridges/ download/ 2>/dev/null

# ── گزارشنامه ───────────────────────────────────────────────────────────────
printf '\n'
if [[ "$FAILED" -eq 0 ]]; then
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  🟢 RELEASE-CHECK PASS — گزارشنامهٔ انتشار صادر شد    ║"
  echo "║  نسخه: ${VERSION}                                     ║"
  echo "║  تگ ساختن اکنون مجاز است.                            ║"
  echo "╚══════════════════════════════════════════════════════╝"
  exit 0
else
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║  🔴 RELEASE-CHECK FAIL — ساخت تگ ممنوع است           ║"
  echo "║  نخستین گام قرمز را در خروجی بالا ببینید.            ║"
  echo "╚══════════════════════════════════════════════════════╝"
  exit 1
fi
