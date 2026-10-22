"""Canonical typed contracts and serialization schemas across stages P0–P6."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Literal, Optional

GateStatus = Literal["PASS", "FAIL", "BLOCKED"]
ConfidenceLevel = Literal["HIGH", "MEDIUM", "LOW", "UNOBSERVABLE"]
ReconciliationStatus = Literal[
    "AGREED_UNVERIFIED",
    "VERIFIED_EVIDENCE",
    "CONFLICT_NEEDS_REVIEW",
    "UNOBSERVABLE_NEEDS_HUMAN",
    "TEACHER_APPROVED",
]


from datetime import datetime, timezone


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_sha256_obj(payload: Any) -> str:
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass
class GateResult:
    gate_id: str
    stage: str
    status: GateStatus
    reason_code: str
    summary: str
    metrics: Dict[str, Any] = field(default_factory=dict)
    issues: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EvidenceRef:
    evidence_id: str
    book_code: str
    source_sha256: str
    pdf_page: int
    book_page: Optional[int]
    evidence_kind: Literal[
        "pdf_text_bbox",
        "pdf_crop_150dpi",
        "physical_book_photo",
        "independent_computation",
        "teacher_verdict",
    ]
    bbox_normalized: Optional[List[float]] = None
    crop_sha256: Optional[str] = None
    note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PageQualityScore:
    pdf_page: int
    expected_book_page: Optional[int]
    extracted_footer_book_page: Optional[int]
    footer_alignment_status: Literal["MATCH", "FRONT_OR_BACK_MATTER", "MISMATCH", "MISSING"]
    text_char_count: int
    span_count: int
    image_count: int
    drawing_path_count: int
    mixed_encoding_token_count: int
    vertical_stack_candidate_count: int
    visual_dependency: Literal["LOW", "MEDIUM", "HIGH"]
    recommended_action: Literal["TEXT_PLUS_BBOX", "CROP_VERIFICATION_REQUIRED", "HUMAN_BOOK_PHOTO_REQUIRED"]
    quality_score: float
    hazards: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PageRegion:
    region_id: str
    pdf_page: int
    book_page: Optional[int]
    reading_order: int
    region_kind: Literal[
        "CHAPTER_HEADER",
        "LESSON_BANNER",
        "MARGIN_TAB",
        "RED_BOX_HEADER",
        "FOOTNOTE_RULE",
        "FOOTER_PAGE_NUMBER",
        "VERTICAL_ARITHMETIC",
        "TABLE_OR_CHART",
        "BODY_TEXT",
    ]
    bbox_normalized: List[float]
    raw_text: str
    normalized_text: str
    has_mixed_digits: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Claim:
    claim_id: str
    pdf_page: int
    book_page: Optional[int]
    region_id: Optional[str]
    field_name: str
    raw_reading: str
    normalized_value: Any
    unit_or_role: str
    confidence: ConfidenceLevel
    evidence_refs: List[str] = field(default_factory=list)
    observer_id: str = "pdf_spatial_observer_v1"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DiscrepancyIssue:
    issue_id: str
    pdf_page: int
    book_page: Optional[int]
    field_name: str
    severity: Literal["CRITICAL", "HIGH", "MEDIUM", "INFO"]
    category: str
    reader_a_value: Any
    reader_b_value: Any
    direct_observation_value: Any
    status: Literal["OPEN", "RESOLVED_BY_CROP_EVIDENCE", "NEEDS_TEACHER_VERDICT"]
    summary_fa: str
    evidence_refs: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DecisionRecord:
    decision_id: str
    issue_id: str
    pdf_page: int
    book_page: Optional[int]
    decided_by: str
    authority_level: Literal["AUTOMATED_EVIDENCE_RECONCILIATION", "TEACHER_HUMAN_VERDICT"]
    chosen_value: Any
    resulting_status: ReconciliationStatus
    rationale_fa: str
    evidence_refs: List[str]
    timestamp_utc: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TeacherVerdict:
    verdict_id: str
    scope: str
    actor: str
    actor_role: str
    target_ids: List[str]
    target_sha256: str
    timestamp_utc: str
    notes: str = ""
    invalidated: bool = False
    invalidation_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WaveManifest:
    manifest_id: str
    wave_id: str
    book_code: str
    source_pdf_sha256: str
    snapshot_id: str
    snapshot_sha256: str
    pagemap_xlsx_sha256: str
    base_cartridge_xlsx_sha256: str
    output_cartridge_xlsx_sha256: str
    converted_json_sha256: Optional[str]
    generated_at_utc: str
    gates: List[GateResult]
    teacher_verdicts: List[TeacherVerdict]
    releasable: bool
    release_blocker_reasons: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

