"""Adversarial & End-to-End Verification Suite for the C205 Authoring Pipeline (`P0`..`P6`).

Every test executes REAL file mutations on real Excel workbooks, PDF streams, evidence ledgers,
and SHA-256 governance chains — zero mocks pretending to pass!
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import openpyxl
import pytest

from authoring.agent.excel_exporter import (
    export_non_destructive_pagemap,
    export_pilot_cartridge_v05,
)
from authoring.agent.git_guard import audit_git_copyright_safety
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

REPO_ROOT = Path(__file__).resolve().parent.parent
VAULT_PDF = Path("/tmp/c205_secure_vault/C205.pdf")
VAULT_PM_V1 = Path("/tmp/c205_secure_vault/PAGE-MAP-KH-G2-MATH-v1.xlsx")

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
# Stage P0 & Copyright Guard Tests
# ---------------------------------------------------------------------------


def test_g0_copyright_guard_clean_on_active_repo():
    res = audit_git_copyright_safety(REPO_ROOT)
    assert res.status == "PASS", res.issues
    assert res.reason_code == "CLEAN_WORKSPACE"


def test_g0_copyright_guard_blocks_leaked_pdf_or_crop(tmp_path: Path):
    import subprocess

    subprocess.run(["git", "init", str(tmp_path)], check=True, capture_output=True)
    shutil.copyfile(REPO_ROOT / ".gitignore", tmp_path / ".gitignore")
    (tmp_path / "crop_leak.png").write_bytes(b"\x89PNG\r\n\x1a\nfake")
    subprocess.run(["git", "-C", str(tmp_path), "add", "-f", "crop_leak.png"], check=True, capture_output=True)
    res = audit_git_copyright_safety(tmp_path)
    assert res.status == "FAIL"
    assert res.reason_code == "COPYRIGHT_LEAK_BLOCKED"


# ---------------------------------------------------------------------------
# Stage P1 Observation Honesty & Ghost-Layer Tests
# ---------------------------------------------------------------------------


def test_p1_missing_pdf_yields_honest_blocked_gate(tmp_path: Path):
    gate, ledger = observe_pdf(
        REPO_ROOT / "authoring/data/book_manifest_C205.json",
        tmp_path / "nonexistent.pdf",
        tmp_path / "vault",
    )
    assert gate.status == "BLOCKED"
    assert gate.reason_code == "SOURCE_PDF_MISSING"
    assert ledger == {}


def test_p1_wrong_edition_sha256_yields_blocked_gate(tmp_path: Path):
    fake_pdf = tmp_path / "wrong_edition.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4\nwrong textbook bytes\n%%EOF\n")
    gate, ledger = observe_pdf(
        REPO_ROOT / "authoring/data/book_manifest_C205.json",
        fake_pdf,
        tmp_path / "vault",
    )
    assert gate.status == "FAIL"
    assert gate.reason_code == "EDITION_SHA_MISMATCH"
    assert ledger == {}


def test_p1_pdf47_occluded_pasteboard_ghost_filtered_in_real_ledger():
    obs = json.loads((REPO_ROOT / "authoring/audit/observation_C205.json").read_text(encoding="utf-8"))
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


def test_p2_two_model_agreement_never_becomes_approved_or_verified():
    live_gate = check_live_dual_model_availability()
    assert live_gate.status == "BLOCKED"

    rec_gate, snap, iq, decs = reconcile_pagemap_and_observations(
        verified_xlsx_path=REPO_ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx",
        observation_json_path=REPO_ROOT / "authoring/audit/observation_C205.json",
        raw_v1_xlsx_path=VAULT_PM_V1 if VAULT_PM_V1.exists() else None,
    )
    assert rec_gate.status == "PASS"
    assert snap["status_counts"]["TEACHER_APPROVED"] == 0
    assert snap["status_counts"]["AGREED_UNVERIFIED"] == 122
    assert iq["total_issues"] == 29
    assert decs["total_decisions"] == 14


# ---------------------------------------------------------------------------
# Stage P3 Non-Destructive Exporters, Column Contract & ID Allocator Tests
# ---------------------------------------------------------------------------


def test_p3_pagemap_export_preserves_13_columns_and_is_bit_idempotent(tmp_path: Path):
    out1 = tmp_path / "pm1.xlsx"
    out2 = tmp_path / "pm2.xlsx"
    g1, sha1, _ = export_non_destructive_pagemap(
        REPO_ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx",
        REPO_ROOT / "authoring/audit/decisions_C205.json",
        REPO_ROOT / "authoring/audit/issue_queue_C205.json",
        out1,
    )
    g2, sha2, _ = export_non_destructive_pagemap(
        REPO_ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx",
        REPO_ROOT / "authoring/audit/decisions_C205.json",
        REPO_ROOT / "authoring/audit/issue_queue_C205.json",
        out2,
    )
    assert g1.status == "PASS" and g2.status == "PASS"
    assert sha1 == sha2
    assert g1.metrics["base_col_diffs"] == 0
    assert g1.metrics["unscheduled_audit_diffs"] == 0


def test_p3_pagemap_rejects_broken_input_with_extra_column(tmp_path: Path):
    bad_in = tmp_path / "bad_pagemap.xlsx"
    wb = openpyxl.load_workbook(REPO_ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx")
    wb["نقشهٔ صفحه‌ها"].cell(2, 17, "ستون هفدهم غیرمجاز")
    wb.save(bad_in)
    gate, sha, _ = export_non_destructive_pagemap(
        bad_in,
        REPO_ROOT / "authoring/audit/decisions_C205.json",
        REPO_ROOT / "authoring/audit/issue_queue_C205.json",
        tmp_path / "out.xlsx",
    )
    assert gate.status == "FAIL"
    assert gate.reason_code == "PAGEMAP_COLUMN_CONTRACT_VIOLATION"
    assert sha == ""


def test_p3_retired_id_cannot_ever_be_recycled():
    reg = json.loads((REPO_ROOT / "authoring/data/id_registry.json").read_text(encoding="utf-8"))
    alloc = IDAllocator(reg)
    alloc.retire("Q", "Q-1092", "retired_due_to_teacher_rejection")
    with pytest.raises(ImmutableIDViolationError, match="permanently sealed and cannot be recycled"):
        alloc.allocate_explicit("Q", "Q-1092", "brand_new_question")
    # Next sequential allocation skips cleanly to Q-1093
    nxt = alloc.next_question_id("fresh_question_after_retirement")
    assert nxt == "Q-1093"


def test_p3_cartridge_v05_zero_legacy_diff_and_bit_idempotency(tmp_path: Path):
    hist = [REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx"]
    g1, sha1, _ = export_pilot_cartridge_v05(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx",
        tmp_path / "v05_a.xlsx",
        tmp_path / "reg_a.json",
        tmp_path / "patch_a.json",
        hist,
        sorted(RUNTIME_CODES),
    )
    g2, sha2, _ = export_pilot_cartridge_v05(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx",
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
# Stage P4 Clean Baseline + ALL Adversarial Mutation Tests (M1..M8)
# ---------------------------------------------------------------------------


def _copy_clean_v05(tmp_path: Path) -> Path:
    dst = tmp_path / "mutated.xlsx"
    shutil.copyfile(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx", dst)
    return dst


def test_p4_baseline_v05_passes_all_four_independent_gates():
    res = inspect_cartridge_workbook(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
        REPO_ROOT / "authoring/audit/observation_C205.json",
        RUNTIME_CODES,
    )
    for gid, gate in res.items():
        assert gate.status == "PASS", f"{gid} failed: {gate}"


def test_p4_mutation_m1_corrupt_digit_in_correct_option_fails_solver(tmp_path: Path):
    """Mutation M1: تغییر یک رقم در گزینهٔ درست → شکست قطعی `G4_INDEPENDENT_SOLVER`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    # Row 72 = Q-1069: answer key is 'الف' (col 7), originally '۶' -> mutate to '۷'
    wb["بانک سؤال"].cell(72, 7, "۷")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G4_INDEPENDENT_SOLVER"].status == "FAIL"
    assert res["G4_INDEPENDENT_SOLVER"].reason_code == "ANSWER_KEY_MISMATCH"


