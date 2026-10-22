#!/usr/bin/env bash
# پشتیبان‌گیری خودکار کارگاه ضرب — هر ۱۵ دقیقه
# ۱) اگر تغییری در فایل‌ها باشد، کامیت محلی می‌کند
# ۲) اگر ریموت origin تنظیم شده باشد، به گیت‌هاب (ریپوی خصوصی) پوش می‌کند
cd /home/z/my-project || exit 1
export GIT_AUTHOR_NAME="Auto Backup" GIT_AUTHOR_EMAIL="backup@karbar-zarb.local"
export GIT_COMMITTER_NAME="Auto Backup" GIT_COMMITTER_EMAIL="backup@karbar-zarb.local"
INTERVAL=${BACKUP_INTERVAL:-900}

while true; do
  sleep "$INTERVAL"
  # فایل‌های تغییرکرده را بیاب (بدون پوشه‌های سنگین)
  if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git status --porcelain -uno 2>/dev/null)" ]; then
    git add -A >/dev/null 2>&1
    # گارد حق‌نشر (fail-closed — Task 60-Pre): اگر فایل ممنوعه استیج شده باشد، کامیت متوقف می‌شود
    if git diff --cached --name-only 2>/dev/null | grep -qE '\.pdf$|^upload/|^tool-results/|\.zscripts/dev\.pid'; then
      echo "[$(date '+%H:%M')] 🚫 گارد حق‌نشر: فایل ممنوعه در استیج — کامیت متوقف شد"
      git reset >/dev/null 2>&1
      continue
    fi
    if ! git diff --cached --quiet 2>/dev/null; then
      git commit -m "auto-backup $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1
      echo "[$(date '+%H:%M')] کامیت محلی انجام شد"
    fi
  fi
  # پوش به گیت‌هاب فقط اگر ریموت تنظیم شده باشد
  if git remote get-url origin >/dev/null 2>&1; then
    if git push origin main >/dev/null 2>&1; then
      echo "[$(date '+%H:%M')] پوش به گیت‌هاب موفق"
    else
      echo "[$(date '+%H:%M')] پوش ناموفق (توکن/شبکه؟) — کامیت محلی محفوظ است"
    fi
  fi
done
