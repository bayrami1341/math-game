#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# موتور زنجیرهٔ اجرا — scripts/run-approved.sh (BP-011 / رشتهٔ B2 — NIGHTSHIFT N2)
#
# پیمایش نقشه‌های تحویل‌شده به ترتیب اولویت با گیت fail-closed بین گام‌ها:
#   list → order → (بدنهٔ هر نقشه دستِ ربات/عامل اجرا شده است) → gate →
#   set-status verified → commit/push → بعدی
#
# حالت‌ها:
#   run-approved.sh dry-run     — نمایش ترتیب اجرا بدون هیچ تغییری (T2)
#   run-approved.sh run         — زنجیرهٔ واقعی: گیت + گذار وضعیت + پوش (T1)
#   run-approved.sh self-test   — شبیه‌سازی گیت قرمز → توقف ایمن بدون هیچ تغییر (T3)
#
# گاهِ بین‌گام = scripts/release-check.sh (۶ گام: نسخه‌ها، G0/G0B، هدها، pytest،
# npm test موتور، مبدل رسمی G2/G3) + validate رجیستری — همان ماشین BP-010.
#
# قرارداد کدهای خروج:
#   ۰ = زنجیره کامل/تمیز    ۱ = گیت قرمز → block + توقف    ۲ = بدنهٔ نقشه اجرا نشده
#   ۳ = درخت کثیف / همگام‌سازی ناقص با origin
#
# قاعدهٔ ردِ خودکار (skip): پیش‌شرط‌های انسانی/رشته‌ای غایب → گذر مستند، نه block.
#   BP-012 فقط با: مُهر واقعی معلم در authoring/teacher-stamps.json + وارسی‌شدن BP-007 و BP-011
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-run}"
shift 2>/dev/null || true
ONLY_BP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --bp) ONLY_BP="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done
SIMULATE="${SIMULATE_RED_GATE:-0}"   # فقط self-test — شبیه‌سازی قرمزی گیت
LOG_TAG="run-approved"