def test_p4_mutation_m2_wrong_answer_key_letter_fails_both_j12_and_solver(tmp_path: Path):
    """Mutation M2: تغییر حرف کلید پاسخ بدون تغییر نقشه → شکست قطعی."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    # Row 73 = Q-1070: change answer key from 'ج' to 'الف' AND update map letters so ONLY solver catches wrong math!
    wb["بانک سؤال"].cell(73, 11, "الف")
    wb["بانک سؤال"].cell(73, 12, "ب→E_ZERO_PLACE_MISS؛ ج→E_UNIT_VALUE_CONFUSION؛ د→E_SUB_CONFUSION")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G3_ANTI_J12"].status == "PASS"
    assert res["G4_INDEPENDENT_SOLVER"].status == "FAIL"
    assert res["G4_INDEPENDENT_SOLVER"].reason_code == "ANSWER_KEY_MISMATCH"


def test_p4_mutation_m3_false_distractor_mechanism_fails_causality(tmp_path: Path):
    """Mutation M3: نسبت دادن کد خطای اشتباه به گزینهٔ غلط → شکست قطعی `G5_DISTRACTOR_CAUSALITY`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    # Row 72 = Q-1069: option د is '۵' (off-by-1 from 6), mislabel it as E_BORROW_MISS!
    wb["بانک سؤال"].cell(72, 12, "الف→E_UNIT_VALUE_CONFUSION؛ ج→E_ZERO_PLACE_MISS؛ د→E_BORROW_MISS")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G4_INDEPENDENT_SOLVER"].status == "PASS"
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"
    assert res["G5_DISTRACTOR_CAUSALITY"].reason_code == "MECHANISM_MISMATCH"


