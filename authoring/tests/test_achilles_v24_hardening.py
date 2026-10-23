"""سخت‌سازیِ v2.4 برای اتصالِ امنِ نامزدِ G2 v1.2 (بندهای ۲، ۴، ۵، ۶ بازبینی).

این آزمون‌ها سه ادعا را *با شاهدِ اجرایی* اثبات می‌کنند:
  1. گیتِ پوششِ شاهد مستقل است، عددی است، و ردیفِ بی‌شاهد را زرد نگه می‌دارد؛
     PASS آن هرگز «تکمیلِ مشاهده» یا «آمادگیِ انتشار» نیست.
  2. اتصالِ شاهد به SHA واقعیِ PDF + کد کتاب + manifest همان چاپ + آفستِ اثبات‌شده
     مقید است و هر ناسازگاری `fail-closed` گزارش می‌شود.
  3. `--approve-once` فقط اجازهٔ اجرای فنی است و رأیِ معلم/اجازهٔ انتشارِ خودکار
     در هیچ مسیری (CLI یا HTTP) با رشتهٔ نقشِ اعلامی ساخته نمی‌شود.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import openpyxl
import pytest

from authoring.agent.achilles_gate import (
    bind_evidence_to_source,
    verify_achilles_evidence_gate,
    verify_evidence_coverage_gate,
)
from authoring.agent.autopilot import AutopilotSupervisor, _roadmap_approval_proof
from authoring.agent.cli import main as cli_main
from authoring.agent.governance import GovernanceLedger, authenticate_teacher, expected_teacher_token

REPO_ROOT = Path(__file__).resolve().parents[2]
G2_V05 = REPO_ROOT / "authoring/khshab-G2-MATH_v0.5.xlsx"
OBS_C205 = REPO_ROOT / "authoring/agent/fixtures/observation_C205.json"
MANIFEST_C205 = REPO_ROOT / "authoring/agent/fixtures/book_manifest_C205.json"
PAGEMAP_G2 = REPO_ROOT / "authoring/PAGE-MAP-KH-G2-MATH-v1_verified.xlsx"
C205_PDF_SHA = "a93934b6c418d4c6efe5ebb109bbcfe4f5fb6024fa1f3b1b309a4ff6da2746de"


# ---------------------------------------------------------------------------
# بند ۲ — گیتِ مستقلِ پوششِ شاهد
# ---------------------------------------------------------------------------
def test_coverage_gate_reports_measurable_counts_and_keeps_rows_yellow(tmp_path: Path) -> None:
    gate = verify_evidence_coverage_gate(
        G2_V05,
        observation_json_path=OBS_C205,
        book_manifest_path=MANIFEST_C205,
        pagemap_xlsx_path=PAGEMAP_G2,
        repo_root=REPO_ROOT,
        expected_book_code="C205",
    )
    m = gate.metrics
    # عددی و روشن
    assert m["rows_with_evidence"] == 51
    assert m["rows_without_evidence"] == 3
    assert m["rows_mismatch"] == 0
    assert m["ledger_size"] == 162
    assert m["proven_offset"] == 6
    assert set(m["without_evidence_ids"]) == {"L-101", "L-201", "L-401"}
    # پوششِ کامل نیست → PASS نمی‌دهد، اما ردیف‌ها را هم رد/سبز نمی‌کند
    assert gate.status == "WARN"
    assert gate.reason_code == "COVERAGE_INCOMPLETE_YELLOW_REMAINS"

    # ردیف‌های بی‌شاهد در خودِ خشاب هنوز زردند (هیچ ارتقای خودکاری رخ نداده)
    wb = openpyxl.load_workbook(G2_V05, data_only=True)
    ws = wb["نقشهٔ کتاب (S1)"]
    status_by_id = {}
    for r in range(3, ws.max_row + 1):
        lid = str(ws.cell(r, 1).value or "").strip()
        if lid == "یادداشت" or not lid:
            break
        status_by_id[lid] = str(ws.cell(r, 13).value or "").strip()
    wb.close()
    for lid in m["without_evidence_ids"]:
        assert status_by_id[lid] == "نیاز به تأیید", f"{lid} باید زرد بماند"


def test_hallucination_pass_without_ledger_is_neither_coverage_nor_release(tmp_path: Path) -> None:
    """`PASS/ACHILLES_NO_LEDGER_BUT_NO_GREEN_RISK` نباید «بررسیِ صفحه‌ها» خوانده شود."""
    cand = tmp_path / "no_ledger_candidate.xlsx"
    shutil.copyfile(G2_V05, cand)

    ach = verify_achilles_evidence_gate(cand, observation_json_path=None, repo_root=None)
    assert ach.status == "PASS"
    assert ach.reason_code == "ACHILLES_NO_LEDGER_BUT_NO_GREEN_RISK"

    cov = verify_evidence_coverage_gate(cand, observation_json_path=None, repo_root=None, book_manifest_path=None)
    # بدون دفترِ شاهد، پوشش *نامعلوم* است — هرگز PASS
    assert cov.status == "WARN"
    assert cov.reason_code == "COVERAGE_UNKNOWN_NO_OBSERVATION"
    assert cov.metrics["rows_with_evidence"] == 0
    forbidden = ("تکمیل", "آمادگی انتشار", "RELEASE", "منتشر")
    for word in forbidden:
        assert word not in cov.summary or "نه" in cov.summary, f"خلاصه نباید ادعای {word} داشته باشد: {cov.summary}"


def test_green_row_without_evidence_fails_coverage_gate(tmp_path: Path) -> None:
    cand = tmp_path / "forged_green.xlsx"
    shutil.copyfile(G2_V05, cand)
    wb = openpyxl.load_workbook(cand)
    ws = wb["نقشهٔ کتاب (S1)"]
    flipped = None
    for r in range(3, ws.max_row + 1):
        lid = str(ws.cell(r, 1).value or "").strip()
        if lid == "L-401":  # ردیفی که شاهد ندارد
            ws.cell(r, 13).value = "تأییدشده"
            flipped = lid
            break
    assert flipped == "L-401"
    wb.save(cand)
    wb.close()

    gate = verify_evidence_coverage_gate(
        cand,
        observation_json_path=OBS_C205,
        book_manifest_path=MANIFEST_C205,
        pagemap_xlsx_path=PAGEMAP_G2,
        repo_root=REPO_ROOT,
        expected_book_code="C205",
    )
    assert gate.status == "FAIL"
    assert gate.reason_code == "GREEN_ROWS_WITHOUT_EVIDENCE"
    assert "L-401" in json.dumps(gate.issues, ensure_ascii=False)


# ---------------------------------------------------------------------------
# بند ۴ — اتصال به SHA واقعیِ PDF، کد کتاب، manifest همان چاپ و آفستِ اثبات‌شده
# ---------------------------------------------------------------------------
def test_binding_requires_real_pdf_sha_book_code_and_same_print(tmp_path: Path) -> None:
    obs = json.loads(OBS_C205.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_C205.read_text(encoding="utf-8"))

    ok = bind_evidence_to_source(obs, book_manifest=manifest, expected_book_code="C205")
    assert ok["status"] == "PASS" and ok["reason_code"] == "SOURCE_BINDING_VERIFIED"
    assert ok["metrics"]["manifest_offset"] == 6
    assert ok["metrics"]["ledger_sha_variants"] == 1
    assert ok["metrics"]["mismatched_ledger_entries"] == 0

    # ۱) کد کتابِ اشتباه
    bad_code = bind_evidence_to_source(obs, book_manifest=manifest, expected_book_code="C305")
    assert bad_code["status"] == "FAIL" and bad_code["reason_code"] == "EXPECTED_BOOK_CODE_MISMATCH"

    # ۲) manifestِ چاپِ دیگر (SHA متفاوت)
    other_print = json.loads(json.dumps(manifest))
    other_print["source_pdf"]["sha256"] = "1" * 64
    bad_print = bind_evidence_to_source(obs, book_manifest=other_print, expected_book_code="C205")
    assert bad_print["status"] == "FAIL" and bad_print["reason_code"] == "MANIFEST_PRINT_SHA_MISMATCH"

    # ۳) SHA واقعیِ فایل PDF ورودی متفاوت است
    fake_pdf = tmp_path / "not_the_book.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 this is not C205")
    bad_pdf = bind_evidence_to_source(obs, book_manifest=manifest, pdf_path=fake_pdf, expected_book_code="C205")
    assert bad_pdf["status"] == "FAIL" and bad_pdf["reason_code"] == "PDF_SHA_MISMATCH"
    assert bad_pdf["metrics"]["actual_pdf_sha256"] != C205_PDF_SHA

    # ۴) PDF در دسترس نیست → نمی‌توان اثبات کرد (fail-closed)
    missing = bind_evidence_to_source(obs, book_manifest=manifest, pdf_path=tmp_path / "absent.pdf", expected_book_code="C205")
    assert missing["status"] == "FAIL" and missing["reason_code"] == "SOURCE_PDF_UNAVAILABLE"

    # ۵) شاهدی از منبع/کتابِ دیگر در دفتر
    mixed = json.loads(json.dumps(obs))
    victim = next(iter(mixed["evidence_ledger"]))
    mixed["evidence_ledger"][victim]["source_sha256"] = "2" * 64
    bad_entry = bind_evidence_to_source(mixed, book_manifest=manifest, expected_book_code="C205")
    assert bad_entry["status"] == "FAIL" and bad_entry["reason_code"] == "LEDGER_SOURCE_BINDING_MISMATCH"

    # ۶) رشتهٔ ۶۴رقمی به‌تنهایی کافی نیست — SHA باید با فایلِ واقعی برابر باشد
    assert obs["source_pdf_sha256"] == C205_PDF_SHA
    assert len(C205_PDF_SHA) == 64


def test_coverage_gate_fails_closed_on_source_and_offset_mismatch(tmp_path: Path) -> None:
    # کد کتابِ اشتباه در سطحِ گیت
    g1 = verify_evidence_coverage_gate(
        G2_V05, observation_json_path=OBS_C205, book_manifest_path=MANIFEST_C205,
        pagemap_xlsx_path=PAGEMAP_G2, repo_root=REPO_ROOT, expected_book_code="C305",
    )
    assert g1.status == "FAIL" and g1.reason_code == "EXPECTED_BOOK_CODE_MISMATCH"

    # PDFِ واقعیِ ناسازگار
    fake_pdf = tmp_path / "fake_C205.pdf"
    fake_pdf.write_bytes(b"%PDF-1.4 fake")
    g2 = verify_evidence_coverage_gate(
        G2_V05, observation_json_path=OBS_C205, book_manifest_path=MANIFEST_C205,
        pdf_path=fake_pdf, pagemap_xlsx_path=PAGEMAP_G2, repo_root=REPO_ROOT, expected_book_code="C205",
    )
    assert g2.status == "FAIL" and g2.reason_code == "PDF_SHA_MISMATCH"

    # آفستِ manifest با آفستِ نقشهٔ مادر ناسازگار است
    bad_offset = json.loads(MANIFEST_C205.read_text(encoding="utf-8"))
    bad_offset["pagination"]["pdf_minus_book_offset"] = 7
    bad_offset_path = tmp_path / "manifest_offset7.json"
    bad_offset_path.write_text(json.dumps(bad_offset, ensure_ascii=False), encoding="utf-8")
    g3 = verify_evidence_coverage_gate(
        G2_V05, observation_json_path=OBS_C205, book_manifest_path=bad_offset_path,
        pagemap_xlsx_path=PAGEMAP_G2, repo_root=REPO_ROOT, expected_book_code="C205",
    )
    assert g3.status == "FAIL" and g3.reason_code == "PROVEN_OFFSET_CONFLICT"

    # هیچ PDF/تصویری در Git نیست (بند ۴)
    tracked = [p for p in REPO_ROOT.rglob("*.pdf") if ".git" not in p.parts]
    assert tracked == [], f"فایل PDF در فضای مخزن: {tracked[:3]}"


# ---------------------------------------------------------------------------
# بند ۵ و ۶ — مرزِ مجوزها و احراز هویت
# ---------------------------------------------------------------------------
def test_approve_once_is_technical_permission_not_teacher_verdict(tmp_path: Path) -> None:
    proof = _roadmap_approval_proof(REPO_ROOT)
    assert proof is not None
    assert proof["permission_scope"] == "TECHNICAL_EXECUTION_ONLY"
    assert proof["teacher_verdict_granted"] is False
    assert proof["release_authorization"] == "NOT_GRANTED"
    assert proof["not_a_consent_document"] is True
    assert len(proof["roadmap_sha256"]) == 64

    spec = REPO_ROOT / "authoring/agent/fixtures/wave_spec_G2_v12_incremental.json"
    sup = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=tmp_path / "state", work_dir=tmp_path / "work")
    denied = sup.run_waves([spec], approve_once=False)
    assert denied["status"] == "AWAITING_SINGLE_APPROVAL"

    report = tmp_path / "MORNING-REPORT.fa.md"
    sup2 = AutopilotSupervisor(REPO_ROOT, official_ref_root=REPO_ROOT, state_dir=tmp_path / "state2", work_dir=tmp_path / "work2")
    res = sup2.run_waves([spec], approve_once=True, report_markdown_path=report)
    # در این چیدمان (بدون OFFICIAL-HEADS.json) موج نگه داشته می‌شود؛ مهم مرزِ مجوزهاست
    assert res["status"] in ("HELD_AWAITING_HEAD", "PARTIAL_WITH_HELD", "PASS", "BLOCKED", "PARTIAL_WITH_BLOCKERS")
    text = report.read_text(encoding="utf-8")
    assert "TECHNICAL_EXECUTION_ONLY" in text
    assert "NOT_GRANTED" in text
    assert "رأی معلم" in text
    # هیچ حکمِ معلمی توسط اجرا ساخته نشده است
    ledger = GovernanceLedger(REPO_ROOT / "authoring/audit/verdicts_C205.json")
    assert all(v.scope != "RELEASE_AUTHORIZED" for v in ledger.verdicts)


def test_record_verdict_cli_rejects_role_claim_without_server_token(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("KHSHAB_TEACHER_TOKEN", raising=False)
    target = tmp_path / "target.xlsx"
    shutil.copyfile(G2_V05, target)
    argv = [
        "record-verdict", "--repo-root", str(tmp_path), "--verdict-id", "TV-FAKE-1",
        "--scope", "ROW_APPROVED", "--actor", "یک فراخوانندهٔ CLI", "--actor-role", "human_teacher",
        "--target-ids", "L-401", "--target-file", str(target),
    ]
    rc = cli_main(argv)
    assert rc == 2, "بدون احراز هویتِ سمتِ سرور نباید حکمی ثبت شود"
    assert not (tmp_path / "authoring/audit/verdicts_C205.json").exists()


def test_record_verdict_cli_accepts_only_authenticated_teacher(tmp_path: Path, monkeypatch) -> None:
    token = "cli-teacher-token-abc123"
    monkeypatch.setenv("KHSHAB_TEACHER_TOKEN", token)
    assert expected_teacher_token(tmp_path) == token

    target = tmp_path / "target.xlsx"
    shutil.copyfile(G2_V05, target)
    tok_file = tmp_path / "teacher_token.txt"
    tok_file.write_text(token, encoding="utf-8")

    # توکنِ غلط → رد
    bad = tmp_path / "bad_token.txt"
    bad.write_text("wrong-token", encoding="utf-8")
    ok, method, failure = authenticate_teacher(tmp_path, None, token_file=bad)
    assert ok is False and failure.startswith("TEACHER_TOKEN_INVALID")

    argv = [
        "record-verdict", "--repo-root", str(tmp_path), "--verdict-id", "TV-REAL-1",
        "--scope", "ROW_APPROVED", "--actor", "استاد راهنما", "--actor-role", "human_teacher",
        "--target-ids", "L-401", "--target-file", str(target), "--teacher-token-file", str(tok_file),
    ]
    rc = cli_main(argv)
    assert rc == 0
    ledger = GovernanceLedger(tmp_path / "authoring/audit/verdicts_C205.json")
    assert len(ledger.verdicts) == 1
    v = ledger.verdicts[0]
    assert v.authenticated is True and v.auth_method
    assert v.actor_role == "human_teacher"
    assert v.target_ids == ["L-401"]
    assert len(v.target_sha256) == 64


def test_approval_scope_verdict_cannot_be_minted_by_caller_string(tmp_path: Path) -> None:
    ledger = GovernanceLedger(tmp_path / "verdicts.json")
    from authoring.agent.governance import GovernanceViolationError

    with pytest.raises(GovernanceViolationError, match="TEACHER_IDENTITY_NOT_AUTHENTICATED"):
        ledger.record_verdict(
            verdict_id="TV-1", scope="RELEASE_AUTHORIZED", actor="خودِ ایجنت",
            actor_role="human_teacher", target_ids=["WHOLE_BOOK"], target_sha256="a" * 64,
        )
    assert ledger.verdicts == []
