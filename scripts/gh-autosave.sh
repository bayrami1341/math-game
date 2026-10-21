#!/usr/bin/env bash
# ذخیرهٔ خودکار دوره‌ای: هر N ثانیه وضعیت محلی را به شاخهٔ v10.3-beta مخزن خصوصی می‌فرستد
# مصرف:  nohup bash scripts/gh-autosave.sh 300 >/tmp/gh-autosave.log 2>&1 &
# پیش‌نیاز: یک‌بار اجرای موفق scripts/gh-connect.sh
set -u

INTERVAL="${1:-300}"   # پیش‌فرض: هر ۵ دقیقه
cd /home/z/my-project

echo "[$(date '+%H:%M:%S')] ذخیرهٔ خودکار فعال شد — هر ${INTERVAL} ثانیه"

# تابع پوش مشترک
do_push() {
  if git push origin "HEAD:refs/heads/v10.3-beta" >/dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] ✔ وضعیت تازه به گیت‌هاب رسید"
  else
    echo "[$(date '+%H:%M:%S')] ⚠ پوش ناموفق (ریموت وصل نیست یا توکن منقضی شده)"
  fi
}

# اولین پوش فوری — حتی اگر فرایند کوتاه عمر کند، یک ذخیرهٔ تازه می‌رود
do_push

while true; do
  sleep "$INTERVAL"
  do_push
done
