"""M13 local, read-only preflight for a limited M00/M01/M02 contract slice.

M00 checks PDF/manifest identity; M01 checks PDF quarantine safety plus workspace
ownership/copyright guards; M02 validates an already-produced, source-bound
observation packet. The existing coverage gate is reported separately as
G_ACHILLES_COVERAGE, not mislabeled as M02. This runner does not invoke
``observe_pdf`` (which may create temporary crops) or perform network/GitHub
operations. The default run is no-write; only an explicit private checkpoint
writes bounded resume state. PASS is technical only, never human approval/release.
"""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import math
import multiprocessing
import os
import re
import stat
import subprocess
import sys
import tempfile
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from multiprocessing.connection import wait as wait_connections
from pathlib import Path
from typing import Any

from .achilles_gate import verify_evidence_coverage_gate
from .git_guard import audit_git_copyright_safety, check_ownership_boundary
from .models import canonical_sha256_obj, file_sha256, utc_now_iso

_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _resolve_input(value: str | Path | None, repo_root: Path) -> Path | None:
    if value is None:
        return None
    path = Path(value)
    return (path if path.is_absolute() else repo_root / path).resolve()


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _runtime_fingerprint() -> dict[str, Any]:
    def version(distribution: str) -> str | None:
        try:
            return importlib.metadata.version(distribution)
        except importlib.metadata.PackageNotFoundError:
            return None

    return {
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "os_name": os.name,
        "openpyxl": version("openpyxl"),
        "pymupdf": version("PyMuPDF"),
    }


def _is_finite_number(value: Any) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(float(value))
    except (OverflowError, ValueError):
        return False


def _gate(bot_id: str, status: str, reason_code: str, summary: str,
          metrics: dict[str, Any] | None = None,
          issues: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "bot_id": bot_id,
        "status": status,
        "reason_code": reason_code,
        "summary": summary,
        "metrics": metrics or {},
        "issues": issues or [],
    }


def _run_m00_source_guard(
    *, repo_root: Path, expected_book_code: str,
    pdf_path: Path | None, manifest_path: Path | None,
) -> dict[str, Any]:
    missing = []
    if pdf_path is None:
        missing.append("PDF_PATH_REQUIRED")
    elif not pdf_path.is_file():
        missing.append("SOURCE_PDF_UNAVAILABLE")
    if manifest_path is None:
        missing.append("BOOK_MANIFEST_REQUIRED")
    elif not manifest_path.is_file():
        missing.append("BOOK_MANIFEST_UNAVAILABLE")
    if missing:
        return _gate(
            "M00", "BLOCKED", "SOURCE_INPUTS_MISSING",
            "برای تثبیت منبع، PDF واقعی و manifest همان چاپ لازم است.",
            {"expected_book_code": expected_book_code.upper()},
            [{"error": code} for code in missing],
        )

    assert pdf_path is not None and manifest_path is not None
    if _is_within(pdf_path, repo_root):
        return _gate(
            "M00", "FAIL", "PDF_MUST_REMAIN_OUTSIDE_GIT",
            "PDF داخل درخت مخزن است؛ پردازش متوقف شد تا منبع محرمانه وارد Git نشود.",
            {"pdf_basename": pdf_path.name},
            [{"error": "PDF_INSIDE_REPOSITORY", "pdf_basename": pdf_path.name}],
        )

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return _gate(
            "M00", "FAIL", "BOOK_MANIFEST_UNREADABLE",
            "manifest خوانده نشد؛ اتصال منبع قابل‌تأیید نیست.",
            {"manifest_basename": manifest_path.name},
            [{"error": "BOOK_MANIFEST_UNREADABLE", "detail": str(exc)}],
        )

    if not isinstance(manifest, dict):
        return _gate("M00", "FAIL", "BOOK_MANIFEST_INVALID", "ساختار manifest شیء JSON نیست.")

    book_code = str(manifest.get("book_code") or "").strip().upper()
    source = manifest.get("source_pdf")
    if not isinstance(source, dict):
        return _gate(
            "M00", "FAIL", "MANIFEST_SOURCE_PDF_MISSING",
            "manifest بخش source_pdf معتبر ندارد.",
            issues=[{"error": "MANIFEST_SOURCE_PDF_MISSING"}],
        )

    expected_filename = str(source.get("filename") or "").strip()
    expected_sha = str(source.get("sha256") or "").lower()
    expected_size = source.get("size_bytes")
    expected_page_count = source.get("pdf_page_count")
    try:
        actual_size = pdf_path.stat().st_size
        with pdf_path.open("rb") as pdf_stream:
            pdf_magic = pdf_stream.read(5)
        actual_sha = file_sha256(str(pdf_path))
    except OSError as exc:
        return _gate(
            "M00", "BLOCKED", "SOURCE_PDF_UNREADABLE",
            "باینری PDF قابل خواندن نیست؛ اتصال منبع تأیید نشد.",
            {"pdf_basename": pdf_path.name},
            [{"error": "SOURCE_PDF_UNREADABLE", "detail": str(exc)}],
        )
    edition = str(manifest.get("edition_label_fa") or "").strip()
    manifest_id = str(manifest.get("manifest_id") or "").strip()
    pagination = manifest.get("pagination")
    offset = pagination.get("pdf_minus_book_offset") if isinstance(pagination, dict) else None

    issues: list[dict[str, Any]] = []
    if book_code != expected_book_code.upper():
        issues.append({"error": "BOOK_CODE_MISMATCH", "manifest": book_code,
                       "expected": expected_book_code.upper()})
    if not expected_filename:
        issues.append({"error": "MANIFEST_PDF_FILENAME_MISSING"})
    elif expected_filename != pdf_path.name:
        issues.append({"error": "PDF_FILENAME_MISMATCH", "expected": expected_filename,
                       "actual": pdf_path.name})
    if pdf_magic != b"%PDF-":
        issues.append({"error": "PDF_MAGIC_INVALID", "detail": "ورودی با امضای PDF آغاز نمی‌شود."})
    if not _HEX64.fullmatch(expected_sha):
        issues.append({"error": "MANIFEST_PDF_SHA_INVALID"})
    elif actual_sha != expected_sha:
        issues.append({"error": "PDF_SHA_MISMATCH", "expected": expected_sha,
                       "actual": actual_sha})
    if type(expected_size) is not int or expected_size <= 0:
        issues.append({"error": "MANIFEST_PDF_SIZE_MISSING_OR_INVALID"})
    elif expected_size != actual_size:
        issues.append({"error": "PDF_SIZE_MISMATCH", "expected": expected_size,
                       "actual": actual_size})
    if expected_page_count is not None and (type(expected_page_count) is not int or expected_page_count <= 0):
        issues.append({"error": "MANIFEST_PDF_PAGE_COUNT_INVALID"})
    if not manifest_id or not edition:
        issues.append({"error": "MANIFEST_EDITION_IDENTITY_MISSING"})
    if type(offset) is not int:
        issues.append({"error": "MANIFEST_OFFSET_MISSING_OR_INVALID"})

    metrics = {
        "book_code": book_code,
        "expected_book_code": expected_book_code.upper(),
        "pdf_basename": pdf_path.name,
        "manifest_pdf_filename": expected_filename or None,
        "actual_pdf_sha256": actual_sha,
        "manifest_pdf_sha256": expected_sha,
        "actual_size_bytes": actual_size,
        "manifest_size_bytes": expected_size,
        "manifest_pdf_page_count": expected_page_count if type(expected_page_count) is int else None,
        "manifest_id": manifest_id or None,
        "edition_label_fa": edition or None,
        "manifest_offset_value": offset if type(offset) is int else None,
        "body_pdf_page_start": pagination.get("body_pdf_page_start") if isinstance(pagination, dict) else None,
        "body_pdf_page_end": pagination.get("body_pdf_page_end") if isinstance(pagination, dict) else None,
        "offset_is_integer_only_not_proven": type(offset) is int,
    }
    if issues:
        return _gate(
            "M00", "FAIL", issues[0]["error"],
            "هویت یا hash منبع با manifest سازگار نیست؛ fail-closed.", metrics, issues,
        )
    return _gate(
        "M00", "PASS", "SOURCE_IDENTITY_MATCHED",
        "PDF خارج از مخزن با کد کتاب، hash و اندازهٔ manifest هم‌خوان است؛ اثبات offset هنوز به گیت observation/pagemap وابسته است.",
        metrics,
    )


