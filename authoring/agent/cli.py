"""Unified CLI for the C205 Cartridge Authoring, Verification & Governance Pipeline (`P0`..`P6`)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .git_guard import audit_git_copyright_safety
from .governance import (
    GovernanceLedger,
    build_and_save_wave_manifest,
    evaluate_release_readiness,
)
from .models import file_sha256
from .validators import inspect_cartridge_workbook

RUNTIME_CODES = {
    "E_ADD_CONFUSION",
    "E_ZERO_CONFUSION",
    "E_ONE_CONFUSION",
    "E_PLACE_SWAP",
    "E_ZERO_PLACE_MISS",
    "E_DOUBLE_OFF",
    "E_SKIP_UNDERCOUNT",
    "E_CARRY_FORGOT",
    "E_CARRY_WRONG_PLACE",
    "E_UNEQUAL_GROUP",
    "E_GUESS_FAST",
    "E_FATIGUE_DROP",
}


def run_full_audit(repo_root: Path, write_manifest: bool = True) -> dict:
    g0 = audit_git_copyright_safety(repo_root)
    obs = json.loads((repo_root / "authoring/audit/observation_C205.json").read_text(encoding="utf-8"))
    iq = json.loads((repo_root / "authoring/audit/issue_queue_C205.json").read_text(encoding="utf-8"))
    open_issues = sum(1 for item in iq.get("issues", []) if item.get("status") != "RESOLVED")

    p4_gates = inspect_cartridge_workbook(
        repo_root / "authoring/khshab-G2-MATH_v0.5.xlsx",
        repo_root / "authoring/audit/observation_C205.json",
        RUNTIME_CODES,
        strict_diagnostic_quality=False,
        new_wave_start_qid="Q-1069",
    )

    pagemap_path = repo_root / "authoring/PAGE-MAP-KH-G2-MATH-v1_audited.xlsx"
    v04_path = repo_root / "authoring/khshab-G2-MATH_v0.4.xlsx"
    v05_path = repo_root / "authoring/khshab-G2-MATH_v0.5.xlsx"
    json_v05_path = repo_root / "data/cartridges/KH-G2-MATH-v0.5-preview.json"

    ledger = GovernanceLedger(repo_root / "authoring/audit/verdicts_C205.json")
    ledger.save()

    upstream_gates = {"G0_COPYRIGHT_GUARD": g0, **p4_gates}
    g7, pending = evaluate_release_readiness(
        ledger=ledger,
        pagemap_sha256=file_sha256(str(pagemap_path)),
        workbook_path=v05_path,
        workbook_sha256=file_sha256(str(v05_path)),
        upstream_gates=upstream_gates,
        open_issue_count=open_issues,
    )

    all_gates = [g0, *p4_gates.values(), g7]
    if write_manifest:
        build_and_save_wave_manifest(
            out_path=repo_root / "authoring/waves/wave_manifest_v0.5.json",
            manifest_id="WAVE-KH-G2-MATH-v0.5-CH4-PILOT",
            wave_id="wave-4-pilot-chapter-4",
            book_manifest_path=repo_root / "authoring/data/book_manifest_C205.json",
            snapshot_path=repo_root / "authoring/snapshots/master-map-C205-v2.0/snapshot.json",
            pagemap_xlsx_path=pagemap_path,
            base_cartridge_path=v04_path,
            output_cartridge_path=v05_path,
            converted_json_path=json_v05_path,
            gates=all_gates,
            ledger=ledger,
            releasable=(g7.status == "PASS"),
            blocker_reasons=g7.metrics["blocker_reasons"],
        )

    return {
        "observation_summary": obs.get("summary", {}),
        "open_issue_count": open_issues,
        "gates": {g.gate_id: {"status": g.status, "reason_code": g.reason_code, "metrics": g.metrics} for g in all_gates},
        "pending_teacher_review": {
            "s1_count": len(pending["pending_s1_ids"]),
            "question_count": len(pending["pending_question_ids"]),
            "error_codes": pending["pending_error_codes"],
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="KH-G2-MATH Authoring & Verification Pipeline CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_audit = sub.add_parser("audit", help="Run all repository safety, mathematical, causal, and governance gates")
    p_audit.add_argument("--repo-root", default=".")

    p_verdict = sub.add_parser("record-verdict", help="Record an explicit human teacher governance verdict")
    p_verdict.add_argument("--repo-root", default=".")
    p_verdict.add_argument("--verdict-id", required=True)
    p_verdict.add_argument("--scope", required=True)
    p_verdict.add_argument("--actor", required=True)
    p_verdict.add_argument("--actor-role", default="human_teacher")
    p_verdict.add_argument("--target-ids", nargs="+", required=True)
    p_verdict.add_argument("--target-file", required=True)
    p_verdict.add_argument("--notes", default="")

    args = parser.parse_args(argv)
    root = Path(args.repo_root).resolve()

    if args.cmd == "audit":
        report = run_full_audit(root, write_manifest=True)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "record-verdict":
        ledger = GovernanceLedger(root / "authoring/audit/verdicts_C205.json")
        target_sha = file_sha256(str((root / args.target_file).resolve()))
        v = ledger.record_verdict(
            verdict_id=args.verdict_id,
            scope=args.scope,
            actor=args.actor,
            actor_role=args.actor_role,
            target_ids=args.target_ids,
            target_sha256=target_sha,
            notes=args.notes,
        )
        ledger.save()
        print(json.dumps({"recorded": v.verdict_id, "scope": v.scope, "target_sha256": v.target_sha256}, ensure_ascii=False))
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
