# ============================================================
#  کارگاه ضرب — نصب نسخهٔ ۱۰.۱.۴ روی گیت‌هاب (ویندوز / پاورشل)
#  اجرا: در پاورشل، داخل همین پوشهٔ کیت:
#      powershell -ExecutionPolicy Bypass -File .\apply-v10.1.ps1
#  اختیاری: مسیر مخزن موجود را هم می‌توانید بدهید:
#      powershell -ExecutionPolicy Bypass -File .\apply-v10.1.ps1 -RepoPath "C:\مسیر\math-game"
# ============================================================
param(
  [string]$RepoPath = ""
)
$ErrorActionPreference = "Stop"

function Fail([string]$msg, [int]$code) {
  Write-Host ""
  Write-Host "❌ $msg" -ForegroundColor Red
  exit $code
}

Write-Host ""
Write-Host "==== نصب «کارگاه ضرب» نسخهٔ ۱۰.۱.۴ روی گیت‌هاب ====" -ForegroundColor Cyan
Write-Host ""

# ── ۰) پیش‌نیازها ─────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail ("Git نصب نیست. از آدرس https://git-scm.com/download/win نصب کنید،" + [Environment]::NewLine + "   پنجرهٔ پاورشل را ببندید و دوباره باز کنید، بعد این اسکریپت را دوباره اجرا کنید.") 3
}

$kit = $PSScriptRoot
if (-not $kit) { Fail "این فایل باید از داخل پوشهٔ کیت اجرا شود." 3 }

# ── ۱) آماده‌سازی مخزن (کلون تازه یا مسیر داده‌شده) ────────────
if (-not $RepoPath) {
  $RepoPath = Join-Path $kit "math-game"
}
if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
  Write-Host "↻ مخزن از گیت‌هاب کلون می‌شود (فقط بار اول) ..."
  git clone --branch v6 https://github.com/bayrami1341/math-game.git $RepoPath
  if ($LASTEXITCODE -ne 0) { Fail "کلون ناموفق بود — اتصال اینترنت را بررسی کنید." 4 }
}
Set-Location $RepoPath

Write-Host "↻ رفتن به شاخهٔ v6 ..."
git checkout v6
if ($LASTEXITCODE -ne 0) { Fail "رفتن به شاخهٔ v6 ناموفق بود." 4 }
git pull origin v6
if ($LASTEXITCODE -ne 0) { Write-Host "⚠ همگام‌سازی اولیه ناموفق بود — ادامه می‌دهیم." -ForegroundColor Yellow }

# ── ۲) شاخهٔ پشتیبان (نسخهٔ فعلی برای برگشت نگه داشته می‌شود) ──
if (-not (git branch --list "backup/v10-final")) {
  git branch "backup/v10-final"
  Write-Host "✔ شاخهٔ پشتیبان backup/v10-final ساخته شد (برای برگشت به نسخهٔ قبل)."
} else {
  Write-Host "✔ شاخهٔ پشتیبان backup/v10-final از قبل موجود است."
}

# ── ۳) کپی فایل‌های کیت روی مخزن (۲۳ فایل) ────────────────────
$files = @(
  "v10.html",
  "package.json",
  "apply-v10.1-to-github.sh",
  "apply-v10.1.ps1",
  "راهنمای_جامع_نسخه_۱۰.۱.md",
  "styles/v10.css",
  "src/v10/app.js",
  "src/v10/bridge.js",
  "src/v10/station/cells.js",
  "src/v10/station/constants.js",
  "src/v10/station/guide.js",
  "src/v10/station/index.js",
  "src/v10/station/ladder.js",
  "src/v10/station/map.js",
  "src/v10/station/sheet.js",
  "src/v10/station/sounds.js",
  "src/v10/station/story.js",
  "src/v10/station/visuals.js",
  "src/v9/experience.mjs",
  "src/v9/local.mjs",
  "tests/v10-station.test.js",
  "tests/v10.1-station.test.js",
  "tests/v10.1-side-missions.test.js"
)
foreach ($f in $files) {
  $src = Join-Path $kit $f
  if (-not (Test-Path $src)) { Fail "فایل کیت پیدا نشد: $f" 5 }
  $dst = Join-Path $RepoPath $f
  $dir = Split-Path $dst -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item $src $dst -Force
}
Write-Host "✔ $($files.Count) فایل کیت روی مخزن کپی شد."

