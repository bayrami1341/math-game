"""Join pinned, metadata-only Achilles page evidence to Arena's yellow G2 ch2 queue.

No PDF, image, XLSX, question text or answer is downloaded or written. The
remote observation ledger has PAGE claims, not Q-ID bindings; these remain HOLD.
"""
from __future__ import annotations

import base64
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COMMIT = "49344cf7bacd8ce897b8cc78ab746dbf71673382"
SNAPSHOT = ("authoring/snapshots/master-map-C205-v2.0/snapshot.json",
            "ceaaf18bd11201a140fd519e54808e8fc7b07d57a7dde7ffc5f58b8521c21a77")
OBSERVATION = ("authoring/audit/observation_C205.json",
               "3c8c4297604630c53828b3db79b86ce96d8a9dbdd38a64cb155946b7d7a46003")
QUEUE = ROOT / "authoring/g2-completion/G2-CH2-SKELETON-PAGE-BUDGET-QUEUE-v1.json"
OUTPUT = ROOT / "authoring/g2-completion/G2-CH2-ACHILLES-PAGE-EVIDENCE-RECONCILIATION-v1.json"
PDF_SHA = "a93934b6c418d4c6efe5ebb109bbcfe4f5fb6024fa1f3b1b309a4ff6da2746de"


def get_metadata(path: str, expected_sha: str) -> dict:
    """Fetch only the fixed JSON metadata path, not the entire Git ref/workbook."""
    url = f"repos/bayrami1341/math-game/contents/{path}?ref={COMMIT}"
    envelope = json.loads(subprocess.check_output(["gh", "api", url], cwd=ROOT))
    raw = base64.b64decode(envelope["content"])
    if hashlib.sha256(raw).hexdigest() != expected_sha:
        raise ValueError("REMOTE_METADATA_SHA_DRIFT:" + path)
    return json.loads(raw)


def build(snapshot: dict, observation: dict, queue: dict) -> dict:
    if (snapshot.get("book_code") != "C205" or observation.get("book_code") != "C205"
            or snapshot.get("source_pdf_sha256") != PDF_SHA
            or observation.get("source_pdf_sha256") != PDF_SHA
            or queue.get("schema") != "arena-g2-ch2-skeleton-queue/v1"
            or queue.get("printed_pages") != [19, 36]):
        raise ValueError("SOURCE_BOOK_OR_QUEUE_DRIFT")
    pages = [x for x in snapshot["pages"] if type(x.get("book_page")) is int and 19 <= x["book_page"] <= 36]
    if len(pages) != 18 or {x["book_page"] for x in pages} != set(range(19, 37)):
        raise ValueError("CHAPTER_PAGE_COVERAGE_DRIFT")
    by_page = {x["book_page"]: x for x in pages}
    ledger = observation["evidence_ledger"]
    if not isinstance(ledger, dict) or any("q_id" in x for x in observation["claims"]):
        # If Achilles adds Q-ID support, re-review the contract; never silently
        # leave real Q evidence unconsumed or infer page/Q equivalence.
        raise ValueError("OBSERVATION_SCHEMA_CHANGED_REVIEW_JOIN")
    joined = []
    for row in queue["page_queue"]:
        page = row["printed_page"]
        source = by_page[page]
        pdf = source.get("pdf_page")
        if type(pdf) is not int or pdf != page + 6:
            raise ValueError("PAGE_PDF_OFFSET_DRIFT")
        refs = source.get("evidence_refs")
        if not isinstance(refs, list) or any(not isinstance(x, str) or x not in ledger
                                              or ledger[x].get("pdf_page") != pdf for x in refs):
            raise ValueError("EVIDENCE_REF_UNBOUND")
        claims = [x for x in observation["claims"] if x.get("book_page") == page]
        if any(not isinstance(x.get("evidence_refs"), list) or not x["evidence_refs"]
               or any(ref not in ledger or ledger[ref].get("pdf_page") != pdf
                      for ref in x["evidence_refs"]) for x in claims):
            raise ValueError("CLAIM_EVIDENCE_REF_UNBOUND")
        joined.append({"printed_page": page, "pdf_page_reported": pdf,
                       "candidate_s1_id": row["candidate_s1_id"],
                       "candidate_question_ids": row["candidate_question_ids"],
                       "topic_hints": row["topic_hints"],
                       "achilles_page_status": source.get("reconciliation_status"),
                       "reported_exercise_count": source.get("exercise_count"),
                       "page_evidence_refs": sorted(refs),
                       "page_claim_ids": sorted(x["claim_id"] for x in claims),
                       "question_evidence_link": "MISSING_Q_ID_TO_REGION_JOIN",
                       "educational_status": "NOT_ASSESSED"})
    if [r["printed_page"] for r in joined] != list(range(19, 37)):
        raise ValueError("QUEUE_PAGE_ORDER_DRIFT")
    states = [r["achilles_page_status"] for r in joined]
    if states.count("VERIFIED_EVIDENCE") != 9 or states.count("AGREED_UNVERIFIED") != 9:
        raise ValueError("ACHILLES_PAGE_STATUS_DRIFT")
    return {"schema": "arena-g2-ch2-achilles-metadata-reconciliation/v1",
            "producer_commit": COMMIT, "source_snapshot_path": SNAPSHOT[0],
            "source_snapshot_sha256": SNAPSHOT[1], "source_observation_path": OBSERVATION[0],
            "source_observation_sha256": OBSERVATION[1],
            "candidate_workbook_sha256": queue["candidate_workbook_sha256"],
            "source_review_level": "ACHILLES_METADATA_ONLY_NOT_ARENA_VISUAL_VERIFIED",
            "official_workbook_version": "NOT_USED_AS_CANDIDATE",
            "page_status_counts": {"VERIFIED_EVIDENCE": 9, "AGREED_UNVERIFIED": 9},
            "page_queue": joined, "question_evidence_status": "NONE_BOUND_BY_Q_ID",
            "educational_acceptance": "NOT_GRANTED", "release": "NOT_GRANTED"}


def main() -> None:
    raw = QUEUE.read_bytes()
    result = build(get_metadata(*SNAPSHOT), get_metadata(*OBSERVATION), json.loads(raw))
    result["arena_queue_sha256"] = hashlib.sha256(raw).hexdigest()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "pages": len(result["page_queue"]),
                      "question_evidence_status": result["question_evidence_status"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
