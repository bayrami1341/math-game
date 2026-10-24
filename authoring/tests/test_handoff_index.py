"""بستهٔ دسترسیِ ماشین‌خوان برای مدلِ مادر (`handoff.py` + `khshab-agent handoff-index`).

این آزمون‌ها تضمین می‌کنند که فهرستِ منتشرشده:
  1. از *کدِ واقعی* استخراج شده باشد (نه فهرستِ دستیِ کهنه‌شدنی)،
  2. SHA-256 هر ماژول با فایلِ روی دیسک برابر باشد،
  3. هیچ مادهٔ محرمانه‌ای (PDF/تصویر/توکن) نداشته باشد،
  4. مرزهای مجوز را صریح اعلام کند (چیزی اعطا نشده است)،
  5. فایلِ `authoring/MOTHER-AI-INDEX.json` در مخزن با همین سازنده هم‌خوان باشد.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from authoring.agent.cli import main as cli_main
from authoring.agent.handoff import (
    ENGINE_MODULES,
    NOT_GRANTED,
    ZAI_OWNED_PATHS,
    build_handoff_index,
    write_handoff_index,
)
from authoring.agent.models import file_sha256

REPO_ROOT = Path(__file__).resolve().parents[2]
COMMITTED_INDEX = REPO_ROOT / "authoring/MOTHER-AI-INDEX.json"
V103_WORKTREE = Path("/tmp/v103_ref")


def test_bundle_is_generated_from_real_code_with_verifiable_hashes(tmp_path: Path) -> None:
    bundle = build_handoff_index(REPO_ROOT)
    assert bundle["schema_version"] == "1.0.0"
    modules = {m["path"]: m for m in bundle["engine"]["modules"]}
    # همهٔ ماژول‌های هستهٔ موتور باید فهرست شده باشند
    for rel in ENGINE_MODULES:
        assert rel in modules, f"ماژولِ هستهٔ موتور در بسته نیست: {rel}"
    for rel, entry in modules.items():
        disk = REPO_ROOT / rel
        assert disk.exists()
        assert entry["sha256"] == file_sha256(str(disk)), f"SHA ماژول {rel} با دیسک نمی‌خواند"
        assert re.fullmatch(r"[0-9a-f]{64}", entry["sha256"])
        assert entry["lines"] > 0 and entry["bytes"] > 0

    ach = modules["authoring/agent/achilles_gate.py"]
    # توابعِ عمومیِ واقعیِ گیت باید در بسته دیده شوند
    for fn in ("verify_achilles_evidence_gate", "verify_evidence_coverage_gate", "bind_evidence_to_source"):
        assert fn in ach["public_api"], f"{fn} در API عمومیِ آشیل فهرست نشده"
    # کدهای fail-closed از خودِ کد استخراج شده‌اند
    for code in ("PDF_SHA_MISMATCH", "MANIFEST_PRINT_SHA_MISMATCH", "GREEN_ROWS_WITHOUT_EVIDENCE", "COVERAGE_UNKNOWN_NO_OBSERVATION"):
        assert code in ach["fail_closed_reason_codes"], f"کدِ {code} از کد استخراج نشد"


def test_bundle_lists_real_cli_subcommands_and_never_phantom_ones(tmp_path: Path) -> None:
    bundle = build_handoff_index(REPO_ROOT)
    names = {s["name"] for s in bundle["cli"]["subcommands"]}
    for expected in ("build-wave", "check-wave", "coverage", "reconcile-chunks", "record-verdict", "serve-viewer", "autopilot", "handoff-index", "heads"):
        assert expected in names, f"زیرفرمانِ واقعیِ {expected} در بسته نیست"
    assert "observe" not in names, "`observe` وجود خارجی ندارد و نباید در بسته باشد"
    cov = next(s for s in bundle["cli"]["subcommands"] if s["name"] == "coverage")
    assert "--cartridge" in cov["options"] and "--book-manifest" in cov["options"]


def test_bundle_contains_no_confidential_material(tmp_path: Path) -> None:
    bundle = build_handoff_index(REPO_ROOT)
    blob = json.dumps(bundle, ensure_ascii=False).lower()
    for suffix in (".pdf", ".png", ".jpg", ".jpeg", ".webp"):
        listed = [f["path"] for f in bundle.get("fixtures_non_confidential", []) if f["path"].lower().endswith(suffix)]
        assert listed == [], f"مادهٔ محرمانه در بسته فهرست شده: {listed}"
    assert "teacher_token" not in blob or "confidentiality_policy" in blob
    for token_hint in ("khshab_teacher_token=", "bearer ", "api_key"):
        assert token_hint not in blob, f"نشتِ احتمالیِ اعتبارنامه: {token_hint}"
    # سیاستِ محرمانگی صریحاً اعلام شده است
    assert bundle["confidentiality_policy"]["never_in_bundle_or_git"]
    assert bundle["zai_owned_paths_do_not_modify"] == ZAI_OWNED_PATHS


def test_bundle_declares_permission_boundaries_and_mother_ai_actions(tmp_path: Path) -> None:
    bundle = build_handoff_index(REPO_ROOT)
    assert bundle["not_granted"] == NOT_GRANTED
    envelope_schema = next(
        schema for schema in bundle["contract_schemas"]
        if schema["schema_id"] == "khshab.microbot-envelope/v1"
    )
    schema_path = REPO_ROOT / envelope_schema["path"]
    assert file_sha256(str(schema_path)) == envelope_schema["sha256"]
    schema_payload = json.loads(schema_path.read_text(encoding="utf-8"))
    assert {"bot_id", "bot_version", "run_id", "source_sha256", "evidence_refs"} <= set(schema_payload["required"])
    for forbidden in ("TEACHER_VERDICT", "RELEASE_AUTHORIZATION", "OFFICIAL_HEAD_CHANGE", "FINALITY_CLAIM", "AUTO_GREEN_PROMOTION"):
        assert forbidden in bundle["not_granted"]
    assert len(bundle["hard_invariants"]) >= 10
    ids = {inv["id"] for inv in bundle["hard_invariants"]}
    assert {"INV-03", "INV-04", "INV-05", "INV-06", "INV-07", "INV-08"} <= ids
    action_ids = {a["id"] for a in bundle["mother_ai_actions"]}
    assert {"W7", "W8", "PR2", "STAMP", "CANDIDATE", "C305"} <= action_ids
    # هر اقدامِ مادر باید صاحب و مرجع داشته باشد
    for a in bundle["mother_ai_actions"]:
        assert a["owner"] and a["reference"]


def test_bundle_official_heads_snapshot_matches_zai_manifest(tmp_path: Path) -> None:
    if not (V103_WORKTREE / "public/math-game/authoring/OFFICIAL-HEADS.json").exists():
        pytest.skip("مرجعِ رسمیِ v10.3-beta در این محیط mount نیست")
    bundle = build_handoff_index(REPO_ROOT, official_ref_root=V103_WORKTREE)
    heads = bundle["official_heads"]
    assert heads["available"] is True
    manifest = json.loads((V103_WORKTREE / "public/math-game/authoring/OFFICIAL-HEADS.json").read_text(encoding="utf-8"))
    assert heads["manifest_sha256"] == file_sha256(str(V103_WORKTREE / "public/math-game/authoring/OFFICIAL-HEADS.json"))
    for fam, info in manifest["heads"].items():
        assert heads["heads"][fam]["version"] == info["version"]
        assert heads["heads"][fam]["sha256"] == info["sha256"]
    g2 = heads["heads"]["KH-G2-MATH"]
    assert g2["version"] == "v0.5"
    assert g2["sha256"] == "f1f339a09a8cba3363c8c526e088063c2d733c62c5e7e4c236eba871f97d2656"
    assert "مهر معلم" in g2["teacher_note"] or "مُهر معلم" in g2["teacher_note"]


def test_cli_handoff_index_writes_bundle_and_exits_zero(tmp_path: Path, capsys) -> None:
    out = tmp_path / "nested" / "MOTHER-AI-INDEX.json"
    rc = cli_main(["handoff-index", "--repo-root", str(REPO_ROOT), "--output", str(out)])
    assert rc == 0
    summary = json.loads(capsys.readouterr().out)
    assert out.exists()
    assert re.fullmatch(r"[0-9a-f]{64}", summary["bundle_sha256"])
    assert summary["bundle_sha256"] == file_sha256(str(out))
    assert summary["engine_modules"] >= 16
    assert summary["official_heads_available"] is False  # بدون ریشهٔ رسمی، صادقانه گزارش می‌شود
    bundle = json.loads(out.read_text(encoding="utf-8"))
    assert bundle["official_heads"]["reason"] == "NO_OFFICIAL_REF_ROOT_GIVEN"


def test_committed_index_matches_regenerated_bundle(tmp_path: Path) -> None:
    """فایلِ منتشرشده در مخزن باید با خروجیِ همان سازنده هم‌خوان باشد (فهرستِ دستیِ کهنه ممنوع)."""
    assert COMMITTED_INDEX.exists(), "authoring/MOTHER-AI-INDEX.json باید در مخزن منتشر شده باشد"
    committed = json.loads(COMMITTED_INDEX.read_text(encoding="utf-8"))
    fresh = build_handoff_index(REPO_ROOT)

    # فهرستِ ماژول‌ها و SHAهایِ آنان باید یکسان باشد
    assert {m["path"] for m in committed["engine"]["modules"]} == {m["path"] for m in fresh["engine"]["modules"]}
    for fresh_mod in fresh["engine"]["modules"]:
        # handoff.py خود پس از تولید بسته تغییر می‌کند؛ فقط برای آن مسیر انعطاف می‌دهیم
        if fresh_mod["path"].endswith("handoff.py"):
            continue
        committed_mod = next(m for m in committed["engine"]["modules"] if m["path"] == fresh_mod["path"])
        assert committed_mod["sha256"] == fresh_mod["sha256"], f"SHA ماژولِ {fresh_mod['path']} در بستهٔ منتشرشده کهنه است"

    assert committed["not_granted"] == fresh["not_granted"]
    assert {i["id"] for i in committed["hard_invariants"]} == {i["id"] for i in fresh["hard_invariants"]}
    assert {s["name"] for s in committed["cli"]["subcommands"]} == {s["name"] for s in fresh["cli"]["subcommands"]}
    # بستهٔ منتشرشده نباید محرمانه داشته باشد
    assert all(not f["path"].lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".webp")) for f in committed.get("fixtures_non_confidential", []))