def _run_m01_safe_pdf_guard(repo_root: Path, pdf_path: Path | None) -> dict[str, Any]:
    """Check source quarantine/access and run read-only copyright/ownership guards."""
    path_issues: list[dict[str, Any]] = []
    path_metrics: dict[str, Any] = {"pdf_basename": pdf_path.name if pdf_path else None}
    if pdf_path is None:
        path_status, path_reason = "BLOCKED", "SECURE_PDF_PATH_REQUIRED"
        path_issues.append({"error": "SECURE_PDF_PATH_REQUIRED"})
    elif not pdf_path.is_file():
        path_status, path_reason = "BLOCKED", "SOURCE_PDF_UNAVAILABLE"
        path_issues.append({"error": "SOURCE_PDF_UNAVAILABLE"})
    elif _is_within(pdf_path, repo_root):
        path_status, path_reason = "FAIL", "PDF_MUST_REMAIN_OUTSIDE_GIT"
        path_issues.append({"error": "PDF_INSIDE_REPOSITORY", "pdf_basename": pdf_path.name})
    else:
        try:
            pdf_stat = pdf_path.stat()
            vault_stat = pdf_path.parent.stat()
            file_mode = stat.S_IMODE(pdf_stat.st_mode)
            vault_mode = stat.S_IMODE(vault_stat.st_mode)
            path_metrics.update({
                "pdf_mode_octal": oct(file_mode),
                "vault_mode_octal": oct(vault_mode),
                "readable_by_process": os.access(pdf_path, os.R_OK),
            })
            if not stat.S_ISDIR(vault_stat.st_mode):
                path_status, path_reason = "FAIL", "QUARANTINE_PARENT_NOT_DIRECTORY"
                path_issues.append({"error": "QUARANTINE_PARENT_NOT_DIRECTORY"})
            elif not os.access(pdf_path, os.R_OK):
                path_status, path_reason = "BLOCKED", "SOURCE_PDF_NOT_READABLE"
                path_issues.append({"error": "SOURCE_PDF_NOT_READABLE"})
            elif vault_mode & 0o077:
                path_status, path_reason = "FAIL", "QUARANTINE_DIRECTORY_PERMISSIONS_UNSAFE"
                path_issues.append({"error": "QUARANTINE_DIRECTORY_PERMISSIONS_UNSAFE",
                                    "mode_octal": oct(vault_mode)})
            elif file_mode & 0o077:
                path_status, path_reason = "FAIL", "SOURCE_PDF_PERMISSIONS_UNSAFE"
                path_issues.append({"error": "SOURCE_PDF_PERMISSIONS_UNSAFE",
                                    "mode_octal": oct(file_mode)})
            else:
                path_status, path_reason = "PASS", "SECURE_QUARANTINE_PATH"
        except OSError as exc:
            path_status, path_reason = "BLOCKED", "QUARANTINE_METADATA_UNAVAILABLE"
            path_issues.append({"error": "QUARANTINE_METADATA_UNAVAILABLE",
                                "exception_type": type(exc).__name__})

    path_result = {
        "status": path_status,
        "reason_code": path_reason,
        "metrics": path_metrics,
        "issues": path_issues,
    }
    try:
        copyright_gate = audit_git_copyright_safety(repo_root).to_dict()
        ownership_gate = check_ownership_boundary(repo_root).to_dict()
        workspace_result = {
            "status": _combined_status([copyright_gate, ownership_gate]),
            "copyright_guard": copyright_gate,
            "ownership_guard": ownership_gate,
            "issues": copyright_gate.get("issues", []) + ownership_gate.get("issues", []),
        }
    except (OSError, subprocess.SubprocessError) as exc:
        workspace_result = {
            "status": "BLOCKED",
            "reason_code": "GIT_GUARDS_UNAVAILABLE",
            "issues": [{"error": "GIT_GUARDS_UNAVAILABLE", "exception_type": type(exc).__name__}],
        }

    child_statuses = [path_result["status"], workspace_result["status"]]
    status = _combined_status([{"status": value} for value in child_statuses])
    first_non_pass = next((item for item in (path_result, workspace_result) if item["status"] != "PASS"), None)
    reason_result = next((item for item in (path_result, workspace_result) if item["status"] == status), first_non_pass)
    if reason_result is path_result:
        reason = path_reason
    elif reason_result:
        reason = workspace_result.get("reason_code") or next((
            guard.get("reason_code") for guard in (
                workspace_result.get("copyright_guard", {}),
                workspace_result.get("ownership_guard", {}),
            ) if guard.get("status") != "PASS"
        ), "WORKSPACE_GUARD_NOT_PASS")
    else:
        reason = "SAFE_PDF_AND_WORKSPACE_GUARDS_PASS"
    summaries = {
        "PASS": "PDF در قرنطینهٔ خصوصی و بیرون Git است؛ گاردهای حق‌نشر و مالکیت نیز پاس شدند.",
        "WARN": "مسیر امن یا یکی از گاردهای workspace هشدار دارد؛ بررسی تکمیلی لازم است.",
        "BLOCKED": "مسیر/دسترسی منبع یا گارد workspace قابل‌تأیید نیست؛ ادامه fail-closed متوقف می‌شود.",
        "FAIL": "PDF در قرنطینهٔ امن نیست یا یکی از گاردهای workspace مردود شد.",
    }
    issues = path_issues + workspace_result.get("issues", [])
    return _gate(
        "M01", status, reason, summaries[status],
        {"pdf_path_guard": path_result, "workspace_guards": workspace_result},
        issues,
    )


def _combined_status(results: list[dict[str, Any]]) -> str:
    statuses = [str(result.get("status", "ERROR")) for result in results]
    if "FAIL" in statuses or any(status not in {"PASS", "WARN", "BLOCKED", "FAIL"} for status in statuses):
        return "FAIL"
    if "BLOCKED" in statuses:
        return "BLOCKED"
    if "WARN" in statuses:
        return "WARN"
    return "PASS"


