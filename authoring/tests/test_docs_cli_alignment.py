"""بند ۳ بازبینی: هم‌ترازیِ *ماشینی* مستندات با CLI واقعی.

هر نمونه‌فرمانِ `authoring/USAGE-KHSHAB-AGENT-v24.fa.md` در CI با
`authoring.agent.cli.build_parser()` اعتبارسنجی می‌شود؛ بنابراین:
  - فرمانِ خیالی (مثل `observe`) نمی‌تواند در راهنما بماند،
  - گزینهٔ اشتباه (مثل `--spec` به‌جای `--wave-spec`) رد می‌شود،
  - جفت‌کردنِ manifest کتابِ دوم با PDF کتابِ سوم ممنوع است.
"""

from __future__ import annotations

import argparse
import json
import re
import shlex
from pathlib import Path

import pytest

from authoring.agent.cli import build_parser
from authoring.agent.cli import main as cli_main

REPO_ROOT = Path(__file__).resolve().parents[2]
USAGE_DOC = REPO_ROOT / "authoring/USAGE-KHSHAB-AGENT-v24.fa.md"
DRYRUN_DOC = REPO_ROOT / "authoring/G2-V12-CONNECTION-DRYRUN.fa.md"
ALL_DOCS = (USAGE_DOC, DRYRUN_DOC)
CLI_PREFIXES = ("python3 -m authoring.agent.cli ", "khshab-agent ")


def _subcommands() -> set[str]:
    parser = build_parser()
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            return set(action.choices.keys())
    raise AssertionError("CLI هیچ زیرفرمانی ندارد")


def _doc_command_lines(docs=ALL_DOCS) -> list[str]:
    """استخراجِ همهٔ فرمان‌های `khshab-agent` از بلوک‌های ```bash مستندات."""
    text = "\n".join(Path(d).read_text(encoding="utf-8") for d in docs)
    lines: list[str] = []
    for block in re.findall(r"```bash\n(.*?)```", text, re.S):
        joined = block.replace("\\\n", " ")
        for raw in joined.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            for prefix in CLI_PREFIXES:
                if line.startswith(prefix):
                    lines.append(line[len(prefix):].strip())
                    break
    return lines


def test_usage_doc_exists_and_documents_real_subcommands() -> None:
    assert USAGE_DOC.exists(), "راهنمای هم‌تراز با CLI باید در مخزن باشد"
    subs = _subcommands()
    text = USAGE_DOC.read_text(encoding="utf-8")
    for sub in sorted(subs):
        assert sub in text, f"زیرفرمانِ واقعی `{sub}` در راهنما مستند نشده است"


def test_no_phantom_observe_subcommand_and_doc_states_the_correction() -> None:
    """`observe` در CLI وجود ندارد؛ راهنما باید صریحاً همین را بگوید."""
    assert "observe" not in _subcommands()
    text = USAGE_DOC.read_text(encoding="utf-8")
    assert "فرمانی به نام `observe` در CLI **وجود ندارد**" in text
    assert "reconcile-chunks --chunks-dir" in text
    assert "build-wave --wave-spec" in text and "--output" in text


def test_every_documented_command_parses_against_real_cli() -> None:
    cmds = _doc_command_lines()
    assert len(cmds) >= 12, f"دست‌کم ۱۲ نمونه‌فرمان باید کنترل شود، اما {len(cmds)} یافت شد"
    parser = build_parser()
    for cmd in cmds:
        try:
            argv = shlex.split(cmd)
        except ValueError as exc:  # pragma: no cover
            pytest.fail(f"فرمانِ مستند قابلِ تجزیه نیست: {cmd!r} ({exc})")
        try:
            args = parser.parse_args(argv)
        except SystemExit:
            pytest.fail(f"فرمانِ مستند با CLI واقعی نمی‌خواند: `{cmd}`")
        assert getattr(args, "cmd", None), f"زیرفرمان تشخیص نشد: `{cmd}`"


def test_documented_manifest_and_pdf_are_never_cross_paired() -> None:
    """manifest کتابِ دوم هرگز با PDF کتابِ سوم جفت نمی‌شود (بند ۳/۴)."""
    for cmd in _doc_command_lines():
        if "book_manifest_C205.json" in cmd:
            assert "C305" not in cmd, f"جفتِ ناسازگارِ C205/C305 در راهنما: `{cmd}`"
        if "book_manifest_C305.json" in cmd:
            assert "C205" not in cmd, f"جفتِ ناسازگارِ C305/C205 در راهنما: `{cmd}`"
    text = USAGE_DOC.read_text(encoding="utf-8")
    assert "جفت‌کردنِ `book_manifest_C205.json` با `C305.pdf` **غلط است**" in text


def test_documented_autopilot_never_advertises_automatic_push_or_finality() -> None:
    cmds = _doc_command_lines()
    autopilot_cmds = [c for c in cmds if c.startswith("autopilot")]
    assert autopilot_cmds, "فرمانِ autopilot باید در راهنما باشد"
    for cmd in autopilot_cmds:
        assert "--git-push" not in cmd, "راهنما نباید push خودکار را نمونه بدهد"
        assert "--approve-once" not in cmd, "نمونهٔ پیش‌فرض نباید بی‌قیدِ `--approve-once` اجرا شود"
    text = USAGE_DOC.read_text(encoding="utf-8")
    assert "TECHNICAL_EXECUTION_ONLY" in text
    assert "release_authorization=NOT_GRANTED" in text or "NOT_GRANTED" in text


