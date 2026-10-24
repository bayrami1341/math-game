from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

from authoring.agent import microbot_engine
from authoring.agent.cli import main as cli_main
from authoring.agent.microbot_engine import run_microbot_preflight
from authoring.agent.models import GateResult, file_sha256


def _git_repo(root: Path) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "microbot-test@example.invalid"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "Microbot Test"], cwd=root, check=True)
    (root / "README.md").write_text("test repo\n", encoding="utf-8")
    subprocess.run(["git", "add", "README.md"], cwd=root, check=True)
    subprocess.run(["git", "commit", "-qm", "test baseline"], cwd=root, check=True)
    (root / "authoring").mkdir()
    cartridge = root / "authoring" / "candidate.xlsx"
    # No-observation coverage returns WARN before opening this synthetic workbook.
    cartridge.write_bytes(b"synthetic non-confidential test fixture")
    return cartridge


def _private_pdf(vault: Path, *, directory_mode: int = 0o700) -> Path:
    vault.mkdir(parents=True, exist_ok=True)
    os.chmod(vault, directory_mode)
    pdf = vault / "C305.pdf"
    pdf.write_bytes(b"%PDF-1.7\nsynthetic non-confidential test bytes\n")
    os.chmod(pdf, 0o600)
    return pdf


def _manifest(path: Path, pdf: Path, *, book_code: str = "C305", sha: str | None = None) -> Path:
    payload = {
        "schema_version": "1.0.0",
        "manifest_id": "TEST-C305-EDITION-1",
        "book_code": book_code,
        "edition_label_fa": "چاپ آزمایشی",
        "source_pdf": {
            "filename": pdf.name,
            "sha256": sha or file_sha256(str(pdf)),
            "size_bytes": pdf.stat().st_size,
            "pdf_page_count": 1,
        },
        "pagination": {
            "pdf_minus_book_offset": 0,
            "body_pdf_page_start": 1,
            "body_pdf_page_end": 1,
        },
    }
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return path


def _observation(pdf: Path, *, source_sha: str | None = None) -> dict:
    sha = source_sha or file_sha256(str(pdf))
    return {
        "schema_version": "2.0.0",
        "book_code": "C305",
        "source_pdf_sha256": sha,
        "quality_scores": [{
            "pdf_page": 1,
            "expected_book_page": 1,
            "extracted_footer_book_page": 1,
            "footer_alignment_status": "MATCH",
            "visual_dependency": "LOW",
            "quality_score": 1.0,
            "hazards": [],
        }],
        "golden_and_curated_regions": {},
        "claims": [{
            "claim_id": "CLM-SYNTHETIC-1",
            "pdf_page": 1,
            "confidence": "HIGH",
            "evidence_refs": ["EV-SYNTHETIC-1"],
        }],
        "evidence_ledger": {
            "EV-SYNTHETIC-1": {
                "evidence_id": "EV-SYNTHETIC-1",
                "book_code": "C305",
                "source_sha256": sha,
                "pdf_page": 1,
                "book_page": 1,
                "evidence_kind": "pdf_text_bbox",
                "bbox_normalized": [0.1, 0.1, 0.9, 0.9],
                "crop_sha256": None,
                "note": "synthetic non-confidential test record",
            }
        },
    }


def _warn_coverage(*args, **kwargs) -> GateResult:
    # Assert no fixture fallback is enabled for the explicit M13 supplemental gate.
    assert kwargs.get("repo_root") is None
    return GateResult(
        gate_id="G_ACHILLES_COVERAGE",
        stage="P2",
        status="WARN",
        reason_code="COVERAGE_UNKNOWN_NO_OBSERVATION",
        summary="synthetic test: coverage unknown",
    )


def _by_id(report: dict, bot_id: str) -> dict:
    return next(bot for bot in report["bots"] if bot["bot_id"] == bot_id)


def _coverage(report: dict) -> dict:
    return next(gate for gate in report["supplemental_gates"] if gate["gate_id"] == "G_ACHILLES_COVERAGE")


