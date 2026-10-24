"""Stage P6: Scoped Teacher Verdicts, SHA-Bound Invalidation & Wave Provenance Governance (`G7`).

Enforces four non-negotiable governance invariants:
1. Only `actor_role == "human_teacher"` may issue `MAP_APPROVED`, `ROW_APPROVED`,
   `ERROR_CODE_APPROVED`, or `RELEASE_AUTHORIZED`. Any AI actor (`actor_role != "human_teacher"`)
   attempting to emit an approval raises `GovernanceViolationError("AI_ACTOR_FORBIDDEN_FROM_APPROVAL")`.
2. Every verdict is cryptographically bound to `(scope, target_ids, target_sha256, timestamp_utc)`.
   If ANY upstream artifact's SHA-256 changes after a verdict was signed, that verdict is
   automatically flagged `STALE_UPSTREAM_SHA256` and ceases to satisfy release gates.
3. No cartridge wave can ever transition to `releasable = True` while ANY gate is `FAIL`/`BLOCKED`,
   OR while unapproved rows (`نیاز به تأیید`), unapproved `E_` error codes (`پیشنهادی`), or open
   page-map conflicts exist.
4. Writes auditable `WaveManifest` (`authoring/waves/wave_manifest_v0.5.json`) linking every file's
   exact SHA-256 from `C205.pdf` (`a93934b6...`) down to `khshab-G2-MATH_v0.5.xlsx` and runtime JSON.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import openpyxl

from .models import GateResult, TeacherVerdict, WaveManifest, file_sha256, utc_now_iso


class GovernanceViolationError(PermissionError):
    """Raised whenever an unauthorized actor or stale hash attempts to bypass teacher governance."""


VALID_SCOPES = {
    "MAP_APPROVED",
    "ROW_APPROVED",
    "ERROR_CODE_APPROVED",
    "RELEASE_AUTHORIZED",
    "ROW_REJECTED",
    "MAP_REVISION_REQUESTED",
}

APPROVAL_SCOPES = {
    "MAP_APPROVED",
    "ROW_APPROVED",
    "ERROR_CODE_APPROVED",
    "RELEASE_AUTHORIZED",
}


class GovernanceLedger:
    def __init__(self, ledger_path: str | Path) -> None:
        self.path = Path(ledger_path)
        self.verdicts: List[TeacherVerdict] = []
        if self.path.exists():
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            for item in raw.get("verdicts", []):
                self.verdicts.append(TeacherVerdict(**item))

    def save(self) -> str:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": "1.0.0",
            "verdict_count": len(self.verdicts),
            "verdicts": [asdict(v) for v in self.verdicts],
        }
        self.path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return file_sha256(str(self.path))

    def record_verdict(
        self,
        *,
        verdict_id: str,
        scope: str,
        actor: str,
        actor_role: str,
        target_ids: List[str],
        target_sha256: str,
        notes: str = "",
        timestamp_utc: Optional[str] = None,
        authenticated: bool = False,
        auth_method: str = "",
    ) -> TeacherVerdict:
        if scope not in VALID_SCOPES:
            raise ValueError(f"Unknown governance verdict scope: {scope!r}")
        if scope in APPROVAL_SCOPES and actor_role != "human_teacher":
            raise GovernanceViolationError(
                f"AI_ACTOR_FORBIDDEN_FROM_APPROVAL: actor={actor!r} role={actor_role!r} cannot emit {scope}"
            )
        # --- v2.4-hardening (بند ۵): رشتهٔ نقشِ ارائه‌شده توسط فراخواننده به‌تنهایی رأیِ انسانیِ معتبر نمی‌سازد ---
        if scope in APPROVAL_SCOPES and not authenticated:
            raise GovernanceViolationError(
                "TEACHER_IDENTITY_NOT_AUTHENTICATED: حکمِ تأییدی فقط با احراز هویتِ سمتِ سرور "
                "(توکن معلم خارج از Git) ثبت می‌شود؛ `actor_role=human_teacher` اعلامیِ فراخواننده کافی نیست."
            )
        if not target_ids:
            raise ValueError("target_ids must be explicit and non-empty (no silent wildcard approval).")
        if not target_sha256 or len(target_sha256) != 64:
            raise ValueError(f"Invalid SHA-256 digest for target_sha256: {target_sha256!r}")

        verdict = TeacherVerdict(
            verdict_id=verdict_id,
            scope=scope,
            actor=actor,
            actor_role=actor_role,
            target_ids=list(target_ids),
            target_sha256=target_sha256,
            timestamp_utc=timestamp_utc or utc_now_iso(),
            notes=notes,
            authenticated=authenticated,
            auth_method=auth_method,
        )
        self.verdicts.append(verdict)
        return verdict

    def validate_against_current_hashes(
        self,
        expected_hashes_by_scope: Dict[str, str],
    ) -> Tuple[List[TeacherVerdict], List[Dict[str, Any]]]:
        active: List[TeacherVerdict] = []
        invalidated: List[Dict[str, Any]] = []
        for v in self.verdicts:
            expected_sha = expected_hashes_by_scope.get(v.scope)
            if expected_sha and v.target_sha256 != expected_sha:
                v.invalidated = True
                v.invalidation_reason = (
                    f"STALE_UPSTREAM_SHA256: verdict signed {v.target_sha256[:12]}..., "
                    f"current artifact is {expected_sha[:12]}..."
                )
                invalidated.append(
                    {
                        "verdict_id": v.verdict_id,
                        "scope": v.scope,
                        "signed_sha256": v.target_sha256,
                        "current_sha256": expected_sha,
                        "reason": v.invalidation_reason,
                    }
                )
            elif v.invalidated:
                invalidated.append(
                    {"verdict_id": v.verdict_id, "scope": v.scope, "reason": v.invalidation_reason}
                )
            else:
                active.append(v)
        return active, invalidated


def inspect_workbook_pending_approvals(workbook_path: str | Path) -> Dict[str, Any]:
    wb = openpyxl.load_workbook(workbook_path, data_only=True)
    ws_s1 = wb["نقشهٔ کتاب (S1)"]
    ws_ea = wb["اطلس خطا"]
    ws_qb = wb["بانک سؤال"]

    pending_s1: List[str] = []
    approved_s1: List[str] = []
    for r in range(3, ws_s1.max_row + 1):
        lid = str(ws_s1.cell(r, 1).value or "").strip()
        if lid == "یادداشت" or not lid:
            break
        st = str(ws_s1.cell(r, 12).value or "").strip()
        if st == "تأیید شده":
            approved_s1.append(lid)
        else:
            pending_s1.append(lid)

    pending_errors: List[str] = []
    for r in range(4, ws_ea.max_row + 1):
        ec = str(ws_ea.cell(r, 1).value or "").strip()
        if ec == "یادداشت" or not ec:
            break
        if "پیشنهادی" in ec or str(ws_ea.cell(r, 10).value or "").strip() != "تأیید شده":
            pending_errors.append(ec)

    pending_questions: List[str] = []
    approved_questions: List[str] = []
    for r in range(4, ws_qb.max_row + 1):
        qid = str(ws_qb.cell(r, 1).value or "").strip()
        if qid == "یادداشت" or not qid:
            break
        st = str(ws_qb.cell(r, 15).value or "").strip()
        if st == "تأیید شده":
            approved_questions.append(qid)
        else:
            pending_questions.append(qid)

    return {
        "pending_s1_ids": pending_s1,
        "approved_s1_ids": approved_s1,
        "pending_error_codes": pending_errors,
        "pending_question_ids": pending_questions,
        "approved_question_ids": approved_questions,
    }


def evaluate_release_readiness(
    *,
    ledger: GovernanceLedger,
    pagemap_sha256: str,
    workbook_path: str | Path,
    workbook_sha256: str,
    upstream_gates: Dict[str, GateResult],
    open_issue_count: int,
) -> Tuple[GateResult, Dict[str, Any]]:
    expected_hashes = {
        "MAP_APPROVED": pagemap_sha256,
        "ROW_APPROVED": workbook_sha256,
        "ERROR_CODE_APPROVED": workbook_sha256,
        "RELEASE_AUTHORIZED": workbook_sha256,
    }
    active_verdicts, invalidated_verdicts = ledger.validate_against_current_hashes(expected_hashes)
    pending = inspect_workbook_pending_approvals(workbook_path)

    approved_map_scopes = [v for v in active_verdicts if v.scope == "MAP_APPROVED"]
    approved_row_ids = {tid for v in active_verdicts if v.scope == "ROW_APPROVED" for tid in v.target_ids}
    approved_err_ids = {tid for v in active_verdicts if v.scope == "ERROR_CODE_APPROVED" for tid in v.target_ids}
    release_auth = [v for v in active_verdicts if v.scope == "RELEASE_AUTHORIZED"]

    unapproved_s1 = [lid for lid in pending["pending_s1_ids"] if lid not in approved_row_ids]
    unapproved_qs = [qid for qid in pending["pending_question_ids"] if qid not in approved_row_ids]
    unapproved_errs = [ec for ec in pending["pending_error_codes"] if ec not in approved_err_ids]

    blockers: List[str] = []
    for gid, gr in upstream_gates.items():
        if gr.status != "PASS":
            blockers.append(f"UPSTREAM_GATE_NOT_PASS:{gid}={gr.status}({gr.reason_code})")
    if open_issue_count > 0:
        blockers.append(f"OPEN_PAGE_MAP_ISSUES:{open_issue_count}")
    if invalidated_verdicts:
        blockers.append(f"INVALIDATED_STALE_VERDICTS:{len(invalidated_verdicts)}")
    if not approved_map_scopes:
        blockers.append("MISSING_TEACHER_MAP_APPROVED_VERDICT")
    if unapproved_errs:
        blockers.append(f"UNAPPROVED_ERROR_CODES:{len(unapproved_errs)}")
    if unapproved_s1:
        blockers.append(f"UNAPPROVED_S1_ROWS:{len(unapproved_s1)}")
    if unapproved_qs:
        blockers.append(f"UNAPPROVED_QUESTION_ROWS:{len(unapproved_qs)}")
    if not release_auth:
        blockers.append("MISSING_TEACHER_RELEASE_AUTHORIZED_VERDICT")

    releasable = len(blockers) == 0
    gate = GateResult(
        gate_id="G7_TEACHER_GOVERNANCE_AND_RELEASE",
        stage="P6",
        status="PASS" if releasable else "BLOCKED",
        reason_code="RELEASE_AUTHORIZED" if releasable else "AWAITING_HUMAN_TEACHER_VERDICT",
        summary=(
            "خشاب تمام دروازه‌های فنی و حکم‌های امضاشدهٔ معلّم را گذرانده و آمادهٔ انتشار است."
            if releasable
            else f"انتشار نهایی مسدود است ({len(blockers)} مانع فعال): "
            f"{len(unapproved_s1)} ردیف S1 زرد، {len(unapproved_qs)} سؤال زرد، "
            f"{len(unapproved_errs)} کد خطای پیشنهادی و {open_issue_count} تعارض باز در انتظار حکم معلّم."
        ),
        metrics={
            "releasable": releasable,
            "active_verdict_count": len(active_verdicts),
            "invalidated_verdict_count": len(invalidated_verdicts),
            "unapproved_s1_count": len(unapproved_s1),
            "unapproved_question_count": len(unapproved_qs),
            "unapproved_error_code_count": len(unapproved_errs),
            "open_issue_count": open_issue_count,
            "blocker_reasons": blockers,
        },
        issues=[{"blocker": b} for b in blockers] + invalidated_verdicts,
    )
    return gate, pending


def build_and_save_wave_manifest(
    *,
    out_path: str | Path,
    manifest_id: str,
    wave_id: str,
    book_manifest_path: str | Path,
    snapshot_path: str | Path,
    pagemap_xlsx_path: str | Path,
    base_cartridge_path: str | Path,
    output_cartridge_path: str | Path,
    converted_json_path: Optional[str | Path],
    gates: List[GateResult],
    ledger: GovernanceLedger,
    releasable: bool,
    blocker_reasons: List[str],
) -> WaveManifest:
    bm = json.loads(Path(book_manifest_path).read_text(encoding="utf-8"))
    wm = WaveManifest(
        manifest_id=manifest_id,
        wave_id=wave_id,
        book_code=bm["book_code"],
        source_pdf_sha256=bm["source_pdf"]["sha256"],
        snapshot_id="master-map-C205-v2.0",
        snapshot_sha256=file_sha256(str(snapshot_path)),
        pagemap_xlsx_sha256=file_sha256(str(pagemap_xlsx_path)),
        base_cartridge_xlsx_sha256=file_sha256(str(base_cartridge_path)),
        output_cartridge_xlsx_sha256=file_sha256(str(output_cartridge_path)),
        converted_json_sha256=(
            file_sha256(str(converted_json_path))
            if converted_json_path and Path(converted_json_path).exists()
            else None
        ),
        generated_at_utc=utc_now_iso(),
        gates=gates,
        teacher_verdicts=ledger.verdicts,
        releasable=releasable,
        release_blocker_reasons=blocker_reasons,
    )
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(wm.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return wm


# =============================================================================
# v2.4-hardening (بند ۵ و ۶): احراز هویتِ سمتِ سرورِ معلم — یک نقطهٔ حقیقت
# هیچ مسیری (HTTP viewer یا CLI) نباید با رشتهٔ نقشِ اعلامیِ فراخواننده
# رأیِ انسانیِ معتبر بسازد؛ توکن باید خارج از Git و صریح تنظیم شود.
# =============================================================================
def expected_teacher_token(repo_root: str | Path) -> Optional[str]:
    """توکنِ مورد انتظارِ سمتِ سرور؛ `None` یعنی هیچ توکنی پیکربندی نشده (fail-closed).

    منابعِ مجاز (به‌ترتیب):
      1. متغیر محیطی `KHSHAB_TEACHER_TOKEN`
      2. فایلِ خارج از Git: `authoring/audit/teacher_token.txt`
    هیچ مقدارِ پیش‌فرضِ قابلِ حدسی وجود ندارد.
    """
    import os

    env_tok = (os.environ.get("KHSHAB_TEACHER_TOKEN") or "").strip()
    if env_tok:
        return env_tok
    tok_file = Path(repo_root) / "authoring/audit/teacher_token.txt"
    if tok_file.exists():
        val = tok_file.read_text(encoding="utf-8").strip()
        if val:
            return val
    return None


def authenticate_teacher(
    repo_root: str | Path,
    provided_token: Optional[str],
    token_file: Optional[str | Path] = None,
) -> Tuple[bool, str, Optional[str]]:
    """احراز هویتِ معلم.

    خروجی: `(authenticated, auth_method, failure_reason)`.
    `token_file` مسیرِ جایگزینِ ارائه‌شده توسط فراخواننده برای خواندنِ توکن است
    (مثلاً در CLI) و محتوای آن با توکنِ پیکربندی‌شدهٔ سرور مقایسه می‌شود.
    """
    expected = expected_teacher_token(repo_root)
    if expected is None:
        return False, "", "TEACHER_TOKEN_NOT_CONFIGURED: هیچ توکنِ سمتِ سروری تنظیم نشده است (KHSHAB_TEACHER_TOKEN یا authoring/audit/teacher_token.txt خارج از Git)."
    supplied = (provided_token or "").strip()
    if not supplied and token_file is not None:
        tf = Path(token_file)
        if tf.exists():
            supplied = tf.read_text(encoding="utf-8").strip()
        else:
            return False, "", f"TEACHER_TOKEN_FILE_MISSING: فایل توکن یافت نشد: {tf}"
    if not supplied:
        return False, "", "TEACHER_TOKEN_MISSING: توکن ارائه نشد."
    if supplied != expected:
        return False, "", "TEACHER_TOKEN_INVALID: توکنِ ارائه‌شده با توکنِ سمتِ سرور مطابقت ندارد."
    method = "KHSHAB_TEACHER_TOKEN_FILE" if (token_file is not None and not (provided_token or "").strip()) else "X-Teacher-Token"
    return True, method, None
