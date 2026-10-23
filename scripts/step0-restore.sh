#!/usr/bin/env bash
# step0-restore.sh — گام ۰ از نقشهٔ تکمیل خشاب‌ها: بازیابی بستر + موجودی واقعی + گزارش پوشش
# استفاده:  bash scripts/step0-restore.sh <TOKEN>
# امنیت:    توکن فقط برای کلون استفاده می‌شود؛ در هیچ فایلِ گزارش/worklog نوشته نمی‌شود.
set -euo pipefail

TOKEN="${1:-${GITHUB_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "خطا: توکن داده نشد. استفاده: bash scripts/step0-restore.sh <TOKEN>" >&2
  exit 2
fi

REPO_URL="https://${TOKEN}@github.com/bayrami1341/math-game"
DEST="/home/z/math-game-repo"
REPORT_DIR="/home/z/my-project/reports"
mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/coverage-step0.md"

# کلون تازه (توضیح: توکن در .git/config کلونِ محلی sandbox می‌ماند — هرگز به my-project کپی نمی‌شود)
rm -rf "$DEST"
if ! git clone --quiet "$REPO_URL" "$DEST" 2>/dev/null; then
  echo "خطا: کلون ناموفق — توکن/نام مخزن را بررسی کنید" >&2
  exit 3
fi
echo "OK: کلون شد -> $DEST"

{
  echo "# گزارش گام ۰ — بازیابی بستر و موجودی واقعی خشاب‌ها"
  echo "- تاریخ: $(date -Iseconds)"
  echo "- منبع: bayrami1341/math-game (main)"
  echo
  echo "## ۱. شاخه‌ها و تگ‌ها"
  git -C "$DEST" branch -a
  echo
  git -C "$DEST" tag -l || true
  echo
  echo "## ۲. آخرین ۱۰ کامیت main"
  git -C "$DEST" log --oneline -10
  echo
  echo "## ۳. رجیستری بلوپرینت"
  if [ -f "$DEST/blueprints/registry.json" ]; then
    node -e "
const r=require('$DEST/blueprints/registry.json');
console.log('نسخه:', r.version, '| تعداد نقشه:', r.blueprints.length);
r.blueprints.forEach(b=>console.log('-', b.id, '|', b.status, '|', (b.title||'').slice(0,60)));
"
  else
    echo "registry.json یافت نشد — در گام ۱ از رکوردها بازسازی می‌شود"
  fi
  echo
  echo "## ۴. کارتریج‌ها (موجودی واقعی)"
  if [ -d "$DEST/cartridges" ]; then
    ls -la "$DEST/cartridges"
    echo
    for f in "$DEST"/cartridges/*.json; do
      [ -e "$f" ] || continue
      echo "### $(basename "$f")"
      node -e "
const c=require('$f');
console.log('کلیدهای سطح بالا:', Object.keys(c).join(', '));
const items=c.items||c.questions||c.data||c.rows;
if(Array.isArray(items)){
  console.log('تعداد آیتم:', items.length);
  console.log('کلیدهای آیتم نمونه:', Object.keys(items[0]||{}).join(', '));
  const domKey=['domain','sector','chapter','topic'].find(k=>items[0]&&k in items[0]);
  if(domKey){
    const m={};
    items.forEach(it=>{const k=String(it[domKey]); m[k]=(m[k]||0)+1;});
    console.log('توزیع بر اساس «'+domKey+'»:', JSON.stringify(m));
  } else {
    console.log('فیلد دامنه/فصل در آیتم‌ها یافت نشد → شکاف schema تأیید شد (BP-015 لازم است)');
  }
} else {
  console.log('ساختار آیتمی استاندارد یافت نشد — بازرسی دستی لازم');
}
" 2>&1
      echo
    done
  else
    echo "پوشهٔ cartridges یافت نشد — بررسی درخت مخزن لازم است"
  fi
  echo "## ۵. authoring و scripts"
  ls "$DEST/authoring" 2>/dev/null || echo "authoring/ یافت نشد"
  echo
  ls "$DEST/scripts" 2>/dev/null | head -30
} | tee "$REPORT"

echo
echo "OK: گزارش ذخیره شد -> $REPORT"
echo "NOTE: توکن در هیچ فایلی نوشته نشد."