def test_local_dag_blocks_dependents_on_non_pass_and_records_trace() -> None:
    calls: list[str] = []
    nodes = [
        {"node_id": "M00", "depends_on": [], "run": lambda _: {"status": "FAIL", "reason_code": "SOURCE_FAIL"}},
        {"node_id": "M01", "depends_on": [], "run": lambda _: {"status": "PASS", "reason_code": "SAFE"}},
        {
            "node_id": "M02",
            "depends_on": ["M00", "M01"],
            "run": lambda _: calls.append("M02") or {"status": "PASS"},
            "on_blocked": lambda blockers, _: {
                "bot_id": "M02", "status": "BLOCKED", "reason_code": "UPSTREAM_NOT_PASS",
                "issues": [{"blocked_by": blockers}],
            },
        },
    ]

    results, trace = microbot_engine._execute_local_dag(nodes)

    assert results["M02"]["status"] == "BLOCKED"
    assert calls == []
    assert trace[2]["executed"] is False
    assert trace[2]["skipped"] == ["M00"]


def test_local_dag_turns_node_exception_into_fail() -> None:
    results, trace = microbot_engine._execute_local_dag([
        {"node_id": "M00", "depends_on": [], "run": lambda _: (_ for _ in ()).throw(RuntimeError("test"))},
    ])

    assert results["M00"]["status"] == "FAIL"
    assert results["M00"]["reason_code"] == "DAG_NODE_EXCEPTION"
    assert trace[0]["executed"] is True


def test_local_dag_rejects_cycles() -> None:
    with pytest.raises(ValueError, match="cycle"):
        microbot_engine._execute_local_dag([
            {"node_id": "M00", "depends_on": ["M01"], "run": lambda _: {"status": "PASS"}},
            {"node_id": "M01", "depends_on": ["M00"], "run": lambda _: {"status": "PASS"}},
        ])


def test_local_dag_runs_independent_nodes_in_parallel() -> None:
    both_started = threading.Event()
    started: set[str] = set()
    lock = threading.Lock()

    def runner(node_id: str):
        def run(_: dict) -> dict:
            with lock:
                started.add(node_id)
                if len(started) == 2:
                    both_started.set()
            if not both_started.wait(timeout=1.0):
                return {"status": "FAIL", "reason_code": "NODES_NOT_CONCURRENT"}
            return {"status": "PASS", "reason_code": "CONCURRENT_NODE_DONE"}
        return run

    results, trace = microbot_engine._execute_local_dag([
        {"node_id": "M00", "depends_on": [], "run": runner("M00")},
        {"node_id": "M01", "depends_on": [], "run": runner("M01")},
    ], max_workers=2)

    assert results["M00"]["status"] == "PASS"
    assert results["M01"]["status"] == "PASS"
    assert [row["node_id"] for row in trace] == ["M00", "M01"]
    assert all(row["attempts"] == 1 for row in trace)


@pytest.mark.skipif(microbot_engine._hard_timeout_context() is None, reason="hard timeout requires POSIX fork")
def test_local_dag_hard_timeout_stops_worker_and_blocks_dependents() -> None:
    started_at = time.monotonic()
    results, trace = microbot_engine._execute_local_dag([
        {"node_id": "M00", "depends_on": [],
         "run": lambda _: (time.sleep(2.0) or {"status": "PASS"})},
        {"node_id": "M02", "depends_on": ["M00"], "run": lambda _: {"status": "PASS"}},
    ], max_workers=2, timeout_seconds=0.05)

    assert time.monotonic() - started_at < 1.0
    assert results["M00"]["status"] == "FAIL"
    assert results["M00"]["reason_code"] == "DAG_NODE_TIMEOUT"
    assert results["M02"]["status"] == "BLOCKED"
    assert trace[1]["executed"] is False
    assert trace[1]["skipped"] == ["M00"]


