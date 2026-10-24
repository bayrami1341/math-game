"""Canonical typed contracts and serialization schemas across stages P0–P6 and WaveSpec v2."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
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
FieldReconcileVerdict = Literal[
    "AGREED_UNVERIFIED",
    "EVIDENCE_MATCHED",
    "DISAGREEMENT",
    "UNOBSERVABLE",
    "LOGICAL_CONFLICT",
]


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
        "pdf_crop_300dpi_nearest",
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
        "VECTOR_OUTLINE_BANNER",
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
    # --- v2.4-hardening (بند ۵): هویتِ احرازشدهٔ سمتِ سرور، نه رشتهٔ نقشِ اعلامیِ فراخواننده ---
    authenticated: bool = False
    auth_method: str = ""

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


# ==============================================================================
# WaveSpec v2 (W1 — Grade-Agnostic Data-Driven Cartridge Wave Specification)
# ==============================================================================


@dataclass
class AuthorizedCellPatch:
    sheet: str
    key: str
    col_letter: str
    new_value: Any
    expected_old_value: Any = None
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WaveS1RowSpec:
    id: str
    page: str
    chapter: str
    title: str
    objective: str
    vocab: str
    activity: str
    figure: str
    potential: str
    engine: str
    anchor: str
    note: str
    source: str = "پیشنهاد AI — موتور تألیف v۱.۰"
    status: str = "نیاز به تأیید"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WaveAtlasRowSpec:
    code_raw: str
    cell_code: str
    name_fa: str
    category: str
    description: str
    sample_sign: str
    diagnostic_prompt: str
    intervention: str
    priority: str
    note: str
    source: str = "پیشنهاد AI — موتور تألیف v۱.۰"
    status: str = "نیاز به تأیید"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WaveQuestionSpec:
    anchor: str
    scope: str
    cpa: str
    level: str
    stem: str
    opts: List[str]
    ans: str
    map: str
    trace: str
    answer_val: Any
    wrong_spec: List[List[Any]] = field(default_factory=list)
    page_ref: str = ""
    qid: Optional[str] = None
    semantic_key: Optional[str] = None
    q_format: str = "چهارگزینه‌ای"
    rubric: str = "پاسخ دقیق و تک‌گزینه‌ای؛ محاسبهٔ مستقل لاتین و علیت هر سه گزینهٔ انحرافی در یادداشت ثبت شد."
    note_override: Optional[str] = None
    source: str = "پیشنهاد AI — موتور تألیف v۱.۰"
    status: str = "نیاز به تأیید"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WaveSpecV2:
    wave_id: str
    family_id: str
    book_code: str
    base_cartridge_filename: str
    expected_official_base_sha256: str
    verified_pagemap_path: Optional[str] = None
    verified_pagemap_sha256: Optional[str] = None
    insert_s1_after_key: Optional[str] = None
    min_question_id_start: int = 1001
    semantic_prefix: str = "wave"
    runtime_error_codes: List[str] = field(default_factory=list)
    authorized_patches: List[AuthorizedCellPatch] = field(default_factory=list)
    s1_rows: List[WaveS1RowSpec] = field(default_factory=list)
    atlas_rows: List[WaveAtlasRowSpec] = field(default_factory=list)
    question_rows: List[WaveQuestionSpec] = field(default_factory=list)
    deferred_proposals: List[Dict[str, Any]] = field(default_factory=list)
    schema_version: str = "2.0.0"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "WaveSpecV2":
        return cls(
            schema_version=str(raw.get("schema_version", "2.0.0")),
            wave_id=raw["wave_id"],
            family_id=raw["family_id"],
            book_code=raw["book_code"],
            base_cartridge_filename=raw["base_cartridge_filename"],
            expected_official_base_sha256=raw["expected_official_base_sha256"],
            verified_pagemap_path=raw.get("verified_pagemap_path"),
            verified_pagemap_sha256=raw.get("verified_pagemap_sha256"),
            insert_s1_after_key=raw.get("insert_s1_after_key"),
            min_question_id_start=int(raw.get("min_question_id_start", 1001)),
            semantic_prefix=str(raw.get("semantic_prefix", raw["wave_id"])),
            runtime_error_codes=list(raw.get("runtime_error_codes", [])),
            authorized_patches=[AuthorizedCellPatch(**p) for p in raw.get("authorized_patches", [])],
            s1_rows=[WaveS1RowSpec(**r) for r in raw.get("s1_rows", [])],
            atlas_rows=[WaveAtlasRowSpec(**r) for r in raw.get("atlas_rows", [])],
            question_rows=[
                WaveQuestionSpec(
                    **{
                        **q,
                        "answer_val": q["answer_val"] if "answer_val" in q else q.get("answer_int"),
                    }
                )
                for q in [
                    {k: v for k, v in item.items() if k != "answer_int"}
                    | ({"answer_val": item["answer_int"]} if "answer_val" not in item and "answer_int" in item else {})
                    for item in raw.get("question_rows", [])
                ]
            ],
            deferred_proposals=list(raw.get("deferred_proposals", [])),
        )

    @classmethod
    def from_json_file(cls, path: str | Path) -> "WaveSpecV2":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    def save_json(self, path: str | Path) -> None:
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
