"""Fail-closed G2 content-lane protocol gate for the design-only microbot pilot.

This does NOT authenticate people or authorize a server, merge, teacher verdict,
release, or persistent worker. It only rejects unsafe claims in a local snapshot.
Usage: python authoring/tools/g2_microbot_protocol_gate.py --input /tmp/g2-microbots.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from g2_night_preflight import EXPECTED

SCHEMA = "G2_MICROBOT_PLAN_v1"
AUTHORITY = "TECHNICAL_PLANNING_ONLY_NO_TEACHER_SEAL_MERGE_OR_RELEASE"
SAFE = frozenset({"M00", "M03", "M14", "M15", "M16"})
BLOCKED = frozenset({"M02", "M04", "M05", "M06", "M07", "M08", "M10", "M11", "M12"})
BOT_IDS = SAFE | BLOCKED | frozenset({"M01", "M09", "M13"})
# This is an allowlist for the content-lane preview, NOT an identity/authorization system.
BOT_CONTRACT = {
    "M00": ("Arena", []), "M01": ("Z.ai", ["M00"]),
    "M02": ("Z.ai code / Arena acceptance", ["M01"]), "M03": ("Arena", ["M00"]),
    "M14": ("Arena", ["M00"]), "M15": ("Arena", ["M14"]), "M16": ("Arena", ["M15"]),
    "M04": ("Arena", ["M02", "M03", "M14"]),
    "M05": ("Arena", ["M02", "M04", "M15"]), "M06": ("Arena", ["M05"]),
    "M07": ("Arena separate pass", ["M06"]), "M08": ("Arena", ["M07"]),
    "M09": ("Z.ai", ["M00"]), "M10": ("Z.ai", ["M08", "M09"]),
    "M11": ("Z.ai / independent reviewer", ["M02", "M10"]),
    "M12": ("Arena", ["M05", "M10", "M11"]), "M13": ("Z.ai", ["M00"]),
}
TOP_KEYS = frozenset({"schema", "overall", "input_status", "source_status", "evidence_gate", "runner",
                      "authority", "input_sha256", "bots", "dispatch_count", "note", "safe_batch"})
BOT_KEYS = frozenset({"work_id", "bot_id", "name", "owner", "stage", "depends_on", "proposed_output",
                      "state", "reason_code", "dispatch"})
SAFE_BATCH_KEYS = frozenset({"execution_mode", "executed", "input_sha256", "queue_rows", "yellow_pages",
                             "proposed_pages", "proposed_families", "synthetic_drafts", "book_evidence_verified",
                             "runtime_tested", "workbook_changed", "promotions", "status"})


def assess(snapshot: dict) -> dict:
    errors: list[str] = []
    if not isinstance(snapshot, dict):
        return {"status": "FAIL_PROTOCOL", "readiness": "NOT_READY", "violations": ["SNAPSHOT_NOT_OBJECT"]}
    if set(snapshot) - TOP_KEYS:
        errors.append("UNKNOWN_TOP_LEVEL_FIELDS")
    if snapshot.get("schema") != SCHEMA or snapshot.get("authority") != AUTHORITY:
        errors.append("SCHEMA_OR_AUTHORITY_DRIFT")
    if snapshot.get("overall") != "NOT_READY" or snapshot.get("runner") != "NOT_DEPLOYED":
        errors.append("FALSE_READINESS_OR_DEPLOYMENT")
    if type(snapshot.get("dispatch_count")) is not int or snapshot["dispatch_count"] != 0:
        errors.append("DISPATCH_NOT_AUTHORIZED")
    if snapshot.get("input_status") != "PASS_INPUTS_ONLY" or snapshot.get("input_sha256") != EXPECTED:
        errors.append("INPUTS_NOT_PINNED")
    source = snapshot.get("source_status")
    if not isinstance(source, str) or source not in {"BLOCKED_SOURCE_UNAVAILABLE", "BLOCKED_SOURCE_INSIDE_REPO",
                                                   "HOLD_SOURCE_SHA_MISMATCH", "SOURCE_SHA_VERIFIED_OFFSET_NOT_YET_VERIFIED"}:
        errors.append("UNKNOWN_SOURCE_STATUS")
    expected_gate = ("SOURCE_BYTES_ONLY_OFFSET_AND_VISUAL_UNVERIFIED" if isinstance(source, str)
                     and source.startswith("SOURCE_SHA_VERIFIED") else "BLOCKED_SOURCE_EVIDENCE")
    if snapshot.get("evidence_gate") != expected_gate:
        errors.append("SOURCE_BYTES_MISREPRESENTED_AS_VISUAL_EVIDENCE")
    bots = snapshot.get("bots")
    if not isinstance(bots, list) or len(bots) != len(BOT_IDS):
        errors.append("BOT_SET_INCOMPLETE")
    else:
        seen: set[str] = set()
        for bot in bots:
            if not isinstance(bot, dict) or set(bot) != BOT_KEYS:
                errors.append("BOT_RECORD_SCHEMA_INVALID")
                continue
            ident = bot["bot_id"]
            if not isinstance(ident, str) or ident not in BOT_IDS or ident in seen:
                errors.append("BOT_ID_UNKNOWN_OR_DUPLICATE")
                continue
            deps = bot["depends_on"]
            if not isinstance(deps, list) or any(not isinstance(d, str) or d not in seen for d in deps):
                errors.append("BOT_DEPENDENCY_UNRESOLVED")
            if bot["owner"] != BOT_CONTRACT[ident][0] or deps != BOT_CONTRACT[ident][1]:
                errors.append("BOT_OWNER_OR_DEPENDENCY_DRIFT")
            seen.add(ident)
            key = f"C205|{EXPECTED['candidate']}|{EXPECTED['official']}|{ident}|microbot-v1"
            if bot["work_id"] != "G2-" + ident + "-" + hashlib.sha256(key.encode()).hexdigest()[:12]:
                errors.append("WORK_ID_DRIFT")
            if bot["dispatch"] != "DISABLED_DESIGN_ONLY":
                errors.append("BOT_DISPATCH_NOT_AUTHORIZED")
            if ident in SAFE:
                wanted = "READY_FOR_MANUAL_ONE_SHOT"
            elif ident in BLOCKED:
                wanted = "BLOCKED"
            elif ident == "M13":
                wanted = "NOT_DEPLOYED"
            elif ident == "M09":
                wanted = "HANDOFF_TO_ZAI"
            else:
                wanted = ("READY_FOR_OFFSET_AND_VISUAL_CHECK" if isinstance(source, str)
                          and source.startswith("SOURCE_SHA_VERIFIED") else "BLOCKED")
            if bot["state"] != wanted:
                errors.append(f"UNSUPPORTED_STATE_{ident}")
        if seen != BOT_IDS:
            errors.append("BOT_SET_MISMATCH")
    batch = snapshot.get("safe_batch")
    if batch is not None:
        if not isinstance(batch, dict) or set(batch) != SAFE_BATCH_KEYS:
            errors.append("SAFE_BATCH_SCHEMA_INVALID")
        else:
            if (batch["execution_mode"] != "ONE_SHOT_IN_MEMORY_NOT_DEPLOYED"
                or batch["executed"] != ["M00", "M03", "M14", "M15", "M16"]
                or batch["status"] != "PROVISIONAL_ONLY" or batch["input_sha256"] != EXPECTED
                or any(batch[k] is not False for k in ("book_evidence_verified", "runtime_tested", "workbook_changed"))
                or type(batch["promotions"]) is not int or batch["promotions"] != 0):
                errors.append("SAFE_BATCH_PROMOTION_OR_FALSE_EXECUTION")
            if any(type(batch[k]) is not int or batch[k] != v for k, v in
                   (("queue_rows", 108), ("yellow_pages", 144), ("proposed_pages", 54),
                    ("proposed_families", 23), ("synthetic_drafts", 32))):
                errors.append("SAFE_BATCH_COUNTS_DRIFT")
    return {"status": "FAIL_PROTOCOL" if errors else "PASS_PROTOCOL_LOCAL_PILOT",
            "readiness": "NOT_READY", "violations": sorted(set(errors)),
            "scope": "CONTENT_LANE_SNAPSHOT_ONLY_NOT_SERVER_AUTHORIZATION"}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True)
    args = p.parse_args()
    try:
        verdict = assess(json.loads(args.input.read_text(encoding="utf-8")))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        verdict = {"status": "FAIL_PROTOCOL", "readiness": "NOT_READY", "violations": ["INPUT_UNREADABLE: " + str(exc)]}
    print(json.dumps(verdict, ensure_ascii=False, indent=2))
    return 0 if verdict["status"] == "PASS_PROTOCOL_LOCAL_PILOT" else 1


if __name__ == "__main__":
    sys.exit(main())