def test_local_dag_resumes_after_interruption_from_last_completed_node(tmp_path: Path, monkeypatch) -> None:
    if os.name != "posix":
        pytest.skip("secure checkpoint permission test requires POSIX")
    repo = tmp_path / "repo"
    repo.mkdir()
    vault = tmp_path / "private-vault"
    vault.mkdir(mode=0o700)
    os.chmod(vault, 0o700)
    checkpoint = vault / "partial.json"
    calls: list[str] = []
    nodes = [
        {"node_id": "M00", "depends_on": [], "checkpoint_safe": True,
         "run": lambda _: calls.append("M00") or {"status": "PASS", "reason_code": "OK"}},
        {"node_id": "M01", "depends_on": ["M00"], "checkpoint_safe": True,
         "run": lambda _: calls.append("M01") or {"status": "PASS", "reason_code": "OK"}},
    ]
    real_write = microbot_engine._write_secure_checkpoint

    class SimulatedInterruption(Exception):
        pass

    write_count = 0

    def interrupt_after_first_saved_node(path: Path, payload: dict) -> None:
        nonlocal write_count
        real_write(path, payload)
        write_count += 1
        if write_count == 1:
            raise SimulatedInterruption

    monkeypatch.setattr(microbot_engine, "_write_secure_checkpoint", interrupt_after_first_saved_node)
    with pytest.raises(SimulatedInterruption):
        microbot_engine._execute_local_dag(
            nodes, max_workers=1, checkpoint_path=checkpoint, checkpoint_key="c" * 64,
            repo_root=repo,
        )
    assert calls == ["M00"]
    monkeypatch.setattr(microbot_engine, "_write_secure_checkpoint", real_write)

    resumed_nodes = [
        {"node_id": "M00", "depends_on": [], "checkpoint_safe": True,
         "run": lambda _: pytest.fail("checkpointed M00 must not rerun")},
        {"node_id": "M01", "depends_on": ["M00"], "checkpoint_safe": True,
         "run": lambda _: calls.append("M01") or {"status": "PASS", "reason_code": "OK"}},
    ]
    results, trace = microbot_engine._execute_local_dag(
        resumed_nodes, max_workers=1, checkpoint_path=checkpoint, checkpoint_key="c" * 64,
        repo_root=repo, resume_checkpoint=True,
    )
    assert calls == ["M00", "M01"]
    assert results["M00"]["status"] == results["M01"]["status"] == "PASS"
    assert trace[0]["executed"] is True
    assert trace[1]["executed"] is True


def test_local_dag_checkpoint_resume_is_secure_and_does_not_repeat_completed_nodes(tmp_path: Path) -> None:
    if os.name != "posix":
        pytest.skip("secure checkpoint permission test requires POSIX")
    repo = tmp_path / "repo"
    repo.mkdir()
    vault = tmp_path / "private-vault"
    vault.mkdir(mode=0o700)
    os.chmod(vault, 0o700)
    checkpoint = vault / "m13-checkpoint.json"
    calls: list[str] = []
    nodes = [
        {"node_id": "M00", "depends_on": [], "checkpoint_safe": True,
         "run": lambda _: calls.append("M00") or {"status": "PASS", "reason_code": "OK"}},
        {"node_id": "M01", "depends_on": ["M00"], "checkpoint_safe": True,
         "run": lambda _: calls.append("M01") or {"status": "PASS", "reason_code": "OK"}},
    ]

    first_results, first_trace = microbot_engine._execute_local_dag(
        nodes, max_workers=1, checkpoint_path=checkpoint, checkpoint_key="a" * 64,
        repo_root=repo,
    )

    assert calls == ["M00", "M01"]
    assert checkpoint.stat().st_mode & 0o777 == 0o600
    resumed_nodes = [
        {"node_id": "M00", "depends_on": [], "checkpoint_safe": True,
         "run": lambda _: pytest.fail("completed M00 must not rerun")},
        {"node_id": "M01", "depends_on": ["M00"], "checkpoint_safe": True,
         "run": lambda _: pytest.fail("completed M01 must not rerun")},
    ]
    resumed_results, resumed_trace = microbot_engine._execute_local_dag(
        resumed_nodes, max_workers=1, checkpoint_path=checkpoint, checkpoint_key="a" * 64,
        repo_root=repo, resume_checkpoint=True,
    )
    assert resumed_results == first_results
    assert resumed_trace == first_trace
    with pytest.raises(ValueError, match="inputs/code/branch"):
        microbot_engine._execute_local_dag(
            resumed_nodes, max_workers=1, checkpoint_path=checkpoint, checkpoint_key="b" * 64,
            repo_root=repo, resume_checkpoint=True,
        )


