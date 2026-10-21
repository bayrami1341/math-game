#!/usr/bin/env bash
# ذخیرهٔ خودکار دوره‌ای: هر N ثانیه وضعیت محلی را به شاخهٔ v10.3-beta مخزن خصوصی می‌فرستد
# مصرف:  nohup bash scripts/gh-autosave.sh 300 >/tmp/gh-autosave.log 2>&1 &
# پیش‌نیاز: یک‌بار اجرای موفق scripts/gh-connect.sh
set -u

INTERVAL="${1:-300}"   # پیش‌فرض: هر ۵ دقیقه
cd /home/z/my-project

echo "[$(date '+%H:%M:%S')] ذخیرهٔ خودکار فعال شد — هر ${INTERVAL} ثانیه"

while true; do
  sleep "$INTERVAL"
  # اگر محیط کامیت تازه‌ای نداشت، پوش no-op است و بی‌هزینه می‌گذرد
  if git push origin "HEAD:refs/heads/v10.3-beta" >/dev/null 2>&1; then
    if git diff --quiet "origin/v10.3-beta" 2>/dev/null; then
      echo "[$(date '+%H:%M:%S')] بدون تغییر جدید"
    else
      echo "[$(date '+%H:%M:%S')] ✔ وضعیت تازه به گیت‌هاب رسید"
    fi
  else
    echo "[$(date '+%H:%M:%S')] ⚠ پوش ناموفق (ریموت وصل نیست یا توکن منقضی شده)"
  fi
done
