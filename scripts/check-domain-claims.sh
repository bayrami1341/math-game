#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# check-domain-claims.sh — گیت ضد-ادعای «آمادگی پایه» (BP-015 T3 — fail-closed)
#
# قانون: اعلام «پایه آماده» فقط در v1.0 با ماتریس کامل مُهرشدهٔ معلم مجاز است
# (سند «تعریف آمادگی پایهٔ درسی» §۵/§۸). این گیت هر نشانهٔ ادعای آمادگی را به
# شرط‌های قابل اندازه‌گیری گره می‌زند؛ نبودِ شرط = قرمز قطعی.
#
# منابع ادعا (دترمینیستیک — بدون تحلیل متنیِ مبهم):
#   ۱) OFFICIAL-HEADS.json — هر خانواده‌ای که version آن v1.0+ باشد
#   ۲) تگ‌های git با الگوی KH-*-v1.0*
#   ۳) یادداشت‌های انتشار (RELEASE-NOTES-*.md) حاوی عبارت «پایه آماده»
#   ۴) CLAIM_SIM_FAMILY — فقط برای سلف‌تست
#
# برای هر خانوادهٔ مُدّعی الزاماً:
#   a) گیت پوشش دامنه‌ای سبز: bun scripts/coverage-report.ts --gate
#   b) حداقل یک مُهر «approve» معلم در authoring/teacher-stamps.json
#
# استفاده:
#   bash scripts/check-domain-claims.sh            # گیت عادی (خروج ۰/۱)
#   bash scripts/check-domain-claims.sh --self-test # ادعای کاذب مصنوعی → باید قرمز شود
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."

HEADS="public/math-game/authoring/OFFICIAL-HEADS.json"
STAMPS="authoring/teacher-stamps.json"
SELF_TEST=0
[ "${1:-}" = "--self-test" ] && SELF_TEST=1

red()   { echo "⛔ [گیت ضد-ادعا] $*"; }
green() { echo "🟢 [گیت ضد-ادعا] $*"; }

claimed_families() {
  # ۱) هدهای رسمی با نسخهٔ v1.0+
  python3 - "$HEADS" <<'PY' 2>/dev/null || true
import json, sys
try:
    h = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    sys.exit(0)
for fam, v in (h.get('heads') or {}).items():
    ver = str(v.get('version', '')).lstrip('vV').lower()
    if ver.startswith('1.0') or (ver.split('.')[0] if ver.split('.')[0].isdigit() else '0') >= '1' and ver.split('.')[0] not in ('0',):
        print(fam)
PY
  # ۲) تگ‌های KH-*-v1.0*
  git tag -l 'KH-*-v1.0*' 2>/dev/null | sed 's/-v1\.0.*//' | sort -u || true
  # ۳) سلف‌تست — ادعای مصنوعی
  [ -n "${CLAIM_SIM_FAMILY:-}" ] && echo "$CLAIM_SIM_FAMILY"
  return 0
}

stamp_ok() { # $1 = family
  python3 - "$STAMPS" "$1" <<'PY' 2>/dev/null || return 1
import json, sys
try:
    t = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    sys.exit(1)
fam = sys.argv[2]
ok = any(s.get('family') == fam and s.get('verdict') == 'approve'
         for s in (t.get('stamps') or []))
sys.exit(0 if ok else 1)
PY
}

# ادعاهای متنی در یادداشت انتشار — عبارت صریح «پایه آماده»
notes_claim_files="$(grep -l 'پایه آماده' public/math-game/RELEASE-NOTES-*.md 2>/dev/null || true)"

fail=0
families="$(claimed_families | sort -u)"
if [ -n "$families" ]; then
  for fam in $families; do
    echo "— خانوادهٔ مُدّعی آمادگی: $fam"
    # a) گیت پوشش
    if bun scripts/coverage-report.ts --cartridge "public/math-game/cartridges/${fam}.json" --family "$fam" --gate > /dev/null 2>&1; then
      green "پوشش دامنه‌ای $fam کامل است"
    else
      red "$fam ادعای آمادگی دارد ولی گیت پوشش دامنه‌ای قرمز است (ماتریس ناکامل)"
      fail=1
    fi
    # b) مُهر معلم
    if stamp_ok "$fam"; then
      green "مُهر approve معلم برای $fam ثبت شده است"
    else
      red "$fam مُهر approve معلم ندارد — ادعای آمادگی بدون مُهر ممنوع (BP-012/GOVERNANCE)"
      fail=1
    fi
  done
fi

if [ -n "$notes_claim_files" ]; then
  red "عبارت «پایه آماده» در یادداشت انتشار یافت شد — بدون ماتریس مُهرشده مجاز نیست:"
  echo "$notes_claim_files" | sed 's/^/    /'
  fail=1
fi

if [ "$SELF_TEST" = "1" ]; then
  # سلف‌تست: ادعای کاذب مصنوعی (KH-G3-MATH) باید قرمز قطعی شود (exit 1)
  CLAIM_SIM_FAMILY="KH-G3-MATH" bash "$0" > /dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 1 ]; then
    green "سلف‌تست: ادعای کاذب → قرمز قطعی (exit 1) — گیت سالم است"
    exit 0
  fi
  red "سلف‌تست مردود — ادعای کاذب قرمز نشد (exit $rc)"
  exit 1
fi

if [ "$fail" -eq 0 ]; then
  green "هیچ ادعای آمادگیِ بی‌پشتوانه‌ای وجود ندارد (هدها: v0.x — تگ KH-v1.0: ندارد — یادداشت‌ها: پاک)"
fi
exit "$fail"
