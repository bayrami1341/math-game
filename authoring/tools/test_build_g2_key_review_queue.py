"""A routed question is NOT a human approval request or book witness."""
import copy
import json
import unittest
from pathlib import Path

from audit_g2_question_diversity import read_questions
from build_g2_key_review_queue import route

ROOT = Path(__file__).resolve().parents[2]
META = ROOT / "authoring/g2-completion/G2-COVERAGE-INVENTORY-v1.json"
AUDIT = ROOT / "authoring/g2-completion/G2-PARTIAL-INDEPENDENT-KEY-AUDIT-v1.json"


class KeyReviewRouteTest(unittest.TestCase):
    def inputs(self):
        return (json.loads(META.read_text(encoding="utf-8")),
                json.loads(AUDIT.read_text(encoding="utf-8")), read_questions())

    def test_entire_unchecked_queue_is_private_to_specialist_lanes_first(self):
        result = route(*self.inputs())
        self.assertEqual(result["routed_without_human_approval"], 85)
        self.assertEqual(result["already_checked_explicit_arithmetic_only"], 19)
        self.assertEqual(result["human_decisions_requested_now"], 0)
        self.assertEqual(sum(result["priority_counts"].values()), 85)
        self.assertEqual(sum(result["reason_counts"].values()), 85)
        self.assertFalse(result["visual_evidence_verified"])
        self.assertTrue(all(x["teacher_verdict"] == "NOT_GRANTED" and not x["human_decision_required_now"]
                            and x["book_evidence_status"] == "UNVERIFIED" for x in result["items"]))
        self.assertNotIn("stem", json.dumps(result, ensure_ascii=False))
        self.assertEqual(result["priority_counts"]["P0"], 8)
        self.assertTrue(all(x["prior_verdict_scope_note"] != "NO_SCOPED_PRIOR_VERDICT_APPLIED_BY_THIS_ROUTER"
                            for x in result["items"] if x["book_page_candidate"] in {57, 80}))

    def test_modified_sha_anchor_or_audit_row_blocks(self):
        meta, audit, questions = self.inputs()
        changed = copy.deepcopy(meta)
        changed["hashes"]["candidate"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "PINNED_INPUT_OR_AUDIT_SCOPE_DRIFT"):
            route(changed, audit, questions)
        wrong = copy.deepcopy(questions)
        wrong[0]["anchor"] = "L-DOES-NOT-EXIST"
        with self.assertRaisesRegex(ValueError, "ANCHOR_MISMATCH"):
            route(meta, audit, wrong)
        corrupt = copy.deepcopy(audit)
        corrupt["rows"][0]["reason_code"] = "UNKNOWN_CODE"
        # If row zero was already checked, target an unchecked row instead.
        target = next(r for r in corrupt["rows"] if r["arithmetic_status"].startswith("NOT_CHECKABLE"))
        target["reason_code"] = "UNKNOWN_CODE"
        with self.assertRaisesRegex(ValueError, "UNRECOGNIZED_REASON"):
            route(meta, corrupt, questions)

    def test_no_leakage_of_old_verdict_across_whole_page(self):
        result = route(*self.inputs())
        page57 = [x for x in result["items"] if x["book_page_candidate"] == 57]
        page80 = [x for x in result["items"] if x["book_page_candidate"] == 80]
        self.assertEqual(len(page57), 4)
        self.assertEqual(len(page80), 4)
        self.assertTrue(all("QUESTION2_ONLY" in x["prior_verdict_scope_note"] for x in page57))
        self.assertTrue(all("DISTINCT_FROM_FOUR_ADAPTED" in x["prior_verdict_scope_note"] for x in page80))


if __name__ == "__main__":
    unittest.main()
