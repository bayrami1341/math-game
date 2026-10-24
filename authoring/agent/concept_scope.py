"""M05 technical concept-scope gate.

This module does NOT infer concepts from prose, decide pedagogy, or approve a
cartridge. It checks two independently produced, page-bound concept passes
against an externally supplied, edition-bound scope profile. The report is a
technical scope check only: it cannot set workbook colours, create a human
verdict, or authorize a release.

Input contract (JSON, no textbook quotations):

* Profile schema: ``khshab.concept-scope-profile/v1``
* Reader-pass schema: ``khshab.concept-observation-pass/v1``
* Each pass must cover every page selected by the manifest-bound profile,
  report the observed printed page number with a source-bound region witness,
  report a canonical page-image digest, and include source-bound concept refs.
* Profiles use stable concept/objective/operation/domain IDs. Natural-language
  interpretations remain the responsibility of the independent readers and
  human-owned curriculum profile.

The reader IDs and model IDs are checked for accidental duplication, but this
module cannot cryptographically prove that two models actually ran. A passing
result is never teacher/owner approval, a green mark, or release readiness.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

from .models import file_sha256

PROFILE_SCHEMA = "khshab.concept-scope-profile/v1"
PASS_SCHEMA = "khshab.concept-observation-pass/v1"
REPORT_SCHEMA = "khshab.concept-scope-report/v1"
RENDER_SPEC = "pymupdf-rgb-150dpi-v1"
RENDER_DPI = 150
_HEX64 = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)
_TOKEN = re.compile(r"^[A-Za-z][A-Za-z0-9_.:-]{0,127}$")
_DIGIT_TRANSLATION = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_CROP_DPI_BY_EVIDENCE_KIND = {"pdf_crop_150dpi": 150, "pdf_crop_300dpi": 300}
_VISUAL_EVIDENCE_KINDS = set(_CROP_DPI_BY_EVIDENCE_KIND)
_REGION_EVIDENCE_KINDS = _VISUAL_EVIDENCE_KINDS | {"pdf_text_bbox"}
_EVIDENCE_KINDS = _REGION_EVIDENCE_KINDS | {"pdf_page_render"}
_FORBIDDEN_CONTENT_KEYS = {
    "raw_text", "raw_reading", "verbatim_text", "quoted_text", "quote", "quotes",
    "page_text", "ocr_text", "ocr_output", "transcription", "transcript",
    "banner_text", "caption_text", "description", "description_fa", "note", "notes",
    "image_base64", "image_bytes", "image_data", "crop_bytes", "crop_path", "image_path",
}
_ROLES = {"PRIMARY", "SUPPORTING", "INCIDENTAL"}
_CONFIDENCE = {"HIGH", "MEDIUM", "LOW", "UNOBSERVABLE"}


def _issue(code: str, **details: Any) -> dict[str, Any]:
    """Return a compact, non-quoting issue record."""
    return {"code": code, **details}


def _is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _read_json(path: Path, label: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return None, _issue(f"{label}_UNREADABLE", exception_type=type(exc).__name__)
    if not isinstance(payload, dict):
        return None, _issue(f"{label}_ROOT_NOT_OBJECT")
    return payload, None


def _forbidden_content_fields(value: Any, *, label: str, path: str = "$") -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            key_text = str(key).strip().lower()
            child_path = f"{path}.{key_text}"
            if key_text in _FORBIDDEN_CONTENT_KEYS or any(
                marker in key_text for marker in (
                    "base64", "image_bytes", "image_data", "image_path", "crop_path",
                    "raw_text", "raw_read", "raw_quote", "verbatim", "page_text",
                    "ocr", "transcript", "caption_text", "description",
                )
            ):
                issues.append(_issue("RAW_TEXT_OR_IMAGE_FIELD_FORBIDDEN", input=label, field_path=child_path))
            issues.extend(_forbidden_content_fields(child, label=label, path=child_path))
    elif isinstance(value, str) and len(re.findall(r"\w+", value, flags=re.UNICODE)) > 10:
        issues.append(_issue("RAW_TEXT_OR_IMAGE_FIELD_FORBIDDEN", input=label, field_path=path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            issues.extend(_forbidden_content_fields(child, label=label, path=f"{path}[{index}]"))
    return issues


def _token(value: Any) -> str | None:
    if not isinstance(value, str) or not _TOKEN.fullmatch(value.strip()):
        return None
    return value.strip().lower()


def _token_list(value: Any, *, allow_empty: bool = True) -> list[str] | None:
    if not isinstance(value, list) or (not allow_empty and not value):
        return None
    result: list[str] = []
    for item in value:
        normalized = _token(item)
        if normalized is None:
            return None
        result.append(normalized)
    if len(result) != len(set(result)):
        return None
    return result


def _valid_bbox(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 4
        and all(type(v) in (int, float) and math.isfinite(float(v)) for v in value)
        and 0.0 <= float(value[0]) < float(value[2]) <= 1.0
        and 0.0 <= float(value[1]) < float(value[3]) <= 1.0
    )


def _load_pymupdf() -> Any:
    # Lazy import keeps profile/schema validation usable in lightweight tooling.
    import pymupdf  # type: ignore[import-not-found]

    return pymupdf


def _pixel_digest(page: Any, pymupdf: Any, dpi: int = RENDER_DPI) -> str:
    """Hash canonical RGB pixels in memory; no PDF/image artifact is written."""
    scale = dpi / 72.0
    pix = page.get_pixmap(
        matrix=pymupdf.Matrix(scale, scale),
        colorspace=pymupdf.csRGB,
        alpha=False,
    )
    version = str(getattr(pymupdf, "VersionBind", "unknown"))
    header = (
        f"{RENDER_SPEC}|renderer={version}|dpi={dpi}|"
        f"width={pix.width}|height={pix.height}|components={pix.n}|"
    ).encode("ascii")
    digest = hashlib.sha256()
    digest.update(header)
    digest.update(pix.samples)
    return digest.hexdigest()


def _normalized_rect(page: Any, bbox_normalized: list[Any], pymupdf: Any) -> Any:
    rect = page.rect
    x0, y0, x1, y1 = (float(value) for value in bbox_normalized)
    return pymupdf.Rect(
        rect.x0 + x0 * rect.width,
        rect.y0 + y0 * rect.height,
        rect.x0 + x1 * rect.width,
        rect.y0 + y1 * rect.height,
    )


def _crop_pixel_digest(page: Any, pymupdf: Any, bbox_normalized: list[Any], dpi: int) -> str:
    """Hash a canonical source-PDF region in memory; never writes a crop."""
    clip = _normalized_rect(page, bbox_normalized, pymupdf)
    scale = dpi / 72.0
    pix = page.get_pixmap(
        matrix=pymupdf.Matrix(scale, scale),
        colorspace=pymupdf.csRGB,
        alpha=False,
        clip=clip,
    )
    bbox_text = ",".join(f"{float(value):.8f}" for value in bbox_normalized)
    version = str(getattr(pymupdf, "VersionBind", "unknown"))
    header = (
        f"khshab-page-crop-v1|renderer={version}|dpi={dpi}|bbox={bbox_text}|"
        f"width={pix.width}|height={pix.height}|components={pix.n}|"
    ).encode("ascii")
    digest = hashlib.sha256()
    digest.update(header)
    digest.update(pix.samples)
    return digest.hexdigest()


def compute_crop_image_sha256(
    pdf_path: str | Path,
    pdf_page: int,
    bbox_normalized: list[Any],
    *,
    dpi: int = 150,
) -> str:
    """Compute a canonical crop digest for an external evidence packet."""
    path = Path(pdf_path).resolve()
    if type(pdf_page) is not int or pdf_page < 1:
        raise ValueError("pdf_page must be a positive 1-based integer")
    if dpi not in _CROP_DPI_BY_EVIDENCE_KIND.values():
        raise ValueError("dpi must be 150 or 300")
    if not _valid_bbox(bbox_normalized):
        raise ValueError("bbox_normalized must be a finite, non-empty box in [0, 1]")
    pymupdf = _load_pymupdf()
    doc = pymupdf.open(str(path))
    try:
        if pdf_page > len(doc):
            raise ValueError("pdf_page exceeds actual PDF page count")
        return _crop_pixel_digest(doc[pdf_page - 1], pymupdf, bbox_normalized, dpi)
    finally:
        doc.close()


def compute_page_image_sha256(pdf_path: str | Path, pdf_page: int) -> str:
    """Compute the canonical page-image digest for one 1-based PDF page."""
    path = Path(pdf_path).resolve()
    if type(pdf_page) is not int or pdf_page < 1:
        raise ValueError("pdf_page must be a positive 1-based integer")
    pymupdf = _load_pymupdf()
    doc = pymupdf.open(str(path))
    try:
        if pdf_page > len(doc):
            raise ValueError("pdf_page exceeds actual PDF page count")
        return _pixel_digest(doc[pdf_page - 1], pymupdf)
    finally:
        doc.close()


def _expected_page_map(
    profile: dict[str, Any], manifest: dict[str, Any]
) -> tuple[dict[int, int] | None, list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    pagination = manifest.get("pagination")
    source = manifest.get("source_pdf")
    if not isinstance(pagination, dict) or not isinstance(source, dict):
        return None, [_issue("MANIFEST_PAGINATION_INVALID")]

    offset = pagination.get("pdf_minus_book_offset")
    body_start = pagination.get("body_pdf_page_start")
    body_end = pagination.get("body_pdf_page_end")
    book_start = pagination.get("book_page_start")
    book_end = pagination.get("book_page_end")
    if any(type(v) is not int for v in (offset, body_start, body_end, book_start, book_end)):
        return None, [_issue("MANIFEST_PAGE_BOUNDS_INVALID")]
    if body_start < 1 or body_end < body_start or book_start < 1 or book_end < book_start:
        return None, [_issue("MANIFEST_PAGE_BOUNDS_INVALID")]

    selector = profile.get("section_selector")
    if not isinstance(selector, dict):
        return None, [_issue("PROFILE_SECTION_SELECTOR_INVALID")]
    has_chapter = "chapter_number" in selector
    has_range = "book_page_range" in selector
    if has_chapter == has_range:
        return None, [_issue("PROFILE_SECTION_SELECTOR_AMBIGUOUS")]

    page_map: dict[int, int] = {}
    if has_chapter:
        chapter_number = selector.get("chapter_number")
        chapters = manifest.get("chapters")
        if type(chapter_number) is not int or not isinstance(chapters, list):
            return None, [_issue("PROFILE_CHAPTER_SELECTOR_INVALID")]
        matches = [c for c in chapters if isinstance(c, dict) and c.get("chapter") == chapter_number]
        if len(matches) != 1:
            return None, [_issue("MANIFEST_CHAPTER_NOT_UNIQUE", chapter_number=chapter_number)]
        chapter = matches[0]
        values = (chapter.get("pdf_start"), chapter.get("pdf_end"), chapter.get("book_start"), chapter.get("book_end"))
        if any(type(v) is not int for v in values):
            return None, [_issue("MANIFEST_CHAPTER_BOUNDS_INVALID", chapter_number=chapter_number)]
        pdf_first, pdf_last, book_first, book_last = values
        if pdf_first < body_start or pdf_last > body_end or pdf_last < pdf_first:
            return None, [_issue("CHAPTER_OUTSIDE_MANIFEST_BODY", chapter_number=chapter_number)]
        if book_first < book_start or book_last > book_end or book_last < book_first:
            return None, [_issue("CHAPTER_BOOK_RANGE_INVALID", chapter_number=chapter_number)]
        if pdf_last - pdf_first != book_last - book_first:
            return None, [_issue("CHAPTER_PAGE_COUNT_CONFLICT", chapter_number=chapter_number)]
        page_map = {pdf_page: pdf_page - offset for pdf_page in range(pdf_first, pdf_last + 1)}
        if min(page_map.values()) != book_first or max(page_map.values()) != book_last:
            return None, [_issue("CHAPTER_OFFSET_CONFLICT", chapter_number=chapter_number)]
    else:
        book_range = selector.get("book_page_range")
        if (
            not isinstance(book_range, list)
            or len(book_range) != 2
            or any(type(v) is not int for v in book_range)
        ):
            return None, [_issue("PROFILE_BOOK_PAGE_RANGE_INVALID")]
        first, last = book_range
        if first < book_start or last > book_end or last < first:
            return None, [_issue("PROFILE_BOOK_PAGE_RANGE_OUTSIDE_BODY")]
        for book_page in range(first, last + 1):
            pdf_page = book_page + offset
            if not body_start <= pdf_page <= body_end:
                return None, [_issue("PROFILE_PAGE_MAPPING_OUTSIDE_BODY", book_page=book_page)]
            page_map[pdf_page] = book_page

    if not page_map:
        issues.append(_issue("PROFILE_EXPECTED_PAGE_SET_EMPTY"))
    return page_map or None, issues


def _validate_profile(
    profile: dict[str, Any],
    manifest: dict[str, Any],
    *,
    actual_pdf_sha256: str,
    actual_manifest_sha256: str,
) -> tuple[dict[str, Any] | None, dict[int, int] | None, list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    if profile.get("schema_version") != PROFILE_SCHEMA:
        issues.append(_issue("PROFILE_SCHEMA_UNSUPPORTED"))
    for key in ("profile_id", "section_id", "taxonomy_version", "manifest_id", "book_code"):
        if not isinstance(profile.get(key), str) or not profile[key].strip():
            issues.append(_issue("PROFILE_FIELD_MISSING", field=key))
    if not isinstance(profile.get("source_pdf_sha256"), str) or not _HEX64.fullmatch(profile["source_pdf_sha256"]):
        issues.append(_issue("PROFILE_PDF_SHA_INVALID"))
    if not isinstance(profile.get("manifest_sha256"), str) or not _HEX64.fullmatch(profile["manifest_sha256"]):
        issues.append(_issue("PROFILE_MANIFEST_SHA_INVALID"))

    if str(profile.get("book_code", "")).upper() != str(manifest.get("book_code", "")).upper():
        issues.append(_issue("PROFILE_BOOK_CODE_MISMATCH"))
    if profile.get("manifest_id") != manifest.get("manifest_id"):
        issues.append(_issue("PROFILE_MANIFEST_ID_MISMATCH"))
    if str(profile.get("source_pdf_sha256") or "").lower() != actual_pdf_sha256:
        issues.append(_issue("PROFILE_PDF_SHA_MISMATCH"))
    if str(profile.get("manifest_sha256") or "").lower() != actual_manifest_sha256:
        issues.append(_issue("PROFILE_MANIFEST_SHA_MISMATCH"))

    list_fields = (
        "allowed_objective_ids",
        "allowed_primary_concepts",
        "allowed_supporting_concepts",
        "allowed_incidental_concepts",
        "excluded_primary_concepts",
        "allowed_primary_operations",
        "allowed_supporting_operations",
        "excluded_primary_operations",
        "allowed_primary_number_domains",
        "allowed_supporting_number_domains",
        "excluded_primary_number_domains",
    )
    normalized_lists: dict[str, list[str]] = {}
    for field in list_fields:
        parsed = _token_list(profile.get(field, []), allow_empty=(field != "allowed_objective_ids"))
        if parsed is None:
            issues.append(_issue("PROFILE_TOKEN_LIST_INVALID", field=field))
        else:
            normalized_lists[field] = parsed
    for field in (
        "allowed_objective_ids",
        "allowed_primary_concepts",
        "allowed_primary_operations",
        "allowed_primary_number_domains",
    ):
        if not normalized_lists.get(field):
            issues.append(_issue("PROFILE_REQUIRED_SCOPE_LIST_EMPTY", field=field))
    if issues:
        return None, None, issues

    page_map, page_issues = _expected_page_map(profile, manifest)
    issues.extend(page_issues)
    if page_map is None:
        return None, None, issues
    normalized = dict(profile)
    normalized["_normalized_lists"] = normalized_lists
    return normalized, page_map, issues


def _validate_binding(
    document: dict[str, Any],
    *,
    profile: dict[str, Any],
    manifest_sha256: str,
    source_pdf_sha256: str,
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    binding = document.get("source_binding")
    if not isinstance(binding, dict):
        return [_issue("READER_SOURCE_BINDING_MISSING")]
    expected = {
        "book_code": str(profile["book_code"]).upper(),
        "manifest_id": profile["manifest_id"],
        "manifest_sha256": manifest_sha256,
        "source_pdf_sha256": source_pdf_sha256,
    }
    for key, value in expected.items():
        observed = binding.get(key)
        if isinstance(value, str) and key in {"book_code", "manifest_sha256", "source_pdf_sha256"}:
            observed = str(observed or "").lower() if key != "book_code" else str(observed or "").upper()
            value = value.lower() if key != "book_code" else value.upper()
        if observed != value:
            issues.append(_issue("READER_SOURCE_BINDING_MISMATCH", field=key))
    return issues


def _validate_evidence_ref(
    evidence_id: Any,
    *,
    ledger: Any,
    expected_book_code: str,
    expected_pdf_sha256: str,
    expected_manifest_sha256: str,
    pdf_page: int,
    book_page: int,
    page_image_sha256: str,
    pdf_document: Any,
    pymupdf: Any,
) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(evidence_id, str) or not evidence_id:
        return None, "EVIDENCE_REF_ID_INVALID"
    if not isinstance(ledger, dict):
        return None, "EVIDENCE_LEDGER_INVALID"
    record = ledger.get(evidence_id)
    if not isinstance(record, dict):
        return None, "EVIDENCE_REF_NOT_IN_LEDGER"
    if record.get("evidence_id") != evidence_id:
        return None, "EVIDENCE_ID_MISMATCH"
    if str(record.get("book_code", "")).upper() != expected_book_code.upper():
        return None, "EVIDENCE_BOOK_CODE_MISMATCH"
    if str(record.get("source_sha256", "")).lower() != expected_pdf_sha256.lower():
        return None, "EVIDENCE_SOURCE_SHA_MISMATCH"
    if str(record.get("manifest_sha256", "")).lower() != expected_manifest_sha256.lower():
        return None, "EVIDENCE_MANIFEST_SHA_MISMATCH"
    if type(record.get("pdf_page")) is not int or record["pdf_page"] != pdf_page:
        return None, "EVIDENCE_PDF_PAGE_MISMATCH"
    if type(record.get("book_page")) is not int or record["book_page"] != book_page:
        return None, "EVIDENCE_BOOK_PAGE_MISMATCH"
    kind = record.get("evidence_kind")
    if kind not in _EVIDENCE_KINDS:
        return None, "EVIDENCE_KIND_UNSUPPORTED"
    purpose = record.get("evidence_purpose")
    if purpose not in (None, "printed_page_number"):
        return None, "EVIDENCE_PURPOSE_UNSUPPORTED"
    bbox = record.get("bbox_normalized")
    if not _valid_bbox(bbox):
        return None, "EVIDENCE_BBOX_INVALID"
    source_page = pdf_document[pdf_page - 1]
    if kind == "pdf_page_render":
        if [float(value) for value in bbox] != [0.0, 0.0, 1.0, 1.0]:
            return None, "EVIDENCE_PAGE_RENDER_BBOX_INVALID"
        if str(record.get("page_image_sha256") or "").lower() != page_image_sha256.lower():
            return None, "EVIDENCE_PAGE_IMAGE_SHA_MISMATCH"
    elif kind == "pdf_text_bbox":
        region = _normalized_rect(source_page, bbox, pymupdf)
        try:
            words = source_page.get_text("words")
        except Exception:
            return None, "EVIDENCE_TEXT_REGION_CHECK_FAILED"
        region_words: list[str] = []
        for word in words:
            if len(word) >= 5 and isinstance(word[4], str) and word[4].strip():
                if region.intersects(pymupdf.Rect(word[:4])):
                    region_words.append(word[4])
        if not region_words:
            return None, "EVIDENCE_TEXT_REGION_NOT_FOUND"
        if purpose == "printed_page_number":
            observed_numbers = {
                number
                for word in region_words
                for number in re.findall(r"\d+", word.translate(_DIGIT_TRANSLATION))
            }
            if str(book_page) not in observed_numbers:
                return None, "EVIDENCE_PRINTED_PAGE_NUMBER_TEXT_MISMATCH"
    elif kind in _VISUAL_EVIDENCE_KINDS:
        crop_sha = str(record.get("crop_sha256") or "").lower()
        if not _HEX64.fullmatch(crop_sha):
            return None, "EVIDENCE_CROP_SHA_INVALID"
        dpi = _CROP_DPI_BY_EVIDENCE_KIND[kind]
        try:
            expected_crop_sha = _crop_pixel_digest(source_page, pymupdf, bbox, dpi)
        except Exception:
            return None, "EVIDENCE_CROP_RENDER_FAILED"
        if crop_sha != expected_crop_sha:
            return None, "EVIDENCE_CROP_SHA_MISMATCH"
    return record, None


def _normalize_claim(
    claim: Any,
    *,
    ledger: Any,
    profile: dict[str, Any],
    expected_pdf_sha256: str,
    expected_manifest_sha256: str,
    pdf_page: int,
    book_page: int,
    page_image_sha256: str,
    pdf_document: Any,
    pymupdf: Any,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    if not isinstance(claim, dict):
        return None, [_issue("CONCEPT_CLAIM_INVALID", pdf_page=pdf_page)]
    concept_id = _token(claim.get("concept_id"))
    role = str(claim.get("role", "")).upper()
    operation_id = _token(claim.get("operation_id")) if claim.get("operation_id") is not None else None
    number_domain_id = _token(claim.get("number_domain_id")) if claim.get("number_domain_id") is not None else None
    confidence = str(claim.get("confidence", "")).upper()
    modality = str(claim.get("evidence_modality", "")).upper()
    objective_ids = _token_list(claim.get("objective_ids", []))
    evidence_refs = claim.get("evidence_refs")

    if concept_id is None:
        issues.append(_issue("CONCEPT_ID_INVALID", pdf_page=pdf_page))
    if role not in _ROLES:
        issues.append(_issue("CONCEPT_ROLE_INVALID", pdf_page=pdf_page))
    if claim.get("operation_id") is not None and operation_id is None:
        issues.append(_issue("CONCEPT_OPERATION_ID_INVALID", pdf_page=pdf_page))
    if claim.get("number_domain_id") is not None and number_domain_id is None:
        issues.append(_issue("CONCEPT_NUMBER_DOMAIN_INVALID", pdf_page=pdf_page))
    if confidence not in _CONFIDENCE:
        issues.append(_issue("CONCEPT_CONFIDENCE_INVALID", pdf_page=pdf_page))
    if modality not in {"TEXT", "VISUAL", "MIXED"}:
        issues.append(_issue("CONCEPT_EVIDENCE_MODALITY_INVALID", pdf_page=pdf_page))
    if objective_ids is None:
        issues.append(_issue("CONCEPT_OBJECTIVE_IDS_INVALID", pdf_page=pdf_page))
    if not isinstance(evidence_refs, list) or not evidence_refs:
        issues.append(_issue("CONCEPT_EVIDENCE_REQUIRED", pdf_page=pdf_page))
        evidence_refs = []

    evidence_records: list[dict[str, Any]] = []
    for ref in evidence_refs:
        record, error = _validate_evidence_ref(
            ref,
            ledger=ledger,
            expected_book_code=str(profile["book_code"]),
            expected_pdf_sha256=expected_pdf_sha256,
            expected_manifest_sha256=expected_manifest_sha256,
            pdf_page=pdf_page,
            book_page=book_page,
            page_image_sha256=page_image_sha256,
            pdf_document=pdf_document,
            pymupdf=pymupdf,
        )
        if error:
            issues.append(_issue(error, pdf_page=pdf_page, evidence_id=ref if isinstance(ref, str) else None))
        elif record is not None:
            evidence_records.append(record)
    kinds = {record.get("evidence_kind") for record in evidence_records}
    if modality == "TEXT" and not (kinds & _REGION_EVIDENCE_KINDS):
        issues.append(_issue("TEXT_CLAIM_REGION_EVIDENCE_REQUIRED", pdf_page=pdf_page))
    elif modality == "VISUAL" and not (kinds & _VISUAL_EVIDENCE_KINDS):
        issues.append(_issue("VISUAL_CLAIM_CROP_EVIDENCE_REQUIRED", pdf_page=pdf_page))
    elif modality == "MIXED" and not ((kinds & {"pdf_text_bbox"}) and (kinds & _VISUAL_EVIDENCE_KINDS)):
        issues.append(_issue("MIXED_CLAIM_TEXT_AND_CROP_EVIDENCE_REQUIRED", pdf_page=pdf_page))

    normalized = {
        "concept_id": concept_id,
        "role": role,
        "operation_id": operation_id,
        "number_domain_id": number_domain_id,
        "objective_ids": objective_ids or [],
        "confidence": confidence,
        "evidence_modality": modality,
        "evidence_refs": sorted({str(v) for v in evidence_refs if isinstance(v, str)}),
    }
    if issues:
        return normalized, issues
    return normalized, []


def _classify_claim(claim: dict[str, Any], profile: dict[str, Any]) -> tuple[str, list[str]]:
    rules = profile["_normalized_lists"]
    role = claim["role"]
    concept_id = claim["concept_id"]
    operation_id = claim["operation_id"]
    number_domain_id = claim["number_domain_id"]
    objective_ids = claim["objective_ids"]
    reasons: list[str] = []

    if claim["confidence"] != "HIGH":
        return "SCOPE_UNKNOWN", ["CONFIDENCE_NOT_HIGH"]
    if role == "PRIMARY":
        allowed_concepts = rules["allowed_primary_concepts"]
        excluded_concepts = rules["excluded_primary_concepts"]
        if concept_id in excluded_concepts or concept_id not in allowed_concepts:
            reasons.append("PRIMARY_CONCEPT_NOT_ALLOWED")
        allowed_ops = rules["allowed_primary_operations"]
        excluded_ops = rules["excluded_primary_operations"]
        if allowed_ops and operation_id is None:
            return "SCOPE_UNKNOWN", ["PRIMARY_OPERATION_UNOBSERVABLE"]
        if operation_id in excluded_ops or (allowed_ops and operation_id not in allowed_ops):
            reasons.append("PRIMARY_OPERATION_NOT_ALLOWED")
        allowed_domains = rules["allowed_primary_number_domains"]
        excluded_domains = rules["excluded_primary_number_domains"]
        if allowed_domains and number_domain_id is None:
            return "SCOPE_UNKNOWN", ["PRIMARY_NUMBER_DOMAIN_UNOBSERVABLE"]
        if number_domain_id in excluded_domains or (allowed_domains and number_domain_id not in allowed_domains):
            reasons.append("PRIMARY_NUMBER_DOMAIN_NOT_ALLOWED")
        allowed_objectives = set(rules["allowed_objective_ids"])
        if not objective_ids:
            return "SCOPE_UNKNOWN", ["PRIMARY_OBJECTIVE_UNOBSERVABLE"]
        if not set(objective_ids).issubset(allowed_objectives):
            reasons.append("PRIMARY_OBJECTIVE_NOT_ALLOWED")
        return ("OUT_OF_SCOPE_PRIMARY", reasons) if reasons else ("IN_SCOPE_PRIMARY", [])

    if role == "SUPPORTING":
        allowed_concepts = rules["allowed_supporting_concepts"]
        if concept_id not in allowed_concepts:
            return "SCOPE_UNKNOWN", ["SUPPORTING_CONCEPT_NOT_CLASSIFIED"]
        allowed_ops = rules["allowed_supporting_operations"]
        if allowed_ops and (operation_id is None or operation_id not in allowed_ops):
            return "SCOPE_UNKNOWN", ["SUPPORTING_OPERATION_NOT_CLASSIFIED"]
        allowed_domains = rules["allowed_supporting_number_domains"]
        if allowed_domains and (number_domain_id is None or number_domain_id not in allowed_domains):
            return "SCOPE_UNKNOWN", ["SUPPORTING_NUMBER_DOMAIN_NOT_CLASSIFIED"]
        if objective_ids and not set(objective_ids).issubset(set(rules["allowed_objective_ids"])):
            return "SCOPE_UNKNOWN", ["SUPPORTING_OBJECTIVE_NOT_CLASSIFIED"]
        return "ALLOWED_SUPPORTING", []

    allowed_incidental = rules["allowed_incidental_concepts"]
    if concept_id not in allowed_incidental:
        return "SCOPE_UNKNOWN", ["INCIDENTAL_CONCEPT_NOT_CLASSIFIED"]
    if objective_ids and not set(objective_ids).issubset(set(rules["allowed_objective_ids"])):
        return "SCOPE_UNKNOWN", ["INCIDENTAL_OBJECTIVE_NOT_CLASSIFIED"]
    return "ALLOWED_INCIDENTAL", []


def _signature(page: dict[str, Any]) -> tuple[Any, ...]:
    concepts = tuple(sorted(
        (
            c["concept_id"], c["role"], c["operation_id"] or "",
            c["number_domain_id"] or "", tuple(c["objective_ids"]),
            c["confidence"], c["evidence_modality"],
        )
        for c in page["concepts"]
    ))
    return (
        page["book_page"],
        page["printed_page_number"],
        page["page_status"],
        page["reading_status"],
        page["visual_scan_status"],
        page["visual_regions_count"],
        page["page_image_sha256"],
        concepts,
    )


def _validate_pass(
    document: dict[str, Any],
    *,
    observer_label: str,
    profile: dict[str, Any],
    profile_sha256: str,
    expected_pages: dict[int, int],
    manifest_sha256: str,
    source_pdf_sha256: str,
    page_image_hashes: dict[int, str],
    pdf_document: Any,
    pymupdf: Any,
) -> tuple[dict[int, dict[str, Any]], list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    if document.get("schema_version") != PASS_SCHEMA:
        issues.append(_issue("READER_PASS_SCHEMA_UNSUPPORTED", observer=observer_label))
    for field in ("pass_id", "reader_id", "model_id"):
        if not isinstance(document.get(field), str) or not document[field].strip():
            issues.append(_issue("READER_PASS_FIELD_MISSING", observer=observer_label, field=field))
    if document.get("render_spec") != RENDER_SPEC:
        issues.append(_issue("READER_RENDER_SPEC_MISMATCH", observer=observer_label))
    for field, profile_field in (
        ("profile_id", "profile_id"),
        ("section_id", "section_id"),
        ("taxonomy_version", "taxonomy_version"),
    ):
        if document.get(field) != profile.get(profile_field):
            issues.append(_issue("READER_SCOPE_PROFILE_MISMATCH", observer=observer_label, field=field))
    if str(document.get("profile_sha256") or "").lower() != profile_sha256.lower():
        issues.append(_issue("READER_PROFILE_SHA_MISMATCH", observer=observer_label))
    issues.extend({**item, "observer": observer_label} for item in _validate_binding(
        document,
        profile=profile,
        manifest_sha256=manifest_sha256,
        source_pdf_sha256=source_pdf_sha256,
    ))

    ledger = document.get("evidence_ledger")
    if not isinstance(ledger, dict):
        issues.append(_issue("READER_EVIDENCE_LEDGER_INVALID", observer=observer_label))
        ledger = {}
    pages = document.get("pages")
    if not isinstance(pages, list):
        return {}, issues + [_issue("READER_PAGES_INVALID", observer=observer_label)]

    page_rows: dict[int, dict[str, Any]] = {}
    for row in pages:
        if not isinstance(row, dict):
            issues.append(_issue("READER_PAGE_RECORD_INVALID", observer=observer_label))
            continue
        pdf_page = row.get("pdf_page")
        if type(pdf_page) is not int or pdf_page < 1 or pdf_page in page_rows:
            issues.append(_issue("READER_PDF_PAGE_INVALID_OR_DUPLICATE", observer=observer_label))
            continue
        page_rows[pdf_page] = row

    expected_set = set(expected_pages)
    actual_set = set(page_rows)
    for page in sorted(expected_set - actual_set):
        issues.append(_issue("READER_PAGE_MISSING", observer=observer_label, pdf_page=page))
    for page in sorted(actual_set - expected_set):
        issues.append(_issue("READER_PAGE_OUTSIDE_PROFILE", observer=observer_label, pdf_page=page))

    normalized_pages: dict[int, dict[str, Any]] = {}
    for pdf_page in sorted(expected_set & actual_set):
        row = page_rows[pdf_page]
        book_page = expected_pages[pdf_page]
        if type(row.get("book_page")) is not int or row["book_page"] != book_page:
            issues.append(_issue("READER_BOOK_PAGE_MISMATCH", observer=observer_label, pdf_page=pdf_page))
        printed_page_number = row.get("printed_page_number")
        if type(printed_page_number) is not int:
            issues.append(_issue("READER_PRINTED_PAGE_NUMBER_MISSING", observer=observer_label, pdf_page=pdf_page))
        elif printed_page_number != book_page:
            issues.append(_issue(
                "READER_PRINTED_PAGE_NUMBER_MISMATCH", observer=observer_label,
                pdf_page=pdf_page, expected=book_page,
            ))
        page_number_refs = row.get("page_number_evidence_refs")
        if not isinstance(page_number_refs, list):
            page_number_refs = []
        valid_page_number_evidence = False
        for ref in page_number_refs:
            record, error = _validate_evidence_ref(
                ref,
                ledger=ledger,
                expected_book_code=str(profile["book_code"]),
                expected_pdf_sha256=source_pdf_sha256,
                expected_manifest_sha256=manifest_sha256,
                pdf_page=pdf_page,
                book_page=book_page,
                page_image_sha256=page_image_hashes[pdf_page],
                pdf_document=pdf_document,
                pymupdf=pymupdf,
            )
            if error:
                issues.append(_issue(error, observer=observer_label, pdf_page=pdf_page,
                                     evidence_id=ref if isinstance(ref, str) else None))
            elif (
                record
                and record.get("evidence_purpose") == "printed_page_number"
                and record.get("evidence_kind") in (_REGION_EVIDENCE_KINDS)
            ):
                valid_page_number_evidence = True
            else:
                issues.append(_issue("READER_PAGE_NUMBER_EVIDENCE_INVALID", observer=observer_label,
                                     pdf_page=pdf_page))
        if not valid_page_number_evidence:
            issues.append(_issue("READER_PAGE_NUMBER_EVIDENCE_REQUIRED", observer=observer_label, pdf_page=pdf_page))

        image_sha = str(row.get("page_image_sha256") or "").lower()
        expected_image_sha = page_image_hashes[pdf_page]
        if not _HEX64.fullmatch(image_sha) or image_sha != expected_image_sha:
            issues.append(_issue("READER_PAGE_IMAGE_NOT_BOUND_TO_PDF", observer=observer_label, pdf_page=pdf_page))

        reading_status = row.get("reading_status")
        if reading_status != "COMPLETE":
            issues.append(_issue("READER_TEXT_READ_INCOMPLETE", observer=observer_label, pdf_page=pdf_page))
        visual_status = row.get("visual_scan_status")
        visual_count = row.get("visual_regions_count")
        if type(visual_count) is not int or visual_count < 0:
            issues.append(_issue("READER_VISUAL_REGION_COUNT_INVALID", observer=observer_label, pdf_page=pdf_page))
            visual_count = -1
        if visual_status not in {"COMPLETE", "NOT_APPLICABLE"}:
            issues.append(_issue("READER_VISUAL_SCAN_INCOMPLETE", observer=observer_label, pdf_page=pdf_page))
        if visual_status == "NOT_APPLICABLE" and visual_count != 0:
            issues.append(_issue("READER_VISUAL_NOT_APPLICABLE_CONFLICT", observer=observer_label, pdf_page=pdf_page))

        page_status = row.get("page_status")
        if page_status not in {"CURRICULAR_CONTENT", "NO_CURRICULAR_TASK"}:
            issues.append(_issue("READER_PAGE_STATUS_UNOBSERVABLE", observer=observer_label, pdf_page=pdf_page))
        page_refs = row.get("page_evidence_refs")
        if not isinstance(page_refs, list) or not page_refs:
            issues.append(_issue("READER_PAGE_EVIDENCE_REQUIRED", observer=observer_label, pdf_page=pdf_page))
            page_refs = []
        page_render_found = False
        for ref in page_refs:
            record, error = _validate_evidence_ref(
                ref,
                ledger=ledger,
                expected_book_code=str(profile["book_code"]),
                expected_pdf_sha256=source_pdf_sha256,
                expected_manifest_sha256=manifest_sha256,
                pdf_page=pdf_page,
                book_page=book_page,
                page_image_sha256=expected_image_sha,
                pdf_document=pdf_document,
                pymupdf=pymupdf,
            )
            if error:
                issues.append(_issue(error, observer=observer_label, pdf_page=pdf_page,
                                     evidence_id=ref if isinstance(ref, str) else None))
            elif record and record.get("evidence_kind") == "pdf_page_render":
                page_render_found = True
        if not page_render_found:
            issues.append(_issue("READER_PAGE_RENDER_EVIDENCE_REQUIRED", observer=observer_label, pdf_page=pdf_page))

        concepts_raw = row.get("concepts")
        if not isinstance(concepts_raw, list):
            issues.append(_issue("READER_CONCEPT_LIST_INVALID", observer=observer_label, pdf_page=pdf_page))
            concepts_raw = []
        concepts: list[dict[str, Any]] = []
        for raw_claim in concepts_raw:
            normalized, claim_issues = _normalize_claim(
                raw_claim,
                ledger=ledger,
                profile=profile,
                expected_pdf_sha256=source_pdf_sha256,
                expected_manifest_sha256=manifest_sha256,
                pdf_page=pdf_page,
                book_page=book_page,
                page_image_sha256=expected_image_sha,
                pdf_document=pdf_document,
                pymupdf=pymupdf,
            )
            issues.extend({**item, "observer": observer_label} for item in claim_issues)
            if normalized is not None:
                scope_status, reasons = _classify_claim(normalized, profile)
                normalized["scope_status"] = scope_status
                normalized["scope_reasons"] = reasons
                concepts.append(normalized)

        if page_status == "CURRICULAR_CONTENT" and not concepts:
            issues.append(_issue("CURRICULAR_PAGE_HAS_NO_CONCEPT_CLAIMS", observer=observer_label, pdf_page=pdf_page))
        if page_status == "CURRICULAR_CONTENT" and not any(c["role"] == "PRIMARY" for c in concepts):
            issues.append(_issue("CURRICULAR_PAGE_HAS_NO_PRIMARY_CONCEPT", observer=observer_label, pdf_page=pdf_page))
        if page_status == "NO_CURRICULAR_TASK" and concepts:
            issues.append(_issue("NONCURRICULAR_PAGE_HAS_CONCEPT_CLAIMS", observer=observer_label, pdf_page=pdf_page))

        normalized_pages[pdf_page] = {
            "pdf_page": pdf_page,
            "book_page": book_page,
            "printed_page_number": printed_page_number,
            "page_status": page_status,
            "reading_status": reading_status,
            "visual_scan_status": visual_status,
            "visual_regions_count": visual_count,
            "page_image_sha256": image_sha,
            "page_evidence_refs": page_refs,
            "concepts": concepts,
        }
    return normalized_pages, issues


def _result(
    *,
    status: str,
    reason_code: str,
    summary: str,
    issues: list[dict[str, Any]] | None = None,
    metrics: dict[str, Any] | None = None,
    inputs: dict[str, Any] | None = None,
    source: dict[str, Any] | None = None,
    scope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": REPORT_SCHEMA,
        "gate_id": "M05_CONCEPT_SCOPE",
        "stage": "P3",
        "status": status,
        "reason_code": reason_code,
        "summary": summary,
        "source": source or {},
        "scope": scope or {},
        "input_hashes": inputs or {},
        "metrics": metrics or {},
        "issues": issues or [],
        "safeguards": {
            "scope_only": True,
            "profile_authority_verified": False,
            "reader_independence_cryptographically_verified": False,
            "human_verdict_created": False,
            "workbook_modified": False,
            "color_change_authorized": False,
            "candidate_ready": False,
            "release_authorized": False,
        },
    }


def audit_concept_scope(
    *,
    pdf_path: str | Path,
    manifest_path: str | Path,
    profile_path: str | Path,
    pass_a_path: str | Path,
    pass_b_path: str | Path,
    repo_root: str | Path,
) -> dict[str, Any]:
    """Run the read-only M05 scope gate against a real local PDF and two passes.

    `PASS` means only that the two supplied pass files are complete, source-bound,
    mutually consistent, and conform to the supplied profile. It is not a
    pedagogical approval and is not allowed to change workbook status.
    """
    paths = {
        "pdf": Path(pdf_path).resolve(),
        "manifest": Path(manifest_path).resolve(),
        "profile": Path(profile_path).resolve(),
        "pass_a": Path(pass_a_path).resolve(),
        "pass_b": Path(pass_b_path).resolve(),
        "repo_root": Path(repo_root).resolve(),
    }
    initial = {key: str(value) for key, value in paths.items() if key != "repo_root"}
    for key in ("pdf", "manifest", "profile", "pass_a", "pass_b"):
        if not paths[key].is_file():
            return _result(
                status="BLOCKED", reason_code="INPUT_FILE_UNAVAILABLE",
                summary="یکی از ورودی‌های گیت مفهومی در دسترس نیست؛ هیچ نتیجه‌ای استنتاج نشد.",
                issues=[_issue("INPUT_FILE_UNAVAILABLE", input=key)], inputs=initial,
            )
    if _is_within(paths["pdf"], paths["repo_root"]):
        return _result(
            status="FAIL", reason_code="PDF_MUST_REMAIN_OUTSIDE_GIT",
            summary="PDF داخل درخت مخزن است؛ گیت مفهومی متوقف شد.",
            issues=[_issue("PDF_INSIDE_REPOSITORY")], inputs=initial,
        )
    private_packets = [key for key in ("pass_a", "pass_b") if _is_within(paths[key], paths["repo_root"])]
    if private_packets:
        return _result(
            status="FAIL", reason_code="READER_PASSES_MUST_REMAIN_OUTSIDE_GIT",
            summary="packetهای مشاهده باید در قرنطینهٔ خصوصی و بیرون Git باشند.",
            issues=[_issue("READER_PASSES_INSIDE_REPOSITORY", inputs=private_packets)], inputs=initial,
        )

    try:
        pdf_sha = file_sha256(str(paths["pdf"]))
        manifest_sha = file_sha256(str(paths["manifest"]))
        profile_sha = file_sha256(str(paths["profile"]))
        pass_a_sha = file_sha256(str(paths["pass_a"]))
        pass_b_sha = file_sha256(str(paths["pass_b"]))
    except OSError as exc:
        return _result(
            status="BLOCKED", reason_code="INPUT_HASH_FAILED",
            summary="هش یکی از ورودی‌ها محاسبه نشد؛ ادامه متوقف شد.",
            issues=[_issue("INPUT_HASH_FAILED", exception_type=type(exc).__name__)], inputs=initial,
        )
    input_hashes = {
        "source_pdf_sha256": pdf_sha,
        "manifest_sha256": manifest_sha,
        "profile_sha256": profile_sha,
        "pass_a_sha256": pass_a_sha,
        "pass_b_sha256": pass_b_sha,
    }

    manifest, manifest_error = _read_json(paths["manifest"], "MANIFEST")
    profile, profile_error = _read_json(paths["profile"], "PROFILE")
    pass_a, pass_a_error = _read_json(paths["pass_a"], "PASS_A")
    pass_b, pass_b_error = _read_json(paths["pass_b"], "PASS_B")
    read_errors = [e for e in (manifest_error, profile_error, pass_a_error, pass_b_error) if e]
    if read_errors or manifest is None or profile is None or pass_a is None or pass_b is None:
        return _result(
            status="BLOCKED", reason_code="INPUT_JSON_INVALID",
            summary="یک ورودی JSON معتبر نیست؛ هیچ نتیجهٔ مفهومی صادر نشد.",
            issues=read_errors or [_issue("INPUT_JSON_INVALID")], inputs=input_hashes,
        )
    content_issues = (
        _forbidden_content_fields(profile, label="profile")
        + _forbidden_content_fields(pass_a, label="pass_a")
        + _forbidden_content_fields(pass_b, label="pass_b")
    )
    if content_issues:
        return _result(
            status="BLOCKED", reason_code="RAW_TEXT_OR_IMAGE_FIELD_FORBIDDEN",
            summary="packet شامل فیلد متن/تصویر خام یا نقل‌قول است؛ برای حفاظت حق‌نشر متوقف شد.",
            issues=content_issues[:50], inputs=input_hashes,
        )

    source = manifest.get("source_pdf")
    manifest_book_code = str(manifest.get("book_code") or "").upper()
    manifest_id = manifest.get("manifest_id")
    manifest_pdf_sha = str(source.get("sha256") or "").lower() if isinstance(source, dict) else ""
    manifest_size = source.get("size_bytes") if isinstance(source, dict) else None
    expected_page_count = source.get("pdf_page_count") if isinstance(source, dict) else None
    source_issues: list[dict[str, Any]] = []
    if not manifest_book_code or not isinstance(manifest_id, str) or not manifest_id:
        source_issues.append(_issue("MANIFEST_IDENTITY_MISSING"))
    if not _HEX64.fullmatch(manifest_pdf_sha):
        source_issues.append(_issue("MANIFEST_PDF_SHA_INVALID"))
    elif manifest_pdf_sha != pdf_sha:
        source_issues.append(_issue("PDF_SOURCE_SHA_MISMATCH"))
    if type(manifest_size) is not int or manifest_size != paths["pdf"].stat().st_size:
        source_issues.append(_issue("PDF_SIZE_MISMATCH"))
    if type(expected_page_count) is not int or expected_page_count < 1:
        source_issues.append(_issue("MANIFEST_PAGE_COUNT_INVALID"))
    if source_issues:
        return _result(
            status="FAIL", reason_code=source_issues[0]["code"],
            summary="منبع PDF با manifest دقیقاً منطبق نیست؛ fail-closed.",
            issues=source_issues, inputs=input_hashes,
            source={"book_code": manifest_book_code, "manifest_id": manifest_id, "source_pdf_sha256": pdf_sha},
        )

    try:
        pymupdf = _load_pymupdf()
        document = pymupdf.open(str(paths["pdf"]))
    except Exception as exc:
        return _result(
            status="BLOCKED", reason_code="PDF_PAGE_ENUMERATION_UNAVAILABLE",
            summary="PDF باز یا صفحه‌شماری نشد؛ گیت مفهومی اجرا نشد.",
            issues=[_issue("PDF_PAGE_ENUMERATION_UNAVAILABLE", exception_type=type(exc).__name__)],
            inputs=input_hashes,
            source={"book_code": manifest_book_code, "manifest_id": manifest_id, "source_pdf_sha256": pdf_sha},
        )
    try:
        actual_page_count = len(document)
        if actual_page_count != expected_page_count:
            return _result(
                status="FAIL", reason_code="PDF_PAGE_COUNT_MISMATCH",
                summary="تعداد واقعی صفحه‌های PDF با manifest ناسازگار است؛ fail-closed.",
                issues=[_issue("PDF_PAGE_COUNT_MISMATCH", expected=expected_page_count, actual=actual_page_count)],
                inputs=input_hashes,
                source={"book_code": manifest_book_code, "manifest_id": manifest_id, "source_pdf_sha256": pdf_sha},
            )

        normalized_profile, expected_pages, profile_issues = _validate_profile(
            profile, manifest, actual_pdf_sha256=pdf_sha, actual_manifest_sha256=manifest_sha
        )
        if profile_issues or normalized_profile is None or expected_pages is None:
            return _result(
                status="BLOCKED", reason_code=profile_issues[0]["code"] if profile_issues else "PROFILE_INVALID",
                summary="پروفایل مفهومی به همین کتاب، چاپ، PDF و manifest متصل نیست یا ناقص است.",
                issues=profile_issues or [_issue("PROFILE_INVALID")], inputs=input_hashes,
                source={"book_code": manifest_book_code, "manifest_id": manifest_id, "source_pdf_sha256": pdf_sha},
            )

        page_image_hashes = {
            page_no: _pixel_digest(document[page_no - 1], pymupdf)
            for page_no in sorted(expected_pages)
        }
    except Exception as exc:
        return _result(
            status="BLOCKED", reason_code="SCOPE_SOURCE_VALIDATION_ERROR",
            summary="اعتبارسنجی manifest یا رندر مرجع صفحه ناموفق بود؛ ادامه متوقف شد.",
            issues=[_issue("SCOPE_SOURCE_VALIDATION_ERROR", exception_type=type(exc).__name__)],
            inputs=input_hashes,
            source={"book_code": manifest_book_code, "manifest_id": manifest_id, "source_pdf_sha256": pdf_sha},
        )
    finally:
        document.close()

    profile = normalized_profile
    source_record = {
        "book_code": manifest_book_code,
        "manifest_id": manifest_id,
        "edition_label_fa": manifest.get("edition_label_fa"),
        "source_pdf_sha256": pdf_sha,
        "manifest_sha256": manifest_sha,
        "actual_pdf_page_count": actual_page_count,
        "render_spec": RENDER_SPEC,
    }
    scope_record = {
        "profile_id": profile.get("profile_id"),
        "section_id": profile.get("section_id"),
        "taxonomy_version": profile.get("taxonomy_version"),
        "expected_page_count": len(expected_pages),
        "expected_pdf_pages": sorted(expected_pages),
        "manifest_pdf_minus_book_offset": manifest["pagination"]["pdf_minus_book_offset"],
        "offset_validation": "TWO_READER_PRINTED_PAGE_LABELS_MATCH_MANIFEST",
    }

    # Reject identical pass files and repeated reader/model identities. These
    # checks reduce accidental duplication but do not prove independent execution.
    pass_meta = []
    for label, doc in (("A", pass_a), ("B", pass_b)):
        pass_meta.append({
            "label": label,
            "pass_id": doc.get("pass_id"),
            "reader_id": doc.get("reader_id"),
            "model_id": doc.get("model_id"),
        })
    identity_issues: list[dict[str, Any]] = []
    if pass_a_sha == pass_b_sha:
        identity_issues.append(_issue("READER_PASS_FILES_IDENTICAL"))
    if pass_a.get("pass_id") == pass_b.get("pass_id"):
        identity_issues.append(_issue("READER_PASS_IDS_NOT_DISTINCT"))
    if pass_a.get("reader_id") == pass_b.get("reader_id"):
        identity_issues.append(_issue("READER_IDS_NOT_DISTINCT"))
    if pass_a.get("model_id") == pass_b.get("model_id"):
        identity_issues.append(_issue("MODEL_IDS_NOT_DISTINCT"))
    if identity_issues:
        return _result(
            status="BLOCKED", reason_code=identity_issues[0]["code"],
            summary="دو ورودی خوانش به‌طور ساختاری مستقل نیستند؛ توافق آن‌ها معتبر شمرده نشد.",
            issues=identity_issues, inputs=input_hashes, source=source_record, scope=scope_record,
            metrics={"reader_passes": pass_meta},
        )

    try:
        evidence_document = pymupdf.open(str(paths["pdf"]))
    except Exception as exc:
        return _result(
            status="BLOCKED", reason_code="PDF_EVIDENCE_VALIDATION_UNAVAILABLE",
            summary="PDF برای راستی‌آزماییِ ناحیه‌های شاهد دوباره باز نشد؛ گیت متوقف شد.",
            issues=[_issue("PDF_EVIDENCE_VALIDATION_UNAVAILABLE", exception_type=type(exc).__name__)],
            inputs=input_hashes, source=source_record, scope=scope_record,
        )
    try:
        pages_a, issues_a = _validate_pass(
            pass_a, observer_label="A", profile=profile, profile_sha256=profile_sha,
            expected_pages=expected_pages, manifest_sha256=manifest_sha,
            source_pdf_sha256=pdf_sha, page_image_hashes=page_image_hashes,
            pdf_document=evidence_document, pymupdf=pymupdf,
        )
        pages_b, issues_b = _validate_pass(
            pass_b, observer_label="B", profile=profile, profile_sha256=profile_sha,
            expected_pages=expected_pages, manifest_sha256=manifest_sha,
            source_pdf_sha256=pdf_sha, page_image_hashes=page_image_hashes,
            pdf_document=evidence_document, pymupdf=pymupdf,
        )
    finally:
        evidence_document.close()
    issues = issues_a + issues_b
    if issues:
        common_pages = set(pages_a) & set(pages_b)
        matched_before_block = sum(
            1 for page_no in common_pages
            if _signature(pages_a[page_no]) == _signature(pages_b[page_no])
        )
        offset_matched_before_block = sum(
            1 for page_no in common_pages
            if pages_a[page_no]["printed_page_number"] == expected_pages[page_no]
            and pages_b[page_no]["printed_page_number"] == expected_pages[page_no]
        )
        return _result(
            status="BLOCKED", reason_code=issues[0]["code"],
            summary="حداقل یکی از دو خوانش، پوشش کامل یا اتصالِ شاهدِ معتبر ندارد؛ scope=UNKNOWN.",
            issues=issues[:200], inputs=input_hashes, source=source_record, scope=scope_record,
            metrics={
                "expected_pages": len(expected_pages),
                "pass_a_pages": len(pages_a),
                "pass_b_pages": len(pages_b),
                "matched_pages": matched_before_block,
                "offset_pages_matched": offset_matched_before_block,
                "reader_passes": pass_meta,
            },
        )

    blockers: list[dict[str, Any]] = []
    confirmed_out_of_scope: list[dict[str, Any]] = []
    matched_pages = 0
    offset_pages_matched = 0
    primary_count = 0
    supporting_count = 0
    incidental_count = 0
    for pdf_page in sorted(expected_pages):
        page_a = pages_a[pdf_page]
        page_b = pages_b[pdf_page]
        if (
            page_a["printed_page_number"] == expected_pages[pdf_page]
            and page_b["printed_page_number"] == expected_pages[pdf_page]
        ):
            offset_pages_matched += 1
        if _signature(page_a) != _signature(page_b):
            blockers.append(_issue("OBSERVER_PAGE_CONCEPT_DISAGREEMENT", pdf_page=pdf_page))
            out_a = [c for c in page_a["concepts"] if c["scope_status"] == "OUT_OF_SCOPE_PRIMARY"]
            out_b = [c for c in page_b["concepts"] if c["scope_status"] == "OUT_OF_SCOPE_PRIMARY"]
            if out_a or out_b:
                blockers.append(_issue(
                    "POTENTIAL_OUT_OF_SCOPE_PRIMARY_CONFLICT",
                    pdf_page=pdf_page,
                    concept_ids=sorted({c["concept_id"] for c in out_a + out_b}),
                    severity="CRITICAL",
                ))
            continue
        matched_pages += 1
        for claim in page_a["concepts"]:
            role = claim["role"]
            if role == "PRIMARY":
                primary_count += 1
            elif role == "SUPPORTING":
                supporting_count += 1
            else:
                incidental_count += 1
            if claim["scope_status"] == "OUT_OF_SCOPE_PRIMARY":
                confirmed_out_of_scope.append(_issue(
                    "CONFIRMED_OUT_OF_SCOPE_PRIMARY",
                    pdf_page=pdf_page,
                    book_page=expected_pages[pdf_page],
                    concept_id=claim["concept_id"],
                    reasons=claim["scope_reasons"],
                    severity="CRITICAL",
                ))
            elif claim["scope_status"] == "SCOPE_UNKNOWN":
                blockers.append(_issue(
                    "CONCEPT_SCOPE_UNCLASSIFIED",
                    pdf_page=pdf_page,
                    book_page=expected_pages[pdf_page],
                    concept_id=claim["concept_id"],
                    role=role,
                    reasons=claim["scope_reasons"],
                ))

    metrics = {
        "expected_pages": len(expected_pages),
        "pass_a_pages": len(pages_a),
        "pass_b_pages": len(pages_b),
        "matched_pages": matched_pages,
        "offset_pages_matched": offset_pages_matched,
        "primary_claims": primary_count,
        "supporting_claims": supporting_count,
        "incidental_claims": incidental_count,
        "confirmed_out_of_scope_primary_claims": len(confirmed_out_of_scope),
        "observer_passes": pass_meta,
        "rendered_page_images_written_to_disk": False,
    }
    if confirmed_out_of_scope:
        return _result(
            status="FAIL", reason_code="CONFIRMED_OUT_OF_SCOPE_PRIMARY",
            summary="دو خوانش مستقل روی محتوای اصلیِ خارج از محدوده توافق دارند؛ این بخش باید متوقف و انسانی بررسی شود.",
            issues=confirmed_out_of_scope + blockers[:100], metrics=metrics,
            inputs=input_hashes, source=source_record, scope=scope_record,
        )
    if blockers or matched_pages != len(expected_pages):
        return _result(
            status="BLOCKED", reason_code=blockers[0]["code"] if blockers else "PAGE_COVERAGE_INCOMPLETE",
            summary="تعارض یا ابهام حل‌نشده وجود دارد؛ هیچ green/approval ساخته نشد.",
            issues=blockers[:200], metrics=metrics, inputs=input_hashes,
            source=source_record, scope=scope_record,
        )
    return _result(
        status="PASS", reason_code="CONCEPT_SCOPE_MATCHED_TECHNICAL_ONLY",
        summary="دو خوانشِ صفحه‌به‌صفحه با محدودهٔ مفهومیِ پروفایل سازگارند؛ این نتیجه فقط فنی است، نه تأیید آموزشی.",
        metrics=metrics, inputs=input_hashes, source=source_record, scope=scope_record,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="M05 read-only concept-scope audit; does not modify a workbook or approve content."
    )
    parser.add_argument("--repo-root", required=True, help="Repository root; the source PDF must remain outside it.")
    parser.add_argument("--pdf", required=True, help="Exact source PDF outside Git.")
    parser.add_argument("--book-manifest", required=True, help="Manifest for the exact book print.")
    parser.add_argument("--scope-profile", required=True, help="Externally approved, edition-bound concept profile JSON.")
    parser.add_argument("--pass-a", required=True, help="First isolated page-by-page concept pass JSON.")
    parser.add_argument("--pass-b", required=True, help="Second isolated page-by-page concept pass JSON.")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(list(argv) if argv is not None else None)
    report = audit_concept_scope(
        pdf_path=args.pdf,
        manifest_path=args.book_manifest,
        profile_path=args.scope_profile,
        pass_a_path=args.pass_a,
        pass_b_path=args.pass_b,
        repo_root=args.repo_root,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return {"PASS": 0, "BLOCKED": 2, "FAIL": 3}.get(report["status"], 3)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
