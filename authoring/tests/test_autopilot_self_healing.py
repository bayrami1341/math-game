"""End-to-end tests for Persistent Self-Healing `AutopilotSupervisor` (`autopilot.py`)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from authoring.agent.autopilot import AutopilotSupervisor, GitHubSyncManager
from authoring.agent.models import WaveSpecV2

REPO_ROOT = Path(__file__).resolve().parents[2]
V103_WORKTREE = Path("/tmp/v103_ref")


def _active_ref_root() -> Path:
    if (REPO_ROOT / "public/math-game/authoring/OFFICIAL-HEADS.json").exists():
        return REPO_ROOT
    if (V103_WORKTREE / "public/math-game/authoring/OFFICIAL-HEADS.json").exists():
        return V103_WORKTREE
    return REPO_ROOT


def test_autopilot_requires_single_approval_then_self_heals_six_defect_classes(tmp_path: Path) -> None:
    """Injects ALL 6 authoring bug classes into a real `WaveSpecV2` and proves autonomous self-healing."""
    ref_root = _active_ref_root()
    if (ref_root / "public/math-game/authoring/khshab-G3-MATH_v0.7.xlsx").exists():
        clean_spec = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G3_test_v08.json")
    else:
        clean_spec = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json")

    sabotaged = clean_spec.to_dict()
    sabotaged["wave_id"] = "wave-sabotaged-self-heal-test"
    sabotaged["s1_rows"] = sabotaged["s1_rows"][:1]
    lid = sabotaged["s1_rows"][0]["id"]
    sabotaged["question_rows"] = sabotaged["question_rows"][:4]
    for idx, q in enumerate(sabotaged["question_rows"], start=1):
        q["anchor"] = lid
        if not q.get("qid"):
            q["qid"] = f"Q-{2100 + idx}"

    # Defect 1 (H4): Forged AI green stamps ('تأییدشده' / 'تأیید شده') on S1 and Question rows!
    sabotaged["s1_rows"][0]["status"] = "تأییدشده"
    sabotaged["question_rows"][0]["status"] = "تأیید شده"

    # Defect 2 (H1): Leaked ASCII digits + Arabic Yeh/Kaf in Persian stem & choices!
    sabotaged["question_rows"][0] = {
        **sabotaged["question_rows"][0],
        "stem": "حاصل 7 × 8 در كلاس چند است؟",
        "opts": ["56", "48", "64", "15"],
        # Defect 3 (H6): Wrong claimed answer key ('ب'=48 instead of 'الف'=56)!
        "ans": "ب",
        "trace": "7 * 8 = 56",
        "answer_val": 56,
        "map": "الف→E_SKIP_UNDERCOUNT؛ ج→E_SKIP_OVERCOUNT؛ د→E_ADD_CONFUSION",
    }

    # Defect 4 (H3): Brand-new error code missing from `atlas_rows`!
    q1_map = sabotaged["question_rows"][1]["map"]
    arrow_pos = q1_map.find("→")
    semi_pos = q1_map.find("؛", arrow_pos)
    sabotaged["question_rows"][1]["map"] = (
        q1_map[: arrow_pos + 1] + "E_AUTOPILOT_NEW_DIAGNOSTIC" + (q1_map[semi_pos:] if semi_pos != -1 else "")
    )

    # Defect 5 (H2): Broken S1 column-11 anchor list (`T7` drift)!
    sabotaged["s1_rows"][0]["anchor"] = "Q-999999"

    # Defect 6 (H5): Skewed answer key distribution (force all other keys to 'الف' so 4/4 would be 'الف' after H6)!
    key_idx = {"الف": 0, "ب": 1, "ج": 2, "د": 3}
    for idx in (1, 2, 3):
        q = sabotaged["question_rows"][idx]
        cur = q["ans"]
        if cur != "الف":
            ci = key_idx[cur]
            q["opts"][0], q["opts"][ci] = q["opts"][ci], q["opts"][0]
            q["map"] = q["map"].replace("الف→", "__TMP__→").replace(f"{cur}→", "الف→").replace("__TMP__→", f"{cur}→")
            q["ans"] = "الف"

    bad_spec_path = tmp_path / "sabotaged_wave.json"
    bad_spec_path.write_text(json.dumps(sabotaged, ensure_ascii=False, indent=2), encoding="utf-8")

    # Also test Universal Official-Head Hold Rule (`base_cartridge_filename = khshab-G2-MATH_v0.6.xlsx` > head)!
    wave5_spec = WaveSpecV2.from_json_file(REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_ch4_v05.json").to_dict()
    wave5_spec["wave_id"] = "wave-5-g2-must-hold"
    wave5_spec["base_cartridge_filename"] = "khshab-G2-MATH_v0.6.xlsx"
    wave5_path = tmp_path / "wave5_hold.json"
    wave5_path.write_text(json.dumps(wave5_spec, ensure_ascii=False, indent=2), encoding="utf-8")

    sup = AutopilotSupervisor(
        REPO_ROOT,
        official_ref_root=ref_root,
        state_dir=tmp_path / "state",
        work_dir=tmp_path / "work",
    )

    # 1. Without `--approve-once`, supervisor politely blocks waiting for single user approval
    pre = sup.run_waves([bad_spec_path, wave5_path], approve_once=False)
    assert pre["status"] == "AWAITING_SINGLE_APPROVAL"

    # 2. With `--approve-once` (bound to roadmap SHA + domain), supervisor diagnoses & heals ALL 6 defects AND holds Wave 5 cleanly!
    # HELD must NOT be counted as PASS — overall status must reflect held (point 3)
    report_md = tmp_path / "MORNING-REPORT.fa.md"
    res = sup.run_waves([bad_spec_path, wave5_path], approve_once=True, report_markdown_path=report_md)
    assert res["status"] != "PASS", f"HELD wave must not be counted as PASS, got {res['status']}"
    assert res["status"] in ("PARTIAL_WITH_HELD", "HELD_AWAITING_HEAD", "PARTIAL_WITH_BLOCKERS"), res
    assert "wave-sabotaged-self-heal-test" in res["completed_wave_ids"]
    assert "wave-5-g2-must-hold" in res["held_wave_ids"]
    assert res["healed_incident_count"] >= 6
    assert report_md.exists()

    # 3. Verify healed spec stripped all green AI stamps, registered the code cleanly, realigned causal code (H7), and balanced keys!
    healed_doc = WaveSpecV2.from_json_file(bad_spec_path)
    assert healed_doc.s1_rows[0].status == "نیاز به تأیید"
    assert all(q.status == "نیاز به تأیید" for q in healed_doc.question_rows)
    assert sorted(q.ans for q in healed_doc.question_rows) == ["الف", "ب", "ج", "د"]
    assert any(
        e.code_raw == "E_AUTOPILOT_NEW_DIAGNOSTIC" and e.status == "نیاز به تأیید" for e in healed_doc.atlas_rows
    )
    state_json = json.loads((tmp_path / "state/autopilot_state.json").read_text(encoding="utf-8"))
    rules_fired = {a["rule"] for a in state_json["healed_incidents"]}
    assert {
        "H1_PERSIAN_ORTHOGRAPHY",
        "H2_BIJECTIVE_T7_ANCHORS",
        "H3_REGISTER_MISSING_ERROR_CODE",
        "H4_STRIP_FORGED_GREEN_STAMP",
        "H5_REBALANCE_CHOICE_KEYS",
        "H6_REALIGN_SOLVER_KEY",
        "H7_REALIGN_CAUSAL_DISTRACTOR_CODE",
    }.issubset(rules_fired)


def test_g0_ownership_and_confidential_media_guard_blocks_illegal_commits(tmp_path: Path) -> None:
    """Proves `GitHubSyncManager` immediately blocks commits containing Z.ai files or leaked `.pdf`/`.png`."""
    mini_repo = tmp_path / "mini_repo"
    mini_repo.mkdir()
    subprocess.run(["git", "init"], cwd=mini_repo, check=True, capture_output=True)
    gm = GitHubSyncManager(mini_repo)
    assert gm.verify_ownership_and_copyright_hygiene().status == "PASS"

    (mini_repo / "page_crop.png").write_bytes(b"PNGDATA")
    (mini_repo / "workshop-core.js").write_text("// touched", encoding="utf-8")

    g0 = gm.verify_ownership_and_copyright_hygiene()
    assert g0.status == "FAIL"
    reasons = {iss["reason"] for iss in g0.issues}
    assert reasons == {"FORBIDDEN_CONFIDENTIAL_MEDIA_OR_PDF", "FORBIDDEN_ZAI_OWNED_PATH"}
