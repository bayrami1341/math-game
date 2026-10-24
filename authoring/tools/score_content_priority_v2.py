"""Pure six-factor educational priority proposal; NEVER a stamp or runtime contract.

Each scored dimension requires a reviewed, locatable source. A missing rating
is unknown (not zero). All examples in tests are synthetic, not C205 claims.
This module does not read PDF, verify Achilles' identity, or modify Excel/Z.ai.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

SCHEMA = "arena-educational-priority/v2"
WEIGHTS = {
    "goal_alignment": 35,
    "future_foundation": 20,
    "transfer_application": 15,
    "diagnostic_value": 10,
    "coverage_gap": 10,
    "developmental_fit": 10,
}
assert sum(WEIGHTS.values()) == 100
RUBRIC_ID = "ARENA_SIX_FACTOR_v2_PROPOSED_NOT_OFFICIAL_GUIDE_NUMBERS"
VALID_SOURCE_KINDS = {"OFFICIAL_TEACHER_GUIDE", "OFFICIAL_CURRICULUM",
                      "REVIEWED_WORKBOOK", "REVIEWED_COVERAGE", "HUMAN_SCOPED_VERDICT"}
GOAL_SOURCES = {"OFFICIAL_TEACHER_GUIDE", "OFFICIAL_CURRICULUM", "HUMAN_SCOPED_VERDICT"}
FUTURE_SOURCES = GOAL_SOURCES  # never infer future prerequisites merely from the operation's name
THRESHOLDS = ((70, "HIGH"), (40, "SUPPORTING"), (0, "LOW"))


def _required_str(record: dict, field: str) -> str:
    value = record.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError("MISSING_" + field.upper())
    return value.strip()


def _reference(ref: dict, *, allowed: set[str] = VALID_SOURCE_KINDS) -> None:
    if not isinstance(ref, dict) or ref.get("kind") not in allowed:
        raise ValueError("UNSUPPORTED_OR_MISSING_EVIDENCE_SOURCE")
    for field in ("source_id", "source_sha256", "locator", "reviewed_by"):
        _required_str(ref, field)
    sha = ref["source_sha256"]
    if len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
        raise ValueError("INVALID_EVIDENCE_SHA")
    if ref.get("status") != "REVIEWED":
        raise ValueError("EVIDENCE_NOT_REVIEWED")


def _band(value: Decimal) -> str:
    for threshold, name in THRESHOLDS:
        if value >= threshold:
            return name
    raise AssertionError("NON_NEGATIVE_SCORE_REQUIRED")


def _number(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def assess(record: dict) -> dict:
    """Evaluate one content UID; conservative bounds and no automatic release.

    goal_binding: {status: VERIFIED, edition_alignment: SAME_EDITION |
      REVIEWED_EQUIVALENCE | HUMAN_SCOPED, evidence: {...}}
    factors: {key: {rating: integer 0..4 | null, evidence: [{...}]}}.
    Null dimensions must not carry a fabricated zero-valued evidence claim.
    """
    if record.get("schema") != SCHEMA:
        raise ValueError("UNSUPPORTED_SCORING_SCHEMA")
    uid = _required_str(record, "content_uid")
    _required_str(record, "workbook_sha256")
    if len(record["workbook_sha256"]) != 64 or any(c not in "0123456789abcdef" for c in record["workbook_sha256"]):
        raise ValueError("INVALID_WORKBOOK_SHA")
    _required_str(record, "achilles_receipt_id")
    result = {"schema": SCHEMA, "rubric": RUBRIC_ID, "content_uid": uid,
              "selection_score_0_100": None, "score_interval_0_100": None,
              "priority_band": None, "repetition_frequency": "NOT_DERIVED",
              "engine_capability": "AWAITING_ZAI_VERSIONED_MANIFEST",
              "approval_or_release": "NOT_GRANTED"}
    if record.get("achilles_status") != "APPROVED_INPUT_ASSUMED":
        return {**result, "status": "HOLD_ACHILLES_INPUT"}
    goal = record.get("goal_binding") or {}
    if (goal.get("status") != "VERIFIED" or goal.get("edition_alignment") not in
            {"SAME_EDITION", "REVIEWED_EQUIVALENCE", "HUMAN_SCOPED"}):
        return {**result, "status": "HOLD_GOAL_OR_EDITION"}
    _required_str(goal, "objective_id")
    _reference(goal.get("evidence"), allowed=GOAL_SOURCES)
    if goal["edition_alignment"] != "SAME_EDITION":
        _reference(goal.get("equivalence_evidence"), allowed=GOAL_SOURCES)
    # Independent conceptual-scope gate: never score a known main-goal drift.
    scope = record.get("concept_scope_binding") or {}
    if scope.get("decision") == "BLOCK_CRITICAL_SCOPE_DRIFT":
        return {**result, "status": "HOLD_CRITICAL_CONCEPT_DRIFT"}
    if (scope.get("schema") != "arena-concept-scope/v1" or scope.get("decision") != "ALIGNED"
            or scope.get("content_uid") != uid or scope.get("workbook_sha256") != record["workbook_sha256"]
            or not isinstance(scope.get("profile_id"), str) or not scope["profile_id"].strip()
            or type(scope.get("profile_revision")) is not int or scope["profile_revision"] < 1
            or not isinstance(scope.get("profile_source_sha256"), str)
            or len(scope["profile_source_sha256"]) != 64
            or any(c not in "0123456789abcdef" for c in scope["profile_source_sha256"])):
        return {**result, "status": "HOLD_CONCEPT_SCOPE_REVIEW"}
    factors = record.get("factors")
    if not isinstance(factors, dict) or set(factors) != set(WEIGHTS):
        raise ValueError("MISSING_OR_EXTRA_SCORING_FACTORS")
    known = Decimal(0)
    unknown = []
    for factor, weight in WEIGHTS.items():
        entry = factors[factor]
        if not isinstance(entry, dict) or "rating" not in entry:
            raise ValueError("INVALID_FACTOR:" + factor)
        rating = entry["rating"]
        if rating is None:
            if entry.get("evidence"):
                raise ValueError("UNKNOWN_WITH_UNREVIEWED_CLAIM:" + factor)
            _required_str(entry, "missing_reason")
            unknown.append(factor)
            continue
        if type(rating) is not int or not 0 <= rating <= 4:
            raise ValueError("RATING_MUST_BE_INTEGER_0_TO_4:" + factor)
        _required_str(entry, "rationale")
        if factor == "future_foundation" and rating > 0:
            _required_str(entry, "target_objective_id")
            _required_str(entry, "target_scope")
        refs = entry.get("evidence")
        if not isinstance(refs, list) or not refs:
            raise ValueError("FACTOR_WITHOUT_EVIDENCE:" + factor)
        allowed = FUTURE_SOURCES if factor == "future_foundation" else VALID_SOURCE_KINDS
        if factor == "goal_alignment":
            allowed = GOAL_SOURCES
        if factor == "coverage_gap":
            allowed = {"REVIEWED_COVERAGE", "HUMAN_SCOPED_VERDICT"}
        for ref in refs:
            _reference(ref, allowed=allowed)
        known += Decimal(weight) * Decimal(rating) / Decimal(4)
    # A documented zero match cannot be promoted by application, difficulty, or engine ease.
    if factors["goal_alignment"]["rating"] == 0:
        return {**result, "status": "ARCHIVE_ONLY_OUTSIDE_GOAL", "reason": "GOAL_ALIGNMENT_ZERO"}
    if factors["goal_alignment"]["rating"] is None:
        return {**result, "status": "HOLD_GOAL_ALIGNMENT_RATING"}
    max_possible = known + sum((Decimal(WEIGHTS[key]) for key in unknown), Decimal(0))
    bounds = [_number(known), _number(max_possible)]
    result["score_interval_0_100"] = bounds
    result["missing_factors"] = unknown
    if unknown:
        stable = _band(known) if _band(known) == _band(max_possible) else None
        return {**result, "status": "PROVISIONAL_BAND_ONLY" if stable else "HUMAN_REVIEW_DECISION_SENSITIVE",
                "priority_band": stable}
    return {**result, "status": "SCORED_EDUCATIONAL_CANDIDATE_ONLY",
            "selection_score_0_100": bounds[0], "priority_band": _band(known)}