def test_p4_mutation_m3b_collapsed_identical_codes_fails_causality(tmp_path: Path):
    """Mutation M3b: یکسان‌سازی تنبل هر ۳ کد خطا روی یک کد → شکست قطعی `G5_DISTRACTOR_CAUSALITY`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    # Row 93 = Q-1090: force all 3 distractors to claim E_ROUND_NEAREST (and tweak option د to 390)
    wb["بانک سؤال"].cell(93, 10, "۳۹۰")
    wb["بانک سؤال"].cell(93, 12, "ب→E_ROUND_NEAREST؛ ج→E_ROUND_NEAREST؛ د→E_ROUND_NEAREST")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"


def test_p4_mutation_m4_ascii_digit_in_persian_stem_fails_anti_j12(tmp_path: Path):
    """Mutation M4a: نشت رقم انگلیسی/ASCII در صورت سؤال یا گزینه → شکست قطعی `G3_ANTI_J12`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 5, "حانیه 60 سکّهٔ ۱ ریالی دارد. او چند سکّهٔ ۱۰ ریالی می‌گیرد؟")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G3_ANTI_J12"].status == "FAIL"
    assert res["G3_ANTI_J12"].reason_code == "LATIN_DIGIT_IN_PERSIAN_FIELD"


def test_p4_mutation_m4b_persian_digit_in_latin_trace_fails_anti_j12(tmp_path: Path):
    """Mutation M4b: نشت رقم فارسی داخل ردپای محاسبهٔ لاتین در ستون یادداشت → شکست قطعی `G3_ANTI_J12`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    wb["بانک سؤال"].cell(72, 17, "ضد J12 — کار دفترچه‌ای (لاتین): ۶۰ // ۱۰ = ۶؛ پاسخ جدا حساب شد.")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G3_ANTI_J12"].status == "FAIL"
    assert "PERSIAN_DIGIT_IN_LATIN_TRACE" in res["G3_ANTI_J12"].reason_code


def test_p4_mutation_m5_stem_edited_without_updating_note_fails_solver(tmp_path: Path):
    """Mutation M5: تغییر عدد صورت سؤال بدون به‌روزرسانی یادداشت → شکست قطعی `G4_INDEPENDENT_SOLVER`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    # Row 72 = Q-1069: change ۶۰ to ۸۰ in stem WITHOUT updating note (`60 // 10 = 6`)!
    wb["بانک سؤال"].cell(72, 5, "حانیه ۸۰ سکّهٔ ۱ ریالی دارد. اگر همهٔ آن‌ها را با سکّه‌های ۱۰ ریالی عوض کند، چند سکّهٔ ۱۰ ریالی می‌گیرد؟")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G4_INDEPENDENT_SOLVER"].status == "FAIL"
    assert res["G4_INDEPENDENT_SOLVER"].reason_code == "STEM_TRACE_MISMATCH"


