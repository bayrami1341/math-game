"""The metadata proxy may reveal audit priorities, never certify book depth."""
import json
import unittest
from copy import deepcopy

from audit_g2_question_diversity import analyze, fingerprint


class DiversityProxyTest(unittest.TestCase):
    def sample(self):
        questions = [{"q_id": f"Q-{n:04d}", "anchor": "L-101", "domain": "CORE",
                      "cpa": "علامتی", "stem": f"حاصل {n} + ۲ چند است؟",
                      "structure": "چهارگزینه‌ای", "answer": "الف",
                      "difficulty": "آسان", "stamp": "نیاز به تأیید"} for n in range(1, 105)]
        pages = [{"chapter": (page - 1) // 18 + 1, "book_page": page,
                  "s1_id": f"L-{100+page}", "existing_q_count": 104 if page == 1 else 0,
                  "existing_q_ids": ";".join(q["q_id"] for q in questions) if page == 1 else "",
                  "queue_priority": "P2"} for page in range(1, 145)]
        meta = {"schema": "G2_CONTENT_INVENTORY_v1", "q_total": 104, "q_green": 0,
                "source_visual_status": "NOT_VERIFIED_IN_THIS_RUN", "s1_yellow_page_rows": 144,
                "hashes": {"candidate": "synthetic"}, "pages": pages}
        return meta, questions

    def test_number_mask_only_is_not_semantic_book_depth(self):
        self.assertEqual(fingerprint("حاصل ۱۲ + ۳ چند است؟"), fingerprint("حاصل ۹۹ + ۸ چند است؟"))
        meta, questions = self.sample()
        report = analyze(meta, questions)
        self.assertEqual(report["chapter_summary"][0]["distinct_literal_templates"], 1)
        self.assertEqual(report["chapter_summary"][0]["repeat_excess_after_number_mask"], 103)
        self.assertEqual(report["chapter_summary"][1]["pages_without_q"], 18)
        self.assertEqual(report["chapter_summary"][0]["book_depth_verdict"], "NOT_PROVEN")
        self.assertFalse(report["source_visual_verified"])
        self.assertFalse(report["engine_interaction_tested"])
        self.assertNotIn("حاصل", json.dumps(report, ensure_ascii=False))

    def test_dangling_or_duplicate_or_new_green_fail_closed(self):
        meta, questions = self.sample()
        for field, value, reason in (("anchor", "L-NONEXISTENT", "DUPLICATE_Q_OR_DANGLING_ANCHOR"),
                                     ("q_id", "Q-0002", "DUPLICATE_Q_OR_DANGLING_ANCHOR"),
                                     ("stamp", "تأییدشده", "UNSAFE_Q_METADATA"),
                                     ("answer", "نامعلوم", "UNSAFE_Q_METADATA")):
            with self.subTest(field=field):
                bad = deepcopy(questions)
                bad[0][field] = value
                with self.assertRaisesRegex(ValueError, reason):
                    analyze(meta, bad)

    def test_count_and_page_drift_fail_closed(self):
        meta, questions = self.sample()
        altered = deepcopy(meta)
        altered["pages"][0]["existing_q_count"] = 1
        with self.assertRaisesRegex(ValueError, "QUESTION_ANCHOR_DRIFT"):
            analyze(altered, questions)
        altered = deepcopy(meta)
        altered["source_visual_status"] = "VERIFIED"
        with self.assertRaisesRegex(ValueError, "INVENTORY_SCOPE_OR_VERSION_DRIFT"):
            analyze(altered, questions)


if __name__ == "__main__":
    unittest.main()
