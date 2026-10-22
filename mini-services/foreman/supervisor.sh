#!/usr/bin/env bash
# نگهبان کارگاه‌بان — سرپرست خودترمیم
# اگر پروسهٔ bun روی پورت 3030 مرده باشد، ظرف حداکثر ۲۰ ثانیه برمی‌گرداند.
# اجرا: setsid nohup ./supervisor.sh > /dev/null 2>&1 &
cd "$(dirname "$0")" || exit 1

while true; do
  if ! ss -tln 2>/dev/null | grep -q ':3030'; then
    echo "[$(date '+%m-%d %H:%M:%S')] 🚑 کارگاه‌بان مرده بود — بازراه‌اندازی" >> supervisor.log
    setsid nohup bun run start >> foreman-stdout.log 2>&1 < /dev/null &
  fi
  sleep 20
done
