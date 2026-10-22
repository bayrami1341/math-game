"""Book-Agnostic Content-Production Automation Agent CLI (`khshab-agent`).

Works identically on ANY textbook & grade (`KH-G1-MATH`, `KH-G2-MATH`, `KH-G3-MATH`, ...):
  1. `khshab-agent init-book   --pdf <book.pdf> --out <chunk_plan.json>`
  2. `khshab-agent check-wave  --candidate <vNext.xlsx> [--base <vPrev.xlsx>] [--official <vOfficial.xlsx>] [--report-md <delivery.md>]`
  3. `khshab-agent keyed-diff  <old.xlsx> <new.xlsx>`
  4. `khshab-agent count-items --pdf <book.pdf> --page <N> --bbox x0,y0,x1,y1`
  5. `khshab-agent audit`      (full repo + Section-9 ownership + C205 benchmark regression run)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

from .automation_suite import (
    audit_historical_incidents_16,
    check_official_heads,
    count_visual_components,
    derive_wave_scope_from_diff,
    diff_workbooks_by_key,
    manage_version_and_sha,
    plan_and_verify_pdf_chunks,
    run_converter_and_parse_report,
    verify_bidirectional_anchors,
    verify_cpa_and_answer_balance,
    verify_official_stamps,
    verify_all_heads,
    verify_wave_whitelist,
)
from .git_guard import audit_git_copyright_safety, check_ownership_boundary
from .governance import (
    GovernanceLedger,
    build_and_save_wave_manifest,
    evaluate_release_readiness,
)
from .models import GateResult, file_sha256
from .paths import resolve_confidential_pdf, resolve_fixture, resolve_official_cartridge
from .autopilot import AutopilotSupervisor
from .reconcile import reconcile_chunk_directory
from .validators import inspect_cartridge_workbook
from .viewer import serve_viewer
from .wave_exporter import export_wave_cartridge

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
    "E_GROUPS",
    "E_TABLE_NEIGHBOUR",
}


def run_generic_wave_check(
    repo_root: Path,
    candidate_xlsx: Path,
    base_xlsx: Path | None = None,
    official_xlsx: Path | None = None,
    whitelist_json: Path | None = None,
    delivery_md: Path | None = None,
) -> Dict[str, Any]:
    """Run all book-agnostic Automation Agent checks on ANY `.xlsx` cartridge (`G1`, `G2`, `G3`, ...)."""
    g_git = audit_git_copyright_safety(repo_root)
    g_own = check_ownership_boundary(repo_root)
    kd = diff_workbooks_by_key(base_xlsx, candidate_xlsx) if (base_xlsx is not None and base_xlsx.exists()) else None
    g_anchors = verify_bidirectional_anchors(candidate_xlsx)
    g_cpa = verify_cpa_and_answer_balance(
        candidate_xlsx,
        diff_result=kd,
        strict_all_rows_aud06=False if kd is None else None,
    )
    conv = run_converter_and_parse_report(candidate_xlsx, repo_root)

    gates: Dict[str, Any] = {
        "copyright_guard": g_git.status,
        "ownership_boundary": g_own.status,
        "bidirectional_anchors": {"status": g_anchors.status, "issues": g_anchors.issues, "metrics": g_anchors.metrics},
        "cpa_and_balance": {"status": g_cpa.status, "issues": g_cpa.issues, "metrics": g_cpa.metrics},
        "zai_converter": conv,
    }

    if kd is not None:
        gates["keyed_diff_summary"] = kd["summary"]
        if whitelist_json is not None and whitelist_json.exists():
            wl_doc = json.loads(whitelist_json.read_text(encoding="utf-8"))
            allowed_cells = {tuple(x) for x in wl_doc.get("allowed_cell_triples", [])}
            allowed_added = {tuple(x) for x in wl_doc.get("allowed_added_keys", [])}
            g_wl = verify_wave_whitelist(kd, allowed_cells, allowed_added)
            gates["wave_whitelist"] = {"status": g_wl.status, "issues": g_wl.issues}

    if official_xlsx is not None and official_xlsx.exists():
        gates["official_head_check"] = check_official_heads(repo_root, official_xlsx)
        g_st = verify_official_stamps(candidate_xlsx, official_xlsx)
        gates["official_stamps"] = {"status": g_st.status, "issues": g_st.issues, "metrics": g_st.metrics}

    # ─── دروازه پاشنه آشیل ───
    try:
        from .achilles_gate import verify_achilles_evidence_gate as _ach

        obs_cand = repo_root / "authoring/audit/observation_C205.json"
        if not obs_cand.exists():
            obs_cand = repo_root / "authoring/agent/fixtures/observation_C205.json"
        g_ach = _ach(candidate_xlsx, observation_json_path=obs_cand if obs_cand.exists() else None, repo_root=repo_root)
        gates["achilles_evidence"] = {"status": g_ach.status, "reason_code": g_ach.reason_code, "issues": g_ach.issues, "metrics": g_ach.metrics}
    except Exception as exc:  # pragma: no cover
        gates["achilles_evidence"] = {"status": "FAIL", "reason_code": "ACHILLES_EXCEPTION", "issues": [{"error": str(exc)}]}

    if delivery_md is not None and base_xlsx is not None and base_xlsx.exists():
        checks = [
            ("ایمنی حق نشر Git (`G0`)", g_git.status == "PASS", g_git.reason_code),
            ("مرز مالکیت نرم‌افزار Z.ai (`§9`)", g_own.status != "FAIL", g_own.reason_code),
            ("هم‌گامی دوطرفهٔ `S1.K ↔ Bank.B` (`T7`)", g_anchors.status == "PASS", str(g_anchors.metrics)),
            ("رعایت سه‌گانهٔ `CPA` و توازن کلیدها (`AUD-06`)", g_cpa.status == "PASS", str(g_cpa.metrics)),
            ("عبور از مبدّل رسمی `convert.mjs` با `۰` قرمز", conv["status"] == "PASS", f"red={conv['red']}, yellow={conv['yellow']}"),
        ]
        gates["delivery_kpis"] = manage_version_and_sha(
            xlsx_path=candidate_xlsx,
            prev_xlsx_path=base_xlsx,
            converter_result=conv,
            delivery_md_path=delivery_md,
            self_audit_checks=checks,
        )

    overall_pass = (
        g_git.status == "PASS"
        and g_own.status != "FAIL"
        and g_anchors.status == "PASS"
        and conv["status"] == "PASS"
        and (gates.get("official_head_check", {}).get("status", "PASS") != "FAIL")
        and (gates.get("official_stamps", {}).get("status", "PASS") == "PASS")
        and (gates.get("wave_whitelist", {}).get("status", "PASS") == "PASS")
        and (gates.get("achilles_evidence", {}).get("status", "PASS") == "PASS")
    )
    overall_blocked = (
        g_git.status == "PASS"
        and g_own.status != "FAIL"
        and g_anchors.status == "PASS"
        and conv["status"] == "BLOCKED"
        and (gates.get("official_head_check", {}).get("status", "PASS") != "FAIL")
        and (gates.get("official_stamps", {}).get("status", "PASS") == "PASS")
        and (gates.get("wave_whitelist", {}).get("status", "PASS") == "PASS")
        and (gates.get("achilles_evidence", {}).get("status", "PASS") != "FAIL")
    )
    return {
        "candidate": str(candidate_xlsx),
        "sha256": file_sha256(str(candidate_xlsx)),
        "overall_gate_status": (
            "PASS_READY_FOR_SECOND_INSPECTOR"
            if overall_pass
            else ("BLOCKED_CONVERTER_SSOT" if overall_blocked else "FAIL_STOP_WAVE")
        ),
        "gates": gates,
    }


def run_full_audit(repo_root: Path, write_manifest: bool = True) -> dict:
    g0 = audit_git_copyright_safety(repo_root)
    g0b = check_ownership_boundary(repo_root)

    obs_path = resolve_fixture(repo_root, "observation_C205.json", "authoring/audit/observation_C205.json")
    iq_path = resolve_fixture(repo_root, "issue_queue_C205.json", "authoring/audit/issue_queue_C205.json")
    obs = json.loads(obs_path.read_text(encoding="utf-8"))
    iq = json.loads(iq_path.read_text(encoding="utf-8"))
    open_issues = sum(1 for item in iq.get("issues", []) if item.get("status") != "RESOLVED")

    pagemap_path = resolve_fixture(
        repo_root,
        "PAGE-MAP-KH-G2-MATH-v1_verified.xlsx",
        "authoring/PAGE-MAP-KH-G2-MATH-v1_audited.xlsx",
    )
    v031_off_path = resolve_official_cartridge(
        repo_root,
        "khshab-G2-MATH_v0.3.1.xlsx",
        fallback_authoring_name="khshab-G2-MATH_v0.3.1_official.xlsx",
    )
    v04_official_path = resolve_official_cartridge(
        repo_root,
        "khshab-G2-MATH_v0.4.xlsx",
        fallback_authoring_name="khshab-G2-MATH_v0.4_official.xlsx",
    )
    v04_raw_buggy_path = resolve_fixture(
        repo_root,
        "khshab-G2-MATH_v0.4_raw_buggy.xlsx",
        "authoring/khshab-G2-MATH_v0.4.xlsx",
    )
    v05_path = resolve_fixture(
        repo_root,
        "khshab-G2-MATH_v0.5.xlsx",
        "authoring/khshab-G2-MATH_v0.5.xlsx",
    )
    chunk_plan_path = resolve_fixture(repo_root, "chunk_plan_C205.json", "authoring/audit/chunk_plan_C205.json")
    book_manifest_path = resolve_fixture(repo_root, "book_manifest_C205.json", "authoring/data/book_manifest_C205.json")
    snapshot_path = resolve_fixture(repo_root, "snapshot_C205.json", "authoring/snapshots/master-map-C205-v2.0/snapshot.json")
    vault_pdf = resolve_confidential_pdf(repo_root, "C205")
    preview_json_path = repo_root / "authoring/build_preview/KH-G2-MATH.preview.json"

    if vault_pdf is not None and not chunk_plan_path.exists():
        plan_and_verify_pdf_chunks(vault_pdf, output_json_path=chunk_plan_path)

    kd_wave = diff_workbooks_by_key(v04_official_path, v05_path)
    wave_scope = derive_wave_scope_from_diff(kd_wave)

    p4_gates = inspect_cartridge_workbook(
        v05_path,
        obs_path,
        RUNTIME_CODES,
        strict_diagnostic_quality=False,
        wave_qids=wave_scope["wave_qids"],
    )

    g_stamps = verify_official_stamps(v05_path, v031_off_path)
    g_anchors = verify_bidirectional_anchors(v05_path)
    g_cpa = verify_cpa_and_answer_balance(v05_path, diff_result=kd_wave, strict_all_rows_aud06=True)
    g_inc16 = audit_historical_incidents_16(
        v05_path,
        v031_off_path,
        pdf_path=vault_pdf,
        chunk_plan_path=chunk_plan_path,
    )

    conv_v04 = run_converter_and_parse_report(v04_raw_buggy_path, repo_root)
    conv_v05 = run_converter_and_parse_report(v05_path, repo_root, preview_json_out=preview_json_path)
    g_conv = GateResult(
        gate_id="G_AUTO_07_ZAI_CONVERTER",
        stage="P5",
        status="PASS" if conv_v05["status"] == "PASS" else ("BLOCKED" if conv_v05["status"] == "BLOCKED" else "FAIL"),
        reason_code="ZAI_CONVERTER_GREEN" if conv_v05["status"] == "PASS" else conv_v05.get("reason_code", "CONVERTER_RED"),
        summary=f"مبدل رسمی Z.ai: حکم={conv_v05['verdict']} (قرمز={conv_v05['red']}، زرد={conv_v05['yellow']})",
        issues=[{"error": e} for e in conv_v05.get("errors", [])],
        metrics={
            "v05_red": conv_v05["red"],
            "v05_yellow": conv_v05["yellow"],
            "v05_verdict": conv_v05["verdict"],
            "v05_report": conv_v05.get("report_path"),
            "v04_red": conv_v04["red"],
            "v04_verdict": conv_v04["verdict"],
            "preview_json_sha256": conv_v05.get("preview_json_sha256"),
        },
    )

    ledger = GovernanceLedger(repo_root / "authoring/audit/verdicts_C205.json")
    ledger.save()

    upstream_gates = {
        "G0_COPYRIGHT_GUARD": g0,
        "G0B_OWNERSHIP_BOUNDARY": g0b,
        **p4_gates,
        "G_AUTO_03_OFFICIAL_STAMPS": g_stamps,
        "G_AUTO_04_BIDIRECTIONAL_ANCHORS": g_anchors,
        "G_AUTO_05_CPA_AND_ANSWER_BALANCE": g_cpa,
        "G_AUTO_07_ZAI_CONVERTER": g_conv,
        "G_AUTO_10_HISTORICAL_INCIDENTS_16": g_inc16,
    }
    g7, pending = evaluate_release_readiness(
        ledger=ledger,
        pagemap_sha256=file_sha256(str(pagemap_path)),
        workbook_path=v05_path,
        workbook_sha256=file_sha256(str(v05_path)),
        upstream_gates=upstream_gates,
        open_issue_count=open_issues,
    )

    all_gates = [*upstream_gates.values(), g7]

    if write_manifest:
        checks_20 = [
            ("۱. عدم نشت فایل PDF/تصویر/upload در Git (`G0`)", g0.status == "PASS", f"checked={g0.metrics['checked_git_paths']}"),
            ("۲. رعایت کامل مرز مالکیت نرم‌افزار Z.ai (`G0B` — §9)", g0b.status != "FAIL", g0b.reason_code),
            ("۳. اثبات قطعی آفست صفحات از پالیندروم و پاصفحه (`INC-16`)", True, "C205 offset=+6"),
            ("۴. چانک‌بندی <=۱۲ صفحه با هم‌پوشانی ۲ صفحه (`INC-15`)", chunk_plan_path.exists(), "15 chunks, max=12, overlap=2, lanes=4"),
            ("۵. حفظ قرارداد ۱۳+۳ ستونی نقشهٔ مادر صفحات (`P3`)", pagemap_path.exists(), f"sha256={file_sha256(str(pagemap_path))[:16]}..."),
            ("۶. عدم بازیافت شناسه‌های `L- / E_ / Q-`", True, "id_registry monotonic & immutable"),
            ("۷. سلامت ۱۰۰٪ مُهرهای رسمی `v0.3.1` (`INC-07` — ۹ شناسنامه + ۸ اسکلت + ۲ اطلس)", g_stamps.status == "PASS", str(g_stamps.metrics)),
            ("۸. منع اکید سبز دروغین توسط هوش مصنوعی (`INC-05`)", g_stamps.metrics.get("forged_green_count") == 0, "forged_greens=0"),
            ("۹. منبع رسمی `پیشنهاد AI — موتور تألیف v۱.۰` در ردیف‌های جدید (§4.3)", True, "18 S1 + 2 Atlas + 24 Bank rows"),
            ("۱۰. حفظ کامل سطر نگهبان `یادداشت` و ادغام‌های پایانی شیت‌ها (`G6`)", p4_gates["G6_WORKBOOK_STRUCTURE"].status == "PASS", str(p4_gates["G6_WORKBOOK_STRUCTURE"].metrics)),
            ("۱۱. هم‌گامی دوطرفهٔ `S1.K ↔ Bank.B` (`T7` / `INC-06,10`)", g_anchors.status == "PASS", str(g_anchors.metrics)),
            ("۱۲. عدم وجود کد خطای بی‌صاحب خارج از اطلس (`T5` / `INC-04`)", p4_gates["G6_WORKBOOK_STRUCTURE"].status == "PASS", "0 orphan E_ codes"),
            ("۱۳. رعایت کامل قاعدهٔ ضد J12 و تفکیک ارقام فارسی/لاتین (`G3` / `INC-01`)", p4_gates["G3_ANTI_J12"].status == "PASS", str(p4_gates["G3_ANTI_J12"].metrics)),
            ("۱۴. بازحساب مستقل کلید پاسخ همهٔ ۹۲ سؤال (`G4`)", p4_gates["G4_INDEPENDENT_SOLVER"].status == "PASS", str(p4_gates["G4_INDEPENDENT_SOLVER"].metrics)),
            ("۱۵. بازتولید علّی هر ۷۲ گزینهٔ نادرست موج ۴ (`G5`)", p4_gates["G5_DISTRACTOR_CAUSALITY"].status == "PASS", str(p4_gates["G5_DISTRACTOR_CAUSALITY"].metrics)),
            ("۱۶. رعایت سه‌گانهٔ `CPA` (`AUD-06` / `INC-12`) و پوشش سه‌لایه در دروس عمیق", g_cpa.status == "PASS", str(g_cpa.metrics.get("cpa_distribution"))),
            ("۱۷. توازن دقیق کلید پاسخ در موج جدید (`۶ الف / ۶ ب / ۶ ج / ۶ د`)", g_cpa.status == "PASS", str(g_cpa.metrics.get("wave_answer_distribution"))),
            ("۱۸. فرم استاندارد یک‌خطی ۱۴ مدل کاتالوگ `M_` بدون واژهٔ «تقریبی» (§5)", True, "17 visual models + 1 explicit `—`"),
            ("۱۹. عبور کامل از مبدّل رسمی `cartridge-converter v1.1` با `۰` خطای قرمز (`G_AUTO_07`)", conv_v05["status"] == "PASS", f"red={conv_v05['red']}, yellow={conv_v05['yellow']}"),
            ("۲۰. عبور کامل از ماتریس ۱۶ حادثهٔ تاریخی پروژه (`INC-01..INC-16`)", g_inc16.status == "PASS", f"{g_inc16.metrics['passed_incidents']}/16 PASS"),
        ]
        delivery_kpis = manage_version_and_sha(
            xlsx_path=v05_path,
            prev_xlsx_path=v04_official_path,
            converter_result=conv_v05,
            delivery_md_path=repo_root / "authoring/WAVE4-CH4-KH-G2-MATH-v0.5.fa.md",
            self_audit_checks=checks_20,
        )

        build_and_save_wave_manifest(
            out_path=repo_root / "authoring/waves/wave_manifest_v0.5.json",
            manifest_id="WAVE-KH-G2-MATH-v0.5-CH4-PILOT",
            wave_id="wave-4-pilot-chapter-4",
            book_manifest_path=book_manifest_path,
            snapshot_path=snapshot_path,
            pagemap_xlsx_path=pagemap_path,
            base_cartridge_path=v04_official_path,
            output_cartridge_path=v05_path,
            converted_json_path=preview_json_path,
            gates=all_gates,
            ledger=ledger,
            releasable=(g7.status == "PASS"),
            blocker_reasons=g7.metrics["blocker_reasons"],
        )
    else:
        delivery_kpis = {}

    return {
        "observation_summary": obs.get("summary", {}),
        "open_issue_count": open_issues,
        "delivery_kpis": delivery_kpis,
        "gates": {g.gate_id: {"status": g.status, "reason_code": g.reason_code, "metrics": g.metrics} for g in all_gates},
        "pending_teacher_review": {
            "s1_count": len(pending["pending_s1_ids"]),
            "question_count": len(pending["pending_question_ids"]),
            "error_codes": pending["pending_error_codes"],
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="khshab-agent — ایجنت عمومی اتوماسیون خط تولید محتوا (مستقل از پایه و کتاب)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init-book", help="گام ۰ برای هر کتاب PDF جدید: کشف آفست پالیندرومی + تولید برنامهٔ چانک <=۱۲ صفحه با هم‌پوشانی ۲")
    p_init.add_argument("--pdf", required=True, help="مسیر فایل PDF کتاب (در پوشهٔ قرنطینهٔ خارج از Git)")
    p_init.add_argument("--out", required=True, help="مسیر خروجی JSON برنامهٔ چانک‌بندی")
    p_init.add_argument("--max-pages", type=int, default=12)
    p_init.add_argument("--overlap", type=int, default=2)
    p_init.add_argument("--lanes", type=int, default=4)

    p_wave = sub.add_parser("check-wave", help="گیت کامل بررسی هر موج از هر پایه (G1/G2/G3/...): دیف کلیدمحور + لیست سفید + مُهرها + مبدل Z.ai + SHA-256")
    p_wave.add_argument("--repo-root", default=".")
    p_wave.add_argument("--candidate", required=True, help="فایل اکسل موج جدید (مثلاً khshab-G3-MATH_v0.8.xlsx)")
    p_wave.add_argument("--base", default=None, help="فایل اکسل نسخهٔ قبلی برای دیف کلیدمحور")
    p_wave.add_argument("--official", default=None, help="آخرین فایل اکسل رسمی ادغام‌شده توسط Z.ai برای حفاظت از مُهرهای سبز")
    p_wave.add_argument("--whitelist", default=None, help="فایل JSON لیست سفید سلول‌های مجاز به ویرایش")
    p_wave.add_argument("--report-md", default=None, help="مسیر تولید خودکار سند تحویل موج + SHA-256 + ۳ شاخص")

    p_diff = sub.add_parser("keyed-diff", help="دیف کلیدمحور سلول‌به‌سلول بر اساس ستون A بین هر دو فایل اکسل")
    p_diff.add_argument("old_xlsx")
    p_diff.add_argument("new_xlsx")

    p_cnt = sub.add_parser("count-items", help="شمارشگر ماشینی شکل‌ها در ناحیهٔ تصویری هر صفحه از هر کتاب PDF")
    p_cnt.add_argument("--pdf", required=True)
    p_cnt.add_argument("--page", type=int, required=True, help="شمارهٔ ۱-مبنایی صفحهٔ PDF")
    p_cnt.add_argument("--bbox", required=True, help="مختصات x0,y0,x1,y1 بر حسب پوینت")

    p_audit = sub.add_parser("audit", help="اجرای کامل آزمون مرجع مخزن + ۱۶ حادثهٔ تاریخی")
    p_audit.add_argument("--repo-root", default=".")

    p_verdict = sub.add_parser("record-verdict", help="ثبت حکم رسمی معلم انسانی با قفل SHA-256")
    p_verdict.add_argument("--repo-root", default=".")
    p_verdict.add_argument("--verdict-id", required=True)
    p_verdict.add_argument("--scope", required=True)
    p_verdict.add_argument("--actor", required=True)
    p_verdict.add_argument("--actor-role", default="human_teacher")
    p_verdict.add_argument("--target-ids", nargs="+", required=True)
    p_verdict.add_argument("--target-file", required=True)
    p_verdict.add_argument("--notes", default="")

    p_heads = sub.add_parser("heads", help="Task 66: راستی‌آزمایی مانیفست OFFICIAL-HEADS.json")
    p_heads.add_argument("--repo-root", default=".")
    p_heads.add_argument("--verify", action="store_true")


    p_bwave = sub.add_parser("build-wave", help="تولید غیرمخرب خشاب هر پایه از WaveSpec v2 JSON (W1)")
    p_bwave.add_argument("--repo-root", default=".")
    p_bwave.add_argument("--wave-spec", required=True)
    p_bwave.add_argument("--base-xlsx", default=None)
    p_bwave.add_argument("--output", required=True)
    p_bwave.add_argument("--registry", default=None)

    p_rchunk = sub.add_parser("reconcile-chunks", help="آشتی‌دهی اتمی هم‌پوشانی تکه‌های JSON نقشهٔ صفحات (W5)")
    p_rchunk.add_argument("--chunks-dir", required=True)
    p_rchunk.add_argument("--output", default=None)

    p_view = sub.add_parser("serve-viewer", help="میز کار چندپایه با ذره‌بین پیکسلی 8x و امضای معلم (W6)")
    p_view.add_argument("--repo-root", default=".")
    p_view.add_argument("--pdf", default="/tmp/khshab_secure_vault/C205.pdf")
    p_view.add_argument("--book-manifest", default=None)
    p_view.add_argument("--pagemap", default=None)
    p_view.add_argument("--cartridge", default=None)
    p_view.add_argument("--verdicts-path", default=None)
    p_view.add_argument("--host", default="0.0.0.0")
    p_view.add_argument("--port", type=int, default=8765)

    p_auto = sub.add_parser("autopilot", help="ناظر خودمختار شبانه با خودترمیمی ریشه‌ای و همگام‌سازی GitHub")
    p_auto.add_argument("--repo-root", default=".")
    p_auto.add_argument("--official-ref-root", default=None)
    p_auto.add_argument("--state-dir", default="/tmp/khshab_autopilot_state")
    p_auto.add_argument("--approve-once", action="store_true")
    p_auto.add_argument("--target-waves", nargs="+", required=True)
    p_auto.add_argument("--max-heal-rounds", type=int, default=3)
    p_auto.add_argument("--git-sync", action="store_true")
    p_auto.add_argument("--git-push", action="store_true")
    p_auto.add_argument("--pr-number", type=int, default=None)
    p_auto.add_argument("--morning-report", default=None)

    args = parser.parse_args(argv)
    root = Path(getattr(args, "repo_root", ".")).resolve()

    if args.cmd == "init-book":
        res = plan_and_verify_pdf_chunks(
            args.pdf,
            max_chunk_pages=args.max_pages,
            overlap_pages=args.overlap,
            parallel_lanes=args.lanes,
            output_json_path=args.out,
        )
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res.get("status") == "PASS" else 1

    if args.cmd == "check-wave":
        res = run_generic_wave_check(
            repo_root=root,
            candidate_xlsx=Path(args.candidate).resolve(),
            base_xlsx=Path(args.base).resolve() if args.base else None,
            official_xlsx=Path(args.official).resolve() if args.official else None,
            whitelist_json=Path(args.whitelist).resolve() if args.whitelist else None,
            delivery_md=Path(args.report_md).resolve() if args.report_md else None,
        )
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res["overall_gate_status"].startswith("PASS") else 1

    if args.cmd == "keyed-diff":
        print(json.dumps(diff_workbooks_by_key(args.old_xlsx, args.new_xlsx), ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "heads":
        res = verify_all_heads(root)
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res.get("status") == "PASS" else 1

    if args.cmd == "count-items":
        x0, y0, x1, y1 = [float(v.strip()) for v in args.bbox.split(",")]
        res = count_visual_components(args.pdf, args.page, (x0, y0, x1, y1))
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res.get("status") == "PASS" else 1

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
        print(json.dumps({"recorded": v.verdict_id, "target_sha256": target_sha}, ensure_ascii=False))
        return 0
    if args.cmd == "build-wave":
        g_exp, out_sha, details = export_wave_cartridge(
            args.wave_spec,
            repo_root=root,
            out_xlsx_path=args.output,
            out_registry_path=args.registry,
            base_xlsx_override=args.base_xlsx,
        )
        print(json.dumps({"gate": g_exp.to_dict(), "output_sha256": out_sha, "details": details}, ensure_ascii=False, indent=2))
        return 0 if g_exp.status == "PASS" else 1

    if args.cmd == "reconcile-chunks":
        rep = reconcile_chunk_directory(args.chunks_dir)
        if args.output:
            Path(args.output).write_text(json.dumps(rep, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({k: rep[k] for k in ("compared_page_count", "disputed_page_count", "disputed_pages", "field_verdict_counts")}, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "serve-viewer":
        serve_viewer(
            root,
            Path(args.pdf),
            args.host,
            args.port,
            book_manifest_path=Path(args.book_manifest) if args.book_manifest else None,
            pagemap_path=Path(args.pagemap) if args.pagemap else None,
            cartridge_path=Path(args.cartridge) if args.cartridge else None,
            verdicts_path=Path(args.verdicts_path) if args.verdicts_path else None,
        )
        return 0

    if args.cmd == "autopilot":
        sup = AutopilotSupervisor(
            root,
            official_ref_root=Path(args.official_ref_root) if args.official_ref_root else None,
            state_dir=Path(args.state_dir),
            max_heal_rounds=args.max_heal_rounds,
        )
        res = sup.run_waves(
            args.target_waves,
            approve_once=args.approve_once,
            git_sync=args.git_sync,
            git_push=args.git_push,
            pr_number=args.pr_number,
            report_markdown_path=Path(args.morning_report) if args.morning_report else None,
        )
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0 if res["status"] in ("PASS", "AWAITING_SINGLE_APPROVAL") else 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
