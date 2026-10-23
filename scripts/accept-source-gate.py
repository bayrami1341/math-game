#!/usr/bin/env python3
"""گیت پذیرش منبع (Z01 — BP-021 T1) — fail-closed.

منبع مجاز (PDF کتاب) را با مانیفستِ vault تطبیق می‌دهد:
  ۱. وجود فایل → نبود = BLOCKED/SOURCE_ABSENT (با مسئول و علت؛ هرگز PDF را بازنشر نمی‌کند)
  ۲. SHA-256 بایت‌به‌بایت → نابرابری = FAIL/EDITION_SHA_MISMATCH
  ۳. اندازهٔ بایت → نابرابری = FAIL/SIZE_MISMATCH
  ۴. شمار صفحه → نابرابری = FAIL/PAGE_COUNT_MISMATCH
  ۵. PDF داخل هیچ Git-worktree نیست → نقض = FAIL/SOURCE_INSIDE_GIT (حق نشر)

خروجی: حکم ماشینی PASS | BLOCKED | FAIL با علت و شناسهٔ منبع؛ فقط هش و آمار — هیچ بایتی از کتاب.
کد خروج: ۰ = PASS، ۱ = BLOCKED/FAIL (ادغام/ادعا بدون منبعِ پذیرفته‌شده ممنوع).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


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


def run_gate(pdf: Path, manifest_path: Path) -> dict:
    checks: list[dict] = []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        return {
            "status": "BLOCKED",
            "reason_code": "MANIFEST_UNREADABLE",
            "owner": "Z.ai (مهندس اصلی)",
            "checks": [{"id": "manifest", "result": "BLOCKED", "detail": str(exc)}],
            "source_key": None,
        }

    src_key = manifest.get("source_key", "unknown")
    expected_sha = (manifest.get("file") or {}).get("sha256", "")
    expected_size = (manifest.get("file") or {}).get("size_bytes", 0)
    expected_pages = manifest.get("pages")

    status = "PASS"

    if not pdf.exists():
        checks.append(
            {"id": "existence", "result": "BLOCKED", "detail": "فایل منبع در vault در دسترس نیست"}
        )
        return {
            "status": "BLOCKED",
            "reason_code": "SOURCE_ABSENT",
            "owner": "مالک (تأمین دسترسی منبع) + Z.ai (بازچینی vault)",
            "checks": checks,
            "source_key": src_key,
        }

    if inside_git_worktree(pdf):
        checks.append({"id": "git-safety", "result": "FAIL", "detail": "منبع داخل Git-worktree است (حق نشر)"})
        status = "FAIL"
    else:
        checks.append({"id": "git-safety", "result": "PASS", "detail": "منبع خارج از Git"})

    actual_sha = file_sha256(pdf)
    if actual_sha != expected_sha:
        checks.append({"id": "sha256", "result": "FAIL", "detail": f"expected={expected_sha[:16]}… actual={actual_sha[:16]}…"})
        status = "FAIL"
    else:
        checks.append({"id": "sha256", "result": "PASS", "detail": f"sha256={actual_sha}"})

    actual_size = pdf.stat().st_size
    if expected_size and actual_size != expected_size:
        checks.append({"id": "size", "result": "FAIL", "detail": f"expected={expected_size} actual={actual_size}"})
        status = "FAIL"
    else:
        checks.append({"id": "size", "result": "PASS", "detail": f"size={actual_size}"})

    actual_pages = page_count(pdf)
    if actual_pages is None:
        checks.append({"id": "pages", "result": "BLOCKED", "detail": "pymupdf در دسترس نیست — شمار صفحه تأیید نشد"})
        if status == "PASS":
            status = "BLOCKED"
    elif expected_pages and actual_pages != expected_pages:
        checks.append({"id": "pages", "result": "FAIL", "detail": f"expected={expected_pages} actual={actual_pages}"})
        status = "FAIL"
    else:
        checks.append({"id": "pages", "result": "PASS", "detail": f"pages={actual_pages}"})

    reason = None if status == "PASS" else next(
        (c["id"] for c in checks if c["result"] in {"FAIL", "BLOCKED"}), "unknown"
    )
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
            "# گیت پذیرش منبع (Z01/BP-021-T1)",
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
        ]
        Path(args.markdown).write_text("\n".join(lines) + "\n", encoding="utf-8")

    return 0 if verdict["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
