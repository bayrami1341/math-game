"""Read-only, fail-closed input checkpoint for the G2 night-shift plan.

Usage: python authoring/tools/g2_night_preflight.py --output authoring/G2-NIGHT-SHIFT-START-v1.json
No PDF, crop, secret or workbook content is written to the report.
This checkpoint authorizes neither promotion nor continuous background operation.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPECTED = {
    "official": "f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656",
    "candidate": "18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618",
    "priority_queue": "f949a58ba7e2852e948170e7bee0a46312b762a7a318e0089fc10053928d3148",
    "pagemap": "3bfd31b6f3ebfb4f6d8391c7dedd6c25b164b64140c32977fb2f3b2731db70b2",
}
FILES = {
    "candidate": "authoring/khshab-G2-MATH_v1.2_page-goals-draft.xlsx",
    "priority_queue": "authoring/G2-REVIEW-PRIORITY-v1.csv",
    "pagemap": "authoring/PAGE-MAP-KH-G2-MATH-v1.2_teacher-followup.xlsx",
}
OFFICIAL_REF = "origin/v10.3-beta"
OFFICIAL_PATH = "public/math-game/authoring/khshab-G2-MATH_v0.5.xlsx"
SOURCE_SHA = "a93934b6c418d4c6efe5ebb109bbcfe4f5fb6024fa1f3b1b309a4ff6da2746de"
PRIORITIES = {"P0": 5, "P1": 2, "P2": 56, "P3": 45}


def digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True).stdout


def inspect() -> dict:
    failures: list[str] = []
    try:
        branch = git("branch", "--show-current").decode().strip()
        head = git("rev-parse", "HEAD").decode().strip()
    except (OSError, subprocess.CalledProcessError):
        branch, head = "UNAVAILABLE", "UNAVAILABLE"
        failures.append("GIT_METADATA_UNAVAILABLE")
    if branch != "arena/6b8310f7-math-game":
        failures.append("WRONG_BRANCH")
    hashes = {}
    for label, relative in FILES.items():
        p = ROOT / relative
        hashes[label] = digest_file(p) if p.is_file() else None
        if hashes[label] != EXPECTED[label]:
            failures.append(f"{label.upper()}_SHA_DRIFT")
    try:
        actual = hashlib.sha256(git("show", f"{OFFICIAL_REF}:{OFFICIAL_PATH}")).hexdigest()
        official_head = git("rev-parse", OFFICIAL_REF).decode().strip()
    except (OSError, subprocess.CalledProcessError):
        actual, official_head = None, None
        failures.append("OFFICIAL_REF_UNAVAILABLE")
    hashes["official"] = actual
    if actual is not None and actual != EXPECTED["official"]:
        failures.append("OFFICIAL_SHA_DRIFT")

    counts: Counter[str] = Counter()
    queue_count = 0
    seen_pages: set[int] = set()
    if hashes.get("priority_queue") == EXPECTED["priority_queue"]:
        with (ROOT / FILES["priority_queue"]).open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                queue_count += 1
                counts[row["اولویت"]] += 1
                try:
                    book, pdf = int(row["صفحهٔ کتاب"]), int(row["صفحهٔ PDF"])
                except ValueError:
                    failures.append("QUEUE_PAGE_NOT_NUMERIC")
                    continue
                if book in seen_pages:
                    failures.append("DUPLICATE_QUEUE_BOOK_PAGE")
                seen_pages.add(book)
                if pdf - book != 6:
                    failures.append("QUEUE_OFFSET_MISMATCH")
        if counts != PRIORITIES or queue_count != 108:
            failures.append("QUEUE_COUNTS_DRIFT")

    # No implicit PDF discovery: explicitly supplied confidential input, outside repo only.
    pdf = os.environ.get("KHSHAB_C205_PDF", "").strip()
    if not pdf:
        source = "BLOCKED_SOURCE_UNAVAILABLE"
    else:
        p = Path(pdf).resolve()
        if p == ROOT or ROOT in p.parents:
            source = "BLOCKED_SOURCE_INSIDE_REPO"
            failures.append(source)
        elif not p.is_file():
            source = "BLOCKED_SOURCE_UNAVAILABLE"
        elif digest_file(p) != SOURCE_SHA:
            source = "HOLD_SOURCE_SHA_MISMATCH"
            failures.append(source)
        else:
            source = "SOURCE_SHA_VERIFIED_OFFSET_NOT_YET_VERIFIED"

    return {
        "schema": "g2-night-preflight-v1",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "approval_scope": "user-approved-technical-work-only; not a teacher verdict or release",
        "status": "HOLD_INPUT_DRIFT" if failures else "PASS_INPUTS_ONLY",
        "failures": sorted(set(failures)),
        "branch": branch,
        "head": head,
        "official_ref": OFFICIAL_REF,
        "official_ref_commit": official_head,
        "sha256": hashes,
        "queue_rows": queue_count,
        "queue_priorities": dict(sorted(counts.items())),
        "source_status": source,
        "source_sha256_expected": SOURCE_SHA,
        "note": "Input consistency only; does not establish evidence coverage or permit promotion.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = inspect()
    path = args.output if args.output.is_absolute() else ROOT / args.output
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("status", "failures", "queue_rows", "queue_priorities", "source_status")}, ensure_ascii=False))
    return 0 if report["status"] == "PASS_INPUTS_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