fail() { echo "⛔ $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || fail "ابزار $1 یافت نشد"; }
need bun; need python3; need git; need curl

# ── صف: (id, status, priority) مرتب بر اولویت صعودی ──────────────────────────
read_queue() {
  python3 - <<'PY'
import json
r = json.load(open('blueprints/registry.json', encoding='utf-8'))
for b in sorted(r['blueprints'], key=lambda x: (x.get('priority') or 999)):
    print(b['id'], b['status'], b.get('priority') or 999)
PY
}

# ── قاعدهٔ رد خودکار — بازگشت ۰ با دلیل = رد؛ بازگشت ۱ = در صف بماند ─────────
skip_reason() {
  local bp="$1"
  if [ "$bp" = "BP-012" ]; then
    local stamps strand_ok
    stamps="$(python3 -c "
import json,sys
try:
    d = json.load(open('authoring/teacher-stamps.json', encoding='utf-8'))
    print(len(d.get('stamps', [])))
except Exception:
    print(0)
" 2>/dev/null || echo 0)"
    if [ "${stamps:-0}" -lt 1 ]; then
      echo "مُهر واقعی معلم غایب در authoring/teacher-stamps.json (۰ مُهر) — انتشار پایدار فقط با مُهر انسانی (BP-012)"
      return 0
    fi
    strand_ok="$(bun scripts/blueprint.ts show BP-007 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo none)"
    if [ "$strand_ok" != "verified" ] && [ "$strand_ok" != "done" ]; then
      echo "پیش‌شرط رشته‌ای: BP-007 وارسی‌شده نیست (وضعیت: $strand_ok)"
      return 0
    fi
  fi
  return 1
}

# ── گاهِ بین‌گام (fail-closed) ────────────────────────────────────────────────
gate() {
  echo "▶ گاه: validate رجیستری + release-check (۶ گام)"
  [ "$SIMULATE" = "1" ] && { echo "  (SIMULATE_RED_GATE=1 — گیت مصنوعاً قرمز)"; return 1; }
  bun scripts/blueprint.ts validate >/dev/null 2>&1 || { echo "  ✗ رجیستری نامعتبر"; return 1; }
  bash scripts/release-check.sh >/tmp/${LOG_TAG}-gate.log 2>&1 || {
    echo "  ✗ release-check قرمز — گزارش: /tmp/${LOG_TAG}-gate.log"; return 1; }
  echo "  🟢 گیت سبز ($(grep -o 'RELEASE-CHECK PASS' /tmp/${LOG_TAG}-gate.log | head -1))"
  return 0
}

# ── رکورد block — در شبیه‌سازی فقط چاپ، در واقعیت گذار + worklog + پوش ───────
block_record() {
  local bp="$1" reason="$2"
  echo "⛔ BLOCK $bp — $reason"
  if [ "$SIMULATE" = "1" ]; then
    echo "   (شبیه‌سازی T3 — هیچ تغییری اعمال نشد؛ مسیر واقعی: set-status block + worklog + پوش)"
    return 0
  fi
  bun scripts/blueprint.ts set-status "$bp" block --note "$reason" >/dev/null 2>&1 || true
  {
    echo ""
    echo "---"
    echo "Task ID: $bp (block by $LOG_TAG)"
    echo "Agent: Z.ai Code (main)"
    echo "Task: رکورد block خودکار — گیت قرمز در زنجیرهٔ اجرا"
    echo ""
    echo "Work Log:"
    echo "- گیت قرمز: $reason"
    echo "- زنجیره در همین نقطه متوقف شد (fail-closed) — نقشه‌های بعدی اجرا نشدند"
    echo ""
    echo "Stage Summary:"
    echo "- $bp → block؛ عیب‌یابی و اجرای مجدد زنجیره پس از رفع، با تأیید مالک"
  } >> worklog.md
  git add blueprints/registry.json worklog.md 2>/dev/null || true
  git commit -q -m "bp-$bp: block — گیت قرمز در زنجیرهٔ اجرا ($reason)" 2>/dev/null || true
  git push origin main -q 2>/dev/null || true
}

# ── راستی‌آزمایی CI روی هد جاری main (پیش از گذار verified) ──────────────────
ci_green_on_head() {
  local sha tries
  sha="$(git rev-parse HEAD)"
  local token
  token="$(git remote get-url origin | sed -E 's#https://([^@]+)@github.com.*#\1#' | sed -E 's#.*:##')"
  [ -n "$token" ] && [ "$token" != "$(git remote get-url origin)" ] || { echo "  ⚠ توکن CI استخراج نشد — CI ناپدید"; return 1; }
  for tries in 1 2 3 4 5 6 7 8 9 10 11 12; do
    local res
    res="$(curl -s -H "Authorization: token $token" \
      "https://api.github.com/repos/bayrami1341/math-game/actions/runs?branch=main&per_page=5" \
      | python3 -c "
import json,sys
try:
    runs = json.load(sys.stdin).get('workflow_runs', [])
    for r in runs:
        if r['head_sha'].startswith('$sha'):
            print(r['status'], r['conclusion'] or '-')
            break
    else:
        print('none', '-')
except Exception:
    print('none', '-')
" 2>/dev/null || echo 'none -')"
    case "$res" in
      "completed success") echo "  🟢 CI سبز روی $sha"; return 0 ;;
      "completed -") ;;
      completed*) echo "  ✗ CI قرمز روی $sha ($res)"; return 1 ;;
      *) : ;; # in_progress/queued/none — صبر
    esac
    sleep 30
  done
  echo "  ⚠ CI پس از ۶ دقیقه به نتیجه نرسید ($sha)"
  return 1
}

sync_clean() {
  git diff --quiet || { echo "⛔ درخت کثیف است — نخست کار را کامیت کنید"; return 1; }
  git fetch origin -q
  local behind
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  [ "$behind" = "0" ] || { echo "⛔ main محلی $behind کامیت عقب‌تر از origin است — همگام‌سازی دستی"; return 1; }
  return 0
}

# ── حالت dry-run (T2) — بدون هیچ نوشتنی ──────────────────────────────────────
if [ "$MODE" = "dry-run" ]; then
  echo "═══ DRY-RUN زنجیرهٔ اجرا (هیچ تغییری اعمال نمی‌شود) ═══"
  read_queue | while read -r id status prio; do
    case "$status" in
      verified|done)          printf "  ✅ %s (p%s) — %s [بسته]\n" "$id" "$prio" "$status" ;;
      delivered)              printf "  🔁 %s (p%s) — %s → گیت+CI+وارسی\n" "$id" "$prio" "$status" ;;
      executing|approved)     printf "  🔜 %s (p%s) — %s → بدنه با دستِ ربات\n" "$id" "$prio" "$status" ;;
      block)                  printf "  ⛔ %s (p%s) — %s [مسدود]\n" "$id" "$prio" "$status" ;;
      *)                      printf "  ·    %s (p%s) — %s [خارج از صف]\n" "$id" "$prio" "$status" ;;
    esac
  done
  echo "───"
  echo "قاعدهٔ رد: BP-012 بدون مُهر معلم → skip مستند (نه block)"
  echo "قرارداد خروج: ۰ تمیز | ۱ گیت قرمز | ۲ بدنه لازم | ۳ درخت کثیف"
  exit 0
