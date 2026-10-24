"""Synthetic integration tests only: no G2 workbook, approved Achilles receipt or game."""
import copy
import unittest

from section2_pipeline_v1 import evaluate
from test_audit_concept_scope_v1 import WB, bundles, claim, profile
from test_score_content_priority_v2 import fixture as scoring_fixture


def index():
    rows = []
    for uid, sheet, page, anchor in (("A", "نقشهٔ کتاب (S1)", "۱–۲", None),
                                     ("L1", "نقشهٔ کتاب (S1)", "۱", None),
                                     ("Q1", "بانک سؤال", None, "L1"),
                                     ("L2", "نقشهٔ کتاب (S1)", "۲", None),
                                     ("Q2", "بانک سؤال", None, "L2")):
        rows.append({"uid": uid, "sheet": sheet, "fields": {"صفحه/گستره": page},
                     **({"anchor_uid": anchor} if anchor is not None else {})})
    return {"schema": "arena-content-library-index/v1", "status": "ARCHIVED_NOT_RUNTIME_APPROVED",
            "approval_trust": "RECEIPT_ATTESTED_NOT_CRYPTOGRAPHICALLY_AUTHENTICATED",
            "book_id": "TEST", "edition_id": "synthetic-edition", "workbook_sha256": WB,
            "achilles_receipt_id": "synthetic-receipt", "items": rows}


def score(uid):
    result = scoring_fixture()
    result["content_uid"] = uid
    # This forged status should be overwritten by the orchestrator in every test.
    result["concept_scope_binding"] = {"decision": "ALIGNED", "content_uid": uid}
    return result


class Section2PipelineTests(unittest.TestCase):
    def test_positive_reaches_only_educational_candidate_not_engine_or_release(self):
        report = evaluate(index(), profile(), bundles(), {"Q2": score("Q2")})
        self.assertEqual(report["scope"]["overall"], "ALIGNED_CANDIDATE_ONLY")
        self.assertEqual(report["score_status_counts"], {"HOLD_SCORING_INPUT": 3,
                                                          "SCORED_EDUCATIONAL_CANDIDATE_ONLY": 1})
        self.assertEqual(report["scorecards"][-1]["selection_score_0_100"], 100)
        self.assertEqual(report["coverage_status"], "NOT_ASSESSED_BREADTH_OR_DEPTH")
        self.assertEqual(report["approval_or_release"], "NOT_GRANTED")

    def test_critical_page_or_question_stops_even_otherwise_high_scored_item(self):
        for uid in ("L1", "Q1"):
            claims = bundles()
            claims[uid] = {"claims": [claim("MAIN", "division", "DIVISION")]}
            report = evaluate(index(), profile(), claims, {"Q2": score("Q2")})
            self.assertEqual(report["scope"]["overall"], "BLOCK_CRITICAL_SCOPE_DRIFT")
            self.assertEqual(report["score_status_counts"], {"HOLD_CRITICAL_CONCEPT_DRIFT": 4})
            self.assertTrue(all(x["selection_score_0_100"] is None for x in report["scorecards"]))

    def test_unknown_profile_or_missing_question_fails_closed(self):
        p = profile()
        p["edition_alignment"] = "UNKNOWN"
        self.assertEqual(evaluate(index(), p, bundles(), {"Q2": score("Q2")})["score_status_counts"],
                         {"HOLD_CONCEPT_SCOPE_REVIEW": 4})
        claims = bundles()
        del claims["Q1"]
        self.assertEqual(evaluate(index(), profile(), claims, {"Q2": score("Q2")})["scope"]["overall"],
                         "UNKNOWN_REVIEW")

    def test_input_lineage_and_chapter_anchor_not_exempted(self):
        bad = index()
        bad["approval_trust"] = "SIGNED_BY_ACHILLES"
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED_OR_UNATTESTED_PRIVATE_INDEX"):
            evaluate(bad, profile(), bundles(), {})
        bad = score("Q2")
        bad["workbook_sha256"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "SCORE_INPUT_LINEAGE_MISMATCH"):
            evaluate(index(), profile(), bundles(), {"Q2": bad})
        with self.assertRaisesRegex(ValueError, "CHAPTER_ANCHOR_IS_NOT_PAGE_SCORE"):
            evaluate(index(), profile(), bundles(), {"A": score("A")})


if __name__ == "__main__":
    unittest.main()