def test_documented_viewer_defaults_are_secure() -> None:
    parser = build_parser()
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            view = action.choices["serve-viewer"]
            host_default = None
            for a in view._actions:
                if "--host" in getattr(a, "option_strings", []):
                    host_default = a.default
            assert host_default == "127.0.0.1", f"پیش‌فرضِ میزبانیِ ناامن: {host_default}"
    text = USAGE_DOC.read_text(encoding="utf-8")
    assert "--host 127.0.0.1" in text
    assert "KHSHAB_TEACHER_TOKEN" in text
    assert "TEACHER_TOKEN_INVALID_OR_MISSING" in text


def test_teacher_token_file_is_outside_git() -> None:
    gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "authoring/audit/teacher_token.txt" in gitignore, "فایلِ توکنِ معلم باید در .gitignore باشد"


# ---------------------------------------------------------------------------
# اجرای واقعیِ نمونه‌فرمان‌های مستند (نه فقط تجزیهٔ آرگومان)
# ---------------------------------------------------------------------------
def test_documented_commands_are_actually_executable(tmp_path: Path, capsys, monkeypatch) -> None:
    """دست‌کم این چهار فرمانِ مستند باید بدون خطا اجرا شوند و خروجیِ JSON بدهند."""
    monkeypatch.delenv("KHSHAB_TEACHER_TOKEN", raising=False)
    out_xlsx = tmp_path / "KH-G2-MATH_v1.2_dryrun.xlsx"
    registry = tmp_path / "id_registry_v12.json"
    spec = REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_v12_incremental.json"

    # ۱) build-wave
    rc = cli_main([
        "build-wave", "--wave-spec", str(spec), "--output", str(out_xlsx), "--registry", str(registry),
    ])
    assert rc == 0, "build-wave باید روی نمونهٔ افزایشیِ G2 v1.2 موفق شود"
    payload = json.loads(capsys.readouterr().out)
    assert payload["gate"]["status"] == "PASS"
    assert len(payload["output_sha256"]) == 64
    kd = payload["details"]["keyed_diff_summary"]
    # هیچ ردیفِ رسمی جابه‌جا/حذف نشده و هیچ سلولِ رسمی تغییر نکرده است
    assert kd["removed_row_count"] == 0 and kd["changed_cell_count"] == 0
    assert kd["added_row_count"] == 2
    assert payload["details"]["applied_patches"] == []
    assert payload["details"]["allocated_qids"] == [] and payload["details"]["allocated_eids"] == []
    assert len(set(payload["details"]["allocated_lids"])) == len(payload["details"]["allocated_lids"])

    # ۲) coverage روی نامزدِ ساخته‌شده
    rc_cov = cli_main([
        "coverage", "--cartridge", str(out_xlsx),
        "--observation", str(REPO_ROOT / "authoring/agent/fixtures/observation_C205.json"),
        "--book-manifest", str(REPO_ROOT / "authoring/agent/fixtures/book_manifest_C205.json"),
        "--pagemap", str(REPO_ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx"),
        "--expected-book-code", "C205",
    ])
    cov = json.loads(capsys.readouterr().out)
    assert cov["gate_id"] == "G_ACHILLES_COVERAGE"
    assert cov["status"] in ("WARN", "PASS")
    assert cov["metrics"]["rows_with_evidence"] >= 1
    # هیچ سبزِ تازه‌ای ساخته نشده است
    assert cov["metrics"]["green_rows"] == 8
    assert rc_cov == (0 if cov["status"] == "PASS" else 1)

    # ۳) coverage با کد کتابِ ناسازگار → fail-closed
    rc_bad = cli_main([
        "coverage", "--cartridge", str(out_xlsx),
        "--observation", str(REPO_ROOT / "authoring/agent/fixtures/observation_C205.json"),
        "--book-manifest", str(REPO_ROOT / "authoring/agent/fixtures/book_manifest_C205.json"),
        "--expected-book-code", "C305",
    ])
    bad = json.loads(capsys.readouterr().out)
    assert rc_bad == 1 and bad["status"] == "FAIL" and bad["reason_code"] == "EXPECTED_BOOK_CODE_MISMATCH"

    # ۴) reconcile-chunks
    rc_rec = cli_main([
        "reconcile-chunks",
        "--chunks-dir", str(REPO_ROOT / "authoring/agent/fixtures/g3_overlap_chunks"),
        "--output", str(tmp_path / "reconcile_g3.json"),
    ])
    rec = json.loads(capsys.readouterr().out)
    assert rc_rec == 0 and rec["compared_page_count"] > 0

    # ۵) keyed-diff
    rc_diff = cli_main([
        "keyed-diff",
        str(REPO_ROOT / "authoring/khshab-G2-MATH_v0.4_official.xlsx"),
        str(REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx"),
    ])
    diff = json.loads(capsys.readouterr().out)
    assert rc_diff == 0 and diff["summary"]["removed_row_count"] == 0

    # ۶) record-verdict بدون احراز هویت → کدِ ۲ و هیچ حکمی ثبت نمی‌شود
    rc_v = cli_main([
        "record-verdict", "--repo-root", str(tmp_path), "--verdict-id", "TV-X",
        "--scope", "ROW_APPROVED", "--actor", "ایجنت", "--actor-role", "human_teacher",
        "--target-ids", "L-900", "--target-file", str(out_xlsx),
    ])
    verdict_out = json.loads(capsys.readouterr().out)
    assert rc_v == 2 and verdict_out["recorded"] is None