def test_checkpoint_fingerprint_binds_input_path_content_and_security_metadata(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    _git_repo(repo)
    vault_a = tmp_path / "vault-a"
    vault_b = tmp_path / "vault-b"
    for vault in (vault_a, vault_b):
        vault.mkdir(mode=0o700)
        os.chmod(vault, 0o700)
    pdf_a = vault_a / "C305.pdf"
    pdf_b = vault_b / "C305.pdf"
    pdf_a.write_bytes(b"%PDF-1.4\nidentical fixture bytes\n")
    pdf_b.write_bytes(pdf_a.read_bytes())
    os.chmod(pdf_a, 0o600)
    os.chmod(pdf_b, 0o600)

    def fingerprint(pdf: Path) -> dict:
        return microbot_engine._preflight_checkpoint_fingerprint(
            repo, "C305", pdf_path=pdf, manifest_path=None, observation_path=None,
            cartridge_path=None, pagemap_path=None,
        )

    first = fingerprint(pdf_a)
    unchanged = fingerprint(pdf_a)
    same_bytes_different_path = fingerprint(pdf_b)
    assert first["input_hashes"] == same_bytes_different_path["input_hashes"]
    assert first["checkpoint_key"] == unchanged["checkpoint_key"]
    assert first["checkpoint_key"] != same_bytes_different_path["checkpoint_key"]
    pdf_a.write_bytes(b"%PDF-1.4\nchanged fixture bytes\n")
    assert fingerprint(pdf_a)["checkpoint_key"] != first["checkpoint_key"]


def test_local_dag_rejects_checkpoint_inside_repository(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    with pytest.raises(ValueError, match="outside the Git worktree"):
        microbot_engine._execute_local_dag(
            [{"node_id": "M00", "depends_on": [], "checkpoint_safe": True,
              "run": lambda _: {"status": "PASS"}}],
            checkpoint_path=repo / "checkpoint.json", checkpoint_key="a" * 64, repo_root=repo,
        )


def test_m01_preserves_blocked_workspace_guard_status(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    repo.mkdir()
    pdf = _private_pdf(tmp_path / "secure-vault")

    def gate_result(status: str, reason_code: str):
        return SimpleNamespace(
            status=status,
            reason_code=reason_code,
            issues=[],
            to_dict=lambda: {"status": status, "reason_code": reason_code, "issues": []},
        )

    monkeypatch.setattr(microbot_engine, "audit_git_copyright_safety", lambda _: gate_result("BLOCKED", "GIT_UNAVAILABLE"))
    monkeypatch.setattr(microbot_engine, "check_ownership_boundary", lambda _: gate_result("PASS", "OWNERSHIP_OK"))

    result = microbot_engine._run_m01_safe_pdf_guard(repo, pdf)

    assert result["status"] == "BLOCKED"
    assert result["reason_code"] == "GIT_UNAVAILABLE"


def test_missing_source_is_blocked_and_never_release_ready(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
    )

    assert report["overall_status"] == "BLOCKED"
    assert _by_id(report, "M00")["status"] == "BLOCKED"
    assert _by_id(report, "M01")["status"] == "BLOCKED"
    assert _by_id(report, "M02")["status"] == "BLOCKED"
    assert _coverage(report)["status"] == "WARN"
    assert report["candidate_ready"] is False
    assert report["release_authorized"] is False
    assert report["architecture_contract"] == "MICROBOT-ENGINE-ARCHITECTURE-M00-M16-v1.1"
    assert report["side_effects"] == {
        "writes_files": False,
        "writes_checkpoint": False,
        "network_access": False,
        "git_mutations": False,
        "official_files_mutated": False,
        "teacher_verdict_created": False,
    }
    assert report["scheduler"]["mode"] == "bounded_parallel_dag"
    assert report["scheduler"]["max_workers"] == 2
    assert report["scheduler"]["hard_timeout_enforced"] is (microbot_engine._hard_timeout_context() is not None)
    assert report["scheduler"]["checkpoint_resume_enabled"] is False
    assert report["scheduler"]["automatic_retries_enabled"] is False
    assert all(row["attempts"] == 1 for row in report["execution_plan"])


def test_valid_source_without_observation_is_blocked_and_coverage_warns(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)
    before = subprocess.check_output(["git", "status", "--porcelain"], cwd=repo, text=True)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
    )
    after = subprocess.check_output(["git", "status", "--porcelain"], cwd=repo, text=True)

    assert _by_id(report, "M00")["status"] == "PASS"
    assert _by_id(report, "M01")["status"] == "PASS"
    assert _by_id(report, "M02")["reason_code"] == "OBSERVATION_PACKET_REQUIRED"
    assert _by_id(report, "M02")["status"] == "BLOCKED"
    assert _coverage(report)["status"] == "WARN"
    assert report["overall_status"] == "BLOCKED"
    assert report["candidate_ready"] is False
    assert report["input_hashes"]["source_pdf_sha256"] == file_sha256(str(pdf))
    assert all(report["code_hashes"].values())
    assert before == after


def test_source_bound_observation_packet_passes_m02_but_not_coverage(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)
    observation_path = tmp_path / "observation_C305.json"
    observation_path.write_text(json.dumps(_observation(pdf)), encoding="utf-8")
    monkeypatch.setattr(microbot_engine, "verify_evidence_coverage_gate", _warn_coverage)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
        observation_path=observation_path,
    )
    repeated = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
        observation_path=observation_path,
    )

    assert report["run_id"] == repeated["run_id"]
    schema_path = Path(__file__).resolve().parents[1] / "agent" / "schemas" / "microbot-envelope-v1.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    required_envelope_fields = set(schema["required"])
    assert all(required_envelope_fields <= set(bot) for bot in report["bots"])
    assert report["envelope_version"] == "khshab.microbot-envelope/v1"
    assert report["repo_branch"] is not None and report["repo_commit"] is not None
    assert report["edition_id"] == "TEST-C305-EDITION-1"
    assert report["source_sha256"] == file_sha256(str(pdf))
    assert report["execution_plan"][2]["node_id"] == "M02"
    assert report["execution_plan"][2]["depends_on"] == ["M00", "M01"]
    assert report["execution_plan"][3]["supplemental"] is True
    assert _by_id(report, "M00")["bot_version"] == "0.1.0"
    assert _by_id(report, "M02")["run_id"] == report["run_id"]
    assert _by_id(report, "M02")["repo_branch"] == report["repo_branch"]
    assert _by_id(report, "M02")["edition_id"] == report["edition_id"]
    assert _by_id(report, "M02")["input_artifact_hashes"] == report["input_hashes"]
    assert _by_id(report, "M02")["evidence_refs"] == ["EV-SYNTHETIC-1"]
    assert _by_id(report, "M02")["requires_human"] is True
    assert _by_id(report, "M02")["skipped"] == []
    assert _by_id(report, "M00")["status"] == "PASS"
    assert _by_id(report, "M01")["status"] == "PASS"
    assert _by_id(report, "M02")["status"] == "PASS"
    assert _by_id(report, "M02")["metrics"]["source_sha256_matched"] is True
    assert _coverage(report)["gate_id"] == "G_ACHILLES_COVERAGE"
    assert _coverage(report)["status"] == "WARN"
    assert report["overall_status"] == "WARN"
    assert report["technical_preflight_pass"] is False
    assert report["candidate_ready"] is False


