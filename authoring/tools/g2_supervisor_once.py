"""One-shot, read-only G2 supervisor checkpoint (NOT a resident/nightly worker).

Executes source/input preflight + candidate metadata inventory, then records
explicit blockers. No PDF contents, teacher verdicts, green stamps, Git writes,
or release actions. A persistent scheduler/worker must be deployed separately.

Run with openpyxl installed and origin/v10.3-beta fetched:
  python authoring/tools/g2_supervisor_once.py --output authoring/g2-completion/G2-SUPERVISOR-STATE-v1.json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from audit_g2_completion import inventory
from g2_night_preflight import inspect

ROOT = Path(__file__).resolve().parents[2]
BACKLOG = ROOT / "authoring/g2-completion/G2-CH6-8-VARIANT-BACKLOG-v1.json"
DRAFTS = ROOT / "authoring/g2-completion/G2-CH6-ARITHMETIC-DRAFTS-v1.json"


def summarize(preflight: dict, content: dict) -> dict:
    hashes = content["hashes"]
    if preflight["status"] != "PASS_INPUTS_ONLY" or preflight["sha256"] != hashes:
        return {
            "status": "HOLD_INPUT_DRIFT", "tasks": [],
            "blockers": ["Preflight or cross-check hashes disagree; inspect before authoring."],
        }
    source_ready = preflight["source_status"].startswith("SOURCE_SHA_VERIFIED")
    backlog_status = "NOT_STARTED"
    if BACKLOG.is_file():
        b = json.loads(BACKLOG.read_text(encoding="utf-8"))
        if b.get("input_sha256") == hashes and b.get("pages_provisionally_classified") == 54 and b.get("question_rows_authored") == 0:
            backlog_status = "PROVISIONAL_ONLY"
        else:
            backlog_status = "BLOCKED_STALE_BACKLOG"
    draft_status = "NOT_STARTED"
    if DRAFTS.is_file():
        d = json.loads(DRAFTS.read_text(encoding="utf-8"))
        if d.get("draft_count") == 32 and not d.get("ready_for_workbook") and not d.get("book_evidence_verified") and all(
            row.get("q_id") is None and row.get("teacher_verdict") == "NOT_GRANTED" for row in d.get("drafts", [])
        ):
            draft_status = "PROVISIONAL_ONLY"
        else:
            draft_status = "BLOCKED_UNSAFE_DRAFT_METADATA"
    tasks = [
        {"id": "G0_INPUTS", "status": "PASS_INPUTS_ONLY", "next": "Watch official/candidate SHA drift"},
        {"id": "G1_C205_SOURCE", "status": "SOURCE_SHA_ONLY_OFFSET_UNVERIFIED" if source_ready else preflight["source_status"],
         "next": "Securely mount C205 outside Git; verify SHA, print, pagination and image regions"},
        {"id": "G2_PAGE_EVIDENCE", "status": "NOT_VERIFIED" if source_ready else "BLOCKED_SOURCE_DEPENDENCY",
         "next": "Independently verify 108 queued pages and page-level image/numeric claims"},
        {"id": "G3_BREADTH", "status": "INVENTORY_ONLY_NOT_PROVEN", "next": "Map all book objectives to executable experiences"},
        {"id": "G4_DEPTH", "status": backlog_status, "next": "Check every proposed variant against book and runtime"},
        {"id": "G5_YELLOW_CONTENT", "status": draft_status,
         "next": "Evidence-bind, independently audit, engine-test, then assign IDs to approved-scope yellow candidates"},
        {"id": "G6_INDEPENDENT_AUDIT", "status": "NOT_DONE", "next": "Second audit on actual content and textbook figures"},
        {"id": "G7_RUNTIME", "status": "NOT_TESTED_ON_COMPLETED_CARTRIDGE",
         "next": "Run converter, real game interaction and regression on one completed SHA"},
        {"id": "G8_OWNER_PACKET", "status": "NOT_READY", "next": "Prepare bounded decisions only after evidence/coverage checks"},
    ]
    blocked = [x for x in tasks if x["status"].startswith("BLOCKED") or x["status"].startswith("SOURCE_SHA_ONLY")]
    return {"status": "NOT_READY", "tasks": tasks,
            "blockers": [f"{x['id']}: {x['status']}" for x in blocked],
            "chapter_existing_q": [x["existing_q_count"] for x in content["chapter_summary"]],
            "source_status": preflight["source_status"],
            "runner_status": "NOT_DEPLOYED_THIS_IS_ONE_SHOT_ONLY",
            "authorization": "TECHNICAL_WORK_ONLY_NO_TEACHER_OR_RELEASE"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        preflight = inspect()
        content = inventory()
        result = summarize(preflight, content)
    except (ValueError, OSError, KeyError) as exc:
        result = {"status": "BLOCKED_INTEGRITY", "blockers": [str(exc)], "tasks": []}
    result["schema"] = "G2_SUPERVISOR_SNAPSHOT_v1"
    result["observed_utc"] = datetime.now(timezone.utc).isoformat()
    path = args.output if args.output.is_absolute() else ROOT / args.output
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "blockers": result["blockers"],
                      "runner_status": result.get("runner_status", "NOT_DEPLOYED")}, ensure_ascii=False))
    return 1 if result["status"] in {"HOLD_INPUT_DRIFT", "BLOCKED_INTEGRITY"} else 0


if __name__ == "__main__":
    sys.exit(main())
