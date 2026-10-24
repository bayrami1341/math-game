"""Build a conservative chapter-2 G2 page/budget queue from pinned metadata.

No OCR, objective inference, content approval, score, or workbook mutation.
The skeleton is read from a FULL pinned Git commit; the candidate inventory is
historical YELLOW metadata, never a substitute for Achilles' new extraction.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_COMMIT = "1a8391e0dfcfb63684d2a41da1e57b818dfa4564"
SOURCE_PATH = "handoff/SKELETON-G2-KH-v1.json"
SOURCE_SHA = "358c727a2f96c47e339c10153a889628e9c059f3326ea401a96acb9c6dcafa73"
INVENTORY_PATH = ROOT / "authoring/g2-completion/G2-COVERAGE-INVENTORY-v1.json"
OUTPUT_PATH = ROOT / "authoring/g2-completion/G2-CH2-SKELETON-PAGE-BUDGET-QUEUE-v1.json"


def pinned_json() -> dict:
    result = subprocess.run(["git", "show", SOURCE_COMMIT + ":" + SOURCE_PATH],
                            cwd=ROOT, capture_output=True, check=True)
    if hashlib.sha256(result.stdout).hexdigest() != SOURCE_SHA:
        raise ValueError("SKELETON_SHA_DRIFT")
    return json.loads(result.stdout)


def build(skeleton: dict, inventory: dict) -> dict:
    if (skeleton.get("schema") != "khshab.skeleton-handoff/v1"
            or skeleton.get("cartridge") != "KH-G2-MATH"
            or inventory.get("schema") != "G2_CONTENT_INVENTORY_v1"
            or inventory.get("hashes", {}).get("candidate")
                != "18e6b4fa4957e968eca2b3b8066387858a627a99d7d52340064a1e8d8880c618"):
        raise ValueError("SOURCE_SCHEMA_OR_EDITION_MISMATCH")
    spine = skeleton["spine"]["chapters"][1]
    budget = skeleton["budget"]["chapters"][1]
    chapter = skeleton["topicMap"]["chapters"][1]
    topics = [("MAIN", t) for t in chapter["main"]] + [("SUBSIDIARY", t) for t in chapter["subsidiary"]]
    if (spine["printedStart"], spine["printedEnd"], budget["pages"], chapter["pages"]) != (
            19, 36, [19, 36], [19, 36]):
        raise ValueError("CHAPTER_PAGE_DRIFT")
    if (budget["min"], budget["max"], len(budget["subTopics"]), len(topics)) != (60, 90, 5, 9):
        raise ValueError("CHAPTER_BUDGET_OR_TOPIC_DRIFT")
    rows = [p for p in inventory["pages"] if p.get("chapter") == 2]
    summaries = [s for s in inventory.get("chapter_summary", []) if s.get("chapter") == 2]
    if (len(rows) != 18 or {p["book_page"] for p in rows} != set(range(19, 37))
            or len(summaries) != 1 or summaries[0]["existing_q_count"] != sum(p["existing_q_count"] for p in rows)
            or any(p["s1_status"] != "نیاز به تأیید" for p in rows)):
        raise ValueError("CANDIDATE_CHAPTER_INVENTORY_DRIFT")
    queue = []
    for page in sorted(rows, key=lambda p: p["book_page"]):
        page_no = page["book_page"]
        queue.append({"printed_page": page_no, "candidate_s1_id": page["s1_id"],
                      "candidate_question_ids": page["existing_q_ids"].split(";") if page["existing_q_ids"] else [],
                      "candidate_q_count": page["existing_q_count"],
                      "topic_hints": [{"source_kind": kind, "source_no": t["no"], "title": t["topic"]}
                                      for kind, t in topics
                                      if any(start <= page_no <= end for start, end in t["pages"])],
                      "extraction_evidence": "AWAITING_ACHILLES_VERIFIED_SNAPSHOT",
                      "guide_objective": "UNKNOWN_SAME_EDITION_GOAL",
                      "exercise_families": "UNKNOWN_UNTIL_PAGE_EVIDENCE",
                      "educational_acceptance": "NOT_GRANTED"})
    if any(len(p["candidate_question_ids"]) != p["candidate_q_count"] for p in queue):
        raise ValueError("CANDIDATE_Q_COUNT_DRIFT")
    # Exact title equality is only a search hint, not a witnessed mapping.
    hints = [{"topic": t["topic"], "budget_row": b["topic"], "status": "LEXICAL_HINT_NOT_REVIEWED"}
             for _, t in topics for b in budget["subTopics"] if t["topic"] == b["topic"]]
    return {"schema": "arena-g2-ch2-skeleton-queue/v1", "skeleton_commit": SOURCE_COMMIT,
            "skeleton_path": SOURCE_PATH, "skeleton_sha256": SOURCE_SHA,
            "candidate_workbook_sha256": inventory["hashes"]["candidate"],
            "source_inventory_status": "HISTORICAL_YELLOW_NOT_ACHILLES_VERIFIED",
            "grade": "G2", "book_code": "C205", "chapter": 2, "printed_pages": [19, 36],
            "budget": {"min": budget["min"], "max": budget["max"], "levels": budget["levels"],
                       "rows": [{"title": b["topic"], "min": b["total"][0], "max": b["total"][1],
                                 "levels": b["levels"], "allocated_verified_q": 0}
                                for b in budget["subTopics"]]},
            "topics": [{"kind": kind, "no": t["no"], "title": t["topic"], "pages": t["pages"],
                        "value_from_skeleton": t["value"],
                        "budget_mapping": "UNMAPPED_AWAITING_PAGE_AND_GUIDE_EVIDENCE"}
                       for kind, t in topics],
            "exact_title_hints_only": hints,
            "page_queue": queue,
            "candidate_q_total_not_accepted": sum(p["candidate_q_count"] for p in queue),
            "accepted_q_total": 0, "coverage_status": "NOT_PROVEN",
            "release_authorization": "NOT_GRANTED"}


def main() -> None:
    raw = INVENTORY_PATH.read_bytes()
    result = build(pinned_json(), json.loads(raw))
    result["historical_inventory_sha256"] = hashlib.sha256(raw).hexdigest()
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT_PATH.relative_to(ROOT)), "pages": len(result["page_queue"]),
                      "candidate_q": result["candidate_q_total_not_accepted"],
                      "accepted_q": result["accepted_q_total"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
