"""Fail-closed C205 source intake. Never writes or stages PDF/crops.

Requires pymupdf. A matching SHA + 152 PDF pages verifies the *file bytes*, NOT
printed-page offset, visual claims, educational content, or release permission.

  python authoring/tools/verify_c205_source.py --pdf /secure/vault/C205.pdf --report /tmp/c205-source-check.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_SHA = "a93934b6c418d4c6efe5ebb109bbcfe4f5fb6024fa1f3b1b309a4ff6da2746de"
EXPECTED_SIZE = 11838641
EXPECTED_PDF_PAGES = 152


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _inside(root: Path, path: Path) -> bool:
    return path == root or root in path.parents


def verify(path: Path, *, expected_sha: str = EXPECTED_SHA,
           expected_size: int = EXPECTED_SIZE, expected_pages: int = EXPECTED_PDF_PAGES) -> dict:
    """Allow overriding expected values only for synthetic unit tests; CLI uses constants."""
    result = {"schema": "C205_SOURCE_INTAKE_v1", "book_code": "C205",
              "status": "BLOCKED", "reason_code": "SOURCE_PDF_UNAVAILABLE",
              "expected_pdf_sha256": expected_sha, "actual_pdf_sha256": None,
              "pdf_pages": None, "offset_status": "UNVERIFIED",
              "visual_evidence_status": "UNVERIFIED",
              "teacher_verdict": "NOT_GRANTED", "release_authorization": "NOT_GRANTED"}
    root = ROOT.resolve()
    raw = path.absolute()
    resolved = path.resolve()
    if _inside(root, raw) or _inside(root, resolved):
        result["reason_code"] = "SOURCE_MUST_BE_OUTSIDE_REPOSITORY"
        return result
    if not resolved.is_file():
        return result
    try:
        size = resolved.stat().st_size
        if size != expected_size:
            result["reason_code"] = "SOURCE_SIZE_MISMATCH"
            return result
        actual_sha = sha256_file(resolved)
        result["actual_pdf_sha256"] = actual_sha
        if actual_sha != expected_sha:
            result["reason_code"] = "SOURCE_SHA_MISMATCH"
            return result
        import pymupdf
        with pymupdf.open(str(resolved)) as doc:
            if not doc.is_pdf or doc.needs_pass:
                result["reason_code"] = "UNREADABLE_OR_ENCRYPTED_PDF"
                return result
            result["pdf_pages"] = len(doc)
            if len(doc) != expected_pages:
                result["reason_code"] = "PDF_PAGE_COUNT_MISMATCH"
                return result
    except (OSError, ValueError, RuntimeError) as exc:
        result["reason_code"] = "SOURCE_UNREADABLE"
        result["error_type"] = type(exc).__name__  # no secret path or PDF content
        return result
    result["status"] = "PASS_SOURCE_BYTES_ONLY"
    result["reason_code"] = "SOURCE_SHA_SIZE_AND_PAGE_COUNT_VERIFIED"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    result = verify(args.pdf)  # No CLI option to weaken the pinned fingerprint.
    report = args.report.resolve()
    if _inside(ROOT.resolve(), report):
        print("REPORT_MUST_BE_OUTSIDE_REPOSITORY", file=sys.stderr)
        return 2
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "PASS_SOURCE_BYTES_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
