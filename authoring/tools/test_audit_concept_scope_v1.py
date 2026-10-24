"""Synthetic fixtures only. No claim about the content of any actual G2 chapter."""
import copy
import unittest

from audit_concept_scope_v1 import assess, binding_for, inventory_from_intake_index, PROFILE_SCHEMA
from score_content_priority_v2 import assess as score_priority
from test_score_content_priority_v2 import fixture as scoring_fixture

WB = "b" * 64
GUIDE = "a" * 64


def profile():
    scope = {"locator": "synthetic guide, page-specific section", "primary": ["mul"], "prerequisite": ["add"], "incidental": ["talk"],
             "outside": ["division"], "rules": {
                 "mul": {"citation": "synthetic p1 goal", "operations": ["MULTIPLICATION"], "number_domain": {"min": 0, "max": 100}},
                 "add": {"citation": "synthetic p1 prerequisite", "operations": ["ADDITION", "REPEATED_ADDITION"], "number_domain": {"min": 0, "max": 100}},
                 "talk": {"citation": "synthetic p1 discussion", "operations": ["DISCUSSION"], "number_domain": None},
                 "division": {"citation": "synthetic p1 outside", "operations": ["DIVISION"], "number_domain": {"min": 0, "max": 100}}},
             "bridges": []}
    return {"schema": PROFILE_SCHEMA, "profile_id": "synthetic-multiplication-v1", "revision": 1,
            "book_id": "TEST", "edition_id": "synthetic-edition", "source_kind": "OFFICIAL_TEACHER_GUIDE",
            "source_sha256": GUIDE, "source_locator": "synthetic page 1", "reviewed_by": "fixture-only",
            "status": "REVIEWED", "edition_alignment": "SAME_EDITION", "expected_pages": [1, 2],
            "page_scopes": {"1": copy.deepcopy(scope), "2": copy.deepcopy(scope)}}


def inventory():
    base = {"book_id": "TEST", "edition_id": "synthetic-edition"}
    return [{**base, "uid": "L1", "kind": "PAGE", "page": 1},
            {**base, "uid": "Q1", "kind": "QUESTION", "page": 1, "anchor_uid": "L1"},
            {**base, "uid": "L2", "kind": "PAGE", "page": 2},
            {**base, "uid": "Q2", "kind": "QUESTION", "page": 2, "anchor_uid": "L2"}]


def claim(role="MAIN", objective="mul", operation="MULTIPLICATION", operands=None, **extra):
    return {"role": role, "objective_id": objective, "operation": operation,
            "operands": [2, 3] if operands is None else operands,
            "evidence": {"kind": "REVIEWED_WORKBOOK", "status": "REVIEWED", "workbook_sha256": WB,
                         "locator": "synthetic cell", "reviewed_by": "separate fixture reviewer"}, **extra}


def bundles():
    return {item["uid"]: {"claims": [claim()]} for item in inventory()}


def run(p=None, items=None, claims=None):
    return assess(p or profile(), items if items is not None else inventory(),
                  claims if claims is not None else bundles(), workbook_sha256=WB)