def test_p4_mutation_m6_page_offset_mismatch_in_s1_fails_structure(tmp_path: Path):
    """Mutation M6: جابه‌جایی صفحهٔ کتاب نسبت به PDF در شیت S1 → شکست قطعی `G6_WORKBOOK_STRUCTURE`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    # Look up `L-401` strictly by Column-A key (Incident #11: never hardcode physical row index!)
    s1 = wb["نقشهٔ کتاب (S1)"]
    r_l401 = next(r for r in range(3, s1.max_row + 1) if s1.cell(r, 1).value == "L-401")
    s1.cell(r_l401, 2, "۵۶")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G6_WORKBOOK_STRUCTURE"].status == "FAIL"
    assert "PAGE_OFFSET_MISMATCH" in res["G6_WORKBOOK_STRUCTURE"].reason_code


def test_p4_mutation_m7_broken_sentinel_merge_or_post_sentinel_row_fails(tmp_path: Path):
    """Mutation M7: شکستن ادغام ردیف نگهبان `یادداشت` یا افزودن سؤال زیر `یادداشت` → شکست قطعی `G6`."""
    mut = _copy_clean_v05(tmp_path)
    wb = openpyxl.load_workbook(mut)
    ws = wb["بانک سؤال"]
    ws.unmerge_cells(f"A{ws.max_row}:Q{ws.max_row}")
    ws.cell(ws.max_row + 1, 1, "Q-9999")
    wb.save(mut)

    res = inspect_cartridge_workbook(mut, REPO_ROOT / "authoring/audit/observation_C205.json", RUNTIME_CODES)
    assert res["G6_WORKBOOK_STRUCTURE"].status == "FAIL"


def test_p4_pedagogy_tie_rule_q1067_blocked_without_crop_evidence(tmp_path: Path):
    """Pedagogy Gate: بدون شاهد برش صفحهٔ ۳۳ (`PDF 39`) برای قاعدهٔ `۲۵ -> ۳۰`، سؤال `Q-1067` با `PEDAGOGY_BLOCKED` مسدود می‌شود."""
    stripped_obs = tmp_path / "obs_without_p39.json"
    stripped_obs.write_text(json.dumps({"evidence_ledger": {}}), encoding="utf-8")

    res = inspect_cartridge_workbook(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
        stripped_obs,
        RUNTIME_CODES,
    )
    assert res["G5_DISTRACTOR_CAUSALITY"].status == "FAIL"
    assert res["G5_DISTRACTOR_CAUSALITY"].reason_code == "PEDAGOGY_BLOCKED"


def test_p4_strict_audit_catches_real_v04_diagnostic_bugs():
    res = inspect_cartridge_workbook(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx",
        REPO_ROOT / "authoring/audit/observation_C205.json",
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


def test_p6_ai_cannot_forge_teacher_approval_and_sha_mutation_invalidates_verdicts(tmp_path: Path):
    ledger = GovernanceLedger(tmp_path / "verdicts.json")

    # 1. AI actor attempting to emit ROW_APPROVED MUST raise GovernanceViolationError
    with pytest.raises(GovernanceViolationError, match="AI_ACTOR_FORBIDDEN_FROM_APPROVAL"):
        ledger.record_verdict(
            verdict_id="TV-FAKE-AI",
            scope="ROW_APPROVED",
            actor="claude-or-gpt-agent",
            actor_role="ai_agent",
            target_ids=["Q-1069"],
            target_sha256="a" * 64,
        )

    # 2. Human teacher signs valid verdicts bound to current SHA-256 (`"b" * 64`)
    old_pm_sha = "b" * 64
    old_wb_sha = "c" * 64
    ledger.record_verdict(
        verdict_id="TV-001",
        scope="MAP_APPROVED",
        actor="استاد راهنما",
        actor_role="human_teacher",
        target_ids=["CH4-P55-P72"],
        target_sha256=old_pm_sha,
    )
    ledger.record_verdict(
        verdict_id="TV-002",
        scope="ROW_APPROVED",
        actor="استاد راهنما",
        actor_role="human_teacher",
        target_ids=["L-401", "Q-1069"],
        target_sha256=old_wb_sha,
    )

    # 3. Now simulate upstream workbook changing by 1 bit (`"d" * 64` != `"c" * 64`) -> automatic invalidation!
    mutated_wb_sha = "d" * 64
    g7, _ = evaluate_release_readiness(
        ledger=ledger,
        pagemap_sha256=old_pm_sha,
        workbook_path=REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
        workbook_sha256=mutated_wb_sha,
        upstream_gates={},
        open_issue_count=0,
    )
    assert g7.status == "BLOCKED"
    assert g7.metrics["invalidated_verdict_count"] == 1
    assert any("INVALIDATED_STALE_VERDICTS:1" in b for b in g7.metrics["blocker_reasons"])


# ==============================================================================
# Stage P5/P6 + Handoff v1.0 (`انتقال تجربه`): Section 9 Boundary, 10 Automation Functions (§8) & 16 Incidents (§6)
# ==============================================================================
def test_section9_ownership_boundary_zero_software_mutations():
    from authoring.agent.git_guard import check_ownership_boundary

    res = check_ownership_boundary(REPO_ROOT)
    assert res.status == "PASS", f"Section 9 boundary violated: {res.issues}"


def test_auto_fn1_and_fn2_keyed_diff_and_closed_wave_whitelist(tmp_path):
    from authoring.agent.automation_suite import diff_workbooks_by_key, verify_wave_whitelist

    diff = diff_workbooks_by_key(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.3.1_official.xlsx",
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
    )
    # Every cell from Z.ai's official merged `v0.3.1` MUST be 100% preserved in `v0.5`!
    assert diff["changed_cells"] == [], f"Unexpected edits to official v0.3.1 cells: {diff['changed_cells']}"
    assert diff["removed_rows"] == []
    assert len(diff["added_rows"]) == (18 + 18) + (3 + 2) + (28 + 24)  # Waves 3 + 4 rows across S1, Atlas, Bank

    # Inject a single unwhitelisted cell tweak and prove `verify_wave_whitelist` turns RED
    tampered = tmp_path / "tampered_v05.xlsx"
    shutil.copy2(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx", tampered)
    wb = openpyxl.load_workbook(tampered)
    wb["نقشهٔ کتاب (S1)"].cell(4, 5).value = "دستکاری خارج از whitelist"
    wb.save(tampered)

    bad_diff = diff_workbooks_by_key(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx", tampered)
    wl_res = verify_wave_whitelist(bad_diff, allowed_cell_triples=set(), allowed_added_keys=set())
    assert wl_res.status == "FAIL"
    assert wl_res.reason_code == "OUT_OF_WHITELIST_MUTATION"


def test_auto_fn3_official_stamps_catches_v04_wipe_and_passes_v05():
    from authoring.agent.automation_suite import verify_official_stamps

    # Legacy `v0.4.xlsx` wiped official stamps (Incident #7) -> MUST FAIL
    res_v04 = verify_official_stamps(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx",
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.3.1_official.xlsx",
    )
    assert res_v04.status == "FAIL"
    assert res_v04.metrics["stamp_regression_count"] > 20

    # Delivered `v0.5.xlsx` restores all official stamps & adds zero forged greens -> MUST PASS
    res_v05 = verify_official_stamps(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.3.1_official.xlsx",
    )
    assert res_v05.status == "PASS", res_v05.issues


def test_auto_fn4_and_fn5_anchors_cpa_triad_and_exact_6_6_6_6_balance():
    from authoring.agent.automation_suite import (
        verify_bidirectional_anchors,
        verify_cpa_and_answer_balance,
    )

    assert verify_bidirectional_anchors(REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx").status == "FAIL"
    assert verify_bidirectional_anchors(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx").status == "PASS"

    cpa_res = verify_cpa_and_answer_balance(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx", new_wave_start_qid="Q-1069", new_wave_chapter="۴")
    assert cpa_res.status == "PASS", cpa_res.issues
    assert cpa_res.metrics["wave_answer_distribution"] == {"الف": 6, "ب": 6, "ج": 6, "د": 6}


def test_auto_fn6_machine_pixel_counter_counts_exact_13_triangles_on_c205_page8():
    from authoring.agent.automation_suite import count_visual_components

    vault_pdf = Path("/tmp/c205_secure_vault/C205.pdf")
    res = count_visual_components(vault_pdf, pdf_page_1based=14, bbox_pt=(55, 356, 520, 414))
    if vault_pdf.exists():
        assert res["status"] == "PASS"
        assert res["count"] == 13, f"Incident #9 verification: expected 13 triangles, got {res['count']}"
    else:
        assert res["status"] == "BLOCKED"


def test_auto_fn7_real_zai_converter_blocks_v04_and_passes_v05():
    from authoring.agent.automation_suite import run_converter_and_parse_report

    r_v04 = run_converter_and_parse_report(REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx", REPO_ROOT)
    assert r_v04["status"] == "FAIL"
    assert r_v04["red"] == 2  # L-110 & L-112 T7 ownership mismatch!

    r_v05 = run_converter_and_parse_report(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx", REPO_ROOT)
    assert r_v05["status"] == "PASS", r_v05
    assert r_v05["red"] == 0
    assert Path(r_v05["report_path"]).exists()


def test_auto_fn9_and_fn10_chunk_planner_and_all_16_historical_incidents():
    from authoring.agent.automation_suite import (
        audit_historical_incidents_16,
        plan_and_verify_pdf_chunks,
    )

    vault_pdf = Path("/tmp/c205_secure_vault/C205.pdf")
    if vault_pdf.exists():
        cp = plan_and_verify_pdf_chunks(vault_pdf, max_chunk_pages=12, overlap_pages=2, parallel_lanes=4)
        assert cp["status"] == "PASS"
        assert cp["proven_offset"] == 6
        assert len(cp["review_palindrome_anchors"]) >= 5
        assert all(c["page_count"] <= 12 for c in cp["chunks"])

    # Raw `v0.4` fails multiple historical incidents (#6, #7, #8, #9, #10, #13)
    inc_v04 = audit_historical_incidents_16(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.4.xlsx",
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.3.1_official.xlsx",
    )
    assert inc_v04.status == "FAIL"
    failed_ids = {i["incident_id"] for i in inc_v04.issues}
    assert {"INC-06", "INC-07", "INC-08", "INC-09", "INC-10", "INC-13"}.issubset(failed_ids)

    # Delivered `v0.5` passes ALL 16 out of 16 historical incidents (`16/16 PASS`)!
    inc_v05 = audit_historical_incidents_16(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.3.1_official.xlsx",
        pdf_path=vault_pdf if vault_pdf.exists() else None,
        chunk_plan_path=REPO_ROOT / "authoring/audit/chunk_plan_C205.json",
    )
    assert inc_v05.status == "PASS", inc_v05.issues
    assert inc_v05.metrics["passed_incidents"] == 16


def test_generic_agent_cli_works_on_real_official_grade3_v07_and_pure_overlay_v05():
    from authoring.agent.automation_suite import diff_workbooks_by_key
    from authoring.agent.cli import run_generic_wave_check

    # 1) Real official Grade-3 cartridge (`KH-G3-MATH_v0.7.xlsx`, SHA `0e678e54...` from Task 59)
    g3_path = REPO_ROOT / "authoring/khshab-G3-MATH_v0.7.xlsx"
    res_g3 = run_generic_wave_check(REPO_ROOT, candidate_xlsx=g3_path)
    assert res_g3["overall_gate_status"] == "PASS_READY_FOR_SECOND_INSPECTOR", res_g3
    assert res_g3["gates"]["zai_converter"]["red"] == 0
    assert res_g3["gates"]["zai_converter"]["yellow"] == 7
    assert res_g3["gates"]["cpa_and_balance"]["status"] == "PASS"

    # 2) Pure additive overlay check against Z.ai's official Task-58 `khshab-G2-MATH_v0.4_official.xlsx` (`a2f61058...`)
    kd = diff_workbooks_by_key(
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.4_official.xlsx",
        REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx",
    )
    assert kd["changed_cells"] == []
    assert kd["removed_rows"] == []
    assert kd["summary"]["added_row_count"] == 44  # 18 S1 + 2 Atlas + 24 Bank


@pytest.fixture(autouse=True)
def _skip_c205_fixture_dependent_tests_when_absent(request):
    fn = request.node.name
    pure_portable = (
        "test_g0_",
        "test_p1_missing_",
        "test_p1_wrong_",
        "test_p2_",
        "test_p3_retired_",
        "test_section9_",
    )
    if not fn.startswith(pure_portable) and not (REPO_ROOT / "authoring/audit/observation_C205.json").exists():
        pytest.skip("Optional C205 wave-4 benchmark fixture files are not present in this checkout")