fi

# ── حالت self-test (T3) — شبیه‌سازی قرمزی بدون هیچ تغییر ─────────────────────
if [ "$MODE" = "self-test" ]; then
  echo "═══ SELF-TEST زنجیره — سه گزاره ═══"
  reg_before="$(sha256sum blueprints/registry.json | cut -d' ' -f1)"
  head_before="$(git rev-parse HEAD)"

  # گزارهٔ ۱: dry-run تمیز
  bash "$0" dry-run >/tmp/${LOG_TAG}-selftest-dry.log 2>&1 || fail "گزارهٔ ۱ شکست: dry-run غیرصفر"
  grep -q "DRY-RUN" /tmp/${LOG_TAG}-selftest-dry.log || fail "گزارهٔ ۱ شکست: خروجی dry-run نامعتبر"
  echo "  ✅ گزارهٔ ۱: dry-run ترتیب را نشان می‌دهد (exit 0، بدون نوشتن)"

  # گزارهٔ ۲: قرمزی گیت مصنوعی → توقف با کد ۱ + پیام BLOCK (روی اولین نقشهٔ تحویل‌شده: BP-007)
  SIMULATE_RED_GATE=1 bash "$0" run --bp BP-007 >/tmp/${LOG_TAG}-selftest-red.log 2>&1
  rc=$?
  [ "$rc" = "1" ] || fail "گزارهٔ ۲ شکست: کد خروج $rc (انتظار ۱)"
  grep -q "BLOCK" /tmp/${LOG_TAG}-selftest-red.log || fail "گزارهٔ ۲ شکست: پیام BLOCK غایب"
  echo "  ✅ گزارهٔ ۲: گیت قرمز شبیه‌سازی‌شده → توقف زنجیره با کد ۱ و پیام BLOCK"

  # گزارهٔ ۳: صفر جهش وضعیت — رجیستری و هد دست‌نخورده
  reg_after="$(sha256sum blueprints/registry.json | cut -d' ' -f1)"
  head_after="$(git rev-parse HEAD)"
  [ "$reg_before" = "$reg_after" ] || fail "گزارهٔ ۳ شکست: رجیستری جهش کرد!"
  [ "$head_before" = "$head_after" ] || fail "گزارهٔ ۳ شکست: کامیت تازه ساخته شد!"
  echo "  ✅ گزارهٔ ۳: صفر جهش — رجیستری و هد دست‌نخورده"

  echo "═══ SELF-TEST PASS — توقف ایمن + رکورد block (مسیر واقعی: set-status block + worklog + پوش) ═══"
  exit 0
fi

# ── حالت run (T1) — زنجیرهٔ واقعی ─────────────────────────────────────────────
[ "$MODE" = "run" ] || fail "حالت نامعلوم: $MODE (run | dry-run | self-test)"

sync_clean || exit 3

processed=0
while read -r id status prio; do
  case "$status" in
    verified|done|block|awaiting_approval|draft) continue ;;
  esac
  if [ -n "$ONLY_BP" ] && [ "$id" != "$ONLY_BP" ]; then continue; fi

  if skip_reason "$id"; then
    reason="$(skip_reason "$id" 2>/dev/null; true)"
    echo "⏭  SKIP $id — ${reason#؛}"
    continue
  fi

  echo "═══ گام $id (p$prio، وضعیت: $status) ═══"
  case "$status" in
    delivered)
      gate || { block_record "$id" "گیت بین‌گام قرمز پیش از وارسی"; exit 1; }
      ci_green_on_head || { block_record "$id" "CI روی هد جاری سبز نشد"; exit 1; }
      bun scripts/blueprint.ts set-status "$id" verified --note "وارسی خودکار زنجیرهٔ run-approved (گیت + CI سبز)" >/dev/null
      git add blueprints/registry.json
      git commit -q -m "bp-$id: verified توسط زنجیرهٔ run-approved (گیت + CI سبز)"
      git push origin main -q || { block_record "$id" "پوش پس از وارسی شکست خورد"; exit 1; }
      echo "  🏁 $id → verified (پوش شد)"
      processed=$((processed+1))
      ;;
    executing|approved)
      echo "  ✋ بدنهٔ $id هنوز اجرا نشده — زنجیره برای اجرای دستی ربات می‌ایستد (کد ۲)"
      echo "     پس از اجرای بدنه و پوش، دوباره: bash scripts/run-approved.sh run"
      exit 2
      ;;
  esac
done < <(read_queue)

echo "═══ زنجیره تمام شد — $processed نقشه وارسی شد، صف پاک است ═══"
exit 0