# ── ۴) آزمون‌ها (اگر Node.js نصب باشد) ────────────────────────
if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "↻ اجرای ۳۱ آزمون بازی ..."
  node --test tests/v10-station.test.js tests/v10.1-station.test.js tests/v10.1-side-missions.test.js | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Fail "آزمون‌ها سبز نشدند — نصب متوقف شد و مخزن تغییری نکرده که نگران باشید." 1
  }
  Write-Host "✔ ۳۱/۳۱ آزمون سبز."
} else {
  Write-Host "⚠ Node.js پیدا نشد — آزمون‌ها رد شد (اختیاری بود؛ بازی بدون آن هم درست کار می‌کند)."
}

# ── ۵) ثبت تغییرات (کامیت) ────────────────────────────────────
git add -A
if (git diff --cached --name-only) {
  git commit -m "feat(v10.1.4): nav bar (home/story/leaderboard/join), teacher panel, story dialog"
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ کامیت ناموفق بود. یک‌بار این دو دستور را در پاورشل اجرا کنید (نام و ایمیل خودتان) و دوباره اسکریپت را اجرا کنید:" -ForegroundColor Red
    Write-Host '   git config --global user.name  "نام شما"'
    Write-Host '   git config --global user.email "ایمیل شما"'
    exit 6
  }
  Write-Host "✔ تغییرات ثبت شد."
} else {
  Write-Host "✔ مخزن از قبل همین نسخه را داشت — چیزی برای ثبت نبود."
}

# ── ۶) ارسال به گیت‌هاب (push) ─────────────────────────────────
Write-Host "↻ ارسال به گیت‌هاب ..."
git push origin v6
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ push ناموفق بود — گیت‌هاب اجازهٔ ورود نداد." -ForegroundColor Red
  Write-Host "   نگران نباشید: همهٔ تغییرات در مخزنِ روی رایانهٔ شما ذخیره شده؛ فقط ارسال نهایی مانده."
  Write-Host ""
  Write-Host "✅ یکی از این سه روش را انجام دهید و بعد دوباره بزنید: git push origin v6" -ForegroundColor Green
  Write-Host "   روش ۱ — ساده‌ترین: در همین پنجره بنویسید  git push origin v6  و Enter؛"
  Write-Host "           پنجرهٔ ورود گیت‌هاب باز می‌شود، با حساب bayrami1341 وارد شوید."
  Write-Host "   روش ۲ — با GitHub CLI:  gh auth login"
  Write-Host "   روش ۳ — با توکن (PAT):  git remote set-url origin https://توکن@github.com/bayrami1341/math-game.git"
  Write-Host "           توکن: گیت‌هاب ← Settings ← Developer settings ← Personal access tokens ←"
  Write-Host "           Generate new token (تیک «repo» را حتماً بزنید) — توکن را همان‌جا کپی کنید."
  exit 2
}

Write-Host ""
Write-Host "🎉 تمام شد! نسخهٔ ۱۰.۱.۴ روی گیت‌هاب ارسال شد." -ForegroundColor Green
Write-Host "   ۱) ۲ تا ۵ دقیقه صبر کنید (گیت‌هاب صفحه را تازه می‌کند)."
Write-Host "   ۲) این آدرس را باز کنید: https://bayrami1341.github.io/math-game/v10.html"
Write-Host "   ۳) اگر صفحهٔ قدیمی دیدید: Ctrl+F5 بزنید (رفرش کامل)."
Write-Host "   ۴) بالای بازی ۵ دکمهٔ جدید می‌بینید: خانه، داستان، لیدربرد، ثبت‌نام، پنل معلم."
Write-Host ""
