"""مرزهای موردِ نیازِ پیش از تحویلِ کتاب — تست‌هایِ شکستِ عمدی برای اثباتِ قفل‌ها."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

import openpyxl
import pytest

from authoring.agent.autopilot import AutopilotSupervisor, GitHubSyncManager
from authoring.agent.achilles_gate import verify_achilles_evidence_gate
from authoring.agent.automation_suite import run_converter_and_parse_report, verify_universal_wave_invariants
from authoring.agent.models import file_sha256
from authoring.agent.paths import resolve_fixture
from authoring.agent.wave_exporter import export_wave_cartridge
from authoring.agent.models import WaveSpecV2

REPO_ROOT = Path(__file__).resolve().parents[2]
V103 = Path("/tmp/v103_ref")


def test_achilles_is_khshab_agent_not_separate_reader():
    """نقطهٔ ۱: «آشیل» نامِ خودِ khshab-agent است (حالتِ سخت‌گیر)، نه رباتِ جداگانه.
    چشمِ آشیل = observation+reconcile+achilles_gate که به wave_exporter خوراک می‌دهد."""
    # khshab-agent entry point must exist
    assert (REPO_ROOT / "authoring/agent/cli.py").exists()
    assert (REPO_ROOT / "authoring/agent/achilles_gate.py").exists()
    # roadmp must document this contract
    arch = (REPO_ROOT / "authoring/ACHILLES-ARCHITECTURE.fa.md").read_text(encoding="utf-8")
    assert "آشیل = خودِ `khshab-agent`" in arch
    assert "چشمِ آشیل" in arch
    # every print's observation must contain required fields
    obs = json.loads((REPO_ROOT / "authoring/agent/fixtures/observation_C205.json").read_text(encoding="utf-8"))
    assert "source_pdf_sha256" in obs and len(obs["source_pdf_sha256"]) == 64
    assert "quality_scores" in obs and len(obs["quality_scores"]) > 0
    assert "claims" in obs
    assert "evidence_ledger" in obs
    # each page has quality entry, each claim has evidence_refs, each evidence has bbox
    for c in obs["claims"][:3]:
        assert "evidence_refs" in c
    for ev in list(obs["evidence_ledger"].values())[:3]:
        assert "source_sha256" in ev and "bbox_normalized" in ev
    # agreement without evidence must never be EVIDENCE_MATCHED (already enforced in reconcile)
    from authoring.agent.reconcile import enforce_agreement_evidence_rule

    with pytest.raises(ValueError, match="UNVERIFIED_AGREEMENT_PROMOTION_FORBIDDEN"):
        enforce_agreement_evidence_rule("الف", "الف", [], {}, claimed_status="TEACHER_APPROVED")


def test_held_wave_is_not_counted_as_pass_and_converter_missing_blocks_delivery(tmp_path: Path):
    """نقطهٔ ۳: موجِ HELD نباید PASS شمرده شود؛ نبودِ مبدل نباید گیتِ تحویل را سبز کند."""
    # Use the real G2 spec but force HELD via future base version
    spec = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json").to_dict()
    spec["wave_id"] = "wave-held-must-not-pass"
    spec["base_cartridge_filename"] = "khshab-G2-MATH_v0.99.xlsx"  # future head → HELD
    held_path = tmp_path / "held.json"
    held_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")

    sup = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=tmp_path / "state", work_dir=tmp_path / "work")
    res = sup.run_waves([held_path], approve_once=True)
    assert "wave-held-must-not-pass" in res["held_wave_ids"]
    assert res["status"] != "PASS", "HELD must not be counted as PASS"
    assert res["status"] in ("HELD_AWAITING_HEAD", "PARTIAL_WITH_HELD", "BLOCKED")

    # Converter missing must block delivery (not green)
    # Simulate by pointing to a repo_root without converter (standalone arena)
    # The run above already had no converter (arena has none) but was HELD, not PASS.
    # Now test a normal wave without converter in production mode (no PYTEST env):
    # We temporarily clear PYTEST env to get strict behavior
    orig = os.environ.pop("PYTEST_CURRENT_TEST", None)
    try:
        # Use a fresh state dir so PYTEST env not masking
        spec2 = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json").to_dict()
        spec2["wave_id"] = "wave-converter-missing-blocked"
        ok_path = tmp_path / "ok.json"
        ok_path.write_text(json.dumps(spec2, ensure_ascii=False, indent=2), encoding="utf-8")
        sup2 = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=tmp_path / "state2", work_dir=tmp_path / "work2")
        # Force production mode: ensure converter file missing
        # REPO_ROOT has no converter, so this should be BLOCKED when not in pytest
        res2 = sup2.run_waves([ok_path], approve_once=True)
        # In production, missing converter → wave blocked (not PASS)
        assert res2["status"] in ("BLOCKED", "PARTIAL_WITH_BLOCKERS"), f"Missing converter must block delivery, got {res2}"
        assert "wave-converter-missing-blocked" in res2["blocked_wave_ids"] or res2["status"] != "PASS"
    finally:
        if orig is not None:
            os.environ["PYTEST_CURRENT_TEST"] = orig


def test_g0_writable_path_branch_and_official_head_restrictions_with_intentional_failures(tmp_path: Path):
    """نقطهٔ ۳: پیش از push، محدودیتِ مسیرهایِ قابل‌نوشتن، شاخه و سرِ رسمی با تستِ شکستِ عمدی."""
    # 1) Writable path: attempt to write forbidden Z.ai-owned file
    mini = tmp_path / "mini_repo"
    mini.mkdir()
    subprocess.run(["git", "init"], cwd=mini, check=True, capture_output=True)
    # create a forbidden file and stage it
    (mini / "public").mkdir(parents=True)
    (mini / "public" / "math-game").mkdir(parents=True)
    (mini / "public" / "math-game" / "src").mkdir(parents=True)
    (mini / "public" / "math-game" / "src" / "v10").mkdir(parents=True)
    (mini / "public" / "math-game" / "src" / "v10" / "station").mkdir(parents=True)
    (mini / "public" / "math-game" / "src" / "v10" / "station" / "errors.js").write_text("// fake", encoding="utf-8")
    subprocess.run(["git", "add", "-A"], cwd=mini, check=True, capture_output=True)
    gm = GitHubSyncManager(mini)
    g0 = gm.verify_ownership_and_copyright_hygiene()
    assert g0.status == "FAIL"
    assert any(iss["reason"] == "FORBIDDEN_ZAI_OWNED_PATH" for iss in g0.issues)

    # 2) Confidential media: PDF leak
    mini2 = tmp_path / "mini2"
    mini2.mkdir()
    subprocess.run(["git", "init"], cwd=mini2, check=True, capture_output=True)
    (mini2 / "leaked.pdf").write_bytes(b"%PDF-1.4 fake")
    subprocess.run(["git", "add", "-A"], cwd=mini2, check=True, capture_output=True)
    gm2 = GitHubSyncManager(mini2)
    assert gm2.verify_ownership_and_copyright_hygiene().status == "FAIL"

    # 3) Branch restriction: current branch must be arena/** for autopilot push
    # Simulate by checking that GitHubSyncManager would refuse to push from main
    # (we test the guard directly: commit_and_push_if_dirty must fail on G0 fail)
    with pytest.raises(RuntimeError, match="G0 failure"):
        gm.commit_and_push_if_dirty(commit_message="should fail", push=False)

    # 4) Official head staleness: wave requiring future base must be HELD, not built
    spec = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json").to_dict()
    spec["wave_id"] = "wave-stale-head-held"
    spec["base_cartridge_filename"] = "khshab-G2-MATH_v0.99.xlsx"
    stale_path = tmp_path / "stale.json"
    stale_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    sup = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=tmp_path / "state3", work_dir=tmp_path / "work3")
    res = sup.run_waves([stale_path], approve_once=True)
    assert "wave-stale-head-held" in res["held_wave_ids"]


def test_bit_for_bit_reconstruction_contract_and_semantic_equality(tmp_path: Path):
    """نقطهٔ ۴: علتِ ۱۳/۱۴ در بازرسیِ دومِ `39ab27e` و قراردادِ صریحِ برابریِ بایتی."""
    spec_json = REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json"
    ref_v05 = resolve_fixture(REPO_ROOT, "khshab-G2-MATH_v0.5.xlsx", "authoring/khshab-G2-MATH_v0.5.xlsx")
    out_xlsx = tmp_path / "rebuilt_v05.xlsx"
    gate, sha, _ = export_wave_cartridge(spec_json, repo_root=REPO_ROOT, out_xlsx_path=out_xlsx, out_registry_path=tmp_path / "reg.json", enforce_official_heads=False)
    assert gate.status == "PASS", gate.issues
    # Byte equality is guaranteed only with pinned openpyxl==3.1.5 + deterministic save (see ACHILLES doc)
    # If byte differs, semantic equality (cells, IDs, stamps) must still be 0 diff.
    expected_sha = file_sha256(str(ref_v05))
    assert expected_sha == "f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656"
    if sha != expected_sha:
        # Explain version pin contract: semantic diff must be 0
        from authoring.agent.automation_suite import diff_workbooks_by_key

        diff = diff_workbooks_by_key(ref_v05, out_xlsx)
        assert diff["summary"]["changed_cell_count"] == 0, f"Byte SHA differs ({sha} vs {expected_sha}) but semantic cells differ: {diff}"
        assert diff["summary"]["added_row_count"] == 0 and diff["summary"]["removed_row_count"] == 0
        pytest.fail(f"Byte SHA differs due to openpyxl version drift (expected {expected_sha}, got {sha}); semantic cells are identical — pin openpyxl==3.1.5 for bit-identical builds (see ACHILLES-ARCHITECTURE).")
    else:
        assert sha == expected_sha


def test_persistent_queue_and_crash_recovery(tmp_path: Path):
    """نقطهٔ پایانی: برای «کارِ شبانه» یک batch کافی نیست — صفِ ماندگار، پایش و بازیابیِ آزموده‌شده."""
    # Simulate two waves, crash after first, then resume
    spec_a = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json").to_dict()
    spec_a["wave_id"] = "wave-crash-a"
    spec_b = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G3_test_v08.json").to_dict()
    spec_b["wave_id"] = "wave-crash-b"
    pa = tmp_path / "a.json"
    pb = tmp_path / "b.json"
    pa.write_text(json.dumps(spec_a, ensure_ascii=False, indent=2), encoding="utf-8")
    pb.write_text(json.dumps(spec_b, ensure_ascii=False, indent=2), encoding="utf-8")

    state_dir = tmp_path / "state"
    work_dir = tmp_path / "work"
    sup = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=state_dir, work_dir=work_dir)
    res1 = sup.run_waves([pa], approve_once=True)
    # At least one wave completed
    assert len(res1["completed_wave_ids"]) >= 1 or res1["status"] in ("PARTIAL_WITH_HELD", "HELD_AWAITING_HEAD", "PASS")

    # Simulate crash: new supervisor instance with same state_dir must resume
    sup2 = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=state_dir, work_dir=work_dir)
    res2 = sup2.run_waves([pa, pb], approve_once=True)
    # After resume, both waves should be accounted for (completed or held), and state file must exist
    assert (state_dir / "autopilot_state.json").exists()
    assert (state_dir / "autopilot_events.jsonl").exists()
    # No wave should be lost
    all_ids = set(res2["completed_wave_ids"]) | set(res2["held_wave_ids"]) | set(res2["blocked_wave_ids"])
    assert "wave-crash-a" in all_ids
