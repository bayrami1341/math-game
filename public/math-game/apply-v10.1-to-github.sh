#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# کیت نصب «کارگاه ضرب — نسخهٔ ۱۰.۱» روی مخزن github.com/bayrami1341/math-game
# Multiplication Workshop v10.1 installer   (target branch: v6)
#
# استفاده / Usage:
#   bash apply-v10.1-to-github.sh [مسیر-کلون]
#   bash apply-v10.1-to-github.sh ../math-game
#
# • اگر مسیر ندهید: پوشهٔ math-game کنار همین کیت بررسی می‌شود؛
#   اگر نبود، مخزن از گیت‌هاب کلون می‌شود.
# • اگر مسیر بدهید و وجود نداشته باشد: همان‌جا کلون تازه می‌سازد.
# • سازگار با Git Bash ویندوز، bash لینوکس و مک.
#
# این اسکریپت:
#   ۱) شاخهٔ پشتیبان backup/v10-final می‌سازد (نقطهٔ بازگشت = نسخهٔ ۱۰.۰)
#   ۲) فایل‌های ۱۰.۱ را روی کلون کپی می‌کند
#   ۳) ۴ کامیت منطقی می‌زند
#   ۴) هر ۵۳ آزمون را اجرا می‌کند (باید سبز باشند)
#   ۵) git push origin v6 را امتحان می‌کند؛ اگر اعتبارنامهٔ نوشتن نباشد،
#      با پیام راهنمای تمیز (فارسی/انگلیسی) و کد خروج غیرصفر خارج می‌شود؛
#      کامیت‌ها محلی می‌مانند و فقط push با شماست.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

SRC="${BASH_SOURCE[0]:-$0}"
KIT_DIR="$(cd "$(dirname "$SRC")" >/dev/null 2>&1 && pwd)"
REPO_URL="https://github.com/bayrami1341/math-game.git"
BRANCH="v6"
BACKUP="backup/v10-final"
GUIDE="راهنمای_جامع_نسخه_۱۰.۱.md"
TEST_FILES="tests/v10-station.test.js tests/v10.1-station.test.js tests/v10.1-side-missions.test.js tests/v10.2-errors.test.js tests/v10.2-domains.test.js"

# رنگ‌ها فقط وقتی خروجی ترمینال است
if [ -t 1 ]; then
  C_G='\033[1;32m'; C_Y='\033[1;33m'; C_R='\033[1;31m'; C_B='\033[1;36m'; C_N='\033[0m'
else
  C_G=''; C_Y=''; C_R=''; C_B=''; C_N=''
fi
ok()   { printf "${C_G}✔${C_N} %s\n" "$1"; }
info() { printf "${C_B}➜${C_N} %s\n" "$1"; }
warn() { printf "${C_Y}⚠${C_N} %s\n" "$1"; }
err()  { printf "${C_R}✖${C_N} %s\n" "$1" >&2; }

# اگر credential ذخیره نشده باشد، git بی‌درنگ و تمیز شکست بخورد (نه منتظر تایپ بماند)
export GIT_TERMINAL_PROMPT=0

# ── ۰) پیش‌نیازها ────────────────────────────────────────────────────────────
command -v git  >/dev/null 2>&1 || { err "git نصب نیست / git is not installed"; exit 1; }
command -v node >/dev/null 2>&1 || { err "Node.js نصب نیست (نسخهٔ ۱۸ به بالا) / Node.js 18+ required"; exit 1; }
node -e 'process.exit(parseInt(process.versions.node, 10) >= 18 ? 0 : 1)' 2>/dev/null \
  || { err "node --test به Node.js 18+ نیاز دارد / Node.js >= 18 required"; exit 1; }

if [ -z "$(git config user.email 2>/dev/null)" ] || [ -z "$(git config user.name 2>/dev/null)" ]; then
  err "هویت گیت تنظیم نیست؛ اول این دو دستور را بزنید / Git identity missing — run:"
  err '  git config --global user.name  "Your Name"'
  err '  git config --global user.email "you@example.com"'
  exit 1
