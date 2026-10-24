"""Pure M0 handoff: private intake index -> independent scope -> six-factor scorer.

No workbook/PDF IO, no actual objective extraction, coverage decision, Z.ai runtime
contract, or release. The intake index must be produced by the separate private
archive tool; its Achilles receipt remains attested, not cryptographically proven.
"""
from __future__ import annotations

from collections import Counter

from audit_concept_scope_v1 import assess as audit_scope, binding_for, inventory_from_intake_index
from score_content_priority_v2 import assess as score_priority


def evaluate(index: dict, profile: dict, claims_by_uid: dict, score_inputs_by_uid: dict) -> dict:
    """Do not let a caller-supplied ALIGNED flag bypass the independent audit.

    An absent scorer input means HOLD, not zero. A critical main-goal drift in
    *any* item prevents scoring of the whole edition/workbook batch. Results
    cannot be mistaken for breadth/depth completion or engine acceptance.
    """
    if (index.get("schema") != "arena-content-library-index/v1"
            or index.get("status") != "ARCHIVED_NOT_RUNTIME_APPROVED"
            or index.get("approval_trust") != "RECEIPT_ATTESTED_NOT_CRYPTOGRAPHICALLY_AUTHENTICATED"
            or not isinstance(index.get("workbook_sha256"), str)
            or not isinstance(index.get("achilles_receipt_id"), str)
            or not index["achilles_receipt_id"].strip()
            or not isinstance(score_inputs_by_uid, dict)):
        raise ValueError("UNSUPPORTED_OR_UNATTESTED_PRIVATE_INDEX")
    items = inventory_from_intake_index(index)
    all_uids = {x["uid"] for x in items}
    if set(score_inputs_by_uid) - all_uids:
        raise ValueError("ORPHAN_SCORE_INPUT")
    report = audit_scope(profile, items, claims_by_uid, workbook_sha256=index["workbook_sha256"])
    if set(score_inputs_by_uid) & {x["uid"] for x in items if x["kind"] == "CHAPTER_ANCHOR"}:
        raise ValueError("CHAPTER_ANCHOR_IS_NOT_PAGE_SCORE")
    cards = []
    for item in items:
        if item["kind"] == "CHAPTER_ANCHOR":
            continue
        uid = item["uid"]
        binding = binding_for(report, uid)
        if binding["decision"] != "ALIGNED":
            status = ("HOLD_CRITICAL_CONCEPT_DRIFT" if binding["decision"] == "BLOCK_CRITICAL_SCOPE_DRIFT"
                      else "HOLD_CONCEPT_SCOPE_REVIEW")
            cards.append({"content_uid": uid, "status": status, "selection_score_0_100": None})
            continue
        raw = score_inputs_by_uid.get(uid)
        if raw is None:
            cards.append({"content_uid": uid, "status": "HOLD_SCORING_INPUT",
                          "selection_score_0_100": None})
            continue
        if (not isinstance(raw, dict) or raw.get("content_uid") != uid
                or raw.get("workbook_sha256") != index["workbook_sha256"]
                or raw.get("achilles_receipt_id") != index["achilles_receipt_id"]):
            raise ValueError("SCORE_INPUT_LINEAGE_MISMATCH:" + uid)
        # Explicitly overwrite a caller's purported scope decision with the independent result.
        card = score_priority({**raw, "concept_scope_binding": binding})
        cards.append(card)
    return {"schema": "arena-section2-pipeline/v1", "book_id": index["book_id"],
            "edition_id": index["edition_id"], "workbook_sha256": index["workbook_sha256"],
            "scope": report, "scorecards": cards,
            "score_status_counts": dict(Counter(x["status"] for x in cards)),
            "coverage_status": "NOT_ASSESSED_BREADTH_OR_DEPTH",
            "zai_capability_status": "AWAITING_VERSIONED_CONTRACT",
            "approval_or_release": "NOT_GRANTED"}