def test_observation_source_mismatch_fails_m02_closed(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)
    observation_path = tmp_path / "observation_C305.json"
    observation_path.write_text(json.dumps(_observation(pdf, source_sha="0" * 64)), encoding="utf-8")
    monkeypatch.setattr(microbot_engine, "verify_evidence_coverage_gate", _warn_coverage)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
        observation_path=observation_path,
    )

    assert report["overall_status"] == "FAIL"
    assert _by_id(report, "M02")["status"] == "FAIL"
    assert any(issue["error"] == "OBSERVATION_SOURCE_SHA_MISMATCH" for issue in _by_id(report, "M02")["issues"])


def test_malformed_observation_types_fail_closed_without_traceback(tmp_path: Path, monkeypatch) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)
    packet = _observation(pdf)
    packet["quality_scores"][0]["footer_alignment_status"] = []
    packet["evidence_ledger"]["EV-SYNTHETIC-1"]["evidence_kind"] = []
    packet["claims"][0]["confidence"] = []
    observation_path = tmp_path / "malformed_observation.json"
    observation_path.write_text(json.dumps(packet), encoding="utf-8")
    monkeypatch.setattr(microbot_engine, "verify_evidence_coverage_gate", _warn_coverage)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
        observation_path=observation_path,
    )

    assert report["overall_status"] == "FAIL"
    assert _by_id(report, "M02")["status"] == "FAIL"
    assert any(issue["error"] == "OBSERVATION_FOOTER_STATUS_INVALID" for issue in _by_id(report, "M02")["issues"])