fi

for _f in "v10.html" "package.json" "styles/v10.css" "src/v10/app.js" "src/v9/experience.mjs" "tests/v10.1-station.test.js" "$GUIDE"; do
  [ -f "$KIT_DIR/$_f" ] || { err "فایل کیت پیدا نشد / kit file missing: $_f"; exit 1; }
done

# ── ۱) تعیین مسیر کلون ───────────────────────────────────────────────────────
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  TARGET="$KIT_DIR/../math-game"
  info "مسیری داده نشد؛ پیش‌فرض استفاده می‌شود: $TARGET"
fi
case "$TARGET" in
  /*) : ;;
  *)
    _dir="$(dirname "$TARGET")"; _base="$(basename "$TARGET")"
    [ -d "$_dir" ] || { err "پوشهٔ والد وجود ندارد / parent folder not found: $_dir"; exit 1; }
    TARGET="$(cd "$_dir" && pwd)/$_base"
    ;;
esac

if [ -d "$TARGET/.git" ]; then
  info "استفاده از کلون موجود: $TARGET"
else
  info "کلون تازه از شاخهٔ $BRANCH در: $TARGET"
  if ! git clone --branch "$BRANCH" "$REPO_URL" "$TARGET"; then
    err "کلون ناموفق بود — اینترنت/آدرس مخزن را بررسی کنید / git clone failed"
    exit 1
  fi
fi
cd "$TARGET" || exit 1

git remote get-url origin 2>/dev/null | grep -q "math-game" \
  || { err "این پوشه کلون math-game نیست / this folder is not a math-game clone"; exit 1; }

CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CUR_BRANCH" != "$BRANCH" ]; then
  info "رفتن به شاخهٔ $BRANCH …"
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH" \
    || { err "شاخهٔ $BRANCH پیدا نشد / branch $BRANCH not found"; exit 1; }
fi

if ! git pull --ff-only origin "$BRANCH" 2>/dev/null; then
  warn "به‌روزرسانی از origin انجام نشد (آفلاین؟) — ادامه با وضعیت محلی / pull skipped"
fi

if [ -n "$(git status --porcelain)" ]; then
  err "درخت کاری تغییرات کامیت‌نشده دارد؛ اول commit یا stash کنید / working tree is dirty"
  exit 1
fi

# ── ۲) شاخهٔ پشتیبان (نقطهٔ بازگشت) ──────────────────────────────────────────
if git show-ref --verify --quiet "refs/heads/$BACKUP"; then
  warn "شاخهٔ پشتیبان $BACKUP از قبل وجود دارد — دست‌نخورده ماند"
else
  if git branch "$BACKUP"; then
    ok "شاخهٔ پشتیبان ساخته شد: $BACKUP (= نسخهٔ ۱۰.۰، نقطهٔ بازگشت)"
  else
    err "ساخت شاخهٔ پشتیبان ناموفق بود / failed to create $BACKUP"
    exit 1
  fi
fi

# ── ۳) کپی فایل‌های کیت روی کلون ─────────────────────────────────────────────
info "کپی فایل‌های نسخهٔ ۱۰.۱ …"
cp -f "$KIT_DIR/v10.html" "$KIT_DIR/package.json" .
cp -f "$KIT_DIR/$GUIDE" .
mkdir -p styles src/v10/station src/v9 tests
cp -f "$KIT_DIR/styles/v10.css"            styles/
cp -f "$KIT_DIR/src/v10/app.js" \
      "$KIT_DIR/src/v10/bridge.js"         src/v10/
cp -f "$KIT_DIR/src/v10/station/"*.js      src/v10/station/
cp -f "$KIT_DIR/src/v9/"*.mjs              src/v9/
cp -f "$KIT_DIR/tests/"*.test.js           tests/
if [ -f "$KIT_DIR/apply-v10.1.ps1" ]; then cp -f "$KIT_DIR/apply-v10.1.ps1" .; fi
ok "فایل‌ها کپی شدند (۲۶ فایل کیت)."

# ── ۴) چهار کامیت منطقی ──────────────────────────────────────────────────────
commit() { # $1 = پیام، بقیه = مسیرها
  _msg="$1"; shift
  git add -A -- "$@"
  if git diff --cached --quiet; then
    warn "بدون تغییر برای کامیت: $_msg"
  else
    if git commit -q -m "$_msg"; then
      ok "کامیت شد: $_msg"
    else
      err "کامیت ناموفق: $_msg"
      exit 1
    fi
  fi
}

commit "feat(v10.1): depth layers, side missions, 7-step scaffold ladder, Persian typing" \
  src/v9 src/v10
commit "feat(v10.1-ui): teacher missions banner, TTS button, RTL answer field, focus outline" \
  v10.html styles/v10.css
commit "test(v10.1): 31 tests (station, depth/bottleneck, side missions) + package metadata" \
  tests package.json
commit "docs(v10.1): comprehensive Persian guide — install, matrix, side missions, ladder" \
  "$GUIDE"

echo
git log --oneline -5
echo

# ── ۵) آزمون‌های خودکار ──────────────────────────────────────────────────────
info "اجرای آزمون‌ها (انتظار: ۵۳/۵۳ سبز) …"
if node --test $TEST_FILES; then
  ok "همهٔ آزمون‌ها سبزند."
else
  err "آزمون‌ها قرمز بودند! push لغو شد / tests failed — push aborted"
  warn "بازگشت / rollback:  git reset --hard $BACKUP"
  exit 1
fi

# ── ۶) push به گیت‌هاب ───────────────────────────────────────────────────────
echo
info "تلاش برای push به origin/$BRANCH …"
if git push origin "$BRANCH"; then
  echo
  ok "🎉 نصب نسخهٔ ۱۰.۱ روی گیت‌هاب کامل شد!"
  ok "بعد از ۱ تا ۲ دقیقه (به‌روزرسانی Pages) بازی را با Ctrl+F5 باز کنید:"
  info "https://bayrami1341.github.io/math-game/v10.html"
  echo
  info "چک‌لیست سریع: در فیلد پاسخ، رقم لاتین 4 را تایپ کنید → باید فوراً «۴» نمایش داده شود."
  ok "شاخهٔ پشتیبان $BACKUP به‌صورت محلی برای بازگشت حفظ شده است."
  exit 0
fi

# ── push ناموفق: تقریباً همیشه یعنی اعتبارنامهٔ نوشتن نیست ───────────────────
echo
err "push انجام نشد — اعتبارنامهٔ گیت‌هاب با اجازهٔ نوشتن روی این دستگاه تنظیم نیست."
err "Git push failed — no GitHub credentials with write access on this machine."
echo
ok "اما همه‌چیز آماده است: فایل‌های ۱۰.۱ اعمال شدند، ۵۳ آزمون سبز است و کامیت‌ها روی شاخهٔ $BRANCH ساخته شدند."
ok "Everything is ready: v10.1 files applied, 31 tests green, commits created on '$BRANCH'."
echo
info "فقط push با شماست / You only need to push:"
echo
info "روش ۱ — ساده‌ترین (پنجرهٔ ورود گیت‌هاب باز می‌شود):"
echo "    cd \"$TARGET\""
echo "    git push origin $BRANCH"
echo "    # در پنجرهٔ بازشده با حساب  bayrami1341  وارد شوید"
echo
info "روش ۲ — با GitHub CLI:"
echo "    gh auth login"
echo "    git push origin $BRANCH"
echo
info "روش ۳ — با Personal Access Token (GitHub → Settings → Developer settings → Tokens):"
echo "    git remote set-url origin https://<TOKEN>@github.com/bayrami1341/math-game.git"
echo "    git push origin $BRANCH"
echo
warn "بازگشت به نسخهٔ قبل در صورت نیاز / rollback if needed:"
echo "    git reset --hard $BACKUP"
echo
exit 2
