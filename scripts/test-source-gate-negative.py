#!/usr/bin/env python3
"""آزمون منفی گیت پذیرش منبع (Z01/BP-021-T1) — نسخهٔ ۲ (فرمان مالک، الحاق پروتکل G2).

هر مورد باید exit 1 بدهد (هرگز PASS). این آزمون «شکست عمدی» قابل ثبت در CI است:
  ۱. size_bytes حذف‌شده          → BLOCKED/MANIFEST_INCOMPLETE_SIZE_BYTES
  ۲. size_bytes = 0              → BLOCKED/MANIFEST_INCOMPLETE_SIZE_BYTES  (حفرهٔ یافت‌شدهٔ آرنا)
  ۳. pages حذف‌شده               → BLOCKED/MANIFEST_INCOMPLETE_PAGES
  ۴. pages = 0                   → BLOCKED/MANIFEST_INCOMPLETE_PAGES     (حفرهٔ یافت‌شدهٔ آرنا)
  ۵. sha256 حذف‌شده              → BLOCKED/MANIFEST_INCOMPLETE_SHA256
  ۶. sha256 خوداظهارِ غلط        → FAIL/EDITION_SHA_MISMATCH
  ۷. فایل منبع غایب              → BLOCKED/SOURCE_ABSENT
  ۸. manifest خوانا نیست         → BLOCKED/MANIFEST_UNREADABLE
و آزمون مثبت: pin معتبر منبع واقعی (C205) روی همان PDF → exit 0/PASS
(اثبات می‌کند سخت‌سازی، پذیرش منبع صحیح را نشکسته است.)

مصرف: python3 scripts/test-source-gate-negative.py --pdf VAULT.pdf --manifest VAULT-manifest.json
کد خروج مجموعه: ۰ = همهٔ منفی‌ها رد شدند و مثبت سبز؛ ۱ = حفره یا خرابی گیت.
"""

from __future__ import annotations

import argparse
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path

GATE = Path(__file__).resolve().parent / "accept-source-gate.py"

# (نام آزمون، تغییر روی manifest، انتظار reason_code)
NEGATIVE_CASES = [
    ("size_bytes_removed", lambda m: m["file"].pop("size_bytes"), "MANIFEST_INCOMPLETE_SIZE_BYTES"),
    ("size_bytes_zero", lambda m: m["file"].__setitem__("size_bytes", 0), "MANIFEST_INCOMPLETE_SIZE_BYTES"),
    ("size_bytes_negative", lambda m: m["file"].__setitem__("size_bytes", -1), "MANIFEST_INCOMPLETE_SIZE_BYTES"),
    ("pages_removed", lambda m: m.pop("pages"), "MANIFEST_INCOMPLETE_PAGES"),
    ("pages_zero", lambda m: m.__setitem__("pages", 0), "MANIFEST_INCOMPLETE_PAGES"),
    ("sha256_removed", lambda m: m["file"].pop("sha256"), "MANIFEST_INCOMPLETE_SHA256"),
    ("sha256_selfdeclared_wrong", lambda m: m["file"].__setitem__("sha256", "0" * 64), "EDITION_SHA_MISMATCH"),
    ("schema_drifted", lambda m: m.__setitem__("schema", "some-other-vault/v9"), "MANIFEST_INCOMPLETE_SCHEMA"),
    ("source_key_empty", lambda m: m.__setitem__("source_key", ""), "MANIFEST_INCOMPLETE_SOURCE_KEY"),
]


def run_gate(pdf: Path, manifest_file: Path) -> tuple[int, dict]:
    proc = subprocess.run(
        [sys.executable, str(GATE), "--pdf", str(pdf), "--manifest", str(manifest_file)],
        capture_output=True, text=True, timeout=300,
    )
    try:
        verdict = json.loads(proc.stdout)
    except Exception:
        verdict = {"status": "UNPARSABLE", "reason_code": None, "stdout": proc.stdout[-400:]}
    return proc.returncode, verdict


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="PDF واقعی داخل vault (خارج از Git)")
    ap.add_argument("--manifest", required=True, help="manifest معتبر همان منبع")
    args = ap.parse_args()

    pdf = Path(args.pdf)
    base_manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))

    failures: list[str] = []
    rows: list[tuple[str, str, str]] = []

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        # منبع غایب: PDF به مسیر ناموجود اشاره می‌کند
        absent_pdf = tmp / "no-such-source.pdf"

        for name, mutate, want_reason in NEGATIVE_CASES:
            m = copy.deepcopy(base_manifest)
            mutate(m)
            mf = tmp / f"manifest-{name}.json"
            mf.write_text(json.dumps(m, ensure_ascii=False), encoding="utf-8")
            code, verdict = run_gate(pdf, mf)
            ok = code == 1 and verdict.get("status") in {"FAIL", "BLOCKED"} and verdict.get("reason_code") == want_reason
            rows.append((name, verdict.get("reason_code") or "-", "✅ رد شد" if ok else "❌ PASS/عبور نادرست!"))
            if not ok:
                failures.append(name)

        # فایل غایب
        code, verdict = run_gate(absent_pdf, Path(args.manifest))
        ok = code == 1 and verdict.get("reason_code") == "SOURCE_ABSENT"
        rows.append(("source_absent", verdict.get("reason_code") or "-", "✅ رد شد" if ok else "❌"))
        if not ok:
            failures.append("source_absent")

        # manifest غیرقابل‌خواندن
        bad_mf = tmp / "manifest-broken.json"
        bad_mf.write_text("{not json at all", encoding="utf-8")
        code, verdict = run_gate(pdf, bad_mf)
        ok = code == 1 and verdict.get("reason_code") == "MANIFEST_UNREADABLE"
        rows.append(("manifest_unreadable", verdict.get("reason_code") or "-", "✅ رد شد" if ok else "❌"))
        if not ok:
            failures.append("manifest_unreadable")

        # ── آزمون مثبت: pin معتبر همان منبع روی بایت واقعی ──
        code, verdict = run_gate(pdf, Path(args.manifest))
        positive_ok = code == 0 and verdict.get("status") == "PASS"
        rows.append(("positive_valid_pin", verdict.get("status") or "-", "✅ PASS" if positive_ok else "❌ منبع معتبر رد شد!"))
        if not positive_ok:
            failures.append("positive_valid_pin")

    width = max(len(r[0]) for r in rows) + 2
    print("== آزمون منفی گیت منبع (شکست عمدی) ==")
    for name, got, res in rows:
        print(f"  {name.ljust(width)} got={got.ljust(32)} {res}")

    if failures:
        print(f"\nنتیجه: ❌ قرمز — {len(failures)} مورد: {', '.join(failures)}")
        return 1
    print("\nنتیجه: ✅ همهٔ تلاش‌های دورزدن رد شدند؛ pin معتبر سبز ماند.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
