"""Overlay pinned Achilles C205 issue-status metadata on G2 chapter 2 page queue.

No question text, image, PDF, workbook or personal data is fetched or exported.
A crop-evidence status describes a page discrepancy, NOT educational acceptance.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from build_g2_ch2_achilles_reconciliation import COMMIT, PDF_SHA, ROOT, get_metadata

ISSUES = ("authoring/audit/issue_queue_C205.json",
          "b23e3e52679c4c5fe930b15baadbdb06a3148c76134abba7147fd8920cd040b2")
INPUT = ROOT / "authoring/g2-completion/G2-CH2-ACHILLES-PAGE-EVIDENCE-RECONCILIATION-v1.json"
OUTPUT = ROOT / "authoring/g2-completion/G2-CH2-ACHILLES-ISSUE-OVERLAY-v1.json"
ALLOWED = {"RESOLVED_BY_CROP_EVIDENCE", "NEEDS_TEACHER_VERDICT"}


def overlay(issues: dict, pages: dict) -> dict:
    if (issues.get("book_code") != "C205" or issues.get("source_pdf_sha256") != PDF_SHA
            or issues.get("total_issues") != 29 or len(issues.get("issues", [])) != 29
            or pages.get("producer_commit") != COMMIT
            or pages.get("schema") != "arena-g2-ch2-achilles-metadata-reconciliation/v1"
            or pages.get("question_evidence_status") != "NONE_BOUND_BY_Q_ID"):
        raise ValueError("ISSUE_SOURCE_OR_PAGE_LINEAGE_DRIFT")
    statuses = [x.get("status") for x in issues["issues"]]
    if set(statuses) - ALLOWED or statuses.count("RESOLVED_BY_CROP_EVIDENCE") != 14 or statuses.count("NEEDS_TEACHER_VERDICT") != 15:
        raise ValueError("ISSUE_STATUS_COUNTS_DRIFT")
    ids = [x.get("issue_id") for x in issues["issues"]]
    if any(not isinstance(x, str) or not x for x in ids) or len(set(ids)) != 29:
        raise ValueError("ISSUE_IDS_INVALID")
    by_page = {x["printed_page"]: x for x in pages["page_queue"]}
    if len(by_page) != 18 or set(by_page) != set(range(19, 37)):
        raise ValueError("CHAPTER_QUEUE_DRIFT")
    entries = []
    for issue in issues["issues"]:
        page = issue.get("book_page")
        if type(page) is not int or page not in by_page:
            continue
        row = by_page[page]
        refs = issue.get("evidence_refs")
        if (issue.get("pdf_page") != row["pdf_page_reported"]
                or not isinstance(refs, list)
                or not set(refs).issubset(set(row["page_evidence_refs"]))):
            raise ValueError("ISSUE_EVIDENCE_PAGE_MISMATCH")
        entries.append({"issue_id": issue["issue_id"], "printed_page": page,
                        "pdf_page_reported": row["pdf_page_reported"],
                        "category": issue.get("category"), "issue_status": issue["status"],
                        "evidence_refs": sorted(refs),
                        "candidate_question_ids_on_page": row["candidate_question_ids"],
                        "question_issue_relation": "UNDETERMINED_NO_Q_ID_IN_ISSUE",
                        "human_educational_verdict": "NOT_DERIVED_FROM_ISSUE_STATUS"})
    return {"schema": "arena-g2-ch2-achilles-issue-overlay/v1", "producer_commit": COMMIT,
            "source_path": ISSUES[0], "source_sha256": ISSUES[1],
            "total_issues_all_C205": 29,
            "all_C205_status_counts": {"RESOLVED_BY_CROP_EVIDENCE": 14,
                                      "NEEDS_TEACHER_VERDICT": 15},
            "ch2_issue_count": len(entries), "ch2_issues": sorted(entries, key=lambda x: (x["printed_page"], x["issue_id"])),
            "automatically_accepted_question_count": 0,
            "chapter_or_edition_errors_corrected_by_arena": "NOT_INFERABLE_FROM_THIS_LEDGER",
            "release": "NOT_GRANTED"}


def main() -> None:
    raw = INPUT.read_bytes()
    result = overlay(get_metadata(*ISSUES), json.loads(raw))
    result["page_reconciliation_sha256"] = hashlib.sha256(raw).hexdigest()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "ch2_issues": result["ch2_issue_count"],
                      "accepted_questions": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
