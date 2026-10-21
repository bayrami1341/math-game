#!/usr/bin/env bash
# اتصال امن پروژه به مخزن خصوصی گیت‌هاب کاربر
# مصرف:  bash scripts/gh-connect.sh ghp_xxxxxxxxxxxx
# ایمن:  تاریخچهٔ موجود مخزن را دست نمی‌زند؛ وضعیت v10.3 را به شاخهٔ تازهٔ v10.3-beta می‌فرستد
set -euo pipefail

TOKEN="${1:-${GITHUB_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "خطا: توکن را بدهید → bash scripts/gh-connect.sh ghp_..." >&2
  exit 1
fi

REPO="bayrami1341/math-game"
cd /home/z/my-project

# اتصال ریموت (توکن فقط در .git/config همین محیط می‌ماند)
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:${TOKEN}@github.com/${REPO}.git"

echo "⇣ دریافت تاریخچهٔ موجود مخزن (برای اطمینان، هیچ‌چیز تغییر نمی‌کند)…"
git fetch origin --tags || echo "⚠ فچ ناموفق بود؛ ادامه می‌دهیم"

echo "⇡ پوش وضعیت فعلی v10.3 به شاخهٔ تازهٔ v10.3-beta (بدون دست‌زدن به main و v6 مخزن)…"
git push -u origin "HEAD:refs/heads/v10.3-beta"

echo "⇡ پوش تگ ریلیز v10.3.0-beta.0…"
git push origin "refs/tags/v10.3.0-beta.0" || echo "⚠ تگ از قبل در مخزن بود یا رد شد؛ بعداً رسیدگی می‌شود"

echo
echo "✔ اتصال برقرار شد. بررسی: https://github.com/${REPO}/tree/v10.3-beta"