def _run_m02_observation_packet(
    *, expected_book_code: str, source_sha256: str | None,
    manifest_metrics: dict[str, Any], observation_path: Path | None,
    upstream_statuses: list[str],
) -> dict[str, Any]:
    """Validate an existing observe_pdf packet; never run OCR/vision or write crops."""
    if any(status != "PASS" for status in upstream_statuses):
        return _gate(
            "M02", "BLOCKED", "SOURCE_GATES_NOT_PASSED",
            "مشاهده تا پاس‌شدن هویت منبع و قرنطینهٔ PDF اعتبارسنجی نمی‌شود.",
            issues=[{"error": "SOURCE_GATES_NOT_PASSED"}],
        )
    if observation_path is None:
        return _gate(
            "M02", "BLOCKED", "OBSERVATION_PACKET_REQUIRED",
            "M02 نیازمند observation ازپیش‌تولیدشده است؛ این runner خودش OCR/crop اجرا نمی‌کند.",
            issues=[{"error": "OBSERVATION_PACKET_REQUIRED"}],
        )
    if not observation_path.is_file():
        return _gate(
            "M02", "BLOCKED", "OBSERVATION_PACKET_UNAVAILABLE",
            "فایل observation پیدا نشد؛ هیچ مشاهده‌ای جعل یا جایگزین نشد.",
            {"observation_basename": observation_path.name},
            [{"error": "OBSERVATION_PACKET_UNAVAILABLE"}],
        )
    try:
        if observation_path.stat().st_size > 50 * 1024 * 1024:
            return _gate(
                "M02", "BLOCKED", "OBSERVATION_PACKET_SIZE_LIMIT",
                "observation از سقف ۵۰ MiB این preflight بزرگ‌تر است.",
                {"observation_basename": observation_path.name},
                [{"error": "OBSERVATION_PACKET_SIZE_LIMIT"}],
            )
        payload = json.loads(observation_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return _gate(
            "M02", "FAIL", "OBSERVATION_PACKET_UNREADABLE",
            "observation خوانده نشد؛ اعتبار منبع/صفحه تأییدنشده است.",
            {"observation_basename": observation_path.name},
            [{"error": "OBSERVATION_PACKET_UNREADABLE", "exception_type": type(exc).__name__}],
        )
    if not isinstance(payload, dict):
        return _gate("M02", "FAIL", "OBSERVATION_PACKET_INVALID", "ریشهٔ observation باید شیء JSON باشد.")

    issues: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    schema_version = str(payload.get("schema_version") or "")
    if schema_version not in {"1.0.0", "2.0.0"}:
        issues.append({"error": "OBSERVATION_SCHEMA_UNSUPPORTED"})
    observed_book_code = str(payload.get("book_code") or "").strip().upper()
    if observed_book_code != expected_book_code.upper():
        issues.append({"error": "OBSERVATION_BOOK_CODE_MISMATCH"})
    observed_sha = str(payload.get("source_pdf_sha256") or "").lower()
    if not _HEX64.fullmatch(observed_sha) or not source_sha256 or observed_sha != source_sha256.lower():
        issues.append({"error": "OBSERVATION_SOURCE_SHA_MISMATCH"})

    quality_scores = payload.get("quality_scores")
    if not isinstance(quality_scores, list) or not quality_scores:
        issues.append({"error": "OBSERVATION_QUALITY_SCORES_MISSING"})
        quality_scores = []
    if len(quality_scores) > 100_000:
        return _gate("M02", "FAIL", "OBSERVATION_PAGE_COUNT_LIMIT",
                     "تعداد رکوردهای صفحه از سقف این validator بیشتر است.")
    expected_page_count = manifest_metrics.get("manifest_pdf_page_count")
    body_start = manifest_metrics.get("body_pdf_page_start")
    body_end = manifest_metrics.get("body_pdf_page_end")
    offset = manifest_metrics.get("manifest_offset_value")
    observed_pages: set[int] = set()
    footer_mismatches: list[int] = []
    footer_missing = 0
    high_visual_dependency = 0
    allowed_footer = {"MATCH", "FRONT_OR_BACK_MATTER", "MISMATCH", "MISSING"}
    allowed_visual = {"LOW", "MEDIUM", "HIGH"}
    for row in quality_scores:
        if not isinstance(row, dict):
            issues.append({"error": "OBSERVATION_PAGE_ENTRY_INVALID"})
            continue
        page_no = row.get("pdf_page")
        if type(page_no) is not int or page_no <= 0 or page_no in observed_pages:
            issues.append({"error": "OBSERVATION_PDF_PAGE_INVALID"})
            continue
        observed_pages.add(page_no)
        footer_status = row.get("footer_alignment_status")
        if not isinstance(footer_status, str) or footer_status not in allowed_footer:
            issues.append({"error": "OBSERVATION_FOOTER_STATUS_INVALID", "pdf_page": page_no})
        elif footer_status == "MISMATCH":
            footer_mismatches.append(page_no)
        elif footer_status == "MISSING":
            footer_missing += 1
        visual_dependency = row.get("visual_dependency")
        if not isinstance(visual_dependency, str) or visual_dependency not in allowed_visual:
            issues.append({"error": "OBSERVATION_VISUAL_DEPENDENCY_INVALID", "pdf_page": page_no})
        elif visual_dependency == "HIGH":
            high_visual_dependency += 1
        score = row.get("quality_score")
        if not _is_finite_number(score) or not 0.0 <= float(score) <= 1.0:
            issues.append({"error": "OBSERVATION_QUALITY_SCORE_INVALID", "pdf_page": page_no})
        if not isinstance(row.get("hazards", []), list):
            issues.append({"error": "OBSERVATION_HAZARDS_INVALID", "pdf_page": page_no})
        if (type(body_start) is int and type(body_end) is int and type(offset) is int
                and body_start <= page_no <= body_end):
            expected_book_page = row.get("expected_book_page")
            if type(expected_book_page) is not int or expected_book_page != page_no - offset:
                issues.append({"error": "OBSERVATION_OFFSET_CONFLICT", "pdf_page": page_no})

    if observed_pages and observed_pages != set(range(1, len(observed_pages) + 1)):
        issues.append({"error": "OBSERVATION_PAGE_SEQUENCE_INCOMPLETE"})
    if type(expected_page_count) is int and len(observed_pages) != expected_page_count:
        issues.append({"error": "OBSERVATION_PAGE_COUNT_MISMATCH",
                       "expected": expected_page_count, "actual": len(observed_pages)})

    ledger = payload.get("evidence_ledger")
    if not isinstance(ledger, dict):
        issues.append({"error": "OBSERVATION_EVIDENCE_LEDGER_INVALID"})
        ledger = {}
    if len(ledger) > 100_000:
        return _gate("M02", "FAIL", "OBSERVATION_EVIDENCE_COUNT_LIMIT",
                     "تعداد رکوردهای شاهد از سقف این validator بیشتر است.")
    allowed_evidence_kinds = {
        "pdf_text_bbox", "pdf_crop_150dpi", "pdf_crop_300dpi_nearest",
        "physical_book_photo", "independent_computation", "teacher_verdict",
    }
    bbox_kinds = {"pdf_text_bbox", "pdf_crop_150dpi", "pdf_crop_300dpi_nearest"}
    crop_kinds = {"pdf_crop_150dpi", "pdf_crop_300dpi_nearest"}
    evidence_ids: set[str] = set()
    for key, item in ledger.items():
        if not isinstance(item, dict):
            issues.append({"error": "OBSERVATION_EVIDENCE_ENTRY_INVALID"})
            continue
        evidence_id = str(item.get("evidence_id") or "")
        evidence_ids.add(evidence_id)
        if evidence_id != key:
            issues.append({"error": "OBSERVATION_EVIDENCE_ID_MISMATCH"})
        if str(item.get("book_code") or "").upper() != expected_book_code.upper():
            issues.append({"error": "OBSERVATION_EVIDENCE_BOOK_MISMATCH", "evidence_id": evidence_id})
        if str(item.get("source_sha256") or "").lower() != (source_sha256 or "").lower():
            issues.append({"error": "OBSERVATION_EVIDENCE_SOURCE_MISMATCH", "evidence_id": evidence_id})
        page_no = item.get("pdf_page")
        if type(page_no) is not int or page_no not in observed_pages:
            issues.append({"error": "OBSERVATION_EVIDENCE_PAGE_INVALID", "evidence_id": evidence_id})
        evidence_kind = item.get("evidence_kind")
        if not isinstance(evidence_kind, str) or evidence_kind not in allowed_evidence_kinds:
            issues.append({"error": "OBSERVATION_EVIDENCE_KIND_INVALID", "evidence_id": evidence_id})
        bbox = item.get("bbox_normalized")
        bbox_valid = (
            isinstance(bbox, list)
            and len(bbox) == 4
            and all(_is_finite_number(value) for value in bbox)
            and 0.0 <= float(bbox[0]) < float(bbox[2]) <= 1.0
            and 0.0 <= float(bbox[1]) < float(bbox[3]) <= 1.0
        )
        if isinstance(evidence_kind, str) and evidence_kind in bbox_kinds and not bbox_valid:
            issues.append({"error": "OBSERVATION_BBOX_INVALID", "evidence_id": evidence_id})
        if isinstance(evidence_kind, str) and evidence_kind in crop_kinds and not _HEX64.fullmatch(str(item.get("crop_sha256") or "").lower()):
            issues.append({"error": "OBSERVATION_CROP_SHA_INVALID", "evidence_id": evidence_id})
    if not ledger:
        warnings.append({"error": "OBSERVATION_HAS_NO_EVIDENCE_REFS"})

    claims = payload.get("claims")
    if not isinstance(claims, list):
        issues.append({"error": "OBSERVATION_CLAIMS_INVALID"})
        claims = []
    if len(claims) > 100_000:
        return _gate("M02", "FAIL", "OBSERVATION_CLAIM_COUNT_LIMIT",
                     "تعداد رکوردهای claim از سقف این validator بیشتر است.")
    allowed_confidence = {"HIGH", "MEDIUM", "LOW", "UNOBSERVABLE"}
    unobservable_claims = 0
    claim_ids: set[str] = set()
    for claim in claims:
        if not isinstance(claim, dict):
            issues.append({"error": "OBSERVATION_CLAIM_ENTRY_INVALID"})
            continue
        claim_id = str(claim.get("claim_id") or "")
        page_no = claim.get("pdf_page")
        if not claim_id or claim_id in claim_ids:
            issues.append({"error": "OBSERVATION_CLAIM_ID_MISSING_OR_DUPLICATE"})
        claim_ids.add(claim_id)
        if type(page_no) is not int or page_no not in observed_pages:
            issues.append({"error": "OBSERVATION_CLAIM_PAGE_INVALID"})
        confidence = claim.get("confidence")
        if not isinstance(confidence, str) or confidence not in allowed_confidence:
            issues.append({"error": "OBSERVATION_CLAIM_CONFIDENCE_INVALID"})
        if confidence == "UNOBSERVABLE":
            unobservable_claims += 1
        refs = claim.get("evidence_refs")
        if not isinstance(refs, list) or any(not isinstance(ref, str) for ref in refs):
            issues.append({"error": "OBSERVATION_CLAIM_REFS_INVALID"})
            continue
        if any(ref not in evidence_ids for ref in refs):
            issues.append({"error": "OBSERVATION_CLAIM_REF_DANGLING"})
        if not refs and confidence != "UNOBSERVABLE":
            issues.append({"error": "OBSERVATION_CLAIM_WITHOUT_EVIDENCE"})

    if footer_missing:
        warnings.append({"error": "OBSERVATION_FOOTER_MISSING", "count": footer_missing})
    if high_visual_dependency:
        warnings.append({"error": "OBSERVATION_HIGH_VISUAL_DEPENDENCY", "count": high_visual_dependency})
    if unobservable_claims:
        warnings.append({"error": "OBSERVATION_UNOBSERVABLE_CLAIMS", "count": unobservable_claims})
    metrics = {
        "observation_basename": observation_path.name,
        "schema_version": schema_version,
        "book_code": observed_book_code,
        "source_sha256_matched": observed_sha == (source_sha256 or "").lower(),
        "pages_observed": len(observed_pages),
        "manifest_page_count": expected_page_count,
        "evidence_ref_count": len(ledger),
        "evidence_ref_ids": sorted(evidence_ids)[:1000],
        "evidence_ref_ids_truncated": len(evidence_ids) > 1000,
        "claim_count": len(claims),
        "footer_mismatch_count": len(footer_mismatches),
        "footer_missing_count": footer_missing,
        "high_visual_dependency_count": high_visual_dependency,
        "unobservable_claim_count": unobservable_claims,
    }
    if issues:
        reason = issues[0]["error"]
        return _gate(
            "M02", "FAIL", reason,
            "observation structure or source/page binding is inconsistent; fail-closed.",
            metrics, issues[:12],
        )
    if footer_mismatches:
        return _gate(
            "M02", "FAIL", "OBSERVATION_FOOTER_MISMATCH",
            "مشاهده شامل اختلاف شمارهٔ صفحه است؛ مورد تا بررسی انسانی fail-closed می‌ماند.",
            metrics, [{"error": "OBSERVATION_FOOTER_MISMATCH", "pdf_pages": footer_mismatches[:20]}],
        )
    if warnings:
        return _gate(
            "M02", "WARN", warnings[0]["error"],
            "بستهٔ مشاهده به منبع متصل است، اما بخشی از صفحه/شاهد نیازمند بازبینی است.",
            metrics, warnings[:12],
        )
    return _gate(
        "M02", "PASS", "OBSERVATION_PACKET_SOURCE_BOUND",
        "ساختار observation و اتصال SHA/کتاب/صفحه معتبر است؛ محتوای بصری یا درستی آموزشی مستقلاً تأیید نشده.",
        metrics,
    )


def _run_coverage_gate(
    *, expected_book_code: str, cartridge_path: Path,
    pdf_path: Path | None, manifest_path: Path | None,
    observation_path: Path | None, pagemap_path: Path | None,
    source_ready: bool,
) -> dict[str, Any]:
    """Run the existing coverage gate as a named supplemental gate, never as M02."""
    if not cartridge_path.is_file():
        return {
            "gate_id": "G_ACHILLES_COVERAGE", "stage": "P2", "status": "BLOCKED",
            "reason_code": "CARTRIDGE_UNAVAILABLE",
            "summary": "فایل خشاب برای گیت مستقل پوشش پیدا نشد.",
            "metrics": {"cartridge_basename": cartridge_path.name},
            "issues": [{"error": "CARTRIDGE_UNAVAILABLE"}],
        }
    if observation_path is not None and observation_path.is_file() and not source_ready:
        return {
            "gate_id": "G_ACHILLES_COVERAGE", "stage": "P2", "status": "BLOCKED",
            "reason_code": "SOURCE_GATES_NOT_PASSED",
            "summary": "گیت پوشش با observation صریح اجرا نشد چون گیت‌های منبع/قرنطینه پاس نشده‌اند.",
            "metrics": {}, "issues": [{"error": "SOURCE_GATES_NOT_PASSED"}],
        }
    try:
        result = verify_evidence_coverage_gate(
            cartridge_path,
            observation_json_path=observation_path,
            book_manifest_path=manifest_path if source_ready else None,
            pdf_path=pdf_path if source_ready else None,
            pagemap_xlsx_path=pagemap_path,
            repo_root=None,  # disable automatic fixture fallback: fixtures are not live observations
            expected_book_code=expected_book_code,
        )
    except Exception as exc:
        return {
            "gate_id": "G_ACHILLES_COVERAGE", "stage": "P2", "status": "FAIL",
            "reason_code": "COVERAGE_GATE_EXCEPTION",
            "summary": "گیت پوشش به خطا خورد؛ پوشش تأییدنشده است.",
            "metrics": {},
            "issues": [{"error": "COVERAGE_GATE_EXCEPTION", "exception_type": type(exc).__name__}],
        }
    return {"gate_id": "G_ACHILLES_COVERAGE", **result.to_dict()}


_DAG_VALID_STATUSES = {"PASS", "WARN", "BLOCKED", "FAIL", "ERROR", "DRAFT_YELLOW"}
_MAX_LOCAL_DAG_WORKERS = 4
_M13_MAX_PARALLEL_WORKERS = 2
_M13_NODE_TIMEOUT_SECONDS = 30.0


def _dag_failure(node_id: str, reason_code: str, summary: str,
                 issues: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        ("bot_id" if node_id.startswith("M") else "gate_id"): node_id,
        "status": "FAIL",
        "reason_code": reason_code,
        "summary": summary,
        "metrics": {},
        "issues": issues or [{"error": reason_code}],
    }


def _normalize_dag_result(node_id: str, result: Any) -> dict[str, Any]:
    if isinstance(result, dict) and result.get("status") in _DAG_VALID_STATUSES:
        return result
    return _dag_failure(
        node_id, "DAG_NODE_RESULT_INVALID", "گره خروجی نامعتبر داد؛ fail-closed."
    )


def _dag_worker_entry(connection: Any, runner: Any, outcomes: dict[str, dict[str, Any]]) -> None:
    """Run one fork-isolated node and return only its structured result or exception type."""
    try:
        try:
            payload = {"ok": True, "result": runner(outcomes)}
        except BaseException as exc:  # the parent converts worker errors to a fail-closed result
            payload = {"ok": False, "exception_type": type(exc).__name__}
        try:
            connection.send(payload)
        except BaseException:
            # A non-serializable result is handled as a worker failure by the parent.
            pass
    finally:
        try:
            connection.close()
        except OSError:
            pass


def _hard_timeout_context() -> Any | None:
    """Return a fork context where a wedged local node can be terminated reliably."""
    if os.name != "posix":
        return None
    try:
        if "fork" not in multiprocessing.get_all_start_methods():
            return None
        return multiprocessing.get_context("fork")
    except (AttributeError, RuntimeError, ValueError):
        return None


def _terminate_dag_worker(process: Any) -> None:
    try:
        if process.is_alive():
            process.terminate()
            process.join(timeout=0.5)
        if process.is_alive() and hasattr(process, "kill"):
            process.kill()
            process.join(timeout=0.5)
        elif not process.is_alive():
            process.join(timeout=0)
    except (AssertionError, OSError, ValueError):
        pass
    try:
        if not process.is_alive():
            process.close()
    except (AssertionError, OSError, ValueError):
        pass


_CHECKPOINT_SCHEMA = "khshab.microbot-checkpoint/v1"
_CHECKPOINT_MAX_BYTES = 10 * 1024 * 1024


def _secure_checkpoint_path(
    value: str | Path, repo_root: Path, *, resume: bool,
) -> Path:
    """Validate an explicit checkpoint target without creating directories or weakening modes."""
    if os.name != "posix":
        raise OSError("secure checkpoint files currently require POSIX permission semantics")
    requested = Path(value).expanduser()
    if not requested.is_absolute() or requested.name in {"", ".", ".."}:
        raise ValueError("checkpoint path must be an absolute file path")
    parent = requested.parent.resolve(strict=True)
    if not parent.is_dir():
        raise ValueError("checkpoint parent must already be a directory")
    target = parent / requested.name
    if _is_within(target.resolve(strict=False), repo_root):
        raise ValueError("checkpoint must be outside the Git worktree")
    parent_info = parent.stat()
    parent_mode = stat.S_IMODE(parent_info.st_mode)
    if (parent_mode & 0o700) != 0o700 or (parent_mode & 0o077) or (parent_mode & 0o7000):
        raise PermissionError("checkpoint directory must grant owner rwx and no group/other access (normally 0700)")
    if hasattr(os, "geteuid") and parent_info.st_uid != os.geteuid():
        raise PermissionError("checkpoint directory must be owned by the current user")

    try:
        info = os.lstat(target)
    except FileNotFoundError:
        exists = False
    else:
        exists = True
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
            raise ValueError("checkpoint target must be a regular, non-symlink file")
        file_mode = stat.S_IMODE(info.st_mode)
        if (file_mode & 0o600) != 0o600 or (file_mode & 0o077) or (file_mode & 0o7000):
            raise PermissionError("existing checkpoint must grant owner rw and no group/other access (normally 0600)")
        expected_uid = os.geteuid() if hasattr(os, "geteuid") else (os.getuid() if hasattr(os, "getuid") else None)
        if expected_uid is not None and info.st_uid != expected_uid:
            raise PermissionError("existing checkpoint must be owned by the current user")

    if resume and not exists:
        raise FileNotFoundError("resume checkpoint does not exist")
    if not resume and exists:
        raise FileExistsError("checkpoint target already exists; choose a new path or resume it explicitly")
    return target


def _checkpoint_payload(
    checkpoint_key: str, graph_sha256: str,
    outcomes: dict[str, dict[str, Any]], trace_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    unsigned = {
        "schema_version": _CHECKPOINT_SCHEMA,
        "checkpoint_key": checkpoint_key,
        "graph_sha256": graph_sha256,
        "completed": outcomes,
        "trace": trace_by_id,
    }
    return {**unsigned, "integrity_sha256": canonical_sha256_obj(unsigned)}


def _write_secure_checkpoint(path: Path, payload: dict[str, Any]) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    if len(encoded) > _CHECKPOINT_MAX_BYTES:
        raise ValueError("checkpoint exceeds the 10 MiB resource limit")
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        temporary = ""
        dir_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        if temporary:
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass


def _read_secure_checkpoint(path: Path, checkpoint_key: str, graph_sha256: str) -> dict[str, Any]:
    size = path.stat().st_size
    if size > _CHECKPOINT_MAX_BYTES:
        raise ValueError("checkpoint exceeds the 10 MiB resource limit")
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("checkpoint is unreadable or invalid JSON") from exc
    if not isinstance(loaded, dict):
        raise ValueError("checkpoint root must be a JSON object")
    integrity = loaded.get("integrity_sha256")
    unsigned = {key: value for key, value in loaded.items() if key != "integrity_sha256"}
    if not isinstance(integrity, str) or integrity != canonical_sha256_obj(unsigned):
        raise ValueError("checkpoint integrity hash mismatch")
    if loaded.get("schema_version") != _CHECKPOINT_SCHEMA:
        raise ValueError("unsupported checkpoint schema")
    if loaded.get("checkpoint_key") != checkpoint_key:
        raise ValueError("checkpoint inputs/code/branch do not match this run")
    if loaded.get("graph_sha256") != graph_sha256:
        raise ValueError("checkpoint DAG does not match this run")
    completed = loaded.get("completed")
    trace = loaded.get("trace")
    if not isinstance(completed, dict) or not isinstance(trace, dict) or set(completed) != set(trace):
        raise ValueError("checkpoint completed outcomes and trace are inconsistent")
    return loaded


def _execute_local_dag(
    nodes: list[dict[str, Any]], *, max_workers: int = 1,
    timeout_seconds: float | None = None,
    checkpoint_path: str | Path | None = None,
    checkpoint_key: str | None = None,
    repo_root: str | Path | None = None,
    resume_checkpoint: bool = False,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Run a validated bounded DAG; non-PASS dependencies block, and traces are topologically stable.

    Independent nodes may execute concurrently. When a POSIX ``fork`` context and
    ``timeout_seconds`` are available, each node runs in a killable child process,
    enforcing a wall-clock timeout. Otherwise the bounded thread runner is used.
    Checkpoints are opt-in, private, outside-repository files; only nodes explicitly
    marked ``checkpoint_safe`` may be persisted. Resume requires an exact key match.
    """
    if type(max_workers) is not int or not 1 <= max_workers <= _MAX_LOCAL_DAG_WORKERS:
        raise ValueError(f"max_workers must be an integer from 1 to {_MAX_LOCAL_DAG_WORKERS}")
    if timeout_seconds is not None and (
        not _is_finite_number(timeout_seconds) or float(timeout_seconds) <= 0
    ):
        raise ValueError("timeout_seconds must be a finite positive number or None")
    if type(resume_checkpoint) is not bool:
        raise ValueError("resume_checkpoint must be a boolean")
    if checkpoint_path is None:
        if checkpoint_key is not None or resume_checkpoint:
            raise ValueError("checkpoint_key/resume requires checkpoint_path")
    elif not isinstance(checkpoint_key, str) or not _HEX64.fullmatch(checkpoint_key):
        raise ValueError("checkpoint requires a 64-character SHA-256 checkpoint_key")
    elif repo_root is None:
        raise ValueError("checkpoint requires repo_root for the outside-worktree guard")

    if not isinstance(nodes, list):
        raise ValueError("DAG nodes must be a list")
    node_ids: list[str] = []
    node_by_id: dict[str, dict[str, Any]] = {}
    dependencies: dict[str, list[str]] = {}
    for node in nodes:
        if not isinstance(node, dict):
            raise ValueError("DAG nodes must be objects")
        node_id = node.get("node_id")
        if not isinstance(node_id, str) or not node_id:
            raise ValueError("DAG node IDs must be non-empty strings")
        if node_id in node_by_id:
            raise ValueError("DAG node IDs must be unique")
        deps = node.get("depends_on", [])
        if not isinstance(deps, (list, tuple)) or any(not isinstance(dep, str) or not dep for dep in deps):
            raise ValueError(f"DAG node {node_id} dependencies must be non-empty string IDs")
        if len(set(deps)) != len(deps):
            raise ValueError(f"DAG node {node_id} has duplicate dependencies")
        if not callable(node.get("run")):
            raise ValueError(f"DAG node {node_id} has no callable runner")
        if node.get("on_blocked") is not None and not callable(node["on_blocked"]):
            raise ValueError(f"DAG node {node_id} on_blocked must be callable")
        node_ids.append(node_id)
        node_by_id[node_id] = node
        dependencies[node_id] = list(deps)

    known_ids = set(node_ids)
    for node_id, deps in dependencies.items():
        unknown = set(deps) - known_ids
        if unknown:
            raise ValueError(f"DAG node {node_id} has unknown dependencies")
        if node_id in deps:
            raise ValueError(f"DAG node {node_id} cannot depend on itself")

    # Validate the whole graph before executing anything, then freeze a stable order.
    topo_order: list[str] = []
    topo_seen: set[str] = set()
    remaining = set(node_ids)
    while remaining:
        ready = [node_id for node_id in node_ids
                 if node_id in remaining and set(dependencies[node_id]) <= topo_seen]
        if not ready:
            raise ValueError("DAG contains a cycle")
        chosen = ready[0]
        topo_order.append(chosen)
        topo_seen.add(chosen)
        remaining.remove(chosen)

    outcomes: dict[str, dict[str, Any]] = {}
    trace_by_id: dict[str, dict[str, Any]] = {}
    checkpoint_target: Path | None = None
    graph_sha256: str | None = None
    if checkpoint_path is not None:
        if any(node_by_id[node_id].get("checkpoint_safe") is not True for node_id in topo_order):
            raise ValueError("all DAG nodes must explicitly set checkpoint_safe=True")
        graph_sha256 = canonical_sha256_obj({
            "nodes": [
                {
                    "node_id": node_id,
                    "depends_on": dependencies[node_id],
                    "supplemental": bool(node_by_id[node_id].get("supplemental", False)),
                    "checkpoint_safe": True,
                }
                for node_id in topo_order
            ],
            "max_workers": max_workers,
            "timeout_seconds": float(timeout_seconds) if timeout_seconds is not None else None,
        })
        checkpoint_target = _secure_checkpoint_path(
            checkpoint_path, Path(repo_root).resolve(), resume=resume_checkpoint
        )
        if resume_checkpoint:
            loaded = _read_secure_checkpoint(checkpoint_target, checkpoint_key, graph_sha256)
            saved_outcomes = loaded["completed"]
            saved_trace = loaded["trace"]
            if not set(saved_outcomes) <= known_ids:
                raise ValueError("checkpoint contains unknown DAG node IDs")
            for node_id, result in saved_outcomes.items():
                if not isinstance(result, dict) or result.get("status") not in _DAG_VALID_STATUSES:
                    raise ValueError("checkpoint contains an invalid node outcome")
                row = saved_trace.get(node_id)
                if not isinstance(row, dict):
                    raise ValueError("checkpoint is missing a node trace")
                if row.get("node_id") != node_id or row.get("depends_on") != dependencies[node_id]:
                    raise ValueError("checkpoint node trace does not match the DAG")
                if row.get("status") != result.get("status") or type(row.get("executed")) is not bool:
                    raise ValueError("checkpoint outcome and trace disagree")
                if row.get("supplemental") is not bool(node_by_id[node_id].get("supplemental", False)):
                    raise ValueError("checkpoint supplemental marker does not match the DAG")
                if type(row.get("attempts")) is not int or row["attempts"] < 1:
                    raise ValueError("checkpoint attempt count is invalid")
            for node_id, result in saved_outcomes.items():
                if not set(dependencies[node_id]) <= set(saved_outcomes):
                    raise ValueError("checkpoint is missing a completed node's prerequisites")
                blockers = [dep for dep in dependencies[node_id]
                            if saved_outcomes[dep].get("status") != "PASS"]
                row = saved_trace[node_id]
                if row["executed"] and blockers:
                    raise ValueError("checkpoint marks a node executed despite failed prerequisites")
                if blockers and row.get("skipped") != blockers:
                    raise ValueError("checkpoint blocker trace is inconsistent")
            outcomes.update(saved_outcomes)
            trace_by_id.update(saved_trace)

    def finish(node_id: str, result: Any, blockers: list[str], *, executed: bool) -> None:
        normalized = _normalize_dag_result(node_id, result)
        outcomes[node_id] = normalized
        trace_by_id[node_id] = {
            "node_id": node_id,
            "depends_on": dependencies[node_id],
            "executed": executed,
            "status": normalized["status"],
            "reason_code": normalized.get("reason_code"),
            "skipped": list(blockers),
            "supplemental": bool(node_by_id[node_id].get("supplemental", False)),
            "attempts": 1,
        }
        if checkpoint_target is not None:
            assert checkpoint_key is not None and graph_sha256 is not None
            _write_secure_checkpoint(
                checkpoint_target,
                _checkpoint_payload(checkpoint_key, graph_sha256, outcomes, trace_by_id),
            )

    def blocked_result(node_id: str, blockers: list[str]) -> dict[str, Any]:
        node = node_by_id[node_id]
        callback = node.get("on_blocked")
        if callback is None:
            return {
                ("bot_id" if node_id.startswith("M") else "gate_id"): node_id,
                "status": "BLOCKED",
                "reason_code": "UPSTREAM_DEPENDENCY_NOT_PASS",
                "summary": "وابستگی پیش‌نیاز پاس نشده است؛ این گره اجرا نشد.",
                "metrics": {},
                "issues": [{"error": "UPSTREAM_DEPENDENCY_NOT_PASS", "blocked_by": blockers}],
            }
        try:
            return callback(blockers, dict(outcomes))
        except Exception as exc:
            return _dag_failure(
                node_id, "DAG_NODE_EXCEPTION", "گرهٔ blocked-handler به خطا خورد؛ fail-closed.",
                [{"error": "DAG_NODE_EXCEPTION", "exception_type": type(exc).__name__}],
            )

    context = _hard_timeout_context() if timeout_seconds is not None else None
    if context is not None:
        pending = set(node_ids) - set(outcomes)
        running: dict[str, dict[str, Any]] = {}
        try:
            while pending or running:
                made_progress = False
                for node_id in node_ids:
                    if node_id not in pending or not set(dependencies[node_id]) <= set(outcomes):
                        continue
                    blockers = [dep for dep in dependencies[node_id]
                                if outcomes[dep].get("status") != "PASS"]
                    if blockers:
                        pending.remove(node_id)
                        finish(node_id, blocked_result(node_id, blockers), blockers, executed=False)
                        made_progress = True
                        continue
                    if len(running) >= max_workers:
                        break
                    recv_conn, send_conn = context.Pipe(duplex=False)
                    process = context.Process(
                        target=_dag_worker_entry,
                        args=(send_conn, node_by_id[node_id]["run"], dict(outcomes)),
                        name=f"M13-{node_id}",
                    )
                    try:
                        process.start()
                    except Exception as exc:
                        recv_conn.close()
                        send_conn.close()
                        pending.remove(node_id)
                        finish(
                            node_id,
                            _dag_failure(
                                node_id, "DAG_WORKER_START_FAILED",
                                "worker فرایندی شروع نشد؛ گره fail-closed متوقف شد.",
                                [{"error": "DAG_WORKER_START_FAILED", "exception_type": type(exc).__name__}],
                            ),
                            [], executed=True,
                        )
                        made_progress = True
                        continue
                    send_conn.close()
                    pending.remove(node_id)
                    running[node_id] = {
                        "process": process,
                        "connection": recv_conn,
                        "deadline": time.monotonic() + float(timeout_seconds),
                    }
                    made_progress = True

                if running:
                    now = time.monotonic()
                    next_deadline = min(record["deadline"] for record in running.values())
                    wait_seconds = max(0.0, next_deadline - now)
                    ready_connections = wait_connections(
                        [record["connection"] for record in running.values()],
                        timeout=wait_seconds,
                    )
                    ready_fds = {connection.fileno() for connection in ready_connections}
                    now = time.monotonic()
                    for node_id in list(running):
                        record = running[node_id]
                        process = record["process"]
                        connection = record["connection"]
                        is_ready = connection.fileno() in ready_fds
                        if is_ready and now < record["deadline"]:
                            try:
                                payload = connection.recv()
                            except (EOFError, OSError):
                                result = _dag_failure(
                                    node_id, "DAG_NODE_WORKER_EXITED",
                                    "worker پیش از تحویل نتیجه خارج شد؛ fail-closed.",
                                )
                            else:
                                if not isinstance(payload, dict) or type(payload.get("ok")) is not bool:
                                    result = _dag_failure(
                                        node_id, "DAG_NODE_WORKER_PROTOCOL",
                                        "worker پاسخ ساختاریافتهٔ معتبری نداد؛ fail-closed.",
                                    )
                                elif payload["ok"] is False:
                                    result = _dag_failure(
                                        node_id, "DAG_NODE_EXCEPTION",
                                        "گرهٔ اجرا به خطای کنترل‌نشده برخورد کرد؛ fail-closed.",
                                        [{"error": "DAG_NODE_EXCEPTION",
                                          "exception_type": str(payload.get("exception_type", "UnknownError"))}],
                                    )
                                else:
                                    result = payload.get("result")
                            connection.close()
                            process.join(timeout=0.2)
                            if process.is_alive():
                                _terminate_dag_worker(process)
                            else:
                                try:
                                    process.close()
                                except (AssertionError, OSError, ValueError):
                                    pass
                            running.pop(node_id)
                            finish(node_id, result, [], executed=True)
                            made_progress = True
                        elif now >= record["deadline"]:
                            _terminate_dag_worker(process)
                            connection.close()
                            running.pop(node_id)
                            finish(
                                node_id,
                                _dag_failure(
                                    node_id, "DAG_NODE_TIMEOUT",
                                    "گره از سقف زمان دیواری عبور کرد و worker آن متوقف شد.",
                                    [{"error": "DAG_NODE_TIMEOUT",
                                      "timeout_seconds": float(timeout_seconds)}],
                                ),
                                [], executed=True,
                            )
                            made_progress = True
                elif pending and not made_progress:
                    raise ValueError("DAG contains a cycle")
        finally:
            for record in running.values():
                try:
                    record["connection"].close()
                except OSError:
                    pass
                _terminate_dag_worker(record["process"])
    else:
        # Portable bounded fallback. It is intentionally not reported as a hard timeout.
        pending = set(node_ids) - set(outcomes)
        active: dict[Any, str] = {}
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="m13-dag") as executor:
            while pending or active:
                made_progress = False
                for node_id in node_ids:
                    if node_id not in pending or not set(dependencies[node_id]) <= set(outcomes):
                        continue
                    blockers = [dep for dep in dependencies[node_id]
                                if outcomes[dep].get("status") != "PASS"]
                    if blockers:
                        pending.remove(node_id)
                        finish(node_id, blocked_result(node_id, blockers), blockers, executed=False)
                        made_progress = True
                        continue
                    if len(active) >= max_workers:
                        break
                    pending.remove(node_id)
                    future = executor.submit(node_by_id[node_id]["run"], dict(outcomes))
                    active[future] = node_id
                    made_progress = True
                if active:
                    done, _ = wait(active, return_when=FIRST_COMPLETED)
                    for future in sorted(done, key=lambda item: node_ids.index(active[item])):
                        node_id = active.pop(future)
                        try:
                            result = future.result()
                        except Exception as exc:
                            result = _dag_failure(
                                node_id, "DAG_NODE_EXCEPTION",
                                "گرهٔ اجرا به خطای کنترل‌نشده برخورد کرد؛ fail-closed.",
                                [{"error": "DAG_NODE_EXCEPTION", "exception_type": type(exc).__name__}],
                            )
                        finish(node_id, result, [], executed=True)
                elif pending and not made_progress:
                    raise ValueError("DAG contains a cycle")

    return outcomes, [trace_by_id[node_id] for node_id in topo_order]


def _git_snapshot(repo_root: Path) -> dict[str, Any]:
    def read(*args: str) -> str | None:
        try:
            proc = subprocess.run(
                ["git", *args], cwd=repo_root, capture_output=True,
                text=True, check=False, timeout=5,
            )
        except (OSError, subprocess.SubprocessError):
            return None
        return proc.stdout.strip() if proc.returncode == 0 else None

    branch = read("branch", "--show-current")
    commit = read("rev-parse", "HEAD")
    status = read("status", "--porcelain")
    return {
        "branch": branch,
        "commit": commit,
        "dirty": bool(status) if status is not None else None,
    }


def _preflight_checkpoint_fingerprint(
    repo_root: Path, expected_book_code: str, *,
    pdf_path: Path | None, manifest_path: Path | None,
    observation_path: Path | None, cartridge_path: Path | None,
    pagemap_path: Path | None,
) -> dict[str, Any]:
    """Bind an opt-in checkpoint to branch, worktree paths, all input bytes, and code bytes."""
    repo = _git_snapshot(repo_root)
    if not repo.get("branch") or not repo.get("commit"):
        raise ValueError("checkpoint requires a readable Git branch and commit")
    try:
        status = subprocess.run(
            ["git", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
            cwd=repo_root, capture_output=True, check=False, timeout=5,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ValueError("checkpoint could not fingerprint worktree status") from exc
    if status.returncode != 0:
        raise ValueError("checkpoint could not fingerprint worktree status")
    worktree_status_sha256 = hashlib.sha256(status.stdout).hexdigest()

    def sha(path: Path | None) -> str | None:
        try:
            if path is None or not path.is_file():
                return None
            return file_sha256(str(path))
        except OSError:
            return None

    paths = {
        "source_pdf": pdf_path,
        "manifest": manifest_path,
        "observation": observation_path,
        "cartridge": cartridge_path,
        "pagemap": pagemap_path,
    }
    inputs = {f"{name}_sha256": sha(path) for name, path in paths.items()}
    input_paths = {
        f"{name}_path": str(path.resolve(strict=False)) if path is not None else None
        for name, path in paths.items()
    }
    pdf_security: dict[str, Any] = {"path": input_paths["source_pdf_path"]}
    if pdf_path is not None:
        try:
            pdf_info = pdf_path.stat()
            parent_info = pdf_path.parent.stat()
            pdf_security.update({
                "file_mode": stat.S_IMODE(pdf_info.st_mode),
                "file_uid": pdf_info.st_uid,
                "parent_mode": stat.S_IMODE(parent_info.st_mode),
                "parent_uid": parent_info.st_uid,
                "readable_by_process": os.access(pdf_path, os.R_OK),
                "within_repo": _is_within(pdf_path, repo_root),
            })
        except OSError as exc:
            pdf_security["stat_error_type"] = type(exc).__name__

    code_root = Path(__file__).resolve().parents[2]
    code = {
        "microbot_engine_sha256": sha(Path(__file__)),
        "coverage_gate_sha256": sha(Path(__file__).with_name("achilles_gate.py")),
        "observation_engine_sha256": sha(Path(__file__).with_name("observation.py")),
        "envelope_schema_sha256": sha(Path(__file__).parent / "schemas" / "microbot-envelope-v1.schema.json"),
        "git_guard_sha256": sha(Path(__file__).with_name("git_guard.py")),
        "models_sha256": sha(Path(__file__).with_name("models.py")),
        "paths_sha256": sha(Path(__file__).with_name("paths.py")),
        "cli_sha256": sha(Path(__file__).with_name("cli.py")),
        "project_config_sha256": sha(code_root / "pyproject.toml"),
    }
    if not all(code.values()):
        raise ValueError("checkpoint could not hash every code/schema dependency")
    runtime = _runtime_fingerprint()
    identity = {
        "schema": "khshab.microbot-checkpoint-key/v1",
        "book_code": expected_book_code,
        "repo_root": str(repo_root.resolve()),
        "branch": repo["branch"],
        "commit": repo["commit"],
        "worktree_status_sha256": worktree_status_sha256,
        "input_hashes": inputs,
        "input_paths": input_paths,
        "pdf_security": pdf_security,
        "code_hashes": code,
        "runtime": runtime,
    }
    return {
        "checkpoint_key": canonical_sha256_obj(identity),
        "repo": repo,
        "input_hashes": inputs,
        "input_paths": input_paths,
        "pdf_security": pdf_security,
        "code_hashes": code,
        "runtime": runtime,
        "worktree_status_sha256": worktree_status_sha256,
    }


_BOT_VERSIONS = {"M00": "0.1.0", "M01": "0.1.0", "M02": "0.1.0"}


def _bot_envelope(
    bot: dict[str, Any], *, run_id: str, repo: dict[str, Any],
    book_code: str | None, edition_id: str | None, source_sha256: str | None,
    input_hashes: dict[str, str | None], skipped: list[str] | None = None,
) -> dict[str, Any]:
    """Attach the stable M00–M16 audit envelope without copying source text."""
    result = dict(bot)
    bot_id = str(result.get("bot_id", "UNKNOWN"))
    metrics = result.get("metrics") if isinstance(result.get("metrics"), dict) else {}
    evidence_refs = metrics.get("evidence_ref_ids", []) if bot_id == "M02" else []
    return {
        **result,
        "envelope_version": "khshab.microbot-envelope/v1",
        "bot_version": _BOT_VERSIONS.get(bot_id, "0.0.0"),
        "run_id": run_id,
        "repo_branch": repo.get("branch"),
        "repo_commit": repo.get("commit"),
        "book_code": book_code,
        "edition_id": edition_id,
        "source_sha256": source_sha256,
        "input_artifact_hashes": dict(input_hashes),
        "evidence_refs": evidence_refs,
        "artifacts": [],
        "requires_human": bot_id == "M02" or result.get("status") != "PASS",
        "skipped": list(skipped or []),
    }


def run_microbot_preflight(
    *, repo_root: str | Path, expected_book_code: str,
    cartridge_path: str | Path, pdf_path: str | Path | None = None,
    manifest_path: str | Path | None = None,
    observation_path: str | Path | None = None,
    pagemap_path: str | Path | None = None,
    checkpoint_path: str | Path | None = None,
    resume_checkpoint: bool = False,
) -> dict[str, Any]:
    """Run a local read-only M00/M01/M02 preflight and return a machine-readable report.

    The default path writes no files. An explicit private checkpoint path enables
    atomic resume state outside the repository. PDF bytes are only hashed in memory;
    the path is rejected if it resolves inside the repository. This function never
    calls autopilot, converter, GitHub, or any network service.
    """
    root = Path(repo_root).resolve()
    expected_code = str(expected_book_code or "").strip().upper()
    cartridge = _resolve_input(cartridge_path, root)
    pdf = _resolve_input(pdf_path, root)
    manifest = _resolve_input(manifest_path, root)
    observation = _resolve_input(observation_path, root)
    pagemap = _resolve_input(pagemap_path, root)
    if type(resume_checkpoint) is not bool:
        raise ValueError("resume_checkpoint must be a boolean")
    if checkpoint_path is None and resume_checkpoint:
        raise ValueError("resume_checkpoint requires checkpoint_path")
    checkpoint_fingerprint = None
    checkpoint_target = None
    checkpoint_sha_before = None
    if checkpoint_path is not None:
        checkpoint_target = _secure_checkpoint_path(checkpoint_path, root, resume=resume_checkpoint)
        if resume_checkpoint:
            if checkpoint_target.stat().st_size > _CHECKPOINT_MAX_BYTES:
                raise ValueError("checkpoint exceeds the 10 MiB resource limit")
            checkpoint_sha_before = file_sha256(str(checkpoint_target))
        checkpoint_fingerprint = _preflight_checkpoint_fingerprint(
            root, expected_code, pdf_path=pdf, manifest_path=manifest,
            observation_path=observation, cartridge_path=cartridge, pagemap_path=pagemap,
        )

    def run_m00(_: dict[str, dict[str, Any]]) -> dict[str, Any]:
        if not expected_code:
            return _gate(
                "M00", "BLOCKED", "EXPECTED_BOOK_CODE_REQUIRED",
                "برای جلوگیری از جفت‌شدن کتاب‌های متفاوت، expected book code الزامی است.",
            )
        return _run_m00_source_guard(
            repo_root=root, expected_book_code=expected_code,
            pdf_path=pdf, manifest_path=manifest,
        )

    def run_m01(_: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return _run_m01_safe_pdf_guard(root, pdf)

    def run_m02(results: dict[str, dict[str, Any]]) -> dict[str, Any]:
        source_result = results["M00"]
        safety_result = results["M01"]
        return _run_m02_observation_packet(
            expected_book_code=expected_code,
            source_sha256=source_result.get("metrics", {}).get("actual_pdf_sha256"),
            manifest_metrics=source_result.get("metrics", {}),
            observation_path=observation,
            upstream_statuses=[source_result.get("status", "ERROR"), safety_result.get("status", "ERROR")],
        )

    def block_m02(blockers: list[str], _: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return _gate(
            "M02", "BLOCKED", "SOURCE_GATES_NOT_PASSED",
            "مشاهده تا پاس‌شدن هویت منبع و قرنطینهٔ PDF اعتبارسنجی نمی‌شود.",
            issues=[{"error": "SOURCE_GATES_NOT_PASSED", "blocked_by": blockers}],
        )

    def run_coverage(results: dict[str, dict[str, Any]]) -> dict[str, Any]:
        source_ready_for_coverage = (
            results.get("M00", {}).get("status") == "PASS"
            and results.get("M01", {}).get("status") == "PASS"
        )
        return _run_coverage_gate(
            expected_book_code=expected_code,
            cartridge_path=cartridge or root / "__missing_cartridge__",
            pdf_path=pdf,
            manifest_path=manifest,
            observation_path=observation,
            pagemap_path=pagemap,
            source_ready=source_ready_for_coverage,
        )

    def block_coverage(blockers: list[str], _: dict[str, dict[str, Any]]) -> dict[str, Any]:
        return {
            "gate_id": "G_ACHILLES_COVERAGE", "stage": "P2", "status": "BLOCKED",
            "reason_code": "SOURCE_GATES_NOT_PASSED",
            "summary": "گیت پوشش با observation صریح اجرا نشد چون گیت‌های منبع/قرنطینه پاس نشده‌اند.",
            "metrics": {},
            "issues": [{"error": "SOURCE_GATES_NOT_PASSED", "blocked_by": blockers}],
        }

    coverage_dependencies = ["M00", "M01"] if observation is not None and observation.is_file() else []
    hard_timeout_supported = _hard_timeout_context() is not None
    node_timeout_seconds = _M13_NODE_TIMEOUT_SECONDS if hard_timeout_supported else None
    dag_results, execution_plan = _execute_local_dag(
        [
            {"node_id": "M00", "depends_on": [], "run": run_m00, "checkpoint_safe": True},
            {"node_id": "M01", "depends_on": [], "run": run_m01, "checkpoint_safe": True},
            {"node_id": "M02", "depends_on": ["M00", "M01"], "run": run_m02,
             "on_blocked": block_m02, "checkpoint_safe": True},
            {"node_id": "G_ACHILLES_COVERAGE", "depends_on": coverage_dependencies,
             "run": run_coverage, "on_blocked": block_coverage,
             "supplemental": True, "checkpoint_safe": True},
        ],
        max_workers=_M13_MAX_PARALLEL_WORKERS,
        timeout_seconds=node_timeout_seconds,
        checkpoint_path=checkpoint_path,
        checkpoint_key=(checkpoint_fingerprint["checkpoint_key"] if checkpoint_fingerprint else None),
        repo_root=root,
        resume_checkpoint=resume_checkpoint,
    )
    checkpoint_sha_after = (
        file_sha256(str(checkpoint_target))
        if checkpoint_target is not None and checkpoint_target.is_file()
        else None
    )
    checkpoint_written_this_run = (
        checkpoint_sha_after is not None and checkpoint_sha_after != checkpoint_sha_before
    )
    if checkpoint_fingerprint is not None:
        checkpoint_fingerprint_after = _preflight_checkpoint_fingerprint(
            root, expected_code, pdf_path=pdf, manifest_path=manifest,
            observation_path=observation, cartridge_path=cartridge, pagemap_path=pagemap,
        )
        if checkpoint_fingerprint_after["checkpoint_key"] != checkpoint_fingerprint["checkpoint_key"]:
            raise ValueError("source/code/worktree changed during checkpointed execution; result rejected")
    m00, m01, m02 = dag_results["M00"], dag_results["M01"], dag_results["M02"]
    coverage_gate = dag_results["G_ACHILLES_COVERAGE"]
    source_ready = m00.get("status") == "PASS" and m01.get("status") == "PASS"
    bot_results = [m00, m01, m02]
    overall = _combined_status(bot_results + [coverage_gate])

    commit_snapshot = _git_snapshot(root)

    def _sha_if_file(path: Path | None) -> str | None:
        if path is None or not path.is_file():
            return None
        try:
            return file_sha256(str(path))
        except OSError:
            return None

    source_sha = m00.get("metrics", {}).get("actual_pdf_sha256")
    if source_sha is None and pdf is not None and not _is_within(pdf, root):
        source_sha = _sha_if_file(pdf)
    input_hashes = {
        "source_pdf_sha256": source_sha,
        "manifest_sha256": _sha_if_file(manifest),
        "observation_sha256": _sha_if_file(observation),
        "cartridge_sha256": _sha_if_file(cartridge),
        "pagemap_sha256": _sha_if_file(pagemap),
    }
    code_root = Path(__file__).resolve().parents[2]
    code_hashes = {
        "microbot_engine_sha256": _sha_if_file(Path(__file__)),
        "coverage_gate_sha256": _sha_if_file(Path(__file__).with_name("achilles_gate.py")),
        "observation_engine_sha256": _sha_if_file(Path(__file__).with_name("observation.py")),
        "envelope_schema_sha256": _sha_if_file(Path(__file__).parent / "schemas" / "microbot-envelope-v1.schema.json"),
        "git_guard_sha256": _sha_if_file(Path(__file__).with_name("git_guard.py")),
        "models_sha256": _sha_if_file(Path(__file__).with_name("models.py")),
        "paths_sha256": _sha_if_file(Path(__file__).with_name("paths.py")),
        "cli_sha256": _sha_if_file(Path(__file__).with_name("cli.py")),
        "project_config_sha256": _sha_if_file(code_root / "pyproject.toml"),
    }
    runtime_fingerprint = _runtime_fingerprint()
    run_id = canonical_sha256_obj({
        "book_code": expected_code,
        "branch": commit_snapshot.get("branch"),
        "commit": commit_snapshot.get("commit"),
        "input_hashes": input_hashes,
        "code_hashes": code_hashes,
        "runtime": runtime_fingerprint,
    })[:20]
    edition_id = m00.get("metrics", {}).get("manifest_id")
    m02_skipped = [] if source_ready else ["M00_OR_M01_NOT_PASS"]
    bot_results_enveloped = [
        _bot_envelope(
            bot, run_id=run_id, repo=commit_snapshot, book_code=expected_code or None,
            edition_id=edition_id, source_sha256=source_sha, input_hashes=input_hashes,
            skipped=(m02_skipped if bot.get("bot_id") == "M02" else []),
        )
        for bot in bot_results
    ]
    return {
        "schema_version": "1.0.0",
        "envelope_version": "khshab.microbot-envelope/v1",
        "run_id": run_id,
        "generated_at_utc": utc_now_iso(),
        "engine": "M13_LOCAL_PREFLIGHT_MVP",
        "architecture_contract": "MICROBOT-ENGINE-ARCHITECTURE-M00-M16-v1.1",
        "repo": commit_snapshot,
        "repo_branch": commit_snapshot.get("branch"),
        "repo_commit": commit_snapshot.get("commit"),
        "book_code": expected_code or None,
        "edition_id": edition_id,
        "source_sha256": source_sha,
        "input_hashes": input_hashes,
        "input_artifact_hashes": dict(input_hashes),
        "code_hashes": code_hashes,
        "runtime_fingerprint": runtime_fingerprint,
        "evidence_refs": bot_results_enveloped[2].get("evidence_refs", []),
        "artifacts": [],
        "requires_human": True,
        "skipped": [],
        "idempotent_for_identical_inputs_and_code": True,
        "execution_plan": execution_plan,
        "scheduler": {
            "mode": "bounded_parallel_dag",
            "max_workers": _M13_MAX_PARALLEL_WORKERS,
            "node_timeout_seconds": node_timeout_seconds,
            "hard_timeout_enforced": node_timeout_seconds is not None,
            "checkpoint_resume_enabled": checkpoint_path is not None,
            "checkpoint_resumed": resume_checkpoint,
            "checkpoint_sha256": checkpoint_sha_after,
            "automatic_retries_enabled": False,
        },
        "resource_limits": {
            "observation_packet_max_bytes": 50 * 1024 * 1024,
            "max_pages_evidence_refs_claims": 100_000,
            "max_parallel_workers": _M13_MAX_PARALLEL_WORKERS,
            "node_timeout_seconds": node_timeout_seconds,
            "checkpoint_max_bytes": _CHECKPOINT_MAX_BYTES if checkpoint_path is not None else 0,
            "hard_timeout_enforced": node_timeout_seconds is not None,
        },
        "overall_status": overall,
        "technical_preflight_pass": overall == "PASS",
        "candidate_ready": False,
        "release_authorized": False,
        "requires_human_review": True,
        "side_effects": {
            "writes_files": checkpoint_written_this_run,
            "writes_checkpoint": checkpoint_written_this_run,
            "network_access": False,
            "git_mutations": False,
            "official_files_mutated": False,
            "teacher_verdict_created": False,
        },
        "bots": bot_results_enveloped,
        "supplemental_gates": [coverage_gate],
        "not_run": ["M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10",
                     "M11", "M12", "M14", "M15", "M16"],
        "not_run_reason": "این برش فقط M00/M01/M02 را پوشش می‌دهد؛ تولید مشاهده، تحلیل آموزشی و runtime در آن اجرا نمی‌شود.",
        "limitations": [
            "M00 verifies PDF/manifest identity; integer offset presence is not proof that the offset is correct.",
            "M01 inspects a private, readable quarantine path and read-only repository guards; it never changes permissions.",
            "M02 validates an existing observation packet only; it does not run observe_pdf, OCR, vision, or crop rendering.",
            "G_ACHILLES_COVERAGE is a separate supplemental gate, not M02; missing observation remains WARN/unknown.",
            "M13 uses a bounded parallel DAG and per-node hard timeout where POSIX fork is available; private checkpoint/resume is opt-in and automatic retries remain disabled.",
            "A preflight PASS is not candidate approval, teacher/owner verdict, official-head update, or release authorization.",
        ],
    }
