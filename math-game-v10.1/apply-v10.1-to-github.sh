#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# اعمال گام‌به‌گام «کارگاه ضرب — نسخهٔ ۱۰.۱» روی مخزن github.com/bayrami1341/math-game
# (الگوی مشابه apply-v10-to-github.sh نسخهٔ قبل)
#
# استفاده:
#   bash apply-v10.1-to-github.sh [مسیر-کلون-ریپو]
#   مثال:   bash apply-v10.1-to-github.sh ../math-game
# اگر مسیر ندهید، فرض می‌شود کلون ریپو کنار همین پوشه است؛ اگر نبود، خودش کلون می‌کند.
#
# پیش‌نیاز: git و node نصب باشند؛ برای push باید اجازهٔ نوشتن داشته باشید
#   (git config --global credential.helper store  یا  gh auth login)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="${1:-$SCRIPT_DIR/../math-game}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo ">> کلون ریپو در $REPO_DIR"
  git clone --branch v6 https://github.com/bayrami1341/math-game "$REPO_DIR"
fi

cd "$REPO_DIR"
git checkout v6 2>/dev/null || git checkout -b v6 origin/v6
git pull --ff-only origin v6

# نسخهٔ پشتیبان از وضعیت فعلی v10 (برای بازگشت آسان)
git branch backup/v10-final 2>/dev/null || true

echo ">> ۱/۴ هستهٔ پداگوژیک (experience.mjs + local.mjs)"
cp "$SCRIPT_DIR/src/v9/experience.mjs" src/v9/experience.mjs
cp "$SCRIPT_DIR/src/v9/local.mjs"      src/v9/local.mjs
git add src/v9/experience.mjs src/v9/local.mjs
git commit -m "feat(v10.1-core): depth layers + bottleneck taxonomy, pure station algorithms, side mission questions, IndexedDB memory fallback"

echo ">> ۲/۴ لایهٔ ایستگاه و کنترلر"
cp "$SCRIPT_DIR/src/v10/app.js"        src/v10/app.js
cp "$SCRIPT_DIR/src/v10/bridge.js"     src/v10/bridge.js
cp "$SCRIPT_DIR/src/v10/station/"*.js  src/v10/station/
cp "$SCRIPT_DIR/styles/v10.css"        styles/v10.css
cp "$SCRIPT_DIR/v10.html"              v10.html
git add src/v10 styles/v10.css v10.html
git commit -m "feat(v10.1-station): 7-step scaffold ladder (anti-leak), side missions UI, teacher missions banner, live Persian digits"

echo ">> ۳/۴ آزمون‌ها و شناسهٔ بسته"
cp "$SCRIPT_DIR/tests/"*.test.js tests/
cp "$SCRIPT_DIR/package.json" package.json
git add tests package.json
git commit -m "test(v10.1): 31 tests (station, depth/bottleneck, side missions) + package 10.1.0"

echo ">> ۴/۴ مستندات"
cp "$SCRIPT_DIR/راهنمای_جامع_نسخه_۱۰.۱.md" .
git add "راهنمای_جامع_نسخه_۱۰.۱.md"
git commit -m "docs(v10.1): comprehensive guide — 9-layer matrix, side missions, scaffold ladder"

echo ">> اجرای آزمون‌ها (انتظار: ۳۱/۳۱)"
node --test tests/v10-station.test.js tests/v10.1-station.test.js tests/v10.1-side-missions.test.js

echo ">> push (نسخهٔ ۱۰.۱ روی شاخهٔ v6 + شاخهٔ پشتیبان)"
if git push origin v6 backup/v10-final; then
  echo "[OK] نصب کامل شد — بازی: https://bayrami1341.github.io/math-game/v10.html"
else
  echo "[توجه] کامیت‌ها محلی ساخته شدند ولی push نشد — دستی اجرا کنید:"
  echo "       cd $REPO_DIR && git push origin v6 backup/v10-final"
fi
