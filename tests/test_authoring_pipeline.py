"""Adversarial & End-to-End Verification Suite for the Khshab Authoring Pipeline (`P0`..`P6`, `B1`..`B4`).

Synced against official `origin/v10.3-beta` (`f36533b9d7dc3de320a532cb271e029affc7694d`).
All canonical paths come from `tests/conftest.py` (`public/math-game/authoring/` first, `authoring/agent/fixtures/` portable fixtures).
Confidential textbook PDFs are never committed to Git (§9) and skip explicitly with `pytest.skip(reason=...)` when absent in clean CI.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from copy import copy
from pathlib import Path
from typing import Dict

import openpyxl
import pytest

from authoring.agent.automation_suite import (
    audit_historical_incidents_16,
    count_visual_components,
    derive_wave_scope_from_diff,
    diff_workbooks_by_key,
    plan_and_verify_pdf_chunks,
    run_converter_and_parse_report,
    verify_bidirectional_anchors,
    verify_cpa_and_answer_balance,
    verify_official_stamps,
    verify_wave_whitelist,
)
from authoring.agent.cli import run_generic_wave_check
from authoring.agent.excel_exporter import (
    export_non_destructive_pagemap,
    export_pilot_cartridge_v05,
)
from authoring.agent.git_guard import audit_git_copyright_safety, check_ownership_boundary
from authoring.agent.governance import (
    GovernanceLedger,
    GovernanceViolationError,
    evaluate_release_readiness,
)
from authoring.agent.id_allocator import IDAllocator, ImmutableIDViolationError
from authoring.agent.observation import observe_pdf
from authoring.agent.reconcile import (
    check_live_dual_model_availability,
    reconcile_pagemap_and_observations,
)
from authoring.agent.validators import inspect_cartridge_workbook

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


# ---------------------------------------------------------------------------
# Stage P0, Section-9 Ownership & B1 Converter SSOT Guard Tests
# ---------------------------------------------------------------------------


def test_g0_copyright_guard_clean_on_active_repo(repo_root: Path):
    res = audit_git_copyright_safety(repo_root)
    assert res.status == "PASS", res.issues
    assert res.reason_code == "CLEAN_WORKSPACE"


def test_g0_copyright_guard_blocks_leaked_pdf_or_crop(repo_root: Path, tmp_path: Path):
    import subprocess

    subprocess.run(["git", "init", str(tmp_path)], check=True, capture_output=True)
    shutil.copyfile(repo_root / ".gitignore", tmp_path / ".gitignore")
    (tmp_path / "crop_leak.png").write_bytes(b"\x89PNG\r\n\x1a\nfake")
    subprocess.run(["git", "-C", str(tmp_path), "add", "-f", "crop_leak.png"], check=True, capture_output=True)
    res = audit_git_copyright_safety(tmp_path)
    assert res.status == "FAIL"
    assert res.reason_code == "COPYRIGHT_LEAK_BLOCKED"


def test_section9_ownership_boundary_zero_software_mutations(repo_root: Path):
    res = check_ownership_boundary(repo_root)
    assert res.status == "PASS", f"Section 9 boundary violated: {res.issues}"


def test_b1_no_converter_mirror_and_ssot_guard(repo_root: Path, fixture_paths: Dict[str, Path], tmp_path: Path):
    """B1: `zai_converter_mirror` must NOT exist, and missing SSOT files must return `MISSING_CONVERTER_SSOT`."""
    mirror_dir = repo_root / "authoring/agent/zai_converter_mirror"
    assert not mirror_dir.exists(), f"Parallel converter mirror is forbidden (§9 / B1): {mirror_dir}"

    blocked = run_converter_and_parse_report(fixture_paths["v05_candidate"], tmp_path)
    assert blocked["status"] == "BLOCKED"
    assert blocked["reason_code"] == "MISSING_CONVERTER_SSOT"
    assert "convert.mjs" in blocked["reason_detail"]


# ---------------------------------------------------------------------------
# Stage P1 Observation Honesty & Ghost-Layer Tests
# ---------------------------------------------------------------------------


def test_p1_missing_pdf_yields_honest_blocked_gate(fixture_paths: Dict[str, Path], tmp_path: Path):
    gate, ledger = observe_pdf(
        fixture_paths["book_manifest_c205"],
        tmp_path / "nonexistent.pdf",
        tmp_path / "vault",
    )
    assert gate.status == "BLOCKED"
    assert gate.reason_code == "SOURCE_PDF_MISSING"
    assert ledger == {}


def test_p1_wrong_edition_sha256_yields_blocked_gate(fixture_paths: Dict[str, Path], tmp_path: Path):
    fake_pdf = tmp_path / "wrong_edition.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4\nwrong textbook bytes\n%%EOF\n")
    gate, ledger = observe_pdf(
        fixture_paths["book_manifest_c205"],
        fake_pdf,
        tmp_path / "vault",
    )
    assert gate.status == "FAIL"
    assert gate.reason_code == "EDITION_SHA_MISMATCH"
    assert ledger == {}


def test_p1_pdf47_occluded_pasteboard_ghost_filtered_in_real_ledger(fixture_paths: Dict[str, Path]):
    obs = json.loads(fixture_paths["observation_c205"].read_text(encoding="utf-8"))
    qs = obs["quality_scores"]
    matches = [q for q in qs if q["footer_alignment_status"] == "MATCH"]
    mismatches = [q for q in qs if q["footer_alignment_status"] == "MISMATCH"]
    assert len(matches) == 136
    assert len(mismatches) == 0
    p47 = qs[46]  # 0-based index 46 == PDF page 47 (Book page 41)
    assert p47["pdf_page"] == 47
    assert p47["extracted_footer_book_page"] == 41
    assert p47["footer_alignment_status"] == "MATCH"
    assert "OCCLUDED_GHOST_TEXT_UNDER_FOOTER" in p47["hazards"]


# ---------------------------------------------------------------------------
# Stage P2 Dual-Reading & Non-Promotion of Unverified Agreement Tests
# ---------------------------------------------------------------------------


def test_p2_two_model_agreement_never_becomes_approved_or_verified(repo_root: Path, fixture_paths: Dict[str, Path]):
    live_gate = check_live_dual_model_availability()
    assert live_gate.status == "BLOCKED"

    raw_pm = repo_root / "authoring/PAGE-MAP-KH-G2-MATH-v1.xlsx"
    rec_gate, snap, iq, decs = reconcile_pagemap_and_observations(
        verified_xlsx_path=fixture_paths["pagemap_g2_verified"],
        observation_json_path=fixture_paths["observation_c205"],
        raw_v1_xlsx_path=raw_pm if raw_pm.exists() else None,
    )
    assert rec_gate.status == "PASS"
    assert snap["status_counts"]["TEACHER_APPROVED"] == 0
    assert snap["status_counts"]["AGREED_UNVERIFIED"] == 122
    assert iq["total_issues"] == 29
    assert decs["total_decisions"] == 14


# ---------------------------------------------------------------------------
# Stage P3 Non-Destructive Exporters, Column Contract & ID Allocator Tests
# ---------------------------------------------------------------------------


def test_p3_pagemap_export_preserves_13_columns_and_is_bit_idempotent(fixture_paths: Dict[str, Path], tmp_path: Path):
    out1 = tmp_path / "pm1.xlsx"
    out2 = tmp_path / "pm2.xlsx"
    g1, sha1, _ = export_non_destructive_pagemap(
        fixture_paths["pagemap_g2_verified"],
        fixture_paths["decisions_c205"],
        fixture_paths["issue_queue_c205"],
        out1,
    )
    g2, sha2, _ = export_non_destructive_pagemap(
        fixture_paths["pagemap_g2_verified"],
        fixture_paths["decisions_c205"],
        fixture_paths["issue_queue_c205"],
        out2,
    )
    assert g1.status == "PASS" and g2.status == "PASS"
    assert sha1 == sha2
    assert g1.metrics["base_col_diffs"] == 0
    assert g1.metrics["unscheduled_audit_diffs"] == 0


def test_p3_pagemap_rejects_broken_input_with_extra_column(fixture_paths: Dict[str, Path], tmp_path: Path):
    bad_in = tmp_path / "bad_pagemap.xlsx"
    wb = openpyxl.load_workbook(fixture_paths["pagemap_g2_verified"])
    wb["نقشهٔ صفحه‌ها"].cell(2, 17, "ستون هفدهم غیرمجاز")
    wb.save(bad_in)
    gate, sha, _ = export_non_destructive_pagemap(
        bad_in,
        fixture_paths["decisions_c205"],
        fixture_paths["issue_queue_c205"],
        tmp_path / "out.xlsx",
    )
    assert gate.status == "FAIL"
    assert gate.reason_code == "PAGEMAP_COLUMN_CONTRACT_VIOLATION"
    assert sha == ""


def test_p3_retired_id_cannot_ever_be_recycled(fixture_paths: Dict[str, Path]):
    reg = json.loads(fixture_paths["id_registry"].read_text(encoding="utf-8"))
    alloc = IDAllocator(reg)
    alloc.retire("Q", "Q-1092", "retired_due_to_teacher_rejection")
    with pytest.raises(ImmutableIDViolationError, match="permanently sealed and cannot be recycled"):
        alloc.allocate_explicit("Q", "Q-1092", "brand_new_question")
    nxt = alloc.next_question_id("fresh_question_after_retirement")
    assert nxt == "Q-1093"


def test_p3_cartridge_v05_zero_legacy_diff_and_bit_idempotency(fixture_paths: Dict[str, Path], tmp_path: Path):
    hist = [fixture_paths["v04_raw_buggy"]]
    g1, sha1, _ = export_pilot_cartridge_v05(
        fixture_paths["v04_raw_buggy"],
        tmp_path / "v05_a.xlsx",
        tmp_path / "reg_a.json",
        tmp_path / "patch_a.json",
        hist,
        sorted(RUNTIME_CODES),
    )
    g2, sha2, _ = export_pilot_cartridge_v05(
        fixture_paths["v04_raw_buggy"],
        tmp_path / "v05_b.xlsx",
        tmp_path / "reg_b.json",
        tmp_path / "patch_b.json",
        hist,
        sorted(RUNTIME_CODES),
    )
    assert g1.status == "PASS" and g2.status == "PASS"
    assert sha1 == sha2
    assert g1.metrics["legacy_cell_diffs"] == 0
    assert g1.metrics["sentinel_merges_intact"] is True
    assert g1.metrics["added_s1_rows"] == 18
    assert g1.metrics["added_questions"] == 24


# ---------------------------------------------------------------------------
# Stage P4 Clean Baseline + ALL Adversarial Mutation Tests (M1..M7)
# ---------------------------------------------------------------------------


def _copy_clean_v05(fixture_paths: Dict[str, Path], tmp_path: Path) -> Path:
    dst = tmp_path / "mutated.xlsx"
    shutil.copyfile(fixture_paths["v05_candidate"], dst)
    return dst


def test_p4_baseline_v05_passes_all_four_independent_gates(fixture_paths: Dict[str, Path]):
    res = inspect_cartridge_workbook(
        fixture_paths["v05_candidate"],
        fixture_paths["observation_c205"],
        RUNTIME_CODES,
        base_workbook_path=fixture_paths["v04_official"],
    )
    for gid, gate in res.items():
        assert gate.status == "PASS", f"{gid} failed: {gate}"


def test_p4_mutation_m1_corrupt_digit_in_correct_option_fails_solver(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 7, "۷")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES, base_workbook_path=fixture_paths["v04_official"])
    assert res["G4_INDEPENDENT_SOLVER"].status == "FAIL"
    assert res["G4_INDEPENDENT_SOLVER"].reason_code == "ANSWER_KEY_MISMATCH"


def test_p4_mutation_m2_wrong_answer_key_letter_fails_both_j12_and_solver(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(73, 11, "الف")
    wb["بانک سؤال"].cell(73, 12, "ب→E_ZERO_PLACE_MISS؛ ج→E_UNIT_VALUE_CONFUSION؛ د→E_SUB_CONFUSION")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES, base_workbook_path=fixture_paths["v04_official"])
    assert res["G3_ANTI_J12"].status == "PASS"
    assert res["G4_INDEPENDENT_SOLVER"].status == "FAIL"
    assert res["G4_INDEPENDENT_SOLVER"].reason_code == "ANSWER_KEY_MISMATCH"


def test_p4_mutation_m3_false_distractor_mechanism_fails_causality(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 12, "الف→E_UNIT_VALUE_CONFUSION؛ ج→E_ZERO_PLACE_MISS؛ د→E_BORROW_MISS")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES, base_workbook_path=fixture_paths["v04_official"])
    assert res["G4_INDEPENDENT_SOLVER"].status == "PASS"
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"
    assert res["G5_DISTRACTOR_CAUSALITY"].reason_code == "MECHANISM_MISMATCH"


def test_p4_mutation_m3b_collapsed_identical_codes_fails_causality(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(93, 10, "۳۹۰")
    wb["بانک سؤال"].cell(93, 12, "ب→E_ROUND_NEAREST؛ ج→E_ROUND_NEAREST؛ د→E_ROUND_NEAREST")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES, base_workbook_path=fixture_paths["v04_official"])
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"


def test_p4_mutation_m4_ascii_digit_in_persian_stem_fails_anti_j12(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 5, "حانیه 60 سکّهٔ ۱ ریالی دارد. او چند سکّهٔ ۱۰ ریالی می‌گیرد؟")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES)
    assert res["G3_ANTI_J12"].status == "FAIL"
    assert res["G3_ANTI_J12"].reason_code == "LATIN_DIGIT_IN_PERSIAN_FIELD"


def test_p4_mutation_m4b_persian_digit_in_latin_trace_fails_anti_j12(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 17, "ضد J12 — کار دفترچه‌ای (لاتین): ۶۰ // ۱۰ = ۶؛ پاسخ جدا حساب شد.")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES)
    assert res["G3_ANTI_J12"].status == "FAIL"
    assert "PERSIAN_DIGIT_IN_LATIN_TRACE" in res["G3_ANTI_J12"].reason_code


def test_p4_mutation_m5_stem_edited_without_updating_note_fails_solver(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 5, "حانیه ۸۰ سکّهٔ ۱ ریالی دارد. اگر همهٔ آن‌ها را با سکّه‌های ۱۰ ریالی عوض کند، چند سکّهٔ ۱۰ ریالی می‌گیرد؟")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES)
    assert res["G4_INDEPENDENT_SOLVER"].status == "FAIL"
    assert res["G4_INDEPENDENT_SOLVER"].reason_code == "STEM_TRACE_MISMATCH"


def test_p4_mutation_m6_page_offset_mismatch_in_s1_fails_structure(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    s1 = wb["نقشهٔ کتاب (S1)"]
    r_l401 = next(r for r in range(3, s1.max_row + 1) if s1.cell(r, 1).value == "L-401")
    s1.cell(r_l401, 2, "۵۶")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES)
    assert res["G6_WORKBOOK_STRUCTURE"].status == "FAIL"
    assert "PAGE_OFFSET_MISMATCH" in res["G6_WORKBOOK_STRUCTURE"].reason_code


def test_p4_mutation_m7_broken_sentinel_merge_or_post_sentinel_row_fails(fixture_paths: Dict[str, Path], tmp_path: Path):
    mut = _copy_clean_v05(fixture_paths, tmp_path)
    wb = openpyxl.load_workbook(mut)
    ws = wb["بانک سؤال"]
    ws.unmerge_cells(f"A{ws.max_row}:Q{ws.max_row}")
    ws.cell(ws.max_row + 1, 1, "Q-9999")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, fixture_paths["observation_c205"], RUNTIME_CODES)
    assert res["G6_WORKBOOK_STRUCTURE"].status == "FAIL"


def test_p4_pedagogy_tie_rule_q1067_blocked_without_crop_evidence(fixture_paths: Dict[str, Path], tmp_path: Path):
    stripped_obs = tmp_path / "obs_without_p39.json"
    stripped_obs.write_text(json.dumps({"evidence_ledger": {}}), encoding="utf-8")

    res = inspect_cartridge_workbook(
        fixture_paths["v05_candidate"],
        stripped_obs,
        RUNTIME_CODES,
    )
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"
    assert res["G5_DISTRACTOR_CAUSALITY"].reason_code == "PEDAGOGY_BLOCKED"


def test_p4_strict_audit_catches_real_v04_diagnostic_bugs(fixture_paths: Dict[str, Path]):
    res = inspect_cartridge_workbook(
        fixture_paths["v04_raw_buggy"],
        fixture_paths["observation_c205"],
        RUNTIME_CODES,
        strict_diagnostic_quality=True,
        new_wave_start_qid="Q-1001",
    )
    assert res["G6_WORKBOOK_STRUCTURE"].status == "FAIL"
    assert "T7_ANCHOR_BACKLINK_MISMATCH:L-110" in res["G6_WORKBOOK_STRUCTURE"].reason_code
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"
    flagged_qids = {i.get("qid") for i in res["G5_DISTRACTOR_CAUSALITY"].issues}
    for bug_qid in ("Q-1056", "Q-1062", "Q-1065", "Q-1066", "Q-1067", "Q-1068"):
        assert bug_qid in flagged_qids, f"Expected {bug_qid} to be caught!"


# ---------------------------------------------------------------------------
# Stage P6 Teacher Verdict & Upstream SHA-256 Invalidation Tests
# ---------------------------------------------------------------------------


def test_p6_ai_cannot_forge_teacher_approval_and_sha_mutation_invalidates_verdicts(fixture_paths: Dict[str, Path], tmp_path: Path):
    ledger = GovernanceLedger(tmp_path / "verdicts.json")

    with pytest.raises(GovernanceViolationError, match="AI_ACTOR_FORBIDDEN_FROM_APPROVAL"):
        ledger.record_verdict(
            verdict_id="TV-FAKE-AI",
            scope="ROW_APPROVED",
            actor="claude-or-gpt-agent",
            actor_role="ai_agent",
            target_ids=["Q-1069"],
            target_sha256="a" * 64,
            authenticated=True,
            auth_method="X-Teacher-Token",
        )

    # v2.4 (بند ۵): رشتهٔ نقشِ اعلامیِ فراخواننده به‌تنهایی رأیِ انسانیِ معتبر نمی‌سازد
    with pytest.raises(GovernanceViolationError, match="TEACHER_IDENTITY_NOT_AUTHENTICATED"):
        ledger.record_verdict(
            verdict_id="TV-FAKE-UNAUTH",
            scope="ROW_APPROVED",
            actor="هر فراخوانندهٔ CLI/HTTP",
            actor_role="human_teacher",
            target_ids=["Q-1069"],
            target_sha256="a" * 64,
        )

    old_pm_sha = "b" * 64
    old_wb_sha = "c" * 64
    ledger.record_verdict(
        verdict_id="TV-001",
        scope="MAP_APPROVED",
        actor="استاد راهنما",
        actor_role="human_teacher",
        target_ids=["CH4-P55-P72"],
        target_sha256=old_pm_sha,
        authenticated=True,
        auth_method="unit-test-token",
    )
    ledger.record_verdict(
        verdict_id="TV-002",
        scope="ROW_APPROVED",
        actor="استاد راهنما",
        actor_role="human_teacher",
        target_ids=["L-401", "Q-1069"],
        target_sha256=old_wb_sha,
        authenticated=True,
        auth_method="unit-test-token",
    )

    mutated_wb_sha = "d" * 64
    g7, _ = evaluate_release_readiness(
        ledger=ledger,
        pagemap_sha256=old_pm_sha,
        workbook_path=fixture_paths["v05_candidate"],
        workbook_sha256=mutated_wb_sha,
        upstream_gates={},
        open_issue_count=0,
    )
    assert g7.status == "BLOCKED"
    assert g7.metrics["invalidated_verdict_count"] == 1
    assert any("INVALIDATED_STALE_VERDICTS:1" in b for b in g7.metrics["blocker_reasons"])


# ---------------------------------------------------------------------------
# Automation Functions (§8), Multi-Grade `B3`, Live PDF Gates & `B4` G3 Map
# ---------------------------------------------------------------------------


def test_auto_fn1_and_fn2_keyed_diff_and_closed_wave_whitelist(fixture_paths: Dict[str, Path], tmp_path: Path):
    diff = diff_workbooks_by_key(
        fixture_paths["v031_official"],
        fixture_paths["v05_candidate"],
    )
    assert diff["changed_cells"] == [], f"Unexpected edits to official v0.3.1 cells: {diff['changed_cells']}"
    assert diff["removed_rows"] == []
    assert len(diff["added_rows"]) == (18 + 18) + (3 + 2) + (28 + 24)

    tampered = tmp_path / "tampered_v05.xlsx"
    shutil.copy2(fixture_paths["v05_candidate"], tampered)
    wb = openpyxl.load_workbook(tampered)
    wb["نقشهٔ کتاب (S1)"].cell(4, 5).value = "دستکاری خارج از whitelist"
    wb.save(tampered)

    bad_diff = diff_workbooks_by_key(fixture_paths["v05_candidate"], tampered)
    wl_res = verify_wave_whitelist(bad_diff, allowed_cell_triples=set(), allowed_added_keys=set())
    assert wl_res.status == "FAIL"
    assert wl_res.reason_code == "OUT_OF_WHITELIST_MUTATION"


def test_auto_fn3_official_stamps_catches_v04_wipe_and_passes_v05(fixture_paths: Dict[str, Path]):
    res_v04 = verify_official_stamps(
        fixture_paths["v04_raw_buggy"],
        fixture_paths["v031_official"],
    )
    assert res_v04.status == "FAIL"
    assert res_v04.metrics["stamp_regression_count"] > 20

    res_v05 = verify_official_stamps(
        fixture_paths["v05_candidate"],
        fixture_paths["v031_official"],
    )
    assert res_v05.status == "PASS", res_v05.issues


def test_auto_fn4_and_fn5_anchors_cpa_triad_and_exact_6_6_6_6_balance(fixture_paths: Dict[str, Path]):
    assert verify_bidirectional_anchors(fixture_paths["v04_raw_buggy"]).status == "FAIL"
    assert verify_bidirectional_anchors(fixture_paths["v05_candidate"]).status == "PASS"

    # Zero hardcoded QIDs: `base_xlsx_path` derives Q-1069..Q-1092 automatically from keyed-diff!
    cpa_res = verify_cpa_and_answer_balance(
        fixture_paths["v05_candidate"],
        base_xlsx_path=fixture_paths["v04_official"],
        strict_all_rows_aud06=True,
    )
    assert cpa_res.status == "PASS", cpa_res.issues
    assert cpa_res.metrics["derived_first_wave_qid"] == "Q-1069"
    assert cpa_res.metrics["wave_answer_distribution"] == {"الف": 6, "ب": 6, "ج": 6, "د": 6}


def test_b3_wave_scope_derived_from_keyed_diff_multi_grade(
    repo_root: Path,
    fixture_paths: Dict[str, Path],
    tmp_path: Path,
):
    """B3: Verify zero hardcoded `Q-1069` in agent source and dynamic derivation on Grade 3 (`Q-301..Q-304`)."""
    for src_rel in (
        "authoring/agent/automation_suite.py",
        "authoring/agent/validators.py",
        "authoring/agent/cli.py",
    ):
        src_text = (repo_root / src_rel).read_text(encoding="utf-8")
        assert "Q-1069" not in src_text, f"Hardcoded Q-1069 found in {src_rel}!"

    g3_base = fixture_paths["g3_v07_official"]
    g3_cand = tmp_path / "khshab-G3-MATH_v0.8_synthetic.xlsx"
    wb = openpyxl.load_workbook(g3_base)
    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    ws_qb = wb["بانک سؤال"]

    s1_sent = next(r for r in range(3, ws_s1.max_row + 1) if str(ws_s1.cell(r, 1).value).strip() == "یادداشت")
    had_s1_merge = f"A{s1_sent}:N{s1_sent}" in {str(m) for m in ws_s1.merged_cells.ranges}
    if had_s1_merge:
        ws_s1.unmerge_cells(f"A{s1_sent}:N{s1_sent}")
    ws_s1.insert_rows(s1_sent, 1)
    s1_vals = [
        "L-101", "۶ تا ۸", "۱", "الگوها", "الگوی عددی افزایشی",
        "کشف رابطهٔ بین جمله‌ها", "فعّالیت و کار در کلاس", "الگویابی",
        "—", "تعاملی-عمیق", "Q-301 تا Q-304", "پیشنهاد",
        "پیشنهاد AI — موتور تألیف v۱.۰", "تست مشتق‌سازی خودکار B3",
    ]
    for c_i, val in enumerate(s1_vals, start=1):
        ws_s1.cell(s1_sent, c_i, val)
    ws_s1.merge_cells(f"A{s1_sent + 1}:N{s1_sent + 1}")

    qb_sent = next(r for r in range(4, ws_qb.max_row + 1) if str(ws_qb.cell(r, 1).value).strip() == "یادداشت")
    had_qb_merge = f"A{qb_sent}:Q{qb_sent}" in {str(m) for m in ws_qb.merged_cells.ranges}
    if had_qb_merge:
        ws_qb.unmerge_cells(f"A{qb_sent}:Q{qb_sent}")
    ws_qb.insert_rows(qb_sent, 4)
    sample_q_rows = [
        ("Q-301", "L-101", "CORE", "مجسم", "الف"),
        ("Q-302", "L-101", "CORE", "تصویری", "ب"),
        ("Q-303", "L-101", "DEPTH", "علامتی", "ج"),
        ("Q-304", "L-101", "SIDE", "علامتی", "د"),
    ]
    for idx, (qid, lid, dom, cpa, key_l) in enumerate(sample_q_rows):
        rr = qb_sent + idx
        for cc in range(1, 18):
            ws_qb.cell(rr, cc, copy(ws_qb.cell(4, cc).value))
        ws_qb.cell(rr, 1, qid)
        ws_qb.cell(rr, 2, lid)
        ws_qb.cell(rr, 3, dom)
        ws_qb.cell(rr, 4, cpa)
        ws_qb.cell(rr, 11, key_l)
        ws_qb.cell(rr, 15, "پیشنهاد")
        ws_qb.cell(rr, 16, "پیشنهاد AI — موتور تألیف v۱.۰")
    ws_qb.merge_cells(f"A{qb_sent + 4}:Q{qb_sent + 4}")
    wb.save(g3_cand)

    kd_g3 = diff_workbooks_by_key(g3_base, g3_cand)
    scope_g3 = derive_wave_scope_from_diff(kd_g3)
    assert scope_g3["first_wave_qid"] == "Q-301"
    assert scope_g3["wave_qids"] == {"Q-301", "Q-302", "Q-303", "Q-304"}

    res_ok = verify_cpa_and_answer_balance(g3_cand, base_xlsx_path=g3_base)
    assert res_ok.status == "PASS", res_ok.issues
    assert res_ok.metrics["derived_first_wave_qid"] == "Q-301"
    assert res_ok.metrics["wave_answer_distribution"] == {"الف": 1, "ب": 1, "ج": 1, "د": 1}

    # Skew all 4 Grade-3 wave answers to 'الف' and verify dynamic gate immediately catches imbalance
    wb_bad = openpyxl.load_workbook(g3_cand)
    for rr in range(qb_sent, qb_sent + 4):
        wb_bad["بانک سؤال"].cell(rr, 11, "الف")
    wb_bad.save(g3_cand)
    res_bad = verify_cpa_and_answer_balance(g3_cand, base_xlsx_path=g3_base)
    assert res_bad.status == "FAIL"
    assert any(i.get("error") == "IMBALANCED_ANSWER_KEYS" for i in res_bad.issues)


def test_auto_fn6_machine_pixel_counter_counts_exact_13_triangles_on_c205_page8(c205_pdf_path: Path):
    res = count_visual_components(c205_pdf_path, pdf_page_1based=14, bbox_pt=(55, 356, 520, 414))
    assert res["status"] == "PASS"
    assert res["count"] == 13, f"Incident #9 verification: expected 13 triangles, got {res['count']}"


def test_auto_fn7_real_zai_converter_blocks_v04_and_passes_v05(
    repo_root: Path,
    fixture_paths: Dict[str, Path],
    require_converter_ssot: Path,
    tmp_path: Path,
):
    r_v04 = run_converter_and_parse_report(fixture_paths["v04_raw_buggy"], repo_root, download_dir=tmp_path)
    assert r_v04["status"] == "FAIL"
    assert r_v04["red"] == 2  # L-110 & L-112 T7 ownership mismatch!

    r_v05 = run_converter_and_parse_report(fixture_paths["v05_candidate"], repo_root, download_dir=tmp_path)
    assert r_v05["status"] == "PASS", r_v05
    assert r_v05["red"] == 0
    assert Path(r_v05["report_path"]).exists()


def test_auto_fn9_and_fn10_chunk_planner_and_all_16_historical_incidents(fixture_paths: Dict[str, Path]):
    inc_v04 = audit_historical_incidents_16(
        fixture_paths["v04_raw_buggy"],
        fixture_paths["v031_official"],
    )
    assert inc_v04.status == "FAIL"
    failed_ids = {i["incident_id"] for i in inc_v04.issues}
    assert {"INC-06", "INC-07", "INC-08", "INC-09", "INC-10", "INC-13"}.issubset(failed_ids)

    inc_v05 = audit_historical_incidents_16(
        fixture_paths["v05_candidate"],
        fixture_paths["v031_official"],
        chunk_plan_path=fixture_paths["chunk_plan_c205"],
    )
    assert inc_v05.status == "PASS", inc_v05.issues
    assert inc_v05.metrics["passed_incidents"] == 16


def test_c305_init_book_proves_zero_offset(c305_pdf_path: Path):
    """Live PDF verification on `C305.pdf`: `bookPage == pdfPage` (`proven_offset == 0`, 152 pages)."""
    cp = plan_and_verify_pdf_chunks(c305_pdf_path, max_chunk_pages=12, overlap_pages=2, parallel_lanes=4)
    assert cp["status"] == "PASS"
    assert cp["total_pdf_pages"] == 152
    assert cp["proven_offset"] == 0
    assert all(c["page_count"] <= 12 for c in cp["chunks"])


def test_generic_agent_cli_works_on_real_official_grade3_v07_and_pure_overlay_v05(
    repo_root: Path,
    fixture_paths: Dict[str, Path],
    require_converter_ssot: Path,
):
    g3_path = fixture_paths["g3_v07_official"]
    res_g3 = run_generic_wave_check(repo_root, candidate_xlsx=g3_path)
    assert res_g3["overall_gate_status"] == "PASS_READY_FOR_SECOND_INSPECTOR", res_g3
    assert res_g3["gates"]["zai_converter"]["red"] == 0
    assert res_g3["gates"]["zai_converter"]["yellow"] == 7
    assert res_g3["gates"]["cpa_and_balance"]["status"] == "PASS"

    kd = diff_workbooks_by_key(
        fixture_paths["v04_official"],
        fixture_paths["v05_candidate"],
    )
    assert kd["changed_cells"] == []
    assert kd["removed_rows"] == []
    assert kd["summary"]["added_row_count"] == 44


def test_b4_g3_pagemap_verified_contract_and_sha256(repo_root: Path):
    """B4: Non-destructive 152-row contract check on `PAGE-MAP-KH-G3-MATH-v1_verified.xlsx`."""
    base_pm = repo_root / "authoring/PAGE-MAP-KH-G3-MATH-v1.xlsx"
    ver_pm = repo_root / "authoring/PAGE-MAP-KH-G3-MATH-v1_verified.xlsx"
    ver_sha_file = repo_root / "authoring/PAGE-MAP-KH-G3-MATH-v1_verified.sha256"
    if not ver_pm.exists():
        pytest.skip(reason="فایل PAGE-MAP-KH-G3-MATH-v1_verified.xlsx هنوز در این مخزن کپی نشده است.")

    assert base_pm.exists(), "Base PAGE-MAP-KH-G3-MATH-v1.xlsx must exist alongside _verified.xlsx"
    wb1 = openpyxl.load_workbook(base_pm, data_only=False)
    wb2 = openpyxl.load_workbook(ver_pm, data_only=False)
    assert wb1.sheetnames == wb2.sheetnames

    for sname in wb1.sheetnames:
        ws1, ws2 = wb1[sname], wb2[sname]
        assert ws1.max_row == ws2.max_row
        assert ws1.max_column == ws2.max_column
        for r in range(1, ws1.max_row + 1):
            for c in range(1, ws1.max_column + 1):
                if sname == "نقشهٔ صفحه‌ها" and r >= 2 and c in (14, 15, 16):
                    continue
                assert ws1.cell(r, c).value == ws2.cell(r, c).value, f"Forbidden diff at {sname}!R{r}C{c}"

    ws = wb2["نقشهٔ صفحه‌ها"]
    assert ws.max_row == 153
    verdicts = [ws.cell(r, 14).value for r in range(2, 154)]
    assert set(verdicts).issubset({"✓", "✗", "؟"})
    assert len(verdicts) == 152
    assert all((ws.cell(r, 15).value or "").strip() for r in range(2, 154))
    assert all((ws.cell(r, 16).value or "").strip().startswith("C305.pdf#p=") for r in range(2, 154))

    if ver_sha_file.exists():
        expected_sha = ver_sha_file.read_text(encoding="utf-8").split()[0]
        actual_sha = hashlib.sha256(ver_pm.read_bytes()).hexdigest()
        assert actual_sha == expected_sha
