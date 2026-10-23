#!/usr/bin/env python3
"""گیت پذیرش منبع (Z01 — BP-021 T1) — fail-closed — نسخهٔ ۲ (سخت‌شده).

نسخهٔ ۲ (فرمان مالک — الحاق پروتکل ریزربات G2، مادهٔ ۳):
  * manifest ناقص/صفر هم fail-closed است: size_bytes=0، pages=0، فیلد غایب،
    رشتهٔ SHA خوداظهارِ ناخوانا — هیچ‌کدام نمی‌توانند PASS بدهند.
    (آرنا با فایل مصنوعی نشان داد نسخهٔ ۱ با size_bytes=0/pages=0 از بررسی عبور می‌کرد.)
  * pin معتبر منبع: شواهد فقط از بایت واقعی می‌آید؛ فیلدهای manifest «ادعا» هستند
    و هر ادعا باید با بایت آزموده شود، وگرنه BLOCKED.

تطبیق منبع مجاز (PDF کتاب) با مانیفستِ vault:
  ۱. اعتبارسنجی ساختار manifest → نقص = BLOCKED/MANIFEST_INCOMPLETE_* (با مسئول و علت)
  ۲. وجود فایل → نبود = BLOCKED/SOURCE_ABSENT (با مسئول و علت؛ هرگز PDF بازنشر نمی‌شود)
  ۳. SHA-256 بایت‌به‌بایت → نابرابری = FAIL/EDITION_SHA_MISMATCH
  ۴. اندازهٔ بایت → نابرابری = FAIL/SIZE_MISMATCH
  ۵. شمار صفحه → نابرابری = FAIL/PAGE_COUNT_MISMATCH
  ۶. PDF داخل هیچ Git-worktree نیست → نقض = FAIL/SOURCE_INSIDE_GIT (حق نشر)

خروجی: حکم ماشینی PASS | BLOCKED | FAIL با علت و شناسهٔ منبع؛ فقط هش و آمار — هیچ بایتی از کتاب.
کد خروج: ۰ = PASS، ۱ = BLOCKED/FAIL (ادغام/ادعا بدون منبعِ پذیرفته‌شده ممنوع).

آزمون منفی: scripts/test-source-gate-negative.py (حذف/صفرکردن فیلدها، SHA غلط، فایل غایب)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def inside_git_worktree(path: Path) -> bool:
    cur = path.resolve().parent
    while True:
        if (cur / ".git").exists():
            return True
        if cur == cur.parent:
            return False
        cur = cur.parent


def page_count(path: Path) -> int | None:
    try:
        import fitz  # pymupdf

        doc = fitz.open(str(path))
        n = doc.page_count
        doc.close()
        return n
    except Exception:
        return None


def _blocked_incomplete(field: str, detail: str, src_key: str) -> dict:
    """حکم یکدست برای manifest ناقص: همیشه BLOCKED — هرگز PASS."""
    return {
        "status": "BLOCKED",
        "reason_code": f"MANIFEST_INCOMPLETE_{field.upper()}",
        "owner": "آرنا (تکمیل manifest) + Z.ai (وارسی) + مالک (پذیرش نهایی)",
        "checks": [{"id": "manifest", "result": "BLOCKED", "detail": detail}],
        "source_key": src_key,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def validate_manifest(manifest: object) -> tuple[dict | None, dict | None]:
    """اعتبارسنجی سخت‌گیرانهٔ ساختار manifest — fail-closed.

    برمی‌گرداند (manifest، None) یا (None، حکم BLOCKED).
    هیچ فیلدی «اختیاری با رفتار عبوری» نیست؛ نقص یا صفر = BLOCKED.
    """
    if not isinstance(manifest, dict):
        return None, _blocked_incomplete("schema", "manifest شیء JSON نیست", "unknown")

    schema = manifest.get("schema")
    if not isinstance(schema, str) or not schema.startswith("khshab.source-vault/"):
        return None, _blocked_incomplete("schema", f"schema نامعتبر: {schema!r} — باید khshab.source-vault/* باشد", "unknown")

    src_key = manifest.get("source_key")
    if not isinstance(src_key, str) or not src_key.strip():
        return None, _blocked_incomplete("source_key", "source_key غایب یا خالی است", "unknown")

    file_rec = manifest.get("file")
    if not isinstance(file_rec, dict):
        return None, _blocked_incomplete("file", "بخش file غایب است", src_key)

    sha = file_rec.get("sha256")
    if not isinstance(sha, str) or not SHA256_RE.match(sha):
        return None, _blocked_incomplete("sha256", f"sha256 غایب یا فرمت نامعتبر: {str(sha)[:80]!r}", src_key)

    size = file_rec.get("size_bytes")
    if isinstance(size, bool) or not isinstance(size, int) or size <= 0:
        return None, _blocked_incomplete("size_bytes", f"size_bytes غایب/صفر/نامعتبر: {size!r} — نمی‌تواند بررسی اندازه را دور بزند", src_key)

    pages = manifest.get("pages")
    if isinstance(pages, bool) or not isinstance(pages, int) or pages <= 0:
        return None, _blocked_incomplete("pages", f"pages غایب/صفر/نامعتبر: {pages!r} — نمی‌تواند بررسی صفحه را دور بزند", src_key)

    return manifest, None


def run_gate(pdf: Path, manifest_path: Path) -> dict:
    # ── مرحلهٔ صفر: خوانایی manifest ──
    try:
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "BLOCKED",
            "reason_code": "MANIFEST_UNREADABLE",
            "owner": "آرنا (تکمیل manifest) + Z.ai (وارسی)",
            "checks": [{"id": "manifest", "result": "BLOCKED", "detail": str(exc)}],
            "source_key": None,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    manifest, blocked = validate_manifest(raw)
    if blocked is not None:
        return blocked

    assert manifest is not None
    src_key = manifest.get("source_key", "unknown")
    file_rec = manifest.get("file") or {}
    expected_sha = file_rec.get("sha256", "")
    expected_size = file_rec.get("size_bytes", 0)
    expected_pages = manifest.get("pages")

    checks: list[dict] = []
    status = "PASS"

    # ── وجود فایل ──
    if not pdf.exists():
        return {
            "status": "BLOCKED",
            "reason_code": "SOURCE_ABSENT",
            "owner": "مالک (تأمین دسترسی منبع) + Z.ai (بازچینی vault)",
            "checks": [{"id": "existence", "result": "BLOCKED", "detail": "فایل منبع در vault در دسترس نیست"}],
            "source_key": src_key,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── ایمنی Git (حق نشر) ──
    if inside_git_worktree(pdf):
        checks.append({"id": "git-safety", "result": "FAIL", "detail": "منبع داخل Git-worktree است (حق نشر)"})
        status = "FAIL"
    else:
        checks.append({"id": "git-safety", "result": "PASS", "detail": "منبع خارج از Git"})

    # ── SHA بایت‌به‌بایت (شاهد واقعی — نه رشتهٔ خوداظهار) ──
    actual_sha = file_sha256(pdf)
    if actual_sha != expected_sha:
        checks.append({"id": "sha256", "result": "FAIL", "detail": f"expected={expected_sha[:16]}… actual={actual_sha[:16]}…"})
        status = "FAIL"
    else:
        checks.append({"id": "sha256", "result": "PASS", "detail": f"sha256={actual_sha}"})

    # ── اندازهٔ بایت (expected الآن تضمیناً int مثبت است) ──
    actual_size = pdf.stat().st_size
    if actual_size != expected_size:
        checks.append({"id": "size", "result": "FAIL", "detail": f"expected={expected_size} actual={actual_size}"})
        status = "FAIL"
    else:
        checks.append({"id": "size", "result": "PASS", "detail": f"size={actual_size}"})

    # ── شمار صفحه (expected الآن تضمیناً int مثبت است) ──
    actual_pages = page_count(pdf)
    if actual_pages is None:
        checks.append({"id": "pages", "result": "BLOCKED", "detail": "pymupdf در دسترس نیست — شمار صفحه تأیید نشد"})
        if status == "PASS":
            status = "BLOCKED"
    elif actual_pages != expected_pages:
        checks.append({"id": "pages", "result": "FAIL", "detail": f"expected={expected_pages} actual={actual_pages}"})
        status = "FAIL"
    else:
        checks.append({"id": "pages", "result": "PASS", "detail": f"pages={actual_pages}"})

    # نگاشت کد علت به قرارداد پایدار (برای CI و audit — نه id داخلی وارسی)
    REASON_BY_CHECK = {
        "sha256": "EDITION_SHA_MISMATCH",
        "size": "SIZE_MISMATCH",
        "pages": "PAGE_COUNT_MISMATCH",
        "git-safety": "SOURCE_INSIDE_GIT",
    }
    first_bad = next((c["id"] for c in checks if c["result"] in {"FAIL", "BLOCKED"}), None)
    reason = None if status == "PASS" else REASON_BY_CHECK.get(first_bad, first_bad or "unknown")
    return {
        "status": status,
        "reason_code": reason,
        "owner": "مالک" if status == "BLOCKED" else "Z.ai",
        "checks": checks,
        "source_key": f"{src_key}:{actual_sha[:12]}" if status == "PASS" else src_key,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--markdown", default=None)
    args = ap.parse_args()

    verdict = run_gate(Path(args.pdf), Path(args.manifest))
    print(json.dumps(verdict, ensure_ascii=False, indent=2))

    if args.markdown:
        lines = [
            "# گیت پذیرش منبع (Z01/BP-021-T1) — نسخهٔ ۲ سخت‌شده",
            "",
            f"- حکم: **{verdict['status']}**" + (f" — علت: `{verdict.get('reason_code')}`" if verdict.get("reason_code") else ""),
            f"- شناسهٔ منبع: `{verdict.get('source_key')}`",
            "",
            "| وارسی | نتیجه | جزئیات |",
            "|---|---|---|",
        ]
        for c in verdict["checks"]:
            lines.append(f"| {c['id']} | {c['result']} | {c['detail']} |")
        lines += [
            "",
            "> این گزارش فقط هش و آمار را منتشر می‌کند؛ هیچ بایتی از کتاب در آن نیست.",
            "> نسخهٔ ۲: manifest ناقص/صفر (size_bytes=0، pages=0، فیلد غایب) هم fail-closed است.",
        ]
        Path(args.markdown).write_text("\n".join(lines) + "\n", encoding="utf-8")

    return 0 if verdict["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