class ConceptScopeTests(unittest.TestCase):
    def test_all_pages_and_questions_positive_but_never_release(self):
        output = run()
        self.assertEqual(output["overall"], "ALIGNED_CANDIDATE_ONLY")
        self.assertEqual(output["decision_counts"], {"ALIGNED": 4})
        self.assertEqual(output["missing_pages"], [])
        self.assertEqual(output["release_authorization"], "NOT_GRANTED")
        self.assertEqual(output["book_fidelity"], "ACHILLES_SEPARATE_GATE")

    def test_main_goal_drift_is_critical_even_with_an_aligned_main(self):
        data = bundles()
        data["Q1"]["claims"].append(claim("MAIN", "division", "DIVISION"))
        output = run(claims=data)
        self.assertEqual(output["results"][1]["decision"], "BLOCK_CRITICAL_SCOPE_DRIFT")
        self.assertIn("MAIN_OBJECTIVE_OUTSIDE_PROFILE", output["results"][1]["reasons"])
        self.assertEqual(output["overall"], "BLOCK_CRITICAL_SCOPE_DRIFT")

    def test_wrong_main_operation_and_number_domain_are_critical(self):
        for other, reason in ((claim("MAIN", "mul", "ADDITION"), "MAIN_OPERATION_DRIFT"),
                              (claim(operands=[2, 101]), "MAIN_NUMBER_DOMAIN_DRIFT"),
                              (claim(results=[101]), "MAIN_NUMBER_DOMAIN_DRIFT")):
            data = bundles()
            data["L1"]["claims"] = [other]
            output = run(claims=data)
            self.assertEqual(output["results"][0]["decision"], "BLOCK_CRITICAL_SCOPE_DRIFT")
            self.assertIn(reason, output["results"][0]["reasons"])

    def test_repeated_addition_as_reviewed_prerequisite_not_main_drift(self):
        data = bundles()
        data["Q1"]["claims"].append(claim("PREREQUISITE", "add", "REPEATED_ADDITION"))
        self.assertEqual(run(claims=data)["results"][1]["decision"], "ALIGNED")
        self.assertIn("PREREQUISITE_ALLOWED", run(claims=data)["results"][1]["reasons"])
        data["Q1"]["claims"] = [claim("MAIN", "add", "REPEATED_ADDITION")]
        self.assertEqual(run(claims=data)["results"][1]["decision"], "BLOCK_CRITICAL_SCOPE_DRIFT")

    def test_reviewed_bridge_requires_primary_and_explicit_profile_permission(self):
        p = profile()
        p["page_scopes"]["1"]["rules"]["mul"]["operations"].append("REPEATED_ADDITION")
        p["page_scopes"]["1"]["bridges"] = [{"operation": "REPEATED_ADDITION", "primary_objective_id": "mul"}]
        data = bundles()
        data["Q1"]["claims"].append(claim("BRIDGE", "mul", "REPEATED_ADDITION", bridge_to="mul"))
        self.assertEqual(run(p=p, claims=data)["results"][1]["decision"], "ALIGNED")
        data["Q1"]["claims"] = [claim("BRIDGE", "mul", "REPEATED_ADDITION", bridge_to="mul")]
        self.assertEqual(run(p=p, claims=data)["results"][1]["decision"], "UNKNOWN_REVIEW")
        data["Q1"]["claims"] = [claim("MAIN", "mul", "REPEATED_ADDITION")]
        self.assertEqual(run(p=p, claims=data)["results"][1]["decision"], "BLOCK_CRITICAL_SCOPE_DRIFT")

    def test_secondary_outside_or_domain_issue_is_review_not_critical(self):
        for other in (claim("INCIDENTAL", "division", "DIVISION"),
                      claim("PREREQUISITE", "add", "ADDITION", operands=[101])):
            data = bundles()
            data["Q1"]["claims"].append(other)
            self.assertEqual(run(claims=data)["results"][1]["decision"], "UNKNOWN_REVIEW")
            self.assertNotEqual(run(claims=data)["overall"], "BLOCK_CRITICAL_SCOPE_DRIFT")
        data["Q1"]["claims"] = [claim(), claim("INCIDENTAL", "talk", "DISCUSSION", operands=[])]
        self.assertEqual(run(claims=data)["results"][1]["decision"], "ALIGNED")

    def test_banner_cosmetic_not_same_as_concept_drift(self):
        data = bundles()
        data["L1"]["presentation"] = {"kind": "BANNER", "affects_goal_or_behavior": False}
        self.assertEqual(run(claims=data)["results"][0]["presentation"], "PRESENTATION_ONLY")
        self.assertEqual(run(claims=data)["results"][0]["decision"], "ALIGNED")
        data["L1"]["presentation"]["affects_goal_or_behavior"] = True
        self.assertEqual(run(claims=data)["results"][0]["decision"], "UNKNOWN_REVIEW")
        data["L1"]["claims"] = [claim("MAIN", "division", "DIVISION")]
        self.assertEqual(run(claims=data)["results"][0]["decision"], "BLOCK_CRITICAL_SCOPE_DRIFT")

    def test_missing_unreadable_or_unreviewed_claim_fails_closed(self):
        for bad in (None, {"claims": []}, {"claims": [{**claim(), "evidence": {"status": "UNREVIEWED"}}]},
                    {"claims": [{**claim(), "operands": None}]}):
            data = bundles()
            if bad is None:
                del data["Q2"]
            else:
                data["Q2"] = bad
            self.assertEqual(run(claims=data)["results"][3]["decision"], "UNKNOWN_REVIEW")

    def test_mismatched_or_unreviewed_guide_and_crosswalk_hold_every_item(self):
        p = profile()
        for changed in ({"status": "DRAFT"}, {"edition_alignment": "UNKNOWN"},
                        {"edition_alignment": "REVIEWED_EQUIVALENCE"}, {"edition_id": "other-edition"}):
            other = {**p, **changed}
            self.assertTrue(all(x["decision"] == "UNKNOWN_REVIEW" for x in run(p=other)["results"]))
        p["edition_alignment"] = "REVIEWED_EQUIVALENCE"
        p["equivalence_evidence"] = {"status": "REVIEWED", "source_sha256": "c" * 64,
                                     "locator": "synthetic crosswalk", "reviewed_by": "fixture"}
        self.assertEqual(run(p=p)["overall"], "ALIGNED_CANDIDATE_ONLY")

    def test_missing_page_unanchored_question_and_uninventoried_claim(self):
        items = inventory()[:2]
        output = run(items=items, claims={k: bundles()[k] for k in ("L1", "Q1")})
        self.assertEqual(output["missing_pages"], [2])
        self.assertEqual(output["overall"], "UNKNOWN_REVIEW")
        items = inventory()
        items[1]["anchor_uid"] = "missing"
        self.assertIn("QUESTION_ANCHOR_UNRESOLVED", run(items=items)["results"][1]["reasons"])
        with self.assertRaisesRegex(ValueError, "ORPHAN_CLAIM_UID"):
            run(claims={**bundles(), "invisible": {"claims": []}})

    def test_critical_batch_holds_otherwise_aligned_scorer_bindings(self):
        good = run()
        self.assertEqual(binding_for(good, "Q2")["decision"], "ALIGNED")
        data = bundles()
        data["Q1"]["claims"] = [claim("MAIN", "division", "DIVISION")]
        blocked = run(claims=data)
        self.assertEqual(binding_for(blocked, "Q2")["decision"], "BLOCK_CRITICAL_SCOPE_DRIFT")
        data = bundles()
        del data["Q1"]
        self.assertEqual(binding_for(run(claims=data), "Q2")["decision"], "UNKNOWN_REVIEW")
        with self.assertRaisesRegex(ValueError, "SCOPE_ITEM_NOT_UNIQUE_OR_MISSING"):
            binding_for(good, "missing")

    def test_end_to_end_synthetic_scope_binding_controls_six_factor_scorer(self):
        sample = scoring_fixture()
        sample["content_uid"] = "Q2"
        sample["concept_scope_binding"] = binding_for(run(), "Q2")
        self.assertEqual(score_priority(sample)["status"], "SCORED_EDUCATIONAL_CANDIDATE_ONLY")
        data = bundles()
        data["Q1"]["claims"] = [claim("MAIN", "division", "DIVISION")]
        sample["concept_scope_binding"] = binding_for(run(claims=data), "Q2")
        self.assertEqual(score_priority(sample)["status"], "HOLD_CRITICAL_CONCEPT_DRIFT")

    def test_bad_profile_missing_rules_overlap_or_edition_rejected_or_held(self):
        p = profile()
        p["page_scopes"]["1"]["prerequisite"] = ["mul"]
        with self.assertRaisesRegex(ValueError, "OVERLAPPING"):
            run(p=p)
        p = profile()
        p["page_scopes"]["2"]["rules"]["mul"]["number_domain"] = {"min": 5, "max": 2}
        with self.assertRaisesRegex(ValueError, "INVALID_NUMBER_DOMAIN"):
            run(p=p)

    def test_index_adapter_preserves_all_q_and_chapter_anchor_not_fake_page(self):
        index = {"schema": "arena-content-library-index/v1", "book_id": "TEST",
                 "edition_id": "synthetic-edition", "items": [
                     {"uid": "A", "sheet": "نقشهٔ کتاب (S1)", "fields": {"صفحه/گستره": "۱–۲"}},
                     {"uid": "L1", "sheet": "نقشهٔ کتاب (S1)", "fields": {"صفحه/گستره": "۱"}},
                     {"uid": "Q1", "sheet": "بانک سؤال", "anchor_uid": "L1", "fields": {}}]}
        items = inventory_from_intake_index(index)
        self.assertEqual([(x["kind"], x["page"]) for x in items],
                         [("CHAPTER_ANCHOR", None), ("PAGE", 1), ("QUESTION", 1)])
        output = run(items=items, claims={"L1": {"claims": [claim()]}, "Q1": {"claims": [claim()]}})
        self.assertEqual(output["missing_pages"], [2])
        self.assertEqual(output["results"][0]["reasons"], ["CHAPTER_ANCHOR_NOT_A_PAGE"])


if __name__ == "__main__":
    unittest.main()