def test_hash_mismatch_fails_closed(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf, sha="0" * 64)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
    )

    assert report["overall_status"] == "FAIL"
    assert _by_id(report, "M00")["status"] == "FAIL"
    assert any(issue["error"] == "PDF_SHA_MISMATCH" for issue in _by_id(report, "M00")["issues"])


def test_manifest_book_code_mismatch_fails_closed(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf, book_code="C205")

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
    )

    assert report["overall_status"] == "FAIL"
    assert any(issue["error"] == "BOOK_CODE_MISMATCH" for issue in _by_id(report, "M00")["issues"])


def test_manifest_pdf_filename_mismatch_fails_closed(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "secure-vault")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    payload["source_pdf"]["filename"] = "another-edition.pdf"
    manifest.write_text(json.dumps(payload), encoding="utf-8")

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
    )

    assert report["overall_status"] == "FAIL"
    assert any(issue["error"] == "PDF_FILENAME_MISMATCH" for issue in _by_id(report, "M00")["issues"])


def test_pdf_inside_git_worktree_is_rejected(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = repo / "authoring" / "C305.pdf"
    pdf.write_bytes(b"synthetic confidential-source sentinel")
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
    )

    assert report["overall_status"] == "FAIL"
    assert _by_id(report, "M00")["reason_code"] == "PDF_MUST_REMAIN_OUTSIDE_GIT"
    assert _by_id(report, "M01")["status"] == "FAIL"


def test_m01_rejects_public_quarantine_permissions(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    pdf = _private_pdf(tmp_path / "world-accessible-vault", directory_mode=0o755)
    manifest = _manifest(tmp_path / "book_manifest_C305.json", pdf)

    report = run_microbot_preflight(
        repo_root=repo,
        expected_book_code="C305",
        cartridge_path=cartridge,
        pdf_path=pdf,
        manifest_path=manifest,
    )

    assert report["overall_status"] == "FAIL"
    assert _by_id(report, "M00")["status"] == "PASS"
    assert _by_id(report, "M01")["reason_code"] == "QUARANTINE_DIRECTORY_PERMISSIONS_UNSAFE"


@pytest.mark.skipif(os.name != "posix", reason="secure checkpoint permission test requires POSIX")
def test_cli_microbot_preflight_checkpoint_resume_uses_private_file(tmp_path: Path, capsys) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    vault = tmp_path / "private-vault"
    vault.mkdir(mode=0o700)
    os.chmod(vault, 0o700)
    checkpoint = vault / "preflight.json"
    common = [
        "microbot-preflight",
        "--repo-root", str(repo),
        "--expected-book-code", "C305",
        "--cartridge", str(cartridge),
    ]

    first_rc = cli_main([*common, "--checkpoint", str(checkpoint)])
    first = json.loads(capsys.readouterr().out)
    second_rc = cli_main([*common, "--resume-checkpoint", str(checkpoint)])
    second = json.loads(capsys.readouterr().out)

    assert first_rc == second_rc == 2
    assert first["scheduler"]["checkpoint_resume_enabled"] is True
    assert first["scheduler"]["checkpoint_resumed"] is False
    assert first["side_effects"]["writes_files"] is True
    assert first["side_effects"]["official_files_mutated"] is False
    assert second["scheduler"]["checkpoint_resumed"] is True
    assert second["side_effects"]["writes_checkpoint"] is False
    assert second["run_id"] == first["run_id"]
    assert second["execution_plan"] == first["execution_plan"]
    assert len(second["scheduler"]["checkpoint_sha256"]) == 64


def test_cli_microbot_preflight_emits_json_and_blocked_exit(tmp_path: Path, capsys) -> None:
    repo = tmp_path / "repo"
    cartridge = _git_repo(repo)
    rc = cli_main([
        "microbot-preflight",
        "--repo-root", str(repo),
        "--expected-book-code", "C305",
        "--cartridge", str(cartridge),
    ])
    payload = json.loads(capsys.readouterr().out)

    assert rc == 2
    assert payload["engine"] == "M13_LOCAL_PREFLIGHT_MVP"
    assert payload["overall_status"] == "BLOCKED"
    assert payload["not_run"] == ["M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10",
                                   "M11", "M12", "M14", "M15", "M16"]
    assert payload["supplemental_gates"][0]["gate_id"] == "G_ACHILLES_COVERAGE"
