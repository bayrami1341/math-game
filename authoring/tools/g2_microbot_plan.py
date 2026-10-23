"""Read-only G2 microbot DAG preview. Never dispatches, stamps, merges or publishes.

Usage (openpyxl 3.1.5 and origin/v10.3-beta required):
  python authoring/tools/g2_microbot_plan.py --output /tmp/g2-microbots.json --run-safe
The output MUST be outside the repository. Only metadata/provisional checks run;
no tasks are dispatched and this is neither a queue nor a resident worker.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from audit_g2_completion import inventory
from g2_night_preflight import EXPECTED, ROOT, inspect

# Small independently testable units; ownership of engine/infrastructure stays with Z.ai.
# Readiness here means a task can be *planned*, not that a bot ran or passed a gate.
BOTS = (
    ("M00", "input-integrity", "Arena", (), "G0", "read-only SHA/official/ref check"),
    ("M01", "source-custodian", "Z.ai", ("M00",), "G1", "licensed vault mount and real PDF-byte attestation"),
    ("M02", "page-observer-achilles", "Z.ai code / Arena acceptance", ("M01",), "G1-G2", "region/number/figure observations with source-bound evidence"),
    ("M03", "discrepancy-triager", "Arena", ("M00",), "G2", "rank 108 candidate/page-map conflicts without inventing evidence"),
    ("M14", "metadata-inventory", "Arena", ("M00",), "G3", "inventory 144 yellow pages and chapter counts as hypotheses"),
    ("M15", "variant-hypothesis", "Arena", ("M14",), "G4", "provisional families with explicit source/runtime unknowns"),
    ("M16", "sandbox-key-checker", "Arena", ("M15",), "G5-G6", "test synthetic arithmetic drafts separately from book evidence"),
    ("M04", "breadth-mapper", "Arena", ("M02", "M03", "M14"), "G3", "book claim to skill to playable-experience gaps"),
    ("M05", "variant-cartographer", "Arena", ("M02", "M04", "M15"), "G4", "skill by book exercise family, representation and boundary"),
    ("M06", "yellow-draft-designer", "Arena", ("M05",), "G5", "draft-only games/questions with provenance; no Q-ID or seal"),
    ("M07", "independent-key-checker", "Arena separate pass", ("M06",), "G6", "independent arithmetic/key/distractor and anti-J12 checks"),
    ("M08", "cartridge-diff-guard", "Arena", ("M07",), "G6", "keyed L/Q/E and styles/stamps diff before yellow workbook"),
    ("M09", "capability-contract", "Z.ai", ("M00",), "G7", "versioned engine capability/schema for every proposed game"),
    ("M10", "converter-interaction-probe", "Z.ai", ("M08", "M09"), "G7", "same-SHA converter plus playable RTL interaction tests"),
    ("M11", "second-witness-auditor", "Z.ai / independent reviewer", ("M02", "M10"), "G6-G7", "independent source/figure and game audit"),
    ("M12", "owner-decision-packet", "Arena", ("M05", "M10", "M11"), "G8", "scoped human decisions, NOT release"),
    ("M13", "queue-foreman", "Z.ai", ("M00",), "operations", "persistent leases/retries/checkpoints/alerts; not a chat job"),
)


def plan(preflight: dict, content: dict) -> dict:
    hashes = preflight.get("sha256")
    consistent = (
        preflight.get("status") == "PASS_INPUTS_ONLY"
        and hashes == content.get("hashes") == EXPECTED
        and preflight.get("queue_rows") == content.get("review_queue_total") == 108
        and content.get("s1_yellow_page_rows") == 144
        and content.get("q_total") == 104 and content.get("q_green") == 0
        and isinstance(content.get("chapter_summary"), list)
        and len(content["chapter_summary"]) == 8
    )
    # The sha-only source preflight deliberately cannot unblock page evidence.
    source = preflight.get("source_status", "BLOCKED_SOURCE_UNAVAILABLE")
    if not consistent:
        category = "BLOCKED_INPUT_DRIFT"
    elif source.startswith("SOURCE_SHA_VERIFIED"):
        category = "SOURCE_BYTES_ONLY_OFFSET_AND_VISUAL_UNVERIFIED"
    else:
        category = "BLOCKED_SOURCE_EVIDENCE"

    ids = {bot[0] for bot in BOTS}
    if len(ids) != len(BOTS):
        raise ValueError("INVALID_BOT_DAG_DUPLICATE_ID")
    # A dependency must occur earlier: ensures both existence and acyclicity.
    seen: set[str] = set()
    for bot_id, _, _, deps, _, _ in BOTS:
        if any(dep not in seen for dep in deps):
            raise ValueError("INVALID_BOT_DAG_ORDER_OR_CYCLE")
        seen.add(bot_id)
    rows = []
    for bot_id, name, owner, deps, stage, product in BOTS:
        if not consistent:
            state, reason = "BLOCKED", "INPUT_DRIFT_OR_UNTRUSTED_INVENTORY"
        elif bot_id in {"M00", "M03", "M14", "M15", "M16"}:
            state, reason = "READY_FOR_MANUAL_ONE_SHOT", "PROVISIONAL_ONLY_NOT_PAGE_EVIDENCE_OR_RUNTIME"
        elif bot_id == "M01":
            state, reason = ("READY_FOR_OFFSET_AND_VISUAL_CHECK", "BYTE_SHA_ONLY") if source.startswith("SOURCE_SHA_VERIFIED") else ("BLOCKED", "SOURCE_PDF_UNAVAILABLE_OR_UNVERIFIED")
        elif bot_id == "M13":
            state, reason = "NOT_DEPLOYED", "ZAI_PERSISTENT_RUNNER_REQUIRED"
        elif bot_id == "M09":
            state, reason = "HANDOFF_TO_ZAI", "CAPABILITY_CONTRACT_CAN_BE_DESIGNED_WITHOUT_BOOK_EVIDENCE"
        else:
            state, reason = "BLOCKED", "NO_ACCEPTED_SOURCE_BOUND_PAGE_EVIDENCE"
        seed = f"C205|{hashes.get('candidate') if isinstance(hashes, dict) else 'unknown'}|{hashes.get('official') if isinstance(hashes, dict) else 'unknown'}|{bot_id}|microbot-v1"
        rows.append({
            "work_id": "G2-" + bot_id + "-" + hashlib.sha256(seed.encode()).hexdigest()[:12],
            "bot_id": bot_id, "name": name, "owner": owner, "stage": stage,
            "depends_on": list(deps), "proposed_output": product,
            "state": state, "reason_code": reason,
            "dispatch": "DISABLED_DESIGN_ONLY",
        })
    return {
        "schema": "G2_MICROBOT_PLAN_v1", "overall": "NOT_READY",
        "input_status": preflight.get("status", "UNKNOWN"), "source_status": source,
        "evidence_gate": category, "runner": "NOT_DEPLOYED",
        "authority": "TECHNICAL_PLANNING_ONLY_NO_TEACHER_SEAL_MERGE_OR_RELEASE",
        "input_sha256": hashes if isinstance(hashes, dict) else {},
        "bots": rows, "dispatch_count": 0,
        "note": "This generates a deterministic DAG preview only; no bot is scheduled or executed.",
    }


def run_safe_batch(preflight: dict, content: dict, report: dict) -> dict:
    """Actually rerun metadata/provisional checks in memory; no workbook/PDF writes."""
    if report["input_status"] != "PASS_INPUTS_ONLY" or report["evidence_gate"] == "BLOCKED_INPUT_DRIFT":
        raise ValueError("BLOCKED_INPUT_DRIFT")
    from build_g2_variant_backlog import build
    from draft_g2_ch6_arithmetic import generate

    proposal_rows, baseline = build()
    drafts = generate()
    if baseline.get("hashes") != content["hashes"] or len(proposal_rows) != 54:
        raise ValueError("PROVISIONAL_BACKLOG_DRIFT")
    if len({row["proposal_family"] for row in proposal_rows}) != 23:
        raise ValueError("VARIANT_FAMILIES_DRIFT")
    if len(drafts) != 32 or len({d["draft_id"] for d in drafts}) != 32 or any(
        d["q_id"] is not None or d["teacher_verdict"] != "NOT_GRANTED"
        or d["book_page_evidence_id"] is not None or d["runtime_compatibility"] != "NOT_TESTED"
        for d in drafts
    ):
        raise ValueError("UNSAFE_DRAFT_METADATA")
    return {"execution_mode": "ONE_SHOT_IN_MEMORY_NOT_DEPLOYED", "executed": ["M00", "M03", "M14", "M15", "M16"],
            "input_sha256": preflight["sha256"], "queue_rows": preflight["queue_rows"],
            "yellow_pages": content["s1_yellow_page_rows"], "proposed_pages": len(proposal_rows),
            "proposed_families": 23, "synthetic_drafts": len(drafts),
            "book_evidence_verified": False, "runtime_tested": False,
            "workbook_changed": False, "promotions": 0, "status": "PROVISIONAL_ONLY"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--run-safe", action="store_true", help="Rerun only metadata and synthetic checks in memory")
    args = parser.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error("Output must stay outside repository; use /tmp or protected external storage")
    try:
        preflight, content = inspect(), inventory()
        result = plan(preflight, content)
        if args.run_safe:
            result["safe_batch"] = run_safe_batch(preflight, content, result)
        from g2_microbot_protocol_gate import assess
        verdict = assess(result)
        if verdict["status"] != "PASS_PROTOCOL_LOCAL_PILOT":
            print(json.dumps(verdict, ensure_ascii=False), file=sys.stderr)
            return 2
    except (OSError, ValueError, KeyError, TypeError, RuntimeError) as exc:
        print(f"BLOCKED_INTEGRITY: {exc}", file=sys.stderr)
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"overall": result["overall"], "evidence_gate": result["evidence_gate"],
                      "bots": len(result["bots"]), "dispatch_count": result["dispatch_count"],
                      "safe_batch": result.get("safe_batch", {}).get("status", "NOT_RUN")}, ensure_ascii=False))
    return 0 if result["input_status"] == "PASS_INPUTS_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
